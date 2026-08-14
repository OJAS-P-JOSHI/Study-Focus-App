# REST API Reference

## Conventions

- Base URL: `http://localhost:3000/api/v1`.
- Protected routes require `Authorization: Bearer <accessToken>`.
- DTO validation transforms primitive query values, strips allowed properties, and rejects unknown properties.
- Dates are ISO-8601 strings. IDs are MongoDB ObjectId strings.
- All successful controller values are wrapped:

```json
{ "success": true, "data": {} }
```

- All errors are wrapped:

```json
{
  "success": false,
  "error": { "code": "BAD_REQUEST", "message": "..." },
  "path": "/api/v1/...",
  "timestamp": "..."
}
```

The error code is generally derived from Nest's HTTP error label; duplicate-key errors become 409 `CONFLICT`; unknown exceptions become 500 `INTERNAL_ERROR`.

INVARIANT: except registration/login/refresh and health, endpoints use the JWT user. No resource endpoint accepts an owning `userId`.

## Health

### `GET /health/database`

Auth: no. Response data: `{ status: "up"|"down", database: "mongodb", connected: boolean }`. This reports Mongoose connection ready state. HTTP status is 200 even when `connected` is false; callers must inspect the body.

### `GET /`

Not implemented in the running app. `AppController`/`AppService` exist and have a unit/e2e scaffold, but they are **not registered** in `AppModule`. Production bootstrap therefore has no root `Hello World` route.

## Authentication

### `POST /auth/register`

Auth: no.

Body: `{ email: string(email), name: string(2..80), password: string(min 8) }`.

Creates a user and default settings atomically by compensation (the user is deleted if settings creation fails). Password and returned refresh token are bcrypt-hashed at cost 12. Response: `{ user: { id,email,name,timezone }, accessToken, refreshToken }`.

Errors: 409 duplicate email; 400 DTO failure.

### `POST /auth/login`

Auth: no. Body: `{ email, password }`. Response matches register. Invalid credentials: 401. Issuing tokens replaces the stored refresh-token hash.

### `POST /auth/refresh`

Auth: no. Body: `{ refreshToken }`. Verifies JWT type/signature and the user's stored bcrypt hash, then rotates both tokens. Errors: 401 invalid/revoked token.

### `POST /auth/logout`

Auth: yes. No body. Clears the stored refresh-token hash. Response: `{ loggedOut: true }`.

### `GET /auth/me`

Auth: yes. Response: `{ id,email,name,timezone,createdAt,updatedAt }`.

## Subjects

All routes are protected and owner-filtered.

### `GET /subjects`

Returns all owned subjects sorted by name.

### `GET /subjects/:id`

Returns one owned subject. Errors: 404 if absent/not owned.

### `POST /subjects`

Body:

```json
{
  "name": "Mathematics",
  "description": "optional; max 500",
  "color": "#8B9DFF",
  "icon": "book",
  "weeklyTargetMinutes": 300
}
```

Only `name` is required. Limits: name 1–80; icon 1–40; target 0–10080. Errors: 409 duplicate name per user.

### `PATCH /subjects/:id`

Partial create fields plus `isActive: boolean`. Errors: 404; 409 duplicate name.

### `DELETE /subjects/:id`

Returns `{ deleted: true }`. Errors: 404; 409 if any owned task, timetable entry, or focus session references it. Deactivate instead.

## Tasks

All routes are protected and owner-filtered.

### `GET /tasks`

Optional query: `status=TODO|IN_PROGRESS|COMPLETED`, `subjectId=<ObjectId>`. Populates subject `name/color/icon`; sorts due date ascending then newest created.

### `GET /tasks/:id`

Returns one owned task with populated subject. Errors: 404.

### `POST /tasks`

Body: `title` required (1–160); optional `description` (max 2000), `subjectId`, `priority`, `estimatedMinutes` (1–10080), `dueAt` (ISO date). Errors: 400 if subject is absent/not owned.

### `PATCH /tasks/:id`

