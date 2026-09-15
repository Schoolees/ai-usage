import { DAY } from '../shared/time';
import type { Limit, Snapshot } from '../shared/types';

export type AlertEvent =
  | { kind: 'threshold'; providerId: string; limitId: string; limitLabel: string; percent: number; threshold: number; resetsAt: number | null }
  | { kind: 'reset'; providerId: string; limitId: string; limitLabel: string };

export interface EvaluateArgs {
  previous?: Snapshot;
  next: Snapshot;
  warnPercent: number;
  criticalPercent: number;
  now: number;
}

// Keys: threshold|<provider>|<limit>|<resetsAt>|<threshold>  and  reset|<provider>|<limit>|<previous resetsAt>
const thresholdKey = (providerId: string, limit: Limit, threshold: number) =>
  `threshold|${providerId}|${limit.id}|${limit.resetsAt}|${threshold}`;
const resetKey = (providerId: string, limitId: string, resetsAt: number) => `reset|${providerId}|${limitId}|${resetsAt}`;

export class AlertEngine {
  private readonly fired: Set<string>;

  constructor(fired: Iterable<string> = []) {
    this.fired = new Set(fired);
  }

  evaluate({ previous, next, warnPercent, criticalPercent, now }: EvaluateArgs): AlertEvent[] {
    if (next.status !== 'ok') return [];
    const events: AlertEvent[] = [];
    const previousById = new Map((previous?.limits ?? []).map((limit) => [limit.id, limit]));

    for (const limit of next.limits) {
      const before = previousById.get(limit.id);
      const periodEnded =
        before !== undefined &&
        before.usedPercent !== null &&
        before.usedPercent >= warnPercent &&
        before.resetsAt !== null &&
        before.resetsAt <= now &&
        (limit.usedPercent === null || limit.resetsAt === null || limit.resetsAt > before.resetsAt);
      if (periodEnded) {
        const key = resetKey(next.providerId, limit.id, before.resetsAt!);
        if (!this.fired.has(key)) {
          this.fired.add(key);
          events.push({ kind: 'reset', providerId: next.providerId, limitId: limit.id, limitLabel: limit.label });
        }
      }

      const percent = limit.usedPercent;
      if (percent === null) continue;
      const crossed = [criticalPercent, warnPercent].filter((threshold) => percent >= threshold);
      if (crossed.length === 0) continue;
      const highestIsNew = !this.fired.has(thresholdKey(next.providerId, limit, crossed[0]));
      for (const threshold of crossed) this.fired.add(thresholdKey(next.providerId, limit, threshold));
      if (highestIsNew) {
        events.push({
          kind: 'threshold',
          providerId: next.providerId,
          limitId: limit.id,
          limitLabel: limit.label,
          percent,
          threshold: crossed[0],
          resetsAt: limit.resetsAt,
        });
      }
    }
    return events;
  }

  prune(now: number): void {
    for (const key of this.fired) {
      const resetsAt = Number(key.split('|')[3]);
      if (Number.isFinite(resetsAt) && resetsAt < now - DAY) this.fired.delete(key);
    }
  }

  firedKeys(): string[] {
    return [...this.fired];
  }
}
