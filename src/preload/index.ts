import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';
import { IPC, type Api } from '../shared/ipc';
import type { SystemTheme } from '../shared/theme';
import type { IslandView } from '../shared/view-model';

function subscribe<T extends unknown[]>(channel: string, listener: (...args: T) => void): () => void {
  const handler = (_event: IpcRendererEvent, ...args: unknown[]) => listener(...(args as T));
  ipcRenderer.on(channel, handler);
  return () => ipcRenderer.removeListener(channel, handler);
}

const api: Api = {
  getView: () => ipcRenderer.invoke(IPC.viewGet),
  onView: (listener) => subscribe<[IslandView]>(IPC.viewUpdate, listener),
  refresh: (olderThanMs) => ipcRenderer.invoke(IPC.refresh, olderThanMs),
  resizeIsland: (width, height) => ipcRenderer.send(IPC.islandResize, width, height),
  setExpanded: (expanded) => ipcRenderer.send(IPC.islandSetExpanded, expanded),
  setInteractive: (interactive) => ipcRenderer.send(IPC.islandSetInteractive, interactive),
  onCollapse: (listener) => subscribe(IPC.islandCollapse, listener),
  onExpand: (listener) => subscribe(IPC.islandExpand, listener),
  openUsagePage: (providerId) => ipcRenderer.send(IPC.openUsagePage, providerId),
  openSettings: () => ipcRenderer.send(IPC.openSettings),
  getSettings: () => ipcRenderer.invoke(IPC.settingsGet),
  setSettings: (patch) => ipcRenderer.invoke(IPC.settingsSet, patch),
  getProviders: () => ipcRenderer.invoke(IPC.providersGet),
  getDisplays: () => ipcRenderer.invoke(IPC.displaysGet),
  getAppInfo: () => ipcRenderer.invoke(IPC.appInfoGet),
  getTheme: () => ipcRenderer.invoke(IPC.themeGet),
  onTheme: (listener) => subscribe<[SystemTheme]>(IPC.themeUpdate, listener),
};

contextBridge.exposeInMainWorld('api', api);
