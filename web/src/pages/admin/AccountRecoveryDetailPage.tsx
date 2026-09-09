/**
 * PA-ACR-002 — Account recovery detail (WF-04 decision surface).
 *
 * SECURITY (BE-BLOCKER-22): decisions MUST use POST .../cast-vote only.
 * Legacy POST .../approve and .../reject return 410 Gone — never call them.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import {
  AlertTriangle,
  Check,
  ChevronLeft,
  Copy,
  Download,
  FileText,
  Image as ImageIcon,
  Loader2,
  Undo2,
  X,
} from 'lucide-react'
import { api } from '@/api/client'
import { useAuth } from '@/context/AuthContext'
import { useStepUp } from '@/context/StepUpContext'
import { useEnv } from '@/hooks/useEnv'
import { EnvBadge } from '@/components/nav/EnvBadge'
import { PIIMask, type PIIMaskKind } from '@/components/security/PIIMask'
import { Timeline, type TimelineEntry, type TimelineEntryStatus } from '@/components/security/Timeline'
import { TwoPersonProgress, type TwoPersonApprover } from '@/components/security/TwoPersonProgress'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ChannelMark } from '@/components/ui/channel-mark'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Numeric } from '@/components/ui/numeric'
import { useToast } from '@/components/ui/toast'
import { cn } from '@/lib/utils'

const UNDO_GRACE_MS = 30_000
const QUEUE_PATH = '/admin/support/account-recovery'

const REJECT_REASONS = [
  { value: 'insufficient_evidence', label: 'Insufficient evidence' },
  { value: 'identity_mismatch', label: 'Identity mismatch' },
  { value: 'suspected_takeover', label: 'Suspected takeover attempt' },
  { value: 'duplicate_case', label: 'Duplicate case' },
  { value: 'not_account_owner', label: 'Applicant is not the account owner' },
  { value: 'other', label: 'Other' },
] as const

const INFO_REASONS = [
  { value: 'missing_government_id', label: 'Missing government ID' },
  { value: 'selfie_required', label: 'Selfie required' },
  { value: 'tenancy_record_required', label: 'Tenancy record required' },
  { value: 'agency_letterhead_required', label: 'Agency letterhead required' },
  { value: 'contact_unreachable', label: 'Provided contact unreachable' },
  { value: 'other', label: 'Other' },
] as const

const EVIDENCE_OPTIONS = [
  { value: 'id_front', label: 'ID front' },
  { value: 'id_back', label: 'ID back' },
  { value: 'selfie_holding_id', label: 'Selfie holding ID' },
  { value: 'tenancy_record', label: 'Tenancy record' },
  { value: 'agency_letterhead', label: 'Agency letterhead' },
  { value: 'utility_bill', label: 'Utility bill' },
  { value: 'other', label: 'Other — describe in notes' },
] as const

type DialogKind = 'approve' | 'reject' | 'request-info' | 'withdraw' | 'cancel-info' | null

export interface AccountRecoveryCaseDetail {
  id: string
  created_at: string
  sla_hours_remaining: number
  sla_hours_total: number
  status: string
  reason: string
  reason_category: string | null
  provided: {
    preferred_channel: string | null
    contact_masked: string
    contact_full: string | null
    request_ip_masked: string | null
    request_ip_full: string | null
    request_user_agent_masked: string | null
    request_user_agent_full: string | null
  }
  on_file: {
    email_masked: string | null
    email_full: string | null
    phone_masked: string | null
    phone_full: string | null
    username_masked: string | null
    username_full: string | null
    agency: { id: string; name: string; tenant_url?: string } | null
    plan_tier: string | null
    role: string | null
    tenure_days: number | null
    last_successful_login_at: string | null
  }
  mismatches: Array<{ field: string; detail: string }>
  evidence: {
    file_count: number
    files: Array<{
      id?: string
      filename: string
      uploaded_at: string | null
      size_bytes: number | null
      content_type: string | null
    }>
  }
  timeline: Array<{
    at: string
    channel?: string | null
    status: string
    message: string
  }>
  account_value_tier: 'standard' | 'elevated' | 'high_value' | string
  requires_two_person: boolean
  first_vote: {
    reviewer_id: string
    vote: 'approve' | 'reject' | string
    at: string | null
    notes?: string
  } | null
  current_reviewer: {
    id: string | null
    is_first_reviewer_candidate: boolean
    is_second_reviewer_candidate: boolean
  }
  decision: {
    outcome: string
    at: string | null
    by: string | null
    notes?: string
  } | null
  escalation_case_id: string | null
  is_own: boolean
  env: string
}

function caseIdLast6(id: string): string {
  const clean = String(id || '').replace(/^acr_/i, '')
  return clean.slice(-6).toUpperCase() || '------'
}

function initialsFromId(id: string | null | undefined): string {
  if (!id) return '?'
  const alnum = String(id).replace(/[^a-zA-Z0-9]/g, '')
  return (alnum.slice(0, 2) || '??').toUpperCase()
}

function formatRelative(iso: string | null | undefined): string {
  if (!iso) return '—'
  const then = Date.parse(iso)
  if (Number.isNaN(then)) return iso
  const deltaSec = Math.round((Date.now() - then) / 1000)
  if (deltaSec < 60) return 'just now'
  const mins = Math.round(deltaSec / 60)
  if (mins < 60) return `${mins}m ago`
  const hours = Math.round(mins / 60)
  if (hours < 48) return `${hours}h ago`
  return `${Math.round(hours / 24)}d ago`
}

function formatSla(hours: number): string {
  if (!Number.isFinite(hours)) return '—'
  if (hours < 0) return 'overdue'
  const h = Math.floor(hours)
  const m = Math.round((hours - h) * 60)
  return `${h}h ${m}m`
}

function formatBytes(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—'
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

function fileExt(name: string): string {
  const dot = name.lastIndexOf('.')
  return dot >= 0 ? name.slice(dot).toLowerCase() : ''
}

function statusBadgeVariant(status: string): 'draft' | 'published' | 'underOffer' | 'unpublished' | 'closed' | 'archived' {
  switch (status) {
    case 'approved':
    case 'completed':
      return 'published'
    case 'rejected':
    case 'expired':
      return 'unpublished'
    case 'awaiting_info':
      return 'underOffer'
    case 'pending_review':
    default:
      return 'draft'
  }
}

function statusLabel(status: string): string {
  switch (status) {
    case 'pending_review':
      return 'Pending review'
    case 'awaiting_info':
      return 'Awaiting info'
    case 'approved':
      return 'Approved'
    case 'rejected':
      return 'Rejected'
    case 'completed':
      return 'Completed'
    case 'expired':
      return 'Expired'
    default:
      return status.replace(/_/g, ' ')
  }
}

function reasonCategoryLabel(cat: string | null): string {
  switch (cat) {
    case 'lost_email':
      return 'Lost email'
    case 'lost_phone':
      return 'Lost phone'
    case 'forgotten_username':
      return 'Forgotten username'
    case 'compromised_account':
      return 'Compromised account'
    default:
      return 'Other'
  }
}

function tierLabel(tier: string): string {
  if (tier === 'high_value') return 'High-value · 2-person'
  if (tier === 'elevated') return 'Elevated'
  return 'Standard'
}

function mapTimelineStatus(status: string): TimelineEntryStatus {
  if (status === 'failed') return 'failed'
  if (status === 'pending' || status === 'warning') return 'warning'
  if (status === 'success') return 'success'
  return 'info'
}

function revealFieldForKind(kind: PIIMaskKind, field: string): string {
  // Backend reveal-audit enum — map PIIMask kinds onto allowed fields.
  if (kind === 'evidence_filename') return 'name'
  if (kind === 'user_agent') return 'user_agent'
  if (kind === 'ip') return 'ip'
  if (field === 'contact') return 'contact'
  if (['email', 'phone', 'username', 'ip', 'name', 'contact', 'user_agent', 'row'].includes(field)) {
    return field
  }
  return 'name'
}

function isTerminalStatus(status: string): boolean {
  return ['approved', 'rejected', 'completed', 'expired'].includes(status)
}

function isImageContent(contentType: string | null | undefined, filename: string): boolean {
  if (contentType?.startsWith('image/')) return true
  return /\.(jpe?g|png|gif|webp|heic)$/i.test(filename)
}

function isPdf(contentType: string | null | undefined, filename: string): boolean {
  return contentType === 'application/pdf' || /\.pdf$/i.test(filename)
}

/** Exported for colocated contract tests — never points at legacy approve/reject. */
export const ACCOUNT_RECOVERY_DECISION_ENDPOINT = 'cast-vote' as const

