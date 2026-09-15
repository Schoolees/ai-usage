/** Windows Personalization > Colors, as read by the main process and pushed to every window. */
export interface AccentShades {
  light3: string;
  light2: string;
  light1: string;
  base: string;
  dark1: string;
  dark2: string;
  dark3: string;
}

export interface SystemTheme {
  mode: 'dark' | 'light';
  /** Windows "Transparency effects" */
  transparency: boolean;
  /** null when the system accent is unavailable (non-Windows, or the registry read failed) */
  accent: AccentShades | null;
}

export const DEFAULT_THEME: SystemTheme = { mode: 'dark', transparency: false, accent: null };

/** App palette primary (see palette.css) used when there is no system accent: [light, dark]. */
const FALLBACK_PRIMARY = { light: '#2563eb', dark: '#2f67e1' } as const;
const FALLBACK_PRIMARY_HOVER = { light: '#1d4ed8', dark: '#5a86ea' } as const;

/** Value column of one line of `reg query` output, e.g. `EnableTransparency    REG_DWORD    0x1` → `0x1`. */
export function parseRegValue(output: string, name: string): string | null {
  for (const line of output.split(/\r?\n/)) {
    const parts = line.trim().split(/\s{2,}|\t+/);
    if (parts.length >= 3 && parts[0] === name) return parts[2].trim();
  }
  return null;
}

/**
 * `AccentPalette` is 8 × 4 bytes of RGBA: Light3, Light2, Light1, Base, Dark1, Dark2, Dark3, (unused).
 */
export function parseAccentPalette(hex: string | null): AccentShades | null {
  if (!hex || !/^[0-9a-fA-F]{56,}$/.test(hex)) return null;
  const color = (index: number) => `#${hex.slice(index * 8, index * 8 + 6).toLowerCase()}`;
  return {
    light3: color(0),
    light2: color(1),
    light1: color(2),
    base: color(3),
    dark1: color(4),
    dark2: color(5),
    dark3: color(6),
  };
}

/** Black or white, whichever reads better on `hex` (WCAG relative luminance). */
export function contrastText(hex: string): '#000000' | '#ffffff' {
  const channel = (i: number) => {
    const c = parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const luminance = 0.2126 * channel(0) + 0.7152 * channel(1) + 0.0722 * channel(2);
  const onWhite = 1.05 / (luminance + 0.05);
  const onBlack = (luminance + 0.05) / 0.05;
  return onBlack >= onWhite ? '#000000' : '#ffffff';
}

/** CSS custom properties derived from the theme. Windows uses Light2 for accents in dark mode and Dark1 in light mode. */
export function themeVariables(theme: SystemTheme): Record<'--primary' | '--primary-hover' | '--on-primary', string> {
  const dark = theme.mode === 'dark';
  const primary = theme.accent ? (dark ? theme.accent.light2 : theme.accent.dark1) : FALLBACK_PRIMARY[theme.mode];
  const hover = theme.accent ? (dark ? theme.accent.light3 : theme.accent.dark2) : FALLBACK_PRIMARY_HOVER[theme.mode];
  return { '--primary': primary, '--primary-hover': hover, '--on-primary': contrastText(primary) };
}

export interface WindowChrome {
  backgroundMaterial: 'mica' | 'none';
  backgroundColor: string;
}

/** Native window colors for the settings window: Mica when transparency effects are on, Windows' solid surface otherwise. */
export function windowChrome(theme: SystemTheme): WindowChrome {
  if (theme.transparency) return { backgroundMaterial: 'mica', backgroundColor: '#00000000' };
  return { backgroundMaterial: 'none', backgroundColor: theme.mode === 'dark' ? '#202020' : '#f3f3f3' };
}
