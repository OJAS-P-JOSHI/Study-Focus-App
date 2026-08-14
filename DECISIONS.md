# Architectural and Product Decisions

This file records why the current architecture exists. Change these decisions deliberately, with migration and test plans—not as incidental refactoring.

## MongoDB instead of PostgreSQL

**Decision:** Use MongoDB (`studyapp` locally) through Mongoose.

**Why:** The domain is account-owned documents with straightforward references, a naturally embedded `distractions[]` event list, evolving settings/session shapes, and analytics MongoDB can satisfy with aggregation pipelines. It supports rapid iteration and the developer's chosen local Compass workflow. PostgreSQL was initially considered because relational constraints and reporting are strong, but it was deliberately rejected before domain implementation. Reintroducing it would add an unnecessary data layer migration and dual mental model.

## Mongoose instead of Prisma

**Decision:** Mongoose schemas and Nest integration define persistence.

**Why:** Mongoose directly expresses MongoDB references, embedded distraction subdocuments, partial unique indexes, schema defaults, and aggregation. Prisma had been associated with the abandoned PostgreSQL architecture. There is no Prisma schema or migration history to preserve.

## Mobile local notifications instead of backend cron

**Decision:** Active-session checkpoints use `expo-notifications` scheduled on the device.

**Why:** Reminders must survive temporary network/API loss, are derived from the device's active-session state, and must be canceled immediately on pause/close. Backend cron would require push-token infrastructure, delivery services, background jobs, and network availability for a behavior the OS scheduler already provides. The backend persists `reminderIntervalMinutes` but does not schedule reminders.

## Timestamp-based timer

**Decision:** `startedAt`, `pausedAt`, accumulated paused time, and `endedAt` are time sources; a JavaScript interval only refreshes UI.

**Why:** Mobile JavaScript may pause in the background or when the process is suspended. Counting ticks would drift and over/under-report study. The server recomputes `actualMinutes` from timestamps and does not accept it as an online completion input.

## Embedded distractions

**Decision:** Store distraction events inside `focusSessions.distractions[]` and denormalize `distractionCount`.

**Why:** A distraction has no independent lifecycle, is always owned/read with one session, and event volume is bounded by a session. Embedding avoids a collection join while the count supports cheap analytics.

## One open server session per user

**Decision:** A partial unique index and service check prevent multiple `ACTIVE`/`PAUSED` sessions.

**Why:** The product represents one current accountability commitment. Multiple open sessions would make timers, notifications, offline reconciliation, and analytics ambiguous.

## Timetable entries are plans

**Decision:** Recurring timetable entries never auto-create focus sessions.

**Why:** Planned time is not evidence of behavior. Only an explicit start creates a session; only completed persisted sessions count as study. Adherence compares real starts with plan windows.

## Bounded offline focus sync

**Decision:** Persist the current focus session and queue an idempotent snapshot; do not make the entire app offline-first.

**Why:** The active core loop must survive connectivity loss, but general offline CRUD/conflict resolution would substantially increase complexity. The server accepts offline starts only within seven days and validates all timestamps.

## Goals currently live in user settings

**Decision:** Dashboard daily/weekly targets and streak minimum come from `userSettings`.

**Why:** They are single current preferences. A `studyGoals` schema and seed records exist, but no goals controller/service consumes them. Do not describe the collection as an active goals API until that discrepancy is resolved.

## No system-wide app blocking in V1

**Decision:** Do not add Android accessibility/VPN/device-admin blocking now.

**Why:** It requires platform-specific permissions, policy review, native maintenance, and careful safety UX. The current product focuses on accountability and recovery.

## No AI in V1

**Decision:** No chatbot, recommendation model, or generated plan is in the core scope.

**Why:** Reliable start/remind/return/finish/measure behavior must be proven before adding probabilistic features, cost, privacy exposure, and product distraction.

## No social or gamification-heavy system

**Decision:** Keep progress private and factual; avoid leaderboards, public streak pressure, points, and juvenile rewards.

**Why:** The target experience is calm and mature. Streaks are consistency feedback, not a social status system.

## Dark-first presentation

**Decision:** Current UI is dark-first with shared palette constants.

**Why:** It supports a calm low-distraction identity. A theme preference is stored but not yet applied dynamically; that is a known implementation gap, not evidence of a multi-theme runtime.
