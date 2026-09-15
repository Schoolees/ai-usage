import { ClockAlert, CloudOff, Gauge, TriangleAlert } from 'lucide-react';
import type { ProviderView } from '../../shared/view-model';

const PROVIDER_COLORS: Record<string, string> = { claude: '#d97757', codex: '#10a37f' };

function segmentState(provider: ProviderView): 'no-data' | 'stale' | ProviderView['level'] {
  if (provider.maxPercent === null) return 'no-data';
  if (provider.stale) return 'stale';
  return provider.level;
}

function SegmentIcon({ provider, state }: { provider: ProviderView; state: ReturnType<typeof segmentState> }) {
  if (state === 'no-data') return <CloudOff size={12} aria-hidden />;
  if (state === 'stale') return <ClockAlert size={12} aria-hidden />;
  if (state !== 'normal') return <TriangleAlert size={12} aria-hidden />;
  return <span className="dot" style={{ background: PROVIDER_COLORS[provider.id] ?? '#8a8a8a' }} aria-hidden />;
}

export function Pill({ providers, expanded, onClick }: { providers: ProviderView[]; expanded: boolean; onClick(): void }) {
  return (
    <button type="button" className="pill" aria-label="Show usage details" aria-expanded={expanded} onClick={onClick}>
      {providers.length === 0 && (
        <span className="pill-seg state-stale">
          <Gauge size={12} aria-hidden />
          AI Usage
        </span>
      )}
      {providers.map((provider) => {
        const state = segmentState(provider);
        return (
          <span key={provider.id} className={`pill-seg state-${state}`} data-testid={`pill-${provider.id}`} data-state={state}>
            <SegmentIcon provider={provider} state={state} />
            {provider.maxPercent === null ? provider.shortName : `${provider.shortName} ${Math.floor(provider.maxPercent)}%`}
          </span>
        );
      })}
    </button>
  );
}
