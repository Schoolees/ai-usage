import { copyFileSync } from 'node:fs';
import { DEFAULT_SETTINGS, SettingsSchema, type Settings } from '../shared/settings-schema';
import { readJson, writeJsonAtomic } from './json-file';

function backup(file: string): void {
  try {
    copyFileSync(file, `${file}.bak`);
  } catch {
    // nothing to back up
  }
}

export function loadSettings(file: string): Settings {
  let raw: unknown;
  try {
    raw = readJson(file);
  } catch {
    backup(file);
    return DEFAULT_SETTINGS;
  }
  if (raw === undefined) return DEFAULT_SETTINGS;
  const parsed = SettingsSchema.safeParse(raw);
  if (!parsed.success) {
    backup(file);
    return DEFAULT_SETTINGS;
  }
  return parsed.data;
}

export function saveSettings(file: string, settings: Settings): void {
  writeJsonAtomic(file, SettingsSchema.parse(settings));
}
