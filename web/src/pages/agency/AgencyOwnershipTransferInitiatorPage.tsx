import { useCallback, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AlertOctagon, ChevronRight, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Numeric } from '@/components/ui/numeric'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useToast } from '@/components/ui/toast'
import { OutcomeTimeline, type OutcomeTimelineEvent } from '@/components/recipient'
import { formatRelativeAbsolute, formatAbsoluteTimestamp } from '@/components/recipient/formatRelativeAbsolute'
import {
  OwnershipTransferChallenge,
  type OwnershipTransferProofs,
} from '@/components/agency/OwnershipTransferChallenge'
import {
  OwnershipImpactBanner,
  ReversalWindowNotice,
} from '@/components/agency/OwnershipTransferShared'
import { useAuth } from '@/context/AuthContext'
import { useOwnershipTransfer } from '@/hooks/useOwnershipTransfer'
import { useStepUpPrompt } from '@/hooks/useStepUpPrompt'
import { useOwnershipTransferCopy } from './ownershipTransferCopy'

const RATIONALE_MIN = 20
const RATIONALE_MAX = 500

export function AgencyOwnershipTransferInitiatorPage() {
  const navigate = useNavigate()
  const { agent } = useAuth()
  const { addToast } = useToast()
  const { t } = useOwnershipTransferCopy()
  const { modal: stepUpModal, requestElevation } = useStepUpPrompt('transfer ownership')

  const {
    state,
    offline,
    reload,
    sendOtp,
    initiate,
    cancel,
    acknowledge,
  } = useOwnershipTransfer(agent?.id, agent?.email)

  const [targetId, setTargetId] = useState('')
  const [rationale, setRationale] = useState('')
  const [proofs, setProofs] = useState<OwnershipTransferProofs | null>(null)
  const [consent, setConsent] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [cancelFormOpen, setCancelFormOpen] = useState(false)
  const [cancelReqOpen, setCancelReqOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [busy, setBusy] = useState(false)

  const agency = state.status === 'ready' ? state.agency : null
  const data = state.status === 'ready' ? state.data : null
  const transfer = data?.transfer ?? null

  const targetName = useMemo(() => {
    const found = agency?.eligibleAdmins.find((a) => a.user_id === targetId)
    return found?.display_name ?? ''
  }, [agency, targetId])

  const rationaleLen = rationale.trim().length
  const rationaleValid = rationaleLen >= RATIONALE_MIN && rationaleLen <= RATIONALE_MAX
  const formValid = Boolean(targetId) && rationaleValid && proofs != null && consent

  const doSubmit = useCallback(async () => {
    if (!proofs || !targetId) return
    setConfirmOpen(false)
    setSubmitting(true)
    try {
      await initiate({
        target_user_id: targetId,
        rationale: rationale.trim(),
        otp_code: proofs.otpCode,
        typed_agency_name: proofs.typedAgencyName,
      })
      addToast({ title: t('init.toast.sent', { target: targetName }), variant: 'success' })
    } catch (err) {
      addToast({
        title: t('init.toast.failed'),
        description: err instanceof Error ? err.message : undefined,
        variant: 'error',
      })
    } finally {
      setSubmitting(false)
    }
  }, [proofs, targetId, rationale, targetName, initiate, addToast, t])

  // ── Loading / error / forbidden ─────────────────────────────────────────
  if (state.status === 'loading') {
    return <FullPageStatus label={t('loading.label')} busy />
  }
  if (state.status === 'forbidden' || (data && !data.eligibility.caller_is_owner && transfer?.status !== 'pending')) {
    return (
      <FullPageMessage
        title={t('init.notOwner.title')}
        cta={{ label: t('init.notOwner.cta'), to: '/agency' }}
      />
    )
  }
  if (state.status === 'error' || !agency || !data) {
    return (
      <FullPageMessage
        title={t('error.title')}
        action={{ label: t('error.retry'), onClick: () => void reload() }}
      />
    )
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
          onClick={() => navigate('/agency')}
        >
          <ChevronRight className="h-5 w-5 rotate-180 rtl:rotate-0" aria-hidden="true" />
        </Button>
        <nav aria-label="Breadcrumb" className="text-[var(--lc-text-muted)]" style={{ font: 'var(--lc-type-caption)' }}>
          {t('init.breadcrumb')}
        </nav>
      </header>
      <main className="mx-auto max-w-[720px] px-[var(--lc-space-md)] py-[var(--lc-space-xl)]">
        {children}
      </main>
    </div>
  )

  // ── PENDING-RECIPIENT-ACCEPT ────────────────────────────────────────────
  if (transfer && transfer.status === 'pending') {
    const other = transfer.target.display_name ?? targetName ?? ''
    const timeline: OutcomeTimelineEvent[] = [
      { key: 'initiated', label: t('pending.timeline.initiated'), timestamp: transfer.initiated_at, state: 'complete' },
      { key: 'sent', label: t('pending.timeline.sent', { target: other }), timestamp: transfer.initiated_at, state: 'complete' },
      { key: 'awaiting', label: t('pending.timeline.awaiting'), state: 'current' },
    ]
    return shell(
      <div className="space-y-[var(--lc-space-lg)]">
        <div className="flex items-start gap-[var(--lc-space-md)] rounded-[var(--lc-radius-lg)] bg-[var(--lc-surface-raised)] p-[var(--lc-space-lg)] shadow-[var(--lc-elevation-sm)]">
          <Clock className="h-7 w-7 shrink-0 text-[var(--lc-text-primary)]" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <h1 className="text-[var(--lc-text-heading)]" style={{ font: 'var(--lc-type-heading-2)' }}>
              {t('pending.heading', { target: other })}
            </h1>
            <Numeric className="mt-[var(--lc-space-xs)] block text-[var(--lc-text-muted)]" style={{ font: 'var(--lc-type-caption)' }}>
              {t('pending.sub', {
                rel: formatRelativeAbsolute(transfer.initiated_at),
                expiry: formatAbsoluteTimestamp(transfer.expires_at),
              })}
            </Numeric>
          </div>
        </div>
        <OutcomeTimeline events={timeline} />
        <ReversalWindowNotice perspective="initiator" />
        <div>
          <Button
            type="button"
            variant="ghost"
            className="text-[var(--lc-text-muted)]"
            disabled={offline || busy}
            onClick={() => setCancelReqOpen(true)}
          >
            {t('pending.cancelRequest')}
          </Button>
        </div>
        <SupportLink label={t('support.link')} />

        <ConfirmDialog
          open={cancelReqOpen}
          onOpenChange={setCancelReqOpen}
          title={t('init.cancelDialog.title')}
          body={t('init.cancelDialog.body')}
          confirmLabel={t('init.cancelDialog.confirm')}
          cancelLabel={t('init.cancelDialog.reject')}
          onConfirm={() => {
            setCancelReqOpen(false)
            setBusy(true)
            void cancel(transfer.id)
              .then(() => addToast({ title: t('pending.toast.cancelled'), variant: 'default' }))
              .catch((err: unknown) =>
                addToast({ title: err instanceof Error ? err.message : 'Cancel failed', variant: 'error' }),
              )
              .finally(() => setBusy(false))
          }}
        />
      </div>,
    )
  }

  // ── TARGET-REFUSED / EXPIRED (unacknowledged) ───────────────────────────
  if (
    transfer &&
    (transfer.status === 'declined' || transfer.status === 'expired') &&
    !transfer.acknowledged_by_initiator
  ) {
    const other = transfer.target.display_name ?? ''
    const declined = transfer.status === 'declined'
    return shell(
      <div className="space-y-[var(--lc-space-lg)]">
        <div className="rounded-[var(--lc-radius-lg)] border border-[var(--lc-border)] bg-[var(--lc-surface-raised)] p-[var(--lc-space-lg)] shadow-[var(--lc-elevation-sm)]">
          <h1 className="text-[var(--lc-text-heading)]" style={{ font: 'var(--lc-type-heading-2)' }}>
            {t(declined ? 'refused.declined.title' : 'refused.expired.title', { target: other })}
          </h1>
          <p className="mt-[var(--lc-space-sm)] text-[var(--lc-text-secondary)]" style={{ font: 'var(--lc-type-body)' }}>
            {declined
              ? t('refused.declined.body', {
                  target: other,
                  date: formatAbsoluteTimestamp(transfer.decided_at ?? transfer.resolved_at ?? transfer.initiated_at),
                  reason: transfer.decline_reason ?? '',
                })
              : t('refused.expired.body', {
                  target: other,
                  date: formatAbsoluteTimestamp(transfer.expires_at),
                })}
          </p>
        </div>
        <Button
          type="button"
          variant="default"
          disabled={offline || busy}
          onClick={() => {
            setBusy(true)
            void acknowledge(transfer.id)
              .catch(() => {})
              .finally(() => setBusy(false))
          }}
        >
          {t('refused.startNew')}
        </Button>
        <SupportLink label={t('support.link')} />
      </div>,
    )
  }

  // ── Empty state: no eligible admins ─────────────────────────────────────
  if (agency.eligibleAdmins.length === 0 || data.eligibility.block_reason === 'no_eligible_admins') {
    return shell(
      <div className="space-y-[var(--lc-space-lg)]">
        <PageHeading title={t('init.h1', { agency: agency.agencyName })} sub={t('init.sub')} />
        <div className="rounded-[var(--lc-radius-lg)] border border-[var(--lc-border)] bg-[var(--lc-surface-sunken)] p-[var(--lc-space-lg)]">
          <p className="text-[var(--lc-text-secondary)]" style={{ font: 'var(--lc-type-body)' }}>
            {t('init.target.empty')}
          </p>
          <Button asChild variant="outline" className="mt-[var(--lc-space-md)]">
            <Link to="/agency/members/applications">{t('init.section.target')}</Link>
          </Button>
        </div>
      </div>,
    )
  }

  // ── Block: agency suspended ─────────────────────────────────────────────
  if (data.eligibility.block_reason === 'agency_suspended') {
    return shell(
      <div className="space-y-[var(--lc-space-lg)]">
        <PageHeading title={t('init.h1', { agency: agency.agencyName })} sub={t('init.sub')} />
        <div
          className="rounded-[var(--lc-radius-lg)] bg-[var(--lc-surface-raised)] p-[var(--lc-space-lg)] shadow-[var(--lc-elevation-sm)]"
          style={{ borderInlineStart: '4px solid var(--lc-status-unpublished-fg)' }}
        >
          <p className="text-[var(--lc-text-primary)]" style={{ font: 'var(--lc-type-body)' }}>
            {t('init.block.suspended')}
          </p>
        </div>
        <SupportLink label={t('support.link')} />
      </div>,
    )
  }

  // ── INITIAL form ────────────────────────────────────────────────────────
  const vars = { agency: agency.agencyName, target: targetName || '…' }
  return shell(
    <div className="space-y-[var(--lc-space-xl)]">
      <p className="lg:hidden rounded-[var(--lc-radius-md)] bg-[var(--lc-surface-sunken)] p-[var(--lc-space-sm)] text-[var(--lc-text-muted)]" style={{ font: 'var(--lc-type-caption)' }}>
        {t('advisory.mobile')}
      </p>
      <PageHeading title={t('init.h1', { agency: agency.agencyName })} sub={t('init.sub')} />
      <OwnershipImpactBanner perspective="initiator" agencyName={agency.agencyName} otherName={targetName || '…'} />
      <ReversalWindowNotice perspective="initiator" />

      <section className="space-y-[var(--lc-space-sm)]">
        <h2 className="text-[var(--lc-text-heading)]" style={{ font: 'var(--lc-type-heading-3)' }}>
          {t('init.section.target')}
        </h2>
        <Label htmlFor="ownership-target" className="sr-only">
          {t('init.section.target')}
        </Label>
        <select
          id="ownership-target"
          value={targetId}
          onChange={(e) => setTargetId(e.target.value)}
          className="min-h-tap w-full rounded-[var(--lc-radius-md)] border border-[var(--lc-border-strong)] bg-[var(--lc-surface)] px-3 py-2 text-[var(--lc-text-primary)]"
          style={{ font: 'var(--lc-type-body)' }}
        >
          <option value="">{t('init.target.placeholder')}</option>
          {agency.eligibleAdmins.map((a) => (
            <option key={a.user_id} value={a.user_id}>
              {a.display_name} · {t(a.role === 'senior_admin' ? 'init.role.senior_admin' : 'init.role.admin')}
            </option>
          ))}
        </select>
        <p className="text-[var(--lc-text-muted)]" style={{ font: 'var(--lc-type-caption)' }}>
          {t('init.target.helper')}
        </p>
      </section>

      <section className="space-y-[var(--lc-space-sm)]">
        <h2 className="text-[var(--lc-text-heading)]" style={{ font: 'var(--lc-type-heading-3)' }}>
          {t('init.section.rationale')}
        </h2>
        <Label htmlFor="ownership-rationale" className="sr-only">
          {t('init.section.rationale')}
        </Label>
        <textarea
          id="ownership-rationale"
          rows={4}
          maxLength={RATIONALE_MAX}
          value={rationale}
          onChange={(e) => setRationale(e.target.value)}
          placeholder={t('init.rationale.placeholder')}
          className="w-full rounded-[var(--lc-radius-md)] border border-[var(--lc-border-strong)] bg-[var(--lc-surface)] px-3 py-2 text-[var(--lc-text-primary)]"
          style={{ font: 'var(--lc-type-body)' }}
          aria-describedby="ownership-rationale-helper ownership-rationale-counter"
        />
        <div className="flex items-start justify-between gap-2">
          <p id="ownership-rationale-helper" className="text-[var(--lc-text-muted)]" style={{ font: 'var(--lc-type-caption)' }}>
            {t('init.rationale.helper', { target: targetName || '…' })}
          </p>
          <Numeric id="ownership-rationale-counter" className="shrink-0 text-[var(--lc-text-muted)]" style={{ font: 'var(--lc-type-caption)' }} aria-live="polite">
            {t('init.rationale.counter', { n: rationaleLen })}
          </Numeric>
        </div>
      </section>

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
        <Checkbox checked={consent} onCheckedChange={(v) => setConsent(v === true)} aria-labelledby="ownership-consent-text" />
        <span id="ownership-consent-text" className="text-[var(--lc-text-primary)]" style={{ font: 'var(--lc-type-body-sm)' }}>
          {t('init.consent', vars)}
        </span>
      </label>

      <div className="flex flex-col-reverse items-stretch gap-[var(--lc-space-sm)] sm:flex-row sm:items-center sm:justify-end">
        <Button type="button" variant="ghost" className="text-[var(--lc-text-muted)]" onClick={() => setCancelFormOpen(true)}>
          {t('init.cancel')}
        </Button>
        <Button
          type="button"
          variant="destructive"
          className="sm:max-w-[320px]"
          disabled={!formValid || submitting || offline}
          aria-disabled={!formValid || submitting || offline}
          aria-describedby={!formValid ? 'ownership-submit-missing' : undefined}
          onClick={() => setConfirmOpen(true)}
        >
          {submitting ? t('init.submit.busy') : t('init.submit')}
        </Button>
      </div>
      {!formValid ? (
        <p id="ownership-submit-missing" className="sr-only">
          {t('init.submit.missing')}
        </p>
      ) : null}

      <SupportLink label={t('support.link')} />

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={t('init.confirm.title', { target: targetName })}
        body={t('init.confirm.body', { target: targetName })}
        confirmLabel={t('init.confirm.confirm')}
        cancelLabel={t('init.confirm.cancel')}
        onConfirm={() => void doSubmit()}
      />
      <ConfirmDialog
        open={cancelFormOpen}
        onOpenChange={setCancelFormOpen}
        title={t('init.cancelDialog.title')}
        body={t('init.cancelDialog.body')}
        confirmLabel={t('init.cancelDialog.confirm')}
        cancelLabel={t('init.cancelDialog.reject')}
        onConfirm={() => {
          setCancelFormOpen(false)
          navigate('/agency')
        }}
      />
    </div>,
  )
}

// ── Small shared bits ─────────────────────────────────────────────────────
function PageHeading({ title, sub }: { title: string; sub: string }) {
  return (
    <div>
      <h1 className="text-[var(--lc-text-heading)]" style={{ font: 'var(--lc-type-display)' }}>
        {title}
      </h1>
      <p className="mt-[var(--lc-space-xs)] text-[var(--lc-text-secondary)]" style={{ font: 'var(--lc-type-body-lg)' }}>
        {sub}
      </p>
    </div>
  )
}

function SupportLink({ label }: { label: string }) {
  return (
    <p className="pt-[var(--lc-space-md)] text-center">
      <Link to="/support?context=ownership-transfer" className="text-[var(--lc-text-brand)] underline-offset-2 hover:underline" style={{ font: 'var(--lc-type-body-sm)' }}>
        {label}
      </Link>
    </p>
  )
}

function FullPageStatus({ label, busy }: { label: string; busy?: boolean }) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center bg-[var(--lc-bg-page)]" aria-busy={busy || undefined}>
      <p className="text-[var(--lc-text-muted)]" style={{ font: 'var(--lc-type-body)' }}>
        {label}
      </p>
    </div>
  )
}

