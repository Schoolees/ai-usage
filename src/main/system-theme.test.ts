import { describe, expect, it, vi } from 'vitest';
import { PERSONALIZE_KEY, readSystemTheme, type ThemeDeps } from './system-theme';

const personalize = (light: string, transparency: string) => `
HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Themes\\Personalize
    EnableTransparency    REG_DWORD    ${transparency}
    AppsUseLightTheme    REG_DWORD    ${light}
`;

function deps(overrides: Partial<ThemeDeps> = {}): ThemeDeps {
  return {
    platform: 'win32',
    darkFallback: () => true,
    queryRegistry: vi.fn(async () => personalize('0x0', '0x1')),
    ...overrides,
  };
}

describe('readSystemTheme', () => {
  it('reads mode and transparency from the registry on Windows', async () => {
    const d = deps();
    expect(await readSystemTheme(d)).toEqual({
      mode: 'dark',
      transparency: true,
    });
    expect(d.queryRegistry).toHaveBeenCalledWith(PERSONALIZE_KEY);
  });

  it('maps light apps mode and transparency off', async () => {
    const theme = await readSystemTheme(
      deps({ queryRegistry: async () => personalize('0x1', '0x0') }),
    );
    expect(theme).toMatchObject({ mode: 'light', transparency: false });
  });

  it('falls back to Chromium dark mode, transparency on when the registry cannot be read', async () => {
    const theme = await readSystemTheme(
      deps({ darkFallback: () => false, queryRegistry: async () => Promise.reject(new Error('reg failed')) }),
    );
    expect(theme).toEqual({ mode: 'light', transparency: true });
  });

  it('uses Chromium dark mode on other platforms without touching the registry', async () => {
    const queryRegistry = vi.fn();
    expect(await readSystemTheme(deps({ platform: 'linux', queryRegistry }))).toEqual({ mode: 'dark', transparency: false });
    expect(queryRegistry).not.toHaveBeenCalled();
  });
});
