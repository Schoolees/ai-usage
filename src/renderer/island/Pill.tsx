import { ClockAlert, CloudOff, Gauge, TriangleAlert } from 'lucide-react';
import { planBadge } from '../../shared/format';
import type { ProviderView } from '../../shared/view-model';

const PROVIDER_COLORS: Record<string, string> = { claude: '#d97757', codex: '#10a37f' };

function segmentState(provider: ProviderView): 'no-data' | 'stale' | ProviderView['level'] {
  if (provider.headlinePercent === null) return 'no-data';
  if (provider.stale) return 'stale';
  return provider.level;
}

function SegmentIcon({ provider, state }: { provider: ProviderView; state: ReturnType<typeof segmentState> }) {
  if (state === 'no-data') return <CloudOff size={12} aria-hidden />;
  if (state === 'stale') return <ClockAlert size={12} aria-hidden />;
  if (state !== 'normal') return <TriangleAlert size={12} aria-hidden />;
  return <span className="dot" style={{ background: PROVIDER_COLORS[provider.id] ?? '#8a8a8a' }} aria-hidden />;
}

interface PillProps {
  providers: ProviderView[];
  expanded: boolean;
  onHoverStart(): void;
  onHoverEnd(): void;
}

export function Pill({ providers, expanded, onHoverStart, onHoverEnd }: PillProps) {
  return (
    <button
      type="button"
      className="pill"
      aria-label="Show usage details"
      aria-expanded={expanded}
      onMouseEnter={onHoverStart}
      onMouseLeave={onHoverEnd}
    >
      {providers.length === 0 && (
        <span className="pill-seg state-stale">
          <Gauge size={12} aria-hidden />
          AI Usage
        </span>
      )}
      {providers.map((provider) => {
        const state = segmentState(provider);
        const badge = planBadge(provider.plan);
        return (
          <span key={provider.id} className={`pill-seg state-${state}`} data-testid={`pill-${provider.id}`} data-state={state}>
            <SegmentIcon provider={provider} state={state} />
            <span className="pill-text">
              {provider.headlinePercent === null ? provider.shortName : `${provider.shortName} ${Math.floor(provider.headlinePercent)}%`}
            </span>
            {badge && (
              <span className="plan-badge" data-testid={`pill-${provider.id}-plan`}>
                {badge}
              </span>
            )}
          </span>
        );
      })}
    </button>
  );
}
