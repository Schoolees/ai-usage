// Renders the island against a desktop-like gradient. ?expanded opens the panel.
import { createRoot } from 'react-dom/client';
import { applyTheme } from '../../src/renderer/theme';
import { IslandApp } from '../../src/renderer/island/IslandApp';
import '../../src/renderer/island/island.css';
import type { Api } from '../../src/shared/ipc';
import { accent, now, view } from './sample-data';

applyTheme(document.documentElement, { mode: 'dark', transparency: true, accent });

const expanded = location.search.includes('expanded');
const noop = () => {};
const api = {
  getView: async () => view,
  onView: () => noop,
  // The harness has no main process to expand it, so push the open state in on load.
  onExpand: (listener: () => void) => {
    if (expanded) setTimeout(listener, 0);
    return noop;
  },
  onCollapse: () => noop,
  refresh: async () => {},
  resizeIsland: noop,
  setExpanded: noop,
  setInteractive: noop,
  openUsagePage: noop,
  openSettings: noop,
} as unknown as Api;

createRoot(document.getElementById('root')!).render(<IslandApp api={api} clock={() => now} />);
