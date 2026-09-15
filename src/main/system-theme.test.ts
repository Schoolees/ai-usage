import { describe, expect, it, vi } from 'vitest';
import { ACCENT_KEY, PERSONALIZE_KEY, readSystemTheme, type ThemeDeps } from './system-theme';

const personalize = (light: string, transparency: string) => `
HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Themes\\Personalize
    EnableTransparency    REG_DWORD    ${transparency}
    AppsUseLightTheme    REG_DWORD    ${light}
`;
const accent = `
HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Accent
    AccentPalette    REG_BINARY    CAE7E900A9C7CB006D909B005A79840046606B002D404C00101C280088179800
`;

function deps(overrides: Partial<ThemeDeps> = {}): ThemeDeps {
  return {
    platform: 'win32',
    darkFallback: () => true,
    queryRegistry: vi.fn(async (key: string) => (key === PERSONALIZE_KEY ? personalize('0x0', '0x1') : accent)),
    ...overrides,
  };
}

describe('readSystemTheme', () => {
  it('reads mode, transparency and accent shades from the registry on Windows', async () => {
    const d = deps();
    expect(await readSystemTheme(d)).toEqual({
      mode: 'dark',
      transparency: true,
      accent: expect.objectContaining({ light2: '#a9c7cb', dark1: '#46606b' }),
    });
    expect(d.queryRegistry).toHaveBeenCalledWith(PERSONALIZE_KEY);
    expect(d.queryRegistry).toHaveBeenCalledWith(ACCENT_KEY, 'AccentPalette');
  });

  it('maps light apps mode and transparency off', async () => {
    const theme = await readSystemTheme(
      deps({ queryRegistry: async (key) => (key === PERSONALIZE_KEY ? personalize('0x1', '0x0') : accent) }),
    );
    expect(theme).toMatchObject({ mode: 'light', transparency: false });
  });

  it('falls back to Chromium dark mode, transparency on and no accent when the registry cannot be read', async () => {
    const theme = await readSystemTheme(
      deps({ darkFallback: () => false, queryRegistry: async () => Promise.reject(new Error('reg failed')) }),
    );
    expect(theme).toEqual({ mode: 'light', transparency: true, accent: null });
  });

  it('uses Chromium dark mode and no accent on other platforms without touching the registry', async () => {
    const queryRegistry = vi.fn();
    expect(await readSystemTheme(deps({ platform: 'linux', queryRegistry }))).toEqual({ mode: 'dark', transparency: false, accent: null });
    expect(queryRegistry).not.toHaveBeenCalled();
  });
});
