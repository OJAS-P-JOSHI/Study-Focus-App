# Study Focus

A mobile-first study productivity and accountability system that helps students start a focused session, recover from distractions, and turn completed work into useful goals, streaks, timetable adherence, and analytics.

The core loop is intentionally simple: choose what to study, start focus, receive native local checkpoint reminders, return to the task, finish, and review actual progress.

## Architecture

This repository is an npm-workspaces monorepo:

```text
apps/
  mobile/       Expo + React Native application
  api/          NestJS REST API
packages/
  shared/       Cross-application constants and API types
```

The mobile device owns active-session timers and local notification scheduling. The API owns durable user data, authorization, session transitions, and analytics. An active session remains usable offline and queues synchronization work until connectivity returns.

## Stack

- Mobile: React Native, Expo SDK 57, Expo Router, TypeScript, expo-notifications, TanStack Query, Zustand, React Hook Form, Zod, Axios, SecureStore
- API: Node.js, NestJS, TypeScript, MongoDB, Mongoose, JWT, Passport, bcrypt, class-validator, Pino
- Tooling: npm workspaces, Jest, ESLint

## Prerequisites

- Node.js 22+
- npm 11+
- MongoDB Community Server with Compass, or a MongoDB Atlas cluster
- Android Studio/emulator or an Android device with Expo Go/development build

## Environment

Copy the root example and set strong secrets:

```powershell
Copy-Item .env.example apps/api/.env
Copy-Item .env.example apps/mobile/.env
```

Required API values:

- `MONGODB_URI`
- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`
- `JWT_ACCESS_EXPIRES_IN`
- `JWT_REFRESH_EXPIRES_IN`
- `API_PORT`
- `NODE_ENV`

The mobile application reads `EXPO_PUBLIC_API_URL`. Android emulators reach the host at `http://10.0.2.2`; physical devices need the development machine's LAN IP.

Never commit real secrets or tokens.

## Install

From the repository root:

```powershell
npm install
```

## Database setup

For local development, start MongoDB Community Server and connect with Compass:

```powershell
mongodb://localhost:27017/studyapp
```

Set the same URI in `apps/api/.env`. MongoDB collections and indexes are created from validated Mongoose schemas when the API starts:

```powershell
npm run dev:api
```

For deployed environments, use a MongoDB Atlas connection string in `MONGODB_URI`. No PostgreSQL or Prisma migrations are used.

## Development

Start the API:

```powershell
npm run dev:api
```

Start Expo in another terminal:

```powershell
npm run dev:mobile
```

The REST API is versioned under `/api/v1`.

## Focus reminders

While a session is active, the app schedules native local notifications using stable session metadata. Reminders are canceled while paused and when a session completes or is canceled. The app reconciles persisted session state and notification identifiers on startup and foreground transitions.

Production reminder choices are 5, 10, 15, 20, 25, or 30 minutes; the default is 10. A development-only one-minute interval may be enabled in development builds for manual notification testing.

### Android notification testing

1. Use a physical Android device or an emulator with notification support.
2. Allow notification permission when prompted.
3. Start a focus session with the development test interval.
4. Background the app and wait for the checkpoint.
5. Return to the app, pause, and verify no further checkpoint fires.
6. Resume and verify scheduling restarts.
7. Finish or cancel and verify all session notifications are removed.

Notification delivery depends on the operating system and must be verified on a real target device. Unit tests can validate scheduling and cancellation calls but cannot prove OS delivery.

## Validation and builds

```powershell
npm run typecheck
npm run lint
npm run test
npm run build:api
npm run export --workspace=mobile
```

For native production binaries, configure an Expo Application Services project and use EAS Build.

## API overview

The API provides authentication, subjects, tasks, recurring timetable entries, focus-session lifecycle and distractions, settings, and server-side analytics. Every protected operation derives the user from the access token; clients never choose an owning `userId`.

Focus transitions are explicitly restricted:

```text
ACTIVE -> PAUSED | COMPLETED | CANCELLED | EXPIRED
PAUSED -> ACTIVE | COMPLETED | CANCELLED
```

Terminal sessions cannot be resumed.

## Known limitations

- OS notification firing requires manual device verification.
- MongoDB must be reachable for integration tests and full API operation.
- Offline synchronization is intentionally a small retry queue, not a general conflict-resolution system.
- iOS native builds require macOS/Xcode or EAS Build.

## Troubleshooting

- API unreachable on Android emulator: use `10.0.2.2`, not `localhost`.
- Physical device cannot reach API: bind the API to the LAN interface and use the machine's LAN IP.
- Notifications missing: check OS permission, app notification settings, Android channel settings, and battery restrictions.
- MongoDB connection errors: confirm the local MongoDB service is running and `MONGODB_URI` is `mongodb://localhost:27017/studyapp`, or verify Atlas network access and credentials.
