import assert from 'node:assert/strict';

import type { ApiFocusSession, ApiTimetableEntry } from '../src/services/resources.ts';
import { timetableStatus } from '../src/services/timetable-status.ts';

const now = new Date(2026, 7, 17, 10, 0);
const entry: ApiTimetableEntry = {
  id: 'entry',
  subjectId: 'subject',
  title: 'Study',
  dayOfWeek: now.getDay(),
  startTime: '09:30',
  endTime: '10:30',
  targetMinutes: 60,
  isEnabled: true,
};

assert.equal(timetableStatus(entry, [], now), 'CURRENT');
assert.equal(
  timetableStatus({ ...entry, startTime: '11:00', endTime: '12:00' }, [], now, true),
  'NEXT',
);
assert.equal(
  timetableStatus({ ...entry, startTime: '08:00', endTime: '09:00' }, [], now),
  'MISSED',
);

const completed: ApiFocusSession = {
  id: 'session',
  subjectId: 'subject',
  startedAt: new Date(2026, 7, 17, 9, 45).toISOString(),
  endedAt: new Date(2026, 7, 17, 10, 15).toISOString(),
  totalPausedSeconds: 0,
  plannedMinutes: 30,
  actualMinutes: 30,
  reminderIntervalMinutes: 10,
  status: 'COMPLETED',
  completionPercentage: 100,
  distractionCount: 0,
};
assert.equal(timetableStatus(entry, [completed], now), 'COMPLETED');
assert.equal(timetableStatus({ ...entry, isEnabled: false }, [], now), 'DISABLED');

console.log('Timetable status tests passed');
