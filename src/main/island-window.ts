import { BrowserWindow, screen } from 'electron';
import { join } from 'node:path';
import { IPC } from '../shared/ipc';
import { islandBounds, type DisplayInfo } from './island-geometry';
import { loadRenderer } from './renderer-url';

export class IslandWindow {
  readonly win: BrowserWindow;
  private size = { width: 260, height: 34 };
  private userHidden = false;
  private fullscreenHidden = false;
  private cursorWatch?: ReturnType<typeof setInterval>;

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
    this.win.once('ready-to-show', () => {
      this.reposition();
      // Transparent areas around the pill must not swallow clicks. `forward` keeps mouse moves flowing
      // to the page, so hovering the pill is still detected while the window ignores clicks.
      this.setInteractive(false);
      this.applyVisibility();
    });
    loadRenderer(this.win, 'island');
  }

  resize(width: number, height: number): void {
    if (width === this.size.width && height === this.size.height) return;
    this.size = { width, height };
    this.reposition();
  }

  setExpanded(expanded: boolean): void {
    if (expanded) this.startCursorWatch();
    else this.stopCursorWatch();
  }

  setInteractive(interactive: boolean): void {
    if (this.win.isDestroyed()) return;
    this.win.setIgnoreMouseEvents(!interactive, { forward: true });
  }

  /** A fast exit can skip the page's final mouseleave, so collapse once the cursor is outside the window. */
  private startCursorWatch(): void {
    if (this.cursorWatch) return;
    this.cursorWatch = setInterval(() => {
      if (this.win.isDestroyed()) return this.stopCursorWatch();
      const { x, y } = screen.getCursorScreenPoint();
      const b = this.win.getBounds();
      const inside = x >= b.x && x < b.x + b.width && y >= b.y && y < b.y + b.height;
      if (!inside) {
        this.stopCursorWatch();
        this.setInteractive(false);
        this.win.webContents.send(IPC.islandCollapse);
      }
    }, 150);
  }

  private stopCursorWatch(): void {
    if (this.cursorWatch) clearInterval(this.cursorWatch);
    this.cursorWatch = undefined;
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
