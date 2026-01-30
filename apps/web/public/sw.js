/**
 * Termify Service Worker
 * Handles push notifications and notification clicks
 */

// Cache name for assets (if needed in future)
const CACHE_NAME = 'termify-v1';

/**
 * Handle push notification events
 */
self.addEventListener('push', (event) => {
  if (!event.data) {
    console.warn('[SW] Push event without data');
    return;
  }

  let data;
  try {
    data = event.data.json();
  } catch (e) {
    console.error('[SW] Failed to parse push data:', e);
    return;
  }

  const options = {
    body: data.body || '',
    icon: data.icon || '/icon-192x192.png',
    badge: data.badge || '/badge-72x72.png',
    data: data.data || {},
    actions: data.actions || [],
    tag: data.tag || 'termify-notification',
    renotify: true,
    requireInteraction: data.requireInteraction || false,
    vibrate: [200, 100, 200],
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'Termify', options)
  );
});

/**
 * Handle notification click events
 */
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const data = event.notification.data || {};
  let targetUrl = '/';

  // Determine URL based on notification data
  if (data.terminalId) {
    targetUrl = `/terminals/${data.terminalId}`;
  } else if (data.teamId) {
    targetUrl = `/teams/${data.teamId}`;
  } else if (data.taskId && data.teamId) {
    targetUrl = `/teams/${data.teamId}/tasks/${data.taskId}`;
  } else if (data.url) {
    targetUrl = data.url;
  }

  // Handle action clicks
  if (event.action) {
    switch (event.action) {
      case 'view':
        // Default behavior - open the URL
        break;
      case 'dismiss':
        // Just close the notification (already done above)
        return;
      default:
        // Custom action handling can be added here
        break;
    }
  }

  event.waitUntil(
    clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((windowClients) => {
        // Check if there's already a window open
        for (const client of windowClients) {
          if (client.url.includes(self.registration.scope) && 'focus' in client) {
            // Navigate existing window and focus it
            client.navigate(targetUrl);
            return client.focus();
          }
        }
        // Open new window if none exists
        if (clients.openWindow) {
          return clients.openWindow(targetUrl);
        }
      })
  );
});

/**
 * Handle notification close events (optional analytics)
 */
self.addEventListener('notificationclose', (event) => {
  // Could send analytics here if needed
  console.log('[SW] Notification closed:', event.notification.tag);
});

/**
 * Handle service worker installation
 */
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...');
  // Skip waiting to activate immediately
  self.skipWaiting();
});

/**
 * Handle service worker activation
 */
self.addEventListener('activate', (event) => {
  console.log('[SW] Service worker activated');
  // Take control of all pages immediately
  event.waitUntil(clients.claim());
});
