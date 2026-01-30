import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { authMiddleware } from '../auth/middleware.js';

const router = Router();

// Get all workspaces for user
router.get('/', authMiddleware, async (req, res) => {
  try {
    const userId = req.user!.userId;

    const workspaces = await prisma.workspace.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
    });

    res.json(workspaces);
  } catch (error) {
    console.error('Error fetching workspaces:', error);
    res.status(500).json({ error: 'Failed to fetch workspaces' });
  }
});

// Get single workspace
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user!.userId;

    const workspace = await prisma.workspace.findFirst({
      where: {
        id,
        OR: [
          { userId },
          { shares: { some: { sharedWithId: userId } } },
        ],
      },
    });

    if (!workspace) {
      return res.status(404).json({ error: 'Workspace not found' });
    }

    res.json(workspace);
  } catch (error) {
    console.error('Error fetching workspace:', error);
    res.status(500).json({ error: 'Failed to fetch workspace' });
  }
});

// Create workspace
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { name, description } = req.body;
    const userId = req.user!.userId;

    const workspace = await prisma.workspace.create({
      data: {
        name,
        description,
        userId,
      },
    });

    res.status(201).json(workspace);
  } catch (error) {
    console.error('Error creating workspace:', error);
    res.status(500).json({ error: 'Failed to create workspace' });
  }
});

// Update workspace
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description } = req.body;
    const userId = req.user!.userId;

    const workspace = await prisma.workspace.updateMany({
      where: {
        id,
        userId,
      },
      data: {
        name,
        description,
        updatedAt: new Date(),
      },
    });

    if (workspace.count === 0) {
      return res.status(404).json({ error: 'Workspace not found' });
    }

    const updated = await prisma.workspace.findUnique({ where: { id } });
    res.json(updated);
  } catch (error) {
    console.error('Error updating workspace:', error);
    res.status(500).json({ error: 'Failed to update workspace' });
  }
});

// Delete workspace
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user!.userId;

    const deleted = await prisma.workspace.deleteMany({
      where: {
        id,
        userId,
      },
    });

    if (deleted.count === 0) {
      return res.status(404).json({ error: 'Workspace not found' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting workspace:', error);
    res.status(500).json({ error: 'Failed to delete workspace' });
  }
});

export default router;
