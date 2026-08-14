import { FocusSessionStatus } from './enums';
import { assertFocusTransition, calculateActualMinutes } from './focus-state';
import { ConflictException } from '@nestjs/common';

describe('focus session state machine', () => {
  it.each([
    [FocusSessionStatus.ACTIVE, 'pause'],
    [FocusSessionStatus.ACTIVE, 'complete'],
    [FocusSessionStatus.ACTIVE, 'cancel'],
    [FocusSessionStatus.PAUSED, 'resume'],
    [FocusSessionStatus.PAUSED, 'complete'],
    [FocusSessionStatus.PAUSED, 'cancel'],
  ] as const)('allows %s -> %s', (status, transition) => {
    expect(() => assertFocusTransition(status, transition)).not.toThrow();
  });

  it.each([
    [FocusSessionStatus.ACTIVE, 'resume'],
    [FocusSessionStatus.PAUSED, 'pause'],
    [FocusSessionStatus.COMPLETED, 'resume'],
    [FocusSessionStatus.CANCELLED, 'complete'],
    [FocusSessionStatus.EXPIRED, 'cancel'],
  ] as const)('rejects %s -> %s', (status, transition) => {
    expect(() => assertFocusTransition(status, transition)).toThrow(
      ConflictException,
    );
  });

  it('subtracts accumulated and pending pauses from actual minutes', () => {
    const started = new Date('2026-08-14T10:00:00Z');
    const ended = new Date('2026-08-14T11:00:00Z');
    const currentlyPausedSince = new Date('2026-08-14T10:50:00Z');

    expect(
      calculateActualMinutes(started, ended, 5 * 60, currentlyPausedSince),
    ).toBe(45);
  });

  it('never returns negative minutes', () => {
    const started = new Date('2026-08-14T10:00:00Z');
    const ended = new Date('2026-08-14T10:01:00Z');
    expect(calculateActualMinutes(started, ended, 120)).toBe(0);
  });
});
