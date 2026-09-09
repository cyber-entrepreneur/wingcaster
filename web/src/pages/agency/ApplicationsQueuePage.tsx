/**
 * AGN-MEM-002 — Agency applications queue (WF-02 approver-side).
 *
 * First agency-side consumer of PA-queue-family primitives.
 * Bulk actions omitted (Wave 1 §8 / Phase 2) — `selectable={false}`.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  AlertTriangle,
  Check,
  Download,
  Eye,
  HelpCircle,
  Monitor,
  X,
} from 'lucide-react'
import { api } from '@/api/client'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/components/ui/toast'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Numeric } from '@/components/ui/numeric'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  PAQueueFilterStrip,
  PAQueueTable,
  PAQueueKeyboardShortcutsPanel,
  type PAQueueColumn,
  type PAQueueFilterValues,
  type PAQueueKeyboardShortcut,
  type PAQueueSubmittedWithin,
} from '@/components/queue'
import { usePageTitle } from '@/lib/usePageTitle'
import { cn } from '@/lib/utils'
import {
  APPLICATIONS_QUEUE_PATH,
  applicationStatusLabel,
  applicationStatusToLc,
  buildQueueSearchParams,
  countApplications,
  excerptMessage,
  filterApplications,
  formatRelativeApplied,
  initials,
  normalizeApplication,
  type AgencyApplicationRaw,
  type ApplicationRow,
  type ApplicationStatus,
  type ApplicationWithin,
} from './applicationsTypes'

const WITHIN_OPTIONS: { value: PAQueueSubmittedWithin; label: string }[] = [
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: '90d', label: 'Last 90 days' },
  { value: 'all', label: 'All time' },
]

const QUEUE_SHORTCUTS: PAQueueKeyboardShortcut[] = [
  { keys: 'J', description: 'Next application' },
  { keys: 'K', description: 'Previous application' },
  { keys: 'A', description: 'Approve focused application' },
  { keys: 'R', description: 'Reject focused application' },
  { keys: 'Enter', description: 'Open application detail' },
  { keys: '.', description: 'Refresh queue' },
  { keys: '?', description: 'Show keyboard shortcuts' },
  { keys: 'Esc', description: 'Close modal / shortcuts' },
]

const PAGE_SIZES = [25, 50, 100] as const

function parseStatus(raw: string | null): ApplicationStatus {
  if (raw === 'approved' || raw === 'rejected' || raw === 'expired' || raw === 'pending') return raw
  return 'pending'
}

function parseWithin(raw: string | null): ApplicationWithin {
  if (raw === '7d' || raw === '30d' || raw === '90d' || raw === 'all') return raw
  return '30d'
}

function useIsMobileQueue(): boolean {
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

function useIsTabletQueue(): boolean {
  const [tablet, setTablet] = useState(() =>
    typeof window !== 'undefined'
      ? window.matchMedia('(min-width: 768px) and (max-width: 1023px)').matches
      : false,
  )
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px) and (max-width: 1023px)')
    const onChange = () => setTablet(mq.matches)
    onChange()
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return tablet
}

export function ApplicationsQueuePage() {
  usePageTitle('Applications')
  const { agent, loading: authLoading } = useAuth()
  const { addToast } = useToast()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const isMobile = useIsMobileQueue()
  const isTablet = useIsTabletQueue()

  const status = parseStatus(searchParams.get('status'))
  const within = parseWithin(searchParams.get('within'))
  const q = searchParams.get('q') || ''
  const page = Math.max(1, Number(searchParams.get('page') || '1') || 1)
  const pageSizeRaw = Number(searchParams.get('pageSize') || '25') || 25
  const pageSize = (PAGE_SIZES as readonly number[]).includes(pageSizeRaw) ? pageSizeRaw : 25

  const [agencyId, setAgencyId] = useState<string | null>(null)
  const [agencySlug, setAgencySlug] = useState<string | null>(null)
  const [rows, setRows] = useState<ApplicationRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [forbidden, setForbidden] = useState(false)
  const [searchDraft, setSearchDraft] = useState(q)
  const [focusedId, setFocusedId] = useState<string | null>(null)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const [rejectTarget, setRejectTarget] = useState<ApplicationRow | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [actionBusyId, setActionBusyId] = useState<string | null>(null)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set())
  const debounceRef = useRef<number | null>(null)
  const rejectReasonRef = useRef<HTMLTextAreaElement>(null)

  const patchParams = useCallback(
    (patch: Record<string, string | null>) => {
      const next = new URLSearchParams(searchParams)
      for (const [key, value] of Object.entries(patch)) {
        if (value == null || value === '') next.delete(key)
        else next.set(key, value)
      }
      setSearchParams(next, { replace: true })
    },
    [searchParams, setSearchParams],
  )

  const load = useCallback(async () => {
    if (!agent) return
    setLoading(true)
    setError(null)
    setForbidden(false)
    try {
      const agency = await api.getMyAgency()
      if (!agency?.id) {
        setForbidden(true)
        setRows([])
        return
      }
      setAgencyId(agency.id)
      setAgencySlug(agency.slug || agency.id)
      const raw = (await api.listAgencyApplications(agency.id)) as AgencyApplicationRaw[]
      const list = Array.isArray(raw) ? raw.map(normalizeApplication) : []
      setRows(list)
    } catch (err: unknown) {
      const e = err as { status?: number; message?: string }
      if (e?.status === 401) {
        navigate(`/login?returnTo=${encodeURIComponent(APPLICATIONS_QUEUE_PATH)}`)
        return
      }
      if (e?.status === 403) {
        setForbidden(true)
        setRows([])
        return
      }
      setError(e?.message || "Couldn't load applications. Try again.")
    } finally {
      setLoading(false)
    }
  }, [agent?.id, navigate])

  useEffect(() => {
    if (authLoading) return
    if (!agent) {
      navigate(`/login?returnTo=${encodeURIComponent(APPLICATIONS_QUEUE_PATH)}`)
      return
    }
    void load()
  }, [agent?.id, authLoading, load, navigate])

  useEffect(() => {
    setSearchDraft(q)
  }, [q])

  useEffect(() => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current)
    debounceRef.current = window.setTimeout(() => {
      if (searchDraft === q) return
      patchParams({ q: searchDraft || null, page: '1' })
    }, 200)
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current)
    }
  }, [searchDraft, q, patchParams])

  const counts = useMemo(() => countApplications(rows), [rows])
  const filtered = useMemo(
    () => filterApplications(rows, { status, within, q }),
    [rows, status, within, q],
  )
  const total = filtered.length
  const pageCount = Math.max(1, Math.ceil(total / pageSize))
  const safePage = Math.min(page, pageCount)
  const pageRows = filtered.slice((safePage - 1) * pageSize, safePage * pageSize)

  useEffect(() => {
    if (pageRows.length === 0) {
      setFocusedId(null)
      return
    }
    if (!focusedId || !pageRows.some((r) => r.id === focusedId)) {
      setFocusedId(pageRows[0].id)
    }
  }, [pageRows, focusedId])

  const filterValues: PAQueueFilterValues = {
    status,
    submittedWithin: within,
    riskTier: 'any',
    search: searchDraft,
  }

  const openDetail = useCallback(
    (row: ApplicationRow) => {
      const qs = buildQueueSearchParams({ status, within, q, page: safePage, pageSize })
      navigate(`${APPLICATIONS_QUEUE_PATH}/${row.id}${qs ? `?${qs}` : ''}`)
    },
    [navigate, status, within, q, safePage, pageSize],
  )

  const approveRow = useCallback(
    async (row: ApplicationRow) => {
      if (!agencyId || row.status !== 'pending' || actionBusyId) return
      setActionBusyId(row.id)
      try {
        await api.approveAgencyApplication(agencyId, row.id, {
          role: 'agent',
          affiliation_mode: 'non_exclusive',
        })
        setRows((prev) =>
          prev.map((r) =>
            r.id === row.id
              ? {
                  ...r,
                  status: 'approved' as const,
                  decision: {
                    decided_at: new Date().toISOString(),
                    decided_by: agent?.id || null,
                    role_assigned: 'agent',
                    reason: null,
                  },
                }
              : r,
          ),
        )
        addToast({
          title: `Approved ${row.applicant.display_name}.`,
          description: `Applicant outcome deep-link: /applications/${row.id}`,
          variant: 'success',
        })
      } catch (err: unknown) {
        const e = err as { message?: string }
        addToast({
          title: 'Something went wrong. Try again.',
          description: e?.message,
          variant: 'error',
        })
      } finally {
        setActionBusyId(null)
      }
    },
    [agencyId, actionBusyId, addToast, agent?.id],
  )

  const confirmReject = useCallback(async () => {
    if (!agencyId || !rejectTarget) return
    const reason = rejectReason.trim()
    if (reason.length < 5) return
    setActionBusyId(rejectTarget.id)
    try {
      await api.rejectAgencyApplication(agencyId, rejectTarget.id, { reason })
      setRows((prev) =>
        prev.map((r) =>
          r.id === rejectTarget.id
            ? {
                ...r,
                status: 'rejected' as const,
                decision: {
                  decided_at: new Date().toISOString(),
                  decided_by: agent?.id || null,
                  role_assigned: null,
                  reason,
                },
              }
            : r,
        ),
      )
      addToast({
        title: `Rejected ${rejectTarget.applicant.display_name}.`,
        description: `Applicant outcome deep-link: /applications/${rejectTarget.id}`,
        variant: 'success',
      })
      setRejectTarget(null)
      setRejectReason('')
    } catch (err: unknown) {
      const e = err as { message?: string }
      addToast({
        title: 'Something went wrong. Try again.',
        description: e?.message,
        variant: 'error',
      })
    } finally {
      setActionBusyId(null)
    }
  }, [agencyId, rejectTarget, rejectReason, addToast, agent?.id])

  useEffect(() => {
    if (rejectTarget) {
      const t = window.setTimeout(() => rejectReasonRef.current?.focus(), 50)
      return () => window.clearTimeout(t)
    }
  }, [rejectTarget])

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
        if (rejectTarget) {
          setRejectTarget(null)
          return
        }
        return
      }
      if (shortcutsOpen || rejectTarget) return

      if (e.key === '.' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault()
        void load()
        return
      }
      if (e.key === 'j' || e.key === 'J') {
        e.preventDefault()
        if (pageRows.length === 0) return
        const idx = Math.max(0, pageRows.findIndex((r) => r.id === focusedId))
        const next = pageRows[Math.min(pageRows.length - 1, idx + 1)]
        setFocusedId(next.id)
        return
      }
      if (e.key === 'k' || e.key === 'K') {
        e.preventDefault()
        if (pageRows.length === 0) return
        const idx = Math.max(0, pageRows.findIndex((r) => r.id === focusedId))
        const prev = pageRows[Math.max(0, idx - 1)]
        setFocusedId(prev.id)
        return
      }
      if (e.key === 'Enter') {
        const row = pageRows.find((r) => r.id === focusedId)
        if (row) {
          e.preventDefault()
          openDetail(row)
        }
        return
      }
      if ((e.key === 'a' || e.key === 'A') && !e.shiftKey) {
        const row = pageRows.find((r) => r.id === focusedId)
        if (row?.status === 'pending') {
          e.preventDefault()
          void approveRow(row)
        }
        return
      }
      if (e.key === 'r' || e.key === 'R') {
        const row = pageRows.find((r) => r.id === focusedId)
        if (row?.status === 'pending') {
          e.preventDefault()
          setRejectTarget(row)
          setRejectReason('')
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [
    pageRows,
    focusedId,
    shortcutsOpen,
    rejectTarget,
    load,
    openDetail,
    approveRow,
  ])

  const exportCsv = useCallback(() => {
    const header = [
      'id',
      'applicant_name',
      'applicant_city',
      'applied_at',
      'listings_count',
      'status',
      'message',
      'decided_at',
      'decided_by',
      'reason',
    ]
    const lines = [header.join(',')]
    for (const row of filtered) {
      const cells = [
        row.id,
        row.applicant.display_name,
        row.applicant.city || '',
        row.applied_at,
        row.applicant.listings_count ?? '',
        row.status,
        row.message,
        row.decision?.decided_at || '',
        row.decision?.decided_by || '',
        row.decision?.reason || '',
      ].map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
      lines.push(cells.join(','))
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `agency-applications-${status}-${within}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }, [filtered, status, within])

  const columns: PAQueueColumn<ApplicationRow>[] = useMemo(() => {
    const cols: PAQueueColumn<ApplicationRow>[] = [
      {
        id: 'applicant',
        header: 'Applicant',
        cell: (row) => (
          <div className="flex min-w-[12rem] items-center gap-3">
            <Avatar className="h-8 w-8 rounded-[var(--lc-radius-pill)]">
              {row.applicant.avatar_url ? (
                <AvatarImage src={row.applicant.avatar_url} alt="" />
              ) : null}
              <AvatarFallback className="rounded-[var(--lc-radius-pill)] text-xs">
                {initials(row.applicant.display_name)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <div style={{ font: 'var(--lc-type-body)' }} className="truncate text-[var(--lc-text-primary)]">
                {row.applicant.display_name}
              </div>
              <div
                style={{ font: 'var(--lc-type-caption)' }}
                className="truncate text-[var(--lc-text-muted)]"
              >
                {[row.applicant.city, row.applicant.years_experience != null
                  ? `${row.applicant.years_experience} years exp`
                  : null]
                  .filter(Boolean)
                  .join(' · ') || '—'}
              </div>
            </div>
          </div>
        ),
      },
      {
        id: 'applied',
        header: 'Applied',
        cell: (row) => (
          <span
            title={new Date(row.applied_at).toLocaleString()}
            style={{ font: 'var(--lc-type-body-sm)' }}
            className="text-[var(--lc-text-primary)]"
          >
            <Numeric>{formatRelativeApplied(row.applied_at)}</Numeric>
          </span>
        ),
      },
    ]

    if (!isTablet) {
      cols.push(
        {
          id: 'listings',
          header: 'Listings',
          headerClassName: 'text-center',
          cellClassName: 'text-center',
          cell: (row) => (
            <Numeric>
              {row.applicant.listings_count != null ? row.applicant.listings_count : '—'}
            </Numeric>
          ),
        },
        {
          id: 'message',
          header: 'Message',
          cell: (row) => (
            <span
              style={{ font: 'var(--lc-type-body-sm)' }}
              className="block max-w-[18rem] truncate text-[var(--lc-text-secondary)]"
            >
              {excerptMessage(row.message) || '—'}
            </span>
          ),
        },
      )
    } else {
      cols.push({
        id: 'expand',
        header: 'Details',
        srOnlyHeader: true,
        cell: (row) => (
          <Button
            type="button"
            size="icon"
            variant="ghost"
            aria-label={expandedIds.has(row.id) ? 'Hide details' : 'Show details'}
            aria-expanded={expandedIds.has(row.id)}
            onClick={(e) => {
              e.stopPropagation()
              setExpandedIds((prev) => {
                const next = new Set(prev)
                if (next.has(row.id)) next.delete(row.id)
                else next.add(row.id)
                return next
              })
            }}
          >
            {expandedIds.has(row.id) ? '▴' : '▾'}
          </Button>
        ),
      })
    }

    cols.push(
      {
        id: 'status',
        header: 'Status',
        cell: (row) => (
          <Badge status={applicationStatusToLc(row.status)}>
            {applicationStatusLabel(row.status)}
          </Badge>
        ),
      },
      {
        id: 'actions',
        header: 'Actions',
        srOnlyHeader: true,
        cell: (row) => (
          <div
            className="flex items-center justify-end gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 md:focus-within:opacity-100"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            {row.status === 'pending' ? (
              <>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="border-[var(--lc-action-primary)] text-[var(--lc-action-primary)]"
                  disabled={actionBusyId === row.id}
                  onClick={() => void approveRow(row)}
                >
                  <Check className="me-1 h-4 w-4" aria-hidden />
                  Approve
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={actionBusyId === row.id}
                  onClick={() => {
                    setRejectTarget(row)
                    setRejectReason('')
                  }}
                >
                  <X className="me-1 h-4 w-4" aria-hidden />
                  Reject
                </Button>
              </>
            ) : null}
            <Button type="button" size="sm" variant="outline" onClick={() => openDetail(row)}>
              <Eye className="me-1 h-4 w-4" aria-hidden />
              View
            </Button>
          </div>
        ),
      },
    )
    return cols
  }, [isTablet, expandedIds, actionBusyId, approveRow, openDetail])

  if (isMobile) {
    return (
      <div
        className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-[var(--lc-space-xl)] text-center"
        style={{ background: 'var(--lc-bg-page)' }}
        data-testid="applications-queue-mobile-gate"
      >
        <Monitor className="h-10 w-10 text-[var(--lc-text-muted)]" aria-hidden />
        <h1 style={{ font: 'var(--lc-type-heading-2)' }} className="text-[var(--lc-text-heading)]">
          Agency console requires a larger screen
        </h1>
        <p style={{ font: 'var(--lc-type-body)' }} className="max-w-md text-[var(--lc-text-muted)]">
          Applications review is desktop-first in v1. Open this page on a tablet or desktop.
        </p>
        <Button asChild variant="outline">
          <Link to="/agency">Back to agency home</Link>
        </Button>
      </div>
    )
  }

  if (forbidden) {
    return (
      <div className="mx-auto max-w-[1440px] px-[var(--lc-space-2xl)] py-[var(--lc-space-3xl)]">
        <h1 style={{ font: 'var(--lc-type-heading-1)' }} className="text-[var(--lc-text-heading)]">
          You need agency-management access to view this page.
        </h1>
        <Button asChild className="mt-4" variant="outline">
          <Link to="/agency">Go to agency home</Link>
        </Button>
      </div>
    )
  }

  const startIdx = total === 0 ? 0 : (safePage - 1) * pageSize + 1
  const endIdx = Math.min(safePage * pageSize, total)

  const emptyState =
    status === 'pending' && !q ? (
      <div className="mx-auto flex max-w-md flex-col items-center gap-[var(--lc-space-md)] py-4">
        <div
          className="flex h-[200px] w-[200px] items-center justify-center rounded-[var(--lc-radius-lg)] border border-dashed border-[var(--lc-border-strong)] bg-[var(--lc-surface-sunken)] text-[var(--lc-text-muted)]"
          aria-hidden
        >
          Illustration — empty inbox
        </div>
        <h2 style={{ font: 'var(--lc-type-heading-3)' }} className="text-[var(--lc-text-heading)]">
          No applications yet
        </h2>
        <p style={{ font: 'var(--lc-type-body)' }} className="text-[var(--lc-text-muted)]">
          When agents apply to join your agency, they&apos;ll show up here. Share your public agency
          profile to start receiving applications.
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          <Button asChild>
            <Link to={agencySlug ? `/public/agency/${agencySlug}` : '/agency'}>
              View your public agency page →
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/agency">Invite an agent directly</Link>
          </Button>
        </div>
      </div>
    ) : q && filtered.length === 0 ? (
      <div className="space-y-2">
        <p>
          No applicants match &apos;{q}&apos;
        </p>
        <Button type="button" variant="link" onClick={() => patchParams({ q: null, page: '1' })}>
          Clear search
        </Button>
      </div>
    ) : (
      <div className="space-y-1">
        <p style={{ font: 'var(--lc-type-heading-3)' }} className="text-[var(--lc-text-heading)]">
          No {status} applications in this range
        </p>
        <p className="text-[var(--lc-text-muted)]">Try widening the &apos;Applied within&apos; filter.</p>
      </div>
    )

  return (
    <div
      className="min-h-full bg-[var(--lc-bg-page)]"
      data-testid="applications-queue-page"
      data-screen="AGN-MEM-002"
    >
      <a
        href="#applications-table"
        className="sr-only focus:not-sr-only focus:absolute focus:start-4 focus:top-4 focus:z-20 focus:rounded-[var(--lc-radius-md)] focus:bg-[var(--lc-surface-raised)] focus:px-3 focus:py-2"
      >
        Skip to applications table
      </a>

      <div className="mx-auto max-w-[1440px] px-[var(--lc-space-2xl)] py-[var(--lc-space-xl)]">
        <header className="mb-[var(--lc-space-lg)] flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1
              style={{ font: 'var(--lc-type-heading-1)' }}
              className="text-[var(--lc-text-heading)]"
            >
              Applications
            </h1>
            <p
              style={{ font: 'var(--lc-type-body-sm)' }}
              className="mt-1 text-[var(--lc-text-muted)]"
            >
              <Numeric>{counts.pending}</Numeric> pending ·{' '}
              <Numeric>{counts.approved_this_week}</Numeric> approved ·{' '}
              <Numeric>{counts.rejected_this_week}</Numeric> rejected this week
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button type="button" variant="ghost" onClick={exportCsv} aria-label="Export CSV">
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
              <HelpCircle className="h-5 w-5" aria-hidden />
            </Button>
          </div>
        </header>

        {error ? (
          <div
            role="alert"
            className="mb-[var(--lc-space-md)] flex items-center gap-3 rounded-[var(--lc-radius-md)] border border-[var(--lc-border)] bg-[var(--lc-status-unpublished-bg)] px-[var(--lc-space-md)] py-[var(--lc-space-sm)] text-[var(--lc-status-unpublished-fg)]"
          >
            <AlertTriangle className="h-5 w-5 shrink-0" aria-hidden />
            <span className="flex-1">{error}</span>
            <Button type="button" variant="outline" onClick={() => void load()}>
              Retry
            </Button>
          </div>
        ) : null}

        <PAQueueFilterStrip
          aria-label="Filter applications"
          statusOptions={[
            { value: 'pending', label: 'Pending', count: counts.pending },
            { value: 'approved', label: 'Approved', count: counts.approved_this_week },
            { value: 'rejected', label: 'Rejected', count: counts.rejected_this_week },
            { value: 'expired', label: 'Expired', count: counts.expired_this_week },
          ]}
          values={filterValues}
          disabled={loading}
          hideRiskTier
          withinLabel="Applied within"
          withinOptions={WITHIN_OPTIONS}
          searchPlaceholder="Search applicants by name…"
          searchAriaLabel="Search applicants by name"
          onChange={(next) => {
            const nextStatus = parseStatus(next.status)
            const nextWithin = parseWithin(next.submittedWithin)
            setSearchDraft(next.search)
            patchParams({
              status: nextStatus,
              within: nextWithin,
              q: next.search || null,
              page: '1',
            })
          }}
        />

        <div id="applications-table" className="mt-[var(--lc-space-md)]">
          <PAQueueTable<ApplicationRow>
            aria-label="Applications"
            columns={columns}
            rows={pageRows}
            selectable={false}
            loading={loading}
            skeletonRows={8}
            focusedId={focusedId}
            onRowClick={openDetail}
            emptyState={emptyState}
            className={cn('[&_tbody_tr]:group')}
          />
          {isTablet
            ? pageRows
                .filter((r) => expandedIds.has(r.id))
                .map((row) => (
                  <div
                    key={`exp-${row.id}`}
                    className="mt-2 rounded-[var(--lc-radius-md)] border border-[var(--lc-border)] bg-[var(--lc-surface-sunken)] p-[var(--lc-space-md)]"
                  >
                    <p style={{ font: 'var(--lc-type-overline)' }} className="text-[var(--lc-text-muted)]">
                      Listings
                    </p>
                    <p className="mb-2">
                      <Numeric>{row.applicant.listings_count ?? '—'}</Numeric>
                    </p>
                    <p style={{ font: 'var(--lc-type-overline)' }} className="text-[var(--lc-text-muted)]">
                      Message
                    </p>
                    <p style={{ font: 'var(--lc-type-body-sm)' }}>{row.message || '—'}</p>
                  </div>
                ))
            : null}
        </div>

        <footer className="mt-[var(--lc-space-md)] flex flex-wrap items-center justify-end gap-3 text-[var(--lc-text-muted)]"
          style={{ font: 'var(--lc-type-body-sm)' }}
        >
          <span>
            <Numeric>
              {startIdx}–{endIdx}
            </Numeric>{' '}
            of <Numeric>{total}</Numeric>
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Previous page"
            disabled={safePage <= 1 || loading}
            onClick={() => patchParams({ page: String(safePage - 1) })}
          >
            ‹
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Next page"
            disabled={safePage >= pageCount || loading}
            onClick={() => patchParams({ page: String(safePage + 1) })}
          >
            ›
          </Button>
          <label className="flex items-center gap-2">
            <span>Rows per page</span>
            <select
              className="min-h-tap rounded-[var(--lc-radius-md)] border border-[var(--lc-border-strong)] bg-[var(--lc-surface)] px-2"
              value={pageSize}
              onChange={(e) => patchParams({ pageSize: e.target.value, page: '1' })}
            >
              {PAGE_SIZES.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
        </footer>
      </div>

      <PAQueueKeyboardShortcutsPanel
        open={shortcutsOpen}
        onOpenChange={setShortcutsOpen}
        shortcuts={QUEUE_SHORTCUTS}
        title="Keyboard shortcuts"
      />

      <Dialog
        open={Boolean(rejectTarget)}
        onOpenChange={(open) => {
          if (!open) {
            setRejectTarget(null)
            setRejectReason('')
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Reject {rejectTarget?.applicant.display_name}&apos;s application
            </DialogTitle>
            <DialogDescription>
              Required. This message is sent to the applicant. Keep it kind and clear.
            </DialogDescription>
          </DialogHeader>
          <label className="mt-2 block text-sm font-medium text-[var(--lc-text-primary)]" htmlFor="reject-reason">
            Reason (shown to applicant)
          </label>
          <textarea
            ref={rejectReasonRef}
            id="reject-reason"
            rows={4}
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="e.g. We're not adding agents in your city right now."
            className="mt-1 w-full rounded-[var(--lc-radius-md)] border border-[var(--lc-border-strong)] bg-[var(--lc-surface)] px-3 py-2 text-sm text-[var(--lc-text-primary)]"
            aria-describedby="reject-reason-helper"
          />
          <p id="reject-reason-helper" className="mt-1 text-xs text-[var(--lc-text-muted)]" aria-live="polite">
            {rejectReason.trim().length >= 5
              ? 'Ready to submit'
              : `Minimum 5 characters (${rejectReason.trim().length}/5).`}
          </p>
          <div className="mt-4 flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setRejectTarget(null)
                setRejectReason('')
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={rejectReason.trim().length < 5 || Boolean(actionBusyId)}
              onClick={() => void confirmReject()}
            >
              Reject application
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
