import { Numeric } from '@/components/ui/numeric'
import { cn } from '@/lib/utils'
import type { MarketImpact, MarketImpactTier } from './types'
import { QUEUE_COPY } from './copy'

const TIER_SURFACE: Record<MarketImpactTier, string> = {
  none: 'bg-[var(--lc-surface-sunken)]',
  low: 'bg-[var(--lc-status-draft-bg)]',
  medium: 'bg-[var(--lc-status-warning-bg)]',
  high: 'bg-[var(--lc-status-danger-bg)]',
}

export interface MarketImpactChipProps {
  impact: MarketImpact
  className?: string
}

/**
 * Market-impact chip — valuations affected + median move, tinted by tier.
 * High tier is the WF-05 two-person-rule trigger (market-impact, not tenure risk).
 */
export function MarketImpactChip({ impact, className }: MarketImpactChipProps) {
  const tier = impact.tier ?? 'none'
  const n = impact.valuations_affected ?? 0
  const p = Math.abs(impact.pct_move_median ?? 0)
  const q = Math.abs(impact.pct_move_max ?? 0)
  const label = QUEUE_COPY.marketImpactChip
    .replace('{N}', String(n))
    .replace('{P}', String(p))
  const tooltip = QUEUE_COPY.marketImpactTooltip
    .replace('{N}', String(n))
    .replace('{P}', String(p))
    .replace('{Q}', String(q))

  return (
    <span
      title={tooltip}
      aria-label={`${n} valuations affected, median move ${p} percent, ${tier} impact.`}
      className={cn(
        'inline-flex items-center gap-1 rounded-[var(--lc-radius-sm)] px-2 py-0.5',
        'text-[length:var(--lc-type-caption)] text-[var(--lc-text-primary)]',
        TIER_SURFACE[tier],
        className,
      )}
      data-market-impact-tier={tier}
    >
      <Numeric>{n}</Numeric>
      <span>valuations · ±</span>
      <Numeric>{p}</Numeric>
      <span>%</span>
      <span className="sr-only">{label}</span>
    </span>
  )
}
