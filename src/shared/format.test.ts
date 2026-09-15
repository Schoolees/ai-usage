import { describe, expect, it } from 'vitest';
import { formatDuration, formatPercent, formatReset } from './format';

const now = Date.UTC(2026, 8, 15, 17, 0); // Tue 15 Sep 2026, 17:00 UTC

describe('formatReset', () => {
  it('uses relative text under 24 hours', () => {
    expect(formatReset(now + 2 * 3_600_000 + 8 * 60_000, now)).toBe('Resets in 2 hr 8 min');
    expect(formatReset(now + 3 * 3_600_000, now)).toBe('Resets in 3 hr');
    expect(formatReset(now + 45 * 60_000, now)).toBe('Resets in 45 min');
    expect(formatReset(now + 20_000, now)).toBe('Resets in 1 min');
  });

  it('uses weekday and time at 24 hours or more', () => {
    expect(formatReset(Date.UTC(2026, 8, 21, 13, 0), now, 'UTC')).toBe('Resets Mon 1:00 PM');
  });

  it('says the window reset once the time has passed', () => {
    expect(formatReset(now - 1, now)).toBe('Reset since last seen');
  });

  it('returns an empty string without a reset time', () => {
    expect(formatReset(null, now)).toBe('');
  });
});

describe('formatDuration', () => {
  it.each([
    [10_000, '<1 min'],
    [5 * 60_000, '5 min'],
    [3 * 3_600_000 + 59 * 60_000, '3 hr'],
    [26 * 3_600_000, '1 day'],
    [4 * 86_400_000, '4 days'],
  ])('%i ms → %s', (ms, text) => {
    expect(formatDuration(ms)).toBe(text);
  });
});

describe('formatPercent', () => {
  it('rounds to a whole percent', () => {
    expect(formatPercent(72.6)).toBe('73%');
  });
});
