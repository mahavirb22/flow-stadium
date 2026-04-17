import React from 'react';
import QueueBoard from '../components/QueueBoard';

export default function Logistics() {
  return (
    <main className="flex-grow flex flex-col max-w-[1440px] mx-auto w-full p-8 gap-8 animate-fade-in-up">
      <div className="space-y-1 mb-4 flex justify-between items-end">
        <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-secondary">Operations Deployment</p>
            <h1 className="text-4xl font-black tracking-tighter text-on-surface">Logistics Hub</h1>
        </div>
        <button className="bg-primary text-white text-xs font-black py-2.5 px-6 rounded-xl hover:bg-primary-container transition-all shadow-sm uppercase tracking-tight flex items-center gap-2">
            <span className="material-symbols-outlined text-sm">cycle</span> Sync Field
        </button>
      </div>

      {/* Embedded Component */}
      <div className="w-full">
         <h2 className="text-xl font-black tracking-tighter text-on-surface mb-4">Facility Overviews</h2>
         <QueueBoard />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
        {/* Staff Unit */}
        <div className="premium-card bg-surface-container-lowest rounded-3xl p-6 shadow-sm border border-outline-variant/10">
          <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold">Rapid Response Unit</h3>
              <span className="bg-tertiary/10 text-tertiary text-[10px] font-bold px-2 py-1 rounded">DEPLOYED</span>
          </div>
          <div className="flex items-center gap-4 text-xs font-semibold uppercase text-secondary">
              <div className="flex items-center gap-1"><span className="material-symbols-outlined text-sm">person</span> 12 Active</div>
              <div className="flex items-center gap-1"><span className="material-symbols-outlined text-sm">location_on</span> Sector C, D</div>
          </div>
        </div>

        {/* Inventory Unit */}
        <div className="premium-card bg-surface-container-lowest rounded-3xl p-6 shadow-sm border border-outline-variant/10">
          <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold">Main Inventory Depots</h3>
              <span className="bg-primary/10 text-primary text-[10px] font-bold px-2 py-1 rounded">HEALTHY</span>
          </div>
          <div className="flex items-center gap-4 text-xs font-semibold uppercase text-secondary">
              <div className="flex items-center gap-1"><span className="material-symbols-outlined text-sm">inventory_2</span> 144 Pallets</div>
              <div className="flex items-center gap-1"><span className="material-symbols-outlined text-sm">local_shipping</span> 2 En Route</div>
          </div>
        </div>
      </div>
    </main>
  );
}
