import type { ApiFocusSession, ApiTimetableEntry } from '@/services/resources';

export type TimetableStatus =
  | 'CURRENT'
  | 'NEXT'
  | 'MISSED'
  | 'COMPLETED'
  | 'PLANNED'
  | 'DISABLED';

const minutes = (value: string) => {
  const [hour, minute] = value.split(':').map(Number);
  return hour * 60 + minute;
};

const relationId = (value: { id: string } | string | undefined) =>
  typeof value === 'object' ? value.id : value;

export function timetableStatus(
  entry: ApiTimetableEntry,
  sessions: ApiFocusSession[],
  now: Date,
  isNext = false,
): TimetableStatus {
  if (!entry.isEnabled) return 'DISABLED';
  if (entry.dayOfWeek !== now.getDay()) return 'PLANNED';

  const completed = sessions.some((session) => {
    if (session.status !== 'COMPLETED') return false;
    const started = new Date(session.startedAt);
    return (
      relationId(session.subjectId) === relationId(entry.subjectId) &&
      started.toDateString() === now.toDateString() &&
      started.getHours() * 60 + started.getMinutes() >= minutes(entry.startTime) &&
      started.getHours() * 60 + started.getMinutes() < minutes(entry.endTime)
    );
  });
  if (completed) return 'COMPLETED';

  const current = now.getHours() * 60 + now.getMinutes();
  if (current >= minutes(entry.startTime) && current < minutes(entry.endTime)) {
    return 'CURRENT';
  }
  if (current >= minutes(entry.endTime)) return 'MISSED';
  return isNext ? 'NEXT' : 'PLANNED';
}
