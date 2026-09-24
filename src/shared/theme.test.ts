import { describe, expect, it } from 'vitest';
import { DEFAULT_THEME, contrastText, parseAccentPalette, parseRegValue, themeVariables, windowBackground, type SystemTheme } from './theme';

// Real `reg query` output from a Windows 11 machine (dark mode, transparency on, blue-grey accent).
const personalize = `
HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Themes\\Personalize
    ColorPrevalence    REG_DWORD    0x0
    EnableTransparency    REG_DWORD    0x1
    AppsUseLightTheme    REG_DWORD    0x0
    SystemUsesLightTheme    REG_DWORD    0x0
`;
const accent = `
HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Accent
    AccentPalette    REG_BINARY    CAE7E900A9C7CB006D909B005A79840046606B002D404C00101C280088179800
`;

describe('parseRegValue', () => {
  it('reads DWORD and binary values by name', () => {
    expect(parseRegValue(personalize, 'EnableTransparency')).toBe('0x1');
    expect(parseRegValue(personalize, 'AppsUseLightTheme')).toBe('0x0');
    expect(parseRegValue(accent, 'AccentPalette')).toBe('CAE7E900A9C7CB006D909B005A79840046606B002D404C00101C280088179800');
  });

  it('returns null for a missing value', () => {
    expect(parseRegValue(personalize, 'Nope')).toBeNull();
    expect(parseRegValue('', 'EnableTransparency')).toBeNull();
  });
});

describe('parseAccentPalette', () => {
  it('maps the 4-byte RGBA entries to Windows accent shades', () => {
    expect(parseAccentPalette('CAE7E900A9C7CB006D909B005A79840046606B002D404C00101C280088179800')).toEqual({
      light3: '#cae7e9',
      light2: '#a9c7cb',
      light1: '#6d909b',
      base: '#5a7984',
      dark1: '#46606b',
      dark2: '#2d404c',
      dark3: '#101c28',
    });
  });

  it('rejects malformed palettes', () => {
    expect(parseAccentPalette('CAE7E9')).toBeNull();
    expect(parseAccentPalette(null)).toBeNull();
    expect(parseAccentPalette('ZZ'.repeat(32))).toBeNull();
  });
});

describe('contrastText', () => {
  it('picks dark text on light colors and white text on dark colors', () => {
    expect(contrastText('#a9c7cb')).toBe('#000000');
    expect(contrastText('#2f67e1')).toBe('#ffffff');
    expect(contrastText('#46606b')).toBe('#ffffff');
  });
});

describe('themeVariables', () => {
  const palette = parseAccentPalette('CAE7E900A9C7CB006D909B005A79840046606B002D404C00101C280088179800')!;

  it('uses the Light2 accent shade in dark mode, like Windows Settings', () => {
    const dark: SystemTheme = { mode: 'dark', transparency: true, accent: palette };
    expect(themeVariables(dark)).toEqual({ '--primary': '#a9c7cb', '--primary-hover': '#cae7e9', '--on-primary': '#000000' });
  });

  it('uses the Dark1 accent shade in light mode', () => {
    const light: SystemTheme = { mode: 'light', transparency: false, accent: palette };
    expect(themeVariables(light)).toEqual({ '--primary': '#46606b', '--primary-hover': '#2d404c', '--on-primary': '#ffffff' });
  });

  it('falls back to the app palette primary without a system accent', () => {
    expect(themeVariables(DEFAULT_THEME)['--primary']).toBe('#2f67e1');
    expect(DEFAULT_THEME).toMatchObject({ mode: 'dark', transparency: false, accent: null });
  });
});

describe('windowBackground', () => {
  it('uses solid Windows surface colors', () => {
    expect(windowBackground({ mode: 'dark', transparency: false, accent: null })).toBe('#202020');
    expect(windowBackground({ mode: 'light', transparency: false, accent: null })).toBe('#f3f3f3');
  });

  it('stays solid when transparency effects are on', () => {
    expect(windowBackground({ mode: 'dark', transparency: true, accent: null })).toBe('#202020');
  });
});
