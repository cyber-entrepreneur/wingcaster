/**
 * PA-MOD-001 — Portal moderation queue (WF-03 approver-side).
 *
 * First real consumer of the PA-queue-family primitives from `@/components/queue`.
 * Honors all 7 QUEUE_INVARIANTS (env badge, two-person, bulk reason/confirm,
 * step-up for high-risk / bulk >5, immutable audit, 5s single-row undo, keyboard-first).
 *
 * Detail deep-link (Agent 4): `/admin/moderation/portals/:submissionId`
 */
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Download,
  HelpCircle,
  Image as ImageIcon,
  RefreshCw,
} from 'lucide-react'
import {
  PAQueueBulkApproveDialog,
  PAQueueBulkBar,
  PAQueueBulkReasonDialog,
  PAQueueFilterStrip,
  PAQueueKeyboardShortcutsPanel,
  PAQueueTable,
  type PAQueueColumn,
  type PAQueueFilterValues,
  type PAQueueRiskTier,
  type PAQueueRow,
  type PAQueueStatusOption,
  type PAQueueSubmittedWithin,
} from '@/components/queue'
import { EnvBadge } from '@/components/nav/EnvBadge'
import { Button } from '@/components/ui/button'
import { ChannelMark } from '@/components/ui/channel-mark'
import { Numeric } from '@/components/ui/numeric'
import { useToast } from '@/components/ui/toast'
import { useStepUp } from '@/context/StepUpContext'
import { useEnv } from '@/hooks/useEnv'
import { useLocale } from '@/hooks/useLocale'
import { cn } from '@/lib/utils'
import { resolveLcChannel } from '@/theme/channel'
import {
  approvePortalSubmission,
  bulkApprovePortalSubmissions,
  bulkRejectPortalSubmissions,
  bulkRequestInfoPortalSubmissions,
  listPortalModeration,
  listPortalRegistryOptions,
  portalModerationCsvPath,
  rejectPortalSubmission,
  REJECT_REASON_OPTIONS,
  requestInfoPortalSubmission,
  REQUEST_INFO_REASON_OPTIONS,
  retryPublishPortalSubmission,
  undoApprovePortalSubmission,
  undoRejectPortalSubmission,
  type PortalModerationListItem,
  type PortalRegistryOption,
} from '@/api/portalModeration'

const UNDO_GRACE_MS = 5000
const SEARCH_DEBOUNCE_MS = 200
const DEFAULT_PAGE_SIZE = 25
const STATUS_VALUES = [
  'pending',
  'approved',
  'rejected',
  'request_info',
  'portal_error',
  'expired',
] as const

type ModerationRow = PAQueueRow & PortalModerationListItem

type PendingUndo = {
  id: string
  kind: 'approve' | 'reject'
  previousStatus: string
  expiresAt: number
}

type ReasonDialogState =
  | { mode: 'reject' | 'request_info'; scope: 'single' | 'bulk'; rowId?: string }
  | null

function parseWithin(raw: string | null): PAQueueSubmittedWithin {
  if (raw === '24h' || raw === '7d' || raw === '30d' || raw === 'all') return raw
  return '7d'
}

function parseRisk(raw: string | null): PAQueueRiskTier {
  if (raw === 'low' || raw === 'medium' || raw === 'high' || raw === 'any') return raw
  return 'any'
}

function parseStatus(raw: string | null): string {
  if (raw && (STATUS_VALUES as readonly string[]).includes(raw)) return raw
  return 'pending'
}

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return iso
  const diffMs = Date.now() - then
  const abs = Math.abs(diffMs)
  const mins = Math.round(abs / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.round(mins / 60)
  if (hours < 48) return `${hours}h ago`
  const days = Math.round(hours / 24)
  return `${days}d ago`
}

function formatSla(hoursRemaining: number): { label: ReactNode; tone: 'ok' | 'warn' | 'danger' } {
  if (hoursRemaining < 0) {
    const breached = Math.abs(hoursRemaining)
    const rounded = Math.round(breached * 10) / 10
    return {
      tone: 'danger',
      label: (
        <>
          Breached by <Numeric>{rounded}</Numeric>h
        </>
      ),
    }
  }
  const rounded = Math.round(hoursRemaining * 10) / 10
  if (hoursRemaining < 2) {
    return {
      tone: 'danger',
      label: (
        <>
          <Numeric>{rounded}</Numeric>h left
        </>
      ),
    }
  }
  if (hoursRemaining <= 8) {
    return {
      tone: 'warn',
      label: (
        <>
          <Numeric>{rounded}</Numeric>h left · at risk
        </>
      ),
    }
  }
  return {
    tone: 'ok',
    label: (
      <>
        <Numeric>{rounded}</Numeric>h left
      </>
    ),
  }
}

function statusGlyphLabel(status: string): { glyph: string; label: string; token: string } {
  switch (status) {
    case 'approved':
      return { glyph: '●', label: 'Approved', token: 'published' }
    case 'rejected':
      return { glyph: '◆', label: 'Rejected', token: 'closed' }
    case 'request_info':
      return { glyph: '▲', label: 'Request info', token: 'underOffer' }
    case 'portal_error':
      return { glyph: '✕', label: 'Portal error', token: 'unpublished' }
    case 'expired':
      return { glyph: '▢', label: 'Expired', token: 'archived' }
    default:
      return { glyph: '○', label: 'Pending', token: 'draft' }
  }
}

