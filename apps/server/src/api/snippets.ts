import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { authMiddleware } from '../auth/middleware.js';

const router = Router();

// Apply auth middleware to all routes
router.use(authMiddleware);

// Validation schemas
const createSnippetSchema = z.object({
  name: z.string().min(1).max(100),
  command: z.string().min(1).max(10000),
  description: z.string().max(500).optional(),
  category: z.string().max(50).optional(),
  tags: z.array(z.string().max(30)).max(10).optional().default([]),
});

const updateSnippetSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  command: z.string().min(1).max(10000).optional(),
  description: z.string().max(500).optional().nullable(),
  category: z.string().max(50).optional().nullable(),
  tags: z.array(z.string().max(30)).max(10).optional(),
  isFavorite: z.boolean().optional(),
});

/**
 * GET /api/snippets
 * List all snippets for the authenticated user
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { category, search } = req.query;

    const where: any = { userId };

    if (category) {
      where.category = category as string;
    }

    if (search) {
      const searchStr = search as string;
      where.OR = [
        { name: { contains: searchStr, mode: 'insensitive' } },
        { command: { contains: searchStr, mode: 'insensitive' } },
        { description: { contains: searchStr, mode: 'insensitive' } },
      ];
    }

    const snippets = await prisma.snippet.findMany({
      where,
      orderBy: [
        { isFavorite: 'desc' },
        { usageCount: 'desc' },
        { updatedAt: 'desc' },
      ],
    });

    // Get unique categories
    const categories = await prisma.snippet.findMany({
      where: { userId, category: { not: null } },
      distinct: ['category'],
      select: { category: true },
    });

    res.json({
      success: true,
      data: {
        snippets,
        categories: categories.map((c) => c.category).filter(Boolean),
        total: snippets.length,
      },
    });
  } catch (error) {
    console.error('[API] Error listing snippets:', error);
    res.status(500).json({ success: false, error: 'Failed to list snippets' });
  }
});

/**
 * GET /api/snippets/:id
 * Get a specific snippet
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { id } = req.params;

    const snippet = await prisma.snippet.findFirst({
      where: { id: id as string, userId },
    });

    if (!snippet) {
      res.status(404).json({ success: false, error: 'Snippet not found' });
      return;
    }

    res.json({
      success: true,
      data: snippet,
    });
  } catch (error) {
    console.error('[API] Error getting snippet:', error);
    res.status(500).json({ success: false, error: 'Failed to get snippet' });
  }
});

/**
 * POST /api/snippets
 * Create a new snippet
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const data = createSnippetSchema.parse(req.body);

    const snippet = await prisma.snippet.create({
      data: {
        userId,
        name: data.name,
        command: data.command,
        description: data.description,
        category: data.category,
        tags: data.tags,
      },
    });

    res.status(201).json({
      success: true,
      data: snippet,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: error.errors });
      return;
    }
    console.error('[API] Error creating snippet:', error);
    res.status(500).json({ success: false, error: 'Failed to create snippet' });
  }
});

/**
 * PATCH /api/snippets/:id
 * Update a snippet
 */
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { id } = req.params;
    const data = updateSnippetSchema.parse(req.body);

    // Verify ownership
    const existing = await prisma.snippet.findFirst({
      where: { id: id as string, userId },
    });

    if (!existing) {
      res.status(404).json({ success: false, error: 'Snippet not found' });
      return;
    }

    const snippet = await prisma.snippet.update({
      where: { id: id as string },
      data,
    });

    res.json({
      success: true,
      data: snippet,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: error.errors });
      return;
    }
    console.error('[API] Error updating snippet:', error);
    res.status(500).json({ success: false, error: 'Failed to update snippet' });
  }
});

/**
 * POST /api/snippets/:id/use
 * Increment usage count for a snippet
 */
router.post('/:id/use', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { id } = req.params;

    // Verify ownership
    const existing = await prisma.snippet.findFirst({
      where: { id: id as string, userId },
    });

    if (!existing) {
      res.status(404).json({ success: false, error: 'Snippet not found' });
      return;
    }

    const snippet = await prisma.snippet.update({
      where: { id: id as string },
      data: {
        usageCount: { increment: 1 },
      },
    });

    res.json({
      success: true,
      data: snippet,
    });
  } catch (error) {
    console.error('[API] Error incrementing snippet usage:', error);
    res.status(500).json({ success: false, error: 'Failed to update snippet' });
  }
});

/**
 * DELETE /api/snippets/:id
 * Delete a snippet
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { id } = req.params;

    // Verify ownership
    const existing = await prisma.snippet.findFirst({
      where: { id: id as string, userId },
    });

    if (!existing) {
      res.status(404).json({ success: false, error: 'Snippet not found' });
      return;
    }

    await prisma.snippet.delete({
      where: { id: id as string },
    });

    res.json({ success: true });
  } catch (error) {
    console.error('[API] Error deleting snippet:', error);
    res.status(500).json({ success: false, error: 'Failed to delete snippet' });
  }
});

export default router;
