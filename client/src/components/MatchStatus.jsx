import { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';

const PHASE_LABELS = {
  first_half: '1st Half',
  halftime_approaching: 'Halftime soon',
  halftime: 'Halftime',
  second_half: '2nd Half',
  unknown: 'Pre-match',
};

export default function MatchStatus({ eventId }) {
  const [matchState, setMatchState] = useState({ currentMinute: 0, phase: 'unknown' });

  // Live match clock from Firestore
  useEffect(() => {
    if (!eventId) return;
    const unsub = onSnapshot(
      doc(db, 'events', eventId),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          setMatchState({
            currentMinute: data.currentMinute || 0,
            phase: data.phase || 'unknown',
          });
        }
      },
      (err) => console.error('[MatchStatus] Match state error:', err.message)
    );
    return () => unsub();
  }, [eventId]);

  const phaseLabel = PHASE_LABELS[matchState.phase] || matchState.phase;

  return (
    <div className="premium-card animate-fade-in-up bg-surface-container-lowest rounded-3xl p-6 flex flex-col md:flex-row items-start md:items-center justify-between shadow-[0px_12px_32px_rgba(15,23,42,0.04)] relative overflow-hidden h-full">
      <div className="z-10 flex flex-col">
        <div className="flex items-center gap-2 mb-1">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-primary"></span>
          </span>
          <span className="text-xs font-bold text-primary tracking-widest uppercase">Live Match</span>
        </div>
        <h2 className="text-5xl font-black tracking-tighter text-on-surface">
          {matchState.currentMinute}<span className="animate-pulse">'</span>
        </h2>
        <p className="text-sm font-medium text-secondary mt-1">{phaseLabel}</p>
      </div>
      <div className="z-10 text-right">
        <p className="text-xs font-bold text-secondary-fixed-dim uppercase tracking-wider mb-2">Current Score</p>
        <div className="flex items-center gap-4">
          <div className="text-center">
            <p className="text-3xl font-black">2</p>
            <p className="text-[10px] font-bold text-secondary uppercase">ENG</p>
          </div>
          <div className="text-2xl font-light text-outline-variant">—</div>
          <div className="text-center">
            <p className="text-3xl font-black">1</p>
            <p className="text-[10px] font-bold text-secondary uppercase">GER</p>
          </div>
        </div>
      </div>
      {/* Subtle background icon */}
      <span className="material-symbols-outlined absolute -right-4 -bottom-4 text-9xl text-surface-container opacity-20 rotate-12">
        sports_soccer
      </span>
    </div>
  );
}
