import { app } from 'electron';
import { APP_ID } from '../shared/app-id';
import { startApp, type RunningApp } from './app';
import { initLog } from './log';

const log = initLog();

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.setAppUserModelId(APP_ID);
  let running: RunningApp | undefined;

  app.on('second-instance', () => running?.island.show());
  // The app lives in the island and tray; closing windows must not quit it.
  app.on('window-all-closed', () => {});
  // Backstop for every webContents (including ones created later): a dropped link or file must
  // never navigate a window away from its own page, where it would keep window.api.
  app.on('web-contents-created', (_event, contents) => {
    contents.on('will-navigate', (event) => event.preventDefault());
    contents.setWindowOpenHandler(() => ({ action: 'deny' }));
  });

  app
    .whenReady()
    .then(async () => {
      running = await startApp(log);
    })
    .catch((error: unknown) => {
      log.error('startup failed', error);
      app.quit();
    });
}
