/**
 * PA-ACR-001 — Account recovery queue (WF-04 approver-side).
 *
 * Delta from PA-MOD-001 (PA-queue-family). Reuses Shared Prep imports only:
 * `PAQueueFilterStrip`, `PAQueueTable`, `PAQueueKeyboardShortcutsPanel`, `<PIIMask>`.
 *
 * ## WF-04 family deviations (deliberate)
 * 1. **No bulk actions** — omit `PAQueueBulkBar` / effectively `showBulk={false}`.
 *    Bulk approve on account recovery is unsafe (PII + per-case evidence review).
 * 2. **No inline Approve / Reject / Request info** — Open only; decisions on PA-ACR-002.
 * 3. **PII masked by default** via `<PIIMask>`; reveal requires click + reveal-audit POST.
 * 4. Keyboard `X` opens focused case in a new tab (not row-select); `V` reveals PII.
 *
 * Detail deep-link (Agent 3): `/admin/support/account-recovery/:caseId`
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
  Lock,
  Paperclip,
  RefreshCw,
} from 'lucide-react'
import {
  PAQueueFilterStrip,
  PAQueueKeyboardShortcutsPanel,
  PAQueueTable,
  type PAQueueColumn,
  type PAQueueFilterValues,
  type PAQueueKeyboardShortcut,
  type PAQueueRow,
  type PAQueueStatusOption,
  type PAQueueSubmittedWithin,
} from '@/components/queue'
import { EnvBadge } from '@/components/nav/EnvBadge'
import { PIIMask, type PIIMaskKind } from '@/components/security'
import { Button } from '@/components/ui/button'
import { ChannelMark } from '@/components/ui/channel-mark'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Label } from '@/components/ui/label'
import { Numeric } from '@/components/ui/numeric'
import { useToast } from '@/components/ui/toast'
import { useStepUp } from '@/context/StepUpContext'
import { useEnv } from '@/hooks/useEnv'
import { useLocale } from '@/hooks/useLocale'
import { cn } from '@/lib/utils'
import {
  accountRecoveryCsvPath,
  listAccountRecoveryCases,
  revealAccountRecoveryPii,
  type AccountRecoveryCase,
  type AccountValueTier,
  type PreferredChannel,
  type RevealAuditField,
} from '@/api/accountRecovery'

const SEARCH_DEBOUNCE_MS = 200
const DEFAULT_PAGE_SIZE = 25

const STATUS_VALUES = [
  'pending_review',
  'approved',
  'rejected',
  'awaiting_info',
  'completed',
  'expired',
] as const

const TIER_VALUES = ['standard', 'elevated', 'high_value'] as const
const CHANNEL_VALUES = ['email', 'sms', 'whatsapp', 'phone_call'] as const

const ACR_SHORTCUTS: readonly PAQueueKeyboardShortcut[] = [
  { keys: 'J', description: 'Next case' },
  { keys: 'K', description: 'Previous case' },
  { keys: 'Enter / O', description: 'Open focused case' },
  { keys: 'X', description: 'Open focused case in new tab' },
  { keys: 'V', description: 'Reveal PII on focused row (audited)' },
  { keys: '.', description: 'Refresh queue' },
  { keys: '?', description: 'Show keyboard shortcuts' },
  { keys: 'Esc', description: 'Close modal / clear focus' },
]

type RecoveryRow = PAQueueRow & AccountRecoveryCase

function parseWithin(raw: string | null): PAQueueSubmittedWithin {
  if (raw === '24h' || raw === '7d' || raw === '30d' || raw === 'all') return raw
  return '7d'
}

function parseStatus(raw: string | null): string {
  if (raw && (STATUS_VALUES as readonly string[]).includes(raw)) return raw
  return 'pending_review'
}

function parseTier(raw: string | null): AccountValueTier | 'any' {
  if (raw && (TIER_VALUES as readonly string[]).includes(raw)) return raw as AccountValueTier
  return 'any'
}

function parseChannel(raw: string | null): PreferredChannel | 'any' {
  if (raw && (CHANNEL_VALUES as readonly string[]).includes(raw)) return raw as PreferredChannel
  return 'any'
}

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return iso
  const abs = Math.abs(Date.now() - then)
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
    const rounded = Math.round(Math.abs(hoursRemaining) * 10) / 10
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
    case 'awaiting_info':
      return { glyph: '▲', label: 'Awaiting info', token: 'underOffer' }
    case 'completed':
      return { glyph: '✓', label: 'Completed', token: 'published' }
    case 'expired':
      return { glyph: '▢', label: 'Expired', token: 'archived' }
    default:
      return { glyph: '○', label: 'Pending review', token: 'draft' }
  }
}

function tierBadge(tier: string): { glyph: string; label: string; token: string; title?: string } {
  switch (tier) {
    case 'high_value':
      return {
        glyph: '◆',
        label: 'High-value · 2-person',
        token: 'unpublished',
        title: 'Approval requires two-person on PA-ACR-002.',
      }
    case 'elevated':
      return { glyph: '▲', label: 'Elevated', token: 'underOffer' }
    default:
      return { glyph: '○', label: 'Standard', token: 'draft' }
  }
}

function roleLabel(role: string | null | undefined): string {
  switch (role) {
    case 'agency_owner':
    case 'owner':
      return 'Agency owner'
    case 'platform_admin':
    case 'pa':
      return 'PA'
    case 'vendor':
      return 'Vendor'
    default:
      return 'Agent'
  }
}

function planLabel(plan: string | null | undefined): string {
  if (!plan) return ''
  const map: Record<string, string> = {
    semsar: 'Semsar',
    broker: 'Broker',
    enterprise: 'Enterprise',
    trial: 'Trial',
  }
  return map[plan.toLowerCase()] || plan
}

function reasonCategoryLabel(cat: string | null | undefined): string {
  switch (cat) {
    case 'lost_email':
      return 'lost_email'
    case 'lost_phone':
      return 'lost_phone'
    case 'forgotten_username':
      return 'forgotten_username'
    case 'compromised_account':
      return 'compromised_account'
    default:
      return 'other'
  }
}

function truncateReason(reason: string, max = 60): string {
  const t = reason.trim()
  if (t.length <= max) return t
  return `${t.slice(0, max - 1)}…`
}

function channelForMark(channel: string | null | undefined): string {
  if (!channel) return 'email'
  if (channel === 'phone_call') return 'phone'
  return channel
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

function pickPrimaryIdentifier(agent: AccountRecoveryCase['agent'], channel: string | null | undefined): {
  kind: PIIMaskKind
  value: string
  masked: string
  field: RevealAuditField
} | null {
  if (!agent) return null
  const ch = channel || 'email'
  if (ch === 'email' && (agent.email_full || agent.email_masked)) {
    return {
      kind: 'email',
      value: agent.email_full || agent.email_masked || '',
      masked: agent.email_masked || agent.email_full || '',
      field: 'email',
    }
  }
  if (
    (ch === 'sms' || ch === 'whatsapp' || ch === 'phone_call') &&
    (agent.phone_full || agent.phone_masked)
  ) {
    return {
      kind: 'phone',
      value: agent.phone_full || agent.phone_masked || '',
      masked: agent.phone_masked || agent.phone_full || '',
      field: 'phone',
    }
  }
  if (agent.username_full || agent.username_masked) {
    return {
      kind: 'username',
      value: agent.username_full || agent.username_masked || '',
      masked: agent.username_masked || agent.username_full || '',
      field: 'username',
    }
  }
  if (agent.email_full || agent.email_masked) {
    return {
      kind: 'email',
      value: agent.email_full || agent.email_masked || '',
      masked: agent.email_masked || agent.email_full || '',
      field: 'email',
    }
  }
  return null
}

export function AccountRecoveryQueuePage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { addToast } = useToast()
  const { requireElevation } = useStepUp()
  const { env, isTest } = useEnv()
  const { locale } = useLocale()
  const isDesktop = useDesktopMin()

  const filters: PAQueueFilterValues = useMemo(
    () => ({
      status: parseStatus(searchParams.get('status')),
      submittedWithin: parseWithin(searchParams.get('within')),
      // Shared Prep strip always exposes risk-tier; ACR ignores it (tier via customFilters).
      riskTier: 'any',
      search: searchParams.get('q') ?? '',
    }),
    [searchParams],
  )
  const tierFilter = parseTier(searchParams.get('tier'))
  const channelFilter = parseChannel(searchParams.get('channel'))
  const page = Math.max(1, Number(searchParams.get('page') || '1') || 1)
  const pageSize = Math.min(
    100,
    Math.max(1, Number(searchParams.get('pageSize') || String(DEFAULT_PAGE_SIZE)) || DEFAULT_PAGE_SIZE),
  )

  const [rows, setRows] = useState<RecoveryRow[]>([])
  const [counts, setCounts] = useState({
    pending_review: 0,
    pending_at_risk: 0,
    high_value_awaiting_two_person: 0,
    approved_this_week: 0,
    rejected_this_week: 0,
    awaiting_info_this_week: 0,
    completed_this_week: 0,
    expired_this_week: 0,
  })
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [focusedId, setFocusedId] = useState<string | null>(null)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const [searchDraft, setSearchDraft] = useState(filters.search)
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
      const data = await listAccountRecoveryCases({
        status: filters.status,
        tier: tierFilter,
        channel: channelFilter,
        within: filters.submittedWithin,
        q: filters.search,
        page,
        pageSize,
        sort: 'sla_remaining:asc',
      })
      if (gen !== fetchGen.current) return
      const nextRows: RecoveryRow[] = (data.cases || []).map((c) => ({
        ...c,
        isOwn: Boolean(c.is_own),
      }))
      setRows(nextRows)
      setTotal(data.pagination?.total ?? nextRows.length)
      setCounts({
        pending_review: data.counts?.pending_review ?? 0,
        pending_at_risk: data.counts?.pending_at_risk ?? 0,
        high_value_awaiting_two_person: data.counts?.high_value_awaiting_two_person ?? 0,
        approved_this_week: data.counts?.approved_this_week ?? 0,
        rejected_this_week: data.counts?.rejected_this_week ?? 0,
        awaiting_info_this_week: data.counts?.awaiting_info_this_week ?? 0,
        completed_this_week: data.counts?.completed_this_week ?? 0,
        expired_this_week: data.counts?.expired_this_week ?? 0,
      })
      setFocusedId((prev) => {
        if (prev && nextRows.some((r) => r.id === prev)) return prev
        return nextRows[0]?.id ?? null
      })
    } catch (err) {
      if (gen !== fetchGen.current) return
      const status = (err as { status?: number })?.status
      const message =
        status === 403
          ? "You don't have permission to review account recovery cases."
          : err instanceof Error
            ? err.message
            : "Couldn't load recovery cases. Try again."
      setError(message)
      setRows([])
      setTotal(0)
    } finally {
      if (gen === fetchGen.current) setLoading(false)
    }
  }, [
    channelFilter,
    filters.search,
    filters.status,
    filters.submittedWithin,
    page,
    pageSize,
    tierFilter,
  ])

  useEffect(() => {
    void loadQueue()
  }, [loadQueue, env])

  useEffect(() => {
    setSearchDraft(filters.search)
  }, [filters.search])

  useEffect(() => {
    const handle = window.setTimeout(() => {
      if (searchDraft === filters.search) return
      patchParams({ q: searchDraft.trim() || null })
    }, SEARCH_DEBOUNCE_MS)
    return () => window.clearTimeout(handle)
  }, [filters.search, patchParams, searchDraft])

  const statusOptions: PAQueueStatusOption[] = useMemo(
    () => [
      { value: 'pending_review', label: 'Pending review', count: counts.pending_review },
      { value: 'approved', label: 'Approved', count: counts.approved_this_week },
      { value: 'rejected', label: 'Rejected', count: counts.rejected_this_week },
      { value: 'awaiting_info', label: 'Awaiting info', count: counts.awaiting_info_this_week },
      { value: 'completed', label: 'Completed', count: counts.completed_this_week },
      { value: 'expired', label: 'Expired', count: counts.expired_this_week },
    ],
    [counts],
  )

  const detailHref = useCallback((id: string) => {
    const returnTo = encodeURIComponent(`${window.location.pathname}${window.location.search}`)
    return `/admin/support/account-recovery/${encodeURIComponent(id)}?return_to=${returnTo}`
  }, [])

  const openDetail = useCallback(
    (row: RecoveryRow) => {
      if (row.is_own || row.isOwn) {
        addToast({
          variant: 'warning',
          title: "You can't act on this row — you are the applicant.",
        })
        return
      }
      navigate(detailHref(row.id))
    },
    [addToast, detailHref, navigate],
  )

  const openDetailNewTab = useCallback(
    (row: RecoveryRow) => {
      if (row.is_own || row.isOwn) {
        addToast({
          variant: 'warning',
          title: "You can't act on this row — you are the applicant.",
        })
        return
      }
      window.open(detailHref(row.id), '_blank', 'noopener,noreferrer')
    },
    [addToast, detailHref],
  )

  const handleReveal = useCallback(
    async (ctx: { caseId: string; field: string; kind: PIIMaskKind }) => {
      try {
        await revealAccountRecoveryPii(ctx.caseId, ctx.field as RevealAuditField)
      } catch (err) {
        const status = (err as { status?: number })?.status
        addToast({
          variant: 'error',
          title:
            status === 429
              ? 'Reveal rate limit reached — try again later.'
              : "Couldn't record audit — reveal denied.",
        })
        throw err
      }
    },
    [addToast],
  )

  const listQuery = useMemo(
    () => ({
      status: filters.status,
      tier: tierFilter,
      channel: channelFilter,
      within: filters.submittedWithin,
      q: filters.search,
      page,
      pageSize,
    }),
    [channelFilter, filters.search, filters.status, filters.submittedWithin, page, pageSize, tierFilter],
  )

  const exportMasked = () => {
    window.open(accountRecoveryCsvPath(listQuery, { mask: true }), '_blank', 'noopener,noreferrer')
  }

  const exportWithPii = async () => {
    const ok = await requireElevation(
      'Confirm your identity to export account-recovery CSV with PII. Every disclosure is audited.',
    )
    if (!ok) return
    window.open(accountRecoveryCsvPath(listQuery, { mask: false }), '_blank', 'noopener,noreferrer')
  }

  const focusedRow = rows.find((r) => r.id === focusedId) ?? null

  const moveFocus = (delta: number) => {
    if (rows.length === 0) return
    const idx = Math.max(0, rows.findIndex((r) => r.id === focusedId))
    const next = rows[(idx + delta + rows.length) % rows.length]
    setFocusedId(next.id)
    const el = document.querySelector(`[data-row-id="${CSS.escape(next.id)}"]`) as HTMLElement | null
    el?.focus()
  }

  const revealFocusedRow = (allFields: boolean) => {
    if (!focusedId) return
    const rowEl = document.querySelector(`[data-row-id="${CSS.escape(focusedId)}"]`)
    if (!rowEl) return
    const buttons = rowEl.querySelectorAll<HTMLButtonElement>(
      'button[aria-label="Reveal PII (audited)"]',
    )
    if (buttons.length === 0) return
    if (allFields) {
      buttons.forEach((btn) => btn.click())
    } else {
      buttons[0]?.click()
    }
  }

  const onGlobalKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      const tag = target?.tagName?.toLowerCase()
      if (tag === 'input' || tag === 'textarea' || tag === 'select' || target?.isContentEditable) {
        if (e.key === 'Escape') (target as HTMLElement).blur()
        return
      }
      if (shortcutsOpen) {
        if (e.key === 'Escape') setShortcutsOpen(false)
        return
      }

      if (e.key === '?' || (e.shiftKey && e.key === '/')) {
        e.preventDefault()
        setShortcutsOpen(true)
        return
      }
      if (e.key === 'Escape') {
        setFocusedId(null)
        return
      }
      if (e.key === '.') {
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
        if (focusedRow) openDetailNewTab(focusedRow)
        return
      }
      if (e.key === 'v' || e.key === 'V') {
        e.preventDefault()
        revealFocusedRow(e.shiftKey)
        return
      }
      if ((e.key === 'Enter' || e.key === 'o' || e.key === 'O') && focusedRow) {
        e.preventDefault()
        openDetail(focusedRow)
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- handlers close over latest state intentionally
    [focusedRow, loadQueue, openDetail, openDetailNewTab, shortcutsOpen, rows],
  )

  useEffect(() => {
    window.addEventListener('keydown', onGlobalKeyDown)
    return () => window.removeEventListener('keydown', onGlobalKeyDown)
  }, [onGlobalKeyDown])

  const columns: PAQueueColumn<RecoveryRow>[] = useMemo(
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
                title={new Date(row.created_at).toLocaleString()}
              >
                {relativeTime(row.created_at)}
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
        id: 'applicant',
        header: 'Applicant',
        cell: (row) => {
          const agent = row.agent
          const nameFull = agent?.display_name_full || ''
          const nameMasked = agent?.display_name_masked || nameFull || '—'
          const initials = (nameFull || nameMasked || '?')
            .split(/\s+/)
            .map((p) => p[0])
            .join('')
            .slice(0, 2)
            .toUpperCase()
          const ident = pickPrimaryIdentifier(agent, row.preferred_channel)
          const stop = (e: ReactMouseEvent | ReactKeyboardEvent) => e.stopPropagation()
          return (
            <div className="flex items-start gap-2" onClick={stop} onKeyDown={stop}>
              <span
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--lc-surface-sunken)] text-xs font-semibold text-[var(--lc-text-primary)]"
                aria-hidden
              >
                {agent?.avatar_url ? (
                  <img src={agent.avatar_url} alt="" className="h-8 w-8 rounded-full object-cover" />
                ) : (
                  initials
                )}
              </span>
              <div className="min-w-0 space-y-1">
                {nameFull ? (
                  <PIIMask
                    kind="name"
                    value={nameFull}
                    maskedValue={nameMasked}
                    auditContext={{ caseId: row.id, field: 'name' }}
                    onReveal={handleReveal}
                  />
                ) : (
                  <span className="text-[var(--lc-text-muted)]">{nameMasked}</span>
                )}
                {ident ? (
                  <div className="flex flex-wrap items-center gap-1.5">
                    <PIIMask
                      kind={ident.kind}
                      value={ident.value}
                      maskedValue={ident.masked}
                      auditContext={{ caseId: row.id, field: ident.field }}
                      onReveal={handleReveal}
                    />
                    <ChannelMark
                      channel={channelForMark(row.preferred_channel)}
                      className="h-5 w-5"
                      label={String(row.preferred_channel || 'email')}
                    />
                  </div>
                ) : null}
              </div>
            </div>
          )
        },
      },
      {
        id: 'target',
        header: 'Target account',
        cell: (row) => {
          const agency = row.agent?.agency
          return (
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <ToneBadge glyph="●" label={roleLabel(row.agent?.role)} token="draft" />
                {row.agent?.plan_tier ? (
                  <span className="text-[length:var(--lc-type-caption)] text-[var(--lc-text-muted)]">
                    {planLabel(row.agent.plan_tier)}
                  </span>
                ) : null}
              </div>
              {agency?.tenant_url ? (
                <a
                  href={agency.tenant_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="truncate text-[length:var(--lc-type-caption)] text-[var(--lc-text-muted)] underline-offset-2 hover:underline"
                  onClick={(e) => e.stopPropagation()}
                >
                  {agency.name}
                </a>
              ) : (
                <div className="truncate text-[length:var(--lc-type-caption)] text-[var(--lc-text-muted)]">
                  {agency?.name || '—'}
                </div>
              )}
            </div>
          )
        },
      },
      {
        id: 'reason',
        header: 'Reason',
        cell: (row) => (
          <div className="min-w-0 space-y-1">
            <div className="truncate text-sm" title={row.reason}>
              {truncateReason(row.reason || '')}
            </div>
            <ToneBadge
              glyph="○"
              label={reasonCategoryLabel(row.reason_category)}
              token="draft"
            />
          </div>
        ),
      },
      {
        id: 'evidence',
        header: 'Evidence',
        cell: (row) => {
          const count = row.evidence?.file_count ?? 0
          const files = row.evidence?.files || []
          const tip =
            files.length > 0
              ? files
                  .map((f) => `${f.filename}${f.uploaded_at ? ` · ${f.uploaded_at}` : ''}`)
                  .join('\n')
              : 'No evidence uploaded'
          const zero = count === 0
          return (
            <span
              title={tip}
              className={cn(
                'inline-flex items-center gap-1 rounded-[var(--lc-radius-pill)] px-2 py-0.5',
                'text-[length:var(--lc-type-caption)]',
                zero && 'font-semibold',
              )}
              style={
                zero
                  ? {
                      background: 'var(--lc-status-underOffer-bg)',
                      color: 'var(--lc-status-underOffer-fg)',
                    }
                  : {
                      background: 'var(--lc-surface-sunken)',
                      color: 'var(--lc-text-primary)',
                    }
              }
            >
              <Paperclip className="h-3.5 w-3.5" aria-hidden />
              <Numeric>{count}</Numeric> {count === 1 ? 'file' : 'files'}
              {zero ? <span aria-hidden> ⚠</span> : null}
            </span>
          )
        },
      },
      {
        id: 'tier',
        header: 'Account tier',
        cell: (row) => {
          const t = tierBadge(String(row.account_value_tier || 'standard'))
          return <ToneBadge glyph={t.glyph} label={t.label} token={t.token} title={t.title} />
        },
      },
      {
        id: 'state',
        header: 'State',
        cell: (row) => {
          const s = statusGlyphLabel(String(row.status))
          return <ToneBadge glyph={s.glyph} label={s.label} token={s.token} />
        },
      },
      {
        id: 'actions',
        header: 'Actions',
        srOnlyHeader: true,
        cell: (row) => {
          const own = row.is_own || row.isOwn
          const stop = (e: ReactMouseEvent | ReactKeyboardEvent) => e.stopPropagation()
          return (
            <div className="flex flex-wrap items-center gap-1" onClick={stop} onKeyDown={stop}>
              {own ? (
                <span
                  className="text-xs text-[var(--lc-text-muted)]"
                  title="You can't act on this row — you are the applicant."
                >
                  Own case
                </span>
              ) : (
                <Button type="button" size="sm" variant="outline" onClick={() => openDetail(row)}>
                  Open
                </Button>
              )}
            </div>
          )
        },
      },
    ],
    [handleReveal, openDetail],
  )

  const emptyState = (
    <div className="mx-auto flex max-w-md flex-col items-center gap-3 py-4">
      <div
        className="flex h-[200px] w-[200px] items-center justify-center rounded-[var(--lc-radius-lg)] border border-dashed border-[var(--lc-border-strong)] bg-[var(--lc-surface-sunken)] text-sm text-[var(--lc-text-muted)]"
        aria-hidden
      >
        Illustration — empty queue
      </div>
      {filters.status === 'pending_review' && !filters.search ? (
        <>
          <h2 style={{ font: 'var(--lc-type-heading-3)' }} className="text-[var(--lc-text-heading)]">
            No recovery cases awaiting review
          </h2>
          <p className="text-[var(--lc-text-muted)]" style={{ font: 'var(--lc-type-body)' }}>
            When users submit recovery requests via SHR-AUT-005 that the automated challenges
            couldn&apos;t verify, they land here.
          </p>
          <Button
            type="button"
            variant="outline"
            onClick={() => patchParams({ status: 'approved' })}
          >
            Review recent decisions →
          </Button>
        </>
      ) : filters.search ? (
        <>
          <h2 style={{ font: 'var(--lc-type-heading-3)' }} className="text-[var(--lc-text-heading)]">
            No cases match &lsquo;{filters.search}&rsquo;
          </h2>
          <Button type="button" variant="link" onClick={() => patchParams({ q: null })}>
            Clear search
          </Button>
        </>
      ) : (
        <>
          <h2 style={{ font: 'var(--lc-type-heading-3)' }} className="text-[var(--lc-text-heading)]">
            No {filters.status.replace(/_/g, ' ')} cases in this range
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
          PA console requires a larger screen
        </h1>
        <p className="text-[var(--lc-text-muted)]">
          Account recovery review needs 1024px or wider. Open this page on a larger display.
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
      data-testid="account-recovery-queue"
      data-env={env}
    >
      {/* Hide Shared Prep risk-tier control — ACR uses Account tier custom filter instead. */}
      <style>{`
        [data-testid="account-recovery-queue"] label[for="pa-queue-risk"],
        [data-testid="account-recovery-queue"] #pa-queue-risk { display: none !important; }
      `}</style>

      <a
        href="#pa-acr-queue-table"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:rounded-[var(--lc-radius-md)] focus:bg-[var(--lc-surface-raised)] focus:px-3 focus:py-2"
      >
        Skip to recovery cases table
      </a>

      <header className="mb-[var(--lc-space-md)] flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1
            style={{ font: 'var(--lc-type-heading-1)' }}
            className="text-[var(--lc-text-heading)]"
          >
            Account recovery queue
          </h1>
          <p
            className="mt-1 text-[var(--lc-text-muted)]"
            style={{ font: 'var(--lc-type-body-sm)' }}
          >
            <Numeric>{counts.pending_review}</Numeric> pending review ·{' '}
            <Numeric>{counts.pending_at_risk}</Numeric> at-risk (breach in{' '}
            <Numeric>2</Numeric>h) ·{' '}
            <Numeric>{counts.high_value_awaiting_two_person}</Numeric> high-value awaiting
            2-person · <Numeric>{counts.approved_this_week}</Numeric> approved ·{' '}
            <Numeric>{counts.rejected_this_week}</Numeric> rejected this week
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Refresh recovery queue"
            onClick={() => void loadQueue()}
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="ghost" aria-label="Export CSV">
                <Download className="me-2 h-4 w-4" aria-hidden />
                Export CSV
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => exportMasked()}>
                Export CSV (masked)
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => {
                  void exportWithPii()
                }}
                aria-describedby="acr-export-pii-desc"
              >
                <Lock className="me-2 h-3.5 w-3.5" aria-hidden />
                Export CSV (with PII) — requires step-up
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <span id="acr-export-pii-desc" className="sr-only">
            This export includes personally identifiable information. Every disclosure is audited.
          </span>
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
          data-testid="pa-acr-test-warning"
        >
          TEST ENVIRONMENT — approvals here issue TEST recovery tokens only.
        </div>
      ) : null}

      <PAQueueFilterStrip
        aria-label="Filter recovery cases"
        envBadge={<EnvBadge env={env} locale={locale} />}
        statusOptions={statusOptions}
        values={{ ...filters, search: searchDraft }}
        disabled={loading}
        onChange={(next) => {
          setSearchDraft(next.search)
          patchParams({
            status: next.status,
            within: next.submittedWithin,
            q: next.search.trim() || null,
          })
        }}
        customFilters={
          <>
            <div className="flex min-w-[9rem] flex-col gap-1">
              <Label htmlFor="pa-acr-tier">Account tier</Label>
              <select
                id="pa-acr-tier"
                className={selectClassName}
                value={tierFilter}
                disabled={loading}
                onChange={(e) => patchParams({ tier: e.target.value || null })}
              >
                <option value="any">Any tier</option>
                <option value="standard">Standard</option>
                <option value="elevated">Elevated</option>
                <option value="high_value">High-value</option>
              </select>
            </div>
            <div className="flex min-w-[10rem] flex-col gap-1">
              <Label htmlFor="pa-acr-channel">Preferred channel</Label>
              <select
                id="pa-acr-channel"
                className={selectClassName}
                value={channelFilter}
                disabled={loading}
                onChange={(e) => patchParams({ channel: e.target.value || null })}
              >
                <option value="any">Any channel</option>
                <option value="email">Email</option>
                <option value="sms">SMS</option>
                <option value="whatsapp">WhatsApp</option>
                <option value="phone_call">Phone call</option>
              </select>
            </div>
          </>
        }
      />

      {/*
        WF-04 deviation #1: showBulk={false} — PAQueueBulkBar intentionally omitted.
        Bulk approve on account recovery is unsafe (PII + evidence-per-case discipline).
        See PA-ACR-001 brief §Design goals / PA family-pattern deviation #1.
      */}

      {error ? (
        <div
          role="alert"
          className="mb-[var(--lc-space-sm)] mt-[var(--lc-space-sm)] flex flex-wrap items-center justify-between gap-3 rounded-[var(--lc-radius-md)] border border-[var(--lc-border)] px-4 py-3"
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

      <div id="pa-acr-queue-table" className="mt-[var(--lc-space-sm)]">
        <PAQueueTable<RecoveryRow>
          aria-label="Account recovery cases"
          columns={columns}
          rows={rows}
          // WF-04: no row-select / bulk — selectable={false} ≡ showBulk={false}
          selectable={false}
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
            onChange={(e) =>
              patchParams({ pageSize: e.target.value, page: '1' }, { resetPage: false })
            }
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

      <PAQueueKeyboardShortcutsPanel
        open={shortcutsOpen}
        onOpenChange={setShortcutsOpen}
        shortcuts={[...ACR_SHORTCUTS]}
      />
    </div>
  )
}

export default AccountRecoveryQueuePage
