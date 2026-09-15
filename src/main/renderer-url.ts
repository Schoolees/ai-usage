import { app, type BrowserWindow } from 'electron';
import { join } from 'node:path';

export function loadRenderer(win: BrowserWindow, page: 'island' | 'settings'): void {
  if (!app.isPackaged && process.env.ELECTRON_RENDERER_URL) {
    void win.loadURL(`${process.env.ELECTRON_RENDERER_URL}/${page}.html`);
  } else {
    void win.loadFile(join(__dirname, `../renderer/${page}.html`));
  }
}
