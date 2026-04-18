/**
 * index.js — Flow Server
 * ----------------------
 * Express API for the Flow predictive stadium intelligence system.
 *
 * Uses dynamic imports so Firebase Admin is initialized BEFORE
 * any module calls getFirestore() or getAuth().
 */

import 'dotenv/config';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { readFileSync, existsSync } from 'fs';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import express from 'express';
import cors from 'cors';

const __serverDir = dirname(fileURLToPath(import.meta.url));

// ─── 1. Firebase Admin Init (runs first) ────────────────────────
if (getApps().length === 0) {
  const saPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;

  if (saPath) {
    try {
      const serviceAccount = JSON.parse(readFileSync(saPath, 'utf8'));
      initializeApp({ credential: cert(serviceAccount) });
      console.log('[Firebase] ✓ Initialized with service account');
    } catch (err) {
      console.error('[Firebase] ✗ Service account error:', err.message);
      initializeApp({ projectId: process.env.FIREBASE_PROJECT_ID || undefined });
      console.log('[Firebase] ✓ Fallback to default credentials');
    }
  } else {
    initializeApp({ projectId: process.env.FIREBASE_PROJECT_ID || undefined });
    console.log('[Firebase] ✓ Initialized with default credentials');
  }
}

// ─── 2. Dynamic imports (AFTER Firebase is initialized) ─────────
const { default: router } = await import('./routes/index.js');
const { default: demoController, isDemoMode } = await import('./simulators/demoController.js');
const { default: SensorSimulator } = await import('./simulators/sensorSimulator.js');
const { default: IncidentSimulator } = await import('./simulators/incidentSimulator.js');

// ─── 3. App Setup ───────────────────────────────────────────────
const app = express();
const PORT = process.env.PORT || 8080;

// ─── 4. Middleware ──────────────────────────────────────────────

// Security: Native insertion of strict HTTP Security Headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  next();
});

app.use(cors({
  origin: process.env.CORS_ORIGIN || (process.env.NODE_ENV === 'production' ? true : 'http://localhost:3000'),
  credentials: true,
}));

app.use(express.json());

// ─── 5. Routes ──────────────────────────────────────────────────

app.use(router);

if (isDemoMode()) {
  app.use('/demo', demoController);
  console.log('[Server] Demo controller mounted at /demo/*');
}

// ─── 6. Static Files (Production — serves React client) ─────────

const clientDist = resolve(__serverDir, '../client/dist');

if (process.env.NODE_ENV === 'production' && existsSync(clientDist)) {
  const { default: serveStatic } = await import('express');
  app.use(serveStatic.static(clientDist));

  // SPA fallback — all non-API routes serve index.html
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/ingest') || req.path.startsWith('/demo')) {
      return next();
    }
    res.sendFile(resolve(clientDist, 'index.html'));
  });

  console.log('[Server] ✓ Serving client from', clientDist);
}

// ─── 7. Error Handlers ─────────────────────────────────────────

app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.use((err, _req, res, _next) => {
  console.error('[Server] Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// ─── 7. Start (BEFORE simulator so event loop stays alive) ──────

let simulator = null;

if (process.env.NODE_ENV !== 'test') {
  // Prevent PubSub gRPC failures from crashing the process
  process.on('unhandledRejection', (reason) => {
    console.warn('[Server] ⚠ Unhandled rejection (non-fatal):', reason?.message || reason);
  });

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Server] ✓  Listening on http://0.0.0.0:${PORT}`);

    // Start simulator AFTER server is listening
    try {
      simulator = new SensorSimulator({
        eventId:   process.env.EVENT_ID || 'demo-event-001',
        projectId: process.env.FIREBASE_PROJECT_ID,
      });
      simulator.start();

      const incidentSim = new IncidentSimulator({
        eventId: process.env.EVENT_ID || 'demo-event-001'
      });
      incidentSim.start();
    } catch (err) {
      console.warn('[Server] ⚠ Simulator failed:', err.message);
      console.warn('[Server] Server will continue without live sensor data.');
    }
  });
}

export { app, simulator };
export default app;
