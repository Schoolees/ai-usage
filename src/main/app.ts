import { app, ipcMain, nativeTheme, powerMonitor, screen, shell, systemPreferences, type IpcMainEvent, type IpcMainInvokeEvent, type WebContents } from 'electron';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { IPC, type DisplayOption, type ProviderOption } from '../shared/ipc';
import { mergeSettings, providerSettings, type Settings, type SettingsPatch } from '../shared/settings-schema';
import { DEFAULT_THEME, type SystemTheme } from '../shared/theme';
import { MINUTE } from '../shared/time';
import type { DetectedSource, Snapshot } from '../shared/types';
import { buildProviderView, type IslandView } from '../shared/view-model';
import { listDisplays } from './displays';
import { pickDisplay } from './island-geometry';
import { IslandWindow } from './island-window';
import type { initLog } from './log';
import { createProviders } from './providers';
import { Scheduler, type ScheduledTask } from './scheduler';
import { loadSettings, saveSettings } from './settings';
import { createRunningDistroCache, defaultDetectDeps, distroFromHome, listCandidateHomes, pickSource } from './sources/detect';
import { loadState, saveState } from './state-file';
import { UsageStore } from './usage-store';
import trayIcon from '../../resources/tray.ico?asset';
import { openSettingsWindow, settingsContents, updateSettingsWindowTheme } from './settings-window';
import { fromWindow, isOptionalAge, isPixelSize, isPlainObject } from './ipc-guard';
import { defaultThemeDeps, readSystemTheme } from './system-theme';
import { createTray } from './tray';
import { hasLoginCommand, startLogin } from './switch-account';
import { justUpdated } from './update-state';
import { createUpdater, notifyUpdated, notifyUpdateReady } from './updater';
import { AlertEngine } from './alert-engine';
import { alertText } from './alert-text';
import { showAlert } from './notifier';
import { createForegroundReader } from './foreground-window';
import { FullscreenWatch } from './fullscreen';

/**
 * A sign-in finishes in its own console, at whatever pace the user clicks through the browser, so
 * nudge the scheduler a few times rather than guessing at one delay.
 */
const SWITCH_REFRESH_DELAYS = [5_000, 20_000, 60_000];

export interface RunningApp {
  island: IslandWindow;
  scheduler: Scheduler;
  tray: ReturnType<typeof createTray>;
}

