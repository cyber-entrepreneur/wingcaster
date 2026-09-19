import { Numeric } from '@/components/ui/numeric'
import type { AgencyWalletAllocationSlice } from '@/api/client'

const SLICE_COLORS = [
  'var(--lc-action-primary)',
  'var(--lc-status-info)',
  'var(--lc-status-success)',
  'var(--lc-status-warning)',
  'var(--lc-status-danger)',
  'var(--lc-text-muted)',
]

interface AllocationDonutProps {
  slices: AgencyWalletAllocationSlice[]
  title?: string
}

export function AllocationDonut({ slices, title = 'Allocation by agent' }: AllocationDonutProps) {
  const total = slices.reduce((sum, slice) => sum + slice.credits, 0)

  if (!slices.length || total <= 0) {
    return (
      <div className="space-y-2">
        {title && <h3 className="text-sm font-semibold text-[var(--lc-text-primary)]">{title}</h3>}
        <p className="text-sm text-[var(--lc-text-muted)]">No credits allocated yet.</p>
      </div>
    )
  }

  let cursor = 0
  const gradientStops = slices.map((slice, index) => {
    const pct = (slice.credits / total) * 100
    const start = cursor
    cursor += pct
    return `${SLICE_COLORS[index % SLICE_COLORS.length]} ${start}% ${cursor}%`
  })

  return (
    <div className="space-y-4">
      {title && <h3 className="text-sm font-semibold text-[var(--lc-text-primary)]">{title}</h3>}
      <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
        <div
          className="relative h-36 w-36 shrink-0 rounded-full"
          style={{ background: `conic-gradient(${gradientStops.join(', ')})` }}
          role="img"
          aria-label={`Credit allocation chart with ${slices.length} segments`}
        >
          <div className="absolute inset-5 flex flex-col items-center justify-center rounded-full bg-[var(--lc-bg-page)] text-center">
            <Numeric className="text-lg font-semibold text-[var(--lc-text-primary)]">
              {total.toFixed(2)}
            </Numeric>
            <span className="text-xs text-[var(--lc-text-muted)]">total credits</span>
          </div>
        </div>
        <ul className="min-w-0 flex-1 space-y-2">
          {slices.map((slice, index) => (
            <li key={slice.key} className="flex items-center justify-between gap-3 text-sm">
              <span className="flex min-w-0 items-center gap-2">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: SLICE_COLORS[index % SLICE_COLORS.length] }}
                  aria-hidden="true"
                />
                <span className="truncate text-[var(--lc-text-primary)]">{slice.label}</span>
              </span>
              <Numeric className="shrink-0 text-[var(--lc-text-muted)]">
                {slice.credits.toFixed(2)}
              </Numeric>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
