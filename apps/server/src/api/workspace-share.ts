import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { authMiddleware } from '../auth/middleware.js';

const router = Router();

// Get shared workspaces
router.get('/workspaces/shared', authMiddleware, async (req, res) => {
  try {
    const userId = req.user!.userId;

    const sharedWorkspaces = await prisma.workspaceShare.findMany({
      where: {
        sharedWithId: userId,
      },
      include: {
        workspace: true,
        sharedBy: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
    });

    res.json(sharedWorkspaces);
  } catch (error) {
    console.error('Error fetching shared workspaces:', error);
    res.status(500).json({ error: 'Failed to fetch shared workspaces' });
  }
});

// Share a workspace
router.post('/workspaces/:id/share', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { email, permission = 'view' } = req.body;
    const userId = req.user!.userId;

    // Find workspace
    const workspace = await prisma.workspace.findFirst({
      where: {
        id,
        userId,
      },
    });

    if (!workspace) {
      return res.status(404).json({ error: 'Workspace not found' });
    }

    // Find user to share with
    const userToShare = await prisma.user.findUnique({
      where: { email },
    });

    if (!userToShare) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Create share
    const share = await prisma.workspaceShare.create({
      data: {
        workspaceId: id,
        sharedById: userId,
        sharedWithId: userToShare.id,
        permission,
      },
    });

    res.json(share);
  } catch (error) {
    console.error('Error sharing workspace:', error);
    res.status(500).json({ error: 'Failed to share workspace' });
  }
});

// Remove workspace share
router.delete('/workspaces/:id/share/:shareId', authMiddleware, async (req, res) => {
  try {
    const { id, shareId } = req.params;
    const userId = req.user!.userId;

    // Verify ownership
    const workspace = await prisma.workspace.findFirst({
      where: {
        id,
        userId,
      },
    });

    if (!workspace) {
      return res.status(404).json({ error: 'Workspace not found' });
    }

    await prisma.workspaceShare.delete({
      where: { id: shareId },
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error removing workspace share:', error);
    res.status(500).json({ error: 'Failed to remove share' });
  }
});

export default router;
