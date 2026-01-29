import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { authMiddleware } from '../auth/middleware.js';

const router = Router();

// Validation schemas
const markReadSchema = z.object({
  notificationIds: z.array(z.string()).min(1),
});

/**
 * GET /api/notifications
 * List all notifications for the current user
 */
router.get('/notifications', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const unreadOnly = req.query.unread === 'true';

    const notifications = await prisma.notification.findMany({
      where: {
        userId,
        ...(unreadOnly ? { read: false } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 50, // Limit to last 50 notifications
    });

    // Count unread
    const unreadCount = await prisma.notification.count({
      where: { userId, read: false },
    });

    res.json({
      success: true,
      data: {
        notifications,
        unreadCount,
      },
    });
  } catch (error) {
    console.error('[API] Error listing notifications:', error);
    res.status(500).json({ success: false, error: 'Failed to list notifications' });
  }
});

/**
 * GET /api/notifications/unread-count
 * Get the count of unread notifications
 */
router.get('/notifications/unread-count', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;

    const unreadCount = await prisma.notification.count({
      where: { userId, read: false },
    });

    res.json({
      success: true,
      data: { unreadCount },
    });
  } catch (error) {
    console.error('[API] Error counting notifications:', error);
    res.status(500).json({ success: false, error: 'Failed to count notifications' });
  }
});

/**
 * PATCH /api/notifications/mark-read
 * Mark specific notifications as read
 */
router.patch('/notifications/mark-read', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const data = markReadSchema.parse(req.body);

    await prisma.notification.updateMany({
      where: {
        id: { in: data.notificationIds },
        userId, // Ensure user can only mark their own notifications
      },
      data: { read: true },
    });

    res.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: error.errors });
      return;
    }
    console.error('[API] Error marking notifications as read:', error);
    res.status(500).json({ success: false, error: 'Failed to mark notifications as read' });
  }
});

/**
 * PATCH /api/notifications/mark-all-read
 * Mark all notifications as read
 */
router.patch('/notifications/mark-all-read', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;

    await prisma.notification.updateMany({
      where: { userId, read: false },
      data: { read: true },
    });

    res.json({ success: true });
  } catch (error) {
    console.error('[API] Error marking all notifications as read:', error);
    res.status(500).json({ success: false, error: 'Failed to mark all notifications as read' });
  }
});

/**
 * DELETE /api/notifications/:id
 * Delete a specific notification
 */
router.delete('/notifications/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const notificationId = req.params.id as string;

    // Verify ownership
    const notification = await prisma.notification.findFirst({
      where: { id: notificationId, userId },
    });

    if (!notification) {
      res.status(404).json({ success: false, error: 'Notification not found' });
      return;
    }

    await prisma.notification.delete({
      where: { id: notificationId },
    });

    res.json({ success: true });
  } catch (error) {
    console.error('[API] Error deleting notification:', error);
    res.status(500).json({ success: false, error: 'Failed to delete notification' });
  }
});

/**
 * DELETE /api/notifications
 * Delete all notifications for the user
 */
router.delete('/notifications', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;

    await prisma.notification.deleteMany({
      where: { userId },
    });

    res.json({ success: true });
  } catch (error) {
    console.error('[API] Error deleting all notifications:', error);
    res.status(500).json({ success: false, error: 'Failed to delete notifications' });
  }
});

export default router;
