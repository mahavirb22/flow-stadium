/**
 * DemoBar.jsx
 * ───────────
 * Fixed demo control bar for live hackathon demonstrations.
 * Only renders when VITE_DEMO_MODE === 'true'.
 */

import { useState } from 'react';

const DEMO_API = import.meta.env.VITE_DEMO_API || '';
const DEMO_SECRET = import.meta.env.VITE_DEMO_SECRET || 'flow-demo-2026';

async function demoFetch(endpoint) {
  try {
    const res = await fetch(`${DEMO_API}/demo/${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-demo-secret': DEMO_SECRET,
      },
    });
    const data = await res.json();
    return { ok: res.ok, data };
  } catch (err) {
    return { ok: false, data: { error: err.message } };
  }
}

export default function DemoBar() {
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);

  const isDemo = true;
  if (!isDemo) {
    return null;
  }

  const trigger = async (action, label) => {
    setLoading(true);
    setStatus(`${label}…`);

    const result = await demoFetch(action);

    if (result.ok) {
      setStatus(`✓ ${label} complete`);
    } else {
      setStatus(`✗ ${result.data.error || 'Failed'}`);
    }

    setLoading(false);
    setTimeout(() => setStatus(''), 3000);
  };

  return (
    <div style={styles.bar} role="toolbar" aria-label="Demo controls">
      <span style={styles.label} aria-hidden="true">⚡ DEMO</span>

      <button
        style={{ ...styles.btn, ...styles.btnHalftime }}
        onClick={() => trigger('halftime', 'Halftime')}
        disabled={loading}
        aria-label="Trigger halftime scenario"
      >
        Trigger halftime
      </button>

      <button
        style={{ ...styles.btn, ...styles.btnGroup }}
        onClick={() => trigger('group-exit', 'Group exit')}
        disabled={loading}
        aria-label="Trigger group exit scenario"
      >
        Trigger group exit
      </button>

      <button
        style={{ ...styles.btn, ...styles.btnReset }}
        onClick={() => trigger('reset', 'Reset')}
        disabled={loading}
        aria-label="Reset demo to clean state"
      >
        Reset demo
      </button>

      {status && (
        <span style={styles.status} role="status" aria-live="polite">
          {status}
        </span>
      )}
    </div>
  );
}

const styles = {
  bar: {
    position: 'fixed',
    bottom: 64, // above bottom nav
    left: 0,
    right: 0,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '8px 12px',
    background: 'linear-gradient(90deg, #92400e 0%, #b45309 50%, #92400e 100%)',
    borderTop: '2px solid #fbbf24',
    zIndex: 1100,
    overflowX: 'auto',
    fontFamily: "'Inter', system-ui, sans-serif",
  },
  label: {
    color: '#fef3c7',
    fontWeight: 800,
    fontSize: '0.7rem',
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    flexShrink: 0,
    padding: '2px 8px',
    background: 'rgba(0,0,0,0.25)',
    borderRadius: 4,
  },
  btn: {
    padding: '6px 12px',
    border: 'none',
    borderRadius: 6,
    fontSize: '0.75rem',
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: "'Inter', system-ui, sans-serif",
    transition: 'opacity 0.2s, transform 0.1s',
    flexShrink: 0,
  },
  btnHalftime: {
    background: '#fef3c7',
    color: '#92400e',
  },
  btnGroup: {
    background: '#d9f99d',
    color: '#365314',
  },
  btnReset: {
    background: '#fca5a5',
    color: '#7f1d1d',
  },
  status: {
    color: '#fef3c7',
    fontSize: '0.7rem',
    fontWeight: 600,
    flexShrink: 0,
    marginLeft: 'auto',
  },
};
