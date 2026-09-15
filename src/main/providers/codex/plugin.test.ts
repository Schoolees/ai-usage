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
});
