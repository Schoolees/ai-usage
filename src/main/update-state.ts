export type UpdatePhase = 'disabled' | 'idle' | 'checking' | 'up-to-date' | 'available' | 'downloading' | 'ready' | 'error';

export interface UpdateStatus {
  state: UpdatePhase;
  /** Version being downloaded or waiting to install */
  version: string | null;
  percent?: number;
}

export interface UpdateMenuItem {
  label: string;
  enabled: boolean;
  action: 'check' | 'install' | 'none';
}

/** The tray's update line: what it says, and what clicking it does. */
export function updateMenuItem(status: UpdateStatus): UpdateMenuItem {
  switch (status.state) {
    case 'disabled':
      return { label: 'Updates are turned off', enabled: false, action: 'none' };
    case 'checking':
      return { label: 'Checking for updates…', enabled: false, action: 'none' };
    case 'available':
      return { label: `Downloading update ${status.version ?? ''}…`.replace('  ', ' '), enabled: false, action: 'none' };
    case 'downloading':
      return { label: `Downloading update ${status.version ?? ''} · ${Math.round(status.percent ?? 0)}%`, enabled: false, action: 'none' };
    case 'ready':
      return { label: `Restart to update to ${status.version ?? 'the new version'}`, enabled: true, action: 'install' };
    case 'up-to-date':
      return { label: 'Up to date · check again', enabled: true, action: 'check' };
    case 'error':
      return { label: "Couldn't check for updates — try again", enabled: true, action: 'check' };
    default:
      return { label: 'Check for updates', enabled: true, action: 'check' };
  }
}