function FullPageMessage({
  title,
  cta,
  action,
}: {
  title: string
  cta?: { label: string; to: string }
  action?: { label: string; onClick: () => void }
}) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-[var(--lc-space-md)] bg-[var(--lc-bg-page)] p-[var(--lc-space-xl)] text-center">
      <AlertOctagon className="h-10 w-10 text-[var(--lc-text-muted)]" aria-hidden="true" />
      <p className="text-[var(--lc-text-heading)]" style={{ font: 'var(--lc-type-heading-2)' }}>
        {title}
      </p>
      {cta ? (
        <Button asChild variant="default">
          <Link to={cta.to}>{cta.label}</Link>
        </Button>
      ) : null}
      {action ? (
        <Button type="button" variant="default" onClick={action.onClick}>
          {action.label}
        </Button>
      ) : null}
    </div>
  )
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  body,
  confirmLabel,
  cancelLabel,
  onConfirm,
  destructive,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  body: string
  confirmLabel: string
  cancelLabel: string
  onConfirm: () => void
  destructive?: boolean
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{body}</DialogDescription>
        </DialogHeader>
        <div className="mt-[var(--lc-space-md)] flex flex-col-reverse gap-[var(--lc-space-sm)] sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {cancelLabel}
          </Button>
          <Button type="button" variant={destructive ? 'destructive' : 'default'} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default AgencyOwnershipTransferInitiatorPage
