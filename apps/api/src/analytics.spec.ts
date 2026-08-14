import { calculateStreak } from './streak';

describe('calculateStreak', () => {
  it('counts a current streak ending today', () => {
    expect(
      calculateStreak(
        {
          '2026-08-12': 30,
          '2026-08-13': 45,
          '2026-08-14': 60,
        },
        30,
        '2026-08-14',
      ),
    ).toEqual({ current: 3, longest: 3 });
  });

  it('keeps a current streak alive when today is not yet qualified', () => {
    expect(
      calculateStreak(
        {
          '2026-08-10': 30,
          '2026-08-11': 30,
          '2026-08-13': 30,
          '2026-08-14': 10,
        },
        30,
        '2026-08-14',
      ),
    ).toEqual({ current: 1, longest: 2 });
  });

  it('uses the configured threshold and ignores gaps', () => {
    expect(
      calculateStreak(
        {
          '2026-08-10': 59,
          '2026-08-11': 60,
          '2026-08-12': 60,
          '2026-08-14': 60,
        },
        60,
        '2026-08-14',
      ),
    ).toEqual({ current: 1, longest: 2 });
  });
});
