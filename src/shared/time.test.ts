import { describe, expect, it } from 'vitest';
import { DAY, HOUR, MINUTE, roundToMinute } from './time';

describe('time', () => {
  it('defines unit constants in ms', () => {
    expect(MINUTE).toBe(60_000);
    expect(HOUR).toBe(3_600_000);
    expect(DAY).toBe(86_400_000);
  });

  it('rounds to the nearest minute', () => {
    expect(roundToMinute(Date.UTC(2026, 8, 15, 19, 0, 29, 999))).toBe(Date.UTC(2026, 8, 15, 19, 0));
    expect(roundToMinute(Date.UTC(2026, 8, 15, 19, 0, 30))).toBe(Date.UTC(2026, 8, 15, 19, 1));
  });
});
