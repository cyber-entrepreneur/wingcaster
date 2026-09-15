import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Numeric } from '@/components/ui/numeric'
import { useToast } from '@/components/ui/toast'
import { cn } from '@/lib/utils'
import { TrackerEmptyState } from '../TrackerEmptyState'
import { TrackerFilterBar } from '../TrackerFilterBar'
import { TrackerKpiStrip } from '../TrackerKpiStrip'
import { PortalTrackerRow } from '../PortalTrackerRow'
import { fetchTrackerList, fetchTrackerSummary } from './api'
import {
  EMPTY_TRACKER_FILTERS,
  filtersAreActive,
  type TrackerFilters,
  type TrackerRow,
  type TrackerSummaryResponse,
} from './types'
import {
  usePortalSubmissionPush,
  type PortalSubmissionStatusChangedDetail,
} from './usePortalSubmissionPush'

export type PortalTrackerScreenProps = {
  filters: TrackerFilters
  onFiltersChange: (next: TrackerFilters) => void
  onNavigate: (path: string) => void
  online?: boolean
  className?: string
}

type LoadState = 'idle' | 'initial' | 'filter' | 'more' | 'error'

/**
 * AGT-PUB-006 composition — KPI + filter + ledger + empty/load-more.
 */
export function PortalTrackerScreen({
  filters,
  onFiltersChange,
  onNavigate,
  online = true,
  className,
}: PortalTrackerScreenProps) {
  const { addToast } = useToast()
  const [rows, setRows] = useState<TrackerRow[]>([])
  const [summary, setSummary] = useState<TrackerSummaryResponse | null>(null)
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [total, setTotal] = useState(0)
  const [loadState, setLoadState] = useState<LoadState>('initial')
  const [updatedIds, setUpdatedIds] = useState<Set<string>>(new Set())
  const [offscreenUpdates, setOffscreenUpdates] = useState(0)
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null)
  const [liveAnnounce, setLiveAnnounce] = useState('')
  const filterTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const toastWindow = useRef(0)
  const mounted = useRef(true)

  const knownIds = useMemo(
    () => new Set(rows.map((r) => r.distribution_attempt_id)),
    [rows],
  )

  const load = useCallback(
    async (mode: 'initial' | 'filter' | 'refresh', nextFilters: TrackerFilters) => {
      setLoadState(mode === 'filter' ? 'filter' : mode === 'initial' ? 'initial' : 'filter')
      try {
        const [list, sum] = await Promise.all([
          fetchTrackerList(nextFilters),
          fetchTrackerSummary(nextFilters),
        ])
        if (!mounted.current) return
        setRows(list.rows || [])
        setNextCursor(list.next_cursor)
        setHasMore(Boolean(list.has_more))
        setTotal(list.total ?? list.rows?.length ?? 0)
        setSummary(sum)
        setLastUpdatedAt(new Date())
        setLoadState('idle')
        setOffscreenUpdates(0)
      } catch {
        if (!mounted.current) return
        setLoadState('error')
      }
    },
    [],
  )

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  useEffect(() => {
    if (filterTimer.current) clearTimeout(filterTimer.current)
    const delay = rows.length === 0 && !summary && loadState === 'initial' ? 0 : 200
    filterTimer.current = setTimeout(() => {
      void load(rows.length === 0 && !summary ? 'initial' : 'filter', filters)
    }, delay)
    return () => {
      if (filterTimer.current) clearTimeout(filterTimer.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- debounce on filter identity only
  }, [filters, load])

  const loadMore = async () => {
    if (!nextCursor || loadState === 'more' || !online) return
    setLoadState('more')
    try {
      const list = await fetchTrackerList(filters, { after: nextCursor })
      if (!mounted.current) return
      setRows((prev) => [...prev, ...(list.rows || [])])
      setNextCursor(list.next_cursor)
      setHasMore(Boolean(list.has_more))
      setTotal(list.total ?? total)
      setLoadState('idle')
      setLiveAnnounce(`Loaded ${list.rows?.length ?? 0} more submissions`)
    } catch {
      if (!mounted.current) return
      setLoadState('idle')
    }
  }

  const showToastOnce = useCallback(() => {
    const now = Date.now()
    if (now - toastWindow.current < 5000) {
      // replace: toast system appends; brief asks max 1 — skip spam
      return
    }
    toastWindow.current = now
    addToast({ title: 'Submission updated', duration: 4000 })
  }, [addToast])

  const onRowUpdate = useCallback(
    (detail: PortalSubmissionStatusChangedDetail) => {
      setRows((prev) =>
        prev.map((r) =>
          r.distribution_attempt_id === detail.distribution_attempt_id
            ? { ...r, status: detail.status, updated_at: new Date().toISOString() }
            : r,
        ),
      )
      setUpdatedIds((prev) => new Set(prev).add(detail.distribution_attempt_id))
      window.setTimeout(() => {
        setUpdatedIds((prev) => {
          const next = new Set(prev)
          next.delete(detail.distribution_attempt_id)
          return next
        })
      }, 400)
      const statusLabel = detail.status.replace(/_/g, ' ')
      setLiveAnnounce(
        `Submission for ${detail.listing_address || 'listing'} on ${detail.portal_name || 'portal'} is now ${statusLabel}`,
      )
      showToastOnce()
    },
    [showToastOnce],
  )

  const onOffscreenUpdate = useCallback((_detail: PortalSubmissionStatusChangedDetail) => {
    setOffscreenUpdates((n) => n + 1)
  }, [])

  usePortalSubmissionPush({
    enabled: online,
    knownAttemptIds: knownIds,
    onRowUpdate,
    onOffscreenUpdate,
  })

  const clearFilters = () => onFiltersChange({ ...EMPTY_TRACKER_FILTERS })
  const activeFilters = filtersAreActive(filters)
  const initialLoading = loadState === 'initial'
  const filterLoading = loadState === 'filter'
  const showEmptyNever = !initialLoading && !filterLoading && rows.length === 0 && !activeFilters && loadState !== 'error'
  const showEmptyFilters = !initialLoading && !filterLoading && rows.length === 0 && activeFilters && loadState !== 'error'
  const showEmptyOffline = !online && rows.length === 0 && loadState !== 'error'
  const showError = loadState === 'error' && rows.length === 0 && !summary

  return (
    <div className={cn('mx-auto w-full max-w-[1200px]', className)}>
      {!online ? (
        <div
          role="status"
          className="border-b border-[var(--lc-border)] bg-[var(--lc-surface-sunken)] px-[var(--lc-space-md)] py-[var(--lc-space-xs)] text-[var(--lc-text-secondary)]"
          style={{ font: 'var(--lc-type-body-sm)' }}
        >
          You&apos;re offline — some actions won&apos;t work.
        </div>
      ) : null}

      <div className="px-[var(--lc-space-md)] pt-[var(--lc-space-md)] md:pt-[var(--lc-space-xl)]">
        <div className="mb-[var(--lc-space-lg)] flex items-center justify-between gap-4">
          <h1
            className="text-[var(--lc-text-heading)]"
            style={{
              font: 'var(--lc-type-heading-1)',
              letterSpacing: 'var(--lc-tracking-heading-1)',
            }}
          >
            Portal submissions
          </h1>
        </div>

        <TrackerKpiStrip
          summary={summary}
          loading={initialLoading || filterLoading}
          className="mb-[var(--lc-space-md)]"
        />

        {!online && lastUpdatedAt ? (
          <p
            className="mb-[var(--lc-space-sm)] text-[var(--lc-text-muted)]"
            style={{ font: 'var(--lc-type-caption)' }}
          >
            Last updated {lastUpdatedAt.toLocaleTimeString()}
          </p>
        ) : null}

        {total > 500 ? (
          <p
            className="mb-[var(--lc-space-sm)] text-[var(--lc-text-muted)]"
            style={{ font: 'var(--lc-type-caption)' }}
          >
            Tip: use filters to narrow this list — <Numeric>{total}</Numeric> total submissions.
          </p>
        ) : null}
      </div>

      <TrackerFilterBar
        filters={filters}
        onChange={onFiltersChange}
        onClear={clearFilters}
        disabled={!online || initialLoading}
      />

      {offscreenUpdates > 0 ? (
        <div className="px-[var(--lc-space-md)] pt-[var(--lc-space-sm)]">
          <Button
            type="button"
            variant="outline"
            onClick={() => void load('refresh', filters)}
          >
            {offscreenUpdates} new update{offscreenUpdates === 1 ? '' : 's'} — Refresh
          </Button>
        </div>
      ) : null}

      <div
        className={cn(
          'relative',
          filterLoading && 'opacity-40',
        )}
        aria-busy={initialLoading || filterLoading || loadState === 'more'}
      >
        {filterLoading ? (
          <div className="pointer-events-none absolute inset-x-0 top-8 z-10 flex justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-[var(--lc-text-muted)] motion-reduce:animate-none" aria-hidden="true" />
          </div>
        ) : null}

        {showError || showEmptyOffline ? (
          <TrackerEmptyState
            variant={showEmptyOffline ? 'offline' : 'error'}
            onRetry={() => void load('initial', filters)}
            onContactSupport={() =>
              onNavigate(`/support?ref=publishing-tracker`)
            }
          />
        ) : null}

        {showEmptyNever ? (
          <TrackerEmptyState
            variant="never_published"
            onPublishFirst={() => onNavigate('/listings')}
          />
        ) : null}

        {showEmptyFilters ? (
          <TrackerEmptyState variant="filters" onClearFilters={clearFilters} />
        ) : null}

        {initialLoading ? (
          <ul className="px-[var(--lc-space-md)] py-[var(--lc-space-sm)] md:hidden">
            {Array.from({ length: 5 }, (_, i) => (
              <li key={i} className="border-b border-[var(--lc-border)] py-[var(--lc-space-sm)]">
                <div className="flex gap-3">
                  <div className="h-12 w-12 animate-pulse rounded-[var(--lc-radius-md)] bg-[var(--lc-surface-sunken)] motion-reduce:animate-none" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-2/3 animate-pulse rounded bg-[var(--lc-surface-sunken)] motion-reduce:animate-none" />
                    <div className="h-3 w-1/3 animate-pulse rounded bg-[var(--lc-surface-sunken)] motion-reduce:animate-none" />
                  </div>
                </div>
              </li>
            ))}
          </ul>
        ) : null}

        {!initialLoading && rows.length > 0 ? (
          <>
            <ul className="md:hidden" aria-label="Portal submissions">
              {rows.map((row) => (
                <PortalTrackerRow
                  key={row.distribution_attempt_id}
                  row={row}
                  layout="mobile"
                  onNavigate={onNavigate}
                  justUpdated={updatedIds.has(row.distribution_attempt_id)}
                />
              ))}
            </ul>

            <div className="hidden overflow-x-auto md:block">
              <table className="w-full border-collapse">
                <thead className="bg-[var(--lc-surface-sunken)]">
                  <tr>
                    {['Listing', 'Portal', 'Submitted', 'Status', 'Credits'].map((h) => (
                      <th
                        key={h}
                        scope="col"
                        className="px-[var(--lc-space-md)] py-[var(--lc-space-sm)] text-start text-[var(--lc-text-muted)]"
                        style={{
                          font: 'var(--lc-type-overline)',
                          letterSpacing: 'var(--lc-tracking-overline)',
                        }}
                      >
                        {h}
                      </th>
                    ))}
                    <th scope="col" className="px-[var(--lc-space-md)] py-[var(--lc-space-sm)]">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <PortalTrackerRow
                      key={row.distribution_attempt_id}
                      row={row}
                      layout="desktop"
                      onNavigate={onNavigate}
                      justUpdated={updatedIds.has(row.distribution_attempt_id)}
                    />
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex flex-col items-stretch gap-[var(--lc-space-sm)] px-[var(--lc-space-md)] py-[var(--lc-space-lg)] md:flex-row md:items-center md:justify-between">
              <p
                className="text-[var(--lc-text-muted)]"
                style={{ font: 'var(--lc-type-body-sm)' }}
              >
                Showing <Numeric>{rows.length}</Numeric> of <Numeric>{total}</Numeric> submissions
              </p>
              {hasMore ? (
                <Button
                  type="button"
                  variant="outline"
                  disabled={loadState === 'more' || !online}
                  onClick={() => void loadMore()}
                  className="w-full md:w-auto"
                >
                  {loadState === 'more' ? (
                    <>
                      <Loader2 className="me-2 h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
                      Loading…
                    </>
                  ) : (
                    'Load more'
                  )}
                </Button>
              ) : rows.length > 0 ? (
                <p className="text-[var(--lc-text-muted)]" style={{ font: 'var(--lc-type-caption)' }}>
                  You&apos;ve reached the end
                </p>
              ) : null}
            </div>
          </>
        ) : null}
      </div>

      <footer className="px-[var(--lc-space-md)] pb-[var(--lc-space-3xl)] text-center">
        <Button
          type="button"
          variant="link"
          onClick={() => onNavigate('/support?ref=publishing-tracker')}
        >
          Something not right? Contact WingCaster support
        </Button>
      </footer>

      <div className="sr-only" aria-live="polite">
        {liveAnnounce}
        {loadState === 'more' ? 'Loading more submissions' : ''}
      </div>
    </div>
  )
}
