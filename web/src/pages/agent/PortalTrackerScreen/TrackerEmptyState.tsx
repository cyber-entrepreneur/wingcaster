import { Send } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export type TrackerEmptyStateProps = {
  variant: 'never-published' | 'filters' | 'offline'
  onClearFilters?: () => void
  onRetry?: () => void
  className?: string
}

/**
 * Distinct empty states: never published (CTA → /listings), filter-narrowed, offline.
 */
export function TrackerEmptyState({
  variant,
  onClearFilters,
  onRetry,
  className,
}: TrackerEmptyStateProps) {
  if (variant === 'offline') {
    return (
      <div
        role="status"
        data-testid="tracker-empty-offline"
        className={cn('py-[var(--lc-space-xl)] text-center', className)}
      >
        <h2 style={{ font: 'var(--lc-type-heading-2)' }}>You're offline</h2>
        <p className="mt-2 text-[var(--lc-text-muted)]">
          Reconnect to see up-to-date portal submissions.
        </p>
        {onRetry ? (
          <Button type="button" className="mt-4 min-h-tap" onClick={onRetry}>
            Retry
          </Button>
        ) : null}
      </div>
    )
  }

  if (variant === 'filters') {
    return (
      <div
        role="status"
        data-testid="tracker-empty-filters"
        className={cn('py-[var(--lc-space-xl)] text-center', className)}
      >
        <h2 style={{ font: 'var(--lc-type-heading-2)' }}>No submissions match these filters</h2>
        <p className="mt-2 text-[var(--lc-text-muted)]">
          Try broadening your date range or clearing a filter.
        </p>
        {onClearFilters ? (
          <Button
            type="button"
            variant="outline"
            className="mt-4 min-h-tap"
            onClick={onClearFilters}
          >
            Clear filters
          </Button>
        ) : null}
      </div>
    )
  }

  return (
    <div
      role="status"
      data-testid="tracker-empty-never"
      className={cn('py-[var(--lc-space-xl)] text-center', className)}
    >
      <div
        className={cn(
          'mx-auto flex max-w-md flex-col items-center rounded-[var(--lc-radius-xl)]',
          'border border-[var(--lc-border)] bg-[var(--lc-surface-raised)] p-[var(--lc-space-lg)]',
          'shadow-[var(--lc-elevation-sm)]',
        )}
      >
        <Send
          className="h-16 w-16 text-[var(--lc-text-muted)]"
          aria-hidden="true"
        />
        <h2 className="mt-4" style={{ font: 'var(--lc-type-heading-2)' }}>
          No portal submissions yet
        </h2>
        <p className="mt-2 text-[var(--lc-text-muted)]">
          When you publish a listing to Bayut, Property Finder or another portal, its status shows
          up here.
        </p>
        <Button asChild className="mt-4 min-h-tap">
          <Link to="/listings">Publish your first listing</Link>
        </Button>
      </div>
    </div>
  )
}
