import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { authMiddleware } from '../auth/middleware.js';

const router = Router();

// All routes require authentication
router.use(authMiddleware);

// Validation schemas
const createWorkspaceSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  icon: z.string().max(50).optional(),
  isDefault: z.boolean().optional(),
});

const updateWorkspaceSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional().nullable(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional().nullable(),
  icon: z.string().max(50).optional().nullable(),
  isDefault: z.boolean().optional(),
  position: z.number().int().min(0).optional(),
  layout: z.any().optional().nullable(), // JSON layout object for split panes
  floatingLayout: z.any().optional().nullable(), // JSON layout for floating windows
  settings: z.any().optional().nullable(), // JSON settings object
});

const reorderWorkspacesSchema = z.object({
  workspaceIds: z.array(z.string()),
});

const addTerminalSchema = z.object({
  terminalId: z.string(),
  position: z.number().int().min(0).optional(),
});

const reorderTerminalsSchema = z.object({
  terminalIds: z.array(z.string()),
});

/**
 * GET /api/workspaces
 * List all personal workspaces for the current user (excludes team workspaces)
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;

    // Get only user's personal workspaces (no teamId)
    const workspaces = await prisma.workspace.findMany({
      where: {
        userId,
        teamId: null, // Exclude team workspaces
      },
      include: {
        _count: {
          select: { terminals: true },
        },
      },
      orderBy: { position: 'asc' },
    });

    res.json({
      success: true,
      data: {
        workspaces: workspaces.map((ws) => ({
          id: ws.id,
          name: ws.name,
          description: ws.description,
          color: ws.color,
          icon: ws.icon,
          isDefault: ws.isDefault,
          position: ws.position,
          layout: ws.layout,
          floatingLayout: ws.floatingLayout,
          settings: ws.settings,
          terminalCount: ws._count.terminals,
          createdAt: ws.createdAt,
          updatedAt: ws.updatedAt,
        })),
      },
    });
  } catch (error) {
    console.error('[API] List workspaces error:', error);
    res.status(500).json({ success: false, error: 'Failed to list workspaces' });
  }
});

/**
 * POST /api/workspaces
 * Create a new workspace
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const data = createWorkspaceSchema.parse(req.body);

    // Get the highest position
    const lastWorkspace = await prisma.workspace.findFirst({
      where: { userId },
      orderBy: { position: 'desc' },
    });
    const position = (lastWorkspace?.position ?? -1) + 1;

    // If this is the first workspace or isDefault is true, handle default flag
    if (data.isDefault) {
      // Remove default flag from other workspaces
      await prisma.workspace.updateMany({
        where: { userId, isDefault: true },
        data: { isDefault: false },
      });
    }

    // Check if this is the first workspace
    const workspaceCount = await prisma.workspace.count({ where: { userId } });
    const isDefault = data.isDefault ?? workspaceCount === 0;

    const workspace = await prisma.workspace.create({
      data: {
        userId,
        name: data.name,
        description: data.description,
        color: data.color || '#6366f1',
        icon: data.icon,
        isDefault,
        position,
      },
    });

    res.status(201).json({
      success: true,
      data: {
        id: workspace.id,
        name: workspace.name,
        description: workspace.description,
        color: workspace.color,
        icon: workspace.icon,
        isDefault: workspace.isDefault,
        position: workspace.position,
        layout: workspace.layout,
        floatingLayout: workspace.floatingLayout,
        settings: workspace.settings,
        terminalCount: 0,
        createdAt: workspace.createdAt,
        updatedAt: workspace.updatedAt,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: error.errors });
      return;
    }
    console.error('[API] Create workspace error:', error);
    res.status(500).json({ success: false, error: 'Failed to create workspace' });
  }
});

/**
 * GET /api/workspaces/:id
 * Get a specific workspace with its terminals
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const id = req.params.id as string;

    // Get user's team memberships
    const teamMemberships = await prisma.teamMember.findMany({
      where: { userId },
      select: { teamId: true },
    });
    const teamIds = teamMemberships.map((m) => m.teamId);

    // Find workspace that belongs to user OR to a team user is member of
    const workspace = await prisma.workspace.findFirst({
      where: {
        id,
        OR: [
          { userId }, // User's own workspace
          { teamId: { in: teamIds } }, // Team workspace
        ],
      },
      include: {
        terminals: {
          include: {
            terminal: {
              include: {
                category: true,
              },
            },
          },
          orderBy: { position: 'asc' },
        },
      },
    });

    if (!workspace) {
      res.status(404).json({ success: false, error: 'Workspace not found' });
      return;
    }

    res.json({
      success: true,
      data: {
        id: workspace.id,
        name: workspace.name,
        description: workspace.description,
        color: workspace.color,
        icon: workspace.icon,
        isDefault: workspace.isDefault,
        position: workspace.position,
        layout: workspace.layout,
        floatingLayout: workspace.floatingLayout,
        settings: workspace.settings,
        terminals: workspace.terminals.map((wt) => ({
          id: wt.terminal.id,
          name: wt.terminal.name,
          status: wt.terminal.status,
          type: wt.terminal.type,
          cols: wt.terminal.cols,
          rows: wt.terminal.rows,
          cwd: wt.terminal.cwd,
          isFavorite: wt.terminal.isFavorite,
          position: wt.position,
          lastActiveAt: wt.terminal.lastActiveAt,
          category: wt.terminal.category
            ? {
                id: wt.terminal.category.id,
                name: wt.terminal.category.name,
                color: wt.terminal.category.color,
                icon: wt.terminal.category.icon,
              }
            : null,
          createdAt: wt.terminal.createdAt,
          updatedAt: wt.terminal.updatedAt,
          // Display settings
          fontSize: wt.terminal.fontSize,
          fontFamily: wt.terminal.fontFamily,
          theme: wt.terminal.theme,
        })),
        createdAt: workspace.createdAt,
        updatedAt: workspace.updatedAt,
      },
    });
  } catch (error) {
    console.error('[API] Get workspace error:', error);
    res.status(500).json({ success: false, error: 'Failed to get workspace' });
  }
});

/**
 * PATCH /api/workspaces/:id
 * Update a workspace
 */
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const id = req.params.id as string;
    const data = updateWorkspaceSchema.parse(req.body);

    // Verify ownership
    const existing = await prisma.workspace.findFirst({
      where: { id, userId },
    });

    if (!existing) {
      res.status(404).json({ success: false, error: 'Workspace not found' });
      return;
    }

    // Handle default flag
    if (data.isDefault === true) {
      await prisma.workspace.updateMany({
        where: { userId, isDefault: true, id: { not: id } },
        data: { isDefault: false },
      });
    }

    const workspace = await prisma.workspace.update({
      where: { id },
      data: {
        name: data.name,
        description: data.description,
        color: data.color,
        icon: data.icon,
        isDefault: data.isDefault,
        position: data.position,
        layout: data.layout,
        floatingLayout: data.floatingLayout,
        settings: data.settings,
      },
      include: {
        _count: {
          select: { terminals: true },
        },
      },
    });

    res.json({
      success: true,
      data: {
        id: workspace.id,
        name: workspace.name,
        description: workspace.description,
        color: workspace.color,
        icon: workspace.icon,
        isDefault: workspace.isDefault,
        position: workspace.position,
        layout: workspace.layout,
        floatingLayout: workspace.floatingLayout,
        settings: workspace.settings,
        terminalCount: workspace._count.terminals,
        createdAt: workspace.createdAt,
        updatedAt: workspace.updatedAt,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: error.errors });
      return;
    }
    console.error('[API] Update workspace error:', error);
    res.status(500).json({ success: false, error: 'Failed to update workspace' });
  }
});