export async function startApp(log: ReturnType<typeof initLog>): Promise<RunningApp> {
  const userData = app.getPath('userData');
  const settingsFile = join(userData, 'settings.json');
  const stateFile = join(userData, 'state.json');

  let settings: Settings = loadSettings(settingsFile);
  const stateFileExisted = existsSync(stateFile);
  const persisted = loadState(stateFile);
  const store = new UsageStore(persisted.lastGood);
  const alerts = new AlertEngine(persisted.alertsFired);
  const plugins = createProviders();
  const detected: Record<string, DetectedSource[]> = {};
  // Only running distros are probed (spec §4): scheduled fetches must never boot a stopped one.
  const wslDistroCache = createRunningDistroCache(defaultDetectDeps().listRunningDistros);

  const islandDisplay = () => pickDisplay(listDisplays(), settings.displayId);
  const island = new IslandWindow(islandDisplay);

  // Windows Personalization > Colors (mode, accent, transparency), pushed to both windows on change.
  let theme: SystemTheme = DEFAULT_THEME;
  const themeDeps = defaultThemeDeps(() => nativeTheme.shouldUseDarkColors);
  const refreshTheme = async () => {
    const next = await readSystemTheme(themeDeps).catch(() => theme);
    if (JSON.stringify(next) === JSON.stringify(theme)) return;
    theme = next;
    if (!island.win.isDestroyed()) island.win.webContents.send(IPC.themeUpdate, theme);
    updateSettingsWindowTheme(theme);
  };

  /**
   * Runs after every detection. A plain hook rather than a call to the tray, because detectAll can run
   * (through the providers IPC handler) before the tray exists; the tray assigns this once it does.
   */
  let afterDetect: () => void = () => {};

  async function detectAll(): Promise<void> {
    const candidates = await listCandidateHomes(defaultDetectDeps());
    for (const plugin of plugins) {
      detected[plugin.id] = await plugin.detectSources(candidates).catch((error: unknown) => {
        log.warn(`source detection failed for ${plugin.id}`, error);
        return [];
      });
    }
    afterDetect();
  }

  const enabledPlugins = () => plugins.filter((plugin) => providerSettings(settings, plugin.id).enabled);

  function view(): IslandView {
    const now = Date.now();
    return {
      generatedAt: now,
      providers: enabledPlugins().map((plugin) =>
        buildProviderView({
          id: plugin.id,
          name: plugin.name,
          shortName: plugin.shortName,
          fromLogs: plugin.fromLogs,
          staleAfterMs: plugin.staleAfterMs,
          entry: store.get(plugin.id),
          now,
          warnPercent: settings.warnPercent,
          criticalPercent: settings.criticalPercent,
        }),
      ),
    };
  }

  const pushView = () => {
    if (!island.win.isDestroyed()) island.win.webContents.send(IPC.viewUpdate, view());
  };

  function writeState(): void {
    try {
      saveState(stateFile, { lastGood: store.lastGoodMap(), alertsFired: alerts.firedKeys(), lastVersion: app.getVersion() });
    } catch (error) {
      log.warn('could not save state', error);
    }
  }

  let saveTimer: ReturnType<typeof setTimeout> | undefined;
  const persist = () => {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(writeState, 1000);
  };

  const tasks = (): ScheduledTask[] =>
    enabledPlugins().map((plugin) => ({
      id: plugin.id,
      intervalMs: () => plugin.intervalMs(settings),
      run: async (): Promise<Snapshot> => {
        const now = Date.now();
        const source = pickSource(detected[plugin.id] ?? [], providerSettings(settings, plugin.id).sourceHome);
        if (!source) {
          return { providerId: plugin.id, source: null, status: 'not-found', dataAsOf: now, limits: [], message: plugin.notFoundMessage };
        }
        if (source.kind === 'wsl') {
          const distro = distroFromHome(source.home);
          if (distro && !(await wslDistroCache.isRunning(distro))) {
            return { providerId: plugin.id, source, status: 'not-found', dataAsOf: now, limits: [], message: `${source.label} is not running` };
          }
        }
        return plugin.fetch(source, now);
      },
    }));

  function onSnapshot(snapshot: Snapshot, nextRunAt: number): void {
    const { previous } = store.update(snapshot, nextRunAt);
    if (settings.alertsEnabled) {
      const now = Date.now();
      alerts.prune(now);
      const events = alerts.evaluate({
        previous: previous?.lastGood,
        next: snapshot,
        warnPercent: settings.warnPercent,
        criticalPercent: settings.criticalPercent,
        now,
      });
      for (const event of events) {
        const providerName = plugins.find((plugin) => plugin.id === event.providerId)?.name ?? event.providerId;
        const text = alertText(event, providerName, now);
        // Logged so "a notification showed up" can always be traced back to what and why.
        log.info(`alert: ${text.title} — ${text.body}`);
        showAlert(text, () => island.expand());
      }
    }
    if (snapshot.status === 'error') log.warn(`${snapshot.providerId}: ${snapshot.message ?? 'error'}`);
    persist();
    pushView();
  }

  // Created empty and not started so IPC handlers below can reference it immediately; once
  // detectAll() resolves, setTasks(tasks()) supplies the real tasks and starts the scheduler.
  const scheduler = new Scheduler([], onSnapshot);

  // Declared before the functions that use it: settings can change (tray or IPC) while startup is
  // still awaiting source detection, and a const declared further down would throw on access.
  let fullscreenWatch: FullscreenWatch | null = null;

  function applyPlatformSettings(): void {
    if (settings.hideInFullscreen) fullscreenWatch?.start();
    else fullscreenWatch?.stop();
    // In dev the login item would point at electron.exe, so only the installed app registers itself.
    if (app.isPackaged) app.setLoginItemSettings({ openAtLogin: settings.openAtLogin });
    updater?.setEnabled(settings.autoUpdate);
  }

  function applySettings(next: Settings): Settings {
    const previous = settings;
    settings = next;
    try {
      saveSettings(settingsFile, next);
    } catch (error) {
      log.warn('could not save settings', error);
    }
    island.reposition();
    if (JSON.stringify(previous.providers) !== JSON.stringify(next.providers) || previous.claudeRefreshMs !== next.claudeRefreshMs) {
      scheduler.setTasks(tasks());
    }
    applyPlatformSettings();
    trayHandle.rebuild();
    pushView();
    return settings;
  }

  // Each channel answers only the window that uses it: the island drives usage, sign-in and its own
  // size; the settings window reads and writes settings. Anything else is dropped (sends) or
  // rejected (invokes) and logged.
  const islandPage = () => [island.win.isDestroyed() ? null : island.win.webContents];
  const settingsPage = () => [settingsContents()];
  const eitherPage = () => [...islandPage(), ...settingsPage()];
  type Pages = () => (WebContents | null)[];

  const refuse = (channel: string) => log.warn(`ipc: refused ${channel} from an unexpected sender or with bad arguments`);
  function on(channel: string, pages: Pages, listener: (...args: unknown[]) => void): void {
    ipcMain.on(channel, (event: IpcMainEvent, ...args: unknown[]) => {
      if (fromWindow(event, pages())) listener(...args);
      else refuse(channel);
    });
  }
  function handle(channel: string, pages: Pages, listener: (...args: unknown[]) => unknown): void {
    ipcMain.handle(channel, (event: IpcMainInvokeEvent, ...args: unknown[]) => {
      if (fromWindow(event, pages())) return listener(...args);
      refuse(channel);
      throw new Error(`${channel} is not available to this window`);
    });
  }

  // Registered before the first await (detectAll, below) so the renderer's earliest getView(),
  // resizeIsland and setExpanded calls are never dropped while source detection is in flight.
  handle(IPC.viewGet, islandPage, () => view());
  /** The source a provider is being read from right now: the configured one, or the automatic pick. */
  const activeSource = (providerId: string) => pickSource(detected[providerId] ?? [], providerSettings(settings, providerId).sourceHome);

  const switchAccount = (providerId: string) => {
    const source = activeSource(providerId);
    if (!source) {
      log.warn(`switch account: no source detected for ${providerId}`);
      return;
    }
    if (startLogin(providerId, source, log)) {
      // The first refresh after the user finishes signing in shows the new account's usage.
      for (const delay of SWITCH_REFRESH_DELAYS) setTimeout(() => void scheduler.refreshNow(), delay);
    }
  };

  handle(IPC.refresh, islandPage, (olderThanMs) => {
    if (!isOptionalAge(olderThanMs)) throw new Error('refresh: olderThanMs must be a non-negative number');
    return scheduler.refreshNow({ olderThanMs });
  });
  on(IPC.islandResize, islandPage, (width, height) => {
    if (isPixelSize(width) && isPixelSize(height)) island.resize(Math.round(width), Math.round(height));
    else refuse(IPC.islandResize);
  });
  on(IPC.islandSetExpanded, islandPage, (expanded) => island.setExpanded(expanded === true));
  on(IPC.islandSetInteractive, islandPage, (interactive) => island.setInteractive(interactive === true));
  on(IPC.openUsagePage, islandPage, (providerId) => {
    const url = plugins.find((plugin) => plugin.id === providerId)?.usageUrl;
    if (url) void shell.openExternal(url);
  });
  on(IPC.switchAccount, islandPage, (providerId) => {
    if (typeof providerId === 'string') switchAccount(providerId);
    else refuse(IPC.switchAccount);
  });
  handle(IPC.settingsGet, settingsPage, () => settings);
  handle(IPC.settingsSet, settingsPage, (patch) => {
    if (!isPlainObject(patch)) throw new Error('settings: patch must be an object');
    return applySettings(mergeSettings(settings, patch as SettingsPatch));
  });
  handle(IPC.providersGet, settingsPage, async (): Promise<ProviderOption[]> => {
    await detectAll();
    return plugins.map((plugin) => ({
      id: plugin.id,
      name: plugin.name,
      sources: (detected[plugin.id] ?? []).map(({ kind, label, home, lastModifiedMs }) => ({ kind, label, home, lastModifiedMs })),
      activeHome: activeSource(plugin.id)?.home ?? null,
    }));
  });
  handle(IPC.displaysGet, settingsPage, (): DisplayOption[] => listDisplays().map(({ id, label, primary }) => ({ id, label, primary })));
  handle(IPC.appInfoGet, settingsPage, () => ({ version: app.getVersion() }));
  handle(IPC.themeGet, eitherPage, () => theme);
  on(IPC.openSettings, islandPage, () => openSettingsWindow(theme));

  const updater = createUpdater({
    log,
    enabled: settings.autoUpdate,
    onStatus: () => trayHandle?.rebuild(),
    onReadyNotification: notifyUpdateReady,
  });

  const trayHandle = createTray(trayIcon, {
    toggleIsland: () => island.toggleUserHidden(),
    isIslandVisible: () => island.isUserVisible(),
    refresh: () => void scheduler.refreshNow(),
    openSettings: () => openSettingsWindow(theme),
    getOpenAtLogin: () => settings.openAtLogin,
    setOpenAtLogin: (value) => {
      applySettings(mergeSettings(settings, { openAtLogin: value }));
    },
    switchableProviders: () =>
      plugins.filter((plugin) => hasLoginCommand(plugin.id) && activeSource(plugin.id)).map(({ id, name }) => ({ id, name })),
    switchAccount,
    updateStatus: () => updater.status(),
    checkForUpdates: () => updater.check(),
    installUpdate: () => updater.install(),
    quit: () => app.quit(),
  });

  // The tray's "Switch account" entries depend on which sources were found.
  afterDetect = () => trayHandle.rebuild();
  await detectAll();
  scheduler.setTasks(tasks());
  setInterval(() => void detectAll(), 5 * MINUTE);
  // Staleness is time-based, so re-send the view even when no fetch happened.
  setInterval(pushView, 30_000);

  // Flush any pending debounced write so the last alert keys and usage numbers survive quit.
  app.on('before-quit', (event) => {
    clearTimeout(saveTimer);
    writeState();
    // A downloaded update installs as the app quits. Hold the quit so the installer can restart us,
    // otherwise the app would silently vanish until the user launches it again.
    if (updater.installOnQuit()) event.preventDefault();
  });

  // Versions before 0.1.8 did not record themselves, but a state file means the app has run before.
  const previousVersion = persisted.lastVersion ?? (stateFileExisted ? 'an earlier version' : null);
  if (justUpdated(previousVersion, app.getVersion())) {
    log.info(`updates: now running ${app.getVersion()} (was ${previousVersion})`);
    notifyUpdated(app.getVersion());
  }
  // Record this version now, so the confirmation shows once rather than on every launch until the
  // next debounced save.
  writeState();

  void refreshTheme();
  nativeTheme.on('updated', () => void refreshTheme());
  systemPreferences.on('accent-color-changed', () => void refreshTheme());
  // Transparency toggles don't always raise an event; re-check occasionally.
  setInterval(() => void refreshTheme(), 30_000);

  screen.on('display-added', () => island.reposition());
  screen.on('display-removed', () => island.reposition());
  screen.on('display-metrics-changed', () => island.reposition());
  powerMonitor.on('resume', () => void scheduler.refreshNow());

  const readForeground = (() => {
    try {
      return createForegroundReader();
    } catch (error) {
      log.warn('fullscreen detection unavailable', error);
      return null;
    }
  })();
  // GetWindowRect reports physical pixels, so compare against the display in physical pixels too.
  fullscreenWatch = readForeground
    ? new FullscreenWatch(readForeground, () => screen.dipToScreenRect(null, islandDisplay().bounds), (hidden) =>
        island.setFullscreenHidden(hidden),
      )
    : null;
  applyPlatformSettings();

  return { island, scheduler, tray: trayHandle };
}
