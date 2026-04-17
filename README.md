# ⚡ Flow — Predictive Stadium Ambient Intelligence

> **The stadium thinks. The attendee just enjoys the game.**

Flow is a predictive ambient intelligence system that transforms how 90,000 people 
navigate a live stadium. Instead of reactive signage and static maps, Flow reads the 
stadium's pulse — crowd density, queue lengths, match tempo — and delivers 
hyper-personalized nudges to each attendee's lock screen *before* they need to act.

---

## 🏗️ Architecture

```
                          ┌────────────────────────────┐
                          │   Google Gemini 1.5 Flash   │
                          │   Decision: nudge or not?   │
                          └─────────┬──────────────────┘
                                    │ JSON verdict
                          ┌─────────▼──────────────────┐
                          │    Prediction Engine        │
                          │  ┌─────────┐ ┌───────────┐ │
              Pub/Sub     │  │Hot Zones│ │Queue Sort │ │     FCM Push
  ┌──────────────────────►│  │ >0.75   │ │ ascending │ │────────────────┐
  │                       │  └─────────┘ └───────────┘ │                │
  │                       │  ┌─────────┐ ┌───────────┐ │                ▼
  │                       │  │Halftime │ │  Dedup    │ │        ┌──────────────┐
  │                       │  │ 41–44   │ │  5m cool  │ │        │ 📱 Lock      │
  │                       │  └─────────┘ └───────────┘ │        │    Screen    │
  │                       └────────────────────────────┘        │    Nudge     │
  │                                                             └──────────────┘
  │  ┌──────────────────┐    ┌──────────────────────┐
  │  │ Sensor Simulator │    │   Cloud Functions     │
  │  │ 6 crowd zones    │───►│  onCrowdUpdate        │
  │  │ 5 queue stands   │    │  onQueueUpdate        │──► Firestore
  │  │ Match clock      │    │  onMatchEvent         │    (live state)
  │  └──────────────────┘    │  onGroupUpdated       │
  │                          └──────────────────────┘
  │
  │  ┌──────────────────┐    ┌──────────────────────┐
  └──│  Google Cloud     │    │   React PWA Client   │
     │  Pub/Sub Topics   │    │  Home · Map · Queues │
     │  crowd-updates    │    │  Group · DemoBar     │
     │  queue-updates    │    │  Firestore real-time  │
     │  match-events     │    └──────────────────────┘
     └──────────────────┘
```

---

## 🧠 What Makes Flow Different

| Traditional Stadium Apps | Flow |
|---|---|
| **Reactive** — shows current wait times | **Predictive** — nudges you *before* halftime rush |
| User must open the app | Nudge arrives on **lock screen** |
| Same info for everyone | **Personalized** per attendee (section, preferences) |
| No group coordination | **Group exit** — finds least congested gate for your squad |
| Static maps | **Live heatmap** with crowd density |

Flow's core insight: **at minute 41, everyone will want food. The AI nudges the right 
people 3 minutes early, pointing them to the stand with the shortest queue — before it 
gets long.**

---

## 🛠️ Google Services Used

| Service | How Used | Why It Matters |
|---|---|---|
| **Gemini 1.5 Flash** | Makes per-attendee nudge decisions with full venue context | Sub-second AI decisions at scale with structured JSON output |
| **Cloud Firestore** | Real-time state for crowds, queues, events, groups, nudges | Millisecond sync between server and 90k client PWAs |
| **Cloud Functions v2** | Pub/Sub consumers, Firestore triggers for group coordination | Event-driven; scales to zero, no idle cost |
| **Cloud Run** | Hosts the Express API + prediction engine + simulator | Min-1 instance avoids cold start during live demo |
| **Cloud Pub/Sub** | Decouples sensor data from Firestore writes | Guaranteed delivery, handles burst from 6 zones × 5 stands |
| **Firebase Cloud Messaging** | Lock-screen push nudges (Android, iOS, Web) | The primary UX — users never open the app |
| **Firebase Auth** | Anonymous sign-in for hackathon demo | Zero-friction onboarding |
| **Firebase Hosting** | Serves the React PWA | Global CDN, automatic SSL |
| **Google Maps JS API** | HeatmapLayer for live crowd density visualization | Color-coded density with text fallback for accessibility |
| **Secret Manager** | Stores API keys and credentials for Cloud Run | No secrets in code or env files |

---

## 🚀 Setup

### Prerequisites

- Node.js 20+
- Google Cloud project with billing enabled
- Firebase CLI (`npm i -g firebase-tools`)
- `gcloud` CLI authenticated

### 1. Clone & Install

```bash
git clone https://github.com/your-team/flow.git
cd flow
npm install        # installs all workspaces
```

### 2. Configure Environment

```bash
cp .env.example .env
# Fill in:
#   GEMINI_API_KEY       — from AI Studio
#   MAPS_API_KEY         — from Cloud Console
#   FIREBASE_PROJECT_ID  — your GCP project
#   DEMO_SECRET          — any secret string
#   DEMO_MODE=true
```

