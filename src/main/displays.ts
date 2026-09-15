import { screen } from 'electron';
import type { DisplayInfo } from './island-geometry';

export function listDisplays(): DisplayInfo[] {
  const primaryId = screen.getPrimaryDisplay().id;
  return screen.getAllDisplays().map((display, index) => ({
    id: display.id,
    label: display.label || `Display ${index + 1} (${display.size.width}×${display.size.height})`,
    primary: display.id === primaryId,
    bounds: display.bounds,
    workArea: display.workArea,
  }));
}
