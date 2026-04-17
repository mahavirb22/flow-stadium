import useQueueData from '../hooks/useQueueData';

const STAND_COORDS = {
  stand_1: '51.5563,-0.2800',
  stand_2: '51.5567,-0.2785',
  stand_3: '51.5555,-0.2790',
  stand_4: '51.5558,-0.2810',
  stand_5: '51.5561,-0.2795',
};

export default function QueueBoard({ eventId }) {
  const { queueData, loading } = useQueueData(eventId);

  if (loading) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex justify-between items-end px-2">
          <h3 className="text-xs font-bold uppercase tracking-widest text-secondary">Live Facility Wait Times</h3>
          <span className="text-xs font-bold text-primary flex items-center gap-1">Loading...</span>
        </div>
        <div className="flex overflow-x-auto gap-4 pb-4 no-scrollbar">
           <div className="min-w-[180px] bg-white border border-outline-variant/20 rounded-2xl p-4 shadow-sm h-[100px] animate-pulse"></div>
           <div className="min-w-[180px] bg-white border border-outline-variant/20 rounded-2xl p-4 shadow-sm h-[100px] animate-pulse"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-between items-end px-2">
        <h3 className="text-xs font-bold uppercase tracking-widest text-secondary">Live Facility Wait Times</h3>
        <a className="text-xs font-bold text-primary flex items-center gap-1" href="#logistics">
          Full Logistics <span className="material-symbols-outlined text-sm">arrow_forward</span>
        </a>
      </div>
      <div className="flex overflow-x-auto gap-4 pb-4 no-scrollbar px-2">
        {queueData.length === 0 ? (
          <p className="text-sm text-secondary">No wait times available.</p>
        ) : (
          queueData.map((stand, idx) => {
            const isFastest = idx === 0;
            const coords = STAND_COORDS[stand.standId] || '51.5560,-0.2795';
            const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${coords}`;

            // Determine bar color based on wait time (mock logic: < 5 = fast, < 10 = medium, else long)
            const isLong = stand.waitMins >= 10;
            const isMedium = stand.waitMins >= 5 && stand.waitMins < 10;
            const barBg = isLong ? 'bg-error' : isMedium ? 'bg-tertiary' : 'bg-primary';
            const barWidth = Math.min((stand.waitMins / 20) * 100, 100);

            return (
              <a 
                key={stand.standId} 
                href={mapsUrl} 
                target="_blank" 
                rel="noreferrer"
                className={`min-w-[180px] bg-white border block relative flex-shrink-0 cursor-pointer ${isFastest ? 'border-2 border-primary' : 'border border-outline-variant/20'} rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow`}
              >
                {isFastest && (
                  <div className="absolute -top-3 left-4 bg-primary text-white text-[8px] font-black px-2 py-1 rounded-full uppercase">
                    FASTEST
                  </div>
                )}
                <p className="text-[10px] font-bold text-secondary uppercase mb-1 truncate">{stand.standName}</p>
                <h4 className="text-2xl font-black text-on-surface">~{stand.waitMins} min</h4>
                <div className="mt-2 w-full bg-surface-container h-1 rounded-full overflow-hidden">
                  <div className={`${barBg} h-full`} style={{ width: `${barWidth}%` }}></div>
                </div>
              </a>
            );
          })
        )}
      </div>
    </div>
  );
}
