import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { findIndexedLog, parseSessionIndex } from './session-index';

// Real lines from ~/.codex/session_index.jsonl
const index = [
  '{"id":"019f9cee-0995-7162-bd51-2659a694c53d","thread_name":"Implement ID Management","updated_at":"2026-07-26T06:18:39.58880298Z"}',
  '{"id":"01a0a3cc-41b6-7dc0-901c-5e4333730835","thread_name":"Scan workspace projects","updated_at":"2026-09-15T06:42:26.025731378Z"}',
  '{"id":"019ea8f3-383f-7ff1-9adf-085c81924550","thread_name":"Make IT mascot techier","updated_at":"2026-09-16T01:43:13.969277605Z"}',
].join('\n');

describe('parseSessionIndex', () => {
  it('returns sessions newest first', () => {
    expect(parseSessionIndex(index)).toEqual([
      { id: '019ea8f3-383f-7ff1-9adf-085c81924550', updatedAtMs: Date.parse('2026-09-16T01:43:13.969Z') },
      { id: '01a0a3cc-41b6-7dc0-901c-5e4333730835', updatedAtMs: Date.parse('2026-09-15T06:42:26.025Z') },
      { id: '019f9cee-0995-7162-bd51-2659a694c53d', updatedAtMs: Date.parse('2026-07-26T06:18:39.588Z') },
    ]);
  });

  it('skips malformed, truncated and incomplete lines', () => {
    const messy = ['{"id":"a","updated_at":"2026-09-16T01:00:00Z"}', 'not json', '{"id":"b"}', '{"updated_at":"2026-09-16T02:00:00Z"}', ''].join('\n');
    expect(parseSessionIndex(messy)).toEqual([{ id: 'a', updatedAtMs: Date.parse('2026-09-16T01:00:00Z') }]);
  });

  it('returns nothing for an empty index', () => {
    expect(parseSessionIndex('')).toEqual([]);
  });
});

describe('findIndexedLog', () => {
  let home: string;

  const write = (day: string, name: string) => {
    const dir = join(home, '.codex', 'sessions', ...day.split('/'));
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, name), '{}\n');
    return join(dir, name);
  };

  beforeEach(() => {
    home = mkdtempSync(join(tmpdir(), 'codex-index-'));
    mkdirSync(join(home, '.codex'), { recursive: true });
  });

  afterEach(() => rmSync(home, { recursive: true, force: true }));

  it('resolves the newest indexed session to its rollout file, wherever it lives', async () => {
    write('2026/09/15', 'rollout-2026-09-15T06-42-26-01a0a3cc-41b6-7dc0-901c-5e4333730835.jsonl');
    const resumed = write('2026/06/09', 'rollout-2026-06-09T04-36-12-019ea8f3-383f-7ff1-9adf-085c81924550.jsonl');
    writeFileSync(join(home, '.codex', 'session_index.jsonl'), index);

    const log = await findIndexedLog(home);
    expect(log?.path).toBe(resumed);
    expect(log?.size).toBeGreaterThan(0);
  });

  it('falls through to the next indexed session when the newest has no file', async () => {
    const older = write('2026/09/15', 'rollout-2026-09-15T06-42-26-01a0a3cc-41b6-7dc0-901c-5e4333730835.jsonl');
    writeFileSync(join(home, '.codex', 'session_index.jsonl'), index);
    expect((await findIndexedLog(home))?.path).toBe(older);
  });

  it('returns null without an index or a matching file', async () => {
    expect(await findIndexedLog(home)).toBeNull();
    writeFileSync(join(home, '.codex', 'session_index.jsonl'), index);
    expect(await findIndexedLog(home)).toBeNull();
  });
});
