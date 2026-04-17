/**
 * firebase-messaging-sw.js
 * ────────────────────────
 * Service worker for receiving Firebase Cloud Messaging push notifications
 * when the Flow PWA is closed or in the background.
 *
 * Placed in client/public/ so Vite serves it at the root path.
 */

/* eslint-env serviceworker */
/* global firebase */

// ─── Import Firebase compat SDKs (service workers need compat) ──
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js');

// ─── Firebase Config ────────────────────────────────────────────
// Injected at build time or set via self.firebaseConfig before SW registration.
// Fallback to env-style placeholders — the app must set these before registering.

const firebaseConfig = self.firebaseConfig || {
  apiKey: '',
  authDomain: '',
  projectId: '',
  storageBucket: '',
  messagingSenderId: '',
  appId: '',
};

firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

// ─── Background Message Handler ─────────────────────────────────
// Fires when the app is NOT in the foreground (closed or background tab).

messaging.onBackgroundMessage((payload) => {
  console.log('[SW] Background message received:', payload);

  const notification = payload.notification || {};
  const data = payload.data || {};

  const title = notification.title || 'Flow';
  const options = {
    body: notification.body || '',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: `flow-nudge-${Date.now()}`,
    renotify: true,
    vibrate: [100, 50, 100],
    data: {
      deeplink: data.deeplink || '/',
      action: data.action || 'info',
    },
    actions: [
      {
        action: 'open',
        title: 'Open',
      },
      {
        action: 'dismiss',
        title: 'Dismiss',
      },
    ],
  };

  return self.registration.showNotification(title, options);
});

// ─── Notification Click Handler ─────────────────────────────────
// Opens the deeplink URL when the user taps the notification.

self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked:', event.notification.tag);

  event.notification.close();

  // Dismiss action — just close
  if (event.action === 'dismiss') return;

  const deeplink = event.notification.data?.deeplink || '/';

  // Attempt to focus an existing window or open a new one
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // If a Flow window is already open, focus it and navigate
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.focus();
          client.postMessage({
            type: 'FLOW_NUDGE_CLICK',
            deeplink,
            action: event.notification.data?.action,
          });
          return;
        }
      }

      // Otherwise open a new window
      if (clients.openWindow) {
        return clients.openWindow(deeplink);
      }
    })
  );
});
