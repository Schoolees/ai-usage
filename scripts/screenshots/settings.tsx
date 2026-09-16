// Renders the settings window as a floating window over a desktop-like gradient.
declare const VERSION: string;

import { createRoot } from 'react-dom/client';
import { applyTheme } from '../../src/renderer/theme';
import { SettingsApp } from '../../src/renderer/settings/SettingsApp';
import '../../src/renderer/settings/settings.css';
import type { Api } from '../../src/shared/ipc';
import { DEFAULT_SETTINGS } from '../../src/shared/settings-schema';
import { accent } from './sample-data';

applyTheme(document.documentElement, { mode: 'dark', transparency: true, accent });

let settings = { ...DEFAULT_SETTINGS };
const noop = () => {};
const api = {
  getSettings: async () => settings,
  setSettings: async (patch: Partial<typeof settings>) => (settings = { ...settings, ...patch }),
  getProviders: async () => [
    {
      id: 'claude',
      name: 'Claude',
      sources: [{ kind: 'wsl', label: 'WSL · Ubuntu-24.04', home: '\\\\wsl.localhost\\Ubuntu-24.04\\home\\you', lastModifiedMs: 2 }],
      activeHome: '\\\\wsl.localhost\\Ubuntu-24.04\\home\\you',
    },
    {
      id: 'codex',
      name: 'ChatGPT (Codex)',
      sources: [{ kind: 'windows', label: 'Windows', home: 'C:\\Users\\you', lastModifiedMs: 1 }],
      activeHome: 'C:\\Users\\you',
    },
  ],
  getDisplays: async () => [{ id: 1, label: 'Primary display', primary: true }],
  getAppInfo: async () => ({ version: VERSION }),
  getTheme: async () => ({}),
  onTheme: () => noop,
} as unknown as Api;

createRoot(document.getElementById('root')!).render(<SettingsApp api={api} />);
