import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, MoreVertical } from 'lucide-react'
import { api } from '@/api/client'
import { usePublishJob } from '@/hooks/usePublishJob'
import { useToast } from '@/components/ui/toast'
import { Button } from '@/components/ui/button'
import {
  PublishReceiptFallback,
  PublishReceiptScreen,
  PublishReceiptSkeleton,
  RECEIPT_COPY,
  supportHref,
} from '@/components/publishing/PublishReceiptScreen'
import { BULK_RETRYABLE_ERROR_CLASSES } from '@/components/portals'
import { usePageTitle } from '@/lib/usePageTitle'

/**
 * AGT-PUB-003 — Publish outcome / receipt.
 * Canonical route: `/publish/receipts/:jobId`
 */
export function PublishReceiptPage() {
  const { jobId } = useParams<{ jobId: string }>()
  const navigate = useNavigate()
  const { addToast } = useToast()
  const { data, loading, error, offline, refresh, setData } = usePublishJob(jobId)
  const [retryingIds, setRetryingIds] = useState<Set<string>>(new Set())
  const [retryAllLoading, setRetryAllLoading] = useState(false)
  const [liveAnnouncement, setLiveAnnouncement] = useState('')
  const prevSnapshot = useRef<string | null>(null)

  usePageTitle(RECEIPT_COPY.navTitle)

  useEffect(() => {
    if (!data) return
    const snap = JSON.stringify(
      data.destinations.map((d) => `${d.id}:${d.status}:${d.error_class || ''}`),
    )
    if (prevSnapshot.current && prevSnapshot.current !== snap) {
      setLiveAnnouncement(RECEIPT_COPY.publishUpdated)
      addToast({ title: RECEIPT_COPY.publishUpdated, variant: 'default' })
    }
    prevSnapshot.current = snap
  }, [data, addToast])

  const handleCopyJobId = async () => {
    if (!data?.job.id) return
    try {
      await navigator.clipboard.writeText(data.job.id)
      addToast({ title: RECEIPT_COPY.jobCopied, variant: 'success' })
    } catch {
      addToast({ title: RECEIPT_COPY.jobCopied, variant: 'default' })
    }
  }

  const handleContactSupport = () => {
    if (!data) return
    navigate(supportHref(data.job, data.destinations))
  }

  const handleRetryDestination = async (destinationId: string) => {
    if (!jobId || offline) return
    setRetryingIds((prev) => new Set(prev).add(destinationId))
    try {
      const result = await api.retryPublishingDestination(jobId, destinationId)
      if (result.job && result.destinations) {
        setData({ job: result.job, destinations: result.destinations })
      } else {
        await refresh()
      }
      setLiveAnnouncement('Retry started')
    } catch (err) {
      const message = (err as Error)?.message || 'Retry failed'
      addToast({ title: message, variant: 'error' })
    } finally {
      setRetryingIds((prev) => {
        const next = new Set(prev)
        next.delete(destinationId)
        return next
      })
    }
  }

  const handleRetryAll = async () => {
    if (!jobId || offline) return
    setRetryAllLoading(true)
    const targets =
      data?.destinations
        .filter(
          (d) =>
            d.status === 'failed' &&
            d.error_class &&
            (BULK_RETRYABLE_ERROR_CLASSES as readonly string[]).includes(d.error_class),
        )
        .map((d) => d.id) || []
    setRetryingIds(new Set(targets))
    try {
      const result = await api.retryAllPublishingDestinations(jobId, [
        ...BULK_RETRYABLE_ERROR_CLASSES,
      ])
      setData({ job: result.job, destinations: result.destinations })
      if (result.job.aggregate === 'all_succeeded' || result.job.aggregate === 'partial') {
        addToast({ title: RECEIPT_COPY.publishComplete, variant: 'success' })
      } else {
        addToast({ title: RECEIPT_COPY.publishUpdated, variant: 'default' })
      }
    } catch (err) {
      const message = (err as Error)?.message || 'Retry failed'
      addToast({ title: message, variant: 'error' })
    } finally {
      setRetryAllLoading(false)
      setRetryingIds(new Set())
    }
  }

  return (
    <div className="min-h-full bg-[var(--lc-bg-page)]">
      <header
        className="sticky top-0 z-10 flex h-12 items-center gap-[var(--lc-space-sm)] border-b border-[var(--lc-border)] bg-[var(--lc-surface-raised)] px-[var(--lc-space-md)]"
        style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
      >
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Back"
          onClick={() => navigate(-1)}
        >
          <ArrowLeft className="h-5 w-5" aria-hidden="true" />
        </Button>
        <h1
          className="flex-1 text-[var(--lc-text-heading)]"
          style={{ font: 'var(--lc-type-body)' }}
        >
          {RECEIPT_COPY.navTitle}
        </h1>
        <Button type="button" variant="ghost" size="icon" aria-label="More options" asChild>
          <Link
            to={
              data
                ? supportHref(data.job, data.destinations)
                : '/support'
            }
          >
            <MoreVertical className="h-5 w-5" aria-hidden="true" />
          </Link>
        </Button>
      </header>

      {loading && !data ? <PublishReceiptSkeleton /> : null}
      {!loading && error === 'not_found' ? (
        <PublishReceiptFallback kind="not_found" />
      ) : null}
      {!loading && error === 'network' && !data ? (
        <PublishReceiptFallback kind="network" onRetry={() => void refresh()} />
      ) : null}
      {data ? (
        <PublishReceiptScreen
          payload={data}
          offline={offline}
          retryingIds={retryingIds}
          retryAllLoading={retryAllLoading}
          liveAnnouncement={liveAnnouncement}
          onCopyJobId={() => void handleCopyJobId()}
          onRetryDestination={(id) => void handleRetryDestination(id)}
          onRetryAll={() => void handleRetryAll()}
          onContactSupport={handleContactSupport}
        />
      ) : null}
    </div>
  )
}

export default PublishReceiptPage
