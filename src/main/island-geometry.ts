export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DisplayInfo {
  id: number;
  label: string;
  primary: boolean;
  bounds: Rect;
  workArea: Rect;
}

export function pickDisplay(displays: DisplayInfo[], preferredId: number | null): DisplayInfo {
  return (
    displays.find((d) => d.id === preferredId) ??
    displays.find((d) => d.primary) ??
    displays[0]
  );
}

export function islandBounds(workArea: Rect, size: { width: number; height: number }): Rect {
  const width = Math.min(Math.ceil(size.width), workArea.width);
  const height = Math.ceil(size.height);
  return { x: workArea.x + Math.round((workArea.width - width) / 2), y: workArea.y, width, height };
}
