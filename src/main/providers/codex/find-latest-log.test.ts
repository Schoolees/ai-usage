import { mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { findLatestLogs, readTail } from './find-latest-log';

let root: string;

function writeLog(relDir: string, name: string, content: string, mtimeSec: number): string {
  const dir = join(root, relDir);
  mkdirSync(dir, { recursive: true });
  const path = join(dir, name);
  writeFileSync(path, content);
  utimesSync(path, mtimeSec, mtimeSec);
  return path;
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'codex-sessions-'));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe('findLatestLogs', () => {
  it('returns rollout logs newest first across date folders', async () => {
    const older = writeLog('2026/08/31', 'rollout-a.jsonl', 'a', 1_000);
    const newest = writeLog('2026/09/15', 'rollout-b.jsonl', 'bb', 3_000);
    const middle = writeLog('2026/09/01', 'rollout-c.jsonl', 'c', 2_000);
    writeLog('2026/09/15', 'notes.txt', 'ignored', 9_000);

    const logs = await findLatestLogs(root);
    expect(logs.map((l) => l.path)).toEqual([newest, middle, older]);
    expect(logs[0]).toMatchObject({ mtimeMs: 3_000_000, size: 2 });
  });

  it('finds a recently written log in an old day folder (a long-running session keeps its original folder)', async () => {
    for (let day = 1; day <= 20; day++) writeLog(`2026/09/${String(day).padStart(2, '0')}`, 'rollout-session.jsonl', 'older', 1_000 + day);
    const resumed = writeLog('2026/06/09', 'rollout-old-session.jsonl', 'resumed today', 9_000);
    expect((await findLatestLogs(root))[0].path).toBe(resumed);
  });

  it('can be limited to the most recent day folders', async () => {
    writeLog('2026/09/14', 'rollout-old.jsonl', 'x', 5_000);
    const recent = writeLog('2026/09/15', 'rollout-new.jsonl', 'y', 4_000);
    expect((await findLatestLogs(root, 1)).map((l) => l.path)).toEqual([recent]);
  });

  it('caps the number of files', async () => {
    for (let i = 0; i < 7; i++) writeLog('2026/09/15', `rollout-${i}.jsonl`, 'z', 1_000 + i);
    expect(await findLatestLogs(root, 14, 5)).toHaveLength(5);
  });

  it('returns an empty list when the folder does not exist', async () => {
    expect(await findLatestLogs(join(root, 'missing'))).toEqual([]);
  });
});

describe('readTail', () => {
  it('reads only the last maxBytes of a file', async () => {
    const path = writeLog('2026/09/15', 'rollout-t.jsonl', 'first\nsecond\nthird\n', 1_000);
    const text = await readTail({ path, mtimeMs: 0, size: 19 }, 12);
    expect(text).toBe('econd\nthird\n');
  });
});
