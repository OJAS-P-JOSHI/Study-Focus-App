export type PlannedReminder = {
  identifier: string;
  firesAt: number;
};

export type ScheduledReminder = {
  identifier: string;
  data?: Record<string, unknown>;
};

export function buildReminderPlan(
  sessionId: string,
  now: number,
  endsAt: number,
  intervalMinutes: number,
): PlannedReminder[] {
  if (!sessionId || intervalMinutes <= 0 || endsAt <= now) return [];

  const intervalMs = intervalMinutes * 60_000;
  const reminders: PlannedReminder[] = [];
  for (let firesAt = now + intervalMs; firesAt < endsAt; firesAt += intervalMs) {
    reminders.push({
      identifier: `focus-${sessionId}-${firesAt}`,
      firesAt,
    });
  }
  return reminders;
}

export function focusReminderIds(
  scheduled: ScheduledReminder[],
  sessionId?: string,
): string[] {
  return scheduled
    .filter(
      (reminder) =>
        reminder.data?.kind === 'focus-reminder' &&
        (!sessionId || reminder.data.sessionId === sessionId),
    )
    .map((reminder) => reminder.identifier);
}
