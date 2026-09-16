import { useCallback, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { AlertTriangle, Ban, CheckCircle2, ChevronRight, Hourglass, XCircle } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Numeric } from '@/components/ui/numeric'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useToast } from '@/components/ui/toast'
import { formatRelativeAbsolute, formatAbsoluteTimestamp } from '@/components/recipient/formatRelativeAbsolute'
import {
  OwnershipTransferChallenge,
  type OwnershipTransferProofs,
} from '@/components/agency/OwnershipTransferChallenge'
import {
  OwnershipImpactBanner,
  ReversalWindowNotice,
  TerminalStateCard,
} from '@/components/agency/OwnershipTransferShared'
import { useAuth } from '@/context/AuthContext'
import { useOwnershipTransfer } from '@/hooks/useOwnershipTransfer'
import { useStepUpPrompt } from '@/hooks/useStepUpPrompt'
import { useOwnershipTransferCopy } from './ownershipTransferCopy'
import { ConfirmDialog } from './AgencyOwnershipTransferInitiatorPage'

const DECLINE_MIN = 20
const DECLINE_MAX = 500

function monogram(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase()
  return `${parts[0]![0] ?? ''}${parts[1]![0] ?? ''}`.toUpperCase()
}

export function AgencyOwnershipTransferAcceptPage() {
  const { transferId } = useParams<{ transferId: string }>()
  const navigate = useNavigate()
  const { agent } = useAuth()
  const { addToast } = useToast()
  const { t } = useOwnershipTransferCopy()
  const { modal: stepUpModal, requestElevation } = useStepUpPrompt('accept ownership')

  const { state, offline, sendOtp, accept, decline } = useOwnershipTransfer(agent?.id, agent?.email)

  const [proofs, setProofs] = useState<OwnershipTransferProofs | null>(null)
  const [consent, setConsent] = useState(false)
  const [acceptConfirmOpen, setAcceptConfirmOpen] = useState(false)
  const [declineOpen, setDeclineOpen] = useState(false)
  const [declineReason, setDeclineReason] = useState('')
  const [accepting, setAccepting] = useState(false)
  const [declining, setDeclining] = useState(false)

  const agency = state.status === 'ready' ? state.agency : null
  const data = state.status === 'ready' ? state.data : null
  const transfer = data?.transfer ?? null
  const matches = transfer && transfer.id === transferId
  const isTarget = matches && transfer.target.user_id === agency?.myUserId

  const doAccept = useCallback(async () => {
    if (!proofs || !transferId) return
    setAcceptConfirmOpen(false)
    setAccepting(true)
    try {
      await accept(transferId, { otp_code: proofs.otpCode, typed_agency_name: proofs.typedAgencyName })
      addToast({ title: t('recv.toast.accepted', { agency: agency?.agencyName ?? '' }), variant: 'success' })
      navigate(`/inbox/ownership-transfers/${encodeURIComponent(transferId)}`)
    } catch (err) {
      addToast({
        title: t('recv.toast.acceptFailed'),
        description: err instanceof Error ? err.message : undefined,
        variant: 'error',
      })
      setAccepting(false)
    }
  }, [proofs, transferId, accept, addToast, t, agency, navigate])

  const doDecline = useCallback(async () => {
    if (!transferId || declineReason.trim().length < DECLINE_MIN) return
    setDeclineOpen(false)
    setDeclining(true)
    try {
      const initiatorName = transfer?.initiator.display_name ?? ''
      await decline(transferId, declineReason.trim())
      addToast({ title: t('recv.toast.declined', { initiator: initiatorName }), variant: 'default' })
      navigate('/dashboard')
    } catch (err) {
      addToast({
        title: t('recv.toast.declineFailed'),
        description: err instanceof Error ? err.message : undefined,
        variant: 'error',
      })
      setDeclining(false)
    }
  }, [transferId, declineReason, transfer, decline, addToast, t, navigate])

  if (state.status === 'loading') {
    return <AcceptStatus label={t('loading.label')} busy />
  }

  const shell = (children: React.ReactNode) => (
    <div className="min-h-full bg-[var(--lc-bg-page)]">
      {stepUpModal}
      {offline ? (
        <div
          role="status"
          className="border-b border-[var(--lc-border)] bg-[var(--lc-surface-sunken)] px-[var(--lc-space-md)] py-[var(--lc-space-xs)] text-center text-[var(--lc-text-muted)]"
          style={{ font: 'var(--lc-type-caption)' }}
        >
          {t('offline.banner')}
        </div>
      ) : null}
      <header className="sticky top-0 z-sticky flex h-12 items-center gap-2 border-b border-[var(--lc-border)] bg-[var(--lc-surface-raised)] px-[var(--lc-space-sm)]">
        <Button
          type="button"
          variant="ghost"
          className="min-h-tap min-w-tap px-2"
          aria-label={t('nav.back')}
          onClick={() => navigate('/inbox')}
        >
          <ChevronRight className="h-5 w-5 rotate-180 rtl:rotate-0" aria-hidden="true" />
        </Button>
        <nav aria-label="Breadcrumb" className="text-[var(--lc-text-muted)]" style={{ font: 'var(--lc-type-caption)' }}>
          {t('recv.breadcrumb')}
        </nav>
      </header>
      <main className="mx-auto max-w-[720px] px-[var(--lc-space-md)] py-[var(--lc-space-xl)]">{children}</main>
    </div>
  )

  const backToInbox = { label: t('recv.terminal.backToInbox'), onClick: () => navigate('/inbox') }

  // Invalid / not-found / wrong-recipient
  if (state.status === 'error' || !agency || !data || !transfer || !matches) {
    return shell(
      <TerminalStateCard
        glyph={AlertTriangle}
        title={t('recv.terminal.invalid.title')}
        body={t('recv.terminal.invalid.body')}
        primary={backToInbox}
      />,
    )
  }
  if (!isTarget) {
    return shell(
      <TerminalStateCard glyph={Ban} title={t('recv.terminal.wrongRecipient.title')} primary={backToInbox} />,
    )
  }

  const resolvedDate = formatAbsoluteTimestamp(
    transfer.decided_at ?? transfer.resolved_at ?? transfer.initiated_at,
  )
  if (transfer.status === 'cancelled') {
    return shell(
      <TerminalStateCard
        glyph={Ban}
        title={t('recv.terminal.cancelled.title', { initiator: transfer.initiator.display_name ?? '', date: resolvedDate })}
        primary={backToInbox}
      />,
    )
  }
  if (transfer.status === 'expired') {
    return shell(
      <TerminalStateCard
        glyph={Hourglass}
        title={t('recv.terminal.expired.title', { date: formatAbsoluteTimestamp(transfer.expires_at) })}
        primary={backToInbox}
      />,
    )
  }
  if (transfer.status === 'executed') {
    return shell(
      <TerminalStateCard
        glyph={CheckCircle2}
        title={t('recv.terminal.accepted.title', { date: resolvedDate, agency: agency.agencyName })}
        primary={{ label: t('recv.terminal.goDashboard'), onClick: () => navigate('/dashboard') }}
      />,
    )
  }
  if (transfer.status === 'declined' || transfer.status === 'reversed') {
    return shell(
      <TerminalStateCard
        glyph={XCircle}
        title={
          transfer.status === 'declined'
            ? t('recv.terminal.declined.title', { date: resolvedDate })
            : t('recv.terminal.invalid.title')
        }
        primary={backToInbox}
      />,
    )
  }

  // ── pending → accept form ────────────────────────────────────────────────
  const initiatorName = transfer.initiator.display_name ?? ''
  const acceptValid = proofs != null && consent
  const declineValid = declineReason.trim().length >= DECLINE_MIN

  return shell(
    <div className="space-y-[var(--lc-space-xl)]">
      <p className="lg:hidden rounded-[var(--lc-radius-md)] bg-[var(--lc-surface-sunken)] p-[var(--lc-space-sm)] text-[var(--lc-text-muted)]" style={{ font: 'var(--lc-type-caption)' }}>
        {t('advisory.mobile')}
      </p>
      <div>
        <h1 className="text-[var(--lc-text-heading)]" style={{ font: 'var(--lc-type-display)' }}>
          {t('recv.h1', { initiator: initiatorName, agency: agency.agencyName })}
        </h1>
        <p className="mt-[var(--lc-space-xs)] text-[var(--lc-text-secondary)]" style={{ font: 'var(--lc-type-body-lg)' }}>
          {t('recv.sub')}
        </p>
      </div>

      {/* Initiator identity card */}
      <section className="rounded-[var(--lc-radius-lg)] bg-[var(--lc-surface-raised)] p-[var(--lc-space-lg)] shadow-[var(--lc-elevation-sm)]">
        <div className="flex items-center gap-[var(--lc-space-md)]">
          <Avatar className="h-12 w-12 rounded-[var(--lc-radius-md)]">
            {transfer.initiator.avatar_url ? <AvatarImage src={transfer.initiator.avatar_url} alt="" /> : null}
            <AvatarFallback>{monogram(initiatorName)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="text-[var(--lc-text-heading)]" style={{ font: 'var(--lc-type-heading-3)' }}>
              {initiatorName}
            </p>
            <Numeric className="text-[var(--lc-text-muted)]" style={{ font: 'var(--lc-type-caption)' }}>
              {t('recv.identity.subheader', { agency: agency.agencyName, rel: formatRelativeAbsolute(transfer.initiated_at) })}
            </Numeric>
          </div>
        </div>
        <p className="mt-[var(--lc-space-md)] text-[var(--lc-text-secondary)]" style={{ font: 'var(--lc-type-overline)' }}>
          {t('recv.rationale.header', { initiator: initiatorName })}
        </p>
        <blockquote
          aria-label={`Rationale from ${initiatorName}`}
          className="mt-[var(--lc-space-2xs)] whitespace-pre-line ps-[var(--lc-space-md)] italic text-[var(--lc-text-secondary)]"
          style={{ font: 'var(--lc-type-body)', borderInlineStart: '3px solid var(--lc-border-strong)' }}
        >
          {transfer.rationale}
        </blockquote>
      </section>

      <OwnershipImpactBanner perspective="recipient" agencyName={agency.agencyName} otherName={initiatorName} />
      <ReversalWindowNotice perspective="recipient" />

      <section className="space-y-[var(--lc-space-sm)]">
        <h2 className="text-[var(--lc-text-heading)]" style={{ font: 'var(--lc-type-heading-3)' }}>
          {t('init.section.identity')}
        </h2>
        <p className="text-[var(--lc-text-secondary)]" style={{ font: 'var(--lc-type-body-sm)' }}>
          {t('init.identity.sub')}
        </p>
        <OwnershipTransferChallenge
          agencyName={agency.agencyName}
          ownerEmailMasked={agency.ownerEmailMasked}
          onAllComplete={setProofs}
          onReset={() => setProofs(null)}
          onStepUp={requestElevation}
          onSendOtp={sendOtp}
        />
      </section>

      <label className="flex items-start gap-[var(--lc-space-sm)]">
        <Checkbox checked={consent} onCheckedChange={(v) => setConsent(v === true)} aria-labelledby="recv-consent-text" />
        <span id="recv-consent-text" className="text-[var(--lc-text-primary)]" style={{ font: 'var(--lc-type-body-sm)' }}>
          {t('recv.consent', { agency: agency.agencyName })}
        </span>
      </label>

      <div className="flex flex-col-reverse items-stretch gap-[var(--lc-space-sm)] sm:flex-row sm:items-center sm:justify-end">
        <Button type="button" variant="outline" disabled={declining || accepting} onClick={() => setDeclineOpen(true)}>
          {t('recv.decline')}
        </Button>
        <Button
          type="button"
          variant="destructive"
          className="sm:max-w-[320px]"
          disabled={!acceptValid || accepting || declining || offline}
          aria-disabled={!acceptValid || accepting || declining || offline}
          aria-describedby={!acceptValid ? 'recv-accept-missing' : undefined}
          onClick={() => setAcceptConfirmOpen(true)}
        >
          {accepting ? t('recv.accept.busy') : t('recv.accept')}
        </Button>
      </div>
      {!acceptValid ? (
        <p id="recv-accept-missing" className="sr-only">
          {t('recv.accept.missing')}
        </p>
      ) : null}

      <p className="pt-[var(--lc-space-md)] text-center">
        <Link to="/support?context=ownership-transfer" className="text-[var(--lc-text-brand)] underline-offset-2 hover:underline" style={{ font: 'var(--lc-type-body-sm)' }}>
          {t('support.link')}
        </Link>
      </p>

      <ConfirmDialog
        open={acceptConfirmOpen}
        onOpenChange={setAcceptConfirmOpen}
        title={t('recv.accept.confirm.title', { agency: agency.agencyName })}
        body={t('recv.accept.confirm.body', { initiator: initiatorName })}
        confirmLabel={t('recv.accept.confirm.confirm')}
        cancelLabel={t('recv.accept.confirm.cancel')}
        destructive
        onConfirm={() => void doAccept()}
      />

      <Dialog open={declineOpen} onOpenChange={setDeclineOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('recv.decline.title')}</DialogTitle>
            <DialogDescription>{t('recv.decline.body', { initiator: initiatorName })}</DialogDescription>
          </DialogHeader>
          <Label htmlFor="decline-reason" className="mt-[var(--lc-space-sm)] block text-[var(--lc-text-primary)]" style={{ font: 'var(--lc-type-overline)' }}>
            {t('recv.decline.reason.label', { initiator: initiatorName })}
          </Label>
          <textarea
            id="decline-reason"
            rows={4}
            maxLength={DECLINE_MAX}
            value={declineReason}
            onChange={(e) => setDeclineReason(e.target.value)}
            placeholder={t('recv.decline.reason.placeholder')}
            autoFocus
            className="mt-1 w-full rounded-[var(--lc-radius-md)] border border-[var(--lc-border-strong)] bg-[var(--lc-surface)] px-3 py-2 text-[var(--lc-text-primary)]"
            style={{ font: 'var(--lc-type-body)' }}
            aria-describedby="decline-reason-counter"
          />
          <Numeric id="decline-reason-counter" className="mt-1 block text-end text-[var(--lc-text-muted)]" style={{ font: 'var(--lc-type-caption)' }} aria-live="polite">
            {t('recv.decline.reason.counter', { n: declineReason.trim().length })}
          </Numeric>
          <div className="mt-[var(--lc-space-md)] flex flex-col-reverse gap-[var(--lc-space-sm)] sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={() => setDeclineOpen(false)}>
              {t('recv.decline.cancel')}
            </Button>
            <Button type="button" variant="outline" disabled={!declineValid || declining} onClick={() => void doDecline()}>
              {t('recv.decline.confirm')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>,
  )
}

function AcceptStatus({ label, busy }: { label: string; busy?: boolean }) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center bg-[var(--lc-bg-page)]" aria-busy={busy || undefined}>
      <p className="text-[var(--lc-text-muted)]" style={{ font: 'var(--lc-type-body)' }}>
        {label}
      </p>
    </div>
  )
}

export default AgencyOwnershipTransferAcceptPage
