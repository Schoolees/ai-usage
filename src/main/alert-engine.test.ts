import { describe, expect, it } from 'vitest';
import type { Snapshot } from '../shared/types';
import { AlertEngine } from './alert-engine';

const now = Date.UTC(2026, 8, 15, 17, 0);
const periodEnd = now + 3_600_000;

const snapshot = (usedPercent: number | null, resetsAt: number | null = periodEnd, status: Snapshot['status'] = 'ok'): Snapshot => ({
  providerId: 'claude',
  source: null,
  status,
  dataAsOf: now,
  limits: [{ id: 'five_hour', label: '5-hour limit', usedPercent, resetsAt }],
});

const args = { warnPercent: 80, criticalPercent: 95, now };

describe('AlertEngine thresholds', () => {
  it('fires once when a limit crosses the warning threshold', () => {
    const engine = new AlertEngine();
    expect(engine.evaluate({ ...args, previous: snapshot(70), next: snapshot(82) })).toEqual([
      { kind: 'threshold', providerId: 'claude', limitId: 'five_hour', limitLabel: '5-hour limit', percent: 82, threshold: 80, resetsAt: periodEnd },
    ]);
    expect(engine.evaluate({ ...args, previous: snapshot(82), next: snapshot(85) })).toEqual([]);
  });

  it('reports only the critical threshold when both are crossed at once', () => {
    const events = new AlertEngine().evaluate({ ...args, previous: snapshot(10), next: snapshot(97) });
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ threshold: 95 });
  });

  it('fires again in the next period', () => {
    const engine = new AlertEngine();
    engine.evaluate({ ...args, next: snapshot(90) });
    const nextPeriod = periodEnd + 5 * 3_600_000;
    expect(engine.evaluate({ ...args, next: snapshot(90, nextPeriod) })).toHaveLength(1);
  });

  it('does not repeat after a restart with persisted keys', () => {
    const first = new AlertEngine();
    first.evaluate({ ...args, next: snapshot(90) });
    const restarted = new AlertEngine(first.firedKeys());
    expect(restarted.evaluate({ ...args, next: snapshot(91) })).toEqual([]);
  });

  it('ignores non-ok snapshots and cleared percentages', () => {
    const engine = new AlertEngine();
    expect(engine.evaluate({ ...args, next: snapshot(99, periodEnd, 'error') })).toEqual([]);
    expect(engine.evaluate({ ...args, next: snapshot(null) })).toEqual([]);
  });
});

describe('AlertEngine resets', () => {
  it('fires when a busy window resets into a new period', () => {
    const engine = new AlertEngine();
    const previous = snapshot(88, now - 60_000);
    const events = engine.evaluate({ ...args, previous, next: snapshot(3, now + 5 * 3_600_000) });
    expect(events).toEqual([{ kind: 'reset', providerId: 'claude', limitId: 'five_hour', limitLabel: '5-hour limit' }]);
    expect(engine.evaluate({ ...args, previous, next: snapshot(4, now + 5 * 3_600_000) })).toEqual([]);
  });

  it('fires for log data whose window passed (percent cleared)', () => {
    const events = new AlertEngine().evaluate({ ...args, previous: snapshot(90, now - 60_000), next: snapshot(null, now - 60_000) });
    expect(events.map((e) => e.kind)).toEqual(['reset']);
  });

  it('stays quiet when a lightly used window resets', () => {
    const events = new AlertEngine().evaluate({ ...args, previous: snapshot(20, now - 60_000), next: snapshot(0, now + 3_600_000) });
    expect(events).toEqual([]);
  });
});

describe('AlertEngine.prune', () => {
  it('drops keys for periods that ended more than a day ago', () => {
    const engine = new AlertEngine([
      `threshold|claude|five_hour|${now - 2 * 86_400_000}|80`,
      `threshold|claude|five_hour|${now + 1}|80`,
      'threshold|claude|five_hour|null|80',
    ]);
    engine.prune(now);
    expect(engine.firedKeys()).toEqual([`threshold|claude|five_hour|${now + 1}|80`, 'threshold|claude|five_hour|null|80']);
  });
});
