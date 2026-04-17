/**
 * useQueueData.js
 * ───────────────
 * Firestore real-time listener on queue_states/{eventId}.
 * Returns an array of stands sorted by waitMins ascending.
 */

import { useState, useEffect } from 'react';
import { collection, onSnapshot, query } from 'firebase/firestore';
import { db } from '../firebase';

const STANDS = ['stand_1', 'stand_2', 'stand_3', 'stand_4', 'stand_5'];

/**
 * @param {string} eventId
 * @returns {{ queueData: Array<{standId, standName, waitMins, capacity}>, loading: boolean }}
 */
export function useQueueData(eventId) {
  const [queueData, setQueueData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!eventId) {
      setLoading(false);
      return;
    }

    const unsubscribers = [];
    const standMap = new Map();

    for (const standId of STANDS) {
      const colRef = collection(db, 'queue_states', eventId, standId);
      const unsub = onSnapshot(
        query(colRef),
        (snapshot) => {
          snapshot.forEach((doc) => {
            const data = doc.data();
            standMap.set(standId, {
              standId,
              standName: data.standName ?? standId,
              waitMins: data.waitMins ?? 0,
              capacity: data.capacity ?? 0,
            });
          });

          // Rebuild sorted array
          const sorted = Array.from(standMap.values()).sort(
            (a, b) => a.waitMins - b.waitMins
          );
          setQueueData(sorted);
          setLoading(false);
        },
        (err) => {
          console.error(`[useQueueData] Stand ${standId} listener error:`, err.message);
        }
      );
      unsubscribers.push(unsub);
    }

    return () => {
      unsubscribers.forEach((unsub) => unsub());
    };
  }, [eventId]);

  return { queueData, loading };
}

export default useQueueData;
