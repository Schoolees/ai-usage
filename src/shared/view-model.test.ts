import { describe, expect, it } from 'vitest';
import type { Snapshot } from './types';
import { buildProviderView, levelFor, type ProviderViewInput } from './view-model';

const now = Date.UTC(2026, 8, 15, 17, 0);
const source = { kind: 'wsl' as const, label: 'WSL · Ubuntu', home: '/home/me' };

const okSnapshot = (dataAsOf: number, fiveHour = 73): Snapshot => ({
  providerId: 'claude',
  source,
  plan: 'Max (5x)',
  status: 'ok',
  dataAsOf,
  limits: [
    { id: 'five_hour', label: '5-hour limit', usedPercent: fiveHour, resetsAt: now + 3_600_000 },
    { id: 'seven_day', label: 'Weekly · all models', usedPercent: 29, resetsAt: now + 5 * 86_400_000 },
  ],
});

const input = (entry: ProviderViewInput['entry'], extra: Partial<ProviderViewInput> = {}): ProviderViewInput => ({
  id: 'claude',
  name: 'Claude',
  shortName: 'Claude',
  fromLogs: false,
  staleAfterMs: 600_000,
  entry,
  now,
  warnPercent: 80,
  criticalPercent: 95,
  ...extra,
});

describe('levelFor', () => {
  it('maps percentages to levels', () => {
    expect(levelFor(null, 80, 95)).toBe('normal');
    expect(levelFor(79.9, 80, 95)).toBe('normal');
    expect(levelFor(80, 80, 95)).toBe('warn');
    expect(levelFor(95, 80, 95)).toBe('critical');
  });
});

describe('buildProviderView', () => {
  it('shows fresh ok data with levels and the highest percent', () => {
    const view = buildProviderView(input({ latest: okSnapshot(now - 60_000, 86) }));
    expect(view).toMatchObject({ status: 'ok', plan: 'Max (5x)', source, maxPercent: 86, level: 'warn', dataAsOf: now - 60_000 });
    expect(view.limits.map((l) => l.level)).toEqual(['warn', 'normal']);
  });

  it('marks ok data as stale once it is older than staleAfterMs', () => {
    expect(buildProviderView(input({ latest: okSnapshot(now - 601_000) })).status).toBe('stale');
  });

  it('keeps last-good limits when the latest fetch failed, with retry time', () => {
    const failed: Snapshot = { providerId: 'claude', source, status: 'error', dataAsOf: now, limits: [], message: "Couldn't reach Anthropic" };
    const view = buildProviderView(input({ latest: failed, lastGood: okSnapshot(now - 120_000), nextRunAt: now + 120_000 }));
    expect(view).toMatchObject({ status: 'error', message: "Couldn't reach Anthropic", retryAt: now + 120_000, maxPercent: 73, plan: 'Max (5x)' });
    expect(view.limits).toHaveLength(2);
  });

  it('shows no limits when the provider is not found', () => {
    const missing: Snapshot = { providerId: 'claude', source: null, status: 'not-found', dataAsOf: now, limits: [], message: 'No login' };
    const view = buildProviderView(input({ latest: missing, lastGood: okSnapshot(now - 1) }));
    expect(view).toMatchObject({ status: 'not-found', limits: [], maxPercent: null, message: 'No login' });
  });

  it('hides the percent of a window whose reset has passed', () => {
    const snapshot = okSnapshot(now - 60_000);
    snapshot.limits[0] = { ...snapshot.limits[0], usedPercent: 97, resetsAt: now - 1 };
    const view = buildProviderView(input({ latest: snapshot }));
    expect(view.limits[0].usedPercent).toBeNull();
    expect(view.maxPercent).toBe(29);
  });

  it('reports a checking state before the first fetch', () => {
    expect(buildProviderView(input(undefined))).toMatchObject({ status: 'stale', message: 'Checking…', limits: [], maxPercent: null, dataAsOf: null });
  });
});
