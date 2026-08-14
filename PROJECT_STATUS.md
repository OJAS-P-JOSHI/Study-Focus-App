# Study Focus App — Current Status

Snapshot: **2026-08-14**

Branch at documentation start: `main`

Commit at documentation start: `c3ee412` (`docs: refresh project status and lint formatting`)

Working tree: documentation changes are intentionally uncommitted until reviewed.

## Done

### Repository and infrastructure

- npm workspaces: API, mobile, shared/config packages.
- Node 22 requirement and lockfile.
- GitHub Actions with MongoDB 8, typecheck, API tests, API build.
- MongoDB/Mongoose architecture; local URI `mongodb://localhost:27017/studyapp`.
- `/api/v1/health/database`.

### Backend

- NestJS production bootstrap, validation, envelopes, exception filtering, CORS, Pino redaction.
- JWT registration/login/refresh/logout/me.
- Subject and task CRUD with owner/relation enforcement.
- Recurring timetable CRUD and task-subject validation.
- Focus state machine, server-derived timing, one-open-session index, distractions, idempotent offline sync.
- Settings/profile/targets/defaults/data reset.
- Completed-session analytics: daily/weekly/monthly, ranges, streak, subject distribution, averages, adherence.

### Mobile

- Auth and protected navigation.
- Subject/task/timetable management screens.
- Live dashboard and analytics screen.
- Focus start/active/summary, distraction recovery.
- Secure tokens, persisted focus state, reconnect queue flush.
- Local notification service with plan, cancellation, duplicate prevention, and reconciliation.
- Settings UI and reset.

### Validation

- Last run at documentation creation: API/mobile typecheck and lint passed.
- API build passed.
- Jest: 4 suites, 21/21 tests passed.
- Notification-plan and timetable-status scripts passed.
- Expo Doctor: 20/20 checks passed.
- Live local API/MongoDB acceptance checks were previously run for auth, CRUD, focus, distraction, timetable, analytics, settings/reset, and offline sync; they are not committed integration tests.

## In Progress

- Comprehensive AI/developer knowledge base (the documentation files in this commit/worktree).
- UX/accessibility/error/empty-state polish remains the next product phase.

## Blocked

Native notification delivery remains unverified because no Android device/emulator is currently available. The notification implementation is complete but requires a physical Android device or emulator for runtime verification.

This blocks only a claim of native delivery acceptance. It does not block backend, mobile logic, tests, or UI development. Do not install an emulator/system image merely to continue.

## Partial / Known Limitations

- Offline focus snapshot sync works, but queue/local state is not account-scoped and replay stops at first permanent failure.
- Fresh “continue offline” lacks persisted subjects/tasks.
- Theme/sound/vibration/notification settings are persisted but not fully applied at runtime.
- Goal targets used by product live in `userSettings`; `studyGoals` schema is dormant.
- Dedicated full session history UI is not implemented.
- Mobile UI/store/device tests and production-bootstrap API e2e coverage are not implemented.
- Analytics fields named total/longest load at most 400 days.
- Offline sync bypasses the normal focus transition machine for open sessions.
- Health can return HTTP 200 with `connected: false`.
- Settings reset is non-transactional; task delete can leave dangling refs.
- `AppController` is unused; e2e/root tests are stale.
- Shared packages unused; `app.json` icon paths may be missing files.

## Not Implemented by Design

- PostgreSQL/Prisma.
- Backend cron/push focus reminders.
- System-wide app blocking.
- AI coaching.
- Social feeds/leaderboards.
- Automatic sessions from timetable plans.

## Database Status

Local MongoDB was reachable during implementation/acceptance checks. API requires `MONGODB_URI`; production Atlas deployment has not been verified.

## Build Status

API TypeScript build is verified. Expo dependency health/static checks are verified. Native Android/iOS release builds are not verified.

## Next Recommended Phase

1. Make auth identity changes safely clear/scope focus state, queue, and query cache.
2. Add queue/store and production-bootstrap e2e tests.
3. Complete runtime preference application.
4. Continue UX/accessibility polish.
5. Run physical Android notification acceptance when a device becomes available.
