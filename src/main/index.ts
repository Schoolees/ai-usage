import { app, BrowserWindow } from 'electron';
import { join } from 'node:path';

app.whenReady().then(() => {
  const win = new BrowserWindow({
    width: 320,
    height: 120,
    webPreferences: { preload: join(__dirname, '../preload/index.js'), sandbox: true, contextIsolation: true },
  });
  if (!app.isPackaged && process.env.ELECTRON_RENDERER_URL) {
    void win.loadURL(`${process.env.ELECTRON_RENDERER_URL}/island.html`);
  } else {
    void win.loadFile(join(__dirname, '../renderer/island.html'));
  }
});
