import { BrowserWindow } from 'electron';
import { join } from 'node:path';
import { IPC } from '../shared/ipc';
import { islandBounds, type DisplayInfo } from './island-geometry';
import { loadRenderer } from './renderer-url';

export class IslandWindow {
  readonly win: BrowserWindow;
  private size = { width: 260, height: 34 };
  private expanded = false;
  private userHidden = false;
  private fullscreenHidden = false;

  constructor(private readonly getDisplay: () => DisplayInfo) {
    this.win = new BrowserWindow({
      ...this.size,
      frame: false,
      transparent: true,
      backgroundColor: '#00000000',
      hasShadow: false,
      resizable: false,
      movable: false,
      minimizable: false,
      maximizable: false,
      fullscreenable: false,
      skipTaskbar: true,
      alwaysOnTop: true,
      show: false,
      webPreferences: {
        preload: join(__dirname, '../preload/index.js'),
        contextIsolation: true,
        sandbox: true,
        nodeIntegration: false,
      },
    });
    this.win.setAlwaysOnTop(true, 'screen-saver');
    this.win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    this.win.webContents.on('will-navigate', (event) => event.preventDefault());
    this.win.on('blur', () => {
      if (this.expanded) this.win.webContents.send(IPC.islandCollapse);
    });
    this.win.once('ready-to-show', () => {
      this.reposition();
      this.applyVisibility();
    });
    loadRenderer(this.win, 'island');
  }

  resize(width: number, height: number): void {
    this.size = { width, height };
    this.reposition();
  }

  setExpanded(expanded: boolean): void {
    this.expanded = expanded;
    // Focus is needed so clicking elsewhere blurs the window and collapses it.
    if (expanded) this.win.focus();
  }

  /** Expand from outside the renderer, e.g. a notification click. */
  expand(): void {
    this.show();
    this.win.webContents.send(IPC.islandExpand);
  }

  reposition(): void {
    if (this.win.isDestroyed()) return;
    this.win.setBounds(islandBounds(this.getDisplay().workArea, this.size));
  }

  setFullscreenHidden(hidden: boolean): void {
    this.fullscreenHidden = hidden;
    this.applyVisibility();
  }

  toggleUserHidden(): void {
    this.userHidden = !this.userHidden;
    this.applyVisibility();
  }

  isUserVisible(): boolean {
    return !this.userHidden;
  }

  show(): void {
    this.userHidden = false;
    this.applyVisibility();
  }

  private applyVisibility(): void {
    if (this.win.isDestroyed()) return;
    if (this.userHidden || this.fullscreenHidden) {
      this.win.hide();
    } else {
      this.win.showInactive();
      this.win.setAlwaysOnTop(true, 'screen-saver');
    }
  }
}
