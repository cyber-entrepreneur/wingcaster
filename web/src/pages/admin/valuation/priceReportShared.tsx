import { Badge } from '@/components/ui/badge'
import { Numeric } from '@/components/ui/numeric'
import { cn } from '@/lib/utils'
import type {
  DeltaDirection,
  PriceReportBenchmarkDelta,
  PriceReportStatus,
  RiskTier,
} from './priceReportTypes'

export function formatRelativeTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  const then = Date.parse(iso)
  if (Number.isNaN(then)) return iso
  const deltaSec = Math.round((Date.now() - then) / 1000)
  if (deltaSec < 60) return 'just now'
  const mins = Math.round(deltaSec / 60)
  if (mins < 60) return `${mins}m ago`
  const hours = Math.round(mins / 60)
  if (hours < 48) return `${hours}h ago`
  const days = Math.round(hours / 24)
  return `${days}d ago`
}

export function formatTenure(days: number | null | undefined): string {
  if (days == null || !Number.isFinite(days)) return '—'
  const years = Math.floor(days / 365)
  const months = Math.floor((days % 365) / 30)
  if (years > 0 && months > 0) return `${years}y ${months}mo`
  if (years > 0) return `${years}y`
  if (months > 0) return `${months}mo`
  return `${days}d`
}

export function formatMoney(amount: number | null | undefined, currency = 'AED'): string {
  if (amount == null || !Number.isFinite(amount)) return '—'
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(amount)
  } catch {
    return `${currency} ${amount.toLocaleString()}`
  }
}

export function formatDeltaPct(pct: number): string {
  const abs = Math.abs(pct)
  const rounded = abs >= 10 ? abs.toFixed(1) : abs.toFixed(1)
  return rounded
}

export function statusLabel(status: PriceReportStatus | string): string {
  switch (status) {
    case 'pending_review':
      return 'Pending review'
    case 'verified':
      return 'Verified'
    case 'incorporated':
      return 'Incorporated'
    case 'rejected':
      return 'Rejected'
    case 'request_info':
      return 'Request info'
    case 'expired':
      return 'Expired'
    case 'pending_second_approval':
      return 'Pending second approval'
    default:
      return status
  }
}

export function statusGlyph(status: PriceReportStatus | string): string {
  switch (status) {
    case 'pending_review':
      return '○'
    case 'verified':
      return '●'
    case 'incorporated':
      return '◆'
    case 'rejected':
      return '✕'
    case 'request_info':
    case 'pending_second_approval':
      return '▲'
    case 'expired':
      return '▢'
    default:
      return '○'
  }
}

export function PriceReportStatusBadge({
  status,
  className,
}: {
  status: PriceReportStatus | string
  className?: string
}) {
  const tone =
    status === 'incorporated'
      ? 'border-[var(--lc-accent-bold-edge)] bg-[var(--lc-accent-bold)] text-[var(--lc-accent-bold-text)]'
      : status === 'verified'
        ? 'border-transparent bg-[var(--lc-status-published-bg)] text-[var(--lc-status-published-fg)]'
        : status === 'rejected'
          ? 'border-transparent bg-[var(--lc-status-closed-bg)] text-[var(--lc-status-closed-fg)]'
          : status === 'request_info' || status === 'pending_second_approval'
            ? 'border-transparent bg-[var(--lc-status-warning-bg)] text-[var(--lc-status-warning-fg)]'
            : status === 'expired'
              ? 'border-transparent bg-[var(--lc-status-archived-bg)] text-[var(--lc-status-archived-fg)]'
              : 'border-transparent bg-[var(--lc-status-draft-bg)] text-[var(--lc-status-draft-fg)]'

  return (
    <Badge variant="outline" className={cn(tone, className)}>
      <span aria-hidden className="me-1">
        {statusGlyph(status)}
      </span>
      {statusLabel(status)}
    </Badge>
  )
}

