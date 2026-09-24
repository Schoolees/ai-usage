import { BrowserWindow, type WebContents } from 'electron';
import { join } from 'node:path';
import { IPC } from '../shared/ipc';
import { windowBackground, type SystemTheme } from '../shared/theme';
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
    // Chromium's tooltip and Windows' classic tooltip at the same time. The solid color follows Windows dark/light mode.
    titleBarStyle: 'hidden',
    backgroundColor: windowBackground(theme),
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

/** The settings window's page, while it is open; IPC handlers check requests against it. */
export function settingsContents(): WebContents | null {
  return settingsWindow && !settingsWindow.isDestroyed() ? settingsWindow.webContents : null;
}

/** Re-apply the native background and push the theme when Windows personalization changes while the window is open. */
export function updateSettingsWindowTheme(theme: SystemTheme): void {
  if (!settingsWindow || settingsWindow.isDestroyed()) return;
  settingsWindow.setBackgroundColor(windowBackground(theme));
  settingsWindow.webContents.send(IPC.themeUpdate, theme);
}
