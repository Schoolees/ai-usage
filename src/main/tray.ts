import { Menu, Tray } from 'electron';
import { PRODUCT_NAME } from '../shared/app-id';

export interface TrayActions {
  toggleIsland(): void;
  isIslandVisible(): boolean;
  refresh(): void;
  openSettings(): void;
  getOpenAtLogin(): boolean;
  setOpenAtLogin(value: boolean): void;
  quit(): void;
}

export function createTray(iconPath: string, actions: TrayActions): { tray: Tray; rebuild(): void } {
  const tray = new Tray(iconPath);
  tray.setToolTip(PRODUCT_NAME);

  const rebuild = () =>
    tray.setContextMenu(
      Menu.buildFromTemplate([
        {
          label: actions.isIslandVisible() ? 'Hide island' : 'Show island',
          click: () => {
            actions.toggleIsland();
            rebuild();
          },
        },
        { label: 'Refresh now', click: () => actions.refresh() },
        { label: 'Settings…', click: () => actions.openSettings() },
        { type: 'separator' },
        {
          label: 'Start with Windows',
          type: 'checkbox',
          checked: actions.getOpenAtLogin(),
          click: (item) => actions.setOpenAtLogin(item.checked),
        },
        { type: 'separator' },
        { label: 'Quit', click: () => actions.quit() },
      ]),
    );

  rebuild();
  tray.on('click', () => {
    actions.toggleIsland();
    rebuild();
  });
  return { tray, rebuild };
}
