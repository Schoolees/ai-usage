import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Snapshot } from '../shared/types';
import { loadState, saveState } from './state-file';

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'state-'));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

const snapshot: Snapshot = {
  providerId: 'claude',
  source: { kind: 'windows', label: 'Windows', home: 'C:\\Users\\Raymond' },
  plan: 'Max (5x)',
  status: 'ok',
  dataAsOf: 1,
  limits: [{ id: 'five_hour', label: '5-hour limit', usedPercent: 73, resetsAt: 2 }],
};

describe('state file', () => {
  it('returns an empty state when missing or corrupt', () => {
    const file = join(dir, 'state.json');
    expect(loadState(file)).toEqual({ lastGood: {}, alertsFired: [] });
    writeFileSync(file, 'garbage');
    expect(loadState(file)).toEqual({ lastGood: {}, alertsFired: [] });
  });

  it('round-trips snapshots and fired alert keys', () => {
    const file = join(dir, 'state.json');
    saveState(file, { lastGood: { claude: snapshot }, alertsFired: ['threshold|claude|five_hour|2|80'] });
    expect(loadState(file)).toEqual({ lastGood: { claude: snapshot }, alertsFired: ['threshold|claude|five_hour|2|80'] });
    expect(readFileSync(file, 'utf8')).not.toMatch(/token/i);
  });

  it('drops malformed fields', () => {
    const file = join(dir, 'state.json');
    writeFileSync(file, JSON.stringify({ lastGood: 'x', alertsFired: ['ok', 3] }));
    expect(loadState(file)).toEqual({ lastGood: {}, alertsFired: ['ok'] });
  });
});
