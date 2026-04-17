/**
 * fcm.js — Client-side FCM integration
 * ─────────────────────────────────────
 * Handles notification permission, FCM token registration, and
 * foreground message display.
 *
 * IMPORTANT: initFCM() must be called from a user gesture (button click)
 * because modern browsers block silent notification permission requests.
 */

import { getMessaging, getToken, onMessage } from 'firebase/messaging';
import { doc, setDoc } from 'firebase/firestore';
import app, { db } from '../firebase';

// ─── Constants ──────────────────────────────────────────────────
const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY || 'BORBRNCkEZRH-TVE2QxmYwz7wtGZBbk3S_182yy2Ve_7I1fjvuXRci2LiJGzp93pzMHZAI9DJmRUCiArC1GoYU8';

// ─── Init FCM ───────────────────────────────────────────────────

/**
 * Requests notification permission (must be triggered by user gesture),
 * retrieves the FCM device token, and persists it to Firestore.
 *
 * @param {string} uid  – Firebase Auth UID of the current user
 * @returns {Promise<string|null>}  The FCM token, or null if denied/error
 */
export async function initFCM(uid) {
  if (!uid) {
    console.warn('[FCM] uid is required to init FCM.');
    return null;
  }

  // Check browser support
  if (!('Notification' in window)) {
    console.warn('[FCM] This browser does not support notifications.');
    return null;
  }

  if (!('serviceWorker' in navigator)) {
    console.warn('[FCM] Service workers not supported.');
    return null;
  }

  // ── 1. Request permission (requires user gesture) ─────────────
  try {
    const permission = await Notification.requestPermission();

    if (permission === 'denied') {
      console.warn('[FCM] Notifications blocked by user');
      return null;
    }

    if (permission === 'default') {
      console.warn('[FCM] User dismissed permission prompt');
      return null;
    }

    // permission === 'granted'
    console.log('[FCM] ✓ Notification permission granted.');
  } catch (err) {
    console.error('[FCM] Permission request failed:', err.message);
    return null;
  }

  // ── 2. Register service worker ─────────────────────────────────
  let swRegistration;
  try {
    swRegistration = await navigator.serviceWorker.register(
      '/firebase-messaging-sw.js',
      { scope: '/' }
    );
    console.log('[FCM] ✓ Service worker registered.');
  } catch (err) {
    console.error('[FCM] SW registration failed:', err.message);
    return null;
  }

  // ── 3. Get FCM token ──────────────────────────────────────────
  try {
    const messaging = getMessaging(app);

    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: swRegistration,
    });

    if (!token) {
      console.warn('[FCM] No token returned. Push may be blocked.');
      return null;
    }

    console.log(`[FCM] ✓ FCM token: ${token.slice(0, 20)}…`);

    // ── 4. Persist token to Firestore ────────────────────────────
    await setDoc(
      doc(db, 'attendees', uid),
      { fcmToken: token, fcmTokenUpdatedAt: new Date().toISOString() },
      { merge: true }
    );

    console.log(`[FCM] ✓ Token saved to attendees/${uid}`);
    return token;
  } catch (err) {
    console.error('[FCM] Token retrieval failed:', err.message);
    return null;
  }
}

// ─── Foreground Message Listener ────────────────────────────────

/**
 * Registers a callback for push messages arriving while the app
 * is open in the foreground.
 *
 * @param {(payload: object) => void} callback
 * @returns {() => void}  Unsubscribe function
 */
export function onForegroundMessage(callback) {
  try {
    const messaging = getMessaging(app);

    const unsubscribe = onMessage(messaging, (payload) => {
      console.log('[FCM] Foreground message:', payload);

      if (callback) callback(payload);

      // Show browser notification for foreground messages
      if (Notification.permission === 'granted' && payload.notification) {
        const { title, body } = payload.notification;
        new Notification(title, {
          body,
          icon: '/icon-192.png',
          data: payload.data,
        });
      }
    });

    return unsubscribe;
  } catch (err) {
    console.error('[FCM] Failed to set up foreground listener:', err.message);
    return () => {};
  }
}

export default { initFCM, onForegroundMessage };
