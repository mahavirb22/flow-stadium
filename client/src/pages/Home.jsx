import React from 'react';
import NudgeCard from '../components/NudgeCard';
import useLatestNudge from '../hooks/useLatestNudge';
import CrowdMap from '../components/CrowdMap';
import MatchStatus from '../components/MatchStatus';
import GroupPanel from '../components/GroupPanel';
import QueueBoard from '../components/QueueBoard';

export default function Home({ eventId, uid }) {
  const { nudge, loading: nudgeLoading } = useLatestNudge(eventId, uid);

  return (
    <>


      <main className="flex-grow flex flex-col md:flex-row max-w-[1440px] mx-auto w-full p-8 gap-8">

        {/* Left Column: Stadium Visualization (40%) */}
        <aside className="w-full md:w-[40%] flex flex-col gap-6">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-widest text-secondary">Current Venue</p>
            <h1 className="text-4xl font-black tracking-tighter text-on-surface">Wankhede Stadium</h1>
          </div>

          {/* SVG Stadium replaces deprecated Heatmap Layer */}
          <CrowdMap eventId={eventId} />
        </aside>

        {/* Right Column: Operational Data (60%) */}
        <section className="w-full md:w-[60%] flex flex-col gap-6">

          {/* Row 1: Match Status Card */}
          <MatchStatus eventId={eventId} />

          {/* Row 2: Bento Grid (Nudges & Group) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <NudgeCard nudge={nudge} loading={nudgeLoading} />
            <GroupPanel groupId="demo-group-001" currentUid={uid} eventId={eventId} />
          </div>

          {/* Row 3: Live Queue Board (Horizontal Scroll) */}
          <QueueBoard eventId={eventId} />

        </section>
      </main>

      {/* Footer */}
      <footer className="bg-slate-950 w-full mt-auto">
        <div className="flex flex-col md:flex-row justify-between items-center px-12 py-12 gap-8 max-w-[1440px] mx-auto">
          <div className="flex flex-col items-center md:items-start gap-4">
            <span className="text-lg font-bold text-white">Flow Stadium Intelligence</span>
            <p className="font-['Inter'] text-[10px] uppercase tracking-widest font-semibold text-slate-500">© 2024-2026 Flow Stadium Intelligence. The Digital Concierge.</p>
          </div>
          <div className="flex gap-8 font-['Inter'] text-xs uppercase tracking-widest font-semibold">
            <a className="text-slate-500 hover:text-emerald-400 transition-colors" href="#security">Security</a>
            <a className="text-slate-500 hover:text-emerald-400 transition-colors" href="#privacy">Privacy</a>
            <a className="text-slate-500 hover:text-emerald-400 transition-colors" href="#api">API</a>
            <a className="text-slate-500 hover:text-emerald-400 transition-colors" href="#support">Support</a>
          </div>
        </div>
      </footer>
    </>
  );
}
