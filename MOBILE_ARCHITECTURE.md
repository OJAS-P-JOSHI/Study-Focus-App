# Mobile Architecture

Root: `apps/mobile`. Expo display name: **Stillpoint Study Focus**. Source aliases use `@/* -> src/*`.

## Routing

Expo Router reads `src/app`.

- `_layout.tsx` — root providers, auth initialization, notification initialization, queue flush/reconnect, focus/notification reconciliation, stack configuration.
- `index.tsx` — waits for auth/focus hydration then redirects to auth, tabs, or active focus.
- `(auth)/_layout.tsx` — redirects authenticated identities to tabs.
- `(auth)/login.tsx` — login and continue-offline entry.
- `(auth)/register.tsx` — registration.
- `(tabs)/_layout.tsx` — protected tabs and icon mapping.
- `(tabs)/index.tsx` — live dashboard.
- `(tabs)/subjects.tsx` — subject CRUD.
- `(tabs)/timetable.tsx` — recurring timetable CRUD/status.
- `(tabs)/stats.tsx` — real analytics.
- `(tabs)/settings.tsx` — profile/goals/defaults/preferences/reset/logout.
- `tasks.tsx` — task CRUD/filtering.
- `focus/start.tsx` — focus configuration.
- `focus/active.tsx` — timer, transitions, reminder status, distraction recovery.
- `focus/summary.tsx` — last completed-session summary.

Auth and tab layouts use redirects as navigation guards. The root `/` route restores an active session after app restart. Direct deep links to `/focus/*` and `/tasks` have **no local auth redirect**; API 401s still apply, but the screens can render before auth is ready.

## Root Runtime

`src/app/_layout.tsx` creates a TanStack `QueryClient` (`retry: 1`, `staleTime: 30s`) and initializes:

1. auth token/user restoration
2. Android notification channel/foreground handler
3. persisted focus store hydration
4. offline sync callback/local-to-remote ID mapping
5. offline queue flush
6. focus and notification reconciliation
7. NetInfo reconnect queue flush
8. AppState foreground notification reconciliation

The Query cache is memory-only and is not persisted.

## Shared UI and Design

- `src/components/ui.tsx`: `Screen`, `Card`, `Button`, `Field`, `Chip`, `Heading`, `Metric`, typography helpers.
- `src/constants/design.ts`: dark palette, spacing/radius/type tokens.

The app is currently dark-first. Although `theme` is persisted in settings, UI tokens do not switch dynamically.

## Stores

### `stores/auth-store.ts`

Zustand, not persisted as a store.

Responsibilities:

- initialize from SecureStore access token
- call `/auth/me`
- register/login and save tokens
- create a local-mode pseudo-user
- call logout then clear tokens/local-mode marker
- receive global refresh failure callback

SecureStore keys:

- `study-focus.access-token`
- `study-focus.refresh-token`
- `study-focus.local-mode`

Limitations:

- Logout/auth failure does not itself clear the focus store, offline queue, scheduled notifications, or TanStack Query cache.
- `GET /auth/me` failure during initialize, including a transient network error, currently clears tokens and signs the user out.
- Continue-offline is a device flag plus a synthetic user `{ id: "local", name: "Focused learner", email: "offline@local" }`. It is not a real API identity.

### `stores/focus-store.ts`

Zustand with `persist`/AsyncStorage key `@study-focus/focus-store/v1`.

Persisted fields: `session`, `lastCompleted`. Runtime actions:

- `start`, `pause`, `resume`, `complete`, `cancel`, `expire`
- `logDistraction`
- `reconcile`
- `resetLocal`
- `markSynced`

`fromApi` converts server seconds/dates/populated relations into mobile millisecond timestamps and labels. `getRemainingMs` derives time from `endsAt`, freezing at `pausedAt` while paused.

Network errors (`AxiosError` with no response) apply a local transition and queue mutation/snapshot. HTTP errors remain authoritative and are surfaced.

## Services

### `services/api.ts`

- base URL: `EXPO_PUBLIC_API_URL`, fallback `http://localhost:3000/api/v1`
- 10-second timeout
- request interceptor reads access token from SecureStore
- response interceptor handles one 401 retry
- a shared promise prevents simultaneous refresh storms
- refresh failure clears tokens and resets auth state
- `flushOfflineQueue` replays sequentially and stops at first failure
- successful focus snapshot response maps local entity ID to remote ID

