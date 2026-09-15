import { app, ipcMain, powerMonitor, screen, shell } from 'electron';
import { join } from 'node:path';
import { IPC, type DisplayOption, type ProviderOption } from '../shared/ipc';
import { mergeSettings, providerSettings, type Settings, type SettingsPatch } from '../shared/settings-schema';
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
import { openSettingsWindow } from './settings-window';
import { createTray } from './tray';
import { AlertEngine } from './alert-engine';
import { alertText } from './alert-text';
import { showAlert } from './notifier';
import { createForegroundReader } from './foreground-window';
import { FullscreenWatch } from './fullscreen';

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
  const persisted = loadState(stateFile);
  const store = new UsageStore(persisted.lastGood);
  const alerts = new AlertEngine(persisted.alertsFired);
  const plugins = createProviders();
  const detected: Record<string, DetectedSource[]> = {};
  // Only running distros are probed (spec §4): scheduled fetches must never boot a stopped one.
  const wslDistroCache = createRunningDistroCache(defaultDetectDeps().listRunningDistros);

  const islandDisplay = () => pickDisplay(listDisplays(), settings.displayId);
  const island = new IslandWindow(islandDisplay);

  async function detectAll(): Promise<void> {
    const candidates = await listCandidateHomes(defaultDetectDeps());
    for (const plugin of plugins) {
      detected[plugin.id] = await plugin.detectSources(candidates).catch((error: unknown) => {
        log.warn(`source detection failed for ${plugin.id}`, error);
        return [];
      });
    }
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

  let saveTimer: ReturnType<typeof setTimeout> | undefined;
  const persist = () => {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      saveState(stateFile, { lastGood: store.lastGoodMap(), alertsFired: alerts.firedKeys() });
    }, 1000);
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
        showAlert(alertText(event, providerName, now), () => island.expand());
      }
    }
    if (snapshot.status === 'error') log.warn(`${snapshot.providerId}: ${snapshot.message ?? 'error'}`);
    persist();
    pushView();
  }

  await detectAll();
  const scheduler = new Scheduler(tasks(), onSnapshot);
  scheduler.start();
  setInterval(() => void detectAll(), 5 * MINUTE);
  // Staleness is time-based, so re-send the view even when no fetch happened.
  setInterval(pushView, 30_000);

  function applyPlatformSettings(): void {
    if (settings.hideInFullscreen) fullscreenWatch?.start();
    else fullscreenWatch?.stop();
    // In dev the login item would point at electron.exe, so only the installed app registers itself.
    if (app.isPackaged) app.setLoginItemSettings({ openAtLogin: settings.openAtLogin });
  }

  function applySettings(next: Settings): Settings {
    const previous = settings;
    settings = next;
    saveSettings(settingsFile, next);
    island.reposition();
    if (JSON.stringify(previous.providers) !== JSON.stringify(next.providers) || previous.claudeRefreshMs !== next.claudeRefreshMs) {
      scheduler.setTasks(tasks());
    }
    applyPlatformSettings();
    trayHandle.rebuild();
    pushView();
    return settings;
  }

  ipcMain.handle(IPC.viewGet, () => view());
  ipcMain.handle(IPC.refresh, (_event, olderThanMs?: number) => scheduler.refreshNow({ olderThanMs }));
  ipcMain.on(IPC.islandResize, (_event, width: number, height: number) => island.resize(width, height));
  ipcMain.on(IPC.islandSetExpanded, (_event, expanded: boolean) => island.setExpanded(expanded));
  ipcMain.on(IPC.openUsagePage, (_event, providerId: string) => {
    const url = plugins.find((plugin) => plugin.id === providerId)?.usageUrl;
    if (url) void shell.openExternal(url);
  });
  ipcMain.handle(IPC.settingsGet, () => settings);
  ipcMain.handle(IPC.settingsSet, (_event, patch: SettingsPatch) => applySettings(mergeSettings(settings, patch)));
  ipcMain.handle(IPC.providersGet, async (): Promise<ProviderOption[]> => {
    await detectAll();
    return plugins.map((plugin) => ({
      id: plugin.id,
      name: plugin.name,
      sources: (detected[plugin.id] ?? []).map(({ kind, label, home, lastModifiedMs }) => ({ kind, label, home, lastModifiedMs })),
    }));
  });
  ipcMain.handle(IPC.displaysGet, (): DisplayOption[] => listDisplays().map(({ id, label, primary }) => ({ id, label, primary })));
  ipcMain.on(IPC.openSettings, () => openSettingsWindow());

  const trayHandle = createTray(trayIcon, {
    toggleIsland: () => island.toggleUserHidden(),
    isIslandVisible: () => island.isUserVisible(),
    refresh: () => void scheduler.refreshNow(),
    openSettings: () => openSettingsWindow(),
    getOpenAtLogin: () => settings.openAtLogin,
    setOpenAtLogin: (value) => {
      applySettings(mergeSettings(settings, { openAtLogin: value }));
    },
    quit: () => app.quit(),
  });

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
  const fullscreenWatch = readForeground
    ? new FullscreenWatch(readForeground, () => screen.dipToScreenRect(null, islandDisplay().bounds), (hidden) =>
        island.setFullscreenHidden(hidden),
      )
    : null;
  applyPlatformSettings();

  return { island, scheduler, tray: trayHandle };
}
