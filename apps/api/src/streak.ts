export interface StreakResult {
  current: number;
  longest: number;
}

export function shiftDateKey(key: string, days: number): string {
  const date = new Date(`${key}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function calculateStreak(
  minutesByDay: Record<string, number>,
  minimumMinutes: number,
  today: string,
): StreakResult {
  const qualified = new Set(
    Object.entries(minutesByDay)
      .filter(([, minutes]) => minutes >= minimumMinutes)
      .map(([day]) => day),
  );
  let cursor = qualified.has(today) ? today : shiftDateKey(today, -1);
  let current = 0;
  while (qualified.has(cursor)) {
    current += 1;
    cursor = shiftDateKey(cursor, -1);
  }

  let longest = 0;
  let run = 0;
  let previous: string | undefined;
  for (const day of [...qualified].sort()) {
    run = previous && shiftDateKey(previous, 1) === day ? run + 1 : 1;
    longest = Math.max(longest, run);
    previous = day;
  }
  return { current, longest };
}
