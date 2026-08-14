# Study Focus App

A mobile study productivity/accountability application that helps students start focused work, receive periodic local reminders, recover from distraction, finish honestly, and turn real study time into goals, streaks, timetable adherence, and analytics.

Core loop:

```text
START FOCUS → WORK → LOCAL REMINDER → RETURN → CONTINUE
→ FINISH → RECORD REAL TIME → UPDATE PROGRESS
```

## Features

- JWT registration/login/refresh/logout with secure mobile token storage
- user-owned subjects and tasks
- recurring weekly timetable plans
- timestamp-based focus state machine and distraction recovery
- mobile native local checkpoint notifications
- dashboard, streaks, goals, history charts, subject analytics, adherence
- profile/focus/settings and application-data reset
- persisted active focus and bounded idempotent offline sync

Native notification code is implemented, but OS delivery is not verified because no Android device/emulator is currently available.

## Architecture and Stack

```text
Expo / React Native mobile
        ↓ REST /api/v1
NestJS API
        ↓ Mongoose
MongoDB
```

- Mobile: Expo SDK 57, React Native 0.86, Expo Router, TypeScript, TanStack Query, Zustand, Axios, SecureStore, AsyncStorage, `expo-notifications`.
- API: Node 22+, NestJS 11, TypeScript, MongoDB, Mongoose 9, JWT/Passport, bcrypt, class-validator, Pino.
- Tooling: npm workspaces, Jest, ESLint, GitHub Actions.

Notifications are scheduled locally by the device; they do not use backend cron.

## Repository

```text
apps/mobile/      Expo application
apps/api/         NestJS API and Mongoose schemas
packages/shared/  shared defaults/types
packages/config/  TypeScript config
```

## Quick Start

Prerequisites: Node 22+, npm, MongoDB.

```powershell
npm install
Copy-Item .env.example apps/api/.env
```

Set 32+ character JWT secrets in `apps/api/.env`, then:

```powershell
npm run dev:api
npm run dev:mobile
```

Local database: `mongodb://localhost:27017/studyapp`.

API: `http://localhost:3000/api/v1`.

Create `apps/mobile/.env`:

```dotenv
EXPO_PUBLIC_API_URL=http://<device-reachable-host>:3000/api/v1
```

A physical device needs the development PC's LAN IP, not `localhost`.

## Development Commands

```powershell
npm run typecheck
npm run lint
npm run test
npm run build:api
npm run test:notifications --workspace=mobile
npm run test:timetable --workspace=mobile
npm run seed:dev --workspace=api
```

See [DEVELOPMENT.md](DEVELOPMENT.md) for exact environment, health, build, seed, and port troubleshooting.

## Screenshots

No maintained screenshots are checked in yet.

## Current Status

The online core loop, CRUD, timetable, dashboard/analytics/settings, local notification logic, and bounded offline focus sync are implemented. Next priorities are account-safe offline queue handling, stronger integration/mobile tests, runtime preference application, and UX/accessibility polish.

See [PROJECT_STATUS.md](PROJECT_STATUS.md) and [KNOWN_ISSUES.md](KNOWN_ISSUES.md).

## Documentation Index

Start here if you are a new AI coding agent:

- [AI_HANDOFF.md](AI_HANDOFF.md) — mandatory continuation instructions
- [PROJECT_CONTEXT.md](PROJECT_CONTEXT.md) — product purpose/philosophy/scope
- [PRODUCT_SPEC.md](PRODUCT_SPEC.md) — actual feature behavior/status
- [ARCHITECTURE.md](ARCHITECTURE.md) — system boundaries and invariants
- [MOBILE_ARCHITECTURE.md](MOBILE_ARCHITECTURE.md)
- [DATABASE.md](DATABASE.md)
- [API.md](API.md)
- [FOCUS_ENGINE.md](FOCUS_ENGINE.md)
- [NOTIFICATIONS.md](NOTIFICATIONS.md)
- [DEVELOPMENT.md](DEVELOPMENT.md)
- [TESTING.md](TESTING.md)
- [DECISIONS.md](DECISIONS.md)
- [KNOWN_ISSUES.md](KNOWN_ISSUES.md)
- [PROJECT_STATUS.md](PROJECT_STATUS.md)
