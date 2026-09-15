import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../shared/settings-schema';
import { loadSettings, saveSettings } from './settings';

let dir: string;
let file: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'settings-'));
  file = join(dir, 'nested', 'settings.json');
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe('settings persistence', () => {
  it('returns defaults when the file does not exist', () => {
    expect(loadSettings(file)).toEqual(DEFAULT_SETTINGS);
  });

  it('round-trips saved settings, creating folders', () => {
    const settings = { ...DEFAULT_SETTINGS, warnPercent: 70, displayId: 42 };
    saveSettings(file, settings);
    expect(loadSettings(file)).toEqual(settings);
  });

  it('backs up corrupt JSON and returns defaults', () => {
    saveSettings(file, DEFAULT_SETTINGS);
    writeFileSync(file, '{ not json');
    expect(loadSettings(file)).toEqual(DEFAULT_SETTINGS);
    expect(readFileSync(`${file}.bak`, 'utf8')).toBe('{ not json');
  });

  it('backs up schema-invalid settings and returns defaults', () => {
    saveSettings(file, DEFAULT_SETTINGS);
    writeFileSync(file, JSON.stringify({ claudeRefreshMs: 5 }));
    expect(loadSettings(file)).toEqual(DEFAULT_SETTINGS);
    expect(existsSync(`${file}.bak`)).toBe(true);
  });
});
