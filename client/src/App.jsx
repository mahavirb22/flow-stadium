/**
 * App.jsx
 * ───────
 * Root component: Firebase anonymous auth, routing (all routes now lead to Home).
 * FCM is triggered by an explicit "Enable alerts" button (user gesture required).
 */

import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { auth } from './firebase';
import { initFCM, onForegroundMessage } from './services/fcm';

import Home from './pages/Home';
import MapPage from './pages/MapPage';
import Analytics from './pages/Analytics';
import Logistics from './pages/Logistics';
import DemoBar from './components/DemoBar';
import TopNavBar from './components/TopNavBar';

const EVENT_ID = 'demo-event-001';

function AppContent({ uid }) {
  const [fcmStatus, setFcmStatus] = useState('idle');

  const handleEnableAlerts = async () => {
    if (!uid) return;
    setFcmStatus('requesting');
    const token = await initFCM(uid);
    if (token) {
      setFcmStatus('granted');
      onForegroundMessage((payload) => {
        console.log('[App] Foreground nudge:', payload);
      });
    } else {
      setFcmStatus('denied');
    }
  };

  return (
    <>
      <TopNavBar />
      <Routes>
        <Route path="/" element={<Home eventId={EVENT_ID} uid={uid} />} />
        <Route path="/map" element={<MapPage />} />
        <Route path="/analytics" element={<Analytics />} />
        <Route path="/logistics" element={<Logistics />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      {/* FCM Permission Banner */}
      {fcmStatus === 'idle' && uid && (
        <div style={alertBannerStyle} role="status">
          <span style={{ fontSize: '0.8rem', color: '#fef3c7' }}>
            🔔 Get live match nudges on your lock screen
          </span>
          <button
            onClick={handleEnableAlerts}
            style={alertBtnStyle}
            aria-label="Enable match alert notifications"
          >
            Enable alerts
          </button>
        </div>
      )}

      {fcmStatus === 'granted' && (
        <div style={{ ...alertBannerStyle, background: 'rgba(29,158,117,0.85)' }} role="status">
          <span style={{ fontSize: '0.8rem', color: '#fff' }}>
            ✓ Alerts enabled — nudges will appear on your lock screen
          </span>
        </div>
      )}

      {/* Demo Control Bar */}
      <DemoBar />
    </>
  );
}

function App() {
  const [uid, setUid] = useState(null);
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setUid(user.uid);
        setAuthReady(true);
      } else {
        try {
          await signInAnonymously(auth);
        } catch (err) {
          console.error('[App] Anonymous sign-in failed:', err.message);
          setAuthReady(true);
        }
      }
    });

    return () => unsub();
  }, []);

  if (!authReady) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen text-on-background">
        <div className="text-4xl mb-3">⚡</div>
        <div className="text-xl font-bold">Flow</div>
        <div className="text-sm text-secondary mt-2">Connecting to stadium…</div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <AppContent uid={uid} />
    </BrowserRouter>
  );
}

// Keep alert banner styles inline or move to tailwind, 
// using inline exactly as it was requested to preserve wire-up.
const alertBannerStyle = {
  position: 'fixed',
  bottom: 80, 
  left: 12,
  right: 12,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 8,
  padding: '10px 14px',
  background: 'rgba(29,30,38,0.92)',
  border: '1px solid rgba(29,158,117,0.4)',
  borderRadius: 12,
  backdropFilter: 'blur(10px)',
  zIndex: 1050,
  fontFamily: "'Inter', system-ui, sans-serif",
  animation: 'fadeSlideUp 0.3s ease',
};

const alertBtnStyle = {
  padding: '6px 16px',
  background: '#00694c',
  color: '#fff',
  border: 'none',
  borderRadius: 8,
  fontWeight: 700,
  fontSize: '0.8rem',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
  fontFamily: "'Inter', system-ui, sans-serif",
};

export default App;
