import assert from 'node:assert/strict';

import {
  buildReminderPlan,
  focusReminderIds,
} from '../src/services/notification-plan.ts';

const minute = 60_000;
const first = buildReminderPlan('session-123', 1_000, 1_000 + 25 * minute, 10);
assert.deepEqual(
  first.map(({ firesAt }) => firesAt),
  [1_000 + 10 * minute, 1_000 + 20 * minute],
);
assert.ok(first.every(({ identifier }) => identifier.includes('session-123')));
assert.deepEqual(first, buildReminderPlan('session-123', 1_000, 1_000 + 25 * minute, 10));

const resumed = buildReminderPlan('session-123', 1_000 + 12 * minute, 1_000 + 35 * minute, 10);
assert.equal(resumed.length, 2);
assert.equal(buildReminderPlan('session-123', 10_000, 10_000, 10).length, 0);
assert.equal(buildReminderPlan('session-123', 10_000, 20_000, 0).length, 0);

const scheduled = [
  { identifier: 'one', data: { kind: 'focus-reminder', sessionId: 'session-123' } },
  { identifier: 'two', data: { kind: 'focus-reminder', sessionId: 'session-456' } },
  { identifier: 'unrelated', data: { kind: 'calendar' } },
];
assert.deepEqual(focusReminderIds(scheduled, 'session-123'), ['one']);
assert.deepEqual(focusReminderIds(scheduled), ['one', 'two']);

console.log('Notification scheduling and cancellation plan tests passed');
