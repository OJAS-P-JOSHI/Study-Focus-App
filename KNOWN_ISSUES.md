# Known Issues and Current Limitations

This list reflects current source as of 2026-08-14. It intentionally excludes fixed filesystem permissions, removed architecture, and stale audits.

## Blockers

No blocker prevents online API development, MongoDB operation, or static validation.

For claiming native notification readiness, lack of a physical Android device/already-available emulator is a verification blocker only. It must not block unrelated work.

## Non-Blocking Limitations

### Offline queue is not account-scoped

`@study-focus/offline-queue/v1` is global to the installation. Ordinary auth logout clears tokens/local-mode marker but does not clear queue, focus store, or TanStack Query cache. A queued mutation could later replay using another signed-in account. `resetLocal()` clears queue/focus state, but normal logout does not call it.

Recommended next fix: scope queue/persisted focus by authenticated user or clear/reconcile all account-owned local state on identity change/logout, with tests.

### Queue replay can be permanently blocked

Replay stops at the first error. Attempts increment but have no cap/dead-letter classification, and a permanent 400/409 prevents later items. Queue writes use async read-modify-write and are not concurrency-serialized.

### Fresh local/offline mode has insufficient data

Auth offers “continue offline”, but subjects/tasks/settings and TanStack Query cache are not persisted. Focus start requires a subject selected from API data, so a fresh install cannot usefully start offline. Offline support is strongest after an authenticated user has already loaded data, but even that query cache is memory-only.

### Settings are partially applied

- theme is stored but UI remains fixed dark
- sound/vibration values are stored but notification handler/channel are static
- disabling `notificationsEnabled` cancels current reminders in settings, but focus scheduling does not consistently consult the persisted flag before future sessions

### Goals model duplication

Current goal progress uses daily/weekly fields in `userSettings`. `studyGoals` exists and is seeded but has no routes/service/mobile use. This should eventually be removed/migrated or made authoritative, not left ambiguous.

### “Total” analytics is a 400-day window

Overview `totalMinutes`, `completedSessions`, and streak loading default to the last 400 days. Names can be misread as lifetime totals.

### Session history is limited

The API lists sessions and dashboard shows recent completed sessions, but there is no dedicated paginated history/detail/filter UI.

### Form validation is mostly server-driven

Zod and React Hook Form are installed but current screens largely use component state/basic parsing. Error messages are generally coarse.

### Mobile test coverage is thin

No component, navigation, Zustand store, queue, or device integration tests. See `TESTING.md`.

### E2E scaffold does not mirror production bootstrap

The existing Supertest app omits `/api/v1`, global validation, envelopes, and filter.

### Mongoose deprecation warnings

Current Mongoose logs that `new` for `findOneAndUpdate` is deprecated in favor of `returnDocument: "after"`. It works but should be migrated carefully.

### Malformed route IDs can return 500

Controllers do not validate `:id` parameters with an ObjectId pipe. Well-formed IDs that are absent/not owned return 404, but malformed IDs can produce an unhandled Mongoose `CastError` and `INTERNAL_ERROR`. Add route-parameter validation and API tests before promising a uniform 400 contract.

### Offline sync bypasses the normal focus state machine

`POST /focus-sessions/sync` is idempotent for terminal records, but an existing open session is replaced with the last submitted snapshot. It does not enforce `ACTIVE → PAUSED → …` transitions. Distraction timestamps/size are weakly constrained. A second open client ID still hits the one-open-session unique index.

### Health can be HTTP 200 while MongoDB is down

`GET /api/v1/health/database` reports `connected: false` in the body but still returns HTTP 200. Callers must inspect the payload, not the status code.

### Settings reset is non-transactional

`DELETE /settings/data` issues parallel independent deletes. A database failure can leave a partial reset.

### Task deletion can leave dangling references

Task delete has no dependency check or cascade. Timetable entries and focus sessions may keep a `taskId` that no longer exists.

### CORS default `*` is passed as an array

`CORS_ORIGIN` is always split into an array. `*` therefore becomes `["*"]`, which may not behave like the CORS package's scalar wildcard.

### Shared packages and sample data are unused by apps

`packages/shared` and `packages/config` exist, but `apps/api` and `apps/mobile` do not import them. `apps/mobile/src/data/sample-data.ts` is leftover.

### Missing native icon assets

`apps/mobile/app.json` references `assets/images/*`, but only `assets/expo.icon/` is present. Export/native icon build may fail until those files exist.

### Unguarded focus/task deep links

`/focus/*` and `/tasks` have no local auth redirect. The API still rejects unauthenticated calls, but the screens can render first.

### Dashboard greeting and zero daily target

Greeting is hardcoded “Good afternoon”. A daily target of 0 can produce `NaN` progress.

## Unverified Features

- Native Android notification delivery, permission UX, channel behavior, pause/resume/restart cancellation.
- Complete offline focus flow on a physical device under real process suspension/connectivity transitions.
- iOS native behavior/build.
- Production MongoDB Atlas deployment.
- EAS/native release build.
- Runtime application of stored theme/sound/vibration/notification flags (partly unimplemented, not merely unverified).

## Future Work

Recommended order:

1. Fix account-scoped local data/queue cleanup and replay blocking.
2. Add repeatable store/queue/API e2e tests.
3. Complete preference application.
4. Improve offline data availability or remove misleading fresh local-mode promise.
5. UX/accessibility/error/empty-state polish.
6. Physical Android notification acceptance when a device is available.
7. Resolve `studyGoals` vs `userSettings` source of truth.
8. Add dedicated session history if product priority supports it.

## Intentionally Not Issues

- MongoDB/Mongoose instead of PostgreSQL/Prisma is deliberate.
- Local notifications instead of backend cron are deliberate.
- No emulator installed is deliberate.
- No AI/social/app-blocking system is deliberate V1 scope.
- Timetable entries not creating focus sessions is an invariant, not missing automation.
