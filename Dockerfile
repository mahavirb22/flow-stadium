# ─── Build Stage: Client ─────────────────────────────────────────
FROM node:22-alpine AS client-build

WORKDIR /app
COPY package.json package-lock.json ./
COPY client/package.json client/
COPY server/package.json server/
COPY functions/package.json functions/

RUN npm ci --workspace=client --include-workspace-root

COPY client/ client/
RUN npm run build --workspace=client

# ─── Production Stage: Server ────────────────────────────────────
FROM node:22-alpine AS production

WORKDIR /app

# Copy root workspace files
COPY package.json package-lock.json ./
COPY server/package.json server/
COPY functions/package.json functions/

# Install server dependencies only (production)
RUN npm ci --workspace=server --include-workspace-root --omit=dev

# Copy server source
COPY server/ server/

# Copy built client from build stage
COPY --from=client-build /app/client/dist ./client/dist

# Cloud Run provides PORT env var (defaults to 8080)
ENV NODE_ENV=production
ENV PORT=8080

EXPOSE 8080

CMD ["node", "server/index.js"]