/**
 * DELETE /api/workspaces/:id
 * Delete a workspace
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const id = req.params.id as string;

    // Verify ownership
    const existing = await prisma.workspace.findFirst({
      where: { id, userId },
    });

    if (!existing) {
      res.status(404).json({ success: false, error: 'Workspace not found' });
      return;
    }

    // Don't allow deleting the last workspace
    const workspaceCount = await prisma.workspace.count({ where: { userId } });
    if (workspaceCount <= 1) {
      res.status(400).json({ success: false, error: 'Cannot delete the last workspace' });
      return;
    }

    // If deleting the default workspace, make another one default
    if (existing.isDefault) {
      const nextWorkspace = await prisma.workspace.findFirst({
        where: { userId, id: { not: id } },
        orderBy: { position: 'asc' },
      });
      if (nextWorkspace) {
        await prisma.workspace.update({
          where: { id: nextWorkspace.id },
          data: { isDefault: true },
        });
      }
    }

    // Delete (WorkspaceTerminal entries will be cascade deleted)
    await prisma.workspace.delete({
      where: { id },
    });

    res.json({ success: true });
  } catch (error) {
    console.error('[API] Delete workspace error:', error);
    res.status(500).json({ success: false, error: 'Failed to delete workspace' });
  }
});

/**
 * POST /api/workspaces/reorder
 * Reorder workspaces
 */
