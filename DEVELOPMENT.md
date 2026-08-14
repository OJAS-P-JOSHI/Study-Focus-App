# Development Guide

## Prerequisites

- Windows/macOS/Linux development machine.
- Node.js **22 or newer** (`package.json` engine). Last documented local runtime: Node `v22.23.1`, npm `11.17.0`.
- npm (workspace support; current lockfile).
- MongoDB Community Server locally, or MongoDB Atlas.
- Expo-compatible device/runtime only when manually testing the mobile app.

Do not install/recreate Android emulators or system images merely to continue non-device development. A physical device can be used later for native acceptance testing.

## Install

From repository root:

```powershell
npm install
```

This installs root, `apps/api`, `apps/mobile`, and package workspace dependencies. Nested `apps/*/package-lock.json` files also exist; prefer the root lockfile. `packages/shared` and `packages/config` are present but currently unused by the apps. An empty leftover `apps/api/prisma/` directory may exist and is not part of the runtime.

## Environment

### API

Copy the API values from the root example or `apps/api/.env.example`:

```powershell
Copy-Item .env.example apps/api/.env
```

Required at startup:

```dotenv
MONGODB_URI=mongodb://localhost:27017/studyapp
JWT_ACCESS_SECRET=replace-with-at-least-32-random-characters
JWT_REFRESH_SECRET=replace-with-a-different-32-character-secret
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=30d
NODE_ENV=development
API_PORT=3000
CORS_ORIGIN=*
LOG_LEVEL=info
```

Both secrets must be at least 32 characters. Do not commit `.env`.

### Mobile

There is no checked-in `apps/mobile/.env.example`; copy/create `apps/mobile/.env` and set:

```dotenv
EXPO_PUBLIC_API_URL=http://<reachable-host>:3000/api/v1
```

`MOBILE_API_URL` appears in the root example but current mobile code reads only `EXPO_PUBLIC_API_URL`.

Host choice:

- web/iOS simulator on same machine: usually `http://localhost:3000/api/v1`
- Android emulator, if one already exists: `http://10.0.2.2:3000/api/v1`
- physical device: `http://<development-PC-LAN-IP>:3000/api/v1`

The API binds `0.0.0.0`, but Windows Firewall/LAN policy must allow port 3000 for a physical device.

## MongoDB

Local URI: `mongodb://localhost:27017/studyapp`. MongoDB Compass is optional; it is a GUI, not the runtime database.

Start the local MongoDB service by the method used for your installation, then start the API. Check:

```powershell
Invoke-RestMethod http://localhost:3000/api/v1/health/database
```

Expected data envelope contains `status: up`, `database: mongodb`, `connected: true`. HTTP status can still be 200 when `connected` is false; inspect the body.

For production, use Atlas and configure credentials/network access outside source control.

## Start Development

Terminal 1:

```powershell
npm run dev:api
```

Terminal 2:

```powershell
npm run dev:mobile
```

Direct workspace equivalents:

```powershell
npm run start:dev --workspace=api
npm run start --workspace=mobile
```

API base: `http://localhost:3000/api/v1`.

## Seed

```powershell
npm run seed:dev --workspace=api
```

Creates demo user `demo@studyfocus.app` / `password123` only for local development. See `DATABASE.md`.

## Validation Commands

```powershell
npm run typecheck
npm run lint
npm run test
npm run build:api
npm run test:notifications --workspace=mobile
npm run test:timetable --workspace=mobile
npx expo-doctor
```

Run `npx expo-doctor` from `apps/mobile`, or use `npx expo-doctor apps/mobile` if supported by the installed version; do not pass the unsupported `--project-root` form.

`npm run validate` currently runs typecheck + API tests, not lint/build/mobile scripts.

## Builds

API:

```powershell
npm run build:api
npm run start:prod --workspace=api
```

The mobile package does not currently define an `export` or EAS build script. Use Expo CLI directly only after deciding the target:

```powershell
npx expo export --platform web
```

Native distributable builds require EAS/native setup and are not currently documented as verified.

## EADDRINUSE on Port 3000

Multiple restart/watch tasks can leave another Node process listening. Inspect before starting another server:

```powershell
Get-NetTCPConnection -LocalPort 3000 -State Listen |
  Select-Object LocalAddress,LocalPort,OwningProcess

Get-Process -Id <OwningProcess>
```

Stop only the verified API process:

```powershell
Stop-Process -Id <OwningProcess>
```

Do not blindly kill all Node processes; Expo or unrelated tools may be using them. Cursor background restart tasks may report errors when deliberately stopped so a newer API build can replace them.

## API Smoke Check

```powershell
Invoke-RestMethod http://localhost:3000/api/v1/health/database
```

Registration example:

```powershell
$body = @{
  name = "Developer"
  email = "developer@example.com"
  password = "password123"
} | ConvertTo-Json

Invoke-RestMethod `
  -Method Post `
  -Uri http://localhost:3000/api/v1/auth/register `
  -ContentType application/json `
  -Body $body
```

## Logging and Secrets

Pino redacts authorization, password, refresh token, and set-cookie paths. This is defense-in-depth, not permission to log arbitrary sensitive objects. Keep secrets in environment configuration.

## Git Workflow

Before work:

```powershell
git status
git log -5 --oneline
```

Preserve the current architecture, make bounded changes, run proportionate tests, and commit one coherent phase at a time. Never assume a previous audit still represents current code.
