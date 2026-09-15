import { DAY, HOUR, MINUTE } from './time';

export function formatReset(resetsAt: number | null, now: number, timeZone?: string): string {
  if (resetsAt === null) return '';
  const remaining = resetsAt - now;
  if (remaining <= 0) return 'Reset since last seen';
  if (remaining < DAY) {
    const totalMinutes = Math.ceil(remaining / MINUTE);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    if (hours === 0) return `Resets in ${minutes} min`;
    return minutes === 0 ? `Resets in ${hours} hr` : `Resets in ${hours} hr ${minutes} min`;
  }
  const text = new Intl.DateTimeFormat('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit', timeZone })
    .format(new Date(resetsAt))
    .replace(/ /g, ' ') // ICU puts a narrow no-break space before AM/PM
    .replace(',', '');
  return `Resets ${text}`;
}

export function formatDuration(ms: number): string {
  if (ms < MINUTE) return '<1 min';
  if (ms < HOUR) return `${Math.floor(ms / MINUTE)} min`;
  if (ms < DAY) return `${Math.floor(ms / HOUR)} hr`;
  const days = Math.floor(ms / DAY);
  return days === 1 ? '1 day' : `${days} days`;
}

export function formatPercent(percent: number): string {
  // Floor, not round: the level/color is computed from the raw percent, so rounding up could
  // show a threshold number (e.g. 80%) the color hasn't actually reached yet.
  return `${Math.floor(percent)}%`;
}

/** Short plan tag for the pill: "Max (5x)" → "MAX", "Pro Lite" → "PRO LITE". */
export function planBadge(plan: string | undefined): string | null {
  const name = plan?.replace(/\(.*?\)/g, '').trim();
  return name ? name.toUpperCase() : null;
}
