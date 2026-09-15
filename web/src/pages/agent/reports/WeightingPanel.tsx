import { Numeric } from '@/components/ui/numeric'
import { cn } from '@/lib/utils'

export type WeightingPanelProps = {
  /** 0–100 applied signal weight. */
  weight: number
  /** Incorporated (authoritative) vs signal-only. */
  mode: 'incorporated' | 'signal_only'
  marketSegmentLabel: string
  /** ISO date when signal went live (incorporated only). */
  effectiveOn?: string | null
  className?: string
}

const TICKS = [25, 50, 75, 100] as const

function formatDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

/**
 * AGT-REC-003 weighting panel — sunken well with role="meter" bar.
 * Renders for approved-incorporated / approved-signal-only.
 */
export function WeightingPanel({
  weight,
  mode,
  marketSegmentLabel,
  effectiveOn,
  className,
}: WeightingPanelProps) {
  const clamped = Math.max(0, Math.min(100, Number.isFinite(weight) ? weight : 0))

  return (
    <section
      data-testid="weighting-panel"
      data-weight-mode={mode}
      data-weight={clamped}
      aria-label="Signal weighting"
      className={cn(
        'rounded-lg bg-[var(--lc-surface-sunken)] p-[var(--lc-space-lg)]',
        className,
      )}
      dir="ltr"
    >
      <p
        className="text-[var(--lc-text-primary)]"
        style={{ font: 'var(--lc-type-body)' }}
      >
        Applied weight:{' '}
        <Numeric as="strong" className="font-semibold" aria-label={`${clamped} percent`}>
          {clamped}%
        </Numeric>
      </p>

      <div className="relative mt-[var(--lc-space-md)] h-3 w-full">
        <div
          className="absolute inset-0 rounded-[var(--lc-radius-sm)] bg-[var(--lc-border)]"
          aria-hidden="true"
        />
        <div
          role="meter"
          aria-valuenow={clamped}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Signal weight applied by Platform Administrator"
          className="absolute inset-y-0 start-0 rounded-[var(--lc-radius-sm)] bg-[var(--lc-accent-bold)] outline outline-1 outline-[var(--lc-accent-bold-edge)]"
          style={{ width: `${clamped}%` }}
        />
        {TICKS.map((tick) => (
          <span
            key={tick}
            aria-hidden="true"
            className="absolute top-0 bottom-0 w-px bg-[var(--lc-border-strong)]"
            style={{ left: `${tick}%` }}
          />
        ))}
      </div>

      <p
        className="mt-[var(--lc-space-md)] text-[var(--lc-text-primary)]"
        style={{ font: 'var(--lc-type-body-sm)' }}
      >
        {mode === 'incorporated' ? (
          <>
            Your signal is being used as <strong>authoritative</strong> in {marketSegmentLabel}.
          </>
        ) : (
          <>
            Your signal is being <strong>weighted alongside other signals</strong> in{' '}
            {marketSegmentLabel}.
          </>
        )}
      </p>

      {mode === 'incorporated' && effectiveOn ? (
        <p
          className="mt-[var(--lc-space-xs)] text-[var(--lc-text-muted)]"
          style={{ font: 'var(--lc-type-body-sm)' }}
        >
          Signal is live on the platform pricing model from{' '}
          <Numeric aria-label={`Effective on ${formatDate(effectiveOn)}`}>
            {formatDate(effectiveOn)}
          </Numeric>
          .
        </p>
      ) : null}
    </section>
  )
}
