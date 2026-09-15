import { execFile } from 'node:child_process';
import { DEFAULT_THEME, parseAccentPalette, parseRegValue, type SystemTheme } from '../shared/theme';

export const PERSONALIZE_KEY = 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Themes\\Personalize';
export const ACCENT_KEY = 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Accent';

export interface ThemeDeps {
  platform: NodeJS.Platform;
  /** `reg query <key> [/v <value>]` output */
  queryRegistry(key: string, value?: string): Promise<string>;
  /** Chromium's view of dark mode, used when the registry can't be read */
  darkFallback(): boolean;
}

/** Windows Personalization > Colors: dark/light apps mode, transparency effects and the accent palette. */
export async function readSystemTheme(deps: ThemeDeps): Promise<SystemTheme> {
  const fallbackMode = deps.darkFallback() ? 'dark' : 'light';
  if (deps.platform !== 'win32') return { ...DEFAULT_THEME, mode: fallbackMode };

  const [personalize, accent] = await Promise.all([
    deps.queryRegistry(PERSONALIZE_KEY).catch(() => ''),
    deps.queryRegistry(ACCENT_KEY, 'AccentPalette').catch(() => ''),
  ]);
  const lightApps = parseRegValue(personalize, 'AppsUseLightTheme');
  const transparency = parseRegValue(personalize, 'EnableTransparency');
  return {
    mode: lightApps === null ? fallbackMode : lightApps === '0x1' ? 'light' : 'dark',
    // Windows defaults transparency effects to on.
    transparency: transparency === null ? true : transparency !== '0x0',
    accent: parseAccentPalette(parseRegValue(accent, 'AccentPalette')),
  };
}

export function defaultThemeDeps(darkFallback: () => boolean): ThemeDeps {
  return {
    platform: process.platform,
    darkFallback,
    queryRegistry: (key, value) =>
      new Promise((resolve, reject) => {
        const args = ['query', key, ...(value ? ['/v', value] : [])];
        execFile('reg.exe', args, { windowsHide: true, timeout: 2000 }, (error, stdout) => (error ? reject(error) : resolve(stdout)));
      }),
  };
}
