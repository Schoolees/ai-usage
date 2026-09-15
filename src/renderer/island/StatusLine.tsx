import { ClockAlert, CloudOff, TriangleAlert } from 'lucide-react';
import { formatDuration } from '../../shared/format';
import type { ProviderView } from '../../shared/view-model';

export function statusText(provider: ProviderView, now: number): string {
  switch (provider.status) {
    case 'error': {
      const message = provider.message ?? 'Update failed';
      return provider.retryAt === undefined ? message : `${message} · retrying in ${formatDuration(Math.max(0, provider.retryAt - now))}`;
    }
    case 'stale':
      return provider.limits.length > 0 && provider.dataAsOf !== null
        ? `Data is ${formatDuration(now - provider.dataAsOf)} old`
        : (provider.message ?? 'Checking…');
    default:
      return provider.message ?? '';
  }
}

export function StatusLine({ provider, now, onOpenSettings }: { provider: ProviderView; now: number; onOpenSettings(): void }) {
  const Icon = provider.status === 'not-found' ? CloudOff : provider.status === 'stale' ? ClockAlert : TriangleAlert;
  return (
    <div className={`status status-${provider.status}`} role="status">
      <Icon size={12} aria-hidden />
      <span>{statusText(provider, now)}</span>
      {provider.status === 'not-found' && (
        <button type="button" className="link" onClick={onOpenSettings}>
          Choose source
        </button>
      )}
    </div>
  );
}
