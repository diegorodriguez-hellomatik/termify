import { useState, useEffect, useCallback } from 'react';
import { pushApi, PushPreferences } from '@/lib/api';

interface UsePushNotificationsOptions {
  token: string | null;
}

interface UsePushNotificationsReturn {
  isSupported: boolean;
  permission: NotificationPermission;
  isSubscribed: boolean;
  isLoading: boolean;
  error: string | null;
  preferences: PushPreferences | null;
  currentEndpoint: string | null;
  subscribe: () => Promise<boolean>;
  unsubscribe: () => Promise<boolean>;
  updatePreferences: (preferences: Partial<PushPreferences>) => Promise<boolean>;
  sendTestNotification: () => Promise<{ sent: number; failed: number } | null>;
  refresh: () => Promise<void>;
}

// Check if push notifications are supported
function isPushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

// Convert a base64 string to Uint8Array for the applicationServerKey
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function usePushNotifications({
  token,
}: UsePushNotificationsOptions): UsePushNotificationsReturn {
  const [isSupported] = useState(isPushSupported());
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [preferences, setPreferences] = useState<PushPreferences | null>(null);
  const [currentEndpoint, setCurrentEndpoint] = useState<string | null>(null);
  const [vapidPublicKey, setVapidPublicKey] = useState<string | null>(null);

  // Initialize and check current state
  const refresh = useCallback(async () => {
    if (!isSupported || !token) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Update permission state
      setPermission(Notification.permission);

      // Fetch VAPID public key if not cached
      if (!vapidPublicKey) {
        const keyResponse = await pushApi.getVapidPublicKey();
        if (keyResponse.success && keyResponse.data) {
          setVapidPublicKey(keyResponse.data.publicKey);
        } else {
          setError('Push notifications not configured on server');
          setIsLoading(false);
          return;
        }
      }

      // Check if service worker is registered and has a push subscription
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        setCurrentEndpoint(subscription.endpoint);
        // Fetch preferences from server
        const subsResponse = await pushApi.getSubscriptions(token);
        if (subsResponse.success && subsResponse.data) {
          const serverSub = subsResponse.data.subscriptions.find(
            (s) => s.endpoint === subscription.endpoint
          );
          if (serverSub) {
            setIsSubscribed(true);
            setPreferences(serverSub.preferences);
          } else {
            // Local subscription exists but not on server - resubscribe
            setIsSubscribed(false);
          }
        }
      } else {
        setIsSubscribed(false);
        setCurrentEndpoint(null);
        setPreferences(null);
      }
    } catch (err) {
      console.error('[Push] Error during initialization:', err);
      setError('Failed to initialize push notifications');
    } finally {
      setIsLoading(false);
    }
  }, [isSupported, token, vapidPublicKey]);

  // Initialize on mount and when token changes
  useEffect(() => {
    refresh();
  }, [refresh]);

  // Register service worker on mount
  useEffect(() => {
    if (!isSupported) return;

    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        console.log('[Push] Service worker registered:', registration.scope);
      })
      .catch((err) => {
        console.error('[Push] Service worker registration failed:', err);
      });
  }, [isSupported]);

  // Subscribe to push notifications
  const subscribe = useCallback(async (): Promise<boolean> => {
    if (!isSupported || !token || !vapidPublicKey) {
      setError('Push notifications not available');
      return false;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Request notification permission
      const permissionResult = await Notification.requestPermission();
      setPermission(permissionResult);

      if (permissionResult !== 'granted') {
        setError('Notification permission denied');
        setIsLoading(false);
        return false;
      }

      // Get service worker registration
      const registration = await navigator.serviceWorker.ready;

      // Subscribe to push
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as BufferSource,
      });

      // Extract keys
      const p256dh = subscription.getKey('p256dh');
      const auth = subscription.getKey('auth');

      if (!p256dh || !auth) {
        throw new Error('Failed to get subscription keys');
      }

      // Send to server
      const response = await pushApi.subscribe(
        {
          endpoint: subscription.endpoint,
          keys: {
            p256dh: btoa(String.fromCharCode(...new Uint8Array(p256dh))),
            auth: btoa(String.fromCharCode(...new Uint8Array(auth))),
          },
        },
        token
      );

      if (response.success && response.data) {
        setIsSubscribed(true);
        setCurrentEndpoint(subscription.endpoint);
        setPreferences(response.data.preferences);
        return true;
      } else {
        throw new Error(
          typeof response.error === 'string'
            ? response.error
            : 'Failed to register subscription'
        );
      }
    } catch (err) {
      console.error('[Push] Subscribe error:', err);
      setError(err instanceof Error ? err.message : 'Failed to subscribe');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [isSupported, token, vapidPublicKey]);

  // Unsubscribe from push notifications
  const unsubscribe = useCallback(async (): Promise<boolean> => {
    if (!isSupported || !token) {
      return false;
    }

    setIsLoading(true);
    setError(null);

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        // Unsubscribe from browser
        await subscription.unsubscribe();

        // Remove from server
        await pushApi.unsubscribe(subscription.endpoint, token);
      }

      setIsSubscribed(false);
      setCurrentEndpoint(null);
      setPreferences(null);
      return true;
    } catch (err) {
      console.error('[Push] Unsubscribe error:', err);
      setError(err instanceof Error ? err.message : 'Failed to unsubscribe');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [isSupported, token]);

  // Update notification preferences
  const updatePreferences = useCallback(
    async (newPreferences: Partial<PushPreferences>): Promise<boolean> => {
      if (!token || !currentEndpoint) {
        return false;
      }

      setError(null);

      try {
        const response = await pushApi.updatePreferences(
          currentEndpoint,
          newPreferences,
          token
        );

        if (response.success && response.data) {
          setPreferences(response.data.preferences);
          return true;
        } else {
          throw new Error(
            typeof response.error === 'string'
              ? response.error
              : 'Failed to update preferences'
          );
        }
      } catch (err) {
        console.error('[Push] Update preferences error:', err);
        setError(err instanceof Error ? err.message : 'Failed to update preferences');
        return false;
      }
    },
    [token, currentEndpoint]
  );

  // Send test notification
  const sendTestNotification = useCallback(async (): Promise<{
    sent: number;
    failed: number;
  } | null> => {
    if (!token) {
      return null;
    }

    setError(null);

    try {
      const response = await pushApi.sendTest(token);

      if (response.success && response.data) {
        return {
          sent: response.data.sent,
          failed: response.data.failed,
        };
      } else {
        throw new Error(
          typeof response.error === 'string'
            ? response.error
            : 'Failed to send test notification'
        );
      }
    } catch (err) {
      console.error('[Push] Test notification error:', err);
      setError(err instanceof Error ? err.message : 'Failed to send test');
      return null;
    }
  }, [token]);

  return {
    isSupported,
    permission,
    isSubscribed,
    isLoading,
    error,
    preferences,
    currentEndpoint,
    subscribe,
    unsubscribe,
    updatePreferences,
    sendTestNotification,
    refresh,
  };
}
