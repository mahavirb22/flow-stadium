import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';

/**
 * TopNavBar Component
 * Renders the top navigation header including stadium branding, routing links,
 * user profile, and an interactive system guide modal.
 *
 * @returns {JSX.Element} The rendered TopNavBar component
 */
export default function TopNavBar() {
  const [isGuideOpen, setIsGuideOpen] = useState(false);

  return (
    <>
      <nav className="sticky top-0 w-full z-50 bg-white/80 backdrop-blur-xl shadow-[0px_12px_32px_rgba(15,23,42,0.04)]">
        <div className="flex justify-between items-center px-8 py-4 max-w-[1440px] mx-auto">
          <div className="flex items-center gap-8">
            <span className="text-2xl font-black tracking-tighter text-primary flex items-center gap-3">
              <img src="/images/logo.jpg" alt="Flow Stadium Primary Logo" className="h-8 w-auto rounded-md shadow-sm" />
              Flow Stadium
              <button
                onClick={() => setIsGuideOpen(true)}
                aria-expanded={isGuideOpen}
                aria-controls="guide-modal"
                className="text-[10px] px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full hover:bg-emerald-100 transition-colors border border-emerald-200 shadow-sm flex items-center gap-1 uppercase tracking-widest cursor-pointer"
              >
                <span>Guide</span>
              </button>
            </span>
            <div className="hidden md:flex gap-6 font-['Inter'] antialiased tracking-tight text-sm font-medium">
              <NavLink className={({ isActive }) => isActive ? "text-primary border-b-2 border-primary pb-1" : "text-slate-600 hover:text-primary transition-colors"} to="/">Dashboard</NavLink>
              <NavLink className={({ isActive }) => isActive ? "text-primary border-b-2 border-primary pb-1" : "text-slate-600 hover:text-primary transition-colors"} to="/map">Info</NavLink>
              <NavLink className={({ isActive }) => isActive ? "text-primary border-b-2 border-primary pb-1" : "text-slate-600 hover:text-primary transition-colors"} to="/logistics">Logistics</NavLink>
              <NavLink className={({ isActive }) => isActive ? "text-primary border-b-2 border-primary pb-1" : "text-slate-600 hover:text-primary transition-colors"} to="/analytics">Analytics</NavLink>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 bg-secondary-container text-on-secondary-container px-3 py-1.5 rounded-full text-xs font-bold tracking-wide">
              <span className="material-symbols-outlined text-sm">confirmation_number</span>
              SECTION B7
            </div>
            <div className="h-10 w-10 rounded-full overflow-hidden border-2 border-primary-fixed">
              <img alt="User Profile" className="h-full w-full object-cover" src="/images/profile.jpg" />
            </div>
          </div>
        </div>
      </nav>

      {/* Guide Modal Overlay */}
      {isGuideOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm" style={{ animation: 'fadeIn 0.2s ease-out forwards' }}>
          <div id="guide-modal" role="dialog" aria-modal="true" aria-labelledby="modal-title" className="bg-white max-w-2xl w-full rounded-[32px] shadow-2xl overflow-hidden border border-slate-200" style={{ animation: 'fadeSlideUp 0.3s ease-out forwards' }}>
            {/* Modal Header */}
            <div className="px-8 py-5 flex items-center justify-between border-b border-slate-100">
              <h2 id="modal-title" className="text-xl font-bold tracking-tight text-slate-800">Flow Software Guide</h2>
              <button
                onClick={() => setIsGuideOpen(false)}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 transition-colors font-bold"
                aria-label="Close guide"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-8 space-y-6">
              <div className="flex gap-4 items-start">
                <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center font-black shrink-0">1</div>
                <div>
                  <h3 className="font-bold text-slate-800 text-lg mb-1">Dashboard (Home)</h3>
                  <p className="text-sm text-slate-500 leading-relaxed">View a high-level overview of stadium attendance, active operations, and weather. Enable Web Alerts at the bottom to receive match pushes!</p>
                </div>
              </div>
              <div className="flex gap-4 items-start">
                <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-black shrink-0">2</div>
                <div>
                  <h3 className="font-bold text-slate-800 text-lg mb-1">Interactive Info Map</h3>
                  <p className="text-sm text-slate-500 leading-relaxed">The immersive Interactive Pitch View reveals crowd density anomalies dynamically. The side panel provides a synchronized real-time feed of play-by-play commentary.</p>
                </div>
              </div>
              <div className="flex gap-4 items-start">
                <div className="w-10 h-10 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center font-black shrink-0">3</div>
                <div>
                  <h3 className="font-bold text-slate-800 text-lg mb-1">System Architecture</h3>
                  <p className="text-sm text-slate-500 leading-relaxed">Flow runs on a dual-engine using Vite/React and an Express backend, backed by real-time Firestore synchronization for ultra-fast performance. User does not need to even open the applications, it is designed like it will automatically guides the user (Unique Feature).</p>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-8 py-5 bg-slate-50 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setIsGuideOpen(false)}
                className="px-6 py-2.5 bg-slate-800 text-white font-semibold rounded-xl hover:bg-slate-700 transition shadow-lg"
              >
                Got it, thanks!
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