function riskBadge(tier: string): { glyph: string; label: string; token: string } {
  switch (tier) {
    case 'high':
      return { glyph: '◆', label: 'High', token: 'unpublished' }
    case 'medium':
      return { glyph: '▲', label: 'Medium', token: 'underOffer' }
    case 'low':
      return { glyph: '●', label: 'Low', token: 'published' }
    default:
      return { glyph: '○', label: 'Unknown', token: 'draft' }
  }
}

function portalMonogram(code: string, displayName: string): string {
  const source = displayName || code || '?'
  return source.trim().charAt(0).toUpperCase() || '?'
}

function useDesktopMin(): boolean {
  const [ok, setOk] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia('(min-width: 1024px)').matches : true,
  )
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)')
    const onChange = () => setOk(mq.matches)
    onChange()
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return ok
}

function ToneBadge({
  glyph,
  label,
  token,
  title,
}: {
  glyph: string
  label: string
  token: string
  title?: string
}) {
  return (
    <span
      title={title}
      className={cn(
        'inline-flex items-center gap-1 rounded-[var(--lc-radius-pill)] px-2 py-0.5',
        'text-[length:var(--lc-type-caption,0.75rem)] font-semibold',
      )}
      style={{
        background: `var(--lc-status-${token}-bg)`,
        color: `var(--lc-status-${token}-fg)`,
      }}
    >
      <span aria-hidden="true" style={{ color: `var(--lc-status-${token}-dot)` }}>
        {glyph}
      </span>
      {label}
    </span>
  )
}

