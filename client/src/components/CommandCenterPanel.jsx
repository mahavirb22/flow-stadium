import React, { useState, useEffect } from 'react';

/**
 * CommandCenterPanel Component
 * 
 * Subscribes to the live Firebase incident stream via the Node.js ingestion backend.
 * Provides real-time venue environmental metrics and live play-by-play anomaly logs.
 * 
 * @param {Object} props
 * @param {string} [props.eventId='demo-event-001'] - The unique identifier for the live event
 * @returns {JSX.Element} The active Command Center sidebar panel
 */
export default function CommandCenterPanel({ eventId = 'demo-event-001' }) {
  const [activeCommentary, setActiveCommentary] = useState([]);
  const [stats, setStats] = useState({ capacity: '33,108', temp: '31°C', weather: 'Sunny' });
  const [isReporting, setIsReporting] = useState(false);

  /**
   * Periodically fetches incident logs from the backend API,
   * parsing raw Firebase Timestamp data into readable formats.
   */
  const fetchIncidents = async () => {
    try {
      const res = await fetch(`/api/incidents?eventId=${eventId}`);
      if (!res.ok) throw new Error('Fetch failed');
      const data = await res.json();
      
      // Transform Firestore incidents to display format
      const formatted = data.incidents.map(inc => ({
        time: inc.timestamp ? new Date(inc.timestamp._seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Just Now',
        text: inc.description,
        type: inc.severity === 'critical' || inc.severity === 'high' ? 'highlight' : 'info'
      }));
      
      setActiveCommentary(formatted);
    } catch (err) {
      console.warn('[CommandCenter] Live sync error:', err.message);
    }
  };

  /**
   * Triggers a manual anomaly report using the simulated API,
   * instantly validating the ingest architecture.
   */
  const reportAnomaly = async () => {
    setIsReporting(true);
    try {
      const payload = {
        type: 'manual_report',
        description: 'Manual crowd check requested at West Wing',
        severity: 'medium',
        zone: 'West Wing',
        eventId
      };

      const res = await fetch('/api/incidents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        await fetchIncidents();
      }
    } catch (err) {
      console.error('[CommandCenter] Reporting failed:', err);
    } finally {
      setIsReporting(false);
    }
  };

  useEffect(() => {
    fetchIncidents();
    const interval = setInterval(fetchIncidents, 5000);
    return () => clearInterval(interval);
  }, [eventId]);

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
            <span className="text-xl font-black text-slate-800 tracking-tight">{stats.capacity}</span>
          </div>
          <div className="flex flex-col bg-white p-3 rounded-2xl border border-blue-50 shadow-sm">
            <span className="text-[9px] uppercase text-slate-400 font-bold tracking-widest mb-1 items-center flex gap-1">☁ Weather</span>
            <span className="text-xl font-black text-slate-800 tracking-tight">{stats.temp} <span className="text-sm font-medium text-slate-400">{stats.weather}</span></span>
          </div>
        </div>
        
        <button 
          onClick={reportAnomaly}
          disabled={isReporting}
          className="w-full py-3 bg-slate-900 text-white rounded-2xl font-bold text-sm hover:bg-slate-800 transition-colors shadow-lg active:scale-95 disabled:opacity-50"
        >
          {isReporting ? 'Transmitting...' : 'Report Manual Anomaly'}
        </button>
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
