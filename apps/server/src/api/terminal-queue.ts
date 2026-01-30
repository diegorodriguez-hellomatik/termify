import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { authMiddleware } from '../auth/middleware.js';

const router = Router();

// Get terminal queue for user
router.get('/terminal-queue', authMiddleware, async (req, res) => {
  try {
    const userId = req.user!.userId;

    const queue = await prisma.terminalQueue.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
      include: {
        terminal: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    res.json(queue);
  } catch (error) {
    console.error('Error fetching terminal queue:', error);
    res.status(500).json({ error: 'Failed to fetch queue' });
  }
});

// Add command to queue
router.post('/terminal-queue', authMiddleware, async (req, res) => {
  try {
    const { terminalId, command, priority = 0 } = req.body;
    const userId = req.user!.userId;

    // Verify terminal ownership
    const terminal = await prisma.terminal.findFirst({
      where: {
        id: terminalId,
        userId,
      },
    });

    if (!terminal) {
      return res.status(404).json({ error: 'Terminal not found' });
    }

    const queueItem = await prisma.terminalQueue.create({
      data: {
        terminalId,
        userId,
        command,
        priority,
        status: 'pending',
      },
    });

    res.status(201).json(queueItem);
  } catch (error) {
    console.error('Error adding to queue:', error);
    res.status(500).json({ error: 'Failed to add to queue' });
  }
});

// Update queue item status
router.put('/terminal-queue/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const userId = req.user!.userId;

    const item = await prisma.terminalQueue.updateMany({
      where: {
        id,
        userId,
      },
      data: {
        status,
        updatedAt: new Date(),
      },
    });

    if (item.count === 0) {
      return res.status(404).json({ error: 'Queue item not found' });
    }

    const updated = await prisma.terminalQueue.findUnique({ where: { id } });
    res.json(updated);
  } catch (error) {
    console.error('Error updating queue item:', error);
    res.status(500).json({ error: 'Failed to update queue item' });
  }
});

// Remove from queue
router.delete('/terminal-queue/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user!.userId;

    const deleted = await prisma.terminalQueue.deleteMany({
      where: {
        id,
        userId,
      },
    });

    if (deleted.count === 0) {
      return res.status(404).json({ error: 'Queue item not found' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error removing from queue:', error);
    res.status(500).json({ error: 'Failed to remove from queue' });
  }
});

// Clear queue for terminal
router.delete('/terminal-queue/terminal/:terminalId', authMiddleware, async (req, res) => {
  try {
    const { terminalId } = req.params;
    const userId = req.user!.userId;

    await prisma.terminalQueue.deleteMany({
      where: {
        terminalId,
        userId,
      },
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error clearing queue:', error);
    res.status(500).json({ error: 'Failed to clear queue' });
  }
});

export default router;