export function PriceReportDeltaChip({
  delta,
  className,
}: {
  delta: Pick<PriceReportBenchmarkDelta, 'delta_pct' | 'delta_direction'> & { stale?: boolean }
  className?: string
}) {
  const direction: DeltaDirection =
    delta.delta_direction ||
    (Math.abs(delta.delta_pct) <= 5 ? 'in_band' : delta.delta_pct > 0 ? 'above' : 'below')
  const pct = formatDeltaPct(delta.delta_pct)
  const signed = delta.delta_pct >= 0 ? `+${pct}` : `−${pct}`

  const styles =
    direction === 'above'
      ? 'bg-[var(--lc-status-warning-bg)] text-[var(--lc-status-warning-fg)] border-transparent'
      : direction === 'below'
        ? 'bg-[var(--lc-accent-bold)] text-[var(--lc-accent-bold-text)] border-[var(--lc-accent-bold-edge)]'
        : 'bg-[var(--lc-status-published-bg)] text-[var(--lc-status-published-fg)] border-transparent'

  const glyph = direction === 'above' ? '▲' : direction === 'below' ? '▼' : '~'
  const label =
    direction === 'above'
      ? `${signed}% above benchmark`
      : direction === 'below'
        ? `${signed}% below benchmark`
        : `±${pct}% in band`

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-pill border px-2 py-0.5 text-xs font-semibold',
        styles,
        className,
      )}
      aria-label={
        direction === 'above'
          ? `Above benchmark by ${pct} percent`
          : direction === 'below'
            ? `Below benchmark by ${pct} percent`
            : `Within benchmark band at ${pct} percent`
      }
    >
      <span aria-hidden>{glyph}</span>
      <Numeric as="span">{label}</Numeric>
      {delta.stale ? (
        <span aria-hidden title="Benchmark last computed is stale" className="ms-0.5">
          ⏱
        </span>
      ) : null}
    </span>
  )
}

function riskTone(tier: RiskTier): string {
  if (tier === 'high') return 'bg-[var(--lc-status-warning-bg)] text-[var(--lc-status-warning-fg)]'
  if (tier === 'medium') return 'bg-[var(--lc-status-underOffer-bg)] text-[var(--lc-status-underOffer-fg)]'
  return 'bg-[var(--lc-status-published-bg)] text-[var(--lc-status-published-fg)]'
}

export function PriceReportCompositeRiskCell({
  tenureTier,
  deltaTier,
  compositeTier,
  className,
}: {
  tenureTier: RiskTier
  deltaTier: RiskTier
  compositeTier: RiskTier
  className?: string
}) {
  const driver =
    compositeTier === 'high'
      ? tenureTier === 'high' && deltaTier === 'high'
        ? 'both'
        : deltaTier === 'high'
          ? 'delta'
          : 'tenure'
      : 'none'

  return (
    <div
      className={cn('flex flex-col gap-1', className)}
      aria-label={
        driver === 'none'
          ? `Composite risk ${compositeTier}; tenure ${tenureTier}; delta ${deltaTier}`
          : `High risk composite; ${driver} drives tier; tenure is ${tenureTier}; delta is ${deltaTier}`
      }
    >
      <Badge variant="outline" className={cn('w-fit border-transparent', riskTone(tenureTier))}>
        Tenure {tenureTier}
      </Badge>
      <Badge variant="outline" className={cn('w-fit border-transparent', riskTone(deltaTier))}>
        Delta {deltaTier}
      </Badge>
    </div>
  )
}

export function AgentTierChip({ tier }: { tier: string }) {
  const isElite = tier === 'pro_elite'
  return (
    <Badge
      variant="outline"
      className={cn(
        'w-fit',
        isElite
          ? 'border-[var(--lc-accent-bold-edge)] bg-[var(--lc-accent-bold)] text-[var(--lc-accent-bold-text)]'
          : 'border-[var(--lc-border)] bg-[var(--lc-surface-sunken)] text-[var(--lc-text-heading)]',
      )}
    >
      {isElite ? 'Pro Elite' : 'Pro'}
    </Badge>
  )
}
