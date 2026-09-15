import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { Api } from '../../shared/ipc';
import type { IslandView } from '../../shared/view-model';
import { Panel } from './Panel';
import { Pill } from './Pill';

/** Hover must rest this long before opening, so brushing past the top of the screen doesn't pop the panel. */
const OPEN_DELAY_MS = 90;
/** Grace period after the pointer leaves, long enough to cross the gap between pill and panel. */
const CLOSE_DELAY_MS = 280;
/** An expand requested from outside (a notification click) closes by itself if the pointer never arrives. */
const UNHOVERED_CLOSE_MS = 5000;

export function IslandApp({ api = window.api, clock = Date.now }: { api?: Api; clock?: () => number }) {
  const [view, setView] = useState<IslandView | null>(null);
  const [expanded, setExpandedState] = useState(false);
  const [now, setNow] = useState(clock);
  const rootRef = useRef<HTMLDivElement>(null);
  const expandedRef = useRef(false);
  const hoverCount = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    const receive = (next: IslandView) => {
      setView(next);
      setNow(clock());
    };
    void api.getView().then(receive);
    return api.onView(receive);
  }, [api, clock]);

  useEffect(() => {
    const interval = setInterval(() => setNow(clock()), 30_000);
    return () => clearInterval(interval);
  }, [clock]);

  const clearTimer = useCallback(() => {
    if (timer.current !== undefined) clearTimeout(timer.current);
    timer.current = undefined;
  }, []);

  useEffect(() => clearTimer, [clearTimer]);

  const applyExpanded = useCallback(
    (next: boolean) => {
      if (expandedRef.current === next) return;
      expandedRef.current = next;
      setExpandedState(next);
      api.setExpanded(next);
      if (next) void api.refresh(30_000);
    },
    [api],
  );

  const hoverStart = useCallback(() => {
    hoverCount.current += 1;
    api.setInteractive(true);
    clearTimer();
    if (!expandedRef.current) timer.current = setTimeout(() => applyExpanded(true), OPEN_DELAY_MS);
  }, [api, applyExpanded, clearTimer]);

  const hoverEnd = useCallback(() => {
    hoverCount.current = Math.max(0, hoverCount.current - 1);
    if (hoverCount.current > 0) return;
    api.setInteractive(false);
    clearTimer();
    timer.current = setTimeout(() => applyExpanded(false), expandedRef.current ? CLOSE_DELAY_MS : 0);
  }, [api, applyExpanded, clearTimer]);

  // The main process watches the cursor while expanded: a fast exit can skip the last mouseleave.
  useEffect(
    () =>
      api.onCollapse(() => {
        hoverCount.current = 0;
        clearTimer();
        api.setInteractive(false);
        applyExpanded(false);
      }),
    [api, applyExpanded, clearTimer],
  );

  useEffect(
    () =>
      api.onExpand(() => {
        clearTimer();
        applyExpanded(true);
        if (hoverCount.current === 0) timer.current = setTimeout(() => applyExpanded(false), UNHOVERED_CLOSE_MS);
      }),
    [api, applyExpanded, clearTimer],
  );

  // The window is sized once to fit pill + panel; hovering never resizes it (resizing a transparent
  // window mid-animation is what made the island jump). Areas outside pill and panel are click-through.
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
    <div ref={rootRef} className={expanded ? 'island expanded' : 'island'}>
      <Pill providers={view?.providers ?? []} expanded={expanded} onHoverStart={hoverStart} onHoverEnd={hoverEnd} />
      {view && (
        <Panel
          view={view}
          now={now}
          hidden={!expanded}
          onHoverStart={hoverStart}
          onHoverEnd={hoverEnd}
          onRefresh={() => api.refresh()}
          onOpenSettings={() => api.openSettings()}
          onOpenUsage={(id) => api.openUsagePage(id)}
        />
      )}
    </div>
  );
}
