import { describe, expect, it } from 'vitest';
import fixture from './fixtures/usage.json';
import { limitLabel, parseClaudeUsage, parseResetsAt } from './parse';

describe('parseResetsAt', () => {
  it('parses ISO strings with microseconds and rounds to the minute', () => {
    expect(parseResetsAt('2026-09-15T19:00:12.123456+00:00')).toBe(Date.UTC(2026, 8, 15, 19, 0));
  });

  it('returns null for missing or invalid values', () => {
    expect(parseResetsAt(null)).toBeNull();
    expect(parseResetsAt('soon')).toBeNull();
  });
});

describe('limitLabel', () => {
  it.each([
    ['five_hour', '5-hour limit'],
    ['seven_day', 'Weekly · all models'],
    ['seven_day_opus', 'Weekly · Opus'],
    ['seven_day_oauth_apps', 'Weekly · Oauth Apps'],
    ['monthly_thing', 'Monthly Thing'],
  ])('%s → %s', (key, label) => {
    expect(limitLabel(key)).toBe(label);
  });
});

describe('parseClaudeUsage', () => {
  it('prefers the normalized limits array, including model-scoped weekly limits', () => {
    const limits = parseClaudeUsage({
      five_hour: { utilization: 1, resets_at: '2026-09-15T19:00:00.000000+00:00' },
      seven_day_opus: null,
      limits: [
        { kind: 'weekly_scoped', group: 'weekly', percent: 17, resets_at: '2026-09-21T05:00:00.927188+00:00', scope: { model: { display_name: 'Fable' }, surface: null }, is_active: false },
        { kind: 'session', group: 'session', percent: 63, resets_at: '2026-09-15T08:50:00.926998+00:00', scope: null, is_active: true },
        { kind: 'weekly_all', group: 'weekly', percent: 39, resets_at: '2026-09-21T05:00:00.927015+00:00', scope: null, is_active: false },
      ],
    });
    expect(limits).toEqual([
      { id: 'five_hour', label: '5-hour limit', usedPercent: 63, resetsAt: Date.UTC(2026, 8, 15, 8, 50) },
      { id: 'seven_day', label: 'Weekly · all models', usedPercent: 39, resetsAt: Date.UTC(2026, 8, 21, 5, 0) },
      { id: 'seven_day_fable', label: 'Weekly · Fable', usedPercent: 17, resetsAt: Date.UTC(2026, 8, 21, 5, 0) },
    ]);
  });

  it('labels unknown limit kinds from the kind and skips malformed records', () => {
    expect(
      parseClaudeUsage({
        limits: [
          { kind: 'monthly_all', percent: 5, resets_at: null },
          { kind: 'session' },
          'nope',
          { kind: 'weekly_scoped', percent: 2, resets_at: null, scope: { model: null, surface: 'claude_code' } },
        ],
      }),
    ).toEqual([
      { id: 'monthly_all', label: 'Monthly All', usedPercent: 5, resetsAt: null },
      { id: 'seven_day_claude_code', label: 'Weekly · Claude Code', usedPercent: 2, resetsAt: null },
    ]);
  });

  it('falls back to legacy window keys when limits is missing or empty', () => {
    const limits = parseClaudeUsage({
      seven_day_opus: { utilization: 14, resets_at: '2026-09-21T13:00:00.000000+00:00' },
      extra_usage: { is_enabled: false, utilization: 3 },
      seven_day: { utilization: 29, resets_at: '2026-09-21T13:00:00.000000+00:00' },
      seven_day_sonnet: null,
      five_hour: { utilization: 73, resets_at: '2026-09-15T19:00:00.000000+00:00' },
      limits: [],
    });
    expect(limits).toEqual([
      { id: 'five_hour', label: '5-hour limit', usedPercent: 73, resetsAt: Date.UTC(2026, 8, 15, 19, 0) },
      { id: 'seven_day', label: 'Weekly · all models', usedPercent: 29, resetsAt: Date.UTC(2026, 8, 21, 13, 0) },
      { id: 'seven_day_opus', label: 'Weekly · Opus', usedPercent: 14, resetsAt: Date.UTC(2026, 8, 21, 13, 0) },
    ]);
  });

  it('skips inactive legacy windows but keeps used ones without a reset time', () => {
    expect(
      parseClaudeUsage({
        nimbus_quill: { utilization: 0, resets_at: null },
        five_hour: { utilization: 5, resets_at: null },
      }),
    ).toEqual([{ id: 'five_hour', label: '5-hour limit', usedPercent: 5, resetsAt: null }]);
  });

  it('throws on a non-object body', () => {
    expect(() => parseClaudeUsage('nope')).toThrow('Unexpected usage response');
  });

  it('parses the captured fixture from the spike', () => {
    const limits = parseClaudeUsage(fixture);
    expect(limits.map((l) => [l.id, l.label])).toEqual([
      ['five_hour', '5-hour limit'],
      ['seven_day', 'Weekly · all models'],
      ['seven_day_fable', 'Weekly · Fable'],
    ]);
    for (const limit of limits) {
      expect(limit.usedPercent).toBeGreaterThanOrEqual(0);
      expect(limit.usedPercent).toBeLessThanOrEqual(100);
      expect(limit.resetsAt).not.toBeNull();
    }
  });
});
