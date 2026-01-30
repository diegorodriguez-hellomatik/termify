import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { authMiddleware } from '../auth/middleware.js';

const router = Router();

// All routes require authentication
router.use(authMiddleware);

// Validation schemas
const createBoardSchema = z.object({
  name: z.string().min(1).max(100),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional().default('#6366f1'),
  icon: z.string().max(50).optional().nullable(),
  isDefault: z.boolean().optional().default(false),
});

const updateBoardSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  icon: z.string().max(50).optional().nullable(),
  isDefault: z.boolean().optional(),
});

const reorderBoardsSchema = z.object({
  boardIds: z.array(z.string()).min(1),
});

/**
 * GET /api/personal-task-boards
 * List all personal task boards for the current user
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;

    const boards = await prisma.personalTaskBoard.findMany({
      where: { userId },
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
      include: {
        _count: {
          select: { tasks: true },
        },
      },
    });

    res.json({
      success: true,
      data: { boards },
    });
  } catch (error) {
    console.error('[API] List personal task boards error:', error);
    res.status(500).json({ success: false, error: 'Failed to list personal task boards' });
  }
});

/**
 * POST /api/personal-task-boards
 * Create a new personal task board
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const data = createBoardSchema.parse(req.body);

    // Get the highest position
    const lastBoard = await prisma.personalTaskBoard.findFirst({
      where: { userId },
      orderBy: { position: 'desc' },
    });
    const position = (lastBoard?.position ?? -1) + 1;

    // If this is set as default, unset other defaults
    if (data.isDefault) {
      await prisma.personalTaskBoard.updateMany({
        where: { userId, isDefault: true },
        data: { isDefault: false },
      });
    }

    // Create board
    const board = await prisma.personalTaskBoard.create({
      data: {
        userId,
        name: data.name,
        color: data.color,
        icon: data.icon,
        position,
        isDefault: data.isDefault,
      },
      include: {
        _count: {
          select: { tasks: true },
        },
      },
    });

    res.status(201).json({
      success: true,
      data: board,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: error.errors });
      return;
    }
    console.error('[API] Create personal task board error:', error);
    res.status(500).json({ success: false, error: 'Failed to create personal task board' });
  }
});

/**
 * GET /api/personal-task-boards/:id
 * Get personal task board details
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const boardId = req.params.id as string;

    const board = await prisma.personalTaskBoard.findUnique({
      where: { id: boardId },
      include: {
        _count: {
          select: { tasks: true },
        },
      },
    });

    if (!board) {
      res.status(404).json({ success: false, error: 'Board not found' });
      return;
    }

    // Verify ownership
    if (board.userId !== userId) {
      res.status(404).json({ success: false, error: 'Board not found' });
      return;
    }

    res.json({
      success: true,
      data: board,
    });
  } catch (error) {
    console.error('[API] Get personal task board error:', error);
    res.status(500).json({ success: false, error: 'Failed to get personal task board' });
  }
});

/**
 * PATCH /api/personal-task-boards/:id
 * Update a personal task board
 */
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const boardId = req.params.id as string;
    const data = updateBoardSchema.parse(req.body);

    // Get board
    const existingBoard = await prisma.personalTaskBoard.findUnique({
      where: { id: boardId },
    });

    if (!existingBoard) {
      res.status(404).json({ success: false, error: 'Board not found' });
      return;
    }

    // Verify ownership
    if (existingBoard.userId !== userId) {
      res.status(404).json({ success: false, error: 'Board not found' });
      return;
    }

    // If this is set as default, unset other defaults
    if (data.isDefault) {
      await prisma.personalTaskBoard.updateMany({
        where: { userId, isDefault: true, id: { not: boardId } },
        data: { isDefault: false },
      });
    }

    // Update board
    const board = await prisma.personalTaskBoard.update({
      where: { id: boardId },
      data: {
        name: data.name,
        color: data.color,
        icon: data.icon,
        isDefault: data.isDefault,
      },
      include: {
        _count: {
          select: { tasks: true },
        },
      },
    });

    res.json({
      success: true,
      data: board,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: error.errors });
      return;
    }
    console.error('[API] Update personal task board error:', error);
    res.status(500).json({ success: false, error: 'Failed to update personal task board' });
  }
});

/**
 * DELETE /api/personal-task-boards/:id
 * Delete a personal task board (tasks are kept but unassigned from board)
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const boardId = req.params.id as string;

    // Get board
    const board = await prisma.personalTaskBoard.findUnique({
      where: { id: boardId },
    });

    if (!board) {
      res.status(404).json({ success: false, error: 'Board not found' });
      return;
    }

    // Verify ownership
    if (board.userId !== userId) {
      res.status(404).json({ success: false, error: 'Board not found' });
      return;
    }

    // Delete board (tasks will have boardId set to null due to OnDelete: SetNull)
    await prisma.personalTaskBoard.delete({
      where: { id: boardId },
    });

    res.json({ success: true });
  } catch (error) {
    console.error('[API] Delete personal task board error:', error);
    res.status(500).json({ success: false, error: 'Failed to delete personal task board' });
  }
});

/**
 * POST /api/personal-task-boards/reorder
 * Reorder personal task boards
 */
router.post('/reorder', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const data = reorderBoardsSchema.parse(req.body);

    // Verify all boards belong to the user
    const boards = await prisma.personalTaskBoard.findMany({
      where: { id: { in: data.boardIds }, userId },
    });

    if (boards.length !== data.boardIds.length) {
      res.status(400).json({ success: false, error: 'Invalid board IDs' });
      return;
    }

    // Update positions
    await prisma.$transaction(
      data.boardIds.map((id, index) =>
        prisma.personalTaskBoard.update({
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
    console.error('[API] Reorder personal task boards error:', error);
    res.status(500).json({ success: false, error: 'Failed to reorder personal task boards' });
  }
});

export default router;
