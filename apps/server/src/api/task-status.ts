import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { authMiddleware } from '../auth/middleware.js';

const router = Router();

// All routes require authentication
router.use(authMiddleware);

// Default statuses to create for new users/teams
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
 * Helper: Create default statuses for a user
 */
export async function createDefaultStatusesForUser(userId: string) {
  const existingStatuses = await prisma.taskStatusConfig.count({
    where: { userId },
  });

  if (existingStatuses > 0) {
    return; // Already has statuses
  }

  await prisma.taskStatusConfig.createMany({
    data: DEFAULT_STATUSES.map((status) => ({
      ...status,
      userId,
    })),
  });
}

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
 * GET /api/task-statuses
 * List all task statuses for the current user (personal tasks)
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;

    // Ensure user has default statuses
    await createDefaultStatusesForUser(userId);

    const statuses = await prisma.taskStatusConfig.findMany({
      where: { userId },
      orderBy: { position: 'asc' },
    });

    res.json({
      success: true,
      data: { statuses },
    });
  } catch (error) {
    console.error('[API] List task statuses error:', error);
    res.status(500).json({ success: false, error: 'Failed to list task statuses' });
  }
});

/**
 * POST /api/task-statuses
 * Create a new task status for personal tasks
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const data = createStatusSchema.parse(req.body);

    // Check for duplicate key
    const existing = await prisma.taskStatusConfig.findUnique({
      where: { userId_key: { userId, key: data.key } },
    });

    if (existing) {
      res.status(400).json({ success: false, error: 'A status with this key already exists' });
      return;
    }

    // Get the highest position if not provided
    let position = data.position;
    if (position === undefined) {
      const lastStatus = await prisma.taskStatusConfig.findFirst({
        where: { userId },
        orderBy: { position: 'desc' },
      });
      position = (lastStatus?.position ?? -1) + 1;
    }

    // If setting as default, unset other defaults
    if (data.isDefault) {
      await prisma.taskStatusConfig.updateMany({
        where: { userId, isDefault: true },
        data: { isDefault: false },
      });
    }

    const status = await prisma.taskStatusConfig.create({
      data: {
        userId,
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
    console.error('[API] Create task status error:', error);
    res.status(500).json({ success: false, error: 'Failed to create task status' });
  }
});

/**
 * PATCH /api/task-statuses/:id
 * Update a task status
 */
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const statusId = req.params.id as string;
    const data = updateStatusSchema.parse(req.body);

    // Get existing status
    const existingStatus = await prisma.taskStatusConfig.findUnique({
      where: { id: statusId },
    });

    if (!existingStatus) {
      res.status(404).json({ success: false, error: 'Status not found' });
      return;
    }

    // Verify ownership
    if (existingStatus.userId !== userId) {
      res.status(404).json({ success: false, error: 'Status not found' });
      return;
    }

    // If setting as default, unset other defaults
    if (data.isDefault) {
      await prisma.taskStatusConfig.updateMany({
        where: { userId, isDefault: true, id: { not: statusId } },
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
    console.error('[API] Update task status error:', error);
    res.status(500).json({ success: false, error: 'Failed to update task status' });
  }
});

/**
 * DELETE /api/task-statuses/:id
 * Delete a task status (with migration of tasks)
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const statusId = req.params.id as string;
    const moveToStatusId = req.query.moveToStatusId as string | undefined;

    // Get existing status
    const existingStatus = await prisma.taskStatusConfig.findUnique({
      where: { id: statusId },
    });

    if (!existingStatus) {
      res.status(404).json({ success: false, error: 'Status not found' });
      return;
    }

    // Verify ownership
    if (existingStatus.userId !== userId) {
      res.status(404).json({ success: false, error: 'Status not found' });
      return;
    }

    // Count remaining statuses
    const statusCount = await prisma.taskStatusConfig.count({
      where: { userId },
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
    const tasksWithStatus = await prisma.personalTask.count({
      where: { userId, status: existingStatus.key },
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

      // Verify the target status exists and belongs to user
      const targetStatus = await prisma.taskStatusConfig.findUnique({
        where: { id: moveToStatusId },
      });

      if (!targetStatus || targetStatus.userId !== userId) {
        res.status(400).json({ success: false, error: 'Target status not found' });
        return;
      }

      // Migrate tasks
      await prisma.personalTask.updateMany({
        where: { userId, status: existingStatus.key },
        data: { status: targetStatus.key },
      });
    }

    // Delete the status
    await prisma.taskStatusConfig.delete({
      where: { id: statusId },
    });

    res.json({ success: true });
  } catch (error) {
    console.error('[API] Delete task status error:', error);
    res.status(500).json({ success: false, error: 'Failed to delete task status' });
  }
});

/**
 * POST /api/task-statuses/reorder
 * Reorder task statuses
 */
router.post('/reorder', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const data = reorderStatusesSchema.parse(req.body);

    if (data.statusIds.length === 0) {
      res.json({ success: true });
      return;
    }

    // Verify all statuses belong to the user
    const statuses = await prisma.taskStatusConfig.findMany({
      where: { id: { in: data.statusIds }, userId },
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
    console.error('[API] Reorder task statuses error:', error);
    res.status(500).json({ success: false, error: 'Failed to reorder task statuses' });
  }
});

export default router;
