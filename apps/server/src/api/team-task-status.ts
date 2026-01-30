import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { authMiddleware } from '../auth/middleware.js';

const router = Router();

// Get all task statuses for team
router.get('/:teamId/task-statuses', authMiddleware, async (req, res) => {
  try {
    const { teamId } = req.params;
    const userId = req.user!.userId;

    // Verify team membership
    const member = await prisma.teamMember.findFirst({
      where: {
        teamId,
        userId,
      },
    });

    if (!member) {
      return res.status(403).json({ error: 'Not a team member' });
    }

    const statuses = await prisma.teamTaskStatus.findMany({
      where: { teamId },
      orderBy: { order: 'asc' },
    });

    res.json(statuses);
  } catch (error) {
    console.error('Error fetching team task statuses:', error);
    res.status(500).json({ error: 'Failed to fetch task statuses' });
  }
});

// Create team task status
router.post('/:teamId/task-statuses', authMiddleware, async (req, res) => {
  try {
    const { teamId } = req.params;
    const { name, color, order } = req.body;
    const userId = req.user!.userId;

    // Verify team admin
    const member = await prisma.teamMember.findFirst({
      where: {
        teamId,
        userId,
        role: { in: ['owner', 'admin'] },
      },
    });

    if (!member) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const status = await prisma.teamTaskStatus.create({
      data: {
        name,
        color,
        order: order ?? 0,
        teamId,
      },
    });

    res.status(201).json(status);
  } catch (error) {
    console.error('Error creating team task status:', error);
    res.status(500).json({ error: 'Failed to create task status' });
  }
});

// Update team task status
router.put('/:teamId/task-statuses/:statusId', authMiddleware, async (req, res) => {
  try {
    const { teamId, statusId } = req.params;
    const { name, color, order } = req.body;
    const userId = req.user!.userId;

    // Verify team admin
    const member = await prisma.teamMember.findFirst({
      where: {
        teamId,
        userId,
        role: { in: ['owner', 'admin'] },
      },
    });

    if (!member) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const status = await prisma.teamTaskStatus.updateMany({
      where: {
        id: statusId,
        teamId,
      },
      data: {
        name,
        color,
        order,
        updatedAt: new Date(),
      },
    });

    if (status.count === 0) {
      return res.status(404).json({ error: 'Task status not found' });
    }

    const updated = await prisma.teamTaskStatus.findUnique({ where: { id: statusId } });
    res.json(updated);
  } catch (error) {
    console.error('Error updating team task status:', error);
    res.status(500).json({ error: 'Failed to update task status' });
  }
});

// Delete team task status
router.delete('/:teamId/task-statuses/:statusId', authMiddleware, async (req, res) => {
  try {
    const { teamId, statusId } = req.params;
    const userId = req.user!.userId;

    // Verify team admin
    const member = await prisma.teamMember.findFirst({
      where: {
        teamId,
        userId,
        role: { in: ['owner', 'admin'] },
      },
    });

    if (!member) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const deleted = await prisma.teamTaskStatus.deleteMany({
      where: {
        id: statusId,
        teamId,
      },
    });

    if (deleted.count === 0) {
      return res.status(404).json({ error: 'Task status not found' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting team task status:', error);
    res.status(500).json({ error: 'Failed to delete task status' });
  }
});

// Reorder team task statuses
router.put('/:teamId/task-statuses/reorder', authMiddleware, async (req, res) => {
  try {
    const { teamId } = req.params;
    const { statusIds } = req.body;
    const userId = req.user!.userId;

    // Verify team admin
    const member = await prisma.teamMember.findFirst({
      where: {
        teamId,
        userId,
        role: { in: ['owner', 'admin'] },
      },
    });

    if (!member) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    // Update order for each status
    await Promise.all(
      statusIds.map((id: string, index: number) =>
        prisma.teamTaskStatus.updateMany({
          where: { id, teamId },
          data: { order: index },
        })
      )
    );

    const statuses = await prisma.teamTaskStatus.findMany({
      where: { teamId },
      orderBy: { order: 'asc' },
    });

    res.json(statuses);
  } catch (error) {
    console.error('Error reordering team task statuses:', error);
    res.status(500).json({ error: 'Failed to reorder task statuses' });
  }
});

export default router;
