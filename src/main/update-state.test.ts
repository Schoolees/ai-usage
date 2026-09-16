import { describe, expect, it } from 'vitest';
import { justUpdated, updateMenuItem } from './update-state';

describe('justUpdated', () => {
  it('is true when the app starts on a different version than it last ran', () => {
    expect(justUpdated('0.1.6', '0.1.7')).toBe(true);
  });

  it('is false on the first run ever, and on an ordinary restart', () => {
    expect(justUpdated(null, '0.1.7')).toBe(false);
    expect(justUpdated('0.1.7', '0.1.7')).toBe(false);
  });
});

describe('updateMenuItem', () => {
  it('offers a restart once an update is downloaded', () => {
    expect(updateMenuItem({ state: 'ready', version: '0.1.3' })).toEqual({ label: 'Restart to update to 0.1.3', enabled: true, action: 'install' });
  });

  it('shows progress while checking and downloading', () => {
    expect(updateMenuItem({ state: 'checking', version: null })).toEqual({ label: 'Checking for updates…', enabled: false, action: 'none' });
    expect(updateMenuItem({ state: 'downloading', version: '0.1.3', percent: 42 })).toEqual({ label: 'Downloading update 0.1.3 · 42%', enabled: false, action: 'none' });
    expect(updateMenuItem({ state: 'available', version: '0.1.3' })).toEqual({ label: 'Downloading update 0.1.3…', enabled: false, action: 'none' });
  });

  it('lets the user check by hand when idle, and after a failed check', () => {
    expect(updateMenuItem({ state: 'idle', version: null })).toEqual({ label: 'Check for updates', enabled: true, action: 'check' });
    expect(updateMenuItem({ state: 'error', version: null })).toEqual({ label: "Couldn't check for updates — try again", enabled: true, action: 'check' });
  });

  it('says so when the app is already up to date', () => {
    expect(updateMenuItem({ state: 'up-to-date', version: null })).toEqual({ label: 'Up to date · check again', enabled: true, action: 'check' });
  });

  it('explains that updates are off when disabled', () => {
    expect(updateMenuItem({ state: 'disabled', version: null })).toEqual({ label: 'Updates are turned off', enabled: false, action: 'none' });
  });
});
