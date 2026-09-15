import { useState } from 'react';
import { ArrowUpRight, Clock, Monitor, RefreshCw, Settings, SquareTerminal } from 'lucide-react';
import { formatDuration } from '../../shared/format';
import type { IslandView, ProviderView } from '../../shared/view-model';
import { LimitRow } from './LimitRow';
import { StatusLine } from './StatusLine';

export function footerText(providers: ProviderView[], now: number): string {
  const live = providers.filter((p) => !p.fromLogs && p.dataAsOf !== null).map((p) => p.dataAsOf as number);
  const logs = providers.filter((p) => p.fromLogs && p.dataAsOf !== null);
  const parts: string[] = [];
  if (live.length > 0) parts.push(`Updated ${formatDuration(now - Math.max(...live))} ago`);
  for (const p of logs) parts.push(`${p.shortName} from logs, ${formatDuration(now - (p.dataAsOf as number))} old`);
  return parts.length > 0 ? parts.join(' · ') : 'Waiting for data';
}

interface PanelProps {
  view: IslandView;
  now: number;
  onRefresh(): Promise<void> | void;
  onOpenSettings(): void;
  onOpenUsage(providerId: string): void;
  onHoverStart?(): void;
  onHoverEnd?(): void;
  hidden?: boolean;
}

/** The refresh icon keeps turning at least this long, so a fast refresh still reads as one full spin. */
const MIN_SPIN_MS = 700;

export function Panel({ view, now, onRefresh, onOpenSettings, onOpenUsage, onHoverStart, onHoverEnd, hidden = false }: PanelProps) {
  const [refreshing, setRefreshing] = useState(false);

  const refresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    const started = Date.now();
    try {
      await onRefresh();
    } finally {
      const remaining = MIN_SPIN_MS - (Date.now() - started);
      if (remaining > 0) await new Promise((resolve) => setTimeout(resolve, remaining));
      setRefreshing(false);
    }
  };

  return (
    <div
      className="panel"
      role="dialog"
      aria-label="Plan usage limits"
      aria-hidden={hidden}
      inert={hidden}
      onMouseEnter={onHoverStart}
      onMouseLeave={onHoverEnd}
    >
      {view.providers.map((provider, index) => (
        <section key={provider.id} className="group">
          {index > 0 && <hr className="sep" />}
          <header className="group-head">
            <span className="group-title">
              <span>{[provider.name, provider.plan].filter(Boolean).join(' · ')}</span>
              {provider.source && (
                <span className="source">
                  {provider.source.kind === 'wsl' ? <SquareTerminal size={12} aria-hidden /> : <Monitor size={12} aria-hidden />}
                  <span>{provider.source.label}</span>
                </span>
              )}
            </span>
            <button type="button" className="icon-btn" aria-label={`Open ${provider.name} usage page`} onClick={() => onOpenUsage(provider.id)}>
              <ArrowUpRight size={14} aria-hidden />
            </button>
          </header>
          {provider.status !== 'ok' && <StatusLine provider={provider} now={now} onOpenSettings={onOpenSettings} />}
          {provider.limits.map((limit) => (
            <LimitRow key={limit.id} limit={limit} now={now} dim={provider.stale} />
          ))}
        </section>
      ))}
      <footer className="foot">
        <span className="foot-text">
          <Clock size={12} aria-hidden />
          {footerText(view.providers, now)}
        </span>
        <span className="btns">
          <button type="button" className="icon-btn" aria-label="Refresh now" aria-busy={refreshing} onClick={() => void refresh()}>
            <RefreshCw size={14} aria-hidden className={refreshing ? 'spin' : undefined} />
          </button>
          <button type="button" className="icon-btn" aria-label="Settings" onClick={onOpenSettings}>
            <Settings size={14} aria-hidden />
          </button>
        </span>
      </footer>
    </div>
  );
}
