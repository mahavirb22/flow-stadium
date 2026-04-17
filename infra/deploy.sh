#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────
# deploy.sh — Full deployment pipeline for Flow
# ─────────────────────────────────────────────────────────────────
# Usage: ./infra/deploy.sh
# Requires: gcloud CLI, firebase CLI, npm, docker
# ─────────────────────────────────────────────────────────────────

set -euo pipefail

# ─── Config ───────────────────────────────────────────────────────
PROJECT_ID="${GCP_PROJECT_ID:?Error: GCP_PROJECT_ID env var is required}"
REGION="${GCP_REGION:-us-central1}"
SERVICE_NAME="flow-server"
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

# ─── Colors ───────────────────────────────────────────────────────
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

step() { echo -e "\n${BLUE}━━━ $1 ━━━${NC}\n"; }
success() { echo -e "${GREEN}✓ $1${NC}"; }
warn() { echo -e "${YELLOW}⚠ $1${NC}"; }

# ─── Preflight ────────────────────────────────────────────────────

step "1/6 · Preflight checks"

command -v gcloud >/dev/null 2>&1 || { echo -e "${RED}✗ gcloud CLI not found${NC}"; exit 1; }
command -v firebase >/dev/null 2>&1 || { echo -e "${RED}✗ firebase CLI not found${NC}"; exit 1; }
command -v npm >/dev/null 2>&1 || { echo -e "${RED}✗ npm not found${NC}"; exit 1; }

gcloud config set project "$PROJECT_ID" --quiet
success "Project set to $PROJECT_ID"

# ─── Step 1: Build & Deploy Server to Cloud Run ──────────────────

step "2/6 · Deploying server to Cloud Run"

cd "$REPO_ROOT/server"

gcloud run deploy "$SERVICE_NAME" \
  --source . \
  --region "$REGION" \
  --platform managed \
  --allow-unauthenticated \
  --min-instances 1 \
  --max-instances 10 \
  --memory 512Mi \
  --cpu 1 \
  --set-env-vars "NODE_ENV=production,DEMO_MODE=true,EVENT_ID=demo-event-001" \
  --set-secrets "GEMINI_API_KEY=GEMINI_API_KEY:latest,MAPS_API_KEY=MAPS_API_KEY:latest,FIREBASE_PROJECT_ID=FIREBASE_PROJECT_ID:latest,DEMO_SECRET=DEMO_SECRET:latest" \
  --quiet

SERVER_URL=$(gcloud run services describe "$SERVICE_NAME" --region "$REGION" --format 'value(status.url)')
success "Server deployed at $SERVER_URL"

# ─── Step 2: Deploy Firestore Rules ──────────────────────────────

step "3/6 · Deploying Firestore security rules"

cd "$REPO_ROOT"
firebase deploy --only firestore:rules --project "$PROJECT_ID"

success "Firestore rules deployed"

# ─── Step 3: Deploy Cloud Functions ──────────────────────────────

step "4/6 · Deploying Cloud Functions"

cd "$REPO_ROOT"
firebase deploy --only functions --project "$PROJECT_ID"

success "Cloud Functions deployed"

# ─── Step 4: Build Client ────────────────────────────────────────

step "5/6 · Building client PWA"

cd "$REPO_ROOT/client"
npm run build

success "Client built successfully"

# ─── Step 5: Deploy Client to Firebase Hosting ───────────────────

step "6/6 · Deploying client to Firebase Hosting"

cd "$REPO_ROOT"
firebase deploy --only hosting --project "$PROJECT_ID"

HOSTING_URL=$(firebase hosting:channel:list --project "$PROJECT_ID" --json 2>/dev/null | grep -oP '"url":\s*"\K[^"]+' | head -1 || echo "https://${PROJECT_ID}.web.app")

success "Client deployed"

# ─── Summary ─────────────────────────────────────────────────────

echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}  Flow deployed successfully! 🎉${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "  Server:   ${BLUE}${SERVER_URL}${NC}"
echo -e "  Client:   ${BLUE}https://${PROJECT_ID}.web.app${NC}"
echo -e "  Health:   ${BLUE}${SERVER_URL}/health${NC}"
echo ""
echo -e "  Demo start:   curl -X POST ${SERVER_URL}/demo/start -H 'x-demo-secret: \$DEMO_SECRET'"
echo -e "  Halftime:     curl -X POST ${SERVER_URL}/demo/halftime -H 'x-demo-secret: \$DEMO_SECRET'"
echo ""
