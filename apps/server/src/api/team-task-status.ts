import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { authMiddleware } from '../auth/middleware.js';
import { TeamRole } from '@termify/shared';

const router = Router();

// All routes require authentication
router.use(authMiddleware);

// Default statuses to create for new teams
const DEFAULT_STATUSES = [
  { key: 'backlog', name: 'Backlog', color: '#6b7280', position: 0, isDefault: true },
  { key: 'todo', name: 'To Do', color: '#3b82f6', position: 1, isDefault: false },
  { key: 'in_progress', name: 'In Progress', color: '#eab308', position: 2, isDefault: false },
  { key: 'in_review', name: 'In Review', color: '#a855f7', position: 3, isDefault: false },
  { key: 'done', name: 'Done', color: '#22c55e', position: 4, isDefault: false },
];

// Validation schemas
const createStatusSchema = z.object({
  key: z.string().min(1).max(50).regex(/^[a-z0-9_]+$/, 'Key must be lowercase alphanumeric with underscores'),
  name: z.string().min(1).max(100),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Color must be a valid hex color'),
  position: z.number().int().min(0).optional(),
  isDefault: z.boolean().optional().default(false),
});

const updateStatusSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Color must be a valid hex color').optional(),
  position: z.number().int().min(0).optional(),
  isDefault: z.boolean().optional(),
});

const reorderStatusesSchema = z.object({
  statusIds: z.array(z.string()),
});

/**
 * Helper: Create default statuses for a team
 */
export async function createDefaultStatusesForTeam(teamId: string) {
  const existingStatuses = await prisma.taskStatusConfig.count({
    where: { teamId },
  });

  if (existingStatuses > 0) {
    return; // Already has statuses
  }

  await prisma.taskStatusConfig.createMany({
    data: DEFAULT_STATUSES.map((status) => ({
      ...status,
      teamId,
    })),
  });
}

/**
 * Helper: Check if user can manage team task statuses
 */
async function canManageStatuses(teamId: string, userId: string): Promise<boolean> {
  const membership = await prisma.teamMember.findUnique({
    where: { teamId_userId: { teamId, userId } },
    include: {
      customRole: true,
    },
  });

  if (!membership) return false;

  // Owners and admins can manage statuses
  if (membership.role === TeamRole.OWNER || membership.role === TeamRole.ADMIN) {
    return true;
  }

  // Check custom role permissions
  if (membership.customRole?.permissions.includes('edit_team_settings')) {
    return true;
  }

  return false;
}

/**
 * GET /api/teams/:teamId/task-statuses
 * List all task statuses for a team
 */
router.get('/:teamId/task-statuses', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const teamId = req.params.teamId as string;

    // Verify membership
    const membership = await prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId } },
    });

    if (!membership) {
      res.status(404).json({ success: false, error: 'Team not found' });
      return;
    }

    // Ensure team has default statuses
    await createDefaultStatusesForTeam(teamId);

    const statuses = await prisma.taskStatusConfig.findMany({
      where: { teamId },
      orderBy: { position: 'asc' },
    });

    res.json({
      success: true,
      data: { statuses },
    });
  } catch (error) {
    console.error('[API] List team task statuses error:', error);
    res.status(500).json({ success: false, error: 'Failed to list team task statuses' });
  }
});

/**
 * POST /api/teams/:teamId/task-statuses
 * Create a new task status for a team
 */
router.post('/:teamId/task-statuses', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const teamId = req.params.teamId as string;
    const data = createStatusSchema.parse(req.body);

    // Check permissions
    if (!(await canManageStatuses(teamId, userId))) {
      res.status(403).json({ success: false, error: 'You do not have permission to manage task statuses' });
      return;
    }

    // Check for duplicate key
    const existing = await prisma.taskStatusConfig.findUnique({
      where: { teamId_key: { teamId, key: data.key } },
    });

    if (existing) {
      res.status(400).json({ success: false, error: 'A status with this key already exists' });
      return;
    }

    // Get the highest position if not provided
    let position = data.position;
    if (position === undefined) {
      const lastStatus = await prisma.taskStatusConfig.findFirst({
        where: { teamId },
        orderBy: { position: 'desc' },
      });
      position = (lastStatus?.position ?? -1) + 1;
    }

    // If setting as default, unset other defaults
    if (data.isDefault) {
      await prisma.taskStatusConfig.updateMany({
        where: { teamId, isDefault: true },
        data: { isDefault: false },
      });
    }

    const status = await prisma.taskStatusConfig.create({
      data: {
        teamId,
        key: data.key,
        name: data.name,
        color: data.color,
        position,
        isDefault: data.isDefault,
      },
    });

    res.status(201).json({
      success: true,
      data: status,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: error.errors });
      return;
    }
    console.error('[API] Create team task status error:', error);
    res.status(500).json({ success: false, error: 'Failed to create team task status' });
  }
});

/**
 * PATCH /api/teams/:teamId/task-statuses/:statusId
 * Update a team task status
 */
