# Product Specification — Current Repository

Statuses: **Implemented**, **Partial**, **Planned**, **Out of scope**. This describes current code, not an aspirational backlog.

## Authentication — Implemented

- **Purpose:** identify a private owner for all durable study data.
- **User behavior:** register with name/email/password; login; session restores from secure tokens; logout.
- **Frontend:** auth screens, SecureStore token storage, Axios Bearer injection/refresh retry, auth/tab redirects. “Continue offline” is a device flag plus a synthetic user `{ id: "local" }`, not a real API identity.
- **Backend:** bcrypt cost 12, JWT access/refresh types, hashed refresh token, rotation on refresh, revocation on logout, `JwtAuthGuard`.
- **Data:** `users`; one `userSettings` record is created during registration.
- **Edges:** duplicate email 409; invalid credentials/token 401; one stored refresh-token hash means a new login/refresh replaces the previous refresh token.

## Onboarding — Partial

Registration/login and “continue offline” exist. There is no guided subject/goal/permission onboarding sequence. Fresh local mode has no persisted subject catalog, so it cannot currently start a useful session unless required data was already available; see `KNOWN_ISSUES.md`.

## Dashboard — Implemented

- **Purpose:** answer “what should I study next?” and expose current progress.
- **Frontend:** current local session, default duration, daily goal progress, sessions/streak, current/next timetable plan, TODO tasks, recent completed sessions, pull-to-refresh.
- **Backend/data:** composes settings, analytics, timetable, tasks and focus-session endpoints; no dedicated dashboard endpoint.
- **Edges:** partial endpoint failure displays a shared warning; values are real API data, not samples. Greeting is currently hardcoded “Good afternoon”. Daily-target progress can be `NaN` if the stored daily target is 0. Weekly target is stored in settings but not shown as dashboard weekly-goal progress.

## Subjects — Implemented

CRUD for name, description, color, icon, weekly target and active state. Names are unique per user. A subject with related task/timetable/session data cannot be deleted; deactivate it instead.

## Tasks — Implemented

CRUD, subject association, priority (`LOW|MEDIUM|HIGH`), status (`TODO|IN_PROGRESS|COMPLETED`), estimate, due date and explicit completion. List filters support status and subject. Ownership and subject ownership are enforced.

## Timetable — Implemented

- Weekly recurring entries: subject, optional task, title, Sunday=0 through Saturday=6, `HH:mm` start/end, target minutes, enabled state.
- Mobile supports create/edit/enable/delete and derived `CURRENT/NEXT/MISSED/COMPLETED/PLANNED/DISABLED` labels.
- Backend requires end after start and task/subject consistency.
- Entries are plans and do not create focus sessions.
- Adherence counts past enabled plan occurrences matched by a completed session of the same subject whose start falls in the window.

## Focus Sessions — Implemented

Start, list/get, pause, resume, complete, cancel, expire, distraction log, and idempotent offline sync. Defaults come from user settings. At most one open server session exists per user. See `FOCUS_ENGINE.md`.

## Distraction Recovery — Implemented with limited capture

The active screen's **I GOT DISTRACTED** action logs an `OTHER` event, increments the count, and shows a non-judgmental return modal with the selected work. The backend supports five types and an optional note, but the current mobile UI does not expose type/note selection. An app-background recovery prompt is UI behavior, not automatically a persisted distraction event.

## Notifications — Implemented; native delivery unverified

Permission, Android channel, deterministic plans, scheduling, cancellation, status, duplicate prevention, startup/foreground reconciliation, production intervals, and a dev-only one-minute option exist. Native Android delivery has not been tested because no device/emulator is available. See `NOTIFICATIONS.md`.

## Session History — Partial

Focus sessions are listable through the API. Dashboard shows three recent completed sessions; analytics shows daily history. There is no dedicated paginated history/detail screen.

## Analytics — Implemented

Completed sessions only. Dashboard overview, daily/weekly/monthly points, 7/30/90 history, subject distribution, average session duration/distractions, streak, and timetable adherence are server-derived. The overview's `totalMinutes` and `completedSessions` are based on the service's 400-day load window despite their broad names.

## Goals — Implemented through settings; studyGoals API not implemented

Daily target and streak threshold in `userSettings` drive dashboard progress. `weeklyStudyTargetMinutes` is persisted and editable in Settings but has no other app readers. `studyGoals` is a real schema seeded with daily/weekly records but has no controller/service/mobile client and does not drive progress.

## Streaks — Implemented

A day qualifies when completed-session actual minutes meet `minimumStreakMinutes`. Current streak includes today if qualified, otherwise starts from yesterday, so an unfinished current day does not prematurely break it. Longest streak is calculated over loaded daily data (currently up to 400 days).

## Settings — Partial runtime application

Profile name, timezone, daily/weekly targets, streak threshold, focus/reminder defaults, notification/sound/vibration booleans, and theme are persisted. Logout and account-data reset exist. Focus/reminder defaults and timezone/targets are consumed. Theme remains visually dark; sound/vibration are not wired into scheduled notification content/channel; `notificationsEnabled` does not yet gate every future schedule.

## Offline Behavior — Partial / bounded

- Active session and last summary persist in AsyncStorage.
- Local transitions update timestamps and queue work.
- Unsynced local sessions use a replacement snapshot and idempotent `/focus-sessions/sync`.
- Queue flush occurs after hydration/startup and reconnect.
- Notifications continue through the native scheduler.
- Subjects/tasks/settings/query cache are not persisted, and the queue is not user-scoped. This is not full offline-first support.

## Out of Scope

System-wide app blocking, AI coaching, social/leaderboard systems, fake focus generation from timetable plans, and backend cron reminders.
