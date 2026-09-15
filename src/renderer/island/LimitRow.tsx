import { formatPercent, formatReset } from '../../shared/format';
import type { LimitView } from '../../shared/view-model';

export function LimitRow({ limit, now, dim }: { limit: LimitView; now: number; dim: boolean }) {
  const percent = limit.usedPercent;
  return (
    <div className={dim ? 'row dim' : 'row'} data-testid={`limit-${limit.id}`}>
      <div className="row-top">
        <b>{limit.label}</b>
        <span className="row-meta">
          {formatReset(limit.resetsAt, now)}
          {percent !== null && <span className="pct">{formatPercent(percent)}</span>}
        </span>
      </div>
      <div className="bar" role="progressbar" aria-label={limit.label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent ?? 0}>
        <i className={`fill level-${limit.level}`} style={{ width: `${Math.min(100, percent ?? 0)}%` }} />
      </div>
    </div>
  );
}
