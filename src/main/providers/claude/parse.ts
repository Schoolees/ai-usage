import { roundToMinute } from '../../../shared/time';
import type { Limit } from '../../../shared/types';

export function parseResetsAt(value: unknown): number | null {
  if (typeof value !== 'string') return null;
  // Python-style timestamps carry 6 fractional digits; trim to 3 so Date.parse accepts them everywhere.
  const ms = Date.parse(value.replace(/(\.\d{3})\d+/, '$1'));
  return Number.isNaN(ms) ? null : roundToMinute(ms);
}

function titleCase(snake: string): string {
  return snake
    .split('_')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export function limitLabel(key: string): string {
  if (key === 'five_hour') return '5-hour limit';
  if (key === 'seven_day') return 'Weekly · all models';
  if (key.startsWith('seven_day_')) return `Weekly · ${titleCase(key.slice('seven_day_'.length))}`;
  return titleCase(key);
}

const DISPLAY_ORDER = ['five_hour', 'seven_day'];

function rank(id: string): number {
  const index = DISPLAY_ORDER.indexOf(id);
  return index === -1 ? DISPLAY_ORDER.length : index;
}

function sortLimits(limits: Limit[]): Limit[] {
  return limits.sort((a, b) => rank(a.id) - rank(b.id) || a.id.localeCompare(b.id));
}

function slug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function scopeName(scope: unknown): string | null {
  const s = scope as { model?: { display_name?: unknown } | null; surface?: unknown } | null | undefined;
  if (typeof s?.model?.display_name === 'string') return s.model.display_name;
  if (typeof s?.surface === 'string') return titleCase(s.surface);
  return null;
}

/** The normalized `limits` array: the only place model-scoped weekly limits appear. */
function fromLimitsArray(records: unknown[]): Limit[] {
  const limits: Limit[] = [];
  for (const record of records) {
    if (!record || typeof record !== 'object') continue;
    const { kind, percent, resets_at, scope } = record as Record<string, unknown>;
    if (typeof kind !== 'string' || typeof percent !== 'number') continue;
    if (!Number.isFinite(percent) || percent < 0 || percent > 100) continue;
    const base = { usedPercent: percent, resetsAt: parseResetsAt(resets_at) };
    if (kind === 'session') {
      limits.push({ id: 'five_hour', label: limitLabel('five_hour'), ...base });
    } else if (kind === 'weekly_all') {
      limits.push({ id: 'seven_day', label: limitLabel('seven_day'), ...base });
    } else if (kind === 'weekly_scoped') {
      const name = scopeName(scope) ?? 'Scoped';
      limits.push({ id: `seven_day_${slug(name)}`, label: `Weekly · ${name}`, ...base });
    } else {
      limits.push({ id: slug(kind), label: titleCase(kind), ...base });
    }
  }
  return limits;
}

/** Legacy top-level window keys, used when the response has no `limits` array. */
function fromWindowKeys(body: Record<string, unknown>): Limit[] {
  const limits: Limit[] = [];
  for (const [key, value] of Object.entries(body)) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) continue;
    const window = value as Record<string, unknown>;
    // A rate-limit window has both fields; blocks like extra_usage do not.
    if (typeof window.utilization !== 'number' || !Number.isFinite(window.utilization) || window.utilization < 0 || window.utilization > 100 || !('resets_at' in window)) continue;
    // Inactive placeholder windows (unused codename limits) report 0% with no reset time.
    if (window.utilization === 0 && window.resets_at === null) continue;
    limits.push({ id: key, label: limitLabel(key), usedPercent: window.utilization, resetsAt: parseResetsAt(window.resets_at) });
  }
  return limits;
}

export function parseClaudeUsage(body: unknown): Limit[] {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('Unexpected usage response');
  const record = body as Record<string, unknown>;
  const limits = Array.isArray(record.limits) && record.limits.length > 0 ? fromLimitsArray(record.limits) : fromWindowKeys(record);
  if (limits.length === 0) throw new Error('Unexpected usage response');
  return sortLimits(limits);
}
