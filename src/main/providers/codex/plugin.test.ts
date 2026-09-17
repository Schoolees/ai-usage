import { mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../../../shared/settings-schema';
import type { Source } from '../../../shared/types';
import { createCodexPlugin } from './plugin';

let home: string;
let source: Source;

function writeRollout(day: string, name: string, usedPercent: number, mtimeSec: number): void {
  const dir = join(home, '.codex', 'sessions', ...day.split('/'));
  mkdirSync(dir, { recursive: true });
  const line = JSON.stringify({
    timestamp: '2026-09-15T08:02:00.000Z',
    type: 'event_msg',
    payload: {
      type: 'token_count',
      rate_limits: { primary: { used_percent: usedPercent, window_minutes: 10080, resets_at: 1789999200 }, secondary: null, plan_type: 'plus' },
    },
  });
  const path = join(dir, name);
  writeFileSync(path, `${line}\n`);
  utimesSync(path, mtimeSec, mtimeSec);
}

beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), 'codex-home-'));
  source = { kind: 'windows', label: 'Local', home };
});

afterEach(() => {
  rmSync(home, { recursive: true, force: true });
});

describe('createCodexPlugin', () => {
  const now = Date.parse('2026-09-15T09:00:00.000Z');

  it('describes itself', () => {
    const plugin = createCodexPlugin();
    expect(plugin).toMatchObject({ id: 'codex', name: 'ChatGPT (Codex)', shortName: 'Codex', fromLogs: true, staleAfterMs: 86_400_000 });
    expect(plugin.intervalMs(DEFAULT_SETTINGS)).toBe(30_000);
  });

  it('detects homes that have rollout logs', async () => {
    writeRollout('2026/09/15', 'rollout-1.jsonl', 10, 5_000);
    const empty: Source = { kind: 'wsl', label: 'WSL · Other', home: join(home, 'nobody') };
    const detected = await createCodexPlugin().detectSources([source, empty]);
    expect(detected).toEqual([{ ...source, lastModifiedMs: 5_000_000 }]);
  });

  it('returns an ok snapshot from the newest log', async () => {
    writeRollout('2026/09/14', 'rollout-old.jsonl', 5, 1_000);
    writeRollout('2026/09/15', 'rollout-new.jsonl', 42, 2_000);
    const snapshot = await createCodexPlugin().fetch(source, now);
    expect(snapshot).toMatchObject({ providerId: 'codex', status: 'ok', plan: 'Plus' });
    expect(snapshot.limits).toEqual([{ id: 'codex-10080m', label: 'Weekly limit', usedPercent: 42, resetsAt: 1789999200 * 1000 }]);
  });

  it('falls back to an older log when the newest has no rate limits yet', async () => {
    writeRollout('2026/09/14', 'rollout-old.jsonl', 7, 1_000);
    const dir = join(home, '.codex', 'sessions', '2026', '09', '15');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'rollout-new.jsonl'), '{"type":"session_meta","payload":{}}\n');
    utimesSync(join(dir, 'rollout-new.jsonl'), 2_000, 2_000);
    expect((await createCodexPlugin().fetch(source, now)).limits[0].usedPercent).toBe(7);
  });

  it('uses the newest log by modified time even when it sits in an old day folder', async () => {
    for (let day = 1; day <= 20; day++) writeRollout(`2026/09/${String(day).padStart(2, '0')}`, 'rollout-session.jsonl', 11, 1_000 + day);
    writeRollout('2026/06/09', 'rollout-resumed.jsonl', 78, 9_000);
    expect((await createCodexPlugin().fetch(source, now)).limits[0].usedPercent).toBe(78);
  });

  it('prefers the session Codex marks as current in its index, over the newest file', async () => {
    const currentId = '019ea8f3-383f-7ff1-9adf-085c81924550';
    writeRollout('2026/06/09', `rollout-2026-06-09T04-36-12-${currentId}.jsonl`, 78, 1_000);
    writeRollout('2026/09/15', 'rollout-2026-09-15T06-42-26-01a0a3cc-41b6-7dc0-901c-5e4333730835.jsonl', 11, 9_000);
    writeFileSync(
      join(home, '.codex', 'session_index.jsonl'),
      `{"id":"01a0a3cc-41b6-7dc0-901c-5e4333730835","updated_at":"2026-09-15T06:42:26.0Z"}\n{"id":"${currentId}","updated_at":"2026-09-16T01:43:13.9Z"}\n`,
    );
    expect((await createCodexPlugin().fetch(source, now)).limits[0].usedPercent).toBe(78);
  });

  function writeLive(records: object[]): void {
    const dir = join(home, '.codex', 'sessions', '2026', '09', '15');
    mkdirSync(dir, { recursive: true });
    const path = join(dir, 'rollout-live.jsonl');
    writeFileSync(path, records.map((record) => `${JSON.stringify(record)}\n`).join(''));
    utimesSync(path, now / 1000, now / 1000);
  }

  const readable = (timestamp: string) => ({
    timestamp,
    type: 'event_msg',
    payload: { type: 'token_count', rate_limits: { primary: { used_percent: 42, window_minutes: 300, resets_at: 1789999200 }, secondary: null, plan_type: 'plus' } },
  });

  it('shows the last usage for a thread reopened hours later, before the model replies', async () => {
    // The file was just written to, but only with context records: no newer usage exists yet.
    writeLive([
      readable('2026-09-14T20:00:00.000Z'),
      { timestamp: '2026-09-15T08:59:50.000Z', type: 'turn_context', payload: {} },
      { timestamp: '2026-09-15T08:59:50.100Z', type: 'event_msg', payload: { type: 'task_started' } },
    ]);
    const snapshot = await createCodexPlugin().fetch(source, now);
    expect(snapshot.status).toBe('ok');
    expect(snapshot.dataAsOf).toBe(Date.parse('2026-09-14T20:00:00.000Z'));
  });

  it('reports an error when Codex keeps recording usage in a shape it cannot read', async () => {
    // Fresh token_count records whose rate limits don't parse, hours after the last readable one:
    // the log format has moved on, so say so instead of showing stale numbers as current.
    writeLive([
      readable('2026-09-14T20:00:00.000Z'),
      { timestamp: '2026-09-15T08:58:00.000Z', type: 'event_msg', payload: { type: 'token_count', rate_limits: { windows: [{ pct: 50 }] } } },
    ]);
    const snapshot = await createCodexPlugin().fetch(source, now);
    expect(snapshot.status).toBe('error');
    expect(snapshot.message).toMatch(/current usage/i);
  });

  it('returns not-found when there are no logs', async () => {
    const snapshot = await createCodexPlugin().fetch(source, now);
    expect(snapshot).toMatchObject({ providerId: 'codex', status: 'not-found', limits: [], message: 'No Codex logs in Local' });
  });

  it('reuses the parsed record while the newest log is unchanged', async () => {
    writeRollout('2026/09/15', 'rollout-new.jsonl', 42, 2_000);
    const plugin = createCodexPlugin();
    await plugin.fetch(source, now);
    // Rewrite the content but restore the same mtime: a cached read must not notice.
    writeRollout('2026/09/15', 'rollout-new.jsonl', 99, 2_000);
    expect((await plugin.fetch(source, now)).limits[0].usedPercent).toBe(42);
  });

  it('skips a log that cannot be read', async () => {
    writeRollout('2026/09/14', 'rollout-old.jsonl', 7, 1_000);
    const dir = join(home, '.codex', 'sessions', '2026', '09', '15');
    mkdirSync(dir, { recursive: true });
    // Create a directory with the rollout filename so open() throws EISDIR
    mkdirSync(join(dir, 'rollout-new.jsonl'));
    utimesSync(join(dir, 'rollout-new.jsonl'), 2_000, 2_000);
    const snapshot = await createCodexPlugin().fetch(source, now);
    expect(snapshot).toMatchObject({ status: 'ok', providerId: 'codex' });
    expect(snapshot.limits[0].usedPercent).toBe(7);
  });

  it('returns not-found when no log has rate limits', async () => {
    const dir = join(home, '.codex', 'sessions', '2026', '09', '15');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'rollout-meta.jsonl'), '{"type":"session_meta","payload":{}}\n');
    utimesSync(join(dir, 'rollout-meta.jsonl'), 1_000, 1_000);
    const snapshot = await createCodexPlugin().fetch(source, now);
    expect(snapshot).toMatchObject({ providerId: 'codex', status: 'not-found', limits: [], message: 'No Codex usage recorded yet in Local' });
  });
});
