import { Menu, Tray } from 'electron';
import { PRODUCT_NAME } from '../shared/app-id';
import { updateMenuItem, type UpdateStatus } from './update-state';

export interface TrayActions {
  toggleIsland(): void;
  isIslandVisible(): boolean;
  refresh(): void;
  openSettings(): void;
  getOpenAtLogin(): boolean;
  setOpenAtLogin(value: boolean): void;
  updateStatus(): UpdateStatus;
  checkForUpdates(): void;
  installUpdate(): void;
  quit(): void;
}

export function createTray(iconPath: string, actions: TrayActions): { tray: Tray; rebuild(): void } {
  const tray = new Tray(iconPath);
  tray.setToolTip(PRODUCT_NAME);

  const updateItem = () => {
    const item = updateMenuItem(actions.updateStatus());
    return {
      label: item.label,
      enabled: item.enabled,
      click: () => {
        if (item.action === 'install') actions.installUpdate();
        else if (item.action === 'check') actions.checkForUpdates();
        rebuild();
      },
    };
  };

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
        updateItem(),
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