export function buildCastVotePath(caseId: string): string {
  return `/admin/account-recovery/${encodeURIComponent(caseId)}/cast-vote`
}

export function AccountRecoveryDetailPage() {
  const { caseId = '' } = useParams<{ caseId: string }>()
  const [searchParams] = useSearchParams()
  const { isAdmin, agent } = useAuth()
  const { env } = useEnv()
  const { runElevated, requireElevation } = useStepUp()
  const { addToast } = useToast()

  const returnTo = searchParams.get('return_to') || QUEUE_PATH

  const [data, setData] = useState<AccountRecoveryCaseDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [forbidden, setForbidden] = useState(false)
  const [notFound, setNotFound] = useState(false)
  const [busy, setBusy] = useState(false)
  const [dialog, setDialog] = useState<DialogKind>(null)
  const [approveNotes, setApproveNotes] = useState('')
  const [rejectReason, setRejectReason] = useState<string>(REJECT_REASONS[0].value)
  const [rejectNotes, setRejectNotes] = useState('')
  const [infoReason, setInfoReason] = useState<string>(INFO_REASONS[0].value)
  const [infoNotes, setInfoNotes] = useState('')
  const [infoEvidence, setInfoEvidence] = useState<string[]>(['id_front', 'id_back'])
  const [undoMsLeft, setUndoMsLeft] = useState(0)
  const [liveMessage, setLiveMessage] = useState('')
  const [previewFile, setPreviewFile] = useState<AccountRecoveryCaseDetail['evidence']['files'][number] | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const undoTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const previewUrlRef = useRef<string | null>(null)

  const last6 = caseIdLast6(caseId)

  const clearUndoTimer = useCallback(() => {
    if (undoTimerRef.current) {
      clearInterval(undoTimerRef.current)
      undoTimerRef.current = null
    }
    setUndoMsLeft(0)
  }, [])

  const startUndoGrace = useCallback(() => {
    clearUndoTimer()
    const started = Date.now()
    setUndoMsLeft(UNDO_GRACE_MS)
    undoTimerRef.current = setInterval(() => {
      const left = UNDO_GRACE_MS - (Date.now() - started)
      if (left <= 0) {
        clearUndoTimer()
      } else {
        setUndoMsLeft(left)
      }
    }, 250)
  }, [clearUndoTimer])

  const load = useCallback(async () => {
    if (!caseId) return
    setLoading(true)
    setError(null)
    setForbidden(false)
    setNotFound(false)
    try {
      const payload = (await api.getAdminAccountRecoveryCase(caseId)) as AccountRecoveryCaseDetail
      setData(payload)
    } catch (err) {
      const e = err as { status?: number; code?: string; error?: string; message?: string }
      if (e.status === 403 || e.code === 'FORBIDDEN') {
        setForbidden(true)
      } else if (e.status === 404 || e.code === 'NOT_FOUND') {
        setNotFound(true)
      } else {
        setError(e.error || e.message || "Couldn't load this case. Try again.")
      }
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [caseId])

  useEffect(() => {
    void load()
  }, [load, env])

  useEffect(() => () => {
    clearUndoTimer()
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current)
      previewUrlRef.current = null
    }
  }, [clearUndoTimer])

  const onReveal = useCallback(
    async (ctx: { caseId: string; field: string; kind: PIIMaskKind }) => {
      const field = revealFieldForKind(ctx.kind, ctx.field)
      await api.revealAccountRecoveryAudit(ctx.caseId, field)
    },
    [],
  )

  const viewerId = data?.current_reviewer?.id || agent?.id || null
  const hasCastFirstVote =
    Boolean(data?.first_vote?.reviewer_id)
    && viewerId
    && String(data?.first_vote?.reviewer_id) === String(viewerId)
  const isSecondReviewer = Boolean(data?.current_reviewer?.is_second_reviewer_candidate)
  const requiresTwoPerson = Boolean(data?.requires_two_person)
  const pendingReview = data?.status === 'pending_review'
  const canDecide =
    pendingReview
    && !hasCastFirstVote
    && !isTerminalStatus(data?.status || '')

  const firstApprover: TwoPersonApprover | null = useMemo(() => {
    if (!data?.first_vote) return null
    return {
      id: data.first_vote.reviewer_id,
      initials: initialsFromId(data.first_vote.reviewer_id),
      displayName: data.first_vote.reviewer_id,
      signedOffAt: data.first_vote.at,
      vote: data.first_vote.vote === 'reject' ? 'reject' : 'approve',
    }
  }, [data?.first_vote])

  const secondApprover: TwoPersonApprover | null = useMemo(() => {
    if (!data?.decision || data.status === 'pending_review') return null
    if (!requiresTwoPerson) return null
    if (data.decision.outcome !== 'approved' && data.decision.outcome !== 'rejected') return null
    return {
      id: data.decision.by || undefined,
      initials: initialsFromId(data.decision.by),
      displayName: data.decision.by || undefined,
      signedOffAt: data.decision.at,
      vote: data.decision.outcome === 'rejected' ? 'reject' : 'approve',
    }
  }, [data, requiresTwoPerson])

  const timelineEntries: TimelineEntry[] = useMemo(
    () =>
      (data?.timeline || []).map((e, i) => ({
        id: `${e.at}-${i}`,
        at: e.at,
        channel: e.channel,
        status: mapTimelineStatus(e.status),
        message: e.message,
      })),
    [data?.timeline],
  )

  const maskedContact = data?.provided?.contact_masked || '••••'
  const channel = data?.provided?.preferred_channel || 'email'
  const isSecondApprovePath =
    isSecondReviewer && data?.first_vote?.vote === 'approve'

  async function submitCastVote(vote: 'approve' | 'reject', notes: string) {
    if (!caseId) return
    setBusy(true)
    try {
      const needsStepUp =
        requiresTwoPerson
        || data?.account_value_tier === 'elevated'
        || data?.account_value_tier === 'high_value'
      const action = () =>
        api.castAccountRecoveryVote(caseId, { vote, notes }) as Promise<{
          status?: string
          awaiting_second_vote?: boolean
          escalation_case_id?: string
          message?: string
          code?: string
        }>

      let result: Awaited<ReturnType<typeof action>> | null
      if (needsStepUp) {
        const ok = await requireElevation(
          vote === 'approve' ? 'Approve account recovery' : 'Reject account recovery',
        )
        if (!ok) {
          setBusy(false)
          return
        }
        result = await runElevated(action, vote === 'approve' ? 'Approve account recovery' : 'Reject account recovery')
      } else {
        result = await runElevated(action, vote === 'approve' ? 'Approve account recovery' : 'Reject account recovery')
      }
      if (!result) {
        setBusy(false)
        return
      }

      setDialog(null)
      setApproveNotes('')
      setRejectNotes('')

      if (result.awaiting_second_vote) {
        addToast({
          variant: 'success',
          title: 'Your vote recorded. Awaiting second reviewer.',
        })
        setLiveMessage(`You've cast your vote (${vote}). Awaiting second reviewer.`)
      } else if (vote === 'approve') {
        addToast({
          variant: 'success',
          title: isSecondApprovePath
            ? `Second vote matches. Recovery link sent to ${maskedContact}.`
            : `Approved. Recovery link sent to ${maskedContact} on ${channel}.`,
        })
        startUndoGrace()
        setLiveMessage(`Approved · recovery link sent to ${maskedContact}`)
      } else {
        addToast({
          variant: 'success',
          title: `Rejected. Applicant notified on ${channel}.`,
        })
        setLiveMessage('Rejected. Applicant notified.')
      }
      await load()
    } catch (err) {
      const e = err as {
        status?: number
        code?: string
        error?: string
        message?: string
        escalation_case_id?: string
      }
      if (e.code === 'SAME_REVIEWER' || (e.status === 409 && e.code === 'SAME_REVIEWER')) {
        addToast({
          variant: 'error',
          title: 'You cast the first vote. A different PA must cast the second.',
        })
        setLiveMessage('Same PA cannot double-sign this high-value case.')
      } else if (e.code === 'VOTE_DISAGREEMENT' || e.escalation_case_id) {
        addToast({
          variant: 'error',
          title: 'Votes do not match — case escalated to PA-APR-005 for resolution.',
        })
        setLiveMessage('Vote mismatch — escalated.')
      } else if (e.code === 'OWN_CASE') {
        addToast({ variant: 'error', title: "You can't decide your own recovery case." })
      } else {
        addToast({
          variant: 'error',
          title: e.error || e.message || 'Decision failed. Try again.',
        })
      }
      await load()
    } finally {
      setBusy(false)
    }
  }

  async function submitRequestInfo() {
    if (!caseId || infoEvidence.length === 0) return
    setBusy(true)
    try {
      await runElevated(
        () =>
          api.requestAccountRecoveryInfo(caseId, {
            reason_code: infoReason,
            notes: infoNotes,
            requested_evidence: infoEvidence,
          }),
        'Request more info',
      )
      setDialog(null)
      addToast({
        variant: 'success',
        title: `Info requested. Applicant notified on ${channel}.`,
      })
      setLiveMessage('Info requested. Case awaiting applicant response.')
      await load()
    } catch (err) {
      const e = err as { error?: string; message?: string }
      addToast({ variant: 'error', title: e.error || e.message || 'Request info failed.' })
    } finally {
      setBusy(false)
    }
  }

  async function submitWithdraw() {
    if (!caseId) return
    setBusy(true)
    try {
      await api.withdrawAccountRecoveryVote(caseId)
      setDialog(null)
      addToast({ variant: 'success', title: 'Vote withdrawn. Case back to pending review.' })
      setLiveMessage('Vote withdrawn.')
      await load()
    } catch (err) {
      const e = err as { error?: string; message?: string }
      addToast({ variant: 'error', title: e.error || e.message || 'Withdraw failed.' })
    } finally {
      setBusy(false)
    }
  }

  async function submitCancelInfo() {
    if (!caseId) return
    setBusy(true)
    try {
      await api.cancelAccountRecoveryInfoRequest(caseId)
      setDialog(null)
      addToast({ variant: 'success', title: 'Info request canceled. Case pending review.' })
      setLiveMessage('Info request canceled.')
      await load()
    } catch (err) {
      const e = err as { error?: string; message?: string }
      addToast({ variant: 'error', title: e.error || e.message || 'Cancel failed.' })
    } finally {
      setBusy(false)
    }
  }

  async function submitUndo() {
    if (!caseId) return
    setBusy(true)
    try {
      await api.undoAccountRecoveryApprove(caseId)
      clearUndoTimer()
      addToast({ variant: 'success', title: 'Reverted. Recovery link revoked.' })
      setLiveMessage('Approval undone. Recovery link revoked.')
      await load()
    } catch (err) {
      const e = err as { status?: number; code?: string; error?: string; message?: string }
      if (e.status === 409 || e.code === 'TOKEN_CONSUMED') {
        addToast({
          variant: 'error',
          title: "Can't undo — recovery link has already been used.",
        })
        clearUndoTimer()
      } else {
        addToast({ variant: 'error', title: e.error || e.message || 'Undo failed.' })
      }
    } finally {
      setBusy(false)
    }
  }

  async function openPreview(file: AccountRecoveryCaseDetail['evidence']['files'][number]) {
    if (!caseId || !file.id) {
      addToast({ variant: 'error', title: 'Evidence id missing — cannot open authenticated proxy.' })
      return
    }
    setPreviewFile(file)
    setPreviewLoading(true)
    setPreviewUrl(null)
    try {
      const blob = await api.fetchAccountRecoveryEvidenceBlob(caseId, file.id, false)
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current)
      const url = URL.createObjectURL(blob)
      previewUrlRef.current = url
      setPreviewUrl(url)
    } catch (err) {
      const e = err as { message?: string }
      addToast({ variant: 'error', title: e.message || 'Could not load evidence via proxy.' })
      setPreviewFile(null)
    } finally {
      setPreviewLoading(false)
    }
  }

  async function downloadEvidence(file: AccountRecoveryCaseDetail['evidence']['files'][number]) {
    if (!caseId || !file.id) return
    try {
      const blob = await api.fetchAccountRecoveryEvidenceBlob(caseId, file.id, true)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = file.filename
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      addToast({ variant: 'error', title: 'Download failed.' })
    }
  }

  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-2xl px-[var(--lc-space-md)] py-[var(--lc-space-2xl)]">
        <h1 className="text-[var(--lc-text-heading)]" style={{ font: 'var(--lc-type-heading-1)' }}>
          You don&apos;t have access to this case.
        </h1>
        <p className="mt-2 text-[var(--lc-text-muted)]" style={{ font: 'var(--lc-type-body)' }}>
          This screen requires the `account-recovery` capability pack. Contact a Platform Admin owner to request access.
        </p>
        <Button asChild variant="outline" className="mt-4">
          <Link to="/dashboard">Back to PA home</Link>
        </Button>
      </div>
    )
  }

  if (forbidden) {
    return (
      <div className="mx-auto max-w-2xl px-[var(--lc-space-md)] py-[var(--lc-space-2xl)]">
        <h1 className="text-[var(--lc-text-heading)]" style={{ font: 'var(--lc-type-heading-1)' }}>
          You don&apos;t have access to this case.
        </h1>
        <p className="mt-2 text-[var(--lc-text-muted)]">
          This screen requires the `account-recovery` capability pack.
        </p>
      </div>
    )
  }

  if (notFound) {
    return (
      <div className="mx-auto max-w-2xl px-[var(--lc-space-md)] py-[var(--lc-space-2xl)]">
        <h1 className="text-[var(--lc-text-heading)]" style={{ font: 'var(--lc-type-heading-1)' }}>
          Case not found
        </h1>
        <p className="mt-2 text-[var(--lc-text-muted)]">
          It may have been deleted or you don&apos;t have access to this env.
        </p>
        <Button asChild variant="ghost" className="mt-4">
          <Link to={returnTo}>← Back to recovery queue</Link>
        </Button>
      </div>
    )
  }

  const undoSeconds = Math.ceil(undoMsLeft / 1000)
  const showUndo = undoMsLeft > 0 && data?.status === 'approved'

  return (
    <div
      className="mx-auto w-full max-w-[1440px] px-[var(--lc-space-md)] py-[var(--lc-space-lg)]"
      data-screen="PA-ACR-002"
      data-decision-endpoint={ACCOUNT_RECOVERY_DECISION_ENDPOINT}
    >
      {/* Back-nav */}
      <div className="sticky top-0 z-10 mb-[var(--lc-space-md)] flex items-center justify-between gap-3 bg-[var(--lc-bg-page)]/95 py-2 backdrop-blur-sm">
        <Button asChild variant="ghost" className="gap-1">
          <Link to={returnTo}>
            <ChevronLeft className="h-4 w-4" aria-hidden />
            Back to recovery queue
          </Link>
        </Button>
        <div className="flex items-center gap-2">
          <EnvBadge env={env} />
          <Badge variant="outline" className="font-[var(--lc-font-mono)] tabular-nums">
            #<Numeric>{last6}</Numeric>
          </Badge>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Copy case id"
            onClick={() => {
              void navigator.clipboard?.writeText(caseId)
              addToast({ title: 'Case id copied' })
            }}
          >
            <Copy className="h-4 w-4" aria-hidden />
          </Button>
        </div>
      </div>

      {error ? (
        <div
          role="alert"
          className="mb-4 rounded-[var(--lc-radius-lg)] border border-[var(--lc-status-unpublished-fg)] bg-[var(--lc-status-unpublished-bg)] p-[var(--lc-space-md)] text-[var(--lc-status-unpublished-fg)]"
        >
          <p>{error}</p>
          <Button type="button" variant="outline" className="mt-2" onClick={() => void load()}>
            Retry
          </Button>
        </div>
      ) : null}

      {loading || !data ? (
        <p className="text-[var(--lc-text-muted)]" style={{ font: 'var(--lc-type-body)' }}>
          Loading case…
        </p>
      ) : (
        <>
          {/* Header */}
          <header className="mb-[var(--lc-space-xl)] flex flex-wrap items-start justify-between gap-[var(--lc-space-md)]">
            <div>
              <h1
                className="text-[var(--lc-text-heading)]"
                style={{ font: 'var(--lc-type-heading-1)' }}
              >
                Recovery case · #<Numeric>{last6}</Numeric>
              </h1>
              <div className="mt-1 text-[var(--lc-text-muted)]" style={{ font: 'var(--lc-type-body-sm)' }}>
                <Badge status={statusBadgeVariant(data.status)} className="mr-2 align-middle">
                  {statusLabel(data.status)}
                </Badge>
                Submitted {formatRelative(data.created_at)} · SLA{' '}
                <Numeric>{formatSla(data.sla_hours_remaining)}</Numeric> left
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                variant={data.account_value_tier === 'high_value' ? 'destructive' : 'secondary'}
              >
                {tierLabel(data.account_value_tier)}
              </Badge>
              {channel ? <ChannelMark channel={channel} /> : null}
            </div>
          </header>

          <div className="grid gap-[var(--lc-space-2xl)] lg:grid-cols-[3fr_2fr]">
            {/* Left — case data */}
            <div
              role="region"
              aria-labelledby="acr-case-data"
              className="flex min-w-0 flex-col gap-[var(--lc-space-lg)]"
            >
              <h2 id="acr-case-data" className="sr-only">
                Case data
              </h2>

              {/* Identity */}
              <Card className="rounded-[var(--lc-radius-lg)] shadow-[var(--lc-elevation-sm)]">
                <CardHeader className="p-[var(--lc-space-xl)] pb-[var(--lc-space-md)]">
                  <CardTitle style={{ font: 'var(--lc-type-heading-3)' }}>Applicant identity</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-[var(--lc-space-lg)] p-[var(--lc-space-xl)] pt-0 md:grid-cols-2">
                  <section aria-labelledby="provided-heading">
                    <h2
                      id="provided-heading"
                      className="mb-3 uppercase text-[var(--lc-text-muted)]"
                      style={{ font: 'var(--lc-type-overline)' }}
                    >
                      Provided at request
                    </h2>
                    <dl className="space-y-3 text-sm">
                      <div>
                        <dt className="text-[var(--lc-text-muted)]">Preferred channel</dt>
                        <dd className="mt-0.5 flex items-center gap-2">
                          {channel}
                          {channel ? <ChannelMark channel={channel} /> : null}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-[var(--lc-text-muted)]">Contact value (can receive on now)</dt>
                        <dd className="mt-0.5">
                          <PIIMask
                            value={data.provided.contact_full || data.provided.contact_masked}
                            maskedValue={data.provided.contact_masked}
                            kind={channel === 'email' ? 'email' : 'phone'}
                            auditContext={{ caseId: data.id, field: 'contact' }}
                            onReveal={onReveal}
                          />
                        </dd>
                      </div>
                      <div>
                        <dt className="text-[var(--lc-text-muted)]">Request IP</dt>
                        <dd className="mt-0.5">
                          <PIIMask
                            value={data.provided.request_ip_full || data.provided.request_ip_masked || '—'}
                            maskedValue={data.provided.request_ip_masked || '•••'}
                            kind="ip"
                            auditContext={{ caseId: data.id, field: 'ip' }}
                            onReveal={onReveal}
                          />
                        </dd>
                      </div>
                      <div>
                        <dt className="text-[var(--lc-text-muted)]">Request device / browser</dt>
                        <dd className="mt-0.5">
                          <PIIMask
                            value={
                              data.provided.request_user_agent_full
                              || data.provided.request_user_agent_masked
                              || '—'
                            }
                            maskedValue={data.provided.request_user_agent_masked || '•••'}
                            kind="user_agent"
                            auditContext={{ caseId: data.id, field: 'user_agent' }}
                            onReveal={onReveal}
                          />
                        </dd>
                      </div>
                    </dl>
                  </section>

                  <section aria-labelledby="onfile-heading">
                    <h2
                      id="onfile-heading"
                      className="mb-3 uppercase text-[var(--lc-text-muted)]"
                      style={{ font: 'var(--lc-type-overline)' }}
                    >
                      On file for this account
                    </h2>
                    <dl className="space-y-3 text-sm">
                      <div>
                        <dt className="text-[var(--lc-text-muted)]">Registered email</dt>
                        <dd className="mt-0.5">
                          <PIIMask
                            value={data.on_file.email_full || data.on_file.email_masked || '—'}
                            maskedValue={data.on_file.email_masked || '•••'}
                            kind="email"
                            auditContext={{ caseId: data.id, field: 'email' }}
                            onReveal={onReveal}
                          />
                        </dd>
                      </div>
                      <div>
                        <dt className="text-[var(--lc-text-muted)]">Registered phone</dt>
                        <dd className="mt-0.5">
                          <PIIMask
                            value={data.on_file.phone_full || data.on_file.phone_masked || '—'}
                            maskedValue={data.on_file.phone_masked || '•••'}
                            kind="phone"
                            auditContext={{ caseId: data.id, field: 'phone' }}
                            onReveal={onReveal}
                          />
                        </dd>
                      </div>
                      <div>
                        <dt className="text-[var(--lc-text-muted)]">Registered username</dt>
                        <dd className="mt-0.5">
                          <PIIMask
                            value={data.on_file.username_full || data.on_file.username_masked || '—'}
                            maskedValue={data.on_file.username_masked || '•••'}
                            kind="username"
                            auditContext={{ caseId: data.id, field: 'username' }}
                            onReveal={onReveal}
                          />
                        </dd>
                      </div>
                      <div>
                        <dt className="text-[var(--lc-text-muted)]">Agency</dt>
                        <dd className="mt-0.5">
                          {data.on_file.agency?.tenant_url ? (
                            <a
                              href={data.on_file.agency.tenant_url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-[var(--lc-text-brand)] underline-offset-2 hover:underline"
                            >
                              {data.on_file.agency.name}
                            </a>
                          ) : (
                            data.on_file.agency?.name || '—'
                          )}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-[var(--lc-text-muted)]">Plan tier</dt>
                        <dd className="mt-0.5 capitalize">{data.on_file.plan_tier || '—'}</dd>
                      </div>
                      <div>
                        <dt className="text-[var(--lc-text-muted)]">Role</dt>
                        <dd className="mt-0.5">{(data.on_file.role || '—').replace(/_/g, ' ')}</dd>
                      </div>
                      <div>
                        <dt className="text-[var(--lc-text-muted)]">Tenure</dt>
                        <dd className="mt-0.5">
                          {data.on_file.tenure_days != null ? (
                            <>
                              <Numeric>{data.on_file.tenure_days.toLocaleString()}</Numeric> days
                            </>
                          ) : (
                            '—'
                          )}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-[var(--lc-text-muted)]">Last successful login</dt>
                        <dd className="mt-0.5">
                          {data.on_file.last_successful_login_at ? (
                            <Numeric title={data.on_file.last_successful_login_at}>
                              {new Date(data.on_file.last_successful_login_at).toLocaleString()}
                            </Numeric>
                          ) : (
                            '—'
                          )}
                        </dd>
                      </div>
                    </dl>
                  </section>

                  <div className="md:col-span-2">
                    {data.mismatches?.length ? (
                      <Badge
                        variant="outline"
                        className="border-transparent bg-[var(--lc-status-warning-bg)] text-[var(--lc-status-warning-fg)]"
                        title={data.mismatches.map((m) => m.detail).join(' · ')}
                      >
                        ▲ {data.mismatches.length} provided fields do not match account fields. Hover for details.
                      </Badge>
                    ) : (
                      <Badge status="published">● All provided fields match account fields.</Badge>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Reason */}
              <Card className="rounded-[var(--lc-radius-lg)] shadow-[var(--lc-elevation-sm)]">
                <CardHeader className="flex flex-row items-center justify-between gap-2 p-[var(--lc-space-xl)] pb-[var(--lc-space-md)]">
                  <CardTitle style={{ font: 'var(--lc-type-heading-3)' }}>Applicant&apos;s reason</CardTitle>
                  <Badge variant="secondary">{reasonCategoryLabel(data.reason_category)}</Badge>
                </CardHeader>
                <CardContent className="max-h-[200px] overflow-y-auto whitespace-pre-wrap p-[var(--lc-space-xl)] pt-0 text-[var(--lc-text-primary)]" style={{ font: 'var(--lc-type-body-lg)' }}>
                  {data.reason || '—'}
                </CardContent>
              </Card>

              {/* Evidence */}
              <Card className="rounded-[var(--lc-radius-lg)] shadow-[var(--lc-elevation-sm)]">
                <CardHeader className="p-[var(--lc-space-xl)] pb-[var(--lc-space-md)]">
                  <CardTitle style={{ font: 'var(--lc-type-heading-3)' }}>
                    Evidence · <Numeric>{data.evidence?.file_count ?? 0}</Numeric> files
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-[var(--lc-space-xl)] pt-0">
                  {(data.evidence?.file_count ?? 0) === 0 ? (
                    <div className="flex flex-col items-center gap-3 py-8 text-center">
                      <p className="font-medium text-[var(--lc-text-primary)]">No evidence uploaded</p>
                      <p className="max-w-md text-[var(--lc-text-muted)]" style={{ font: 'var(--lc-type-body-sm)' }}>
                        The applicant did not attach any files. Request specific evidence before deciding.
                      </p>
                      <Button
                        type="button"
                        variant="outline"
                        disabled={!canDecide || data.is_own}
                        onClick={() => {
                          setInfoEvidence(['id_front', 'id_back'])
                          setDialog('request-info')
                        }}
                      >
                        Request info →
                      </Button>
                    </div>
                  ) : (
                    <>
                      <div className="mb-4 flex gap-3 overflow-x-auto pb-2">
                        {data.evidence.files.map((file, idx) => (
                          <button
                            key={file.id || `${file.filename}-${idx}`}
                            type="button"
                            className="relative h-24 w-24 shrink-0 overflow-hidden rounded-[var(--lc-radius-md)] border border-[var(--lc-border)] bg-[var(--lc-surface-sunken)] hover:shadow-[var(--lc-elevation-sm)] focus-visible:outline-none"
                            aria-label={`Preview ${file.filename}`}
                            onClick={() => void openPreview(file)}
                          >
                            {isImageContent(file.content_type, file.filename) ? (
                              <ImageIcon className="mx-auto mt-6 h-8 w-8 text-[var(--lc-text-muted)]" aria-hidden />
                            ) : (
                              <FileText className="mx-auto mt-6 h-8 w-8 text-[var(--lc-text-muted)]" aria-hidden />
                            )}
                            <Badge
                              variant="secondary"
                              className="absolute bottom-1 left-1 px-1 py-0 text-[10px]"
                            >
                              {fileExt(file.filename) || '.bin'}
                            </Badge>
                          </button>
                        ))}
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-[var(--lc-border)] text-left text-[var(--lc-text-muted)]">
                              <th className="py-2 pr-3">Filename</th>
                              <th className="py-2 pr-3">Size</th>
                              <th className="py-2 pr-3">Uploaded</th>
                              <th className="py-2">Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {data.evidence.files.map((file, idx) => (
                              <tr key={file.id || `${file.filename}-${idx}`} className="border-b border-[var(--lc-border)]">
                                <td className="py-2 pr-3">
                                  <PIIMask
                                    value={file.filename}
                                    kind="evidence_filename"
                                    auditContext={{ caseId: data.id, field: 'name' }}
                                    onReveal={onReveal}
                                  />
                                </td>
                                <td className="py-2 pr-3">
                                  <Numeric>{formatBytes(file.size_bytes)}</Numeric>
                                </td>
                                <td className="py-2 pr-3">
                                  <Numeric title={file.uploaded_at || undefined}>
                                    {file.uploaded_at ? formatRelative(file.uploaded_at) : '—'}
                                  </Numeric>
                                </td>
                                <td className="py-2">
                                  <Button
                                    type="button"
                                    variant="link"
                                    className="h-auto px-0"
                                    onClick={() => void downloadEvidence(file)}
                                  >
                                    <Download className="mr-1 h-3.5 w-3.5" aria-hidden />
                                    Download
                                  </Button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>

              {/* Timeline */}
              <Card className="rounded-[var(--lc-radius-lg)] shadow-[var(--lc-elevation-sm)]">
                <CardContent className="p-[var(--lc-space-xl)]">
                  <Timeline
                    title="Automated challenge history"
                    entries={timelineEntries}
                    emptyLabel="This case skipped automated challenges — applicant selected 'lost all recovery contacts'."
                  />
                </CardContent>
              </Card>
            </div>

            {/* Right — decision panel */}
            <aside
              role="region"
              aria-labelledby="acr-decision-panel"
              className="lg:sticky lg:top-16 lg:self-start"
            >
              <Card
                className={cn(
                  'rounded-[var(--lc-radius-lg)] shadow-[var(--lc-elevation-sm)]',
                  showUndo &&
                    'ring-2 ring-[var(--lc-accent-bold-edge)] motion-safe:animate-pulse motion-reduce:animate-none',
                )}
                data-decision-panel
              >
                <CardHeader className="p-[var(--lc-space-xl)] pb-[var(--lc-space-md)]">
                  <p className="mb-2 text-[var(--lc-text-muted)]" style={{ font: 'var(--lc-type-overline)' }}>
                    Current state
                  </p>
                  <CardTitle id="acr-decision-panel" style={{ font: 'var(--lc-type-heading-3)' }}>
                    <Badge status={statusBadgeVariant(data.status)} className="text-base">
                      {statusLabel(data.status)}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-[var(--lc-space-sm)] p-[var(--lc-space-xl)] pt-0">
                  {requiresTwoPerson ? (
                    <TwoPersonProgress
                      firstApprover={firstApprover}
                      secondApprover={secondApprover}
                      pendingSecondLabel="Awaiting second reviewer"
                      pendingTone="draft"
                    />
                  ) : null}

                  {/* Reviewer strip */}
                  {requiresTwoPerson && pendingReview ? (
                    <p
                      className="rounded-[var(--lc-radius-md)] bg-[var(--lc-surface-sunken)] p-[var(--lc-space-sm)] text-[var(--lc-text-secondary)]"
                      style={{ font: 'var(--lc-type-body-sm)' }}
                      aria-live="polite"
                    >
                      {hasCastFirstVote
                        ? `You've cast your vote (${data.first_vote?.vote}). Awaiting second reviewer.`
                        : isSecondReviewer && data.first_vote?.vote === 'approve'
                          ? 'First reviewer approved this case. Your matching vote issues the recovery link immediately.'
                          : isSecondReviewer && data.first_vote?.vote === 'reject'
                            ? 'First reviewer rejected this case. Your matching vote closes the case.'
                            : 'Your vote will be recorded and the case will move to Awaiting second reviewer.'}
                    </p>
                  ) : null}

                  {data.is_own ? (
                    <p
                      className="rounded-[var(--lc-radius-md)] bg-[var(--lc-status-warning-bg)] p-[var(--lc-space-sm)] text-[var(--lc-status-warning-fg)]"
                      style={{ font: 'var(--lc-type-body-sm)' }}
                      data-own-case-block
                    >
                      <AlertTriangle className="mr-1 inline h-4 w-4" aria-hidden />
                      You can&apos;t decide your own recovery case.
                    </p>
                  ) : null}

                  {hasCastFirstVote && pendingReview ? (
                    <div className="flex flex-col gap-2">
                      <p className="text-[var(--lc-text-muted)]" style={{ font: 'var(--lc-type-body-sm)' }}>
                        You cast the first vote. A different PA must cast the second.
                      </p>
                      <Button type="button" variant="outline" onClick={() => setDialog('withdraw')}>
                        Withdraw my vote
                      </Button>
                    </div>
                  ) : null}

                  {showUndo ? (
                    <div className="flex flex-col gap-2" data-undo-grace>
                      <p style={{ font: 'var(--lc-type-body-sm)' }}>
                        Approved · Recovery link sent to {maskedContact} on {channel} · valid for 30 min
                      </p>
                      <Button type="button" variant="outline" disabled={busy} onClick={() => void submitUndo()}>
                        <Undo2 className="mr-1 h-4 w-4" aria-hidden />
                        Undo (<Numeric>{undoSeconds}</Numeric>s)
                      </Button>
                    </div>
                  ) : null}

                  {data.status === 'awaiting_info' ? (
                    <div className="flex flex-col gap-2">
                      <p style={{ font: 'var(--lc-type-body-sm)' }}>
                        First reviewer requested more info; the applicant is being contacted.
                      </p>
                      <Button type="button" variant="outline" onClick={() => setDialog('cancel-info')}>
                        Cancel request
                      </Button>
                    </div>
                  ) : null}

                  {isTerminalStatus(data.status) && !showUndo ? (
                    <div style={{ font: 'var(--lc-type-body-sm)' }} data-outcome-summary>
                      <p className="font-medium capitalize">{statusLabel(data.status)}</p>
                      {data.decision?.at ? (
                        <p className="text-[var(--lc-text-muted)]">
                          <Numeric title={data.decision.at}>{new Date(data.decision.at).toLocaleString()}</Numeric>
                          {data.decision.by ? ` · by ${initialsFromId(data.decision.by)}` : null}
                        </p>
                      ) : null}
                      {data.decision?.notes ? (
                        <p className="mt-2 whitespace-pre-wrap text-[var(--lc-text-secondary)]">{data.decision.notes}</p>
                      ) : null}
                      {data.escalation_case_id ? (
                        <p className="mt-2 text-[var(--lc-status-unpublished-fg)]">
                          Escalated — case {data.escalation_case_id}
                        </p>
                      ) : null}
                    </div>
                  ) : null}

                  {canDecide && !showUndo ? (
                    <div className="flex flex-col gap-[var(--lc-space-sm)]" data-decision-actions>
                      <Button
                        type="button"
                        variant="default"
                        className="w-full"
                        disabled={busy || data.is_own}
                        title={data.is_own ? "You can't decide your own recovery case." : undefined}
                        onClick={() => setDialog('approve')}
                        data-action="cast-vote-approve"
                      >
                        <Check className="mr-1 h-4 w-4" aria-hidden />
                        {isSecondApprovePath
                          ? 'Sign off & issue recovery link'
                          : 'Approve · Issue recovery link'}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full"
                        disabled={busy || data.is_own}
                        onClick={() => setDialog('request-info')}
                        data-action="request-info"
                      >
                        Request more info
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full border-[var(--lc-status-unpublished-fg)] text-[var(--lc-status-unpublished-fg)] hover:bg-[var(--lc-status-unpublished-bg)]"
                        disabled={busy || data.is_own}
                        onClick={() => setDialog('reject')}
                        data-action="cast-vote-reject"
                      >
                        <X className="mr-1 h-4 w-4" aria-hidden />
                        Reject
                      </Button>
                    </div>
                  ) : null}

                  <p className="mt-2 text-[var(--lc-text-muted)]" style={{ font: 'var(--lc-type-caption)' }}>
                    This decision was recorded to the immutable audit log. See PA-AUD-001 → case #
                    <Numeric>{last6}</Numeric>.
                  </p>
                </CardContent>
              </Card>
            </aside>
          </div>
        </>
      )}

      <span className="sr-only" aria-live="polite">
        {liveMessage}
      </span>

      {/* Approve dialog */}
      <Dialog open={dialog === 'approve'} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {isSecondApprovePath
                ? 'Sign off on this high-value recovery?'
                : 'Approve this recovery request?'}
            </DialogTitle>
            <DialogDescription>
              {isSecondApprovePath ? (
                <span className="mb-2 block font-medium text-[var(--lc-text-primary)]">
                  You are the second reviewer for this high-value case.
                </span>
              ) : requiresTwoPerson && !data?.first_vote ? (
                <span className="mb-2 block font-medium text-[var(--lc-text-primary)]">
                  You are casting the FIRST vote on a high-value case.
                </span>
              ) : null}
              This will issue a recovery link on {channel} to {maskedContact}. The link is valid for 30
              minutes and can be used once.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="approve-notes">Notes (recorded to audit, not shown to applicant)</Label>
            <textarea
              id="approve-notes"
              className="min-h-[88px] w-full rounded-[var(--lc-radius-md)] border border-[var(--lc-border-strong)] bg-[var(--lc-surface)] p-3 text-sm"
              value={approveNotes}
              onChange={(e) => setApproveNotes(e.target.value)}
            />
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setDialog(null)}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={busy}
              data-confirm-cast-vote="approve"
              onClick={() => void submitCastVote('approve', approveNotes)}
            >
              {busy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" aria-hidden /> : null}
              {isSecondApprovePath ? 'Sign off & issue recovery link' : 'Issue recovery link'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Reject dialog */}
      <Dialog open={dialog === 'reject'} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject this recovery request</DialogTitle>
            <DialogDescription>
              The applicant will be notified on {channel} that their request was declined. Your notes are
              shared verbatim.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="reject-reason">Reason (shown to applicant)</Label>
              <select
                id="reject-reason"
                className="mt-1 min-h-tap w-full rounded-[var(--lc-radius-md)] border border-[var(--lc-border-strong)] bg-[var(--lc-surface)] px-3"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
              >
                {REJECT_REASONS.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="reject-notes">Notes for the applicant</Label>
              <p className="text-[var(--lc-text-muted)]" style={{ font: 'var(--lc-type-caption)' }}>
                Required, ≥10 characters. Kind and clear beats terse.
              </p>
              <textarea
                id="reject-notes"
                className="mt-1 min-h-[88px] w-full rounded-[var(--lc-radius-md)] border border-[var(--lc-border-strong)] bg-[var(--lc-surface)] p-3 text-sm"
                value={rejectNotes}
                onChange={(e) => setRejectNotes(e.target.value)}
              />
            </div>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setDialog(null)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={busy || rejectNotes.trim().length < 10}
              data-confirm-cast-vote="reject"
              onClick={() => {
                const label = REJECT_REASONS.find((r) => r.value === rejectReason)?.label || rejectReason
                void submitCastVote('reject', `[${label}] ${rejectNotes.trim()}`)
              }}
            >
              Reject request
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Request info dialog */}
      <Dialog open={dialog === 'request-info'} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request more info from applicant</DialogTitle>
            <DialogDescription>
              The applicant will be notified on {channel} with the evidence they need to add. The case
              moves to Awaiting info until they respond.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="info-reason">Reason</Label>
              <select
                id="info-reason"
                className="mt-1 min-h-tap w-full rounded-[var(--lc-radius-md)] border border-[var(--lc-border-strong)] bg-[var(--lc-surface)] px-3"
                value={infoReason}
                onChange={(e) => setInfoReason(e.target.value)}
              >
                {INFO_REASONS.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>
            <fieldset>
              <legend className="text-sm font-medium">Evidence to request</legend>
              <div className="mt-2 grid gap-2">
                {EVIDENCE_OPTIONS.map((opt) => (
                  <label key={opt.value} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={infoEvidence.includes(opt.value)}
                      onChange={(e) => {
                        setInfoEvidence((prev) =>
                          e.target.checked
                            ? [...prev, opt.value]
                            : prev.filter((v) => v !== opt.value),
                        )
                      }}
                    />
                    {opt.label}
                  </label>
                ))}
              </div>
            </fieldset>
            <div>
              <Label htmlFor="info-notes">Notes for the applicant (optional)</Label>
              <textarea
                id="info-notes"
                className="mt-1 min-h-[72px] w-full rounded-[var(--lc-radius-md)] border border-[var(--lc-border-strong)] bg-[var(--lc-surface)] p-3 text-sm"
                value={infoNotes}
                onChange={(e) => setInfoNotes(e.target.value)}
              />
            </div>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setDialog(null)}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={busy || infoEvidence.length === 0}
              onClick={() => void submitRequestInfo()}
            >
              Send request
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Withdraw */}
      <Dialog open={dialog === 'withdraw'} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Withdraw your vote?</DialogTitle>
            <DialogDescription>
              The case returns to Pending review with no first vote recorded.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setDialog(null)}>
              Cancel
            </Button>
            <Button type="button" disabled={busy} onClick={() => void submitWithdraw()}>
              Withdraw vote
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Cancel info */}
      <Dialog open={dialog === 'cancel-info'} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel the info request?</DialogTitle>
            <DialogDescription>
              The case returns to Pending review and the applicant is notified the request was withdrawn.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setDialog(null)}>
              Cancel
            </Button>
            <Button type="button" disabled={busy} onClick={() => void submitCancelInfo()}>
              Cancel request
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Evidence preview — blob from authenticated proxy only */}
      <Dialog
        open={Boolean(previewFile)}
        onOpenChange={(o) => {
          if (!o) {
            setPreviewFile(null)
            if (previewUrlRef.current) {
              URL.revokeObjectURL(previewUrlRef.current)
              previewUrlRef.current = null
            }
            setPreviewUrl(null)
          }
        }}
      >
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{previewFile?.filename || 'Evidence'}</DialogTitle>
            <DialogDescription>
              {previewFile ? (
                <>
                  <Numeric>{formatBytes(previewFile.size_bytes)}</Numeric>
                  {' · served via authenticated evidence proxy (never a public URL)'}
                </>
              ) : null}
            </DialogDescription>
          </DialogHeader>
          {previewLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-[var(--lc-text-muted)]" aria-hidden />
            </div>
          ) : previewUrl && previewFile && isImageContent(previewFile.content_type, previewFile.filename) ? (
            <img
              src={previewUrl}
              alt={`Applicant-uploaded evidence: ${previewFile.filename}`}
              className="mx-auto max-h-[70vh] max-w-full object-contain"
            />
          ) : previewUrl && previewFile && isPdf(previewFile.content_type, previewFile.filename) ? (
            <iframe title={previewFile.filename} src={previewUrl} className="h-[70vh] w-full rounded-[var(--lc-radius-md)]" />
          ) : previewFile ? (
            <div className="flex flex-col items-center gap-3 py-8">
              <FileText className="h-10 w-10 text-[var(--lc-text-muted)]" aria-hidden />
              <p className="text-[var(--lc-text-muted)]">Preview not available for this type.</p>
              <Button type="button" variant="outline" onClick={() => void downloadEvidence(previewFile)}>
                Download
              </Button>
            </div>
          ) : null}
          <div className="mt-4 flex justify-end gap-2">
            {previewFile ? (
              <Button type="button" variant="outline" onClick={() => void downloadEvidence(previewFile)}>
                Download
              </Button>
            ) : null}
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setPreviewFile(null)
                setPreviewUrl(null)
              }}
            >
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