### 3. Firebase Setup

```bash
firebase login
firebase use --add        # select your project
firebase deploy --only firestore:rules
firebase deploy --only functions
```

### 4. Run Locally

```bash
# Terminal 1 — Server
npm run dev --workspace=server     # http://localhost:8080

# Terminal 2 — Client
npm run dev --workspace=client     # http://localhost:5173
```

### 5. Deploy

```bash
chmod +x infra/deploy.sh
GCP_PROJECT_ID=your-project ./infra/deploy.sh
```

---

## 🎬 Demo Walkthrough

> **Total time: ~3 minutes.** Practice this sequence before presenting.

### Act 1 — "Normal match day" (30 sec)

1. Open the PWA → **Home** screen shows match clock at minute 0
2. Hit **"See queues"** → all stands show 5–12 min wait (moderate)
3. Open **Map** tab → heatmap shows even crowd distribution
4. **NudgeCard** says "All clear — enjoy the match"

### Act 2 — "Halftime approaches" (60 sec)

5. Open **DemoBar** → tap **"Trigger halftime"**
6. Watch Home screen: clock jumps to **41'**, phase → "Halftime soon"
7. Within 5s, a **push notification** arrives on the lock screen:
   > *"Head to South Drinks Bar — only 2 min wait right now"*
8. The NudgeCard updates in real-time
9. Switch to **Queues** → Stand 3 is now green with "⚡ Fastest"
10. Switch to **Map** → heatmap shows zones A/B glowing red, E/F green

### Act 3 — "Group coordination" (60 sec)

11. Tap **"Trigger group exit"** in DemoBar
12. Open **Group** tab → all 3 members show green dots + "● Near exit"
13. Within seconds, the **group coordinator fires** automatically:
    → Banner appears: "📍 Meeting at Gate 3 — South"
    → All members receive simultaneous push notification
14. Explain: *"The system found the least congested exit gate and coordinated the entire group — no group chat needed."*

### Act 4 — "Architecture highlight" (30 sec)

15. Tap **"Reset demo"** → everything returns to clean state
16. Show the README architecture diagram
17. Key talking point: *"The primary experience is the lock screen — this app is just the fallback. The AI decides who to nudge, when, and where — before they even think to check."*

---

## 🧪 Testing

```bash
cd server
node --experimental-vm-modules ../node_modules/jest/bin/jest.js --verbose

# 42 tests across 5 suites:
#   ✓ predictionEngine.test.js  (9)
#   ✓ fcmService.test.js        (7)
#   ✓ auth.test.js              (7)
#   ✓ geminiService.test.js     (11)
#   ✓ groupCoordinator.test.js  (8)
```

---

## 📁 Project Structure

```
flow/
├── client/                     React + Vite PWA
│   ├── src/
│   │   ├── components/         NudgeCard, QueueBoard, CrowdMap, GroupPanel, DemoBar
│   │   ├── hooks/              useCrowdData, useQueueData, useLatestNudge
│   │   ├── pages/              Home
│   │   ├── services/           fcm.js (client push)
│   │   ├── App.jsx             Auth, routing, bottom nav
│   │   └── firebase.js         Firebase config
│   └── public/                 manifest.json, firebase-messaging-sw.js
│
├── server/                     Node.js + Express
│   ├── middleware/             auth, rateLimit, validate
│   ├── routes/                 Authenticated API endpoints
│   ├── services/               predictionEngine, geminiService, fcmService, nudgeDeduplicator
│   ├── simulators/             sensorSimulator, demoController
│   ├── jobs/                   nudgeLoop
│   └── tests/                  5 test suites, 42 tests
│
├── functions/                  Firebase Cloud Functions v2
│   ├── pubsubConsumer.js       crowd, queue, match event handlers
│   └── groupCoordinator.js     Firestore trigger for group exit
│
├── infra/                      Deployment configs
│   ├── cloud-run.yaml          Cloud Run service definition
│   └── deploy.sh               Full deployment script
│
├── .github/workflows/ci.yml   CI/CD pipeline
├── firestore.rules             Production security rules
└── README.md                   ← You are here
```

---

## 🔒 Security

- **Firebase Auth** — anonymous sign-in with UID-scoped Firestore rules
- **Bearer token verification** — Firebase Admin `verifyIdToken()` on all API routes
- **Banned user check** — Firestore `banned_users` collection, returns 403
- **Rate limiting** — 60 req/min/IP general, 20 req/min/user for AI endpoints
- **Input validation** — express-validator chains on all POST endpoints
- **Firestore rules** — owner/member/admin access model, default deny
- **Secrets** — API keys in Secret Manager, never in code
- **Demo isolation** — demo endpoints require separate `DEMO_SECRET` header

---

## 👥 Team

Built with ❤️ and ☕ for the hackathon.

---

<p align="center"><em>Flow — because 90,000 people shouldn't need to think about where to go next.</em></p>
