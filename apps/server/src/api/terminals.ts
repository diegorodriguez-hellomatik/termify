import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { authMiddleware } from '../auth/middleware.js';
import { getPTYManager } from '../pty/PTYManager.js';
import { DEFAULT_COLS, DEFAULT_ROWS, TerminalStatus } from '@claude-terminal/shared';

const router = Router();

// Apply auth middleware to all routes
router.use(authMiddleware);

// Validation schemas
const createTerminalSchema = z.object({
  name: z.string().min(1).max(100).optional().default('Terminal'),
  cols: z.number().int().min(40).max(500).optional().default(DEFAULT_COLS),
  rows: z.number().int().min(10).max(200).optional().default(DEFAULT_ROWS),
  cwd: z.string().max(1000).optional(),
  categoryId: z.string().optional(),
});

const updateTerminalSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  cols: z.number().int().min(40).max(500).optional(),
  rows: z.number().int().min(10).max(200).optional(),
  categoryId: z.string().optional().nullable(),
  position: z.number().int().min(0).optional(),
});

const reorderSchema = z.object({
  terminalIds: z.array(z.string()),
});

/**
 * GET /api/terminals
 * List all terminals for the authenticated user
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;

    const terminals = await prisma.terminal.findMany({
      where: { userId },
      include: {
        category: {
          select: { id: true, name: true, color: true, icon: true },
        },
      },
      orderBy: [{ position: 'asc' }, { createdAt: 'desc' }],
    });

    // Enrich with runtime status from PTY manager
    const ptyManager = getPTYManager();
    const enrichedTerminals = terminals.map((terminal) => {
      const instance = ptyManager.get(terminal.id);
      return {
        ...terminal,
        status: instance?.status || terminal.status,
        outputBuffer: undefined, // Don't send buffer in list
      };
    });

    res.json({
      success: true,
      data: {
        terminals: enrichedTerminals,
        total: enrichedTerminals.length,
      },
    });
  } catch (error) {
    console.error('[API] Error listing terminals:', error);
    res.status(500).json({ success: false, error: 'Failed to list terminals' });
  }
});

/**
 * GET /api/terminals/:id
 * Get a specific terminal
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { id } = req.params;

    const terminal = await prisma.terminal.findFirst({
      where: { id, userId },
    });

    if (!terminal) {
      res.status(404).json({ success: false, error: 'Terminal not found' });
      return;
    }

    // Enrich with runtime status
    const ptyManager = getPTYManager();
    const instance = ptyManager.get(terminal.id);

    res.json({
      success: true,
      data: {
        ...terminal,
        status: instance?.status || terminal.status,
        outputBuffer: undefined,
      },
    });
  } catch (error) {
    console.error('[API] Error getting terminal:', error);
    res.status(500).json({ success: false, error: 'Failed to get terminal' });
  }
});

/**
 * POST /api/terminals
 * Create a new terminal
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const data = createTerminalSchema.parse(req.body);

    // Get the highest position
    const lastTerminal = await prisma.terminal.findFirst({
      where: { userId },
      orderBy: { position: 'desc' },
    });
    const position = (lastTerminal?.position ?? -1) + 1;

    // Verify category ownership if provided
    if (data.categoryId) {
      const category = await prisma.category.findFirst({
        where: { id: data.categoryId, userId },
      });
      if (!category) {
        res.status(400).json({ success: false, error: 'Invalid category' });
        return;
      }
    }

    const terminal = await prisma.terminal.create({
      data: {
        userId,
        name: data.name,
        cols: data.cols,
        rows: data.rows,
        cwd: data.cwd,
        categoryId: data.categoryId,
        position,
        status: TerminalStatus.STOPPED,
      },
      include: {
        category: {
          select: { id: true, name: true, color: true, icon: true },
        },
      },
    });

    // Log the action
    await prisma.auditLog.create({
      data: {
        userId,
        action: 'terminal.create',
        resource: 'terminal',
        resourceId: terminal.id,
        details: { name: data.name },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      },
    });

    res.status(201).json({
      success: true,
      data: terminal,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: error.errors });
      return;
    }
    console.error('[API] Error creating terminal:', error);
    res.status(500).json({ success: false, error: 'Failed to create terminal' });
  }
});

/**
 * PATCH /api/terminals/:id
 * Update a terminal
 */
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { id } = req.params;
    const data = updateTerminalSchema.parse(req.body);

    // Verify ownership
    const existing = await prisma.terminal.findFirst({
      where: { id, userId },
    });

    if (!existing) {
      res.status(404).json({ success: false, error: 'Terminal not found' });
      return;
    }

    const terminal = await prisma.terminal.update({
      where: { id },
      data,
    });

    // If cols/rows changed and terminal is running, resize PTY
    if (data.cols || data.rows) {
      const ptyManager = getPTYManager();
      if (ptyManager.has(id)) {
        ptyManager.resize(id, terminal.cols, terminal.rows);
      }
    }

    res.json({
      success: true,
      data: terminal,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: error.errors });
      return;
    }
    console.error('[API] Error updating terminal:', error);
    res.status(500).json({ success: false, error: 'Failed to update terminal' });
  }
});

/**
 * DELETE /api/terminals/:id
 * Delete a terminal
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { id } = req.params;

    // Verify ownership
    const existing = await prisma.terminal.findFirst({
      where: { id, userId },
    });

    if (!existing) {
      res.status(404).json({ success: false, error: 'Terminal not found' });
      return;
    }

    // Kill PTY if running
    const ptyManager = getPTYManager();
    ptyManager.kill(id);

    await prisma.terminal.delete({
      where: { id },
    });

    // Log the action
    await prisma.auditLog.create({
      data: {
        userId,
        action: 'terminal.delete',
        resource: 'terminal',
        resourceId: id,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      },
    });

    res.json({ success: true });
  } catch (error) {
    console.error('[API] Error deleting terminal:', error);
    res.status(500).json({ success: false, error: 'Failed to delete terminal' });
  }
});

/**
 * POST /api/terminals/reorder
 * Reorder terminals
 */
router.post('/reorder', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const data = reorderSchema.parse(req.body);

    // Verify all terminals belong to the user
    const terminals = await prisma.terminal.findMany({
      where: { userId, id: { in: data.terminalIds } },
    });

    if (terminals.length !== data.terminalIds.length) {
      res.status(400).json({ success: false, error: 'Invalid terminal IDs' });
      return;
    }

    // Update positions
    await prisma.$transaction(
      data.terminalIds.map((id, index) =>
        prisma.terminal.update({
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
    console.error('[API] Error reordering terminals:', error);
    res.status(500).json({ success: false, error: 'Failed to reorder terminals' });
  }
});

export default router;
