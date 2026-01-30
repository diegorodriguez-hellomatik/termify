import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { authMiddleware } from '../auth/middleware.js';

const router = Router();

// Register push subscription
router.post('/push/subscribe', authMiddleware, async (req, res) => {
  try {
    const { subscription } = req.body;
    const userId = req.user!.userId;

    await prisma.pushSubscription.upsert({
      where: {
        userId_endpoint: {
          userId,
          endpoint: subscription.endpoint,
        },
      },
      update: {
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
        updatedAt: new Date(),
      },
      create: {
        userId,
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
      },
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error saving push subscription:', error);
    res.status(500).json({ error: 'Failed to save subscription' });
  }
});

// Unregister push subscription
router.post('/push/unsubscribe', authMiddleware, async (req, res) => {
  try {
    const { endpoint } = req.body;
    const userId = req.user!.userId;

    await prisma.pushSubscription.deleteMany({
      where: {
        userId,
        endpoint,
      },
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error removing push subscription:', error);
    res.status(500).json({ error: 'Failed to remove subscription' });
  }
});

// Get push settings
router.get('/push/settings', authMiddleware, async (req, res) => {
  try {
    const userId = req.user!.userId;

    const settings = await prisma.pushSettings.findUnique({
      where: { userId },
    });

    res.json(settings || { enabled: true, taskUpdates: true, teamActivity: true });
  } catch (error) {
    console.error('Error fetching push settings:', error);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

// Update push settings
router.put('/push/settings', authMiddleware, async (req, res) => {
  try {
    const { enabled, taskUpdates, teamActivity } = req.body;
    const userId = req.user!.userId;

    const settings = await prisma.pushSettings.upsert({
      where: { userId },
      update: { enabled, taskUpdates, teamActivity },
      create: { userId, enabled, taskUpdates, teamActivity },
    });

    res.json(settings);
  } catch (error) {
    console.error('Error updating push settings:', error);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

export default router;
