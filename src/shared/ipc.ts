import type { Settings, SettingsPatch } from './settings-schema';
import type { SystemTheme } from './theme';
import type { SourceKind } from './types';
import type { IslandView } from './view-model';

export const IPC = {
  viewGet: 'usage:get',
  viewUpdate: 'usage:update',
  refresh: 'usage:refresh',
  islandResize: 'island:resize',
  islandSetExpanded: 'island:setExpanded',
  islandSetInteractive: 'island:setInteractive',
  islandCollapse: 'island:collapse',
  islandExpand: 'island:expand',
  openUsagePage: 'app:openUsagePage',
  openSettings: 'app:openSettings',
  settingsGet: 'settings:get',
  settingsSet: 'settings:set',
  providersGet: 'providers:get',
  displaysGet: 'displays:get',
  themeGet: 'theme:get',
  themeUpdate: 'theme:update',
} as const;

export interface SourceOption {
  kind: SourceKind;
  label: string;
  home: string;
  lastModifiedMs: number;
}

export interface DisplayOption {
  id: number;
  label: string;
  primary: boolean;
}

export interface ProviderOption {
  id: string;
  name: string;
  sources: SourceOption[];
}

export interface Api {
  getView(): Promise<IslandView>;
  onView(listener: (view: IslandView) => void): () => void;
  refresh(olderThanMs?: number): Promise<void>;
  resizeIsland(width: number, height: number): void;
  setExpanded(expanded: boolean): void;
  /** true while the pointer is over the pill or open panel; otherwise the window lets clicks through */
  setInteractive(interactive: boolean): void;
  onCollapse(listener: () => void): () => void;
  onExpand(listener: () => void): () => void;
  openUsagePage(providerId: string): void;
  openSettings(): void;
  getSettings(): Promise<Settings>;
  setSettings(patch: SettingsPatch): Promise<Settings>;
  getProviders(): Promise<ProviderOption[]>;
  getDisplays(): Promise<DisplayOption[]>;
  getTheme(): Promise<SystemTheme>;
  onTheme(listener: (theme: SystemTheme) => void): () => void;
}
