import { BrowserWindow } from 'electron';
import { join } from 'node:path';
import { IPC } from '../shared/ipc';
import { windowChrome, type SystemTheme } from '../shared/theme';
import { loadRenderer } from './renderer-url';

let settingsWindow: BrowserWindow | null = null;

export function openSettingsWindow(theme: SystemTheme): void {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.show();
    settingsWindow.focus();
    return;
  }
  settingsWindow = new BrowserWindow({
    width: 760,
    height: 600,
    minWidth: 640,
    minHeight: 480,
    title: 'AI Usage settings',
    minimizable: false,
    maximizable: false,
    autoHideMenuBar: true,
    show: false,
    // Custom title bar with an in-page close button (SettingsApp). No titleBarOverlay: its caption button shows
    // Chromium's tooltip and Windows' classic tooltip at the same time. Mica/solid colors follow Windows personalization.
    titleBarStyle: 'hidden',
    ...chromeOptions(theme),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
    },
  });
  settingsWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  settingsWindow.once('ready-to-show', () => settingsWindow?.show());
  settingsWindow.on('closed', () => {
    settingsWindow = null;
  });
  loadRenderer(settingsWindow, 'settings');
}

function chromeOptions(theme: SystemTheme) {
  const chrome = windowChrome(theme);
  return {
    backgroundColor: chrome.backgroundColor,
    backgroundMaterial: chrome.backgroundMaterial,
  };
}

/** Re-apply native chrome and push the theme when Windows personalization changes while the window is open. */
export function updateSettingsWindowTheme(theme: SystemTheme): void {
  if (!settingsWindow || settingsWindow.isDestroyed()) return;
  const { backgroundColor, backgroundMaterial } = chromeOptions(theme);
  settingsWindow.setBackgroundMaterial(backgroundMaterial);
  settingsWindow.setBackgroundColor(backgroundColor);
  settingsWindow.webContents.send(IPC.themeUpdate, theme);
}
