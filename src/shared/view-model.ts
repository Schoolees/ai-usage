import { MINUTE } from './time';
import type { Limit, ProviderStatus, Snapshot, Source } from './types';

export type Level = 'normal' | 'warn' | 'critical';

export interface LimitView extends Limit {
  level: Level;
}

export interface ProviderView {
  id: string;
  name: string;
  shortName: string;
  plan?: string;
  source: Source | null;
  status: ProviderStatus;
  message?: string;
  dataAsOf: number | null;
  fromLogs: boolean;
  retryAt?: number;
  limits: LimitView[];
  /** Highest percent across all windows; drives `level` so a nearly spent weekly limit still warns */
  maxPercent: number | null;
  /** The pill's number: the shortest window (the 5-hour limit when there is one), so providers compare like for like */
  headlinePercent: number | null;
  level: Level;
  /** True when the shown numbers should be dimmed/greyed: no data, expired auth, not found, or last-good is older than staleAfterMs. A transient error does not make fresh data stale. */
  stale: boolean;
}

export interface IslandView {
  providers: ProviderView[];
  generatedAt: number;
}

export function levelFor(percent: number | null, warnPercent: number, criticalPercent: number): Level {
  if (percent === null) return 'normal';
  if (percent >= criticalPercent) return 'critical';
  if (percent >= warnPercent) return 'warn';
  return 'normal';
}

export interface ProviderViewInput {
  id: string;
  name: string;
  shortName: string;
  fromLogs: boolean;
  staleAfterMs: number;
  entry?: { latest: Snapshot; lastGood?: Snapshot; nextRunAt?: number };
  now: number;
  warnPercent: number;
  criticalPercent: number;
}

/**
 * Window length from the limit id: Claude's `five_hour` / `seven_day…`, Codex's `codex-<minutes>m`.
 * Unknown windows sort last so a known 5-hour window wins the headline.
 */
export function windowMinutes(limit: { id: string }): number {
  const codex = /-(\d+)m$/.exec(limit.id);
  if (codex) return Number(codex[1]);
  if (limit.id === 'five_hour') return 300;
  if (limit.id.startsWith('seven_day')) return 10_080;
  return Number.POSITIVE_INFINITY;
}

export function buildProviderView(input: ProviderViewInput): ProviderView {
  const { entry, now, warnPercent, criticalPercent } = input;
  const base = { id: input.id, name: input.name, shortName: input.shortName, fromLogs: input.fromLogs };

  if (!entry) {
    return { ...base, source: null, status: 'stale', message: 'Checking…', dataAsOf: null, limits: [], maxPercent: null, headlinePercent: null, level: 'normal', stale: true };
  }

  const { latest, lastGood } = entry;
  const shown = latest.status === 'ok' ? latest : lastGood;
  const status: ProviderStatus =
    latest.status === 'ok' && now - latest.dataAsOf > input.staleAfterMs ? 'stale' : latest.status;

  // A transient error must not dim the pill while last-good data is still fresh (spec §5).
  const stale: boolean =
    latest.status === 'auth-expired' || latest.status === 'not-found'
      ? true
      : shown === undefined || now - shown.dataAsOf > input.staleAfterMs;

  const limits: LimitView[] =
    latest.status === 'not-found'
      ? []
      : (shown?.limits ?? []).map((limit) => {
          // Past its reset time with no newer record, the window has started over. That reads as 0% only
          // if our data is newer than the window itself; otherwise usage since then is unknown, and
          // showing 0% would be a confident wrong number.
          const hasReset = limit.resetsAt !== null && limit.resetsAt <= now;
          const dataCoversWindow = shown !== undefined && now - shown.dataAsOf <= windowMinutes(limit) * MINUTE;
          const usedPercent = hasReset ? (dataCoversWindow ? 0 : null) : limit.usedPercent;
          return { ...limit, usedPercent, level: levelFor(usedPercent, warnPercent, criticalPercent) };
        });

  const percents = limits.map((l) => l.usedPercent).filter((p): p is number => p !== null);
  const maxPercent = percents.length > 0 ? Math.max(...percents) : null;
  const headline = [...limits].sort((a, b) => windowMinutes(a) - windowMinutes(b))[0];
  const headlinePercent = headline?.usedPercent ?? null;

  return {
    ...base,
    plan: latest.plan ?? shown?.plan,
    source: latest.source ?? shown?.source ?? null,
    status,
    message: latest.message,
    dataAsOf: latest.status === 'not-found' ? null : (shown?.dataAsOf ?? null),
    retryAt: latest.status === 'error' ? entry.nextRunAt : undefined,
    limits,
    maxPercent,
    headlinePercent,
    level: levelFor(maxPercent, warnPercent, criticalPercent),
    stale,
  };
}