Partial create fields plus `status`. Status changes set `completedAt` when completed and clear it when moved to another explicit status. Errors: 404; 400 invalid relation/data.

### `POST /tasks/:id/complete`

No body. Sets `COMPLETED` and current `completedAt`. Errors: 404.

### `DELETE /tasks/:id`

Returns `{ deleted: true }`. Errors: 404.

## Timetable

All routes are protected and owner-filtered.

Entry body:

```json
{
  "subjectId": "ObjectId",
  "taskId": "optional ObjectId",
  "title": "Morning revision",
  "dayOfWeek": 1,
  "startTime": "09:00",
  "endTime": "09:50",
  "targetMinutes": 50,
  "isEnabled": true
}
```

`dayOfWeek` is 0–6; times are 24-hour `HH:mm`; target is 1–1440. End must be lexically/time-wise after start. Optional task must be owned and belong to selected subject.

### `GET /timetable`

Returns all entries with populated subject and task, sorted day then start time.

### `GET /timetable/:id`

Returns one owned populated entry. Errors: 404.

### `POST /timetable`

All fields except task and enabled are required. Errors: 400 invalid times/relations.

### `PATCH /timetable/:id`

Partial fields. `taskId: null` is accepted to clear the task. Revalidates existing task if subject changes. Errors: 404/400.

### `DELETE /timetable/:id`

Returns `{ deleted: true }`. Errors: 404.

Timetable entries never create focus sessions.

## Focus Sessions

All routes are protected and owner-filtered. See [FOCUS_ENGINE.md](FOCUS_ENGINE.md).

### `GET /focus-sessions`

Optional query `status=ACTIVE|PAUSED|COMPLETED|CANCELLED|EXPIRED`. Populates subject/task and sorts newest start first.

### `GET /focus-sessions/:id`

Returns one owned populated session. Errors: 404.

### `POST /focus-sessions`

Body fields are optional: `subjectId`, `taskId`, `plannedMinutes` (1–1440), `reminderIntervalMinutes` (1–240). Missing timing values use `userSettings` then 50/10 fallback. Creates `ACTIVE` with server `startedAt`. Errors: 400 invalid relation/task-subject mismatch; 409 another open session.

### `POST /focus-sessions/:id/pause`

`ACTIVE -> PAUSED`, setting server `pausedAt`. Errors: 404; 409 invalid transition.

### `POST /focus-sessions/:id/resume`

`PAUSED -> ACTIVE`, adds pending pause seconds to `totalPausedSeconds` and clears `pausedAt`.

### `POST /focus-sessions/:id/complete`

`ACTIVE|PAUSED -> COMPLETED`. Server sets end, consumes pending pause, computes `actualMinutes` and capped completion percentage.

### `POST /focus-sessions/:id/cancel`

`ACTIVE|PAUSED -> CANCELLED`; computes timing fields but cancelled sessions do not enter analytics.

### `POST /focus-sessions/:id/expire`

`ACTIVE -> EXPIRED` only, and only after `startedAt + plannedMinutes + accumulatedPausedSeconds`. A paused session cannot expire through this transition. Premature expiry: 409.

### `POST /focus-sessions/:id/distractions`

Body: `{ type: "PHONE"|"SOCIAL_MEDIA"|"MESSAGING"|"FATIGUE"|"OTHER", note?: string(max 500) }`. Allowed only while open. Appends an embedded event with server occurrence time and increments count. Errors: 404/409.

### `POST /focus-sessions/sync`

Idempotent offline snapshot endpoint.

Body:

```json
{
  "clientSessionId": "local-...",
  "subjectId": "optional ObjectId",
  "taskId": "optional ObjectId",
  "startedAt": "ISO date",
  "endedAt": "required for terminal status",
  "pausedAt": "required for PAUSED",
  "totalPausedSeconds": 0,
  "plannedMinutes": 25,
  "reminderIntervalMinutes": 10,
  "status": "ACTIVE",
  "distractions": [
    { "type": "OTHER", "note": "optional", "occurredAt": "ISO date" }
  ]
}
```

Behavior:

