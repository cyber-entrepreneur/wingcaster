import { Link } from 'react-router-dom'
import { Numeric } from '@/components/ui/numeric'
import { cn } from '@/lib/utils'

export type ImpactPanelMode = 'removed' | 'quarantined'

export type ImpactPanelProps = {
  count: number
  mode: ImpactPanelMode
  /** Filtered listings deep-link (AGT-LST-001). */
  affectedListingsHref?: string
  className?: string
}

/**
 * AGT-REC-002 impact statement — sunken well between resolver and CTA.
 * Renders ONLY for approved-removed / approved-quarantined.
 */
export function ImpactPanel({
  count,
  mode,
  affectedListingsHref = '/listings',
  className,
}: ImpactPanelProps) {
  const zero = count <= 0

  return (
    <section
      data-testid="impact-panel"
      data-impact-mode={mode}
      aria-label="Valuation impact"
      className={cn(
        'rounded-lg bg-[var(--lc-surface-sunken)] p-[var(--lc-space-lg)]',
        className,
      )}
    >
      {zero ? (
        <p
          className="text-[var(--lc-text-muted)]"
          style={{ font: 'var(--lc-type-body)' }}
        >
          No listings of yours use this comparable in their valuation set.
        </p>
      ) : (
        <>
          <p
            className="text-[var(--lc-text-primary)]"
            style={{ font: 'var(--lc-type-body)' }}
          >
            <Numeric as="strong" className="font-semibold" aria-label={`${count} listings`}>
              {count}
            </Numeric>
            {mode === 'removed'
              ? ' of your listings had valuation recomputed after this correction.'
              : ' of your listings now show a "data under review" flag on their valuation.'}
          </p>
          <Link
            to={affectedListingsHref}
            className="mt-[var(--lc-space-sm)] inline-block text-[var(--lc-text-brand)] underline-offset-2 hover:underline"
            style={{ font: 'var(--lc-type-body-sm)' }}
          >
            View affected listings
          </Link>
        </>
      )}
    </section>
  )
}
