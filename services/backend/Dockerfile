# syntax=docker/dockerfile:1
#
# Monorepo-aware build. Build context is the REPOSITORY ROOT (see
# docker-compose.yml) so the workspace dependency @vivamama/contracts resolves.
#   docker build -f services/backend/Dockerfile -t vivamama-backend .
#
# ── Stage 1: Build the workspace (backend + its deps) ──────────────
FROM node:26-alpine AS build
RUN corepack enable && corepack prepare pnpm@8.9.0 --activate
WORKDIR /repo

# Copy the whole workspace (root .dockerignore keeps this lean).
COPY . .

# Install only @vivamama/backend and its dependency graph (incl. contracts),
# then build contracts -> backend (Turbo/pnpm orders this via the `...` selector).
RUN pnpm install --frozen-lockfile --filter "@vivamama/backend..." \
 && pnpm --filter "@vivamama/backend..." run build \
 && pnpm prune --prod || true

# ── Stage 2: Runtime ───────────────────────────────────────────────
FROM node:26-alpine AS runtime
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001
WORKDIR /repo
COPY --from=build --chown=nodejs:nodejs /repo /repo

# The Firebase service-account key is NOT in the image. Supply credentials at
# runtime via Application Default Credentials: mount a key and set
# GOOGLE_APPLICATION_CREDENTIALS (see docker-compose.yml), or use the GCP
# runtime service account on Cloud Run. See src/config/firebase.ts.

USER nodejs
WORKDIR /repo/services/backend
ENV NODE_ENV=production
EXPOSE 4000
CMD ["node", "build/index.js"]
