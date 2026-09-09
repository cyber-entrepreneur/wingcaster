/**
 * PA-MOD-002 — Portal moderation detail.
 *
 * Route: `/admin/moderation/portals/:submissionId`
 * Soft-depends on PA-MOD-001 queue deep-link contract; does not edit the queue page.
 *
 * Imports PA-queue dialogs + StepUp primitives; all colors via `--lc-*`.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowLeft,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Copy,
  Download,
  Eye,
  Image as ImageIcon,
  Loader2,
  Mail,
  MessageCircle,
  Phone,
  Shield,
} from 'lucide-react'
import { api } from '@/api/client'
import {
  REJECT_REASON_OPTIONS,
  REQUEST_INFO_REASON_OPTIONS,
  formatPriceMinor,
  formatTenureMonth,
  isHighRisk,
  lintCounts,
  moderationStatusLabel,
  reasonLabel,
  requiresTwoPersonReject,
  sortLintChecks,
  substituteNotificationPreview,
  type AuditTrailEvent,
  type ModerationActionResult,
  type PortalModerationDetailResponse,
  type PortalModerationSubmission,
  type SubmissionHistoryRow,
  type TenureRiskTier,
  type ValidatorLintCheck,
} from '@/api/portalModeration'
import {
  PAQueueBulkApproveDialog,
  PAQueueBulkReasonDialog,
} from '@/components/queue'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ChannelMark } from '@/components/ui/channel-mark'
import { Numeric } from '@/components/ui/numeric'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useToast } from '@/components/ui/toast'
import { useStepUp } from '@/context/StepUpContext'
import { useEnv } from '@/hooks/useEnv'
import { usePageTitle } from '@/lib/usePageTitle'
import { cn } from '@/lib/utils'
import { resolveLcChannel } from '@/theme/channel'

const QUEUE_PATH = '/admin/moderation/portals'
const UNDO_GRACE_MS = 5000
const AUTO_NAV_MS = 2000

type DetailTab = 'payload' | 'notification' | 'audit'
type ActionModal = 'approve' | 'reject' | 'request_info' | null

function isDetailTab(v: string | null): v is DetailTab {
  return v === 'payload' || v === 'notification' || v === 'audit'
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('')
}

function PortalMonogram({ code, displayName }: { code: string; displayName: string }) {
  const channel = resolveLcChannel(code) ?? resolveLcChannel(code.replace(/_.*/, ''))
  if (channel) {
    return <ChannelMark channel={channel} label={displayName} />
  }
  const letter = (displayName || code || '?').trim().charAt(0).toUpperCase()
  return (
    <span
      className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-sm bg-[var(--lc-surface-sunken)] text-[10px] font-semibold uppercase text-[var(--lc-text-primary)]"
      aria-label={displayName || code}
      title={displayName || code}
    >
      {letter}
    </span>
  )
}

function StatusPill({ status }: { status: string }) {
  const label = moderationStatusLabel(status)
  const glyph =
    status === 'approved'
      ? '●'
      : status === 'rejected'
        ? '◆'
        : status === 'request_info' || status === 'pending_second_approval'
          ? '▲'
          : status === 'portal_error'
            ? '✕'
            : status === 'expired'
              ? '▢'
              : '○'
  const tone =
    status === 'approved'
      ? 'bg-[var(--lc-status-published-bg)] text-[var(--lc-status-published-fg)]'
      : status === 'rejected'
        ? 'bg-[var(--lc-status-closed-bg)] text-[var(--lc-status-closed-fg)]'
        : status === 'request_info' || status === 'pending_second_approval'
          ? 'bg-[var(--lc-status-warning-bg)] text-[var(--lc-status-warning-fg)]'
          : status === 'portal_error'
            ? 'bg-[var(--lc-status-danger-bg)] text-[var(--lc-status-danger-fg)]'
            : status === 'expired'
              ? 'bg-[var(--lc-status-archived-bg)] text-[var(--lc-status-archived-fg)]'
              : 'bg-[var(--lc-status-draft-bg)] text-[var(--lc-status-draft-fg)]'
  return (
    <Badge className={cn('rounded-[var(--lc-radius-pill)] border-transparent', tone)}>
      <span aria-hidden="true" className="me-1">
        {glyph}
      </span>
      {label}
    </Badge>
  )
}

function RiskBadge({ tier }: { tier: TenureRiskTier }) {
  const label =
    tier === 'high'
      ? 'High tenure risk'
      : tier === 'medium'
        ? 'Medium tenure risk'
        : tier === 'low'
          ? 'Low tenure risk'
          : 'Risk unknown'
  const glyph = tier === 'high' ? '◆' : tier === 'medium' ? '▲' : tier === 'low' ? '●' : '○'
  const tone =
    tier === 'high'
      ? 'bg-[var(--lc-status-danger-bg)] text-[var(--lc-status-danger-fg)]'
      : tier === 'medium'
        ? 'bg-[var(--lc-status-warning-bg)] text-[var(--lc-status-warning-fg)]'
        : tier === 'low'
          ? 'bg-[var(--lc-status-published-bg)] text-[var(--lc-status-published-fg)]'
          : 'bg-[var(--lc-surface-sunken)] text-[var(--lc-text-muted)]'
  return (
    <Badge className={cn('rounded-[var(--lc-radius-pill)] border-transparent', tone)}>
      <span aria-hidden="true" className="me-1">
        {glyph}
      </span>
      {label}
    </Badge>
  )
}

function SeverityGlyph({ severity }: { severity: ValidatorLintCheck['severity'] }) {
  if (severity === 'fail') return <span aria-hidden="true">✕</span>
  if (severity === 'warn') return <span aria-hidden="true">⚠</span>
  return <span aria-hidden="true">●</span>
}

function amenityLabel(raw: string): string {
  return raw
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

function useIsDesktopPaConsole(): boolean {
  const [isDesktop, setIsDesktop] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia
      ? window.matchMedia('(min-width: 1024px)').matches
      : true,
  )
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const mq = window.matchMedia('(min-width: 1024px)')
    const onChange = () => setIsDesktop(mq.matches)
    onChange()
    mq.addEventListener?.('change', onChange)
    return () => mq.removeEventListener?.('change', onChange)
  }, [])
  return isDesktop
}

