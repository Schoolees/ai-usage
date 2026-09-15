import type { Limit, Snapshot, Source } from '../../../shared/types';
import { roundToMinute } from '../../../shared/time';
import { codexPlanLabel, windowLabel } from './labels';

export interface CodexWindow {
  usedPercent: number;
  windowMinutes: number;
  resetsAtSec: number | null;
}

export interface CodexRateLimitRecord {
  timestampMs: number;
  planType: string | null;
  primary: CodexWindow | null;
  secondary: CodexWindow | null;
}

type Json = Record<string, unknown>;

function asObject(value: unknown): Json | null {
  return value !== null && typeof value === 'object' ? (value as Json) : null;
}

function toWindow(value: unknown): CodexWindow | null {
  const w = asObject(value);
  if (!w || typeof w.used_percent !== 'number' || typeof w.window_minutes !== 'number') return null;
  return {
    usedPercent: w.used_percent,
    windowMinutes: w.window_minutes,
    resetsAtSec: typeof w.resets_at === 'number' ? w.resets_at : null,
  };
}

/** Scan a rollout .jsonl (or its tail) from the end for the newest rate-limit record. */
export function findLastRateLimits(jsonl: string): CodexRateLimitRecord | null {
  const lines = jsonl.split('\n');
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i].trim();
    if (!line.includes('"rate_limits"')) continue;
    let parsed: unknown;
    try {
      parsed = JSON.parse(line);
    } catch {
      continue; // the first line of a tail read is usually cut off
    }
    const event = asObject(parsed);
    const payload = asObject(event?.payload);
    const rateLimits = asObject(payload?.rate_limits);
    if (payload?.type !== 'token_count' || !rateLimits) continue;
    const timestampMs = typeof event?.timestamp === 'string' ? Date.parse(event.timestamp) : NaN;
    if (Number.isNaN(timestampMs)) continue;
    const primary = toWindow(rateLimits.primary);
    const secondary = toWindow(rateLimits.secondary);
    // Codex also logs records for other limit ids (e.g. "premium") with no windows; they would hide the real ones.
    if (!primary && !secondary) continue;
    return {
      timestampMs,
      planType: typeof rateLimits.plan_type === 'string' ? rateLimits.plan_type : null,
      primary,
      secondary,
    };
  }
  return null;
}

export function codexSnapshot(record: CodexRateLimitRecord, source: Source, now: number): Snapshot {
  const limits: Limit[] = [];
  for (const window of [record.primary, record.secondary]) {
    if (!window) continue;
    const resetsAt = window.resetsAtSec === null ? null : roundToMinute(window.resetsAtSec * 1000);
    const hasReset = resetsAt !== null && resetsAt <= now;
    limits.push({
      id: `codex-${window.windowMinutes}m`,
      label: windowLabel(window.windowMinutes),
      usedPercent: hasReset ? null : window.usedPercent,
      resetsAt,
    });
  }
  return {
    providerId: 'codex',
    source,
    plan: codexPlanLabel(record.planType),
    status: 'ok',
    dataAsOf: record.timestampMs,
    limits,
  };
}
