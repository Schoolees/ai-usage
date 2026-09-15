import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { Api } from '../../shared/ipc';
import type { IslandView } from '../../shared/view-model';
import { Panel } from './Panel';
import { Pill } from './Pill';

export function IslandApp({ api = window.api, clock = Date.now }: { api?: Api; clock?: () => number }) {
  const [view, setView] = useState<IslandView | null>(null);
  const [expanded, setExpandedState] = useState(false);
  const [now, setNow] = useState(clock);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const receive = (next: IslandView) => {
      setView(next);
      setNow(clock());
    };
    void api.getView().then(receive);
    return api.onView(receive);
  }, [api, clock]);

  useEffect(() => {
    const timer = setInterval(() => setNow(clock()), 30_000);
    return () => clearInterval(timer);
  }, [clock]);

  const setExpanded = useCallback(
    (next: boolean) => {
      setExpandedState(next);
      api.setExpanded(next);
      if (next) void api.refresh(30_000);
    },
    [api],
  );

  useEffect(() => api.onCollapse(() => setExpanded(false)), [api, setExpanded]);
  useEffect(() => api.onExpand(() => setExpanded(true)), [api, setExpanded]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setExpanded(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setExpanded]);

  // The window is sized to the content: the pill alone when collapsed, pill + panel when expanded.
  useLayoutEffect(() => {
    const element = rootRef.current;
    if (!element) return;
    const report = () => api.resizeIsland(element.offsetWidth, element.offsetHeight);
    report();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(report);
    observer.observe(element);
    return () => observer.disconnect();
  }, [api]);

  return (
    <div ref={rootRef} className="island">
      <Pill providers={view?.providers ?? []} expanded={expanded} onClick={() => setExpanded(!expanded)} />
      {expanded && view && (
        <Panel
          view={view}
          now={now}
          onRefresh={() => void api.refresh()}
          onOpenSettings={() => api.openSettings()}
          onOpenUsage={(id) => api.openUsagePage(id)}
        />
      )}
    </div>
  );
}
