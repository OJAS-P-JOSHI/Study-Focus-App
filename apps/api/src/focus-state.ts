import { ConflictException } from '@nestjs/common';
import { FocusSessionStatus } from './enums';

type Transition = 'pause' | 'resume' | 'complete' | 'cancel' | 'expire';

const transitions: Record<FocusSessionStatus, readonly Transition[]> = {
  ACTIVE: ['pause', 'complete', 'cancel', 'expire'],
  PAUSED: ['resume', 'complete', 'cancel'],
  COMPLETED: [],
  CANCELLED: [],
  EXPIRED: [],
};

export function assertFocusTransition(
  status: FocusSessionStatus,
  transition: Transition,
): void {
  if (!transitions[status].includes(transition)) {
    throw new ConflictException(
      `Cannot ${transition} a ${status.toLowerCase()} session`,
    );
  }
}

export function calculateActualMinutes(
  startedAt: Date,
  endedAt: Date,
  totalPausedSeconds: number,
  pausedAt?: Date | null,
): number {
  const pendingPause = pausedAt
    ? Math.max(0, (endedAt.getTime() - pausedAt.getTime()) / 1000)
    : 0;
  const elapsedSeconds = Math.max(
    0,
    (endedAt.getTime() - startedAt.getTime()) / 1000 -
      totalPausedSeconds -
      pendingPause,
  );
  return Math.floor(elapsedSeconds / 60);
}
