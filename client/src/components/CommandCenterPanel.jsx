import React, { useState, useEffect } from 'react';

const commentaryData = [
  { time: "Match Started", text: "Welcome to the Wankhede Stadium for this highly anticipated playoff match!", type: "info" },
  { time: "2.1 Ov", text: "CRACKING SHOT! That's gone for a massive six over mid-wicket.", type: "highlight" },
  { time: "2.4 Ov", text: "Appeal for LBW, umpire says no. Good tight bowling in this over.", type: "commentary" },
  { time: "4.0 Ov", text: "End of the over. The crowd is absolutely electric today.", type: "event" },
  { time: "5.3 Ov", text: "WICKET! Clean bowled. The crowd goes silent as the fast bowler strikes.", type: "highlight" },
  { time: "7.0 Ov", text: "Strategic timeout. Ground staff are bringing out the drinks.", type: "info" },
  { time: "8.2 Ov", text: "A quick single taken. The runners are looking sharp.", type: "commentary" },
  { time: "10.0 Ov", text: "Halfway through the innings. The batting side needs to accelerate.", type: "event" }
];

export default function CommandCenterPanel() {
  const [activeCommentary, setActiveCommentary] = useState([]);

  useEffect(() => {
    // Staggered reveal to simulate live commentary arriving
    let count = 0;
    const interval = setInterval(() => {
      count++;
      setActiveCommentary(commentaryData.slice(0, count).reverse());
      if (count >= commentaryData.length) clearInterval(interval);
    }, 2500);
    
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="w-full md:w-[380px] flex flex-col h-full bg-[#fcfcfc] border border-outline-variant rounded-[32px] overflow-hidden shadow-[0_12px_32px_rgba(15,23,42,0.04)] font-['Inter'] relative isolate">
      
      {/* Header */}
      <div className="p-6 border-b border-outline-variant/30 flex items-center justify-between bg-white z-10 w-full relative">
        <h2 className="text-xl font-bold tracking-tight text-[#191c1e]">Venue & Match Hub</h2>
        <div className="flex items-center gap-2">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-600"></span>
          </span>
          <span className="text-[10px] uppercase tracking-widest font-semibold text-blue-600">Live feed</span>
        </div>
      </div>

      {/* Stadium Information Head */}
      <div className="p-6 bg-[#f8fbff] border-b border-blue-100/50 flex flex-col gap-5 z-0">
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col bg-white p-3 rounded-2xl border border-blue-50 shadow-sm">
            <span className="text-[9px] uppercase text-slate-400 font-bold tracking-widest mb-1 items-center flex gap-1">🏟 Capacity</span>
            <span className="text-xl font-black text-slate-800 tracking-tight">33,108</span>
          </div>
          <div className="flex flex-col bg-white p-3 rounded-2xl border border-blue-50 shadow-sm">
            <span className="text-[9px] uppercase text-slate-400 font-bold tracking-widest mb-1 items-center flex gap-1">☁ Weather</span>
            <span className="text-xl font-black text-slate-800 tracking-tight">31°C <span className="text-sm font-medium text-slate-400">Sunny</span></span>
          </div>
        </div>
        
        <div className="flex flex-col bg-white p-3 rounded-2xl border border-blue-50 shadow-sm">
          <span className="text-[9px] uppercase text-slate-400 font-bold tracking-widest mb-1">Pitch Condition</span>
          <span className="text-sm font-semibold text-slate-700">Dry & Dusty — Significant turn expected towards the final overs.</span>
        </div>
      </div>

      {/* Match Commentary Feed */}
      <div className="flex-grow overflow-y-auto p-4 space-y-3 bg-white z-0 pb-12">
        <div className="flex items-center justify-between mb-4 px-2">
          <h3 className="text-xs uppercase font-bold tracking-widest text-slate-400">Play-by-play Analysis</h3>
        </div>
        
        {activeCommentary.length === 0 ? (
          <div className="text-sm font-medium text-center py-10 text-slate-400 animate-pulse">Syncing comms feed...</div>
        ) : (
          activeCommentary.map((item, idx) => (
            <div 
              key={idx} 
              className={`p-4 rounded-2xl border transition-all duration-500 ease-out flex gap-3 
                ${idx === 0 ? 'bg-blue-50/50 border-blue-100 shadow-sm scale-100 opacity-100' : 'bg-slate-50 border-slate-100 scale-[0.98] opacity-80'}`}
              style={{ animation: 'fadeSlideUp 0.4s ease-out forwards' }}
            >
              <div className={`text-xs font-black pt-0.5 whitespace-nowrap ${item.type === 'highlight' ? 'text-red-500' : 'text-blue-600'}`}>
                {item.time}
              </div>
              <div className="text-sm text-slate-700 leading-relaxed font-medium">
                {item.text}
              </div>
            </div>
          ))
        )}
      </div>

    </div>
  );
}
