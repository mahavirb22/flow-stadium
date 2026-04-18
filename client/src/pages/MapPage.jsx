import React from 'react';
import LivePitchView from '../components/LivePitchView';
import CommandCenterPanel from '../components/CommandCenterPanel';

/**
 * MapPage Component
 * 
 * Serves as the primary layout wrapper for the Interactive Pitch Map 
 * and the Live Command Center panel. Manages core layout styling.
 * 
 * @returns {JSX.Element} The rendered MapPage component layout
 */
export default function MapPage() {
  const eventId = 'demo-event-001'; // Fallback event ID used primarily across the app

  return (
    <>
      <main className="flex-grow flex flex-col max-w-[1440px] mx-auto w-full p-8 gap-6 h-[calc(100vh-80px)]">
        <div className="flex-grow w-full flex flex-col md:flex-row h-full gap-6 relative">
          <div className="flex-grow h-full rounded-3xl overflow-hidden border border-outline-variant relative shadow-lg">
            <LivePitchView />
          </div>
          <CommandCenterPanel eventId={eventId} />
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-slate-950 w-full mt-auto">
        <div className="flex flex-col md:flex-row justify-between items-center px-12 py-12 gap-8 max-w-[1440px] mx-auto">
          <div className="flex flex-col items-center md:items-start gap-4">
            <span className="text-lg font-bold text-white">Flow Stadium Intelligence</span>
            <p className="font-['Inter'] text-[10px] uppercase tracking-widest font-semibold text-slate-500">© 2024-2026 Flow Stadium Intelligence. The Digital Concierge.</p>
          </div>
        </div>
      </footer>
    </>
  );
}