export function PortalModerationQueuePage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { addToast } = useToast()
  const { runElevated, requireElevation } = useStepUp()
  const { env, isTest } = useEnv()
  const { locale } = useLocale()
  const isDesktop = useDesktopMin()

  const filters: PAQueueFilterValues = useMemo(
    () => ({
      status: parseStatus(searchParams.get('status')),
      submittedWithin: parseWithin(searchParams.get('within')),
      riskTier: parseRisk(searchParams.get('risk')),
      search: searchParams.get('q') ?? '',
    }),
    [searchParams],
  )
  const portalFilter = searchParams.get('portal') ?? ''
  const countryFilter = searchParams.get('country') ?? ''
  const page = Math.max(1, Number(searchParams.get('page') || '1') || 1)
  const pageSize = Math.min(
    100,
    Math.max(1, Number(searchParams.get('pageSize') || String(DEFAULT_PAGE_SIZE)) || DEFAULT_PAGE_SIZE),
  )

  const [rows, setRows] = useState<ModerationRow[]>([])
  const [counts, setCounts] = useState({
    pending: 0,
    pending_at_risk: 0,
    approved_this_week: 0,
    rejected_this_week: 0,
    request_info_this_week: 0,
    portal_error_this_week: 0,
    expired: 0,
  })
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [portals, setPortals] = useState<PortalRegistryOption[]>([])
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [focusedId, setFocusedId] = useState<string | null>(null)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const [bulkApproveOpen, setBulkApproveOpen] = useState(false)
  const [reasonDialog, setReasonDialog] = useState<ReasonDialogState>(null)
  const [pendingUndo, setPendingUndo] = useState<PendingUndo | null>(null)
  const [searchDraft, setSearchDraft] = useState(filters.search)
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const fetchGen = useRef(0)

  const patchParams = useCallback(
    (patch: Record<string, string | null | undefined>, opts?: { resetPage?: boolean }) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          for (const [key, value] of Object.entries(patch)) {
            if (value == null || value === '' || value === 'any') next.delete(key)
            else next.set(key, value)
          }
          if (opts?.resetPage !== false) next.set('page', '1')
          return next
        },
        { replace: true },
      )
    },
    [setSearchParams],
  )

  const loadQueue = useCallback(async () => {
    const gen = ++fetchGen.current
    setLoading(true)
    setError(null)
    try {
      const data = await listPortalModeration({
        status: filters.status,
        portal: portalFilter || undefined,
        country: countryFilter || undefined,
        risk: filters.riskTier,
        within: filters.submittedWithin,
        q: filters.search,
        page,
        pageSize,
        sort: 'sla_remaining:asc',
      })
      if (gen !== fetchGen.current) return
      const nextRows: ModerationRow[] = (data.submissions || []).map((s) => ({
        ...s,
        isOwn: Boolean(s.is_own),
      }))
      setRows(nextRows)
      setTotal(data.pagination?.total ?? nextRows.length)
      setCounts({
        pending: data.counts?.pending ?? 0,
        pending_at_risk: data.counts?.pending_at_risk ?? 0,
        approved_this_week: data.counts?.approved_this_week ?? 0,
        rejected_this_week: data.counts?.rejected_this_week ?? 0,
        request_info_this_week: data.counts?.request_info_this_week ?? 0,
        portal_error_this_week: data.counts?.portal_error_this_week ?? 0,
        expired: data.counts?.expired ?? 0,
      })
      setFocusedId((prev) => {
        if (prev && nextRows.some((r) => r.id === prev)) return prev
        return nextRows[0]?.id ?? null
      })
    } catch (err) {
      if (gen !== fetchGen.current) return
      const status = (err as { status?: number })?.status
      const message =
        status === 404
          ? "Moderation API not available yet ([BE-BLOCKER-02b]). Couldn't load submissions."
          : err instanceof Error
            ? err.message
            : "Couldn't load submissions. Try again."
      setError(message)
      setRows([])
      setTotal(0)
    } finally {
      if (gen === fetchGen.current) setLoading(false)
    }
  }, [
    countryFilter,
    filters.riskTier,
    filters.search,
    filters.status,
    filters.submittedWithin,
    page,
    pageSize,
    portalFilter,
  ])

  useEffect(() => {
    void loadQueue()
  }, [loadQueue, env])

  useEffect(() => {
    void listPortalRegistryOptions()
      .then(setPortals)
      .catch(() => setPortals([]))
  }, [env])

  useEffect(() => {
    setSearchDraft(filters.search)
  }, [filters.search])

  useEffect(() => {
    const handle = window.setTimeout(() => {
      if (searchDraft === filters.search) return
      patchParams({ q: searchDraft.trim() || null })
      setSelectedIds([])
    }, SEARCH_DEBOUNCE_MS)
    return () => window.clearTimeout(handle)
  }, [filters.search, patchParams, searchDraft])

  useEffect(() => {
    return () => {
      if (undoTimerRef.current) clearTimeout(undoTimerRef.current)
    }
  }, [])

  const statusOptions: PAQueueStatusOption[] = useMemo(
    () => [
      { value: 'pending', label: 'Pending', count: counts.pending },
      { value: 'approved', label: 'Approved', count: counts.approved_this_week },
      { value: 'rejected', label: 'Rejected', count: counts.rejected_this_week },
      { value: 'request_info', label: 'Request info', count: counts.request_info_this_week },
      { value: 'portal_error', label: 'Portal error', count: counts.portal_error_this_week },
      { value: 'expired', label: 'Expired', count: counts.expired },
    ],
    [counts],
  )

  const countryOptions = useMemo(() => {
    const set = new Set<string>()
    for (const p of portals) {
      for (const c of p.country_codes || []) set.add(c)
    }
    return Array.from(set).sort()
  }, [portals])

  const selectedRows = useMemo(
    () => rows.filter((r) => selectedIds.includes(r.id)),
    [rows, selectedIds],
  )
  const acrossPortals = useMemo(
    () => new Set(selectedRows.map((r) => r.portal?.code).filter(Boolean)).size,
    [selectedRows],
  )
  const highRiskCount = useMemo(
    () => selectedRows.filter((r) => r.tenure_risk?.tier === 'high' || r.step_up_required).length,
    [selectedRows],
  )
  const ownInSelection = useMemo(() => selectedRows.filter((r) => r.is_own || r.isOwn).length, [selectedRows])

  const detailHref = useCallback(
    (id: string) => {
      const returnTo = encodeURIComponent(
        `${window.location.pathname}${window.location.search}`,
      )
      return `/admin/moderation/portals/${encodeURIComponent(id)}?return_to=${returnTo}`
    },
    [],
  )

  const openDetail = useCallback(
    (row: ModerationRow) => {
      navigate(detailHref(row.id))
    },
    [detailHref, navigate],
  )

  const clearUndoTimer = () => {
    if (undoTimerRef.current) {
      clearTimeout(undoTimerRef.current)
      undoTimerRef.current = null
    }
  }

  const scheduleUndo = (undo: PendingUndo) => {
    clearUndoTimer()
    setPendingUndo(undo)
    undoTimerRef.current = setTimeout(() => {
      setPendingUndo(null)
      undoTimerRef.current = null
    }, UNDO_GRACE_MS)
  }

  const needsStepUpForRow = (row: ModerationRow) =>
    row.step_up_required || row.tenure_risk?.tier === 'high'

  const needsStepUpForBulk = (count: number, highRisk: number) => highRisk > 0 || count > 5

  const ensureStepUp = async (required: boolean, label: string) => {
    if (!required) return true
    return requireElevation(label)
  }

  const applyLocalStatus = (id: string, status: string) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)))
  }

  const runSingleApprove = async (row: ModerationRow) => {
    if (row.is_own || row.isOwn) {
      addToast({
        variant: 'warning',
        title: "You can't act on this row — you are the agent-of-record for this listing.",
      })
      return
    }
    if (row.status !== 'pending') return
    const ok = await ensureStepUp(
      needsStepUpForRow(row),
      `Confirm your identity to approve this ${row.tenure_risk?.tier || 'medium'}-risk submission.`,
    )
    if (!ok) return

    const previousStatus = row.status
    applyLocalStatus(row.id, 'approved')
    try {
      const result = await runElevated(
        () => approvePortalSubmission(row.id),
        `Approve ${row.listing?.title || 'submission'}`,
      )
      if (result === null) {
        applyLocalStatus(row.id, previousStatus)
        return
      }
      addToast({
        variant: 'success',
        title: `Approved ${row.listing?.title || 'listing'} for ${row.portal?.display_name || row.portal?.code}.`,
        duration: UNDO_GRACE_MS,
      })
      scheduleUndo({
        id: row.id,
        kind: 'approve',
        previousStatus,
        expiresAt: Date.now() + UNDO_GRACE_MS,
      })
    } catch (err) {
      applyLocalStatus(row.id, previousStatus)
      addToast({
        variant: 'error',
        title: err instanceof Error ? err.message : 'Something went wrong. Try again.',
      })
    }
  }

  const commitReasonAction = async (payload: { reasonCode: string; notes: string }) => {
    if (!reasonDialog) return
    const body = { reason_code: payload.reasonCode, notes: payload.notes }

    if (reasonDialog.scope === 'single' && reasonDialog.rowId) {
      const row = rows.find((r) => r.id === reasonDialog.rowId)
      if (!row) return
      if (row.is_own || row.isOwn) {
        addToast({
          variant: 'warning',
          title: "You can't act on this row — you are the agent-of-record for this listing.",
        })
        return
      }
      const ok = await ensureStepUp(
        needsStepUpForRow(row),
        `Confirm your identity to ${reasonDialog.mode === 'reject' ? 'reject' : 'request info on'} this ${row.tenure_risk?.tier || 'medium'}-risk submission.`,
      )
      if (!ok) return

      const previousStatus = row.status
      const nextStatus = reasonDialog.mode === 'reject' ? 'rejected' : 'request_info'
      applyLocalStatus(row.id, nextStatus)
      try {
        const action =
          reasonDialog.mode === 'reject'
            ? () => rejectPortalSubmission(row.id, body)
            : () => requestInfoPortalSubmission(row.id, body)
        const result = await runElevated(action, `${reasonDialog.mode} ${row.listing?.title || ''}`)
        if (result === null) {
          applyLocalStatus(row.id, previousStatus)
          return
        }
        if (reasonDialog.mode === 'reject') {
          addToast({
            variant: 'success',
            title: `Rejected ${row.listing?.title || 'listing'} — ${payload.reasonCode}.`,
            duration: UNDO_GRACE_MS,
          })
          scheduleUndo({
            id: row.id,
            kind: 'reject',
            previousStatus,
            expiresAt: Date.now() + UNDO_GRACE_MS,
          })
        } else {
          addToast({
            variant: 'success',
            title: `Requested info on ${row.listing?.title || 'listing'}.`,
          })
        }
      } catch (err) {
        applyLocalStatus(row.id, previousStatus)
        addToast({
          variant: 'error',
          title: err instanceof Error ? err.message : 'Something went wrong. Try again.',
        })
      }
      return
    }

    // Bulk — commits immediately, no undo
    const actionable = selectedRows.filter((r) => !(r.is_own || r.isOwn))
    if (ownInSelection > 0) {
      addToast({
        variant: 'warning',
        title: `${ownInSelection} rows will be skipped — you are agent-of-record for them.`,
      })
    }
    if (actionable.length === 0) return
    const ok = await ensureStepUp(
      needsStepUpForBulk(actionable.length, highRiskCount),
      `Confirm your identity to ${reasonDialog.mode} ${actionable.length} submissions.`,
    )
    if (!ok) return
    try {
      const ids = actionable.map((r) => r.id)
      const action =
        reasonDialog.mode === 'reject'
          ? () => bulkRejectPortalSubmissions(ids, body)
          : () => bulkRequestInfoPortalSubmissions(ids, body)
      const result = await runElevated(action, `Bulk ${reasonDialog.mode}`)
      if (result === null) return
      addToast({
        variant: 'success',
        title:
          reasonDialog.mode === 'reject'
            ? `Rejected ${ids.length} submissions.`
            : `Requested info on ${ids.length} submissions.`,
      })
      setSelectedIds([])
      await loadQueue()
    } catch (err) {
      addToast({
        variant: 'error',
        title: err instanceof Error ? err.message : 'Something went wrong. Try again.',
      })
    }
  }

  const commitBulkApprove = async () => {
    const actionable = selectedRows.filter((r) => !(r.is_own || r.isOwn))
    if (ownInSelection > 0) {
      addToast({
        variant: 'warning',
        title: `${ownInSelection} rows will be skipped — you are agent-of-record for them.`,
      })
    }
    if (actionable.length === 0) return
    const ok = await ensureStepUp(
      needsStepUpForBulk(actionable.length, highRiskCount),
      `Confirm your identity to approve ${actionable.length} submissions.`,
    )
    if (!ok) return
    try {
      const ids = actionable.map((r) => r.id)
      const result = await runElevated(
        () => bulkApprovePortalSubmissions(ids),
        `Bulk approve ${ids.length}`,
      )
      if (result === null) return
      addToast({ variant: 'success', title: `Approved ${ids.length} submissions.` })
      setSelectedIds([])
      await loadQueue()
    } catch (err) {
      addToast({
        variant: 'error',
        title: err instanceof Error ? err.message : 'Something went wrong. Try again.',
      })
    }
  }

  const handleUndo = async () => {
    if (!pendingUndo) return
    const { id, kind, previousStatus } = pendingUndo
    clearUndoTimer()
    setPendingUndo(null)
    applyLocalStatus(id, previousStatus)
    try {
      if (kind === 'approve') await undoApprovePortalSubmission(id)
      else await undoRejectPortalSubmission(id)
      addToast({ variant: 'default', title: 'Decision undone.' })
    } catch (err) {
      addToast({
        variant: 'error',
        title: err instanceof Error ? err.message : 'Undo failed.',
      })
      void loadQueue()
    }
  }

  const focusedRow = rows.find((r) => r.id === focusedId) ?? null

  const moveFocus = (delta: number) => {
    if (rows.length === 0) return
    const idx = Math.max(
      0,
      rows.findIndex((r) => r.id === focusedId),
    )
    const next = rows[(idx + delta + rows.length) % rows.length]
    setFocusedId(next.id)
    const el = document.querySelector(`[data-row-id="${CSS.escape(next.id)}"]`) as HTMLElement | null
    el?.focus()
  }

  const toggleSelectFocused = () => {
    if (!focusedId) return
    setSelectedIds((prev) =>
      prev.includes(focusedId) ? prev.filter((id) => id !== focusedId) : [...prev, focusedId],
    )
  }

  const onGlobalKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      const tag = target?.tagName?.toLowerCase()
      if (tag === 'input' || tag === 'textarea' || tag === 'select' || target?.isContentEditable) {
        if (e.key === 'Escape') (target as HTMLElement).blur()
        return
      }
      if (bulkApproveOpen || reasonDialog || shortcutsOpen) {
        if (e.key === 'Escape') {
          setBulkApproveOpen(false)
          setReasonDialog(null)
          setShortcutsOpen(false)
        }
        return
      }

      if (e.key === '?' || (e.shiftKey && e.key === '/')) {
        e.preventDefault()
        setShortcutsOpen(true)
        return
      }
      if (e.key === 'Escape') {
        if (selectedIds.length) setSelectedIds([])
        return
      }
      if (e.key === '.' ) {
        e.preventDefault()
        void loadQueue()
        return
      }
      if (e.key === 'j' || e.key === 'J') {
        e.preventDefault()
        moveFocus(1)
        return
      }
      if (e.key === 'k' || e.key === 'K') {
        e.preventDefault()
        moveFocus(-1)
        return
      }
      if (e.key === 'x' || e.key === 'X') {
        e.preventDefault()
        toggleSelectFocused()
        return
      }
      if (e.key === 'A' && e.shiftKey) {
        e.preventDefault()
        setSelectedIds(rows.map((r) => r.id))
        return
      }
      if (e.key === 'Enter' && focusedRow) {
        e.preventDefault()
        openDetail(focusedRow)
        return
      }
      if ((e.key === 'a' || e.key === 'A') && !e.shiftKey && focusedRow) {
        e.preventDefault()
        void runSingleApprove(focusedRow)
        return
      }
      if ((e.key === 'r' || e.key === 'R') && focusedRow) {
        e.preventDefault()
        if (focusedRow.status === 'pending' && !(focusedRow.is_own || focusedRow.isOwn)) {
          setReasonDialog({ mode: 'reject', scope: 'single', rowId: focusedRow.id })
        }
        return
      }
      if ((e.key === 'i' || e.key === 'I') && focusedRow) {
        e.preventDefault()
        if (focusedRow.status === 'pending' && !(focusedRow.is_own || focusedRow.isOwn)) {
          setReasonDialog({ mode: 'request_info', scope: 'single', rowId: focusedRow.id })
        }
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- handlers close over latest state intentionally
    [
      bulkApproveOpen,
      focusedRow,
      loadQueue,
      openDetail,
      reasonDialog,
      rows,
      selectedIds.length,
      shortcutsOpen,
    ],
  )

  useEffect(() => {
    window.addEventListener('keydown', onGlobalKeyDown)
    return () => window.removeEventListener('keydown', onGlobalKeyDown)
  }, [onGlobalKeyDown])

  const columns: PAQueueColumn<ModerationRow>[] = useMemo(
    () => [
      {
        id: 'submitted',
        header: 'Submitted',
        cell: (row) => {
          const sla = formatSla(row.sla_hours_remaining)
          const toneToken =
            sla.tone === 'ok' ? 'published' : sla.tone === 'warn' ? 'underOffer' : 'unpublished'
          return (
            <div className="flex flex-col gap-1">
              <span
                className="text-[length:var(--lc-type-body-sm)]"
                title={new Date(row.submitted_at).toLocaleString()}
              >
                {relativeTime(row.submitted_at)}
              </span>
              <span
                className="inline-flex w-fit rounded-[var(--lc-radius-pill)] px-1.5 py-0.5 text-[length:var(--lc-type-caption)]"
                style={{
                  background: `var(--lc-status-${toneToken}-bg)`,
                  color: `var(--lc-status-${toneToken}-fg)`,
                }}
              >
                {sla.label}
              </span>
            </div>
          )
        },
      },
      {
        id: 'agent',
        header: 'Agent · Agency',
        cell: (row) => {
          const initials = (row.agent?.display_name || '?')
            .split(/\s+/)
            .map((p) => p[0])
            .join('')
            .slice(0, 2)
            .toUpperCase()
          return (
            <div className="flex items-center gap-2">
              <span
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--lc-surface-sunken)] text-xs font-semibold text-[var(--lc-text-primary)]"
                aria-hidden
              >
                {row.agent?.avatar_url ? (
                  <img
                    src={row.agent.avatar_url}
                    alt=""
                    className="h-8 w-8 rounded-full object-cover"
                  />
                ) : (
                  initials
                )}
              </span>
              <div className="min-w-0">
                <div className="truncate font-[var(--lc-type-body)] text-[var(--lc-text-primary)]">
                  {row.agent?.display_name || '—'}
                </div>
                {row.agency?.tenant_url ? (
                  <a
                    href={row.agency.tenant_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="truncate text-[length:var(--lc-type-caption)] text-[var(--lc-text-muted)] underline-offset-2 hover:underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {row.agency.name}
                  </a>
                ) : (
                  <div className="truncate text-[length:var(--lc-type-caption)] text-[var(--lc-text-muted)]">
                    {row.agency?.name || '—'}
                  </div>
                )}
              </div>
            </div>
          )
        },
      },
      {
        id: 'listing',
        header: 'Listing',
        cell: (row) => (
          <div className="flex items-center gap-2">
            <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-[var(--lc-radius-md)] bg-[var(--lc-surface-sunken)]">
              {row.listing?.hero_image_url ? (
                <img
                  src={row.listing.hero_image_url}
                  alt=""
                  className="h-10 w-10 object-cover"
                />
              ) : (
                <span
                  className="flex h-full w-full items-center justify-center border border-dashed border-[var(--lc-border-strong)]"
                  aria-hidden
                >
                  <ImageIcon className="h-4 w-4 text-[var(--lc-text-muted)]" />
                </span>
              )}
            </span>
            <div className="min-w-0">
              <div className="truncate font-[var(--lc-type-body)]">{row.listing?.title || '—'}</div>
              <div className="truncate text-[length:var(--lc-type-caption)] text-[var(--lc-text-muted)]">
                {row.listing?.address_line || '—'}
              </div>
            </div>
          </div>
        ),
      },
      {
        id: 'portal',
        header: 'Portal · Country',
        cell: (row) => {
          const channel = resolveLcChannel(row.portal?.code)
          return (
            <div className="flex items-center gap-2">
              {channel ? (
                <ChannelMark channel={channel} label={row.portal?.display_name} />
              ) : (
                <span
                  className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[var(--lc-surface-sunken)] text-[10px] font-semibold text-[var(--lc-text-primary)]"
                  aria-hidden
                >
                  {portalMonogram(row.portal?.code || '', row.portal?.display_name || '')}
                </span>
              )}
              <div className="min-w-0">
                <div className="truncate text-sm">{row.portal?.display_name || row.portal?.code}</div>
                <div className="text-[length:var(--lc-type-caption)] text-[var(--lc-text-muted)]" dir="ltr">
                  {row.portal?.country_flag_emoji || ''} {row.portal?.country_code}
                </div>
              </div>
            </div>
          )
        },
      },
      {
        id: 'lint',
        header: 'Validator lint',
        cell: (row) => {
          const lint = row.validator_lint
          const title =
            lint?.checks?.map((c) => `${c.severity}: ${c.message}`).join('\n') ||
            'Per-portal validator results'
          return (
            <span
              title={title}
              className="inline-flex flex-wrap gap-1 text-[length:var(--lc-type-caption)]"
            >
              <ToneBadge
                glyph="●"
                label={`${lint?.pass_count ?? 0} pass`}
                token="published"
              />
              <ToneBadge
                glyph="⚠"
                label={`${lint?.warn_count ?? 0} warn`}
                token="underOffer"
              />
              <ToneBadge
                glyph="✕"
                label={`${lint?.fail_count ?? 0} fail`}
                token="unpublished"
              />
            </span>
          )
        },
      },
      {
        id: 'risk',
        header: 'Tenure risk',
        cell: (row) => {
          const r = riskBadge(row.tenure_risk?.tier || 'unknown')
          return <ToneBadge glyph={r.glyph} label={r.label} token={r.token} />
        },
      },
      {
        id: 'status',
        header: 'Status',
        cell: (row) => {
          const s = statusGlyphLabel(String(row.status))
          const pulsing = pendingUndo?.id === row.id
          return (
            <span
              className={cn(
                pulsing && 'rounded-[var(--lc-radius-md)] outline outline-2 outline-[var(--lc-accent-bold-edge)]',
              )}
            >
              <ToneBadge glyph={s.glyph} label={s.label} token={s.token} />
            </span>
          )
        },
      },
      {
        id: 'actions',
        header: 'Actions',
        srOnlyHeader: true,
        cell: (row) => {
          const pending = row.status === 'pending'
          const own = row.is_own || row.isOwn
          const stop = (e: ReactMouseEvent | ReactKeyboardEvent) => e.stopPropagation()
          return (
            <div className="flex flex-wrap items-center gap-1" onClick={stop} onKeyDown={stop}>
              {pending && !own ? (
                <>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="border-[var(--lc-action-primary)] text-[var(--lc-action-primary)]"
                    onClick={() => void runSingleApprove(row)}
                  >
                    Approve
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      setReasonDialog({ mode: 'reject', scope: 'single', rowId: row.id })
                    }
                  >
                    Reject
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      setReasonDialog({ mode: 'request_info', scope: 'single', rowId: row.id })
                    }
                  >
                    Request info
                  </Button>
                </>
              ) : null}
              {pending && own ? (
                <span className="text-xs text-[var(--lc-text-muted)]" title="You can't act on this row — you are the agent-of-record for this listing.">
                  Own row
                </span>
              ) : null}
              {row.status === 'portal_error' ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    void runElevated(
                      () => retryPublishPortalSubmission(row.id),
                      'Retry publish',
                    ).then((r) => {
                      if (r !== null) {
                        addToast({ variant: 'success', title: 'Retry enqueued.' })
                        void loadQueue()
                      }
                    })
                  }}
                >
                  Retry publish
                </Button>
              ) : null}
              <Button type="button" size="sm" variant="outline" onClick={() => openDetail(row)}>
                Open
              </Button>
            </div>
          )
        },
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [addToast, loadQueue, openDetail, pendingUndo, runElevated],
  )

  const emptyState = (
    <div className="mx-auto flex max-w-md flex-col items-center gap-3 py-4">
      <div
        className="flex h-[200px] w-[200px] items-center justify-center rounded-[var(--lc-radius-lg)] border border-dashed border-[var(--lc-border-strong)] bg-[var(--lc-surface-sunken)] text-sm text-[var(--lc-text-muted)]"
        aria-hidden
      >
        Illustration — empty queue
      </div>
      {filters.status === 'pending' && !filters.search ? (
        <>
          <h2 style={{ font: 'var(--lc-type-heading-3)' }} className="text-[var(--lc-text-heading)]">
            No submissions awaiting moderation
          </h2>
          <p className="text-[var(--lc-text-muted)]" style={{ font: 'var(--lc-type-body)' }}>
            When agents submit listings to portals, they land here for your review. Check
            portal-registry health if you expected submissions.
          </p>
          <Button type="button" variant="outline" asChild>
            <Link to="/admin/portals">Review portal registry →</Link>
          </Button>
        </>
      ) : filters.search ? (
        <>
          <h2 style={{ font: 'var(--lc-type-heading-3)' }} className="text-[var(--lc-text-heading)]">
            No submissions match &lsquo;{filters.search}&rsquo;
          </h2>
          <Button type="button" variant="link" onClick={() => patchParams({ q: null })}>
            Clear search
          </Button>
        </>
      ) : (
        <>
          <h2 style={{ font: 'var(--lc-type-heading-3)' }} className="text-[var(--lc-text-heading)]">
            No {filters.status.replace('_', ' ')} submissions in this range
          </h2>
          <p className="text-[var(--lc-text-muted)]">
            Try widening the &lsquo;Submitted within&rsquo; filter.
          </p>
        </>
      )}
    </div>
  )

  const selectClassName = cn(
    'min-h-tap rounded-[var(--lc-radius-md)] border border-[var(--lc-border-strong)]',
    'bg-[var(--lc-surface)] px-3 text-sm text-[var(--lc-text-primary)]',
    'focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50',
  )

  if (!isDesktop) {
    return (
      <div className="mx-auto flex min-h-[50vh] max-w-lg flex-col items-center justify-center gap-3 px-6 py-16 text-center">
        <AlertTriangle className="h-8 w-8 text-[var(--lc-status-underOffer-fg)]" aria-hidden />
        <h1 style={{ font: 'var(--lc-type-heading-2)' }} className="text-[var(--lc-text-heading)]">
          PA console requires a desktop screen
        </h1>
        <p className="text-[var(--lc-text-muted)]">
          Portal moderation needs 1024px or wider. Open this page on a larger display.
        </p>
        <Button type="button" variant="outline" asChild>
          <Link to="/dashboard">Back to home</Link>
        </Button>
      </div>
    )
  }

  const startIdx = total === 0 ? 0 : (page - 1) * pageSize + 1
  const endIdx = Math.min(page * pageSize, total)
  const pageCount = Math.max(1, Math.ceil(total / pageSize))

  return (
    <div
      className="mx-auto w-full max-w-[1440px] px-[var(--lc-space-2xl)] py-[var(--lc-space-xl)]"
      data-testid="portal-moderation-queue"
      data-env={env}
    >
      <a
        href="#pa-mod-queue-table"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:rounded-[var(--lc-radius-md)] focus:bg-[var(--lc-surface-raised)] focus:px-3 focus:py-2"
      >
        Skip to submissions table
      </a>

      <header className="mb-[var(--lc-space-md)] flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1
            style={{ font: 'var(--lc-type-heading-1)' }}
            className="text-[var(--lc-text-heading)]"
          >
            Portal moderation queue
          </h1>
          <p
            className="mt-1 text-[var(--lc-text-muted)]"
            style={{ font: 'var(--lc-type-body-sm)' }}
          >
            <Numeric>{counts.pending}</Numeric> pending ·{' '}
            <Numeric>{counts.pending_at_risk}</Numeric> at-risk ·{' '}
            <Numeric>{counts.approved_this_week}</Numeric> approved ·{' '}
            <Numeric>{counts.rejected_this_week}</Numeric> rejected this week
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Refresh queue"
            onClick={() => void loadQueue()}
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            aria-label="Export CSV"
            onClick={() => {
              const path = portalModerationCsvPath({
                status: filters.status,
                portal: portalFilter || undefined,
                country: countryFilter || undefined,
                risk: filters.riskTier,
                within: filters.submittedWithin,
                q: filters.search,
              })
              window.open(path, '_blank', 'noopener,noreferrer')
            }}
          >
            <Download className="me-2 h-4 w-4" aria-hidden />
            Export CSV
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Show keyboard shortcuts"
            onClick={() => setShortcutsOpen(true)}
          >
            <HelpCircle className="h-4 w-4" />
          </Button>
        </div>
      </header>

      {isTest ? (
        <div
          role="status"
          aria-live="polite"
          className="mb-[var(--lc-space-sm)] rounded-[var(--lc-radius-md)] px-3 py-2 text-sm font-medium"
          style={{
            background: 'var(--lc-status-underOffer-dot)',
            color: 'var(--lc-text-inverse)',
          }}
          data-testid="pa-mod-test-warning"
        >
          TEST ENVIRONMENT — actions here do not publish to real portals.
        </div>
      ) : null}

      <PAQueueFilterStrip
        aria-label="Filter portal submissions"
        envBadge={<EnvBadge env={env} locale={locale} />}
        statusOptions={statusOptions}
        values={{ ...filters, search: searchDraft }}
        disabled={loading}
        onChange={(next) => {
          setSearchDraft(next.search)
          patchParams({
            status: next.status,
            within: next.submittedWithin,
            risk: next.riskTier === 'any' ? null : next.riskTier,
            q: next.search.trim() || null,
          })
          setSelectedIds([])
        }}
        customFilters={
          <>
            <div className="flex min-w-[9rem] flex-col gap-1">
              <label htmlFor="pa-mod-portal" className="text-sm font-medium text-[var(--lc-text-primary)]">
                Portal
              </label>
              <select
                id="pa-mod-portal"
                className={selectClassName}
                value={portalFilter}
                disabled={loading}
                onChange={(e) => {
                  patchParams({ portal: e.target.value || null })
                  setSelectedIds([])
                }}
              >
                <option value="">Any portal</option>
                {portals.map((p) => (
                  <option key={p.code} value={p.code}>
                    {p.display_name || p.code}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex min-w-[8rem] flex-col gap-1">
              <label htmlFor="pa-mod-country" className="text-sm font-medium text-[var(--lc-text-primary)]">
                Country
              </label>
              <select
                id="pa-mod-country"
                className={selectClassName}
                value={countryFilter}
                disabled={loading}
                onChange={(e) => {
                  patchParams({ country: e.target.value || null })
                  setSelectedIds([])
                }}
              >
                <option value="">Any country</option>
                {countryOptions.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </>
        }
      />

      <div className="my-[var(--lc-space-sm)]">
        <PAQueueBulkBar
          showBulk={true}
          selectedCount={selectedIds.length}
          acrossCount={acrossPortals}
          highRiskCount={highRiskCount}
          onClearSelection={() => setSelectedIds([])}
          onApprove={() => setBulkApproveOpen(true)}
          onReject={() => setReasonDialog({ mode: 'reject', scope: 'bulk' })}
          onRequestInfo={() => setReasonDialog({ mode: 'request_info', scope: 'bulk' })}
        />
      </div>

      {error ? (
        <div
          role="alert"
          className="mb-[var(--lc-space-sm)] flex flex-wrap items-center justify-between gap-3 rounded-[var(--lc-radius-md)] border border-[var(--lc-border)] px-4 py-3"
          style={{
            background: 'var(--lc-status-unpublished-bg)',
            color: 'var(--lc-status-unpublished-fg)',
          }}
        >
          <span className="inline-flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" aria-hidden />
            {error}
          </span>
          <Button type="button" variant="outline" onClick={() => void loadQueue()}>
            Retry
          </Button>
        </div>
      ) : null}

      {pendingUndo ? (
        <div
          role="status"
          aria-live="polite"
          className="mb-[var(--lc-space-sm)] flex items-center justify-between gap-3 rounded-[var(--lc-radius-md)] border border-[var(--lc-accent-bold-edge)] bg-[var(--lc-surface-raised)] px-4 py-2 text-sm"
        >
          <span>Decision pending — Undo within 5s</span>
          <Button type="button" variant="link" onClick={() => void handleUndo()}>
            Undo
          </Button>
        </div>
      ) : null}

      <div id="pa-mod-queue-table">
        <PAQueueTable<ModerationRow>
          aria-label="Portal moderation submissions"
          columns={columns}
          rows={rows}
          selectedIds={selectedIds}
          onSelectionChange={setSelectedIds}
          selectable
          focusedId={focusedId}
          onRowClick={openDetail}
          emptyState={emptyState}
          loading={loading}
          skeletonRows={8}
        />
      </div>

      <footer className="mt-[var(--lc-space-md)] flex flex-wrap items-center justify-end gap-3 text-sm text-[var(--lc-text-muted)]">
        <span>
          <Numeric>{startIdx}</Numeric>–<Numeric>{endIdx}</Numeric> of <Numeric>{total}</Numeric>
        </span>
        <label className="inline-flex items-center gap-2">
          <span>Rows per page</span>
          <select
            className={selectClassName}
            value={pageSize}
            onChange={(e) => patchParams({ pageSize: e.target.value, page: '1' }, { resetPage: false })}
          >
            {[25, 50, 100].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Previous page"
          disabled={page <= 1 || loading}
          onClick={() => patchParams({ page: String(page - 1) }, { resetPage: false })}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Next page"
          disabled={page >= pageCount || loading}
          onClick={() => patchParams({ page: String(page + 1) }, { resetPage: false })}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </footer>

      <PAQueueBulkApproveDialog
        open={bulkApproveOpen}
        onOpenChange={setBulkApproveOpen}
        count={selectedIds.length}
        entityLabel="portal submissions"
        description="Each listing will be pushed to its target portal immediately after your approval."
        onConfirm={() => void commitBulkApprove()}
      />

      <PAQueueBulkReasonDialog
        open={reasonDialog !== null}
        onOpenChange={(open) => {
          if (!open) setReasonDialog(null)
        }}
        mode={reasonDialog?.mode ?? 'reject'}
        count={
          reasonDialog?.scope === 'single'
            ? 1
            : selectedIds.length
        }
        entityLabel={reasonDialog?.scope === 'single' ? 'portal submission' : 'portal submissions'}
        reasonOptions={
          reasonDialog?.mode === 'request_info'
            ? [...REQUEST_INFO_REASON_OPTIONS]
            : [...REJECT_REASON_OPTIONS]
        }
        onConfirm={(payload) => void commitReasonAction(payload)}
      />

      <PAQueueKeyboardShortcutsPanel open={shortcutsOpen} onOpenChange={setShortcutsOpen} />
    </div>
  )
}

export default PortalModerationQueuePage
