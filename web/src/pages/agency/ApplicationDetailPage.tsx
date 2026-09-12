/**
 * AGN-MEM-002b — Application detail (WF-02 approver-side).
 *
 * Approve/reject call existing backend endpoints. On success the agency admin
 * returns to the queue; the applicant outcome surface (AGT-REC-004 / Agent 4)
 * is deep-linked at `/applications/:applicationId`.
 */

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  AlertOctagon,
  AlertTriangle,
  ArrowLeft,
  Check,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Eye,
  EyeOff,
  HelpCircle,
  Info,
  Loader2,
  MessageSquare,
  Monitor,
  X,
} from 'lucide-react'
import { api } from '@/api/client'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/components/ui/toast'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Card, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Numeric } from '@/components/ui/numeric'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  PAQueueKeyboardShortcutsPanel,
  type PAQueueKeyboardShortcut,
} from '@/components/queue'
import { usePageTitle } from '@/lib/usePageTitle'
import { cn } from '@/lib/utils'
import {
  APPLICATIONS_QUEUE_PATH,
  applicationOutcomePath,
  applicationStatusLabel,
  applicationStatusToLc,
  filterApplications,
  formatRelativeApplied,
  initials,
  normalizeApplication,
  type AgencyApplicationRaw,
  type ApplicationRow,
  type ApplicationStatus,
  type ApplicationWithin,
} from './applicationsTypes'

const DETAIL_SHORTCUTS: PAQueueKeyboardShortcut[] = [
  { keys: 'J', description: 'Next pending application' },
  { keys: 'K', description: 'Previous pending application' },
  { keys: 'A', description: 'Open approve confirmation' },
  { keys: 'R', description: 'Open reject dialog' },
  { keys: 'Esc', description: 'Close modal / return to queue' },
  { keys: '?', description: 'Show keyboard shortcuts' },
]

type RiskSeverity = 'info' | 'warning' | 'danger'

interface RiskSignal {
  code: string
  severity: RiskSeverity
  label: string
  detail: string
  learn_more_url?: string | null
}

interface PriorApplication {
  id: string
  applied_at: string
  status: ApplicationStatus
  decided_at: string | null
  reason_masked: string | null
  agency_name_masked: string
}

function parseStatus(raw: string | null): ApplicationStatus {
  if (raw === 'approved' || raw === 'rejected' || raw === 'expired' || raw === 'pending') return raw
  return 'pending'
}

function parseWithin(raw: string | null): ApplicationWithin {
  if (raw === '7d' || raw === '30d' || raw === '90d' || raw === 'all') return raw
  return '30d'
}

function useIsMobile(): boolean {
  const [mobile, setMobile] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia('(max-width: 767px)').matches : false,
  )
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)')
    const onChange = () => setMobile(mq.matches)
    onChange()
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return mobile
}

function useIsTablet(): boolean {
  const [tablet, setTablet] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia('(max-width: 1023px)').matches : false,
  )
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 1023px)')
    const onChange = () => setTablet(mq.matches)
    onChange()
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return tablet
}

function queueHref(searchParams: URLSearchParams): string {
  const qs = searchParams.toString()
  return qs ? `${APPLICATIONS_QUEUE_PATH}?${qs}` : APPLICATIONS_QUEUE_PATH
}

