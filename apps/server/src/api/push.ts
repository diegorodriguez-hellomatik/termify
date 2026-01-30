import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../auth/middleware.js';
import { pushService } from '../services/PushService.js';

const router = Router();

// Validation schemas
const subscribeSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
});

const unsubscribeSchema = z.object({
  endpoint: z.string().url(),
});

const preferencesSchema = z.object({
  endpoint: z.string().url(),
  preferences: z.object({
    terminalCrashed: z.boolean().optional(),
    sshConnectionFailed: z.boolean().optional(),
    viewerActivity: z.boolean().optional(),
    commandCompleted: z.boolean().optional(),
    shareNotifications: z.boolean().optional(),
  }),
});

/**
 * GET /api/push/vapid-public-key
 * Get the VAPID public key for client subscription
 */
router.get('/push/vapid-public-key', (_req: Request, res: Response) => {
  const publicKey = pushService.getVapidPublicKey();

  if (!publicKey) {
    res.status(503).json({
      success: false,
      error: 'Push notifications are not configured on this server',
    });
    return;
  }

  res.json({
    success: true,
    data: { publicKey },
  });
});

/**
 * POST /api/push/subscribe
 * Register a push subscription
 */
router.post('/push/subscribe', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const data = subscribeSchema.parse(req.body);
    const userAgent = req.headers['user-agent'] || undefined;

    if (!pushService.isConfigured()) {
      res.status(503).json({
        success: false,
        error: 'Push notifications are not configured on this server',
      });
      return;
    }

    const subscription = await pushService.subscribe(
      userId,
      { endpoint: data.endpoint, keys: data.keys },
      userAgent
    );

    res.json({
      success: true,
      data: {
        id: subscription.id,
        preferences: {
          terminalCrashed: subscription.terminalCrashed,
          sshConnectionFailed: subscription.sshConnectionFailed,
          viewerActivity: subscription.viewerActivity,
          commandCompleted: subscription.commandCompleted,
          shareNotifications: subscription.shareNotifications,
        },
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: error.errors });
      return;
    }
    console.error('[API] Error subscribing to push:', error);
    res.status(500).json({ success: false, error: 'Failed to subscribe to push notifications' });
  }
});

/**
 * DELETE /api/push/unsubscribe
 * Remove a push subscription
 */
router.delete('/push/unsubscribe', authMiddleware, async (req: Request, res: Response) => {
  try {
    const data = unsubscribeSchema.parse(req.body);

    const removed = await pushService.unsubscribe(data.endpoint);

    res.json({
      success: true,
      data: { removed },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: error.errors });
      return;
    }
    console.error('[API] Error unsubscribing from push:', error);
    res.status(500).json({ success: false, error: 'Failed to unsubscribe from push notifications' });
  }
});

/**
 * GET /api/push/subscriptions
 * List all push subscriptions for the current user
 */
router.get('/push/subscriptions', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;

    const subscriptions = await pushService.getSubscriptions(userId);

    // Return sanitized data (no auth keys)
    const safeSubscriptions = subscriptions.map((sub) => ({
      id: sub.id,
      endpoint: sub.endpoint,
      userAgent: sub.userAgent,
      preferences: {
        terminalCrashed: sub.terminalCrashed,
        sshConnectionFailed: sub.sshConnectionFailed,
        viewerActivity: sub.viewerActivity,
        commandCompleted: sub.commandCompleted,
        shareNotifications: sub.shareNotifications,
      },
      createdAt: sub.createdAt,
      updatedAt: sub.updatedAt,
    }));

    res.json({
      success: true,
      data: { subscriptions: safeSubscriptions },
    });
  } catch (error) {
    console.error('[API] Error listing push subscriptions:', error);
    res.status(500).json({ success: false, error: 'Failed to list push subscriptions' });
  }
});

/**
 * PATCH /api/push/preferences
 * Update notification preferences for a subscription
 */
router.patch('/push/preferences', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const data = preferencesSchema.parse(req.body);

    const updated = await pushService.updatePreferences(
      userId,
      data.endpoint,
      data.preferences
    );

    if (!updated) {
      res.status(404).json({
        success: false,
        error: 'Subscription not found',
      });
      return;
    }

    res.json({
      success: true,
      data: {
        preferences: {
          terminalCrashed: updated.terminalCrashed,
          sshConnectionFailed: updated.sshConnectionFailed,
          viewerActivity: updated.viewerActivity,
          commandCompleted: updated.commandCompleted,
          shareNotifications: updated.shareNotifications,
        },
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: error.errors });
      return;
    }
    console.error('[API] Error updating push preferences:', error);
    res.status(500).json({ success: false, error: 'Failed to update preferences' });
  }
});

/**
 * POST /api/push/test
 * Send a test notification to verify push is working
 */
router.post('/push/test', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;

    if (!pushService.isConfigured()) {
      res.status(503).json({
        success: false,
        error: 'Push notifications are not configured on this server',
      });
      return;
    }

    const result = await pushService.sendTestNotification(userId);

    res.json({
      success: true,
      data: {
        sent: result.sent,
        failed: result.failed,
        message:
          result.sent > 0
            ? 'Test notification sent successfully'
            : 'No active subscriptions found',
      },
    });
  } catch (error) {
    console.error('[API] Error sending test notification:', error);
    res.status(500).json({ success: false, error: 'Failed to send test notification' });
  }
});

export default router;
