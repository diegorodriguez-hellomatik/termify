import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { authMiddleware } from '../auth/middleware.js';

const router = Router();

// Apply auth middleware to all routes
router.use(authMiddleware);

// Validation schemas
const createProfileSchema = z.object({
  name: z.string().min(1).max(100),
  icon: z.string().max(50).optional(),
  color: z.string().max(20).optional().default('#6366f1'),
  description: z.string().max(500).optional(),
  cols: z.number().int().min(40).max(500).optional().default(120),
  rows: z.number().int().min(10).max(200).optional().default(30),
  cwd: z.string().max(1000).optional(),
  shell: z.string().max(500).optional(),
  env: z.record(z.string()).optional(),
  initCommands: z.array(z.string().max(1000)).max(20).optional().default([]),
  isDefault: z.boolean().optional().default(false),
});

const updateProfileSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  icon: z.string().max(50).optional().nullable(),
  color: z.string().max(20).optional(),
  description: z.string().max(500).optional().nullable(),
  cols: z.number().int().min(40).max(500).optional(),
  rows: z.number().int().min(10).max(200).optional(),
  cwd: z.string().max(1000).optional().nullable(),
  shell: z.string().max(500).optional().nullable(),
  env: z.record(z.string()).optional().nullable(),
  initCommands: z.array(z.string().max(1000)).max(20).optional(),
  isDefault: z.boolean().optional(),
});

/**
 * GET /api/profiles
 * List all profiles for the authenticated user
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;

    const profiles = await prisma.terminalProfile.findMany({
      where: { userId },
      orderBy: [
        { isDefault: 'desc' },
        { name: 'asc' },
      ],
    });

    res.json({
      success: true,
      data: {
        profiles,
        total: profiles.length,
      },
    });
  } catch (error) {
    console.error('[API] Error listing profiles:', error);
    res.status(500).json({ success: false, error: 'Failed to list profiles' });
  }
});

/**
 * GET /api/profiles/:id
 * Get a specific profile
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { id } = req.params;

    const profile = await prisma.terminalProfile.findFirst({
      where: { id: id as string, userId },
    });

    if (!profile) {
      res.status(404).json({ success: false, error: 'Profile not found' });
      return;
    }

    res.json({
      success: true,
      data: profile,
    });
  } catch (error) {
    console.error('[API] Error getting profile:', error);
    res.status(500).json({ success: false, error: 'Failed to get profile' });
  }
});

/**
 * POST /api/profiles
 * Create a new profile
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const data = createProfileSchema.parse(req.body);

    // If this is set as default, unset other defaults
    if (data.isDefault) {
      await prisma.terminalProfile.updateMany({
        where: { userId, isDefault: true },
        data: { isDefault: false },
      });
    }

    const profile = await prisma.terminalProfile.create({
      data: {
        userId,
        name: data.name,
        icon: data.icon,
        color: data.color,
        description: data.description,
        cols: data.cols,
        rows: data.rows,
        cwd: data.cwd,
        shell: data.shell,
        env: data.env,
        initCommands: data.initCommands,
        isDefault: data.isDefault,
      },
    });

    res.status(201).json({
      success: true,
      data: profile,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: error.errors });
      return;
    }
    console.error('[API] Error creating profile:', error);
    res.status(500).json({ success: false, error: 'Failed to create profile' });
  }
});

/**
 * PATCH /api/profiles/:id
 * Update a profile
 */
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { id } = req.params;
    const data = updateProfileSchema.parse(req.body);

    // Verify ownership
    const existing = await prisma.terminalProfile.findFirst({
      where: { id: id as string, userId },
    });

    if (!existing) {
      res.status(404).json({ success: false, error: 'Profile not found' });
      return;
    }

    // If setting as default, unset other defaults
    if (data.isDefault) {
      await prisma.terminalProfile.updateMany({
        where: { userId, isDefault: true, id: { not: id as string } },
        data: { isDefault: false },
      });
    }

    // Build update data, handling env field specially for Prisma
    const updateData: Prisma.TerminalProfileUpdateInput = {
      name: data.name,
      icon: data.icon,
      color: data.color,
      description: data.description,
      cols: data.cols,
      rows: data.rows,
      cwd: data.cwd,
      shell: data.shell,
      initCommands: data.initCommands,
      isDefault: data.isDefault,
    };

    // Handle env field - use Prisma.DbNull for null values
    if (data.env === null) {
      updateData.env = Prisma.DbNull;
    } else if (data.env !== undefined) {
      updateData.env = data.env;
    }

    const profile = await prisma.terminalProfile.update({
      where: { id: id as string },
      data: updateData,
    });

    res.json({
      success: true,
      data: profile,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: error.errors });
      return;
    }
    console.error('[API] Error updating profile:', error);
    res.status(500).json({ success: false, error: 'Failed to update profile' });
  }
});

/**
 * DELETE /api/profiles/:id
 * Delete a profile
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { id } = req.params;

    // Verify ownership
    const existing = await prisma.terminalProfile.findFirst({
      where: { id: id as string, userId },
    });

    if (!existing) {
      res.status(404).json({ success: false, error: 'Profile not found' });
      return;
    }

    await prisma.terminalProfile.delete({
      where: { id: id as string },
    });

    res.json({ success: true });
  } catch (error) {
    console.error('[API] Error deleting profile:', error);
    res.status(500).json({ success: false, error: 'Failed to delete profile' });
  }
});

export default router;
