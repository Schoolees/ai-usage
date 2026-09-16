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
    expect(view).toMatchObject({ status: 'ok', plan: 'Max (5x)', source, maxPercent: 86, headlinePercent: 86, level: 'warn', dataAsOf: now - 60_000, stale: false });
    expect(view.limits.map((l) => l.level)).toEqual(['warn', 'normal']);
  });

  it('marks ok data as stale once it is older than staleAfterMs', () => {
    const view = buildProviderView(input({ latest: okSnapshot(now - 601_000) }));
    expect(view).toMatchObject({ status: 'stale', stale: true });
  });

  it('keeps last-good limits when the latest fetch failed, with retry time, and is not stale while last-good is fresh', () => {
    const failed: Snapshot = { providerId: 'claude', source, status: 'error', dataAsOf: now, limits: [], message: "Couldn't reach Anthropic" };
    const view = buildProviderView(input({ latest: failed, lastGood: okSnapshot(now - 120_000), nextRunAt: now + 120_000 }));
    expect(view).toMatchObject({
      status: 'error',
      message: "Couldn't reach Anthropic",
      retryAt: now + 120_000,
      maxPercent: 73,
      plan: 'Max (5x)',
      stale: false,
    });
    expect(view.limits).toHaveLength(2);
  });

  it('marks an error stale once last-good is older than staleAfterMs', () => {
    const failed: Snapshot = { providerId: 'claude', source, status: 'error', dataAsOf: now, limits: [], message: "Couldn't reach Anthropic" };
    const view = buildProviderView(input({ latest: failed, lastGood: okSnapshot(now - 601_000), nextRunAt: now + 120_000 }));
    expect(view).toMatchObject({ status: 'error', stale: true });
  });

  it('marks expired auth as stale even with fresh last-good data', () => {
    const expired: Snapshot = { providerId: 'claude', source, plan: 'Max (5x)', status: 'auth-expired', dataAsOf: now, limits: [], message: 'Login expired · run claude to refresh' };
    const view = buildProviderView(input({ latest: expired, lastGood: okSnapshot(now - 60_000) }));
    expect(view).toMatchObject({ status: 'auth-expired', stale: true });
  });

  it('shows no limits when the provider is not found', () => {
    const missing: Snapshot = { providerId: 'claude', source: null, status: 'not-found', dataAsOf: now, limits: [], message: 'No login' };
    const view = buildProviderView(input({ latest: missing, lastGood: okSnapshot(now - 1) }));
    expect(view).toMatchObject({ status: 'not-found', limits: [], maxPercent: null, headlinePercent: null, message: 'No login', stale: true });
  });

  it('counts a window that reset since the data was recorded as a fresh 0% window', () => {
    const snapshot = okSnapshot(now - 60_000);
    snapshot.limits[0] = { ...snapshot.limits[0], usedPercent: 97, resetsAt: now - 1 };
    const view = buildProviderView(input({ latest: snapshot }));
    expect(view.limits[0]).toMatchObject({ usedPercent: 0, level: 'normal' });
    expect(view.maxPercent).toBe(29);
    expect(view.headlinePercent).toBe(0);
  });

  it('shows no number instead of 0% when the data is older than the window that reset', () => {
    const codex: Snapshot = {
      providerId: 'codex',
      source,
      status: 'ok',
      dataAsOf: now - 2 * 86_400_000, // two days old: we cannot know what happened since
      limits: [{ id: 'codex-300m', label: '5-hour limit', usedPercent: 91, resetsAt: now - 20 * 60_000 }],
    };
    const view = buildProviderView(input({ latest: codex }, { id: 'codex', staleAfterMs: 86_400_000, fromLogs: true }));
    expect(view.limits[0].usedPercent).toBeNull();
    expect(view.headlinePercent).toBeNull();
  });

  it('headlines the shortest window (5-hour) even when a longer window is higher, but levels by the worst', () => {
    const snapshot = okSnapshot(now - 60_000, 20);
    snapshot.limits[1] = { ...snapshot.limits[1], usedPercent: 90 };
    const view = buildProviderView(input({ latest: snapshot }));
    expect(view).toMatchObject({ headlinePercent: 20, maxPercent: 90, level: 'warn' });
  });

  it('headlines the Codex 5-hour window by its window size, even when listed after the weekly window', () => {
    const codex: Snapshot = {
      providerId: 'codex',
      source,
      status: 'ok',
      dataAsOf: now - 60_000,
      limits: [
        { id: 'codex-10080m', label: 'Weekly limit', usedPercent: 16, resetsAt: now + 6 * 86_400_000 },
        { id: 'codex-300m', label: '5-hour limit', usedPercent: null, resetsAt: now - 20 * 60_000 },
      ],
    };
    const view = buildProviderView(input({ latest: codex }, { id: 'codex', staleAfterMs: 86_400_000, fromLogs: true }));
    expect(view).toMatchObject({ headlinePercent: 0, maxPercent: 16 });
  });

  it('reports a checking state before the first fetch', () => {
    expect(buildProviderView(input(undefined))).toMatchObject({
      status: 'stale',
      message: 'Checking…',
      limits: [],
      maxPercent: null,
      headlinePercent: null,
      dataAsOf: null,
      stale: true,
    });
  });
});
