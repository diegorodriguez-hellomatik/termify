import webpush, { PushSubscription as WebPushSubscription, SendResult } from 'web-push';
import { prisma } from '../lib/prisma.js';
import { NotificationType, PushSubscription } from '@prisma/client';

// Initialize web-push with VAPID keys
const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
const vapidSubject = process.env.VAPID_SUBJECT || 'mailto:notifications@termify.app';

if (vapidPublicKey && vapidPrivateKey) {
  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
  console.log('[PushService] Initialized with VAPID keys');
} else {
  console.warn('[PushService] VAPID keys not configured - push notifications disabled');
}

export interface PushNotificationPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  data?: {
    terminalId?: string;
    teamId?: string;
    taskId?: string;
    url?: string;
    [key: string]: unknown;
  };
  actions?: Array<{
    action: string;
    title: string;
  }>;
}

// Map notification types to preference fields
const notificationTypeToPreference: Record<NotificationType, keyof Pick<PushSubscription, 'terminalCrashed' | 'sshConnectionFailed' | 'viewerActivity' | 'commandCompleted' | 'shareNotifications'>> = {
  TERMINAL_CRASHED: 'terminalCrashed',
  SSH_CONNECTION_FAILED: 'sshConnectionFailed',
  VIEWER_JOINED: 'viewerActivity',
  VIEWER_LEFT: 'viewerActivity',
  COMMAND_COMPLETED: 'commandCompleted',
  TERMINAL_SHARED: 'shareNotifications',
  TERMINAL_SHARE_REVOKED: 'shareNotifications',
  TERMINAL_SHARE_UPDATED: 'shareNotifications',
  WORKSPACE_SHARED: 'shareNotifications',
  WORKSPACE_SHARE_REVOKED: 'shareNotifications',
  WORKSPACE_SHARE_UPDATED: 'shareNotifications',
  // These types don't have specific preferences, always send if subscribed
  SYSTEM: 'shareNotifications',
  TEAM_INVITE: 'shareNotifications',
  TEAM_MEMBER_JOINED: 'shareNotifications',
  TEAM_MEMBER_LEFT: 'shareNotifications',
  TEAM_ROLE_CHANGED: 'shareNotifications',
  TEAM_CHAT_MESSAGE: 'shareNotifications',
  TASK_ASSIGNED: 'shareNotifications',
  TASK_UNASSIGNED: 'shareNotifications',
  TASK_STATUS_CHANGED: 'shareNotifications',
  TASK_DUE_SOON: 'shareNotifications',
  TASK_OVERDUE: 'shareNotifications',
};

export class PushService {
  private static instance: PushService;

  static getInstance(): PushService {
    if (!PushService.instance) {
      PushService.instance = new PushService();
    }
    return PushService.instance;
  }

  /**
   * Check if push notifications are configured
   */
  isConfigured(): boolean {
    return Boolean(vapidPublicKey && vapidPrivateKey);
  }

  /**
   * Get the VAPID public key for client subscription
   */
  getVapidPublicKey(): string | null {
    return vapidPublicKey || null;
  }

