/** Windows Personalization > Colors, as read by the main process and pushed to every window. */
export interface SystemTheme {
  mode: 'dark' | 'light';
  /** Windows "Transparency effects" */
  transparency: boolean;
}

export const DEFAULT_THEME: SystemTheme = { mode: 'dark', transparency: false };

/** Value column of one line of `reg query` output, e.g. `EnableTransparency    REG_DWORD    0x1` → `0x1`. */
export function parseRegValue(output: string, name: string): string | null {
  for (const line of output.split(/\r?\n/)) {
    const parts = line.trim().split(/\s{2,}|\t+/);
    if (parts.length >= 3 && parts[0] === name) return parts[2].trim();
  }
  return null;
}

/** Native background color for the settings window: Windows' solid Settings surface. */
export function windowBackground(theme: SystemTheme): string {
  return theme.mode === 'dark' ? '#202020' : '#f3f3f3';
}
