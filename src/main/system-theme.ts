import { execFile } from 'node:child_process';
import { DEFAULT_THEME, parseRegValue, type SystemTheme } from '../shared/theme';

export const PERSONALIZE_KEY = 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Themes\\Personalize';

export interface ThemeDeps {
  platform: NodeJS.Platform;
  /** `reg query <key>` output */
  queryRegistry(key: string): Promise<string>;
  /** Chromium's view of dark mode, used when the registry can't be read */
  darkFallback(): boolean;
}

/** Windows Personalization > Colors: dark/light apps mode and transparency effects. */
export async function readSystemTheme(deps: ThemeDeps): Promise<SystemTheme> {
  const fallbackMode = deps.darkFallback() ? 'dark' : 'light';
  if (deps.platform !== 'win32') return { ...DEFAULT_THEME, mode: fallbackMode };

  const personalize = await deps.queryRegistry(PERSONALIZE_KEY).catch(() => '');
  const lightApps = parseRegValue(personalize, 'AppsUseLightTheme');
  const transparency = parseRegValue(personalize, 'EnableTransparency');
  return {
    mode: lightApps === null ? fallbackMode : lightApps === '0x1' ? 'light' : 'dark',
    // Windows defaults transparency effects to on.
    transparency: transparency === null ? true : transparency !== '0x0',
  };
}

export function defaultThemeDeps(darkFallback: () => boolean): ThemeDeps {
  return {
    platform: process.platform,
    darkFallback,
    queryRegistry: (key) =>
      new Promise((resolve, reject) => {
        execFile('reg.exe', ['query', key], { windowsHide: true, timeout: 2000 }, (error, stdout) => (error ? reject(error) : resolve(stdout)));
      }),
  };
}
