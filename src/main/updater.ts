import { app, Notification } from 'electron';
import electronUpdater from 'electron-updater';
import { HOUR, MINUTE } from '../shared/time';
import type { initLog } from './log';
import type { UpdateStatus } from './update-state';

const { autoUpdater } = electronUpdater;

/** Let the app settle before the first check, so startup stays quick. */
const FIRST_CHECK_DELAY = MINUTE;
const CHECK_EVERY = 6 * HOUR;

export interface Updater {
  status(): UpdateStatus;
  /** Check now (from the tray) */
  check(): void;
  /** Quit and install a downloaded update */
  install(): void;
  /**
   * Called while quitting: installs a downloaded update and relaunches into it. Returns true when it
   * has taken over the quit, so the caller should stop and let the updater restart the app.
   */
  installOnQuit(): boolean;
  setEnabled(enabled: boolean): void;
  stop(): void;
}

export interface UpdaterOptions {
  log: ReturnType<typeof initLog>;
  enabled: boolean;
  onStatus(status: UpdateStatus): void;
  /** Shown when an update is ready; clicking it restarts into the new version. */
  onReadyNotification(version: string, install: () => void): void;
}

/**
 * Updates from the project's GitHub releases (public repo, no token). Downloads in the background and
 * installs when the app quits, restarting into the new version; the tray offers a restart as soon as
 * one is ready.
 */
export function createUpdater({ log, enabled, onStatus, onReadyNotification }: UpdaterOptions): Updater {
  let status: UpdateStatus = { state: enabled ? 'idle' : 'disabled', version: null };
  let timer: ReturnType<typeof setInterval> | undefined;
  let firstCheck: ReturnType<typeof setTimeout> | undefined;
  let allowed = enabled;
  let installing = false;

  const set = (next: UpdateStatus) => {
    status = next;
    onStatus(next);
  };

  // In development there is no installed app to replace, and no packaged version to compare against.
  if (!app.isPackaged) {
    log.info('updates: skipped (not a packaged build)');
    return {
      status: () => ({ state: 'disabled', version: null }),
      check: () => {},
      install: () => {},
      installOnQuit: () => false,
      setEnabled: () => {},
      stop: () => {},
    };
  }

  autoUpdater.logger = log;
  autoUpdater.autoDownload = true;
  // electron-updater's own install-on-quit runs the installer without relaunching, so the app just
  // disappears when you quit it. We install from the quit path ourselves to bring it back.
  autoUpdater.autoInstallOnAppQuit = false;

  /** isSilent, isForceRunAfter: no installer window, and the app comes back in the new version. */
  const quitAndInstall = () => {
    installing = true;
    log.info(`updates: installing ${status.version ?? ''} and restarting`);
    autoUpdater.quitAndInstall(true, true);
  };

  autoUpdater.on('checking-for-update', () => set({ state: 'checking', version: null }));
  autoUpdater.on('update-not-available', () => set({ state: 'up-to-date', version: null }));
  autoUpdater.on('update-available', (info) => set({ state: 'available', version: info.version }));
  autoUpdater.on('download-progress', (progress) => set({ state: 'downloading', version: status.version, percent: progress.percent }));
  autoUpdater.on('update-downloaded', (info) => {
    set({ state: 'ready', version: info.version });
    onReadyNotification(info.version, quitAndInstall);
  });
  autoUpdater.on('error', (error) => {
    log.warn('updates: check failed', error);
    set({ state: 'error', version: null });
  });

  const check = () => {
    if (!allowed) return;
    void autoUpdater.checkForUpdates().catch(() => {
      // 'error' above already recorded it.
    });
  };

  const start = () => {
    firstCheck = setTimeout(check, FIRST_CHECK_DELAY);
    timer = setInterval(check, CHECK_EVERY);
  };

  const stop = () => {
    if (firstCheck) clearTimeout(firstCheck);
    if (timer) clearInterval(timer);
    firstCheck = undefined;
    timer = undefined;
  };

  if (allowed) start();

  return {
    status: () => status,
    check,
    install: quitAndInstall,
    installOnQuit: () => {
      // quitAndInstall quits again once the installer is running; that pass must fall through.
      if (installing || status.state !== 'ready') return false;
      quitAndInstall();
      return true;
    },
    setEnabled: (next) => {
      if (next === allowed) return;
      allowed = next;
      if (next) {
        set({ state: 'idle', version: null });
        start();
        check();
      } else {
        stop();
        // A downloaded update still installs when the app quits; nothing new will be fetched.
        if (status.state !== 'ready') set({ state: 'disabled', version: null });
      }
    },
    stop,
  };
}

export function notifyUpdateReady(version: string, install: () => void): void {
  if (!Notification.isSupported()) return;
  const notification = new Notification({
    title: `AI Usage ${version} is ready`,
    body: 'Restart now to update, or it installs when you quit.',
  });
  notification.on('click', install);
  notification.show();
}
