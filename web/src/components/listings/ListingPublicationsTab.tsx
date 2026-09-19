import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  CalendarClock, ExternalLink, Globe2, Loader2, Megaphone, RefreshCw, RotateCcw, X,
} from 'lucide-react'
import { api, type ScheduledPublication } from '@/api/client'
import { useToast } from '@/components/ui/toast'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Numeric } from '@/components/ui/numeric'
import { PortalStatusPill } from '@/components/ui/portal-status-pill'
import type { TrackerRow } from '@/components/publishing/PortalTrackerScreen/types'
import { receiptPathForRow } from '@/components/publishing/PortalTrackerScreen/types'
import { apiErrorMessage } from '@/lib/http-status'

type DistributionRow = Awaited<ReturnType<typeof api.getDistributions>>[number]

type TimelineEntry =
  | {
      id: string
      kind: 'social'
      at: string
      channel: string
      status: string
      row: DistributionRow
    }
  | {
      id: string
      kind: 'portal'
      at: string
      channel: string
      status: string
      row: TrackerRow
    }
  | {
      id: string
      kind: 'scheduled'
      at: string
      channel: string
      status: string
      row: ScheduledPublication
    }

const SOCIAL_LABELS: Record<string, string> = {
  instagram: 'Instagram',
  facebook: 'Facebook',
  tiktok: 'TikTok',
  x: 'X',
  linkedin: 'LinkedIn',
  whatsapp: 'WhatsApp',
}

function socialStatusLabel(status: string): string {
  if (status === 'published') return 'Success'
  if (status === 'failed') return 'Failed'
  if (status === 'pending' || status === 'processing') return 'Pending'
  if (status === 'removed') return 'Removed'
  return status
}

function socialStatusTone(status: string): 'default' | 'outline' | 'secondary' {
  if (status === 'published') return 'default'
  if (status === 'failed') return 'outline'
  return 'secondary'
}

interface Props {
  listingId: string
}

/**
 * AGT-LST-011 — Publications tab.
 * Unified timeline: social distributions, portal submissions, scheduled publishes.
 */
