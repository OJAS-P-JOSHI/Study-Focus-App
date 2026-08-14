# Testing and Verification

Snapshot date: 2026-08-14.

## Frameworks

- API unit tests: Jest 30 + ts-jest.
- API e2e scaffold: Jest/Supertest with separate config.
- Mobile pure-logic scripts: Node 22 experimental TypeScript stripping + `node:assert/strict`.
- Static: TypeScript, ESLint/Prettier, Expo Doctor.
- CI: GitHub Actions, Node 22, MongoDB 8 service.

## Current Automated Count

`npm run test --workspace=api -- --runInBand`:

- 4 suites
- 21 tests
- 0 snapshots
- currently passing at documentation creation

Suites:

- `auth.spec.ts`: auth service success/error flows with mocked Mongoose queries.
- `focus.spec.ts`: valid/invalid state transitions and duration math.
- `analytics.spec.ts`: streak/date helper behavior.
- `app.controller.spec.ts`: leftover Nest scaffold. `AppController`/`AppService` are not registered in `AppModule`, so this tests code the running API does not serve.

Mobile scripts:

- `test-notification-plan.ts`: checkpoint times, deterministic IDs, invalid plans, focus reminder filtering.
- `test-timetable-status.ts`: current/next/missed/completed/disabled classification.

These scripts are not Jest suites and are not included in root `npm test`/CI.

## E2E Reality

`apps/api/test/app.e2e-spec.ts` exists and asserts unprefixed `/` returns raw `Hello World!`, but it creates a Nest app without the production `main.ts` global prefix, validation, envelope interceptor, exception filter, CORS, or logger. The root controller it targets is also not registered in `AppModule`. It is a scaffold smoke test, not a production-contract e2e suite, and `npm run test:e2e` is not part of CI.

Documented Jest coverage for the current API suite is about 14%; most controllers/services are untested.

## Validation Commands

```powershell
npm run typecheck
npm run lint
npm run test
npm run build:api
npm run test:notifications --workspace=mobile
npm run test:timetable --workspace=mobile
```

Expo compatibility:

```powershell
Set-Location apps/mobile
npx expo-doctor
```

Last documented result: typecheck/lint passed, API 21/21 passed, API build passed, both mobile scripts passed, Expo Doctor 20/20.

## Feature Verification Matrix

| Feature | Automated | Manual/live API | Native/mobile runtime |
|---|---|---|---|
| Auth service/token behavior | Unit mocked | Previously exercised against local API/MongoDB | UI flow not covered by automated UI tests |
| Subject/task ownership CRUD | Typecheck/build only | Previously live API exercised | UI not automated |
| Focus transitions/time math | Unit | Previously live API exercised | UI not automated |
| Distraction persistence | Typecheck/build | Previously live API exercised | Recovery UI not automated |
| Timetable CRUD/relations | Pure status only | Previously live API exercised | Screen not automated |
| Dashboard composition | Typecheck/lint | Underlying APIs exercised | No component test |
| Analytics ranges | Streak/helper tests | Previously live API exercised | Stats screen not automated |
| Settings/reset | Typecheck/build | Previously live API exercised | Screen not automated |
| Offline sync idempotency/time validation | Typecheck/build | Previously live API exercised | Network-loss/reconnect device flow not automated |
| Notification plan/filter | Node assertions | N/A | Native delivery **not verified** |
| API build/start | Build | Local start/health previously exercised | N/A |
| MongoDB connectivity | CI service + local health checks | Local MongoDB used | N/A |

“Previously live API exercised” refers to manual PowerShell acceptance checks performed against the current implementation, not committed repeatable integration tests.

## Manual Tests Still Required

### Physical Android notification acceptance

See `NOTIFICATIONS.md`. Permission grant/deny, background delivery, pause/resume, duplicate prevention, restart, and terminal cancellation need a real target.

### Offline focus acceptance

1. Login online and load/create a subject.
2. Disconnect network.
3. Start/pause/resume/log distraction/complete.
4. Restart app during active and paused states.
5. Confirm timer and reminders reconcile.
6. Reconnect.
7. Verify one server session with correct timestamps, duration, events, and terminal state.
8. Logout/login another account and ensure no cross-account replay—currently expected to expose a known queue-scoping limitation.

### Settings

Verify defaults affect focus start and analytics targets. Theme/sound/vibration/notification preference runtime behavior is incomplete and must not be marked passed.

## Test Gaps

- no mobile component/navigation tests
- no focus-store/offline-queue concurrency/account-scope tests
- no production-bootstrap API e2e suite
- no service-level tests for subjects, tasks, timetable, settings, reset, analytics aggregation/adherence, distraction logging, or sync conflicts
- no Atlas deployment tests
- no iOS native tests
- no performance/load tests
- no accessibility automation

## CI

`.github/workflows/ci.yml` runs on pushes to `main` and pull requests:

1. MongoDB 8 service
2. Node 22
3. `npm ci`
4. `npm run typecheck`
5. `npm run test`
6. `npm run build:api`

CI currently omits lint, mobile pure scripts, Expo Doctor, e2e, coverage gates, and a mobile export/native build.

## Verification Rules for Future Agents

- Do not call typecheck an integration test.
- Do not call deterministic notification plan tests proof of OS delivery.
- Do not infer mobile UI correctness from API acceptance.
- When fixing a known gap, add a repeatable test where practical.
- Run existing tests before modifying a working subsystem, then rerun after.