router.patch('/:teamId/task-statuses/:statusId', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const teamId = req.params.teamId as string;
    const statusId = req.params.statusId as string;
    const data = updateStatusSchema.parse(req.body);

    // Check permissions
    if (!(await canManageStatuses(teamId, userId))) {
      res.status(403).json({ success: false, error: 'You do not have permission to manage task statuses' });
      return;
    }

    // Get existing status
    const existingStatus = await prisma.taskStatusConfig.findUnique({
      where: { id: statusId },
    });

    if (!existingStatus || existingStatus.teamId !== teamId) {
      res.status(404).json({ success: false, error: 'Status not found' });
      return;
    }

    // If setting as default, unset other defaults
    if (data.isDefault) {
      await prisma.taskStatusConfig.updateMany({
        where: { teamId, isDefault: true, id: { not: statusId } },
        data: { isDefault: false },
      });
    }

    const status = await prisma.taskStatusConfig.update({
      where: { id: statusId },
      data: {
        name: data.name,
        color: data.color,
        position: data.position,
        isDefault: data.isDefault,
      },
    });

    res.json({
      success: true,
      data: status,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: error.errors });
      return;
    }
    console.error('[API] Update team task status error:', error);
    res.status(500).json({ success: false, error: 'Failed to update team task status' });
  }
});

/**
 * DELETE /api/teams/:teamId/task-statuses/:statusId
 * Delete a team task status (with migration of tasks)
 */
router.delete('/:teamId/task-statuses/:statusId', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const teamId = req.params.teamId as string;
    const statusId = req.params.statusId as string;
    const moveToStatusId = req.query.moveToStatusId as string | undefined;

    // Check permissions
    if (!(await canManageStatuses(teamId, userId))) {
      res.status(403).json({ success: false, error: 'You do not have permission to manage task statuses' });
      return;
    }

    // Get existing status
    const existingStatus = await prisma.taskStatusConfig.findUnique({
      where: { id: statusId },
    });

    if (!existingStatus || existingStatus.teamId !== teamId) {
      res.status(404).json({ success: false, error: 'Status not found' });
      return;
    }

    // Count remaining statuses
    const statusCount = await prisma.taskStatusConfig.count({
      where: { teamId },
    });

    if (statusCount <= 1) {
      res.status(400).json({ success: false, error: 'Cannot delete the last status' });
      return;
    }

    // Cannot delete the default status
    if (existingStatus.isDefault) {
      res.status(400).json({ success: false, error: 'Cannot delete the default status. Set another status as default first.' });
      return;
    }

    // Check if there are tasks with this status
    const tasksWithStatus = await prisma.task.count({
      where: { teamId, status: existingStatus.key },
    });

    if (tasksWithStatus > 0) {
      if (!moveToStatusId) {
        res.status(400).json({
          success: false,
          error: 'This status has tasks. Provide moveToStatusId to migrate tasks.',
          tasksCount: tasksWithStatus,
        });
        return;
      }

      // Verify the target status exists and belongs to team
      const targetStatus = await prisma.taskStatusConfig.findUnique({
        where: { id: moveToStatusId },
      });

      if (!targetStatus || targetStatus.teamId !== teamId) {
        res.status(400).json({ success: false, error: 'Target status not found' });
        return;
      }

      // Migrate tasks
      await prisma.task.updateMany({
        where: { teamId, status: existingStatus.key },
        data: { status: targetStatus.key },
      });
    }

    // Delete the status
    await prisma.taskStatusConfig.delete({
      where: { id: statusId },
    });

    res.json({ success: true });
  } catch (error) {
    console.error('[API] Delete team task status error:', error);
    res.status(500).json({ success: false, error: 'Failed to delete team task status' });
  }
});

/**
 * POST /api/teams/:teamId/task-statuses/reorder
 * Reorder team task statuses
 */
router.post('/:teamId/task-statuses/reorder', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const teamId = req.params.teamId as string;
    const data = reorderStatusesSchema.parse(req.body);

    // Check permissions
    if (!(await canManageStatuses(teamId, userId))) {
      res.status(403).json({ success: false, error: 'You do not have permission to manage task statuses' });
      return;
    }

    if (data.statusIds.length === 0) {
      res.json({ success: true });
      return;
    }

    // Verify all statuses belong to the team
    const statuses = await prisma.taskStatusConfig.findMany({
      where: { id: { in: data.statusIds }, teamId },
    });

    if (statuses.length !== data.statusIds.length) {
      res.status(400).json({ success: false, error: 'Invalid status IDs' });
      return;
    }

    // Update positions
    await prisma.$transaction(
      data.statusIds.map((id, index) =>
        prisma.taskStatusConfig.update({
          where: { id },
          data: { position: index },
        })
      )
    );

    res.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: error.errors });
      return;
    }
    console.error('[API] Reorder team task statuses error:', error);
    res.status(500).json({ success: false, error: 'Failed to reorder team task statuses' });
  }
});

export default router;