router.post('/reorder', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const data = reorderWorkspacesSchema.parse(req.body);

    // Verify all workspaces belong to the user
    const workspaces = await prisma.workspace.findMany({
      where: { userId, id: { in: data.workspaceIds } },
    });

    if (workspaces.length !== data.workspaceIds.length) {
      res.status(400).json({ success: false, error: 'Invalid workspace IDs' });
      return;
    }

    // Update positions
    await prisma.$transaction(
      data.workspaceIds.map((id, index) =>
        prisma.workspace.update({
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
    console.error('[API] Reorder workspaces error:', error);
    res.status(500).json({ success: false, error: 'Failed to reorder workspaces' });
  }
});

/**
 * POST /api/workspaces/:id/terminals
 * Add a terminal to a workspace
 */
router.post('/:id/terminals', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const workspaceId = req.params.id as string;
    const data = addTerminalSchema.parse(req.body);

    // Verify workspace ownership
    const workspace = await prisma.workspace.findFirst({
      where: { id: workspaceId, userId },
    });

    if (!workspace) {
      res.status(404).json({ success: false, error: 'Workspace not found' });
      return;
    }

    // Verify terminal ownership
    const terminal = await prisma.terminal.findFirst({
      where: { id: data.terminalId, userId },
    });

    if (!terminal) {
      res.status(404).json({ success: false, error: 'Terminal not found' });
      return;
    }

    // Check if already in workspace
    const existing = await prisma.workspaceTerminal.findUnique({
      where: {
        workspaceId_terminalId: {
          workspaceId,
          terminalId: data.terminalId,
        },
      },
    });

    if (existing) {
      res.status(400).json({ success: false, error: 'Terminal already in workspace' });
      return;
    }

    // Get the highest position in the workspace
    const lastTerminal = await prisma.workspaceTerminal.findFirst({
      where: { workspaceId },
      orderBy: { position: 'desc' },
    });
    const position = data.position ?? (lastTerminal?.position ?? -1) + 1;

    await prisma.workspaceTerminal.create({
      data: {
        workspaceId,
        terminalId: data.terminalId,
        position,
      },
    });

    res.status(201).json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: error.errors });
      return;
    }
    console.error('[API] Add terminal to workspace error:', error);
    res.status(500).json({ success: false, error: 'Failed to add terminal to workspace' });
  }
});

/**
 * DELETE /api/workspaces/:id/terminals/:terminalId
 * Remove a terminal from a workspace
 */
router.delete('/:id/terminals/:terminalId', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const workspaceId = req.params.id as string;
    const terminalId = req.params.terminalId as string;

    // Verify workspace ownership
    const workspace = await prisma.workspace.findFirst({
      where: { id: workspaceId, userId },
    });

    if (!workspace) {
      res.status(404).json({ success: false, error: 'Workspace not found' });
      return;
    }

    // Find and delete the relation
    const workspaceTerminal = await prisma.workspaceTerminal.findUnique({
      where: {
        workspaceId_terminalId: {
          workspaceId,
          terminalId,
        },
      },
    });

    if (!workspaceTerminal) {
      res.status(404).json({ success: false, error: 'Terminal not in workspace' });
      return;
    }

    await prisma.workspaceTerminal.delete({
      where: { id: workspaceTerminal.id },
    });

    res.json({ success: true });
  } catch (error) {
    console.error('[API] Remove terminal from workspace error:', error);
    res.status(500).json({ success: false, error: 'Failed to remove terminal from workspace' });
  }
});

/**
 * POST /api/workspaces/:id/terminals/reorder
 * Reorder terminals in a workspace
 */
router.post('/:id/terminals/reorder', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const workspaceId = req.params.id as string;
    const data = reorderTerminalsSchema.parse(req.body);

    // Verify workspace ownership
    const workspace = await prisma.workspace.findFirst({
      where: { id: workspaceId, userId },
    });

    if (!workspace) {
      res.status(404).json({ success: false, error: 'Workspace not found' });
      return;
    }

    // Verify all terminals are in the workspace
    const workspaceTerminals = await prisma.workspaceTerminal.findMany({
      where: {
        workspaceId,
        terminalId: { in: data.terminalIds },
      },
    });

    if (workspaceTerminals.length !== data.terminalIds.length) {
      res.status(400).json({ success: false, error: 'Invalid terminal IDs' });
      return;
    }

    // Update positions
    await prisma.$transaction(
      data.terminalIds.map((terminalId, index) =>
        prisma.workspaceTerminal.update({
          where: {
            workspaceId_terminalId: {
              workspaceId,
              terminalId,
            },
          },
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
    console.error('[API] Reorder terminals in workspace error:', error);
    res.status(500).json({ success: false, error: 'Failed to reorder terminals' });
  }
});

export default router;