export function ApplicationDetailPage() {
  const { applicationId = '' } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { agent, loading: authLoading } = useAuth()
  const { addToast } = useToast()
  const isMobile = useIsMobile()
  const isTablet = useIsTablet()

  const [agencyId, setAgencyId] = useState<string | null>(null)
  const [isOwner, setIsOwner] = useState(false)
  const [allRows, setAllRows] = useState<ApplicationRow[]>([])
  const [row, setRow] = useState<ApplicationRow | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [forbidden, setForbidden] = useState(false)
  const [contactRevealed, setContactRevealed] = useState(false)
  const [revealBusy, setRevealBusy] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [riskSignals] = useState<RiskSignal[]>([]) // backend has no risk pipeline yet — always hide
  const [role, setRole] = useState<'agent' | 'admin'>('agent')
  const [affiliationMode, setAffiliationMode] = useState<'non_exclusive' | 'exclusive'>('non_exclusive')
  const [approveOpen, setApproveOpen] = useState(false)
  const [rejectOpen, setRejectOpen] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const [navLive, setNavLive] = useState('')
  const decisionRef = useRef<HTMLDivElement | null>(null)
  const rejectReasonRef = useRef<HTMLTextAreaElement>(null)
  const approveCancelRef = useRef<HTMLButtonElement>(null)
  const decisionLabelId = useId()

  const statusFilter = parseStatus(searchParams.get('status'))
  const withinFilter = parseWithin(searchParams.get('within'))
  const qFilter = searchParams.get('q') || ''

  usePageTitle(row?.applicant.display_name || 'Application')

  const load = useCallback(async () => {
    if (!agent || !applicationId) return
    setLoading(true)
    setError(null)
    setNotFound(false)
    setForbidden(false)
    setContactRevealed(false)
    setHistoryOpen(false)
    try {
      const agency = await api.getMyAgency()
      if (!agency?.id) {
        setForbidden(true)
        return
      }
      setAgencyId(agency.id)
      const affiliationRole = (agent as { affiliation?: { role?: string } } | null)?.affiliation
        ?.role
      const myRole = String(agency.my_role || agency.role || affiliationRole || '').toLowerCase()
      setIsOwner(myRole === 'owner')

      const raw = (await api.listAgencyApplications(agency.id)) as AgencyApplicationRaw[]
      const list = Array.isArray(raw) ? raw.map(normalizeApplication) : []
      setAllRows(list)
      const found = list.find((r) => r.id === applicationId) || null
      if (!found) {
        setNotFound(true)
        setRow(null)
        return
      }
      setRow(found)
    } catch (err: unknown) {
      const e = err as { status?: number; message?: string }
      if (e?.status === 401) {
        navigate(
          `/login?returnTo=${encodeURIComponent(`${APPLICATIONS_QUEUE_PATH}/${applicationId}`)}`,
        )
        return
      }
      if (e?.status === 403) {
        setForbidden(true)
        return
      }
      if (e?.status === 404) {
        setNotFound(true)
        return
      }
      setError(e?.message || "Couldn't load this application.")
    } finally {
      setLoading(false)
    }
  }, [agent?.id, applicationId, navigate])

  useEffect(() => {
    if (authLoading) return
    if (!agent) {
      navigate(
        `/login?returnTo=${encodeURIComponent(`${APPLICATIONS_QUEUE_PATH}/${applicationId}`)}`,
      )
      return
    }
    void load()
  }, [agent?.id, authLoading, load, navigate, applicationId])

  const pendingQueue = useMemo(() => {
    return filterApplications(allRows, {
      status: 'pending',
      within: withinFilter,
      q: qFilter,
    }).sort((a, b) => new Date(b.applied_at).getTime() - new Date(a.applied_at).getTime())
  }, [allRows, withinFilter, qFilter])

  const queueIndex = row ? pendingQueue.findIndex((r) => r.id === row.id) : -1
  const queuePosition = queueIndex >= 0 ? queueIndex + 1 : null
  const queueTotal = pendingQueue.length
  const prevId =
    queueIndex > 0 ? pendingQueue[queueIndex - 1]?.id ?? null : queueIndex === -1 ? null : null
  const nextId =
    queueIndex >= 0 && queueIndex < pendingQueue.length - 1
      ? pendingQueue[queueIndex + 1]?.id ?? null
      : null

  // For non-pending rows, still allow sibling nav across the filtered status list
  const filteredSiblings = useMemo(() => {
    return filterApplications(allRows, {
      status: statusFilter,
      within: withinFilter,
      q: qFilter,
    }).sort((a, b) => new Date(b.applied_at).getTime() - new Date(a.applied_at).getTime())
  }, [allRows, statusFilter, withinFilter, qFilter])

  const siblingIndex = row ? filteredSiblings.findIndex((r) => r.id === row.id) : -1
  const siblingPrev =
    siblingIndex > 0 ? filteredSiblings[siblingIndex - 1]?.id ?? null : prevId
  const siblingNext =
    siblingIndex >= 0 && siblingIndex < filteredSiblings.length - 1
      ? filteredSiblings[siblingIndex + 1]?.id ?? null
      : nextId

  const goSibling = useCallback(
    (id: string | null) => {
      if (!id) return
      const qs = searchParams.toString()
      navigate(`${APPLICATIONS_QUEUE_PATH}/${id}${qs ? `?${qs}` : ''}`)
    },
    [navigate, searchParams],
  )

  /** No dedicated history endpoint yet — derive same-email priors from list. */
  const history: PriorApplication[] = useMemo(() => {
    if (!row?.applicant.email) return []
    return allRows
      .filter(
        (r) =>
          r.id !== row.id &&
          r.applicant.email &&
          r.applicant.email.toLowerCase() === row.applicant.email!.toLowerCase(),
      )
      .map((r) => ({
        id: r.id,
        applied_at: r.applied_at,
        status: r.status,
        decided_at: r.decision?.decided_at || null,
        reason_masked: r.decision?.reason || null,
        agency_name_masked: 'Another agency',
      }))
  }, [row, allRows])

  useEffect(() => {
    if (role === 'admin') setAffiliationMode('exclusive')
  }, [role])

  const navTimerRef = useRef<number | null>(null)
  useEffect(() => {
    return () => {
      if (navTimerRef.current) window.clearTimeout(navTimerRef.current)
    }
  }, [])

  const scheduleReturnToQueue = useCallback(() => {
    setNavLive('Returning to Applications queue in 1 second')
    if (navTimerRef.current) window.clearTimeout(navTimerRef.current)
    navTimerRef.current = window.setTimeout(() => {
      navigate(queueHref(searchParams))
    }, 1500)
  }, [navigate, searchParams])

  const doApprove = useCallback(async () => {
    if (!agencyId || !row) return
    setBusy(true)
    try {
      const effectiveAffiliation = role === 'admin' ? 'exclusive' : affiliationMode
      await api.approveAgencyApplication(agencyId, row.id, {
        role,
        affiliation_mode: effectiveAffiliation,
      })
      setRow({
        ...row,
        status: 'approved',
        decision: {
          decided_at: new Date().toISOString(),
          decided_by: agent?.id || null,
          role_assigned: role,
          reason: null,
        },
      })
      setApproveOpen(false)
      addToast({
        title: `Approved ${row.applicant.display_name}. Membership created.`,
        description: `Applicant can view outcome at ${applicationOutcomePath(row.id)}`,
        variant: 'success',
      })
      scheduleReturnToQueue()
    } catch (err: unknown) {
      const e = err as { message?: string }
      addToast({
        title: 'Something went wrong. Try again.',
        description: e?.message,
        variant: 'error',
      })
    } finally {
      setBusy(false)
    }
  }, [agencyId, row, role, affiliationMode, agent?.id, addToast, scheduleReturnToQueue])

  const doReject = useCallback(async () => {
    if (!agencyId || !row) return
    const reason = rejectReason.trim()
    if (reason.length < 20) return
    setBusy(true)
    try {
      await api.rejectAgencyApplication(agencyId, row.id, { reason })
      setRow({
        ...row,
        status: 'rejected',
        decision: {
          decided_at: new Date().toISOString(),
          decided_by: agent?.id || null,
          role_assigned: null,
          reason,
        },
      })
      setRejectOpen(false)
      setRejectReason('')
      addToast({
        title: `Rejected ${row.applicant.display_name}. Applicant notified.`,
        description: `Applicant can view outcome at ${applicationOutcomePath(row.id)}`,
        variant: 'success',
      })
      scheduleReturnToQueue()
    } catch (err: unknown) {
      const e = err as { message?: string }
      addToast({
        title: 'Something went wrong. Try again.',
        description: e?.message,
        variant: 'error',
      })
    } finally {
      setBusy(false)
    }
  }, [agencyId, row, rejectReason, agent?.id, addToast, scheduleReturnToQueue])

  useEffect(() => {
    if (approveOpen) {
      const t = window.setTimeout(() => approveCancelRef.current?.focus(), 50)
      return () => window.clearTimeout(t)
    }
  }, [approveOpen])

  useEffect(() => {
    if (rejectOpen) {
      const t = window.setTimeout(() => rejectReasonRef.current?.focus(), 50)
      return () => window.clearTimeout(t)
    }
  }, [rejectOpen])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      const tag = target?.tagName?.toLowerCase()
      if (tag === 'input' || tag === 'textarea' || tag === 'select' || target?.isContentEditable) {
        return
      }
      if (e.key === '?' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault()
        setShortcutsOpen(true)
        return
      }
      if (e.key === 'Escape') {
        if (shortcutsOpen) {
          setShortcutsOpen(false)
          return
        }
        if (approveOpen) {
          setApproveOpen(false)
          return
        }
        if (rejectOpen) {
          setRejectOpen(false)
          return
        }
        navigate(queueHref(searchParams))
        return
      }
      if (shortcutsOpen || approveOpen || rejectOpen) return
      if (e.key === 'j' || e.key === 'J') {
        e.preventDefault()
        goSibling(siblingNext)
        return
      }
      if (e.key === 'k' || e.key === 'K') {
        e.preventDefault()
        goSibling(siblingPrev)
        return
      }
      if ((e.key === 'a' || e.key === 'A') && row?.status === 'pending') {
        e.preventDefault()
        setApproveOpen(true)
        return
      }
      if ((e.key === 'r' || e.key === 'R') && row?.status === 'pending') {
        e.preventDefault()
        setRejectOpen(true)
        setRejectReason('')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [
    shortcutsOpen,
    approveOpen,
    rejectOpen,
    navigate,
    searchParams,
    goSibling,
    siblingNext,
    siblingPrev,
    row?.status,
  ])

  if (isMobile) {
    return (
      <div
        className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-[var(--lc-space-xl)] text-center"
        data-testid="application-detail-mobile-gate"
      >
        <Monitor className="h-10 w-10 text-[var(--lc-text-muted)]" aria-hidden />
        <h1 style={{ font: 'var(--lc-type-heading-2)' }} className="text-[var(--lc-text-heading)]">
          Agency console requires a larger screen
        </h1>
        <Button asChild variant="outline">
          <Link to="/agency">Back to agency home</Link>
        </Button>
      </div>
    )
  }

  if (forbidden) {
    return (
      <div className="mx-auto max-w-[1440px] px-[var(--lc-space-2xl)] py-[var(--lc-space-3xl)]">
        <h1 style={{ font: 'var(--lc-type-heading-1)' }}>
          You need agency-management access to view this page.
        </h1>
        <Button asChild className="mt-4" variant="outline">
          <Link to="/agency">Go to agency home</Link>
        </Button>
      </div>
    )
  }

  if (notFound && !loading) {
    return (
      <div
        className="mx-auto max-w-[1440px] px-[var(--lc-space-2xl)] py-[var(--lc-space-3xl)]"
        data-testid="application-detail-not-found"
      >
        <h1 style={{ font: 'var(--lc-type-heading-1)' }}>Application not found. It may have been deleted.</h1>
        <Button asChild className="mt-4" variant="link">
          <Link to={queueHref(searchParams)}>← Back to Applications</Link>
        </Button>
      </div>
    )
  }

  if (error && !loading) {
    return (
      <div className="mx-auto max-w-[1440px] px-[var(--lc-space-2xl)] py-[var(--lc-space-3xl)]">
        <h1 style={{ font: 'var(--lc-type-heading-1)' }}>{error}</h1>
        <Button type="button" className="mt-4" onClick={() => void load()}>
          Retry
        </Button>
      </div>
    )
  }

  const name = row?.applicant.display_name || '…'
  const secondaryBits = [
    row?.applicant.city,
    row?.applicant.years_experience != null
      ? `${row.applicant.years_experience} years experience`
      : null,
    row?.applicant.listings_count != null ? (
      <span key="listings">
        <Numeric>{row.applicant.listings_count}</Numeric> listings
      </span>
    ) : null,
  ].filter(Boolean)

  const decidedPanel =
    row && row.status !== 'pending' ? (
      <div className="space-y-3">
        <Badge
          status={applicationStatusToLc(row.status)}
          className="text-[length:1rem]"
          style={{ font: 'var(--lc-type-heading-3)' }}
        >
          {applicationStatusLabel(row.status)}
        </Badge>
        {row.status === 'expired' ? (
          <p style={{ font: 'var(--lc-type-body-sm)' }} className="text-[var(--lc-text-muted)]">
            This application expired on{' '}
            <Numeric>
              {row.expires_at
                ? new Date(row.expires_at).toLocaleDateString(undefined, {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })
                : '—'}
            </Numeric>{' '}
            after 30 days without a decision. Applicants can reapply.
          </p>
        ) : (
          <p style={{ font: 'var(--lc-type-body-sm)' }} className="text-[var(--lc-text-muted)]">
            {row.status === 'approved' ? 'Approved' : 'Rejected'}
            {row.decision?.decided_by ? ` by ${row.decision.decided_by}` : ''}
            {row.decision?.decided_at ? (
              <>
                {' '}
                on{' '}
                <Numeric>
                  {new Date(row.decision.decided_at).toLocaleDateString(undefined, {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                </Numeric>
              </>
            ) : null}
          </p>
        )}
        {row.status === 'rejected' && row.decision?.reason ? (
          <blockquote className="border-s-[3px] border-[var(--lc-border-strong)] bg-[var(--lc-surface-sunken)] p-[var(--lc-space-md)] italic">
            <p style={{ font: 'var(--lc-type-overline)' }} className="mb-1 not-italic text-[var(--lc-text-muted)]">
              Reason given
            </p>
            {row.decision.reason}
          </blockquote>
        ) : null}
        <p style={{ font: 'var(--lc-type-caption)' }} className="text-[var(--lc-text-muted)]">
          Applicant outcome:{' '}
          <Link className="text-[var(--lc-text-brand)] underline" to={applicationOutcomePath(row.id)}>
            {applicationOutcomePath(row.id)}
          </Link>
        </p>
      </div>
    ) : null

  return (
    <div
      className="min-h-full bg-[var(--lc-bg-page)]"
      data-testid="application-detail-page"
      data-screen="AGN-MEM-002b"
    >
      <div className="sr-only" aria-live="polite">
        {navLive}
      </div>

      <div className="sticky top-14 z-10 border-b border-[var(--lc-border)] bg-[var(--lc-bg-page)]">
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-3 px-[var(--lc-space-2xl)] py-[var(--lc-space-sm)]">
          <div className="flex min-w-0 items-center gap-2">
            <Button asChild variant="ghost" size="icon" aria-label="Back to Applications">
              <Link to={queueHref(searchParams)}>
                <ArrowLeft className="h-5 w-5" aria-hidden />
              </Link>
            </Button>
            <nav aria-label="Breadcrumb" className="truncate" style={{ font: 'var(--lc-type-body)' }}>
              <Link to={queueHref(searchParams)} className="text-[var(--lc-text-brand)]">
                Applications
              </Link>
              <span className="mx-1 text-[var(--lc-text-muted)]">/</span>
              <span className="text-[var(--lc-text-primary)]">{name}</span>
            </nav>
          </div>

          {isTablet ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => decisionRef.current?.scrollIntoView({ behavior: 'smooth' })}
            >
              Jump to decision
            </Button>
          ) : queuePosition != null && row?.status === 'pending' ? (
            <Badge
              className="border border-[var(--lc-accent-bold-edge)] bg-[var(--lc-accent)] text-[var(--lc-accent-bold-text)]"
              variant="outline"
            >
              Application <Numeric>{queuePosition}</Numeric> of <Numeric>{queueTotal}</Numeric> pending
            </Badge>
          ) : (
            <span />
          )}

          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={
                siblingPrev
                  ? `Previous application`
                  : 'Previous application'
              }
              disabled={!siblingPrev}
              aria-disabled={!siblingPrev}
              onClick={() => goSibling(siblingPrev)}
            >
              <ChevronLeft className="h-5 w-5" aria-hidden />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Next application"
              disabled={!siblingNext}
              aria-disabled={!siblingNext}
              onClick={() => goSibling(siblingNext)}
            >
              <ChevronRight className="h-5 w-5" aria-hidden />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Show keyboard shortcuts"
              onClick={() => setShortcutsOpen(true)}
            >
              <HelpCircle className="h-5 w-5" aria-hidden />
            </Button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[1440px] px-[var(--lc-space-2xl)] py-[var(--lc-space-xl)]">
        {loading || !row ? (
          <div className="grid gap-[var(--lc-space-2xl)] lg:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]" aria-busy>
            <div className="space-y-4">
              <div className="h-24 animate-pulse rounded-[var(--lc-radius-lg)] bg-[var(--lc-surface-sunken)] motion-reduce:animate-none" />
              <div className="h-48 animate-pulse rounded-[var(--lc-radius-lg)] bg-[var(--lc-surface-sunken)] motion-reduce:animate-none" />
            </div>
            <div className="h-64 animate-pulse rounded-[var(--lc-radius-lg)] bg-[var(--lc-surface-sunken)] motion-reduce:animate-none" />
            <span className="sr-only">Loading application…</span>
          </div>
        ) : (
          <div
            className={cn(
              'grid gap-[var(--lc-space-2xl)]',
              !isTablet && 'grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]',
            )}
          >
            <div className="min-w-0 space-y-[var(--lc-space-xl)]">
              {/* Profile */}
              <section className="flex gap-[var(--lc-space-lg)]">
                <Avatar className="h-24 w-24 shrink-0 rounded-[var(--lc-radius-pill)]">
                  {row.applicant.avatar_url ? (
                    <AvatarImage src={row.applicant.avatar_url} alt="" />
                  ) : null}
                  <AvatarFallback className="rounded-[var(--lc-radius-pill)] text-xl">
                    {initials(row.applicant.display_name)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <h1
                    style={{ font: 'var(--lc-type-heading-1)' }}
                    className="text-[var(--lc-text-heading)]"
                  >
                    {row.applicant.display_name}
                  </h1>
                  <p
                    style={{ font: 'var(--lc-type-body-sm)' }}
                    className="mt-1 text-[var(--lc-text-muted)]"
                  >
                    {secondaryBits.length
                      ? secondaryBits.map((bit, i) => (
                          <span key={i}>
                            {i > 0 ? ' · ' : null}
                            {bit}
                          </span>
                        ))
                      : '—'}
                  </p>

                  <div className="mt-3 flex flex-wrap items-center gap-2" style={{ font: 'var(--lc-type-body-sm)' }}>
                    <span className="text-[var(--lc-text-secondary)]">
                      {contactRevealed
                        ? `${row.applicant.email || '—'} · ${row.applicant.phone || '—'}`
                        : `${row.applicant.email_masked} · ${row.applicant.phone_masked}`}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={revealBusy}
                      onClick={() => {
                        void (async () => {
                          if (contactRevealed) {
                            setContactRevealed(false)
                            return
                          }
                          if (!agencyId || !row) return
                          setRevealBusy(true)
                          try {
                            await api.revealAgencyApplicationContact(agencyId, row.id, {
                              field: 'contact',
                            })
                            setContactRevealed(true)
                          } catch (err: unknown) {
                            const e = err as { message?: string }
                            addToast({
                              title: "Couldn't reveal contact. Try again.",
                              description: e?.message,
                              variant: 'error',
                            })
                          } finally {
                            setRevealBusy(false)
                          }
                        })()
                      }}
                    >
                      {contactRevealed ? (
                        <>
                          <EyeOff className="me-1 h-4 w-4" aria-hidden />
                          Hide contact
                        </>
                      ) : (
                        <>
                          <Eye className="me-1 h-4 w-4" aria-hidden />
                          Show contact
                        </>
                      )}
                    </Button>
                  </div>

                  {row.applicant.portfolio_url ? (
                    <p className="mt-2">
                      <a
                        href={row.applicant.portfolio_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[var(--lc-text-brand)] underline-offset-2 hover:underline"
                        aria-label="External portfolio, opens in new tab"
                        title="Opens in a new tab. WingCaster does not verify external portfolios."
                      >
                        <Numeric>
                          {row.applicant.portfolio_url.replace(/^https?:\/\//, '')}
                        </Numeric>
                        <ExternalLink className="h-4 w-4" aria-hidden />
                      </a>
                    </p>
                  ) : null}

                  <p
                    style={{ font: 'var(--lc-type-body-sm)' }}
                    className="mt-2 text-[var(--lc-text-muted)]"
                  >
                    Applied <Numeric>{formatRelativeApplied(row.applied_at)}</Numeric>
                    {queuePosition != null && row.status === 'pending' ? (
                      <>
                        {' '}
                        · Queue position <Numeric>{queuePosition}</Numeric> of{' '}
                        <Numeric>{queueTotal}</Numeric>
                      </>
                    ) : null}
                  </p>
                </div>
              </section>

              {/* Message */}
              <section>
                <p
                  style={{ font: 'var(--lc-type-overline)', letterSpacing: 'var(--lc-tracking-overline)' }}
                  className="mb-2 text-[var(--lc-text-muted)]"
                >
                  MESSAGE FROM APPLICANT
                </p>
                <Card className="rounded-[var(--lc-radius-lg)] shadow-[var(--lc-elevation-sm)]">
                  <CardContent className="p-[var(--lc-space-xl)]">
                    <p
                      style={{ font: 'var(--lc-type-body-lg)' }}
                      className="whitespace-pre-line text-[var(--lc-text-primary)]"
                    >
                      {row.message || '—'}
                    </p>
                  </CardContent>
                </Card>
              </section>

              {/* Risk signals — only when non-empty */}
              {riskSignals.length > 0 ? (
                <section>
                  <p
                    style={{ font: 'var(--lc-type-overline)', letterSpacing: 'var(--lc-tracking-overline)' }}
                    className="mb-2 text-[var(--lc-text-muted)]"
                  >
                    SIGNALS TO REVIEW
                  </p>
                  <ul className="space-y-2">
                    {riskSignals.map((signal) => {
                      const Icon =
                        signal.severity === 'danger'
                          ? AlertOctagon
                          : signal.severity === 'warning'
                            ? AlertTriangle
                            : Info
                      const statusToken =
                        signal.severity === 'danger'
                          ? 'unpublished'
                          : signal.severity === 'warning'
                            ? 'underOffer'
                            : 'draft'
                      return (
                        <li
                          key={signal.code}
                          role="status"
                          className="flex gap-3 rounded-[var(--lc-radius-md)] border border-[var(--lc-border)] bg-[var(--lc-surface-raised)] p-[var(--lc-space-md)]"
                        >
                          <Badge status={statusToken}>{signal.label}</Badge>
                          <div className="min-w-0 flex-1">
                            <div className="mb-1 flex items-center gap-2">
                              <Icon className="h-4 w-4 shrink-0" aria-hidden />
                              <span style={{ font: 'var(--lc-type-body)' }}>{signal.label}</span>
                            </div>
                            <p style={{ font: 'var(--lc-type-body-sm)' }} className="text-[var(--lc-text-muted)]">
                              {signal.detail}
                            </p>
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                </section>
              ) : null}

              {/* History — hidden entirely on first application */}
              {history.length > 0 ? (
                <section>
                  <p
                    style={{ font: 'var(--lc-type-overline)', letterSpacing: 'var(--lc-tracking-overline)' }}
                    className="mb-2 text-[var(--lc-text-muted)]"
                  >
                    APPLICATION HISTORY
                  </p>
                  <div className="rounded-[var(--lc-radius-md)] border border-[var(--lc-border)] bg-[var(--lc-surface-raised)]">
                    <button
                      type="button"
                      className="flex min-h-tap w-full items-center justify-between gap-2 px-[var(--lc-space-md)] py-[var(--lc-space-sm)] text-start"
                      aria-expanded={historyOpen}
                      onClick={() => setHistoryOpen((v) => !v)}
                    >
                      <span style={{ font: 'var(--lc-type-body-sm)' }}>
                        {history.length === 1 ? (
                          'This applicant has applied 1 time before.'
                        ) : (
                          <>
                            This applicant has applied <Numeric>{history.length}</Numeric> times
                            before.
                          </>
                        )}
                      </span>
                      <span aria-hidden>{historyOpen ? '▴' : '▾'}</span>
                    </button>
                    {historyOpen ? (
                      <ul className="space-y-2 border-t border-[var(--lc-border)] p-[var(--lc-space-md)]">
                        {history.map((prior) => (
                          <li
                            key={prior.id}
                            className="rounded-[var(--lc-radius-md)] bg-[var(--lc-surface-sunken)] p-[var(--lc-space-sm)]"
                            style={{ font: 'var(--lc-type-body-sm)' }}
                          >
                            {applicationStatusLabel(prior.status)} on{' '}
                            <Numeric>
                              {new Date(prior.decided_at || prior.applied_at).toLocaleDateString()}
                            </Numeric>
                            {prior.reason_masked ? ` · ${prior.reason_masked}` : null}
                            <span className="text-[var(--lc-text-muted)]">
                              {' '}
                              · {prior.agency_name_masked}
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                </section>
              ) : null}
            </div>

            {/* Decision panel */}
            <div
              ref={decisionRef}
              role="complementary"
              aria-labelledby={decisionLabelId}
              className={cn(
                'rounded-[var(--lc-radius-lg)] border border-[var(--lc-border)] bg-[var(--lc-surface-raised)] p-[var(--lc-space-lg)] shadow-[var(--lc-elevation-sm)]',
                !isTablet && 'sticky top-[calc(3.5rem+var(--lc-space-xl))] self-start',
              )}
            >
              <p
                id={decisionLabelId}
                style={{ font: 'var(--lc-type-overline)', letterSpacing: 'var(--lc-tracking-overline)' }}
                className="mb-3 text-[var(--lc-text-muted)]"
              >
                DECISION
              </p>

              {row.status === 'pending' ? (
                <div className="space-y-3">
                  <div>
                    <Label htmlFor="assign-role">Assign as</Label>
                    <select
                      id="assign-role"
                      className="mt-1 min-h-tap w-full rounded-[var(--lc-radius-md)] border border-[var(--lc-border-strong)] bg-[var(--lc-surface)] px-3"
                      value={role}
                      onChange={(e) => setRole(e.target.value as 'agent' | 'admin')}
                    >
                      <option value="agent">Agent</option>
                      {isOwner ? <option value="admin">Admin</option> : null}
                    </select>
                    <p className="mt-1 text-xs text-[var(--lc-text-muted)]">
                      Role can be changed later from the member&apos;s profile.
                    </p>
                  </div>

                  {role === 'agent' ? (
                    <div>
                      <Label htmlFor="affiliation-mode">Affiliation</Label>
                      <select
                        id="affiliation-mode"
                        className="mt-1 min-h-tap w-full rounded-[var(--lc-radius-md)] border border-[var(--lc-border-strong)] bg-[var(--lc-surface)] px-3"
                        value={affiliationMode}
                        onChange={(e) =>
                          setAffiliationMode(e.target.value as 'non_exclusive' | 'exclusive')
                        }
                      >
                        <option value="non_exclusive">Non-exclusive</option>
                        <option value="exclusive">Exclusive</option>
                      </select>
                    </div>
                  ) : null}

                  <Button
                    type="button"
                    size="lg"
                    className="w-full"
                    disabled={busy}
                    onClick={() => setApproveOpen(true)}
                  >
                    <Check className="me-2 h-5 w-5" aria-hidden />
                    Approve application
                  </Button>
                  <Button
                    type="button"
                    size="lg"
                    variant="outline"
                    className="w-full"
                    disabled={busy}
                    onClick={() => {
                      setRejectOpen(true)
                      setRejectReason('')
                    }}
                  >
                    <X className="me-2 h-5 w-5" aria-hidden />
                    Reject application
                  </Button>
                  <Button
                    type="button"
                    size="lg"
                    variant="ghost"
                    className="w-full"
                    disabled
                    title="Coming soon (Phase 2)"
                    aria-disabled="true"
                  >
                    <MessageSquare className="me-2 h-5 w-5" aria-hidden />
                    Request more info
                  </Button>
                  <hr className="border-[var(--lc-border)]" />
                  <p style={{ font: 'var(--lc-type-caption)' }} className="text-[var(--lc-text-muted)]">
                    Approving creates a membership immediately and notifies the applicant. Rejecting
                    sends a message with your reason.
                  </p>
                </div>
              ) : (
                decidedPanel
              )}
            </div>
          </div>
        )}
      </div>

      <PAQueueKeyboardShortcutsPanel
        open={shortcutsOpen}
        onOpenChange={setShortcutsOpen}
        shortcuts={DETAIL_SHORTCUTS}
      />

      {/* Approve confirmation — AlertDialog semantics, focus Cancel first */}
      <Dialog open={approveOpen} onOpenChange={setApproveOpen}>
        <DialogContent role="alertdialog" aria-describedby="approve-desc">
          <DialogHeader>
            <DialogTitle>Approve {name}&apos;s application?</DialogTitle>
            <DialogDescription id="approve-desc">
              {name} will be added to your agency as an{' '}
              <Numeric>{role === 'admin' ? 'Admin' : 'Agent'}</Numeric> immediately and receive a
              notification with next steps. This can be reversed by ending the membership later.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 flex justify-end gap-2">
            <Button
              ref={approveCancelRef}
              type="button"
              variant="outline"
              onClick={() => setApproveOpen(false)}
            >
              Cancel
            </Button>
            <Button type="button" disabled={busy} onClick={() => void doApprove()}>
              {busy ? <Loader2 className="me-2 h-4 w-4 animate-spin" aria-hidden /> : null}
              Approve and add to agency
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject {name}&apos;s application</DialogTitle>
            <DialogDescription>
              Required. This message is sent to the applicant. Keep it kind and clear. Minimum 20
              characters.
            </DialogDescription>
          </DialogHeader>
          <label className="mt-2 block text-sm font-medium" htmlFor="detail-reject-reason">
            Reason (shown to applicant)
          </label>
          <textarea
            ref={rejectReasonRef}
            id="detail-reject-reason"
            rows={4}
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="e.g. We're not adding agents in your city right now. Feel free to reapply in a few months."
            className="mt-1 w-full rounded-[var(--lc-radius-md)] border border-[var(--lc-border-strong)] bg-[var(--lc-surface)] px-3 py-2 text-sm"
            aria-describedby="detail-reject-helper"
          />
          <p id="detail-reject-helper" className="mt-1 text-xs text-[var(--lc-text-muted)]" aria-live="polite">
            {rejectReason.trim().length >= 20
              ? 'Ready to submit'
              : `Minimum 20 characters (${rejectReason.trim().length}/20).`}
          </p>
          <div className="mt-4 flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setRejectOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={rejectReason.trim().length < 20 || busy}
              onClick={() => void doReject()}
            >
              {busy ? <Loader2 className="me-2 h-4 w-4 animate-spin" aria-hidden /> : null}
              Reject application
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
