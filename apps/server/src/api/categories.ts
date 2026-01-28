import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { authMiddleware } from '../auth/middleware.js';

const router = Router();

// All routes require authentication
router.use(authMiddleware);

// Validation schemas
const createCategorySchema = z.object({
  name: z.string().min(1).max(50),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  icon: z.string().max(50).optional(),
});

const updateCategorySchema = z.object({
  name: z.string().min(1).max(50).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  icon: z.string().max(50).optional().nullable(),
  position: z.number().int().min(0).optional(),
});

const reorderSchema = z.object({
  categoryIds: z.array(z.string()),
});

/**
 * GET /api/categories
 * List all categories for the current user
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;

    const categories = await prisma.category.findMany({
      where: { userId },
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
        categories: categories.map((cat) => ({
          id: cat.id,
          name: cat.name,
          color: cat.color,
          icon: cat.icon,
          position: cat.position,
          terminalCount: cat._count.terminals,
          createdAt: cat.createdAt,
          updatedAt: cat.updatedAt,
        })),
      },
    });
  } catch (error) {
    console.error('[API] List categories error:', error);
    res.status(500).json({ success: false, error: 'Failed to list categories' });
  }
});

/**
 * POST /api/categories
 * Create a new category
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const data = createCategorySchema.parse(req.body);

    // Get the highest position
    const lastCategory = await prisma.category.findFirst({
      where: { userId },
      orderBy: { position: 'desc' },
    });
    const position = (lastCategory?.position ?? -1) + 1;

    const category = await prisma.category.create({
      data: {
        userId,
        name: data.name,
        color: data.color || '#6366f1',
        icon: data.icon,
        position,
      },
    });

    res.status(201).json({
      success: true,
      data: {
        id: category.id,
        name: category.name,
        color: category.color,
        icon: category.icon,
        position: category.position,
        terminalCount: 0,
        createdAt: category.createdAt,
        updatedAt: category.updatedAt,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: error.errors });
      return;
    }
    console.error('[API] Create category error:', error);
    res.status(500).json({ success: false, error: 'Failed to create category' });
  }
});

/**
 * PATCH /api/categories/:id
 * Update a category
 */
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { id } = req.params;
    const data = updateCategorySchema.parse(req.body);

    // Verify ownership
    const existing = await prisma.category.findFirst({
      where: { id, userId },
    });

    if (!existing) {
      res.status(404).json({ success: false, error: 'Category not found' });
      return;
    }

    const category = await prisma.category.update({
      where: { id },
      data: {
        name: data.name,
        color: data.color,
        icon: data.icon,
        position: data.position,
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
        id: category.id,
        name: category.name,
        color: category.color,
        icon: category.icon,
        position: category.position,
        terminalCount: category._count.terminals,
        createdAt: category.createdAt,
        updatedAt: category.updatedAt,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: error.errors });
      return;
    }
    console.error('[API] Update category error:', error);
    res.status(500).json({ success: false, error: 'Failed to update category' });
  }
});

/**
 * DELETE /api/categories/:id
 * Delete a category
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { id } = req.params;

    // Verify ownership
    const existing = await prisma.category.findFirst({
      where: { id, userId },
    });

    if (!existing) {
      res.status(404).json({ success: false, error: 'Category not found' });
      return;
    }

    // Delete (terminals will have categoryId set to null due to onDelete: SetNull)
    await prisma.category.delete({
      where: { id },
    });

    res.json({ success: true });
  } catch (error) {
    console.error('[API] Delete category error:', error);
    res.status(500).json({ success: false, error: 'Failed to delete category' });
  }
});

/**
 * POST /api/categories/reorder
 * Reorder categories
 */
router.post('/reorder', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const data = reorderSchema.parse(req.body);

    // Verify all categories belong to the user
    const categories = await prisma.category.findMany({
      where: { userId, id: { in: data.categoryIds } },
    });

    if (categories.length !== data.categoryIds.length) {
      res.status(400).json({ success: false, error: 'Invalid category IDs' });
      return;
    }

    // Update positions
    await prisma.$transaction(
      data.categoryIds.map((id, index) =>
        prisma.category.update({
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
    console.error('[API] Reorder categories error:', error);
    res.status(500).json({ success: false, error: 'Failed to reorder categories' });
  }
});

export default router;
