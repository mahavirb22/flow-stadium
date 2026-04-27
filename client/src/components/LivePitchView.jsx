import React, { useState, useEffect } from 'react';

const pitchZones = [
  { id: 'z1', name: 'North Stand Core', active: true, density: '89%', color: 'from-blue-500/80 to-cyan-400/60' },
  { id: 'z2', name: 'VIP Pavilion', active: false, density: '32%', color: 'from-emerald-500/80 to-teal-400/60' },
  { id: 'z3', name: 'East Gallery', active: true, density: '95%', color: 'from-red-500/80 to-orange-400/60' },
  { id: 'z4', name: 'South End', active: true, density: '78%', color: 'from-blue-500/80 to-cyan-400/60' },
  { id: 'z5', name: 'West Wing', active: false, density: '45%', color: 'from-emerald-500/80 to-teal-400/60' },
  { id: 'z6', name: 'Center Pitch', active: true, density: '12%', color: 'from-purple-500/80 to-fuchsia-400/60' }
];

/**
 * LivePitchView Component
 * 
 * Renders an interactive 3D CSS pitch map displaying real-time crowd density
 * visualizations. Periodically polls the server for density updates.
 * 
 * @param {Object} props
 * @param {string} [props.eventId='demo-event-001'] - The event ID used to fetch crowd data
 * @returns {JSX.Element} The rendered 3D pitch view visualization
 */
export default function LivePitchView({ eventId = 'demo-event-001' }) {
  const [activeZone, setActiveZone] = useState(null);
  const [zones, setZones] = useState(pitchZones);

  const fetchCrowdData = async () => {
    try {
      const res = await fetch(`/api/crowd?eventId=${eventId}`);
      if (!res.ok) throw new Error('Fetch failed');
      const data = await res.json();
      
      // Merge live data with zone definitions
      const updatedZones = pitchZones.map(staticZone => {
        const liveData = data.zones.find(z => z.zone.toLowerCase().includes(staticZone.name.toLowerCase().split(' ')[0].toLowerCase()));
        return {
          ...staticZone,
          density: liveData ? `${Math.round(liveData.density * 100)}%` : staticZone.density,
          active: liveData ? liveData.density > 0.8 : staticZone.active
        };
      });
      
      setZones(updatedZones);
    } catch (err) {
      console.warn('[LivePitch] Crowd sync error:', err.message);
    }
  };

  useEffect(() => {
    fetchCrowdData();
    const interval = setInterval(fetchCrowdData, 10000); // Slower polling for crowd
    return () => clearInterval(interval);
  }, [eventId]);

  return (
    <div className="w-full h-full min-h-[500px] flex items-center justify-center bg-slate-900 overflow-hidden relative font-['Inter'] rounded-3xl isolate shadow-inner">
      
      {/* Background Decor */}
      <div className="absolute inset-0 opacity-20 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-blue-500/20 blur-[100px] rounded-full"></div>
      </div>

      {/* Header Overlay */}
      <div className="absolute top-6 left-6 z-20 flex flex-col gap-1 pointer-events-none">
        <h2 className="text-2xl font-black text-white tracking-tight">Interactive Venue Topology</h2>
        <p className="text-sm text-slate-400 font-medium tracking-wide flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          Live Anomaly Detection Active
        </p>
      </div>

      {/* 3D Pitch Container */}
      <div className="relative w-[340px] md:w-[600px] h-[500px] flex items-center justify-center perspective-[1200px]">
        <div className="relative w-[80%] h-[90%] border-4 border-white/20 rounded-[100px] shadow-[0_0_80px_rgba(255,255,255,0.05)] transform rotate-x-[45deg] scale-y-125 transition-transform duration-700 ease-out flex items-center justify-center hover:rotate-x-[35deg] bg-[#1a2f26]/40 backdrop-blur-sm">
          
          {/* Pitch Inner Markings */}
          <div className="absolute w-[80%] h-[80%] border-2 border-white/20 rounded-[80px]"></div>
          <div className="absolute w-[40px] h-[120px] bg-[#dfd6a8] rounded-sm transform shadow-[0_0_20px_rgba(223,214,168,0.2)]"></div>
          
          {/* Interactive Zones */}
          <div className="absolute inset-x-[-20%] inset-y-[-10%] grid grid-cols-2 grid-rows-3 gap-6 p-4">
            {zones.map((zone) => (
              <div 
                key={zone.id}
                onMouseEnter={() => setActiveZone(zone)}
                onMouseLeave={() => setActiveZone(null)}
                className="relative flex items-center justify-center cursor-pointer group"
              >
                <div 
                  className={`absolute inset-0 rounded-[40px] bg-gradient-to-br transition-all duration-500 ease-out border border-white/10 ${zone.color} mix-blend-screen
                    ${activeZone?.id === zone.id || zone.active ? 'opacity-100 scale-105 shadow-[0_0_30px_rgba(255,255,255,0.1)]' : 'opacity-30 scale-100 blur-[2px]'}`}
                ></div>
                
                {/* Hotspot Dot */}
                <div className={`z-10 w-4 h-4 rounded-full bg-white shadow-[0_0_15px_white] transition-transform duration-300 ${activeZone?.id === zone.id ? 'scale-150' : 'scale-100'}`}></div>
              </div>
            ))}
          </div>

        </div>
      </div>

      {/* Interactive Tooltip / Detail Card */}
      <div 
        className={`absolute bottom-8 right-8 z-20 w-[280px] bg-white/10 backdrop-blur-2xl border border-white/20 p-5 rounded-2xl shadow-[0_12px_40px_rgba(0,0,0,0.4)] transition-all duration-300 transform
          ${activeZone ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0 pointer-events-none'}`}
      >
        {activeZone && (
          <div className="flex flex-col gap-3">
            <div className="flex justify-between items-start">
              <h3 className="text-white font-bold tracking-wide">{activeZone.name}</h3>
              <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-1 rounded border
                ${zoneAlert(activeZone) ? 'bg-red-500/20 text-red-300 border-red-500/30' : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'}`}>
                {zoneAlert(activeZone) ? 'High Alert' : 'Normal'}
              </span>
            </div>
            
            <div className="flex flex-col gap-1">
              <span className="text-xs text-slate-400 uppercase tracking-widest font-semibold">Crowd Density</span>
              <div className="w-full bg-slate-800 rounded-full h-2 mt-1">
                <div className={`h-full rounded-full transition-all duration-1000 ${parseInt(activeZone.density) > 80 ? 'bg-red-500' : 'bg-emerald-500'}`} style={{ width: activeZone.density }}></div>
              </div>
              <span className="text-white font-mono text-sm mt-1">{activeZone.density} currently occupied</span>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}

/**
 * Helper function to determine if a specific pitch zone is actively in alert.
 * 
 * @param {Object} zone - The zone object containing status and density metrics
 * @param {boolean} zone.active - The manual active override boolean
 * @param {string} zone.density - The current density percentage string (e.g. "85%")
 * @returns {boolean} True if the zone requires heightened security attention
 */
function zoneAlert(zone) {
    return zone.active || parseInt(zone.density) > 80;
}
