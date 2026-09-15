import type { Api } from '../shared/ipc';
import { themeVariables, type SystemTheme } from '../shared/theme';

/** Reflect the Windows theme on the page: CSS keys off `data-theme` / `data-transparency` and the accent variables. */
export function applyTheme(root: HTMLElement, theme: SystemTheme): void {
  root.dataset.theme = theme.mode;
  root.dataset.transparency = theme.transparency ? 'on' : 'off';
  for (const [name, value] of Object.entries(themeVariables(theme))) root.style.setProperty(name, value);
}

/** Apply the current theme now and whenever Windows personalization changes. */
export function followSystemTheme(api: Api, root: HTMLElement = document.documentElement): void {
  void api.getTheme().then((theme) => applyTheme(root, theme));
  api.onTheme((theme) => applyTheme(root, theme));
}
