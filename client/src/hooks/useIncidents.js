import { useState, useEffect } from 'react';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';

export function useIncidents(eventId) {
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!eventId) {
      setLoading(false);
      return;
    }

    const incidentsRef = collection(db, 'events', eventId, 'incidents');
    const q = query(incidentsRef, orderBy('timestamp', 'desc'), limit(15));

    const unsub = onSnapshot(
      q,
      (snap) => {
        const results = [];
        snap.forEach((doc) => {
          results.push({ id: doc.id, ...doc.data() });
        });
        setIncidents(results);
        setLoading(false);
      },
      (err) => {
        console.error('[useIncidents] Listener error:', err.message);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [eventId]);

  return { incidents, loading };
}

export default useIncidents;