Physical devices cannot use the fallback `localhost`; set `EXPO_PUBLIC_API_URL` to the development computer's LAN URL.

### `services/resources.ts`

Typed API facade for subjects, tasks, focus sessions/distractions, timetable, settings, and analytics. It unwraps `{ success:true,data }`. These types are mobile-local rather than generated from OpenAPI.

### `services/offline-queue.ts`

AsyncStorage key `@study-focus/offline-queue/v1`.

- append ordinary queued mutations
- upsert one focus-session snapshot by `localEntityId`
- replace queue after replay

Important limits: queue operations are read-modify-write, queue entries are not user-scoped, attempts are counted but not capped/dead-lettered, and one permanent failure blocks later entries.

### `services/notification-plan.ts`

Pure deterministic helpers:

- `buildReminderPlan(sessionId, now, endsAt, intervalMinutes)`
- `focusReminderIds(scheduled, sessionId?)`

Identifiers are `focus-${sessionId}-${firesAt}`. Plans exclude the exact session end.

### `services/notification-service.ts`

Owns permission, Android channel, scheduling, cancellation, persisted schedule record, status, duplicate detection, startup/foreground reconciliation. See `NOTIFICATIONS.md`.

### `services/timetable-status.ts`

Pure status classification. A completed plan match requires a completed same-subject session started on the same local date within the plan window. This client classification is display behavior; server analytics independently computes adherence.

## Screens and Data Dependencies

- Dashboard queries analytics overview (30 days), settings, timetable, all focus sessions, TODO tasks.
- Subjects queries/mutates `/subjects`.
- Tasks queries/mutates `/tasks`; filters by status/subject.
- Timetable queries timetable, subjects, tasks, and sessions.
- Stats queries overview/history/subjects for selected 7/30/90 days.
- Settings queries/updates settings and resets all server/local study data.
- Focus start queries subjects/tasks/settings.
- Focus active acts through the focus store and notification service.

Mutations generally invalidate relevant query keys, but there is no centralized domain cache policy.

## Local Persistence

| Data | Storage |
|---|---|
| Access/refresh tokens | SecureStore |
| Local-mode marker | SecureStore |
| Active/last completed focus snapshot | AsyncStorage via Zustand |
| Offline mutation queue | AsyncStorage |
| Notification schedule record | AsyncStorage |
| TanStack server cache | memory only |

## Validation Reality

`react-hook-form` and `zod` are used on **login and register only**, via `useForm` plus manual `schema.safeParse`. There is no `@hookform/resolvers`/`zodResolver`. Settings, subjects, tasks, and timetable forms use `useState` and backend DTO errors. Login password client min is 6 characters; registration/API min is 8.

`weeklyStudyTargetMinutes` is persisted and editable in Settings, but no other mobile/API consumer currently displays weekly-goal progress; dashboard progress uses the daily target.

## Important Mobile Invariants

- Timer displays derive from timestamps.
- Closing/pausing a session cancels local reminders.
- Resume schedules only reminders before the adjusted end.
- A non-network API error must not silently become an offline success.
- Timetable cards never create sessions automatically.
- Dashboard and stats must render persisted API data, not `sample-data.ts`.

## Known Mobile Gaps

- `src/data/sample-data.ts` still exists but core dashboard/timetable/stats no longer use it.
- `@study-focus/shared` and `@study-focus/config` exist but apps do not import them.
- `app.json` references `assets/images/*` while only `assets/expo.icon/` exists; native icon export may fail.
- Local mode cannot bootstrap subjects on a fresh install.
- `/focus/*` and `/tasks` have no local auth redirect.
- Offline queue/auth data is not account-scoped or cleared by ordinary logout.
- Stored theme/sound/vibration/notification flags are not comprehensively applied.
- Dashboard greeting is hardcoded; zero daily target can yield `NaN` progress.
- No mobile component/store test runner exists; only two Node scripts test pure notification/timetable logic.
- Accessibility and screen-level error/empty-state polish remain incomplete.
