import useCrowdData from '../hooks/useCrowdData';

// Helper to determine tailwind fill color based on density bounds (0=clear, 1=congested)
function getZoneFill(density) {
  if (density > 0.75) return { fill: '#ba1a1a', labelBg: 'bg-error', text: 'HIGH (80%+)' };
  if (density > 0.40) return { fill: '#a36700', labelBg: 'bg-tertiary', text: 'MED (40-80%)' };
  return { fill: '#00694c', labelBg: 'bg-primary', text: 'LOW (0-40%)' };
}

export default function CrowdMap({ eventId }) {
  const { crowdData, loading } = useCrowdData(eventId);

  // Map incoming zone data to our 4 SVG quadrants (A, B, C, D)
  const getZoneDensityState = (zoneId) => {
    const zone = crowdData.find(z => z.zone === zoneId);
    return zone ? getZoneFill(zone.density) : getZoneFill(0);
  };

  const zoneA = getZoneDensityState('A');
  const zoneB = getZoneDensityState('B');
  const zoneC = getZoneDensityState('C');
  const zoneD = getZoneDensityState('D');

  return (
    <div className="flex-grow stadium-map-gradient rounded-3xl border border-outline-variant/15 p-8 relative overflow-hidden flex items-center justify-center min-h-[400px]">
      {/* 3D-style SVG Stadium */}
      <div className="relative w-full aspect-square max-w-[400px]">
        <svg className={`w-full h-full filter drop-shadow-xl transition-opacity duration-1000 ${loading ? 'opacity-50' : 'opacity-100'}`} viewBox="0 0 200 200">
          {/* Outer Rim */}
          <path d="M100 10 A 90 70 0 0 0 100 190 A 90 70 0 0 0 100 10" fill="none" stroke="#bccac1" strokeDasharray="4 2" strokeWidth="1" />
          
          {/* Section A */}
          <path className="cursor-pointer hover:opacity-100 transition-all opacity-80" d="M100 20 A 80 60 0 0 0 30 100 L 60 100 A 40 30 0 0 1 100 40 Z" fill={zoneA.fill} />
          <text fill="white" fontSize="8" fontWeight="bold" x="55" y="65">A</text>
          
          {/* Section B - with pulse if high */}
          <path className="cursor-pointer hover:opacity-100 transition-all opacity-80" d="M30 100 A 80 60 0 0 0 100 180 L 100 140 A 40 30 0 0 1 60 100 Z" fill={zoneB.fill} />
          <text fill="white" fontSize="8" fontWeight="bold" x="55" y="145">B</text>
          {zoneB.text.includes('HIGH') && <circle className="pulse-ring" cx="50" cy="120" fill="#ffffff" r="3"></circle>}
          
          {/* Section C */}
          <path className="cursor-pointer hover:opacity-100 transition-all opacity-80" d="M100 180 A 80 60 0 0 0 170 100 L 140 100 A 40 30 0 0 1 100 140 Z" fill={zoneC.fill} />
          <text fill="white" fontSize="8" fontWeight="bold" x="135" y="145">C</text>
          
          {/* Section D */}
          <path className="cursor-pointer hover:opacity-100 transition-all opacity-80" d="M170 100 A 80 60 0 0 0 100 20 L 100 40 A 40 30 0 0 1 140 100 Z" fill={zoneD.fill} />
          <text fill="white" fontSize="8" fontWeight="bold" x="135" y="65">D</text>
          
          {/* Field */}
          <ellipse cx="100" cy="100" fill="#eceef0" rx="35" ry="25" stroke="#bccac1" strokeWidth="0.5" />
        </svg>
      </div>
      
      {/* Interactive Legend Overlays */}
      <div className="absolute bottom-4 left-4 bg-white/90 backdrop-blur-md p-3 rounded-xl border border-outline-variant/20 shadow-sm">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 text-[10px] font-bold text-secondary">
            <span className="w-2 h-2 rounded-full bg-primary"></span> LOW (0-40%)
          </div>
          <div className="flex items-center gap-2 text-[10px] font-bold text-secondary">
            <span className="w-2 h-2 rounded-full bg-tertiary"></span> MED (40-80%)
          </div>
          <div className="flex items-center gap-2 text-[10px] font-bold text-secondary">
            <span className="w-2 h-2 rounded-full bg-error"></span> HIGH (80%+)
          </div>
        </div>
      </div>
    </div>
  );
}
