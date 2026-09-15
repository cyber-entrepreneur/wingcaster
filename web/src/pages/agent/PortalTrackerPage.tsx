import { useMemo } from 'react'
import { Loader2 } from 'lucide-react'
import { usePageTitle } from '@/lib/usePageTitle'
import { useOnlineStatus } from '@/lib/useOnlineStatus'
import { Button } from '@/components/ui/button'
import { usePortalTrackerList } from '@/hooks/publishing/usePortalTrackerList'
import { usePortalTrackerSummary } from '@/hooks/publishing/usePortalTrackerSummary'
import { usePortalSubmissionPush } from '@/hooks/publishing/usePortalSubmissionPush'
import {
  PortalTrackerRow,
  TrackerEmptyState,
  TrackerFilterBar,
  TrackerKpiStrip,
} from '@/pages/agent/PortalTrackerScreen'

/**
 * AGT-PUB-006 — Portal submission tracker (rolling multi-job ledger).
 * Route: `/publishing/tracker`
 */
export function PortalTrackerPage() {
  usePageTitle('Portal submissions')
  const online = useOnlineStatus()

  const list = usePortalTrackerList()
  const summary = usePortalTrackerSummary(list.filters)

  const visibleIds = useMemo(
    () => list.rows.map((r) => r.distribution_attempt_id),
    [list.rows],
  )

  const push = usePortalSubmissionPush({
    visibleIds,
    patchRow: list.patchRow,
    onInvalidateSummary: summary.invalidate,
    onRefresh: list.refresh,
  })

  const showFatalError = Boolean(list.error && summary.error && list.rows.length === 0)
  const emptyNever = !list.loading && list.rows.length === 0 && !list.filtersActive
  const emptyFilters = !list.loading && list.rows.length === 0 && list.filtersActive

  return (
    <div
      data-testid="portal-tracker-page"
      className="min-h-full bg-[var(--lc-bg-page)] text-[var(--lc-text-primary)]"
    >
      <header className="border-b border-[var(--lc-border)] bg-[var(--lc-surface-raised)] px-[var(--lc-space-md)] py-3">
        <h1 style={{ font: 'var(--lc-type-heading-1)' }}>Portal submissions</h1>
      </header>

      {!online ? (
        <div
          role="status"
          className="border-b border-[var(--lc-border)] bg-[var(--lc-surface-sunken)] px-[var(--lc-space-md)] py-2 text-sm text-[var(--lc-text-muted)]"
        >
          You're offline — some actions won't work.
        </div>
      ) : null}

      {push.offscreenUpdateCount > 0 ? (
        <div className="flex justify-center px-[var(--lc-space-md)] pt-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="min-h-tap"
            onClick={() => {
              push.clearOffscreenUpdates()
              void list.refresh()
            }}
          >
            {push.offscreenUpdateCount} new update{push.offscreenUpdateCount === 1 ? '' : 's'}
          </Button>
        </div>
      ) : null}

      <div className="mx-auto max-w-5xl px-[var(--lc-space-md)] py-[var(--lc-space-md)]">
        <div aria-live="polite" className="sr-only" data-testid="tracker-live-region">
          {push.fadingIds.size > 0 ? 'Submission status updated' : ''}
        </div>

        {showFatalError ? (
          <div role="alert" className="py-[var(--lc-space-xl)] text-center">
            <p>Couldn't load portal submissions.</p>
            <Button
              type="button"
              className="mt-4 min-h-tap"
              onClick={() => {
                void list.refresh()
                void summary.refresh()
              }}
            >
              Retry
            </Button>
          </div>
        ) : (
          <>
            <TrackerKpiStrip summary={summary.summary} loading={summary.loading} />

            <TrackerFilterBar
              className="mt-[var(--lc-space-md)]"
              filters={list.filters}
              onChange={list.setFilters}
              onClear={list.clearFilters}
              filtersActive={list.filtersActive}
            />

            {!online && list.rows.length === 0 ? (
              <TrackerEmptyState variant="offline" onRetry={() => void list.refresh()} />
            ) : list.loading && list.rows.length === 0 ? (
              <div
                className="flex items-center justify-center gap-2 py-[var(--lc-space-xl)] text-[var(--lc-text-muted)]"
                role="status"
              >
                <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
                Loading…
              </div>
            ) : emptyNever ? (
              <TrackerEmptyState variant="never-published" />
            ) : emptyFilters ? (
              <TrackerEmptyState variant="filters" onClearFilters={list.clearFilters} />
            ) : (
              <>
                <ul className="mt-[var(--lc-space-md)]" aria-label="Portal submissions">
                  {list.rows.map((row) => (
                    <li key={row.distribution_attempt_id}>
                      <PortalTrackerRow
                        row={row}
                        fading={push.fadingIds.has(row.distribution_attempt_id)}
                      />
                    </li>
                  ))}
                </ul>

                <div className="mt-[var(--lc-space-md)] flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm text-[var(--lc-text-muted)]">
                    Showing {list.rows.length} of {list.total} submissions
                  </p>
                  {list.hasMore ? (
                    <Button
                      type="button"
                      variant="outline"
                      className="min-h-tap"
                      disabled={list.loadingMore || !online}
                      onClick={() => void list.loadMore()}
                    >
                      {list.loadingMore ? 'Loading…' : 'Load more'}
                    </Button>
                  ) : null}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default PortalTrackerPage
