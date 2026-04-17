/**
 * useLatestNudge.js
 * ─────────────────
 * Firestore real-time listener on nudge_log/{eventId}/attendees/{uid}.
 * Returns the latest nudge or null.
 */

import { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';

/**
 * @param {string} eventId
 * @param {string} uid
 * @returns {{ nudge: {title, body, action, deeplink, timestamp}|null, loading: boolean }}
 */
export function useLatestNudge(eventId, uid) {
  const [nudge, setNudge] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!eventId || !uid) {
      setLoading(false);
      return;
    }

    const docRef = doc(db, 'nudge_log', eventId, 'attendees', uid);

    const unsub = onSnapshot(
      docRef,
      (snap) => {
        if (!snap.exists()) {
          setNudge(null);
        } else {
          const data = snap.data();
          const lastNudge = data.lastNudge || {};

          setNudge({
            title: lastNudge.title || '',
            body: lastNudge.body || '',
            action: lastNudge.action || 'info',
            deeplink: lastNudge.deeplink || '',
            timestamp: lastNudge.sentAt || data.lastNudgedAt?.toDate?.()?.toISOString() || '',
          });
        }
        setLoading(false);
      },
      (err) => {
        console.error('[useLatestNudge] Listener error:', err.message);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [eventId, uid]);

  return { nudge, loading };
}

export default useLatestNudge;
