import type { Api } from '../shared/ipc';
import type { SystemTheme } from '../shared/theme';

/** Reflect the Windows theme on the page: CSS keys off `data-theme` / `data-transparency`. */
export function applyTheme(root: HTMLElement, theme: SystemTheme): void {
  root.dataset.theme = theme.mode;
  root.dataset.transparency = theme.transparency ? 'on' : 'off';
}

/** Apply the current theme now and whenever Windows personalization changes. */
export function followSystemTheme(api: Api, root: HTMLElement = document.documentElement): void {
  void api.getTheme().then((theme) => applyTheme(root, theme));
  api.onTheme((theme) => applyTheme(root, theme));
}
