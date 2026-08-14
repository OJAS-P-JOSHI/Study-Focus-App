# Project Context

## Product Name

Study Focus App (the Expo display name is **Stillpoint Study Focus**).

## Problem

A student intends to study, starts using a phone for legitimate work, and is then pulled into unrelated activity. Ordinary timers measure elapsed wall-clock time but do not create a reliable return-to-task loop. Study Focus App creates an explicit accountability session around a chosen subject/task, reminds the student locally while the session is active, makes distraction recovery non-punitive, and records real focused minutes.

## Product Philosophy

- Reduce distraction without pretending the phone can be eliminated.
- Make starting a session fast and concrete.
- Measure actual behavior from timestamps, not optimistic plans.
- Make recovery after distraction easier than abandoning the session.
- Prefer a calm, dark-first, mature interface over childish rewards.
- Prefer reliable core behavior over feature count.
- Keep analytics factual: persisted completed sessions only.
- Keep timetable entries as plans; never manufacture study history from them.

## Target User

Students who have difficulty maintaining concentration and want structured, private study accountability. The current product is single-user-per-account and does not include social competition, classrooms, or public profiles.

## Core Product Loop

1. The user signs in and chooses a subject, optional task, planned duration, and reminder interval.
2. The app creates an `ACTIVE` focus session. The API persists it when online; the mobile store persists a local snapshot when offline.
3. The mobile app schedules native local reminders for checkpoints before the planned end.
4. The timer UI derives remaining time from timestamps. Backgrounding or suspending JavaScript does not become the source of time.
5. The user can pause/resume, record a distraction, return to work, complete, cancel, or allow the session to expire.
6. After a successful or locally accepted pause/close transition, scheduled reminders are removed; resume creates a fresh remaining schedule. Reconciliation also cleans stale reminders. A non-network server transition error can leave the prior schedule until reconciliation.
7. The backend calculates authoritative actual minutes from start/end/pause timestamps.
8. Completed persisted sessions feed dashboard progress, streaks, history, subject distribution, and timetable adherence.

This loop is the product. Features that do not strengthen it are lower priority.

## Implemented

- Email/password registration and login.
- JWT access/refresh token flow, refresh rotation, revocation on logout, SecureStore token storage, protected routing.
- Subject CRUD, activation/deactivation, weekly target field, and deletion protection when related data exists.
- Task CRUD, priorities/status/due dates, completion, subject filtering.
- Recurring weekly timetable CRUD, enabled state, optional task, and mobile status labels.
- Focus session state machine: `ACTIVE`, `PAUSED`, `COMPLETED`, `CANCELLED`, `EXPIRED`.
- One open (`ACTIVE`/`PAUSED`) server session per user.
- Embedded distraction events and a mobile recovery action.
- Local notification permission, Android channel, scheduling, cancellation, duplicate prevention, status, startup/foreground reconciliation.
- Dashboard backed by API data.
- 7/30/90-day analytics, streaks, subject distribution, averages, and timetable adherence.
- Profile/settings UI, daily/weekly targets, focus/reminder defaults, timezone, logout, and data reset.
- Persisted local focus state and idempotent offline session snapshot sync on startup/reconnect.
- CI for install, typecheck, API tests, and API build.

## Planned / Next

- Core UX/accessibility and empty-state polish.
- User-scoped, resilient offline queue handling and better conflict/dead-letter behavior.
- Persisted/cached subjects for a genuinely useful fresh-install offline mode.
- Apply stored theme, sound, vibration, and notification preferences throughout runtime behavior.
- More mobile/store/integration/e2e tests.
- Physical-device Android notification acceptance testing.
- A fuller session-history/detail experience.

## Explicitly Out of Scope for V1

- System-wide app blocking or accessibility-service enforcement.
- AI coaching, generated plans, or chatbot features.
- Social feeds, leaderboards, competitive gamification, and public profiles.
- Backend cron/push infrastructure for active-session checkpoints.
- Automatic creation of focus sessions from timetable entries.

## Product Invariants

- A user may only access resources owned by that authenticated user.
- Terminal focus sessions never return to an open state.
- After an accepted pause/completion/cancellation/expiry, notifications must be canceled; reconciliation is the safety net for stale schedules.
- Server timestamps, not client-provided `actualMinutes`, determine authoritative study time.
- Timetable entries are plans, not evidence of studying.
- Analytics uses completed persisted sessions, never placeholders.
- Production reminder default is 10 minutes.