export function ListingPublicationsTab({ listingId }: Props) {
  const { addToast } = useToast()
  const [loading, setLoading] = useState(true)
  const [distributions, setDistributions] = useState<DistributionRow[]>([])
  const [scheduled, setScheduled] = useState<ScheduledPublication[]>([])
  const [portalRows, setPortalRows] = useState<TrackerRow[]>([])
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [dist, sched, tracker] = await Promise.all([
        api.getDistributions(listingId),
        api.listScheduledPublications(listingId).then((r) => r.scheduled || []),
        api.getPublishingTracker({ listing_id: listingId, limit: '50' }).then((r) => {
          const body = r as { rows?: TrackerRow[] }
          return body.rows || []
        }),
      ])
      setDistributions(dist)
      setScheduled(sched)
      setPortalRows(tracker)
    } catch (err: unknown) {
      addToast({
        title: 'Could not load publications',
        description: apiErrorMessage(err),
        variant: 'error',
      })
    } finally {
      setLoading(false)
    }
  }, [addToast, listingId])

  useEffect(() => { void load() }, [load])

  const timeline = useMemo(() => {
    const entries: TimelineEntry[] = []
    for (const row of distributions) {
      entries.push({
        id: `social-${row.id}`,
        kind: 'social',
        at: row.published_at || row.insights_fetched_at || '',
        channel: SOCIAL_LABELS[row.platform] || row.platform,
        status: row.status,
        row,
      })
    }
    for (const row of portalRows) {
      entries.push({
        id: `portal-${row.distribution_attempt_id}`,
        kind: 'portal',
        at: row.submitted_at || row.updated_at || '',
        channel: row.portal.display_name || row.portal.code || 'Portal',
        status: row.status,
        row,
      })
    }
    for (const row of scheduled) {
      entries.push({
        id: `scheduled-${row.id}`,
        kind: 'scheduled',
        at: row.scheduled_at,
        channel: Array.isArray(row.portals)
          ? row.portals.map((p) => (typeof p === 'string' ? p : p.code)).join(', ')
          : 'Portals',
        status: row.status,
        row,
      })
    }
    return entries.sort((a, b) => new Date(b.at || 0).getTime() - new Date(a.at || 0).getTime())
  }, [distributions, portalRows, scheduled])

  async function refreshInsights(id: string) {
    setBusyId(id)
    try {
      await api.refreshDistributionInsights(id)
      addToast({ title: 'Insights refreshed', variant: 'success' })
      await load()
    } catch (err: unknown) {
      addToast({ title: 'Refresh failed', description: apiErrorMessage(err), variant: 'error' })
    } finally {
      setBusyId(null)
    }
  }

  async function retrySocial(id: string) {
    setBusyId(id)
    try {
      await api.retryDistribution(id)
      addToast({ title: 'Retry queued', variant: 'success' })
      await load()
    } catch (err: unknown) {
      addToast({ title: 'Retry failed', description: apiErrorMessage(err), variant: 'error' })
    } finally {
      setBusyId(null)
    }
  }

  async function cancelScheduled(id: string) {
    setBusyId(id)
    try {
      await api.cancelScheduledPublication(id)
      addToast({ title: 'Scheduled publish cancelled', variant: 'success' })
      await load()
    } catch (err: unknown) {
      addToast({ title: 'Cancel failed', description: apiErrorMessage(err), variant: 'error' })
    } finally {
      setBusyId(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12" data-screen="AGT-LST-011">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-4" data-screen="AGT-LST-011">
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 space-y-0">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Megaphone className="h-5 w-5 text-[var(--lc-action-primary)]" />
              Publications
            </CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              Every channel this listing was published to — live, pending, failed, or scheduled.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link to={`/listings/${listingId}/portals/submit`}>
              <Button size="sm" className="gap-1.5">
                <Globe2 className="h-4 w-4" />
                Submit to portals
              </Button>
            </Link>
            <Link to={`/publishing/tracker?listing_id=${encodeURIComponent(listingId)}`}>
              <Button size="sm" variant="outline" className="gap-1.5">
                <ExternalLink className="h-4 w-4" />
                All portal submissions
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {timeline.length === 0 ? (
            <p className="rounded-md border border-dashed bg-slate-50 p-6 text-center text-sm text-muted-foreground">
              No publications yet. Publish to social channels or submit to property portals to see them here.
            </p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {timeline.map((entry) => (
                <li key={entry.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium text-foreground">{entry.channel}</span>
                      {entry.kind === 'scheduled' && (
                        <Badge variant="outline" className="gap-1 text-[10px]">
                          <CalendarClock className="h-3 w-3" />
                          Scheduled
                        </Badge>
                      )}
                      {entry.kind === 'portal' && (
                        <PortalStatusPill status={entry.row.status} />
                      )}
                      {entry.kind === 'social' && (
                        <Badge variant={socialStatusTone(entry.status)} className="text-[10px] capitalize">
                          {socialStatusLabel(entry.status)}
                        </Badge>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {entry.at
                        ? new Date(entry.at).toLocaleString()
                        : 'Date pending'}
                      {entry.kind === 'social' && entry.row.impressions != null && (
                        <> · <Numeric>{entry.row.impressions}</Numeric> impressions</>
                      )}
                      {entry.kind === 'portal' && entry.row.credits_charged > 0 && (
                        <> · <Numeric>{entry.row.credits_charged}</Numeric> credits</>
                      )}
                    </p>
                    {entry.kind === 'portal' && entry.row.error_message && (
                      <p className="mt-1 text-xs text-rose-700">{entry.row.error_message}</p>
                    )}
                    {entry.kind === 'scheduled' && entry.row.last_error && (
                      <p className="mt-1 text-xs text-rose-700">{entry.row.last_error}</p>
                    )}
                  </div>
                  <div className="flex shrink-0 gap-2">
                    {entry.kind === 'social' && entry.status === 'failed' && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1"
                        disabled={busyId === entry.row.id}
                        onClick={() => void retrySocial(entry.row.id)}
                      >
                        {busyId === entry.row.id
                          ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          : <RotateCcw className="h-3.5 w-3.5" />}
                        Retry
                      </Button>
                    )}
                    {entry.kind === 'social' && entry.status === 'published' && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="gap-1"
                        disabled={busyId === entry.row.id}
                        onClick={() => void refreshInsights(entry.row.id)}
                      >
                        {busyId === entry.row.id
                          ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          : <RefreshCw className="h-3.5 w-3.5" />}
                        Insights
                      </Button>
                    )}
                    {entry.kind === 'portal' && (
                      <Link to={receiptPathForRow(entry.row)}>
                        <Button size="sm" variant="outline">View</Button>
                      </Link>
                    )}
                    {entry.kind === 'scheduled' && entry.row.status === 'pending' && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1"
                        disabled={busyId === entry.row.id}
                        onClick={() => void cancelScheduled(entry.row.id)}
                      >
                        {busyId === entry.row.id
                          ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          : <X className="h-3.5 w-3.5" />}
                        Cancel
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
