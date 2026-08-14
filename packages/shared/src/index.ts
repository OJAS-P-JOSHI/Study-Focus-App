export const FOCUS_DEFAULTS = {
  focusMinutes: 50,
  reminderIntervalMinutes: 10,
  dailyTargetMinutes: 180,
  weeklyTargetMinutes: 1260,
  minimumStreakMinutes: 30,
} as const;

export const REMINDER_INTERVALS = [5, 10, 15, 20, 25, 30] as const;

export type ReminderInterval = (typeof REMINDER_INTERVALS)[number];
export type FocusSessionStatus =
  | 'ACTIVE'
  | 'PAUSED'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'EXPIRED';

export interface ApiSuccess<T> {
  success: true;
  data: T;
}

export interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
  };
}
