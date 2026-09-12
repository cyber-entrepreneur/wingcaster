import { useCallback, useEffect, useRef } from 'react'
import type { PortalStatus } from '@/components/ui/portal-status-pill'
import { api } from '@/api/client'

export const PORTAL_SUBMISSION_PUSH_EVENT = 'wingcaster:portal_submission.status_changed'

export type PortalSubmissionStatusChangedDetail = {
  distribution_attempt_id: string
  status: PortalStatus
  listing_address?: string
  portal_name?: string
  job_id?: string
}

export type UsePortalSubmissionPushArgs = {
  enabled?: boolean
  knownAttemptIds: Set<string> | string[]
  onRowUpdate: (detail: PortalSubmissionStatusChangedDetail) => void
  onOffscreenUpdate: (detail: PortalSubmissionStatusChangedDetail) => void
  /** Poll interval for in-app notifications (ms). 0 disables. */
  pollMs?: number
}

function statusFromAlertType(alertType: string | undefined): PortalStatus | null {
  if (!alertType) return null
  if (alertType.includes('.live')) return 'live'
  if (alertType.includes('.rejected')) return 'rejected'
  if (alertType.includes('.failed')) return 'failed'
  if (alertType.includes('.expired')) return 'expired'
  if (alertType.includes('.in_review')) return 'in_review'
  return null
}

function attemptIdFromNotification(row: Record<string, unknown>): string | null {
  const meta = (row.metadata || row.meta || {}) as Record<string, unknown>
  const token = meta.tracking_token || meta.distribution_attempt_id
  if (typeof token === 'string' && token) return token
  const deep = String(meta.deep_link_url || row.href || '')
  const match = deep.match(/receipts\/([^/?#]+)/)
  return match?.[1] || null
}

/**
 * Live updates for AGT-PUB-006 via:
 * 1. CustomEvent `wingcaster:portal_submission.status_changed` (tests / future SSE)
 * 2. Lightweight poll of GET /api/notifications for portal_submission.status_changed*
 */
export function usePortalSubmissionPush({
  enabled = true,
  knownAttemptIds,
  onRowUpdate,
  onOffscreenUpdate,
  pollMs = 15_000,
}: UsePortalSubmissionPushArgs) {
  const knownRef = useRef(knownAttemptIds)
  knownRef.current = knownAttemptIds
  const seenRef = useRef(new Set<string>())

  const handleDetail = useCallback(
    (detail: PortalSubmissionStatusChangedDetail) => {
      if (!detail.distribution_attempt_id || !detail.status) return
      const known = knownRef.current
      const has =
        known instanceof Set
          ? known.has(detail.distribution_attempt_id)
          : known.includes(detail.distribution_attempt_id)
      if (has) onRowUpdate(detail)
      else onOffscreenUpdate(detail)
    },
    [onOffscreenUpdate, onRowUpdate],
  )

  useEffect(() => {
    if (!enabled) return
    const onEvent = (e: Event) => {
      const detail = (e as CustomEvent<PortalSubmissionStatusChangedDetail>).detail
      if (detail) handleDetail(detail)
    }
    window.addEventListener(PORTAL_SUBMISSION_PUSH_EVENT, onEvent)
    return () => window.removeEventListener(PORTAL_SUBMISSION_PUSH_EVENT, onEvent)
  }, [enabled, handleDetail])

  useEffect(() => {
    if (!enabled || !pollMs) return
    let cancelled = false

    const tick = async () => {
      try {
        const res = await api.getNotifications({ limit: '20' })
        const rows = Array.isArray(res)
          ? res
          : ((res as { notifications?: unknown[] })?.notifications ?? [])
        for (const raw of rows) {
          const row = raw as Record<string, unknown>
          const alertType = String(
            (row.metadata as Record<string, unknown>)?.alert_type ||
              (row.meta as Record<string, unknown>)?.alert_type ||
              row.type ||
              '',
          )
          if (!alertType.includes('portal_submission.status_changed')) continue
          const id = attemptIdFromNotification(row)
          const status = statusFromAlertType(alertType)
          if (!id || !status) continue
          const key = `${id}:${status}:${row.id ?? ''}`
          if (seenRef.current.has(key)) continue
          seenRef.current.add(key)
          if (cancelled) return
          handleDetail({
            distribution_attempt_id: id,
            status,
            listing_address: String(row.listing_address || ''),
            portal_name: String(row.portal_name || ''),
          })
        }
      } catch {
        /* degrade silently — tracker still works offline from cache */
      }
    }

    void tick()
    const timer = window.setInterval(() => void tick(), pollMs)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [enabled, handleDetail, pollMs])
}

/** Test / SSE helper — dispatch a status_changed event into the page. */
export function emitPortalSubmissionStatusChanged(
  detail: PortalSubmissionStatusChangedDetail,
): void {
  window.dispatchEvent(
    new CustomEvent(PORTAL_SUBMISSION_PUSH_EVENT, { detail }),
  )
}
