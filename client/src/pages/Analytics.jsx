import React from 'react';

export default function Analytics() {
  return (
    <main className="flex-grow flex flex-col max-w-[1440px] mx-auto w-full p-8 gap-8 animate-fade-in-up">
      <div className="space-y-1 mb-4">
        <p className="text-xs font-semibold uppercase tracking-widest text-secondary">System Insight</p>
        <h1 className="text-4xl font-black tracking-tighter text-on-surface">Analytics Engine</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Metric 1 */}
        <div className="premium-card bg-surface-container-lowest rounded-3xl p-6 shadow-sm flex flex-col justify-between h-40">
          <p className="text-[10px] font-bold text-secondary uppercase tracking-widest">Total Active Devices</p>
          <div>
            <h3 className="text-4xl font-black mt-2">42,881</h3>
            <p className="text-primary text-xs font-bold mt-1 flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px]">trending_up</span> +12% vs expected
            </p>
          </div>
        </div>
        {/* Metric 2 */}
        <div className="premium-card bg-surface-container-lowest rounded-3xl p-6 shadow-sm flex flex-col justify-between h-40">
          <p className="text-[10px] font-bold text-secondary uppercase tracking-widest">Beverage Revenue (Live)</p>
          <div>
            <h3 className="text-4xl font-black mt-2">£84.2K</h3>
            <p className="text-primary text-xs font-bold mt-1 flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px]">check_circle</span> Target exceeded
            </p>
          </div>
        </div>
        {/* Metric 3 */}
        <div className="premium-card bg-surface-container-lowest rounded-3xl p-6 shadow-sm flex flex-col justify-between h-40">
          <p className="text-[10px] font-bold text-error uppercase tracking-widest">Congestion Risk</p>
          <div>
            <h3 className="text-4xl font-black mt-2 text-error">14%</h3>
            <p className="text-error text-xs font-bold mt-1 flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px]">warning</span> East Gate E6
            </p>
          </div>
        </div>
      </div>

      <div className="premium-card flex-grow bg-surface-container-low rounded-3xl p-8 border border-outline-variant/10 min-h-[300px] flex items-center justify-center relative overflow-hidden">
        <div className="absolute inset-0 opacity-10 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI4MCIgaGVpZ2h0PSI4MCI+CiAgPHJlY3Qgd2lkdGg9IjgwaCIgaGVpZ2h0PSI4MCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjYmNjYWMxIiBzdHJva2Utd2lkdGg9IjEiIHN0cm9rZS1kYXNoYXJyYXk9IjQgNCIvPgo8L3N2Zz4=')]"></div>
        <div className="z-10 text-center">
            <span className="material-symbols-outlined text-6xl text-primary animate-bounce mb-2">monitoring</span>
            <h2 className="text-xl font-bold">Predictive Flow Model Processing</h2>
            <p className="text-sm font-medium text-secondary">Aggregating real-time crowd dynamics...</p>
        </div>
      </div>
    </main>
  );
}
