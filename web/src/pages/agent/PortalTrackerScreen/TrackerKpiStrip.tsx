import type { ReactNode } from 'react'
import { Numeric } from '@/components/ui/numeric'
import { cn } from '@/lib/utils'
import type { PortalTrackerSummaryResponse } from '@/hooks/publishing/types'

export type TrackerKpiStripProps = {
  summary: PortalTrackerSummaryResponse | null
  loading?: boolean
  className?: string
}

type KpiCard = {
  key: string
  label: string
  value: ReactNode
}

/**
 * AGT-PUB-006 KPI strip — Total / Success rate / Credits / Top failure class.
 * (Brief §Broadcast alignment — not worker pending/running enums.)
 */
export function TrackerKpiStrip({ summary, loading = false, className }: TrackerKpiStripProps) {
  const cards: KpiCard[] = loading || !summary
    ? [
        { key: 'total', label: 'Submissions this month', value: '—' },
        { key: 'rate', label: 'Success rate', value: '—' },
        { key: 'credits', label: 'Credits spent', value: '—' },
        { key: 'fail', label: 'Top failure class', value: '—' },
      ]
    : [
        {
          key: 'total',
          label: 'Submissions this month',
          value: <Numeric>{summary.total_submissions}</Numeric>,
        },
        {
          key: 'rate',
          label: 'Success rate',
          value: <Numeric>{`${Math.round(summary.success_rate * 100)}%`}</Numeric>,
        },
        {
          key: 'credits',
          label: 'Credits spent',
          value: <Numeric>{summary.credits_spent}</Numeric>,
        },
        {
          key: 'fail',
          label: 'Top failure class',
          value: summary.top_failure_class ? (
            <span className="font-[var(--lc-font-ui)] text-[length:var(--lc-type-heading-3)] font-extrabold leading-tight">
              {summary.top_failure_class.display_label}
            </span>
          ) : (
            <span className="text-[var(--lc-text-muted)]">None</span>
          ),
        },
      ]

  return (
    <section
      aria-label="Portal submissions summary"
      aria-busy={loading || undefined}
      className={cn(
        'grid grid-cols-2 gap-[var(--lc-space-sm)] md:grid-cols-4',
        className,
      )}
    >
      {cards.map((card) => (
        <article
          key={card.key}
          className={cn(
            'min-h-[88px] rounded-[var(--lc-radius-lg)] border border-[var(--lc-border)]',
            'bg-[var(--lc-surface-raised)] p-[var(--lc-space-sm)] shadow-[var(--lc-elevation-sm)]',
          )}
        >
          <h2
            className="text-[var(--lc-text-muted)]"
            style={{ font: 'var(--lc-type-overline)' }}
          >
            {card.label}
          </h2>
          <div
            className="mt-1 text-[var(--lc-text-heading)]"
            style={{ font: 'var(--lc-type-display)' }}
            data-testid={`tracker-kpi-${card.key}`}
          >
            {card.value}
          </div>
        </article>
      ))}
    </section>
  )
}
