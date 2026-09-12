import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { api } from '@/api/client'
import { usePageTitle } from '@/lib/usePageTitle'
import { Button } from '@/components/ui/button'
import {
  AggregateOutcomeHero,
  CreditsSummary,
  PortalReceiptCard,
  type AggregateOutcome,
  type PortalErrorClass,
} from '@/components/portals'
import type { Property } from '@/types'

type TrackerRow = {
  id?: string
  portal_code?: string
  portal_display_name?: string
  status?: string
  error_class?: string | null
  credit_charged?: number
  credit_reserved?: number
  updated_at?: string
  published_at?: string
  live_url?: string
  listing?: { id?: string; title?: string }
}

type TrackerResponse = {
  items?: TrackerRow[]
  rows?: TrackerRow[]
  data?: TrackerRow[]
}

function mapTrackerStatus(raw?: string): 'succeeded' | 'in_review' | 'failed' {
  const v = (raw || '').toLowerCase()
  if (v === 'succeeded' || v === 'published' || v === 'live' || v === 'success') return 'succeeded'
  if (v === 'failed' || v === 'error' || v === 'rejected') return 'failed'
  return 'in_review'
}

function toAggregate(counts: {
  succeeded: number
  in_review: number
  failed: number
}): AggregateOutcome {
  const total = counts.succeeded + counts.in_review + counts.failed
  if (total === 0) return 'in_review_only'
  if (counts.failed === total) return 'all_failed'
  if (counts.succeeded === total) return 'all_succeeded'
  if (counts.in_review === total) return 'in_review_only'
  if (counts.succeeded > 0 && counts.in_review > 0 && counts.failed === 0) return 'partial'
  return 'mixed'
}

/**
 * AGT-PUB-003 / AGT-PUB-005 — publish outcome receipt.
 * Route: `/publish/outcome/:id` where `:id` is the listing (property) id
 * from the AGT-LST-004 publish redirect. Also accepts a job id when the
 * tracker has already created one (deep-linked from notifications).
 */
export function PublishOutcomePage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  usePageTitle('Publish outcome')

  const [loading, setLoading] = useState(true)
  const [property, setProperty] = useState<Property | null>(null)
  const [rows, setRows] = useState<TrackerRow[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setError(null)
      try {
        const [propResult, trackerResult] = await Promise.allSettled([
          api.getProperty(id) as Promise<Property>,
          api.getPublishingTracker({ listing_id: id, limit: '50' }) as Promise<TrackerResponse>,
        ])
        if (cancelled) return
        if (propResult.status === 'fulfilled') setProperty(propResult.value)
        if (trackerResult.status === 'fulfilled') {
          const body = trackerResult.value
          const list = body.items || body.rows || body.data || []
          setRows(Array.isArray(list) ? list : [])
        }
      } catch (err: unknown) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Could not load publish outcome')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [id])

  const counts = useMemo(() => {
    const c = { succeeded: 0, in_review: 0, failed: 0 }
    for (const row of rows) {
      c[mapTrackerStatus(row.status)]++
    }
    if (rows.length === 0) {
      // Optimistic post-publish: syndication is queued
      return { succeeded: 0, in_review: 1, failed: 0 }
    }
    return c
  }, [rows])

  const aggregate = toAggregate(counts)
  const total = Math.max(1, counts.succeeded + counts.in_review + counts.failed)
  const title =
    property?.title ||
    rows[0]?.listing?.title ||
    [property?.neighborhood || property?.location, property?.city].filter(Boolean).join(' · ') ||
    'Your listing'
  const publishedAt =
    rows[0]?.published_at || rows[0]?.updated_at || property?.listed_date || new Date().toISOString()
  const creditsCharged = rows.reduce((s, r) => s + Number(r.credit_charged || 0), 0)
  const creditsReserved = rows.reduce((s, r) => s + Number(r.credit_reserved || 0), 0)

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[var(--lc-text-muted)]" />
      </div>
    )
  }

  if (error && !property) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center" role="alert">
        <h1 className="text-[length:var(--lc-type-heading-1)] font-semibold">Outcome unavailable</h1>
        <p className="mt-2 text-[var(--lc-text-muted)]">{error}</p>
        <Button className="mt-4" onClick={() => navigate('/listings')}>
          Back to listings
        </Button>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
      <AggregateOutcomeHero
        aggregate={aggregate}
        counts={counts}
        total_destinations={total}
        published_at={publishedAt}
        listing_title={title}
      />

      <div className="mt-6 space-y-3">
        {rows.length === 0 ? (
          <p
            role="status"
            className="rounded-[var(--lc-radius-lg)] border border-[var(--lc-border)] bg-[var(--lc-surface-raised)] p-4 text-[length:var(--lc-type-body-sm)] text-[var(--lc-text-muted)]"
          >
            Your listing is published to your profile. Portal syndication is queued — status cards
            will appear here as each channel responds.
          </p>
        ) : (
          rows.map((row, i) => {
            const status = mapTrackerStatus(row.status)
            return (
              <PortalReceiptCard
                key={row.id || `${row.portal_code}-${i}`}
                destination={{
                  portal_code: row.portal_code || 'portal',
                  portal_display_name: row.portal_display_name || row.portal_code || 'Portal',
                }}
                status={status}
                error_class={
                  status === 'failed'
                    ? ((row.error_class as PortalErrorClass) || 'UNKNOWN_ERROR')
                    : undefined
                }
                credit_charged={Number(row.credit_charged || 0)}
                credit_reserved={Number(row.credit_reserved || 0)}
                timestamp={row.published_at || row.updated_at || publishedAt}
                live_url={row.live_url}
              />
            )
          })
        )}
      </div>

      <div className="mt-6">
        <CreditsSummary
          total_charged={creditsCharged}
          total_reserved={Math.max(creditsReserved, creditsCharged)}
          credits_history_deep_link="/credits"
        />
      </div>

      <div className="mt-8 flex flex-wrap gap-3">
        <Button asChild>
          <Link to={id ? `/listings/${id}` : '/listings'}>View listing</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link to="/listings">Back to listings</Link>
        </Button>
      </div>
    </div>
  )
}

export default PublishOutcomePage
