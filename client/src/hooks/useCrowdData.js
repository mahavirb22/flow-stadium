/**
 * useCrowdData.js
 * ───────────────
 * Firestore real-time listener on crowd_zones/{eventId}.
 * Returns an array of { zone, density, id } and a loading flag.
 */

import { useState, useEffect } from 'react';
import { collection, collectionGroup, onSnapshot, query } from 'firebase/firestore';
import { db } from '../firebase';

/**
 * @param {string} eventId
 * @returns {{ crowdData: Array<{zone: string, density: number, id: string}>, loading: boolean }}
 */
export function useCrowdData(eventId) {
  const [crowdData, setCrowdData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!eventId) {
      setLoading(false);
      return;
    }

    // Listen to all subcollections under crowd_zones/{eventId}
    // Since Firestore JS SDK v9 doesn't support listCollections on the client,
    // we use a known set of zone IDs and subscribe to each.
    const ZONES = ['A', 'B', 'C', 'D', 'E', 'F'];
    const unsubscribers = [];
    const zoneMap = new Map();

    for (const zone of ZONES) {
      const docRef = collection(db, 'crowd_zones', eventId, zone);
      const unsub = onSnapshot(
        query(docRef),
        (snapshot) => {
          snapshot.forEach((doc) => {
            const data = doc.data();
            zoneMap.set(zone, {
              zone,
              density: data.density ?? 0,
              id: `${eventId}-${zone}`,
            });
          });

          // Rebuild the array from the map
          setCrowdData(Array.from(zoneMap.values()));
          setLoading(false);
        },
        (err) => {
          console.error(`[useCrowdData] Zone ${zone} listener error:`, err.message);
        }
      );
      unsubscribers.push(unsub);
    }

    return () => {
      unsubscribers.forEach((unsub) => unsub());
    };
  }, [eventId]);

  return { crowdData, loading };
}

export default useCrowdData;
