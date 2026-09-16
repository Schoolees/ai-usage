import { z } from 'zod';

export const ProviderSettingsSchema = z.object({
  enabled: z.boolean(),
  /** Home folder chosen in Settings; null = pick the most recently modified source */
  sourceHome: z.string().nullable(),
});

export const SettingsSchema = z
  .object({
    providers: z
      .record(z.string(), ProviderSettingsSchema)
      .default({ claude: { enabled: true, sourceHome: null }, codex: { enabled: true, sourceHome: null } }),
    displayId: z.number().nullable().default(null),
    warnPercent: z.number().int().min(1).max(100).default(80),
    criticalPercent: z.number().int().min(1).max(100).default(95),
    claudeRefreshMs: z.number().int().min(60_000).default(120_000),
    alertsEnabled: z.boolean().default(true),
    hideInFullscreen: z.boolean().default(true),
    openAtLogin: z.boolean().default(true),
    autoUpdate: z.boolean().default(true),
  })
  .refine((s) => s.warnPercent < s.criticalPercent, {
    message: 'Warning threshold must be below the critical threshold',
    path: ['warnPercent'],
  });

export type Settings = z.infer<typeof SettingsSchema>;
export type ProviderSettings = z.infer<typeof ProviderSettingsSchema>;
export type SettingsPatch = Partial<Settings>;

export const DEFAULT_SETTINGS: Settings = SettingsSchema.parse({});

export function mergeSettings(current: Settings, patch: SettingsPatch): Settings {
  return SettingsSchema.parse({
    ...current,
    ...patch,
    providers: { ...current.providers, ...patch.providers },
  });
}

export function providerSettings(settings: Settings, providerId: string): ProviderSettings {
  return settings.providers[providerId] ?? { enabled: true, sourceHome: null };
}
