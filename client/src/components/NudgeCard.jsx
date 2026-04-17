import { useState, useEffect, useRef } from 'react';

export default function NudgeCard({ nudge, loading }) {
  const [entering, setEntering] = useState(false);
  const prevNudgeRef = useRef(null);

  // Animate in when a new nudge arrives
  useEffect(() => {
    if (nudge && nudge.title !== prevNudgeRef.current?.title) {
      setEntering(true);
      const timer = setTimeout(() => setEntering(false), 300);
      prevNudgeRef.current = nudge;
      return () => clearTimeout(timer);
    }
  }, [nudge]);

  if (loading) {
    return (
      <div className="premium-card animate-fade-in-up bg-primary-container text-on-primary-container rounded-3xl p-6 flex flex-col justify-between min-h-[160px] animate-pulse">
        <div className="flex items-center gap-2 mb-3">
          <span className="material-symbols-outlined">campaign</span>
          <span className="text-xs font-bold uppercase tracking-widest">Loading Alert...</span>
        </div>
        <div className="h-4 bg-white/20 rounded w-3/4 mb-2"></div>
        <div className="h-4 bg-white/20 rounded w-1/2"></div>
      </div>
    );
  }

  if (!nudge || !nudge.title) {
    return (
      <div className="bg-surface-container-low border border-outline-variant/10 text-secondary rounded-3xl p-6 flex flex-col justify-between min-h-[160px]">
        <div>
          <div className="flex items-center gap-2 mb-3">
            <span className="material-symbols-outlined">check_circle</span>
            <span className="text-xs font-bold uppercase tracking-widest">All Clear</span>
          </div>
          <h3 className="text-lg font-bold leading-tight">Enjoy the match — we'll nudge you when it matters.</h3>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-primary-container text-on-primary-container rounded-3xl p-6 flex flex-col justify-between min-h-[160px] transition-all duration-300 ${entering ? 'opacity-0 translate-y-2' : 'opacity-100 translate-y-0'}`}>
      <div>
        <div className="flex items-center gap-2 mb-3">
          <span className="material-symbols-outlined">campaign</span>
          <span className="text-xs font-bold uppercase tracking-widest">Concierge Alert</span>
        </div>
        <h3 className="text-lg font-bold leading-tight">{nudge.title}</h3>
        <p className="text-sm mt-1 opacity-90">{nudge.body}</p>
      </div>
      
      {nudge.action === 'navigate' && nudge.deeplink && (
        <button 
          onClick={() => window.open(nudge.deeplink, '_blank', 'noopener')}
          className="mt-4 bg-white text-primary text-xs font-black py-2.5 px-4 rounded-xl self-start hover:bg-surface-container-lowest transition-colors uppercase tracking-tight"
        >
          Take me there
        </button>
      )}
    </div>
  );
}
