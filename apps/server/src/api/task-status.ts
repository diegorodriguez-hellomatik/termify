import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { authMiddleware } from '../auth/middleware.js';

const router = Router();

// Default statuses for new users
const DEFAULT_STATUSES = [
  { key: 'backlog', name: 'Backlog', color: '#6b7280', position: 0, isDefault: true },
  { key: 'todo', name: 'To Do', color: '#3b82f6', position: 1, isDefault: false },
  { key: 'in_progress', name: 'In Progress', color: '#f59e0b', position: 2, isDefault: false },
  { key: 'in_review', name: 'In Review', color: '#8b5cf6', position: 3, isDefault: false },
  { key: 'done', name: 'Done', color: '#10b981', position: 4, isDefault: false },
];

/**
 * Create default statuses for a user if they don't exist
 */
export async function createDefaultStatusesForUser(userId: string): Promise<void> {
  const existingStatuses = await prisma.taskStatusConfig.findFirst({
    where: { userId },
  });

  if (!existingStatuses) {
    await prisma.taskStatusConfig.createMany({
      data: DEFAULT_STATUSES.map((status) => ({
        ...status,
        userId,
      })),
    });
  }
}

// Get all task statuses for user
router.get('/', authMiddleware, async (req, res) => {
  try {
    const userId = req.user!.userId;

    // Ensure default statuses exist
    await createDefaultStatusesForUser(userId);

    const statuses = await prisma.taskStatusConfig.findMany({
      where: { userId },
      orderBy: { position: 'asc' },
    });

    res.json(statuses);
  } catch (error) {
    console.error('Error fetching task statuses:', error);
    res.status(500).json({ error: 'Failed to fetch task statuses' });
  }
});

// Create task status
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { key, name, color, position } = req.body;
    const userId = req.user!.userId;

    const status = await prisma.taskStatusConfig.create({
      data: {
        key,
        name,
        color,
        position: position ?? 0,
        userId,
      },
    });

    res.status(201).json(status);
  } catch (error) {
    console.error('Error creating task status:', error);
    res.status(500).json({ error: 'Failed to create task status' });
  }
});

// Update task status
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, color, position, isDefault } = req.body;
    const userId = req.user!.userId;

    const status = await prisma.taskStatusConfig.updateMany({
      where: {
        id,
        userId,
      },
      data: {
        name,
        color,
        position,
        isDefault,
      },
    });

    if (status.count === 0) {
      return res.status(404).json({ error: 'Task status not found' });
    }

    const updated = await prisma.taskStatusConfig.findUnique({ where: { id } });
    res.json(updated);
  } catch (error) {
    console.error('Error updating task status:', error);
    res.status(500).json({ error: 'Failed to update task status' });
  }
});

// Delete task status
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user!.userId;

    const deleted = await prisma.taskStatusConfig.deleteMany({
      where: {
        id,
        userId,
      },
    });

    if (deleted.count === 0) {
      return res.status(404).json({ error: 'Task status not found' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting task status:', error);
    res.status(500).json({ error: 'Failed to delete task status' });
  }
});

// Reorder task statuses
router.put('/reorder', authMiddleware, async (req, res) => {
  try {
    const { statusIds } = req.body;
    const userId = req.user!.userId;

    // Update position for each status
    await Promise.all(
      statusIds.map((id: string, index: number) =>
        prisma.taskStatusConfig.updateMany({
          where: { id, userId },
          data: { position: index },
        })
      )
    );

    const statuses = await prisma.taskStatusConfig.findMany({
      where: { userId },
      orderBy: { position: 'asc' },
    });

    res.json(statuses);
  } catch (error) {
    console.error('Error reordering task statuses:', error);
    res.status(500).json({ error: 'Failed to reorder task statuses' });
  }
});

export default router;
