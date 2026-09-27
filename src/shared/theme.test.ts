import { describe, expect, it } from 'vitest';
import { parseRegValue, windowBackground } from './theme';

// Real `reg query` output from a Windows 11 machine (dark mode, transparency on).
const personalize = `
HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Themes\\Personalize
    ColorPrevalence    REG_DWORD    0x0
    EnableTransparency    REG_DWORD    0x1
    AppsUseLightTheme    REG_DWORD    0x0
    SystemUsesLightTheme    REG_DWORD    0x0
`;
describe('parseRegValue', () => {
  it('reads DWORD values by name', () => {
    expect(parseRegValue(personalize, 'EnableTransparency')).toBe('0x1');
    expect(parseRegValue(personalize, 'AppsUseLightTheme')).toBe('0x0');
  });

  it('returns null for a missing value', () => {
    expect(parseRegValue(personalize, 'Nope')).toBeNull();
    expect(parseRegValue('', 'EnableTransparency')).toBeNull();
  });
});

describe('windowBackground', () => {
  it('uses solid Windows surface colors', () => {
    expect(windowBackground({ mode: 'dark', transparency: false })).toBe('#202020');
    expect(windowBackground({ mode: 'light', transparency: false })).toBe('#f3f3f3');
  });

  it('stays solid when transparency effects are on', () => {
    expect(windowBackground({ mode: 'dark', transparency: true })).toBe('#202020');
  });
});
