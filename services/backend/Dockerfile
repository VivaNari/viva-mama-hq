# syntax=docker/dockerfile:1
#
# Monorepo-aware build. Build context is the REPOSITORY ROOT (see
# docker-compose.yml) so the workspace dependency @vivamama/contracts resolves.
#   docker build -f services/backend/Dockerfile -t vivamama-backend .
#
# ── Stage 1: Build the workspace (backend + its deps) ──────────────
FROM node:20-alpine AS build
RUN corepack enable && corepack prepare pnpm@8.9.0 --activate
WORKDIR /repo

# Copy the whole workspace (root .dockerignore keeps this lean).
COPY . .

# Install only @vivamama/backend and its dependency graph (incl. contracts),
# then build contracts -> backend (Turbo/pnpm orders this via the `...` selector).
#
# `pnpm deploy` then assembles a SELF-CONTAINED copy of the backend — its own
# files plus only its production dependencies, with @vivamama/contracts injected
# as a real package — into /prod/backend, outside the workspace.
#
# That step is not a nicety, it is the whole point. The repo sets
# node-linker=hoisted in .npmrc because React Native's Metro bundler and Gradle
# autolinking cannot cope with pnpm's symlinked store. Hoisting means there is
# ONE flat node_modules at the repo root shared by every workspace, so copying it
# into this image dragged in the entire monorepo: react-native (83MB),
# @react-native (57MB), @mui, @swc, plus the full typescript/jest/@types
# toolchain — a 1.13GB image for a Node API. --filter scopes which projects are
# built; it cannot scope a tree that is hoisted by design.
#
# --config.node-linker=isolated applies ONLY to this deploy step: it gives the
# output directory a properly scoped node_modules. It does not affect the install
# above, which must stay hoisted for the build to typecheck.
#
# build/ is copied in by hand afterwards because `pnpm deploy` uses npm-pack
# semantics and build/ is gitignored, so it would otherwise be silently omitted
# and the image would start with no compiled output at all.
RUN pnpm install --frozen-lockfile --filter "@vivamama/backend..." \
 && pnpm --filter "@vivamama/backend..." run build \
 && pnpm deploy --filter=@vivamama/backend --prod --config.node-linker=isolated /prod/backend \
 && cp -r services/backend/build /prod/backend/build

# ── Stage 2: Runtime ───────────────────────────────────────────────
FROM node:20-alpine AS runtime
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001
WORKDIR /app
COPY --from=build --chown=nodejs:nodejs /prod/backend /app

# The Firebase service-account key is NOT in the image. Supply credentials at
# runtime via Application Default Credentials: mount a key and set
# GOOGLE_APPLICATION_CREDENTIALS (see docker-compose.yml), or use the GCP
# runtime service account on Cloud Run. See src/config/firebase.ts.

USER nodejs
ENV NODE_ENV=production
EXPOSE 4000
CMD ["node", "build/index.js"]
