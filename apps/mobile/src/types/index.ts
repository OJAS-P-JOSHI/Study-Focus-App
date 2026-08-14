export type FocusStatus = 'IDLE' | 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'CANCELLED';

export type FocusSession = {
  id: string;
  subjectId?: string;
  subjectName: string;
  task?: string;
  durationMinutes: number;
  reminderMinutes: number;
  devReminderOptIn?: boolean;
  status: FocusStatus;
  startedAt: number;
  endsAt: number;
  pausedAt?: number;
  totalPausedMs: number;
  completedAt?: number;
};

export type OfflineMutation = {
  id: string;
  method: 'post' | 'patch' | 'delete';
  path: string;
  body?: unknown;
  createdAt: number;
  attempts: number;
};

export type Subject = { id: string; name: string; color: string; weeklyMinutes: number };
export type StudyTask = { id: string; title: string; subject: string; done: boolean; due?: string };