  /**
   * Send push notification to all subscriptions of a user
   * Respects user preferences for notification types
   */
  async sendToUser(
    userId: string,
    type: NotificationType,
    payload: PushNotificationPayload
  ): Promise<{ sent: number; failed: number }> {
    if (!this.isConfigured()) {
      console.warn('[PushService] Cannot send - VAPID keys not configured');
      return { sent: 0, failed: 0 };
    }

    // Get user's push subscriptions
    const subscriptions = await prisma.pushSubscription.findMany({
      where: { userId },
    });

    if (subscriptions.length === 0) {
      return { sent: 0, failed: 0 };
    }

    // Get the preference field for this notification type
    const preferenceField = notificationTypeToPreference[type];

    // Filter subscriptions by preference
    const eligibleSubscriptions = subscriptions.filter((sub) => {
      if (!preferenceField) return true;
      return sub[preferenceField] === true;
    });

    if (eligibleSubscriptions.length === 0) {
      return { sent: 0, failed: 0 };
    }

    const results = await Promise.allSettled(
      eligibleSubscriptions.map((sub) => this.sendNotification(sub, payload))
    );

    let sent = 0;
    let failed = 0;
    const invalidSubscriptionIds: string[] = [];

    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        sent++;
      } else {
        failed++;
        const error = result.reason;
        const subscription = eligibleSubscriptions[index];

        // If subscription is invalid (410 Gone or 404), mark for removal
        if (
          error?.statusCode === 410 ||
          error?.statusCode === 404 ||
          error?.code === 'ERR_PUSH_SUBSCRIPTION_UNSUBSCRIBED'
        ) {
          invalidSubscriptionIds.push(subscription.id);
        } else {
          console.error(
            `[PushService] Failed to send notification to subscription ${subscription.id}:`,
            error
          );
        }
      }
    });

    // Clean up invalid subscriptions
    if (invalidSubscriptionIds.length > 0) {
      await this.removeInvalidSubscriptions(invalidSubscriptionIds);
    }

    return { sent, failed };
  }

  /**
   * Send notification to a specific subscription
   */
  private async sendNotification(
    subscription: PushSubscription,
    payload: PushNotificationPayload
  ): Promise<SendResult> {
    const pushSubscription: WebPushSubscription = {
      endpoint: subscription.endpoint,
      keys: {
        p256dh: subscription.p256dh,
        auth: subscription.auth,
      },
    };

    // Add default icon if not provided
    const notificationPayload = {
      ...payload,
      icon: payload.icon || '/icon-192x192.png',
      badge: payload.badge || '/badge-72x72.png',
    };

    return webpush.sendNotification(
      pushSubscription,
      JSON.stringify(notificationPayload)
    );
  }

  /**
   * Remove invalid subscriptions from database
   */
  private async removeInvalidSubscriptions(ids: string[]): Promise<void> {
    if (ids.length === 0) return;

    try {
      await prisma.pushSubscription.deleteMany({
        where: {
          id: { in: ids },
        },
      });
      console.log(`[PushService] Removed ${ids.length} invalid subscription(s)`);
    } catch (error) {
      console.error('[PushService] Failed to remove invalid subscriptions:', error);
    }
  }

  /**
   * Subscribe a user to push notifications
   */
  async subscribe(
    userId: string,
    subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
    userAgent?: string
  ): Promise<PushSubscription> {
    // Upsert to handle re-subscriptions
    return prisma.pushSubscription.upsert({
      where: { endpoint: subscription.endpoint },
      update: {
        userId,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
        userAgent,
        updatedAt: new Date(),
      },
      create: {
        userId,
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
        userAgent,
      },
    });
  }

  /**
   * Unsubscribe from push notifications
   */
  async unsubscribe(endpoint: string): Promise<boolean> {
    try {
      await prisma.pushSubscription.delete({
        where: { endpoint },
      });
      return true;
    } catch (error) {
      // Subscription might not exist
      return false;
    }
  }

  /**
   * Get all subscriptions for a user
   */
  async getSubscriptions(userId: string): Promise<PushSubscription[]> {
    return prisma.pushSubscription.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Update notification preferences for a subscription
   */
  async updatePreferences(
    userId: string,
    endpoint: string,
    preferences: Partial<{
      terminalCrashed: boolean;
      sshConnectionFailed: boolean;
      viewerActivity: boolean;
      commandCompleted: boolean;
      shareNotifications: boolean;
    }>
  ): Promise<PushSubscription | null> {
    try {
      return await prisma.pushSubscription.update({
        where: {
          endpoint,
          userId, // Ensure user owns this subscription
        },
        data: preferences,
      });
    } catch (error) {
      return null;
    }
  }

  /**
   * Send a test notification to verify subscription works
   */
  async sendTestNotification(userId: string): Promise<{ sent: number; failed: number }> {
    return this.sendToUser(userId, 'SYSTEM', {
      title: 'Test Notification',
      body: 'Push notifications are working correctly!',
      data: {
        url: '/settings',
      },
    });
  }
}

// Export singleton instance
export const pushService = PushService.getInstance();
