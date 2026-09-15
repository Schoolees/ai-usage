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
import { defaultDetectDeps, listCandidateHomes, pickSource } from './sources/detect';
import { loadState, saveState } from './state-file';
import { UsageStore } from './usage-store';
// [task-14] tray + settings window imports
// [task-15] alert imports
// [task-16] fullscreen imports

export interface RunningApp {
  island: IslandWindow;
  scheduler: Scheduler;
}

export async function startApp(log: ReturnType<typeof initLog>): Promise<RunningApp> {
  const userData = app.getPath('userData');
  const settingsFile = join(userData, 'settings.json');
  const stateFile = join(userData, 'state.json');

  let settings: Settings = loadSettings(settingsFile);
  const persisted = loadState(stateFile);
  const store = new UsageStore(persisted.lastGood);
  // [task-15] alert engine
  const plugins = createProviders();
  const detected: Record<string, DetectedSource[]> = {};

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
      saveState(stateFile, { lastGood: store.lastGoodMap(), alertsFired: persisted.alertsFired });
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
        return plugin.fetch(source, now);
      },
    }));

  function onSnapshot(snapshot: Snapshot, nextRunAt: number): void {
    const { previous } = store.update(snapshot, nextRunAt);
    void previous; // [task-15] evaluate alerts against previous?.lastGood
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

  function applySettings(next: Settings): Settings {
    const previous = settings;
    settings = next;
    saveSettings(settingsFile, next);
    island.reposition();
    if (JSON.stringify(previous.providers) !== JSON.stringify(next.providers) || previous.claudeRefreshMs !== next.claudeRefreshMs) {
      scheduler.setTasks(tasks());
    }
    // [task-16] apply login item + fullscreen watch
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
  // [task-14] openSettings IPC + tray

  screen.on('display-added', () => island.reposition());
  screen.on('display-removed', () => island.reposition());
  screen.on('display-metrics-changed', () => island.reposition());
  powerMonitor.on('resume', () => void scheduler.refreshNow());

  // [task-16] fullscreen watch + login item

  return { island, scheduler };
}
