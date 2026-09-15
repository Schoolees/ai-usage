import { describe, expect, it } from 'vitest';
import { codexSnapshot, findLastRateLimits } from './parse';
import type { Source } from '../../../shared/types';

const source: Source = { kind: 'wsl', label: 'WSL · Ubuntu', home: '/home/me' };

function tokenCount(timestamp: string, rateLimits: unknown): string {
  return JSON.stringify({
    timestamp,
    type: 'event_msg',
    payload: { type: 'token_count', info: { total_token_usage: {} }, rate_limits: rateLimits },
  });
}

const weekly = {
  limit_id: 'codex',
  primary: { used_percent: 9.0, window_minutes: 10080, resets_at: 1789999200 },
  secondary: { used_percent: 41.0, window_minutes: 300, resets_at: 1789500000 },
  credits: { has_credits: false, unlimited: false, balance: '0' },
  plan_type: 'prolite',
};

describe('findLastRateLimits', () => {
  it('returns the last token_count record with rate limits', () => {
    const jsonl = [
      JSON.stringify({ timestamp: '2026-09-15T08:00:00.000Z', type: 'session_meta', payload: { id: 'x' } }),
      tokenCount('2026-09-15T08:01:00.000Z', { ...weekly, primary: { ...weekly.primary, used_percent: 5 } }),
      tokenCount('2026-09-15T08:02:00.000Z', weekly),
      tokenCount('2026-09-15T08:03:00.000Z', null),
      '',
    ].join('\n');

    expect(findLastRateLimits(jsonl)).toEqual({
      timestampMs: Date.parse('2026-09-15T08:02:00.000Z'),
      planType: 'prolite',
      primary: { usedPercent: 9, windowMinutes: 10080, resetsAtSec: 1789999200 },
      secondary: { usedPercent: 41, windowMinutes: 300, resetsAtSec: 1789500000 },
    });
  });

  it('skips a truncated first line from a tail read', () => {
    const jsonl = ['rate_limits": {"primary": {"used_perc', tokenCount('2026-09-15T08:02:00.000Z', weekly)].join('\n');
    expect(findLastRateLimits(jsonl)?.planType).toBe('prolite');
  });

  it('skips newer records that carry no windows (e.g. a trailing limit_id "premium" record)', () => {
    const premium = { limit_id: 'premium', limit_name: null, primary: null, secondary: null, credits: weekly.credits, plan_type: 'plus' };
    const jsonl = [
      tokenCount('2026-09-15T06:54:04.187Z', {
        ...weekly,
        plan_type: 'plus',
        primary: { used_percent: 99, window_minutes: 300, resets_at: 1789472546 },
        secondary: { used_percent: 16, window_minutes: 10080, resets_at: 1790059346 },
      }),
      tokenCount('2026-09-15T06:54:05.349Z', premium),
      tokenCount('2026-09-15T06:55:05.854Z', premium),
    ].join('\n');

    expect(findLastRateLimits(jsonl)).toEqual({
      timestampMs: Date.parse('2026-09-15T06:54:04.187Z'),
      planType: 'plus',
      primary: { usedPercent: 99, windowMinutes: 300, resetsAtSec: 1789472546 },
      secondary: { usedPercent: 16, windowMinutes: 10080, resetsAtSec: 1790059346 },
    });
  });

  it('returns null when every record lacks windows', () => {
    const jsonl = tokenCount('2026-09-15T06:55:05.854Z', { ...weekly, limit_id: 'premium', primary: null, secondary: null });
    expect(findLastRateLimits(jsonl)).toBeNull();
  });

  it('returns null when no record exists', () => {
    expect(findLastRateLimits('{"type":"session_meta"}\n')).toBeNull();
  });

  it('treats a missing secondary window as null', () => {
    const jsonl = tokenCount('2026-09-15T08:02:00.000Z', { ...weekly, secondary: null });
    expect(findLastRateLimits(jsonl)?.secondary).toBeNull();
  });
});

describe('codexSnapshot', () => {
  const record = findLastRateLimits(tokenCount('2026-09-15T08:02:00.000Z', weekly))!;

  it('builds labeled limits keyed by window size', () => {
    const now = 1789400000 * 1000;
    expect(codexSnapshot(record, source, now)).toEqual({
      providerId: 'codex',
      source,
      plan: 'Pro Lite',
      status: 'ok',
      dataAsOf: Date.parse('2026-09-15T08:02:00.000Z'),
      limits: [
        { id: 'codex-10080m', label: 'Weekly limit', usedPercent: 9, resetsAt: 1789999200 * 1000 },
        { id: 'codex-300m', label: '5-hour limit', usedPercent: 41, resetsAt: 1789500000 * 1000 },
      ],
    });
  });

  it('clears usedPercent for a window whose reset time has passed', () => {
    const now = 1789600000 * 1000; // after the 5-hour reset, before the weekly reset
    const limits = codexSnapshot(record, source, now).limits;
    expect(limits.find((l) => l.id === 'codex-300m')?.usedPercent).toBeNull();
    expect(limits.find((l) => l.id === 'codex-10080m')?.usedPercent).toBe(9);
  });
});
