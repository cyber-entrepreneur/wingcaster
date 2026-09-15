import { useEffect, useRef, useState } from 'react'
import { useToast } from '@/components/ui/toast'
import type { PortalStatus } from '@/components/ui/portal-status-pill'
import { connectPublishingSocket } from '@/lib/publishing/socket'
import type { PortalSubmissionPushEvent } from '@/hooks/publishing/types'
import type { PortalTrackerRow } from '@/hooks/publishing/types'

const TOAST_DEDUPE_MS = 5_000
const CROSS_FADE_MS = 180

export type UsePortalSubmissionPushOptions = {
  /** Currently rendered row ids (on-screen). Off-screen updates bump the pill. */
  visibleIds: Set<string> | string[]
  patchRow: (id: string, patch: Partial<PortalTrackerRow>) => void
  onInvalidateSummary?: () => void
  onRefresh?: () => void | Promise<void>
  /** Injected for tests — when set, the real WebSocket is not opened. */
  connect?: typeof connectPublishingSocket
}

export type UsePortalSubmissionPushResult = {
  fadingIds: Set<string>
  offscreenUpdateCount: number
  clearOffscreenUpdates: () => void
  /** Test / manual inject. */
  handleEvent: (event: PortalSubmissionPushEvent) => void
}

function asVisibleSet(visibleIds: Set<string> | string[]): Set<string> {
  return visibleIds instanceof Set ? visibleIds : new Set(visibleIds)
}

/**
 * Subscribes to `/ws/publishing` for `portal_submission.status_changed`.
 * Cross-fades matching on-screen rows; accumulates an "N new updates" pill
 * for off-screen rows; toast max 1 concurrent with 5s dedupe.
 */
export function usePortalSubmissionPush(
  options: UsePortalSubmissionPushOptions,
): UsePortalSubmissionPushResult {
  const { addToast } = useToast()
  const [fadingIds, setFadingIds] = useState<Set<string>>(() => new Set())
  const [offscreenUpdateCount, setOffscreenUpdateCount] = useState(0)
  const lastToastAt = useRef(0)
  const toastOpen = useRef(false)
  const optionsRef = useRef(options)
  optionsRef.current = options

  const handleEvent = (event: PortalSubmissionPushEvent) => {
    if (event.type !== 'portal_submission.status_changed') return
    const id = event.distribution_attempt_id
    const status = event.status as PortalStatus | undefined
    if (!id || !status) return

    const opts = optionsRef.current
    const visible = asVisibleSet(opts.visibleIds)
    opts.patchRow(id, {
      status,
      updated_at: new Date().toISOString(),
    })
    opts.onInvalidateSummary?.()

    if (visible.has(id)) {
      setFadingIds((prev) => {
        const next = new Set(prev)
        next.add(id)
        return next
      })
      window.setTimeout(() => {
        setFadingIds((prev) => {
          const next = new Set(prev)
          next.delete(id)
          return next
        })
      }, CROSS_FADE_MS)
    } else {
      setOffscreenUpdateCount((n) => n + 1)
    }

    const now = Date.now()
    if (!toastOpen.current && now - lastToastAt.current >= TOAST_DEDUPE_MS) {
      toastOpen.current = true
      lastToastAt.current = now
      addToast({
        title: 'Submission updated',
        description: event.payload?.portal_name
          ? `${event.payload.portal_name} status changed`
          : undefined,
        duration: 5000,
      })
      window.setTimeout(() => {
        toastOpen.current = false
      }, TOAST_DEDUPE_MS)
    }
  }

  useEffect(() => {
    const connect = options.connect || connectPublishingSocket
    const handle = connect({
      onEvent: handleEvent,
      onFallbackPoll: () => {
        void optionsRef.current.onRefresh?.()
      },
    })
    return () => handle.close()
    // connect once on mount; handlers read optionsRef
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return {
    fadingIds,
    offscreenUpdateCount,
    clearOffscreenUpdates: () => setOffscreenUpdateCount(0),
    handleEvent,
  }
}