export function PortalModerationDetailPage() {
  const { submissionId = '' } = useParams<{ submissionId: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const { addToast } = useToast()
  const { runElevated } = useStepUp()
  const { env, isTest } = useEnv()
  const isDesktop = useIsDesktopPaConsole()

  const returnTo = searchParams.get('return_to') || QUEUE_PATH
  const tabParam = searchParams.get('tab')
  const activeTab: DetailTab = isDetailTab(tabParam) ? tabParam : 'payload'

  const [submission, setSubmission] = useState<PortalModerationSubmission | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [forbidden, setForbidden] = useState(false)
  const [actionModal, setActionModal] = useState<ActionModal>(null)
  const [actionBusy, setActionBusy] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [rejectNotes, setRejectNotes] = useState('')
  const [requestReason, setRequestReason] = useState('')
  const [requestNotes, setRequestNotes] = useState('')
  const [showPassing, setShowPassing] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [historyRows, setHistoryRows] = useState<SubmissionHistoryRow[] | null>(null)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [auditEvents, setAuditEvents] = useState<AuditTrailEvent[] | null>(null)
  const [auditLoading, setAuditLoading] = useState(false)
  const [heroIndex, setHeroIndex] = useState(0)
  const [revealedPhone, setRevealedPhone] = useState<string | null>(null)
  const [revealedEmail, setRevealedEmail] = useState<string | null>(null)
  const [revealBusy, setRevealBusy] = useState<'phone' | 'email' | null>(null)
  const [siblingBusy, setSiblingBusy] = useState(false)
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const autoNavTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingUndoRef = useRef<{ kind: 'approve' | 'reject'; id: string } | null>(null)

  usePageTitle(submission?.listing.title || 'Portal moderation')

  const clearTimers = useCallback(() => {
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current)
    if (autoNavTimerRef.current) clearTimeout(autoNavTimerRef.current)
    undoTimerRef.current = null
    autoNavTimerRef.current = null
    pendingUndoRef.current = null
  }, [])

  useEffect(() => () => clearTimers(), [clearTimers])

  const load = useCallback(async () => {
    if (!submissionId) return
    setLoading(true)
    setLoadError(null)
    setNotFound(false)
    setForbidden(false)
    setRevealedPhone(null)
    setRevealedEmail(null)
    setHeroIndex(0)
    setHistoryRows(null)
    setAuditEvents(null)
    try {
      const body = (await api.getPortalModerationSubmission(
        submissionId,
      )) as PortalModerationDetailResponse
      const row = body?.submission
      if (!row?.id) {
        setNotFound(true)
        setSubmission(null)
        return
      }
      setSubmission(row)
      if (row.is_already_decided) {
        setSearchParams(
          (prev) => {
            if (isDetailTab(prev.get('tab'))) return prev
            const next = new URLSearchParams(prev)
            next.set('tab', 'audit')
            return next
          },
          { replace: true },
        )
      }
    } catch (err) {
      const status = (err as { status?: number })?.status
      if (status === 404) {
        setNotFound(true)
      } else if (status === 403) {
        setForbidden(true)
      } else if (status === 401) {
        navigate(`/login?return_to=${encodeURIComponent(window.location.pathname + window.location.search)}`)
        return
      } else {
        setLoadError("Couldn't load this submission.")
      }
      setSubmission(null)
    } finally {
      setLoading(false)
    }
  }, [submissionId, navigate, setSearchParams])

  useEffect(() => {
    void load()
  }, [load, env])

  const portalName = submission?.portal.display_name ?? 'portal'
  const listingTitle = submission?.listing.title ?? 'Submission'
  const twoPersonReject = submission ? requiresTwoPersonReject(submission) : false
  const highRisk = submission ? isHighRisk(submission.tenure_risk.tier) : false
  const stepUpNeeded = Boolean(submission?.step_up_required || highRisk)
  const decidable =
    Boolean(submission) &&
    !submission?.is_own &&
    !submission?.is_already_decided &&
    (submission?.status === 'pending' || submission?.status === 'pending_moderation')

  const checks = useMemo(
    () => sortLintChecks(submission?.validator_lint.checks ?? []),
    [submission],
  )
  const counts = useMemo(() => {
    if (!submission) return { pass: 0, warn: 0, fail: 0 }
    const fromServer = submission.validator_lint
    if (
      typeof fromServer.pass_count === 'number' &&
      typeof fromServer.warn_count === 'number' &&
      typeof fromServer.fail_count === 'number'
    ) {
      return {
        pass: fromServer.pass_count,
        warn: fromServer.warn_count,
        fail: fromServer.fail_count,
      }
    }
    return lintCounts(checks)
  }, [submission, checks])

  const failingOrWarn = checks.filter((c) => c.severity !== 'pass')
  const passing = checks.filter((c) => c.severity === 'pass')

  const gallery = useMemo(() => {
    if (!submission) return [] as string[]
    const preview = submission.listing_preview
    const imgs = [
      preview.hero_image_url || submission.listing.hero_image_url,
      ...(preview.gallery ?? []),
    ].filter((u): u is string => Boolean(u))
    return [...new Set(imgs)]
  }, [submission])

  const amenities = submission?.listing_preview.amenities ?? []
  const shownAmenities = amenities.slice(0, 12)
  const moreAmenities = Math.max(0, amenities.length - 12)

  const setTab = (tab: DetailTab) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        next.set('tab', tab)
        return next
      },
      { replace: true },
    )
  }

  const cycleTab = useCallback(() => {
    const order: DetailTab[] = ['payload', 'notification', 'audit']
    const idx = order.indexOf(activeTab)
    setTab(order[(idx + 1) % order.length])
  }, [activeTab, setSearchParams])

  const navigateSibling = useCallback(
    async (direction: 'next' | 'prev') => {
      if (!submissionId || siblingBusy) return
      setSiblingBusy(true)
      try {
        const filterKeys = ['status', 'portal', 'country', 'risk', 'within', 'q']
        const query: Record<string, string | undefined> = {}
        for (const key of filterKeys) {
          const fromReturn = (() => {
            try {
              const u = new URL(returnTo, window.location.origin)
              return u.searchParams.get(key) ?? undefined
            } catch {
              return undefined
            }
          })()
          query[key] = searchParams.get(key) ?? fromReturn
        }
        const res = (await api.getPortalModerationSibling(submissionId, direction, query)) as {
          next_submission_id?: string | null
        }
        const nextId = res?.next_submission_id
        if (!nextId) {
          addToast({
            variant: 'default',
            title: direction === 'next' ? 'No next pending submission' : 'No previous pending submission',
          })
          return
        }
        const params = new URLSearchParams()
        params.set('return_to', returnTo)
        if (isDetailTab(searchParams.get('tab'))) params.set('tab', searchParams.get('tab')!)
        navigate(`${QUEUE_PATH}/${nextId}?${params.toString()}`)
      } catch {
        addToast({ variant: 'error', title: "Couldn't load sibling submission." })
      } finally {
        setSiblingBusy(false)
      }
    },
    [submissionId, siblingBusy, returnTo, searchParams, navigate, addToast],
  )

  const schedulePostDecisionNav = useCallback(
    (opts: { allowUndo: boolean; kind: 'approve' | 'reject'; toastTitle: string }) => {
      clearTimers()
      const id = submissionId
      if (opts.allowUndo) {
        pendingUndoRef.current = { kind: opts.kind, id }
        addToast({
          variant: 'success',
          title: opts.toastTitle,
          description: 'Undo',
          duration: UNDO_GRACE_MS,
        })
        undoTimerRef.current = setTimeout(() => {
          pendingUndoRef.current = null
        }, UNDO_GRACE_MS)
      } else {
        addToast({ variant: 'success', title: opts.toastTitle, duration: UNDO_GRACE_MS })
      }

      addToast({
        variant: 'default',
        title: 'Loading next pending submission…',
        duration: AUTO_NAV_MS,
      })
      autoNavTimerRef.current = setTimeout(() => {
        void navigateSibling('next')
      }, AUTO_NAV_MS)
    },
    [addToast, clearTimers, navigateSibling, submissionId],
  )

  const runWithOptionalStepUp = useCallback(
    async <T,>(label: string, needsStepUp: boolean, action: () => Promise<T>): Promise<T | null> => {
      if (needsStepUp) {
        return runElevated(action, label)
      }
      return action()
    },
    [runElevated],
  )

  const confirmApprove = async () => {
    if (!submission || actionBusy) return
    setActionBusy(true)
    try {
      const result = await runWithOptionalStepUp(`approve ${portalName}`, stepUpNeeded, () =>
        api.approvePortalModerationSubmission(submission.id),
      )
      if (result == null) return
      setActionModal(null)
      schedulePostDecisionNav({
        allowUndo: true,
        kind: 'approve',
        toastTitle: `Approved ${listingTitle} for ${portalName}.`,
      })
    } catch (err) {
      const status = (err as { status?: number })?.status
      if (status === 503) {
        addToast({
          variant: 'warning',
          title: 'The portal API is currently unavailable. Your decision will be queued and pushed when the portal reconnects.',
        })
        setActionModal(null)
      } else {
        addToast({ variant: 'error', title: 'Something went wrong. Try again.' })
      }
    } finally {
      setActionBusy(false)
    }
  }

  const confirmReject = async (payload: { reasonCode: string; notes: string }) => {
    if (!submission || actionBusy) return
    setActionBusy(true)
    try {
      const result = (await runWithOptionalStepUp(`reject ${portalName}`, stepUpNeeded, () =>
        api.rejectPortalModerationSubmission(submission.id, {
          reason_code: payload.reasonCode,
          notes: payload.notes,
        }),
      )) as ModerationActionResult | null
      if (result == null) return
      setActionModal(null)
      const proposed = result.state === 'REJECT_PROPOSED' || twoPersonReject
      schedulePostDecisionNav({
        allowUndo: !proposed,
        kind: 'reject',
        toastTitle: proposed
          ? `Reject sent to a second approver for ${listingTitle}.`
          : `Rejected ${listingTitle}.`,
      })
    } catch {
      addToast({ variant: 'error', title: 'Something went wrong. Try again.' })
    } finally {
      setActionBusy(false)
    }
  }

  const confirmRequestInfo = async (payload: { reasonCode: string; notes: string }) => {
    if (!submission || actionBusy) return
    setActionBusy(true)
    try {
      const result = await runWithOptionalStepUp(`request info ${portalName}`, false, () =>
        api.requestInfoPortalModerationSubmission(submission.id, {
          reason_code: payload.reasonCode,
          notes: payload.notes,
        }),
      )
      if (result == null) return
      setActionModal(null)
      schedulePostDecisionNav({
        allowUndo: true,
        kind: 'reject',
        toastTitle: `Requested info on ${listingTitle}.`,
      })
    } catch {
      addToast({ variant: 'error', title: 'Something went wrong. Try again.' })
    } finally {
      setActionBusy(false)
    }
  }

  const openApprove = () => {
    if (!decidable) return
    setActionModal('approve')
  }
  const openReject = () => {
    if (!decidable) return
    setRejectReason('')
    setRejectNotes('')
    setActionModal('reject')
  }
  const openRequestInfo = () => {
    if (!decidable) return
    setRequestReason('')
    setRequestNotes('')
    setActionModal('request_info')
  }

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (actionModal) return
      const target = event.target as HTMLElement | null
      const tag = target?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target?.isContentEditable) return
      const key = event.key.toLowerCase()
      if (key === 'j') {
        event.preventDefault()
        void navigateSibling('next')
      } else if (key === 'k') {
        event.preventDefault()
        void navigateSibling('prev')
      } else if (key === 'a') {
        event.preventDefault()
        openApprove()
      } else if (key === 'r') {
        event.preventDefault()
        openReject()
      } else if (key === 'i') {
        event.preventDefault()
        openRequestInfo()
      } else if (key === 'escape') {
        event.preventDefault()
        navigate(returnTo)
      } else if (key === 't') {
        event.preventDefault()
        cycleTab()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- open* close over decidable
  }, [actionModal, navigateSibling, navigate, returnTo, cycleTab, decidable])

  useEffect(() => {
    if (!historyOpen || !submissionId || historyRows) return
    setHistoryLoading(true)
    void api
      .getPortalModerationHistory(submissionId)
      .then((body) => {
        const rows = Array.isArray(body)
          ? (body as SubmissionHistoryRow[])
          : ((body as { history?: SubmissionHistoryRow[] })?.history ?? [])
        setHistoryRows(rows)
      })
      .catch(() => setHistoryRows([]))
      .finally(() => setHistoryLoading(false))
  }, [historyOpen, submissionId, historyRows])

  useEffect(() => {
    if (activeTab !== 'audit' || !submissionId || auditEvents) return
    setAuditLoading(true)
    void api
      .getPortalModerationAudit(submissionId)
      .then((body) => {
        const rows = Array.isArray(body)
          ? (body as AuditTrailEvent[])
          : ((body as { events?: AuditTrailEvent[] })?.events ?? [])
        setAuditEvents(rows)
      })
      .catch(() => setAuditEvents([]))
      .finally(() => setAuditLoading(false))
  }, [activeTab, submissionId, auditEvents])

  const revealContact = async (field: 'phone' | 'email') => {
    if (!submissionId || revealBusy) return
    setRevealBusy(field)
    try {
      const res = (await api.revealPortalModerationContact(submissionId, field)) as {
        phone_full?: string
        email_full?: string
      }
      if (field === 'phone' && res.phone_full) setRevealedPhone(res.phone_full)
      if (field === 'email' && res.email_full) setRevealedEmail(res.email_full)
      addToast({
        variant: 'default',
        title: field === 'phone' ? 'Phone number revealed' : 'Email revealed',
        duration: 2000,
      })
    } catch {
      addToast({ variant: 'error', title: "Couldn't reveal contact." })
    } finally {
      setRevealBusy(null)
    }
  }

  const copyPayload = async () => {
    if (!submission) return
    const text = JSON.stringify(submission.portal_payload_preview ?? {}, null, 2)
    try {
      await navigator.clipboard.writeText(text)
      addToast({ variant: 'success', title: 'Payload copied to clipboard.', duration: 2000 })
    } catch {
      addToast({ variant: 'error', title: "Couldn't copy payload." })
    }
  }

  const queuePos = submission?.queue_position
  const payloadJson = useMemo(
    () => JSON.stringify(submission?.portal_payload_preview ?? {}, null, 2),
    [submission],
  )

  const rejectPreview = substituteNotificationPreview(
    submission?.notification_previews.reject ?? '',
    {
      reason_code_label: reasonLabel([...REJECT_REASON_OPTIONS], rejectReason),
      notes: rejectNotes,
    },
  )
  const requestPreview = substituteNotificationPreview(
    submission?.notification_previews.request_info ?? '',
    {
      reason_code_label: reasonLabel([...REQUEST_INFO_REASON_OPTIONS], requestReason),
      notes: requestNotes,
    },
  )

  /* ——— below-min viewport ——— */
  if (!isDesktop) {
    return (
      <div
        className="flex min-h-[50vh] flex-col items-center justify-center gap-3 px-6 text-center"
        role="status"
      >
        <p style={{ font: 'var(--lc-type-heading-3)', color: 'var(--lc-text-heading)' }}>
          PA console requires a desktop screen
        </p>
        <p className="text-[var(--lc-text-muted)]" style={{ font: 'var(--lc-type-body)' }}>
          Use a viewport of 1024px or wider to review portal submissions.
        </p>
        <Button asChild variant="outline">
          <Link to={returnTo}>Back to portal moderation</Link>
        </Button>
      </div>
    )
  }

  if (forbidden) {
    return (
      <div className="mx-auto max-w-[1440px] px-[var(--lc-space-2xl)] py-[var(--lc-space-2xl)]" role="alert">
        <h1 style={{ font: 'var(--lc-type-heading-1)', color: 'var(--lc-text-heading)' }}>
          You need portal-moderation access to view this page.
        </h1>
        <Button asChild className="mt-4" variant="outline">
          <Link to="/admin/fin/overview">Back to PA home</Link>
        </Button>
      </div>
    )
  }

  if (notFound) {
    return (
      <div className="mx-auto max-w-[1440px] px-[var(--lc-space-2xl)] py-[var(--lc-space-2xl)]" role="alert">
        <h1 style={{ font: 'var(--lc-type-heading-1)', color: 'var(--lc-text-heading)' }}>
          Submission not found or archived.
        </h1>
        <Button asChild className="mt-4" variant="outline">
          <Link to={QUEUE_PATH}>Back to queue</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="bg-[var(--lc-bg-page)] text-[var(--lc-text-primary)]">
      <div>
        <a
          href="#pa-mod-detail-main"
          className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:m-2 focus:rounded-[var(--lc-radius-md)] focus:bg-[var(--lc-surface-raised)] focus:px-3 focus:py-2"
        >
          Skip to content
        </a>

        {/* Sticky sub-header */}
        <header
          aria-label="Submission navigation"
          className="sticky top-0 z-20 border-b border-[var(--lc-border)] bg-[var(--lc-surface-raised)]"
          style={{
            top: 'calc(var(--lc-nav-height, 3.5rem) + var(--lc-nav-warning-strip-height, 0px))',
          }}
        >
          <div className="mx-auto flex max-w-[1440px] items-center gap-3 px-[var(--lc-space-2xl)] py-3">
            <Button asChild variant="ghost" size="icon" aria-label="Back to portal moderation queue">
              <Link to={returnTo}>
                <ArrowLeft className="h-5 w-5 rtl:rotate-180" aria-hidden="true" />
              </Link>
            </Button>
            <nav aria-label="Breadcrumb" className="min-w-0 flex-1 truncate" style={{ font: 'var(--lc-type-body)' }}>
              <Link to={returnTo} className="text-[var(--lc-text-brand)] hover:underline">
                Portal moderation
              </Link>
              <span className="mx-1 text-[var(--lc-text-muted)]" aria-hidden="true">
                /
              </span>
              <span className="font-medium text-[var(--lc-text-primary)]">{listingTitle}</span>
            </nav>
            {queuePos ? (
              <Badge
                role="status"
                className="shrink-0 rounded-[var(--lc-radius-pill)] border border-[var(--lc-accent-bold-edge)] bg-[var(--lc-accent)] text-[var(--lc-accent-text,var(--lc-text-inverse))]"
              >
                Submission <Numeric className="mx-0.5">{queuePos.position}</Numeric> of{' '}
                <Numeric className="mx-0.5">{queuePos.total}</Numeric> pending
              </Badge>
            ) : null}
            <div className="flex shrink-0 items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Previous pending submission"
                disabled={siblingBusy}
                onClick={() => void navigateSibling('prev')}
              >
                <ChevronLeft className="h-5 w-5 rtl:rotate-180" aria-hidden="true" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Next pending submission"
                disabled={siblingBusy}
                onClick={() => void navigateSibling('next')}
              >
                <ChevronRight className="h-5 w-5 rtl:rotate-180" aria-hidden="true" />
              </Button>
            </div>
          </div>
        </header>

        <div
          id="pa-mod-detail-main"
          className="mx-auto max-w-[1440px] px-[var(--lc-space-2xl)] py-[var(--lc-space-xl)]"
        >
          {loading ? (
            <div className="grid gap-6 lg:grid-cols-[3fr_2fr]" aria-busy="true" role="status">
              <div className="space-y-4">
                <div className="h-8 w-2/3 animate-pulse rounded-[var(--lc-radius-md)] bg-[var(--lc-surface-sunken)]" />
                <div className="aspect-video animate-pulse rounded-[var(--lc-radius-lg)] bg-[var(--lc-surface-sunken)]" />
                <div className="h-40 animate-pulse rounded-[var(--lc-radius-lg)] bg-[var(--lc-surface-sunken)]" />
              </div>
              <div className="space-y-4">
                <div className="h-48 animate-pulse rounded-[var(--lc-radius-lg)] bg-[var(--lc-surface-sunken)]" />
                <div className="h-56 animate-pulse rounded-[var(--lc-radius-lg)] bg-[var(--lc-surface-sunken)]" />
              </div>
              <span className="sr-only">Loading submission…</span>
            </div>
          ) : null}

          {loadError ? (
            <div
              role="alert"
              className="flex flex-col items-start gap-3 rounded-[var(--lc-radius-lg)] border border-[var(--lc-border)] bg-[var(--lc-status-danger-bg)] p-[var(--lc-space-xl)] text-[var(--lc-status-danger-fg)]"
            >
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" aria-hidden="true" />
                <p>{loadError}</p>
              </div>
              <Button type="button" variant="outline" onClick={() => void load()}>
                Retry
              </Button>
            </div>
          ) : null}

          {submission && !loading ? (
            <>
              {/* Heading strip */}
              <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h1 style={{ font: 'var(--lc-type-heading-1)', color: 'var(--lc-text-heading)' }}>
                    {submission.listing.title}
                  </h1>
                  <p
                    className="mt-1 text-[var(--lc-text-muted)]"
                    style={{ font: 'var(--lc-type-body-sm)' }}
                  >
                    {submission.listing.address_line}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <PortalMonogram
                    code={submission.portal.code}
                    displayName={submission.portal.display_name}
                  />
                  <span className="text-[var(--lc-type-caption)] text-[var(--lc-text-muted)]">
                    <span aria-hidden="true">{submission.portal.country_flag_emoji ?? ''}</span>{' '}
                    {submission.portal.country_code}
                  </span>
                  <StatusPill status={submission.status} />
                </div>
              </div>

              {submission.is_already_decided && submission.decision ? (
                <div
                  role="status"
                  className="mb-4 rounded-[var(--lc-radius-md)] border border-[var(--lc-border)] bg-[var(--lc-surface-sunken)] px-4 py-3"
                  style={{ font: 'var(--lc-type-body-sm)' }}
                >
                  This submission was already decided by {submission.decision.actor_name || 'another PA'}
                  {submission.decision.decided_at
                    ? ` on ${new Date(submission.decision.decided_at).toLocaleString()}`
                    : ''}
                  .
                </div>
              ) : null}

              <div className="grid items-start gap-6 lg:grid-cols-[3fr_2fr]">
                {/* Left column */}
                <div className="min-w-0 space-y-6">
                  <section
                    aria-labelledby="portal-preview-heading"
                    className="rounded-[var(--lc-radius-lg)] bg-[var(--lc-surface-raised)] p-[var(--lc-space-xl)] shadow-[var(--lc-elevation-sm)]"
                  >
                    <p
                      id="portal-preview-heading"
                      className="mb-3 text-[var(--lc-text-muted)]"
                      style={{ font: 'var(--lc-type-overline)' }}
                    >
                      PORTAL PREVIEW — {portalName}
                    </p>

                    <div className="overflow-hidden rounded-[var(--lc-radius-lg)] bg-[var(--lc-surface-sunken)]">
                      {gallery[heroIndex] ? (
                        <img
                          src={gallery[heroIndex]}
                          alt=""
                          className="aspect-video w-full object-cover"
                        />
                      ) : (
                        <div className="flex aspect-video items-center justify-center border border-dashed border-[var(--lc-border-strong)]">
                          <ImageIcon className="h-10 w-10 text-[var(--lc-text-muted)]" aria-hidden="true" />
                        </div>
                      )}
                    </div>

                    {gallery.length > 1 ? (
                      <ul className="mt-3 flex flex-wrap gap-2" aria-label="Gallery">
                        {gallery.slice(0, 8).map((url, idx) => (
                          <li key={url}>
                            <button
                              type="button"
                              onClick={() => setHeroIndex(idx)}
                              className={cn(
                                'h-16 w-16 overflow-hidden rounded-[var(--lc-radius-md)] border-2',
                                idx === heroIndex
                                  ? 'border-[var(--lc-action-primary)]'
                                  : 'border-transparent',
                              )}
                              aria-label={`Photo ${idx + 1}`}
                              aria-pressed={idx === heroIndex}
                            >
                              <img src={url} alt="" className="h-full w-full object-cover" />
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-2 text-[var(--lc-text-muted)]" style={{ font: 'var(--lc-type-caption)' }}>
                        No additional photos submitted.
                      </p>
                    )}

                    <div className="mt-4 flex flex-wrap items-baseline gap-2">
                      <Numeric style={{ font: 'var(--lc-type-heading-2)' }}>
                        {formatPriceMinor(
                          submission.listing_preview.price.amount_minor,
                          submission.listing_preview.price.currency,
                        )}
                      </Numeric>
                      <span className="text-[var(--lc-text-muted)]" style={{ font: 'var(--lc-type-body-sm)' }}>
                        · {submission.listing_preview.price.basis}
                      </span>
                    </div>

                    <p className="mt-2" style={{ font: 'var(--lc-type-body)' }}>
                      <Numeric>{submission.listing_preview.specs.beds}</Numeric> beds ·{' '}
                      <Numeric>{submission.listing_preview.specs.baths}</Numeric> baths ·{' '}
                      <Numeric>{submission.listing_preview.specs.area_m2}</Numeric> m²
                    </p>

                    {shownAmenities.length ? (
                      <ul className="mt-3 flex flex-wrap gap-2" aria-label="Amenities">
                        {shownAmenities.map((a) => (
                          <li key={a}>
                            <Badge variant="outline" className="rounded-[var(--lc-radius-pill)]">
                              {amenityLabel(a)}
                            </Badge>
                          </li>
                        ))}
                        {moreAmenities > 0 ? (
                          <li>
                            <Badge variant="outline" className="rounded-[var(--lc-radius-pill)]">
                              +<Numeric>{moreAmenities}</Numeric> more
                            </Badge>
                          </li>
                        ) : null}
                      </ul>
                    ) : null}

                    <p
                      className="mt-4 whitespace-pre-wrap"
                      style={{ font: 'var(--lc-type-body-lg)' }}
                    >
                      {submission.listing_preview.description}
                    </p>

                    <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-[var(--lc-border)] pt-4">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        aria-live="polite"
                        onClick={() => void revealContact('phone')}
                        disabled={revealBusy === 'phone'}
                      >
                        {revealBusy === 'phone' ? (
                          <Loader2 className="me-1 h-4 w-4 animate-spin" aria-hidden="true" />
                        ) : (
                          <Phone className="me-1 h-4 w-4" aria-hidden="true" />
                        )}
                        {revealedPhone ?? submission.listing_preview.agent_contact.phone_masked}
                        {!revealedPhone ? <Eye className="ms-1 h-3.5 w-3.5" aria-hidden="true" /> : null}
                      </Button>
                      {submission.listing_preview.agent_contact.whatsapp_deeplink ? (
                        <Button asChild variant="ghost" size="sm">
                          <a
                            href={submission.listing_preview.agent_contact.whatsapp_deeplink}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <MessageCircle className="me-1 h-4 w-4" aria-hidden="true" />
                            WhatsApp
                          </a>
                        </Button>
                      ) : null}
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        aria-live="polite"
                        onClick={() => void revealContact('email')}
                        disabled={revealBusy === 'email'}
                      >
                        {revealBusy === 'email' ? (
                          <Loader2 className="me-1 h-4 w-4 animate-spin" aria-hidden="true" />
                        ) : (
                          <Mail className="me-1 h-4 w-4" aria-hidden="true" />
                        )}
                        {revealedEmail ?? submission.listing_preview.agent_contact.email_masked}
                        {!revealedEmail ? <Eye className="ms-1 h-3.5 w-3.5" aria-hidden="true" /> : null}
                      </Button>
                    </div>

                    <p
                      className="mt-3 text-[var(--lc-text-muted)]"
                      style={{ font: 'var(--lc-type-caption)' }}
                    >
                      Wingcaster preview of portal render — visit portal directly for final layout.
                    </p>
                  </section>

                  {/* Agent + agency */}
                  <section
                    aria-label="Agent and agency context"
                    className="rounded-[var(--lc-radius-lg)] bg-[var(--lc-surface-raised)] p-[var(--lc-space-xl)] shadow-[var(--lc-elevation-sm)]"
                  >
                    <div className="flex items-start gap-3">
                      <Avatar className="h-12 w-12">
                        {submission.agent.avatar_url ? (
                          <AvatarImage src={submission.agent.avatar_url} alt="" />
                        ) : null}
                        <AvatarFallback>{initials(submission.agent.display_name)}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <h2 style={{ font: 'var(--lc-type-heading-3)', color: 'var(--lc-text-heading)' }}>
                          {submission.agent.display_name}
                        </h2>
                        <a
                          href={submission.agency.tenant_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[var(--lc-text-brand)] hover:underline"
                          style={{ font: 'var(--lc-type-body-sm)' }}
                        >
                          {submission.agency.name}
                        </a>
                        <p
                          className="mt-2 text-[var(--lc-text-muted)]"
                          style={{ font: 'var(--lc-type-body-sm)' }}
                        >
                          Agent since{' '}
                          <Numeric>
                            {formatTenureMonth(submission.agent_context.wingcaster_tenure_month)}
                          </Numeric>
                          {' · '}
                          <Numeric>{submission.agent_context.portfolio_size}</Numeric> listings ·{' '}
                          <Numeric>
                            {submission.agent_context.prior_decision_summary_30d.approved}
                          </Numeric>{' '}
                          approved ·{' '}
                          <Numeric>
                            {submission.agent_context.prior_decision_summary_30d.rejected}
                          </Numeric>{' '}
                          rejected across all portals in the last 30 days
                        </p>
                      </div>
                    </div>
                  </section>

                  {/* History accordion */}
                  <div className="rounded-[var(--lc-radius-lg)] border border-[var(--lc-border)] bg-[var(--lc-surface-raised)]">
                    <button
                      type="button"
                      className="flex w-full items-center justify-between gap-2 px-4 py-3 text-start"
                      aria-expanded={historyOpen}
                      onClick={() => setHistoryOpen((v) => !v)}
                      style={{ font: 'var(--lc-type-body)' }}
                    >
                      <span>
                        Prior submissions of this listing (
                        <Numeric>{historyRows?.length ?? '…'}</Numeric>)
                      </span>
                      {historyOpen ? (
                        <ChevronUp className="h-4 w-4" aria-hidden="true" />
                      ) : (
                        <ChevronDown className="h-4 w-4" aria-hidden="true" />
                      )}
                    </button>
                    {historyOpen ? (
                      <div className="border-t border-[var(--lc-border)] px-4 py-3">
                        {historyLoading ? (
                          <p role="status" className="text-[var(--lc-text-muted)]">
                            Loading history…
                          </p>
                        ) : !historyRows?.length ? (
                          <p className="text-[var(--lc-text-muted)]" style={{ font: 'var(--lc-type-body-sm)' }}>
                            This listing has no prior portal submissions.
                          </p>
                        ) : (
                          <ul className="space-y-2">
                            {historyRows.map((row, i) => (
                              <li
                                key={`${row.portal_code}-${row.submitted_at}-${i}`}
                                className="rounded-[var(--lc-radius-md)] bg-[var(--lc-surface-sunken)] px-3 py-2"
                                style={{ font: 'var(--lc-type-body-sm)' }}
                              >
                                <span className="font-medium">
                                  {row.portal_display_name || row.portal_code}
                                </span>
                                {' · '}
                                {moderationStatusLabel(row.status)}
                                {' · '}
                                {new Date(row.submitted_at).toLocaleString()}
                                {row.decided_by ? ` · ${row.decided_by}` : ''}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    ) : null}
                  </div>
                </div>

                {/* Right column */}
                <div className="min-w-0 space-y-6">
                  <section
                    aria-labelledby="validator-lint-heading"
                    className="rounded-[var(--lc-radius-lg)] bg-[var(--lc-surface-raised)] p-[var(--lc-space-xl)] shadow-[var(--lc-elevation-sm)]"
                  >
                    <p
                      id="validator-lint-heading"
                      className="mb-2 text-[var(--lc-text-muted)]"
                      style={{ font: 'var(--lc-type-overline)' }}
                    >
                      Per-portal validator · {portalName}
                    </p>
                    <p className="mb-3" style={{ font: 'var(--lc-type-body-sm)' }}>
                      <Numeric>{counts.pass}</Numeric> pass · <Numeric>{counts.warn}</Numeric> warn ·{' '}
                      <Numeric>{counts.fail}</Numeric> fail
                    </p>
                    <ul className="space-y-2">
                      {failingOrWarn.map((check) => (
                        <li
                          key={check.code}
                          className={cn(
                            'rounded-[var(--lc-radius-md)] border border-[var(--lc-border)] px-3 py-2',
                            check.severity === 'fail' && 'bg-[var(--lc-status-danger-bg)]',
                            check.severity === 'warn' && 'bg-[var(--lc-status-warning-bg)]',
                          )}
                        >
                          <div className="flex items-start gap-2" style={{ font: 'var(--lc-type-body-sm)' }}>
                            <SeverityGlyph severity={check.severity} />
                            <div>
                              <p className="font-medium">
                                <code className="font-[var(--lc-font-mono)]">{check.code}</code>
                                {' — '}
                                {check.message}
                              </p>
                              {check.expected != null || check.actual != null ? (
                                <p className="mt-1 text-[var(--lc-text-muted)]">
                                  Expected: {check.expected ?? '—'} · Actual: {check.actual ?? '—'}
                                </p>
                              ) : null}
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                    {passing.length ? (
                      <div className="mt-3">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setShowPassing((v) => !v)}
                          aria-expanded={showPassing}
                        >
                          {showPassing
                            ? 'Hide passing checks'
                            : (
                              <>
                                Show <Numeric className="mx-1">{passing.length}</Numeric> passing checks
                              </>
                            )}
                        </Button>
                        {showPassing ? (
                          <ul className="mt-2 space-y-2">
                            {passing.map((check) => (
                              <li
                                key={check.code}
                                className="rounded-[var(--lc-radius-md)] bg-[var(--lc-surface-sunken)] px-3 py-2"
                                style={{ font: 'var(--lc-type-body-sm)' }}
                              >
                                <SeverityGlyph severity="pass" />{' '}
                                <code className="font-[var(--lc-font-mono)]">{check.code}</code>
                                {' — '}
                                {check.message}
                              </li>
                            ))}
                          </ul>
                        ) : null}
                      </div>
                    ) : null}
                  </section>

                  {/* Decision panel */}
                  <section
                    aria-labelledby="decision-heading"
                    className={cn(
                      'rounded-[var(--lc-radius-lg)] border border-[var(--lc-border)] bg-[var(--lc-surface-raised)] p-[var(--lc-space-xl)] shadow-[var(--lc-elevation-sm)]',
                      'lg:sticky',
                    )}
                    style={{
                      top: 'calc(var(--lc-nav-height, 3.5rem) + var(--lc-nav-warning-strip-height, 0px) + var(--lc-space-xl))',
                    }}
                  >
                    <h2 id="decision-heading" className="sr-only">
                      Decision
                    </h2>

                    {isTest ? (
                      <Badge
                        className="mb-3 rounded-[var(--lc-radius-pill)] border-transparent bg-[var(--lc-status-warning-bg)] text-[var(--lc-status-warning-fg)]"
                      >
                        TEST
                      </Badge>
                    ) : null}

                    <div className="mb-3">
                      <RiskBadge tier={submission.tenure_risk.tier} />
                    </div>

                    {submission.is_own ? (
                      <div
                        role="status"
                        className="flex items-start gap-2 rounded-[var(--lc-radius-md)] bg-[var(--lc-status-warning-subtle,var(--lc-status-warning-bg))] p-3"
                        style={{ font: 'var(--lc-type-body-sm)' }}
                      >
                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                        <p>You can&apos;t decide this submission — you are the agent-of-record or agency owner.</p>
                      </div>
                    ) : submission.is_already_decided ? (
                      <p className="text-[var(--lc-text-muted)]" style={{ font: 'var(--lc-type-body-sm)' }}>
                        Decisions are closed for this submission. Review the audit trail below.
                      </p>
                    ) : (
                      <>
                        {highRisk ? (
                          <div
                            role="note"
                            id="step-up-notice"
                            className="mb-3 flex items-start gap-2 rounded-[var(--lc-radius-md)] bg-[var(--lc-status-danger-subtle,var(--lc-status-danger-bg))] p-3"
                            style={{ font: 'var(--lc-type-body-sm)' }}
                          >
                            <Shield className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                            <p>This is a High-risk submission. Step-up required to approve or reject.</p>
                          </div>
                        ) : null}
                        {twoPersonReject ? (
                          <div
                            role="note"
                            id="two-person-notice"
                            className="mb-3 flex items-start gap-2 rounded-[var(--lc-radius-md)] bg-[var(--lc-status-warning-subtle,var(--lc-status-warning-bg))] p-3"
                            style={{ font: 'var(--lc-type-body-sm)' }}
                          >
                            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                            <p>
                              This reject requires a second PA approval. Your reason will be visible to the
                              second approver.
                            </p>
                          </div>
                        ) : null}

                        <div className="flex flex-col gap-2">
                          <Button
                            type="button"
                            size="lg"
                            className="w-full transition-colors duration-[var(--lc-duration-fast)]"
                            disabled={actionBusy}
                            aria-describedby={highRisk ? 'step-up-notice' : undefined}
                            onClick={openApprove}
                          >
                            {actionBusy && actionModal === 'approve' ? (
                              <Loader2 className="me-2 h-4 w-4 animate-spin" aria-hidden="true" />
                            ) : null}
                            Approve — publish to {portalName}
                          </Button>
                          <Button
                            type="button"
                            size="lg"
                            variant="outline"
                            className="w-full border-[var(--lc-border-strong)] transition-colors duration-[var(--lc-duration-fast)]"
                            disabled={actionBusy}
                            aria-describedby={
                              [highRisk ? 'step-up-notice' : null, twoPersonReject ? 'two-person-notice' : null]
                                .filter(Boolean)
                                .join(' ') || undefined
                            }
                            onClick={openReject}
                          >
                            {twoPersonReject ? 'Send to second approver' : 'Reject with reason'}
                          </Button>
                          <Button
                            type="button"
                            size="lg"
                            variant="outline"
                            className="w-full border-[var(--lc-status-warning)] text-[var(--lc-status-warning-fg)] transition-colors duration-[var(--lc-duration-fast)]"
                            disabled={actionBusy}
                            onClick={openRequestInfo}
                          >
                            Request info from agent
                          </Button>
                        </div>
                        <p
                          className="mt-3 text-[var(--lc-text-muted)]"
                          style={{ font: 'var(--lc-type-caption)' }}
                        >
                          Every decision is audit-logged and visible on the submission audit trail.
                        </p>
                      </>
                    )}
                  </section>
                </div>
              </div>

              {/* Below-main tabs */}
              <Tabs
                value={activeTab}
                onValueChange={(v) => {
                  if (isDetailTab(v)) setTab(v)
                }}
                className="mt-8"
              >
                <TabsList aria-label="Submission detail panels">
                  <TabsTrigger value="payload">Portal payload</TabsTrigger>
                  <TabsTrigger value="notification">Notification preview</TabsTrigger>
                  <TabsTrigger value="audit">Audit trail</TabsTrigger>
                </TabsList>

                <TabsContent value="payload" className="mt-4">
                  <div className="rounded-[var(--lc-radius-md)] bg-[var(--lc-surface-sunken)] p-4">
                    <div className="mb-2 flex justify-end">
                      <Button type="button" variant="ghost" size="sm" onClick={() => void copyPayload()}>
                        <Copy className="me-1 h-4 w-4" aria-hidden="true" />
                        Copy JSON
                      </Button>
                    </div>
                    <pre
                      className="max-h-[28rem] overflow-auto text-[var(--lc-text-primary)]"
                      style={{
                        fontFamily: 'var(--lc-font-mono)',
                        font: 'var(--lc-type-data-sm)',
                      }}
                    >
                      <code>{payloadJson}</code>
                    </pre>
                  </div>
                </TabsContent>

                <TabsContent value="notification" className="mt-4">
                  <div className="grid gap-4 md:grid-cols-3">
                    {(
                      [
                        ['approve', 'Agent sees on approve', submission.notification_previews.approve],
                        ['reject', 'Agent sees on reject', rejectPreview || submission.notification_previews.reject],
                        [
                          'request_info',
                          'Agent sees on request info',
                          requestPreview || submission.notification_previews.request_info,
                        ],
                      ] as const
                    ).map(([key, label, copy]) => (
                      <div
                        key={key}
                        className="rounded-[var(--lc-radius-lg)] border border-[var(--lc-border)] bg-[var(--lc-surface-raised)] p-4"
                      >
                        <p
                          className="mb-2 text-[var(--lc-text-muted)]"
                          style={{ font: 'var(--lc-type-overline)' }}
                        >
                          {label}
                        </p>
                        <p style={{ font: 'var(--lc-type-body-sm)' }}>{copy || '—'}</p>
                      </div>
                    ))}
                  </div>
                </TabsContent>

                <TabsContent value="audit" className="mt-4">
                  <div className="rounded-[var(--lc-radius-lg)] border border-[var(--lc-border)] bg-[var(--lc-surface-raised)] p-4">
                    <div className="mb-3 flex justify-end">
                      <Button type="button" variant="ghost" size="sm" disabled>
                        <Download className="me-1 h-4 w-4" aria-hidden="true" />
                        Export PDF
                      </Button>
                    </div>
                    {auditLoading ? (
                      <p role="status">Loading audit trail…</p>
                    ) : !auditEvents?.length ? (
                      <p className="text-[var(--lc-text-muted)]">No events yet</p>
                    ) : (
                      <ol className="space-y-3" style={{ font: 'var(--lc-type-body-sm)' }}>
                        {auditEvents.map((ev, i) => (
                          <li key={ev.id ?? `${ev.at}-${i}`} className="flex gap-3">
                            <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[var(--lc-action-primary)]" aria-hidden="true" />
                            <div>
                              <p className="font-medium">{ev.description || ev.kind}</p>
                              <p className="text-[var(--lc-text-muted)]">
                                {new Date(ev.at).toLocaleString()}
                                {ev.actor ? ` · ${ev.actor}` : ''}
                              </p>
                            </div>
                          </li>
                        ))}
                      </ol>
                    )}
                  </div>
                </TabsContent>
              </Tabs>
            </>
          ) : null}
        </div>
      </div>

      {/* Action modals — Radix Dialog focus-traps */}
      <PAQueueBulkApproveDialog
        open={actionModal === 'approve'}
        onOpenChange={(open) => {
          if (!open) setActionModal(null)
        }}
        count={1}
        entityLabel="portal submission"
        description={`On approval, WingCaster will push this listing to ${portalName} immediately.`}
        confirmDisabled={actionBusy}
        onConfirm={() => {
          void confirmApprove()
        }}
        onCancel={() => setActionModal(null)}
      />

      <PAQueueBulkReasonDialog
        open={actionModal === 'reject'}
        onOpenChange={(open) => {
          if (!open) setActionModal(null)
        }}
        mode="reject"
        count={1}
        entityLabel="portal submission"
        title={twoPersonReject ? 'Reject submission (second approver required)' : 'Reject submission'}
        reasonOptions={[...REJECT_REASON_OPTIONS]}
        reasonCode={rejectReason}
        onReasonCodeChange={setRejectReason}
        notes={rejectNotes}
        onNotesChange={setRejectNotes}
        notesRequired={false}
        minNotesLength={0}
        onConfirm={(payload) => {
          void confirmReject(payload)
        }}
        onCancel={() => setActionModal(null)}
      />

      <PAQueueBulkReasonDialog
        open={actionModal === 'request_info'}
        onOpenChange={(open) => {
          if (!open) setActionModal(null)
        }}
        mode="request_info"
        count={1}
        entityLabel="portal submission"
        title="Request info from agent"
        reasonOptions={[...REQUEST_INFO_REASON_OPTIONS]}
        reasonCode={requestReason}
        onReasonCodeChange={setRequestReason}
        notes={requestNotes}
        onNotesChange={setRequestNotes}
        notesRequired
        minNotesLength={5}
        onConfirm={(payload) => {
          void confirmRequestInfo(payload)
        }}
        onCancel={() => setActionModal(null)}
      />
    </div>
  )
}

export default PortalModerationDetailPage
