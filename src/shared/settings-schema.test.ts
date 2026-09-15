import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, SettingsSchema, mergeSettings, providerSettings } from './settings-schema';

describe('settings schema', () => {
  it('fills every default from an empty object', () => {
    expect(SettingsSchema.parse({})).toEqual({
      providers: { claude: { enabled: true, sourceHome: null }, codex: { enabled: true, sourceHome: null } },
      displayId: null,
      warnPercent: 80,
      criticalPercent: 95,
      claudeRefreshMs: 120_000,
      alertsEnabled: true,
      hideInFullscreen: true,
      openAtLogin: true,
    });
    expect(DEFAULT_SETTINGS.warnPercent).toBe(80);
  });

  it('rejects a refresh interval under one minute', () => {
    expect(SettingsSchema.safeParse({ claudeRefreshMs: 30_000 }).success).toBe(false);
  });

  it('rejects warn >= critical', () => {
    expect(SettingsSchema.safeParse({ warnPercent: 95, criticalPercent: 95 }).success).toBe(false);
  });

  it('merges a patch and keeps untouched providers', () => {
    const next = mergeSettings(DEFAULT_SETTINGS, {
      warnPercent: 70,
      providers: { ...DEFAULT_SETTINGS.providers, codex: { enabled: false, sourceHome: null } },
    });
    expect(next.warnPercent).toBe(70);
    expect(next.providers.claude).toEqual({ enabled: true, sourceHome: null });
    expect(next.providers.codex.enabled).toBe(false);
  });

  it('throws when a patch is invalid', () => {
    expect(() => mergeSettings(DEFAULT_SETTINGS, { criticalPercent: 50 })).toThrow();
  });

  it('returns enabled defaults for an unknown provider', () => {
    expect(providerSettings(DEFAULT_SETTINGS, 'gemini')).toEqual({ enabled: true, sourceHome: null });
  });
});