- validates ownership/relations
- rejects starts more than seven days old or over one minute in the future
- validates end/pause chronology and paused time
- requires end for terminal states
- derives `actualMinutes` and completion percentage
- upserts by `(userId, clientSessionId)`
- returns an existing terminal record unchanged on replay
- **does not** apply the normal pause/resume/complete/cancel/expire state machine for an existing open session; the last submitted payload can replace status
- a second offline open session with a different `clientSessionId` still collides with the one-open-session index
- there is no revision/merge/conflict clock; last write wins for open sessions
- distraction timestamps are not constrained to the session interval, and the array has no size cap

Errors: 400 timing/DTO/relation; 409 possible unique open-session conflict.

## Settings

Protected.

### `GET /settings`

Upserts defaults if absent. Returns settings plus user `name`, `email`, and `timezone`.

### `PATCH /settings`

Partial body:

- `name` 2–80
- `timezone` valid IANA name
- `defaultFocusMinutes` 1–1440
- `defaultReminderIntervalMinutes` one of 5/10/15/20/25/30
- `dailyStudyTargetMinutes` 1–1440
- `weeklyStudyTargetMinutes` 1–10080
- `minimumStreakMinutes` 1–1440
- `theme: DARK|LIGHT|SYSTEM`
- `soundEnabled`, `vibrationEnabled`, `notificationsEnabled`

Returns updated combined settings.

### `DELETE /settings/data`

Deletes the user's subjects, tasks, timetable entries, focus sessions, study goals, and settings; keeps the account (including credentials and refresh-token hash); recreates default settings. Response: `{ reset: true, settings }`. Deletions run in parallel without a MongoDB transaction, so a mid-reset failure can leave a partial wipe.

## Analytics

Protected; only `COMPLETED` sessions count. Dates use the user's timezone.

### `GET /analytics/overview?days=7|30|90`

Default 30. Returns today point, current-week/month totals, 400-day `totalMinutes`/`completedSessions`, streak, selected-range totals/averages, and timetable adherence.

### `GET /analytics/daily?date=<ISO date>`

Returns `{ date,minutes,sessions,distractions }`; default today.

### `GET /analytics/weekly?date=<ISO date>`

Requested date is the ending day; returns seven daily points and total.

### `GET /analytics/monthly?date=<ISO date>`

The query must be an ISO date such as `2026-08-01`; the service extracts its `YYYY-MM` prefix. Without it, the current month is used. Returns existing daily points, total and session count.

### `GET /analytics/subjects?days=7|30|90`

Default 30 because shared query DTO default overrides service's standalone 90 default. Returns grouped `{ subject|null, minutes, sessions }`.

### `GET /analytics/streak`

Returns `{ current,longest,minimumMinutes }` from up to 400 days.

### `GET /analytics/history?days=7|30|90`

Default 30. Returns a zero-filled daily point series, totals, and boundaries.

## Planned / Not Implemented APIs

- Dedicated `studyGoals` CRUD: schema exists, no routes.
- Dedicated dashboard aggregate endpoint: mobile composes existing endpoints.
- Paginated session history/detail API: list/get exist, no pagination contract.
- Push-token/backend notification API: intentionally not planned for local focus checkpoints.

## Current ID Validation Limitation

Ownership-safe but well-formed unknown ObjectIds normally return 404. Route parameters do not currently use an ObjectId validation pipe; a malformed value can cause a Mongoose `CastError` and the global filter currently reports it as 500 `INTERNAL_ERROR`. This should become a validated 400 contract in a future API-hardening change.

## Other Current API Limitations

- Lists are unpaginated.
- Task deletion does not cascade or block on timetable/focus references; dangling `taskId`s are possible.
- CORS is built by splitting `CORS_ORIGIN` into an array. The default `*` therefore becomes `["*"]`, which may not match the CORS package's special scalar `"*"` wildcard.
- Access tokens are not revoked on logout; JWT strategy trusts payload `sub` without reloading the user.
- POST action routes generally keep Nest's default HTTP 201 unless a route overrides it.
