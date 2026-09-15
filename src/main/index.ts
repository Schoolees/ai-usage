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
