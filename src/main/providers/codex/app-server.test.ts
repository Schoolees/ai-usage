import { describe, expect, it } from 'vitest';
import { parseRateLimitsResponse } from './app-server';

describe('parseRateLimitsResponse', () => {
  it('parses the current camelCase app-server response', () => {
    expect(
      parseRateLimitsResponse(
        {
          rateLimits: {
            planType: 'plus',
            primary: { usedPercent: 17, windowDurationMins: 300, resetsAt: 1789979290 },
            secondary: { usedPercent: 82, windowDurationMins: 10080, resetsAt: 1790059346 },
          },
        },
        1_000,
      ),
    ).toEqual({
      timestampMs: 1_000,
      planType: 'plus',
      primary: { usedPercent: 17, windowMinutes: 300, resetsAtSec: 1789979290 },
      secondary: { usedPercent: 82, windowMinutes: 10080, resetsAtSec: 1790059346 },
    });
  });

  it('accepts snake_case responses for compatibility with older servers', () => {
    expect(
      parseRateLimitsResponse(
        { rate_limits: { plan_type: 'pro', primary: { used_percent: 3, window_minutes: 10080 }, secondary: null } },
        2_000,
      ),
    ).toMatchObject({ timestampMs: 2_000, planType: 'pro', primary: { usedPercent: 3, windowMinutes: 10080 } });
  });

  it('prefers the explicit codex bucket when multiple buckets are returned', () => {
    expect(
      parseRateLimitsResponse(
        {
          rateLimits: { primary: { usedPercent: 0, windowDurationMins: 300 } },
          rateLimitsByLimitId: {
            premium: { primary: { usedPercent: 0, windowDurationMins: 300 } },
            codex: { primary: { usedPercent: 64, windowDurationMins: 10080 } },
          },
        },
        3_000,
      )?.primary?.usedPercent,
    ).toBe(64);
  });

  it('rejects a response without usable windows', () => {
    expect(parseRateLimitsResponse({ rateLimits: { primary: null, secondary: null } }, 1_000)).toBeNull();
  });
});
