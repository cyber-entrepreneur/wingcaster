import type { ReactNode } from 'react'
import { Numeric } from '@/components/ui/numeric'
import { cn } from '@/lib/utils'
import type { TrackerSummaryResponse } from './PortalTrackerScreen/types'

export type TrackerKpiStripProps = {
  summary: TrackerSummaryResponse | null
  loading?: boolean
  className?: string
}

function KpiCard({
  label,
  children,
  loading,
}: {
  label: string
  children: ReactNode
  loading?: boolean
}) {
  return (
    <article
      className={cn(
        'min-h-[88px] rounded-[var(--lc-radius-lg)] border border-[var(--lc-border)]',
        'bg-[var(--lc-surface-raised)] p-[var(--lc-space-md)]',
        'shadow-[var(--lc-elevation-sm)]',
      )}
    >
      <h2
        className="text-[var(--lc-text-muted)]"
        style={{
          font: 'var(--lc-type-overline)',
          letterSpacing: 'var(--lc-tracking-overline)',
        }}
      >
        {label}
      </h2>
      <div
        className="mt-[var(--lc-space-2xs)] text-[var(--lc-text-heading)]"
        style={{
          font: 'var(--lc-type-display)',
          letterSpacing: 'var(--lc-tracking-display)',
        }}
      >
        {loading ? (
          <div
            className="mt-1 h-8 w-20 animate-pulse rounded-[var(--lc-radius-md)] bg-[var(--lc-surface-sunken)] motion-reduce:animate-none"
            aria-hidden="true"
          />
        ) : (
          children
        )}
      </div>
    </article>
  )
}

/**
 * KPI strip for AGT-PUB-006 — 2×2 mobile / 1×4 desktop.
 */
export function TrackerKpiStrip({ summary, loading = false, className }: TrackerKpiStripProps) {
  const successPct =
    summary == null ? null : Math.round((summary.success_rate || 0) * 100)
  const topFailure = summary?.top_failure_class

  return (
    <section
      aria-label="Portal submissions summary"
      className={cn(
        'grid grid-cols-2 gap-[var(--lc-space-sm)] md:grid-cols-4 md:gap-[var(--lc-space-lg)]',
        className,
      )}
    >
      <KpiCard label="Submissions this month" loading={loading}>
        <Numeric>{summary?.total_submissions ?? 0}</Numeric>
      </KpiCard>
      <KpiCard label="Success rate" loading={loading}>
        <Numeric>{successPct ?? 0}%</Numeric>
      </KpiCard>
      <KpiCard label="Credits spent" loading={loading}>
        <Numeric>{summary?.credits_spent ?? 0}</Numeric>
      </KpiCard>
      <KpiCard label="Top failure class" loading={loading}>
        {topFailure ? (
          <span className="block" style={{ font: 'var(--lc-type-heading-3)' }}>
            <span style={{ fontFamily: 'var(--lc-font-ui)' }}>{topFailure.display_label}</span>
            <Numeric className="ms-2 text-[var(--lc-text-muted)]" style={{ font: 'var(--lc-type-data-sm)' }}>
              {topFailure.count}
            </Numeric>
          </span>
        ) : (
          <span style={{ font: 'var(--lc-type-heading-3)', fontFamily: 'var(--lc-font-ui)' }}>
            No failures — nice
          </span>
        )}
      </KpiCard>
    </section>
  )
}
