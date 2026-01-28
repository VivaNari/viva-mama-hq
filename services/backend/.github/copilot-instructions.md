# Copilot Instructions for backend_core_vivanari

## Project Overview

- **TypeScript/Node.js backend** for a guided conversational health app ("VivaMama").
- **Domain:** Postpartum check-ins, user onboarding, and health flows.
- **Core architecture:**
    - **Express API** (`src/app.ts`, `src/api/routes/`) exposes REST endpoints for chat flows, flow definitions, and node categories.
    - **Guided chat system**: State machine flows managed via SSE (Server-Sent Events) and push notifications.
    - **MongoDB** via Mongoose models (`src/models/`) for users, conversations, flows, messages, etc.
    - **Firebase Admin** for push notifications (see `src/config/firebase.ts`).
    - **Scheduled jobs** (`src/cron-jobs/`) for user reminders and onboarding flows.

## Key Patterns & Conventions

- **Flow logic:**
    - Each user has a `FlowInstance` (see `chat-flow.service.ts`) tracking progress through a flow definition (`flowDefinition.model.ts`).
    - Questions are delivered via SSE if user is online, or silent push if offline.
    - Answers update the flow state and conversation history.
- **SSE & Push:**
    - SSE connections managed per user (`activeSessions`/`pendingQuestions` in `chat-flow.service.ts`).
    - Push notifications use FCM tokens from user records.
- **Controllers/Services:**
    - Controllers in `src/api/controllers/` delegate to service classes in `src/services/`.
    - Use `sendResponse` util for consistent API responses.
- **Auth:**
    - JWT-based, via `authorization.middleware.ts`. Token source can be `header` or `query` (see route definitions).
- **Models:**
    - All major entities (User, Conversation, FlowInstance, etc.) have Mongoose models and schemas in `src/models/`.
    - Schema options are centralized in `src/constants/model.ts`.
- **Types:**
    - Shared types/interfaces in `src/types/`, especially `chat.types.ts` for flow/chat logic.
- **Linting/Formatting:**
    - Prettier and ESLint (Airbnb + TypeScript) enforced. See `.prettierrc.json`, `.eslintrc.cjs`, and `lint-staged` config in `package.json`.
    - Husky pre-commit hooks run lint/format on staged files.
- **Testing:**
    - Minimal Jest setup in `__tests__/` (expand as needed).

## Developer Workflows

- **Start dev server:**
    - `npm run dev` (uses `nodemon` + `ts-node`)
- **Build:**
    - `npm run build` (TypeScript -> JS in `build/`)
- **Lint/Format:**
    - `npm run lint` / `npm run lint:fix` / `npm run format`
- **Run scheduled jobs:**
    - Jobs auto-start with server (`initScheduledJobs` in `src/index.ts`).
- **Environment:**
    - Secrets/config in `.env` (see `src/config/env.ts`).

## Integration Points

- **Firebase Admin SDK:**
    - Service account key in project root (`VivaMamaServiceAccountKey.json`).
    - Used for push notifications and silent pushes.
- **Socket.IO:**
    - Optional real-time events (`src/config/socket.ts`).
- **Twilio:**
    - Credentials in `.env`, but not actively used in main flows.

## Example: Adding a New Flow

1. Define flow structure in `flowDefinition.model.ts` and `flowDefinition.schema.ts`.
2. Add controller/service logic in `src/api/controllers/chat-system/` and `src/services/chat-system/`.
3. Update routes in `src/api/routes/`.
4. Use types from `src/types/chat.types.ts`.

## Tips for AI Agents

- **Preserve existing patterns** for SSE, push, and flow state management.
- **Reference types/interfaces** for all new models and API payloads.
- **Use centralized utilities** (`sendResponse`, shared types, schema options).
- **Follow lint/format rules** before committing code.
- **Document new flows/components in this file if they introduce new conventions.**

---

_Last updated: 2025-11-23_
