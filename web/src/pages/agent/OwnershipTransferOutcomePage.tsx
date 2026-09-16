import { useCallback, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { AlertOctagon, ArrowRight, ChevronRight, Copy } from 'lucide-react'
import {
  OutcomeTimeline,
  PrimaryCtaPerState,
  ResolverMessage,
  StatusHero,
  type CtaAction,
  type OutcomeTimelineEvent,
  type StatusHeroProps,
} from '@/components/recipient'
import { formatRelativeAbsolute, formatAbsoluteTimestamp } from '@/components/recipient/formatRelativeAbsolute'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Numeric } from '@/components/ui/numeric'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useToast } from '@/components/ui/toast'
import {
  OwnershipTransferChallenge,
  type OwnershipTransferProofs,
} from '@/components/agency/OwnershipTransferChallenge'
import { ConfirmDialog } from '@/pages/agency/AgencyOwnershipTransferInitiatorPage'
import { useAuth } from '@/context/AuthContext'
import { useOwnershipTransfer } from '@/hooks/useOwnershipTransfer'
import { useStepUpPrompt } from '@/hooks/useStepUpPrompt'
import { useOwnershipTransferCopy } from '@/pages/agency/ownershipTransferCopy'
import type { OwnershipTransfer, OwnershipTransferStatus } from '@/types/ownershipTransfer'
import { cn } from '@/lib/utils'

type Perspective = 'former_owner' | 'new_owner'

function monogram(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase()
  return `${parts[0]![0] ?? ''}${parts[1]![0] ?? ''}`.toUpperCase()
}

/** Days/hours left until an ISO deadline, or null when past. `now` injected for testable clocks. */
export function reversalRemaining(deadlineIso: string | null, now: number): { days: number; hours: number } | null {
  if (!deadlineIso) return null
  const ms = new Date(deadlineIso).getTime() - now
  if (!Number.isFinite(ms) || ms <= 0) return null
  return { days: Math.floor(ms / 86_400_000), hours: Math.floor((ms % 86_400_000) / 3_600_000) }
}

function heroFor(
  status: OwnershipTransferStatus,
  perspective: Perspective,
): Pick<StatusHeroProps, 'state' | 'emphasis'> {
  const former = perspective === 'former_owner'
  switch (status) {
    case 'pending':
      return { state: former ? 'pending' : 'more_info', emphasis: 'default' }
    case 'executed':
      return { state: 'approved', emphasis: 'loud' }
    case 'declined':
      return { state: former ? 'rejected' : 'withdrawn', emphasis: 'default' }
    case 'cancelled':
      return { state: 'withdrawn', emphasis: 'default' }
    case 'expired':
      return { state: 'expired', emphasis: 'default' }
    case 'reversed':
      return { state: former ? 'approved' : 'more_info', emphasis: former ? 'loud' : 'default' }
  }
}

export function OwnershipTransferOutcomePage() {
  const { transferId } = useParams<{ transferId: string }>()
  const navigate = useNavigate()
  const { agent } = useAuth()
  const { addToast } = useToast()
  const { t } = useOwnershipTransferCopy()
  const { modal: stepUpModal, requestElevation } = useStepUpPrompt('reverse ownership transfer')

  const { state, offline, statusChangedTo, clearStatusChange, reload, sendOtp, cancel, reverse } =
    useOwnershipTransfer(agent?.id, agent?.email)

  const [reverseConfirmOpen, setReverseConfirmOpen] = useState(false)
  const [reverseChallengeOpen, setReverseChallengeOpen] = useState(false)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [reversing, setReversing] = useState(false)
  const [busy, setBusy] = useState(false)

  const agency = state.status === 'ready' ? state.agency : null
  const data = state.status === 'ready' ? state.data : null
  const transfer = data?.transfer ?? null
  const matches = transfer && transfer.id === transferId

  const perspective: Perspective | null = useMemo(() => {
    if (!transfer || !agency) return null
    if (transfer.initiator_user_id === agency.myUserId) return 'former_owner'
    if (transfer.target_user_id === agency.myUserId) return 'new_owner'
    return null
  }, [transfer, agency])

  const doReverse = useCallback(
    async (proofs: OwnershipTransferProofs) => {
      if (!transferId) return
      setReverseChallengeOpen(false)
      setReversing(true)
      try {
        await reverse(transferId, { otp_code: proofs.otpCode, typed_agency_name: proofs.typedAgencyName })
        addToast({ title: t('out.reversal.toast', { agency: agency?.agencyName ?? '' }), variant: 'success' })
      } catch (err) {
        const httpStatus = (err as { status?: number })?.status
        addToast({
          title: httpStatus === 410 ? t('out.reversal.windowClosed') : t('out.reversal.toast.failed'),
          description: err instanceof Error ? err.message : undefined,
          variant: 'error',
        })
        await reload({ silent: true })
      } finally {
        setReversing(false)
      }
    },
    [transferId, reverse, addToast, t, agency, reload],
  )

  if (state.status === 'loading') {
    return <OutcomeStatus label={t('loading.label')} busy />
  }
  if (state.status === 'error' || !agency || !data || !transfer || !matches || !perspective) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-[var(--lc-space-md)] bg-[var(--lc-bg-page)] p-[var(--lc-space-xl)] text-center">
        <AlertOctagon className="h-10 w-10 text-[var(--lc-text-muted)]" aria-hidden="true" />
        <p className="text-[var(--lc-text-heading)]" style={{ font: 'var(--lc-type-heading-2)' }}>
          {t('out.notFound.title')}
        </p>
        <Button asChild variant="default">
          <Link to="/inbox">{t('out.notFound.cta')}</Link>
        </Button>
      </div>
    )
  }

  const former = perspective === 'former_owner'
  const status = transfer.status
  const other = former ? transfer.target.display_name ?? '' : transfer.initiator.display_name ?? ''
  const agencyName = agency.agencyName
  const heroBase = heroFor(status, perspective)
  const heroLabel = t(`out.hero.${status}.${former ? 'former' : 'new'}` as const, { other, agency: agencyName })
  const heroTs =
    status === 'executed'
      ? transfer.executed_at ?? transfer.decided_at
      : status === 'reversed'
        ? transfer.reversed_at
        : status === 'pending'
          ? transfer.initiated_at
          : transfer.decided_at ?? transfer.resolved_at
  const remaining = reversalRemaining(transfer.reversal_deadline_at, Date.now())
  const canReverse = former && status === 'executed' && remaining != null

  const timeline = buildTimeline(transfer, other, t)

  const cta = buildCta({
    status,
    former,
    canReverse,
    other,
    agencyName,
    transferId: transferId!,
    offline,
    busy: busy || reversing,
    t,
    navigate,
    openReverse: () => setReverseConfirmOpen(true),
    openCancel: () => setCancelOpen(true),
  })

  const resolverRole = status === 'executed' || status === 'reversed' ? t('out.resolver.role') : t('out.party.owner')

  return (
    <div className="min-h-full bg-[var(--lc-bg-page)]">
      {stepUpModal}
      <div aria-live="polite" className="sr-only">
        {statusChangedTo ? t('out.toast.updated') : ''}
      </div>
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
        <h1 className="text-[var(--lc-text-heading)]" style={{ font: 'var(--lc-type-body)' }}>
          {t('nav.title')}
        </h1>
      </header>

      <p
        role="note"
        className="mx-auto max-w-[1200px] px-[var(--lc-space-md)] pt-[var(--lc-space-md)]"
      >
        <span
          className="inline-block rounded-pill bg-[var(--lc-surface-sunken)] px-3 py-1 text-[var(--lc-text-muted)]"
          style={{ font: 'var(--lc-type-caption)' }}
        >
          {t(status === 'pending' && !former ? 'out.pill.newPending' : former ? 'out.pill.former' : 'out.pill.new')}
        </span>
      </p>

      <StatusHero
        {...heroBase}
        label={heroLabel}
        timestamp={heroTs ?? undefined}
        timestampPrefix={t('out.hero.timestampPrefix')}
      />

      <div className="mx-auto grid max-w-[1200px] gap-[var(--lc-space-xl)] px-[var(--lc-space-md)] py-[var(--lc-space-md)] lg:grid-cols-[65%_35%] lg:items-start">
        <div className="min-w-0 space-y-[var(--lc-space-lg)] pb-28 lg:pb-0">
          <PartyIdentityCard
            name={other}
            avatarUrl={former ? transfer.target.avatar_url : transfer.initiator.avatar_url}
            roleLabel={
              former
                ? status === 'reversed'
                  ? t('out.party.adminWasOwner')
                  : t('out.party.owner')
                : t('out.party.adminWasOwner')
            }
            subline={
              former
                ? t('out.party.acceptedRel', { rel: formatRelativeAbsolute(transfer.executed_at ?? transfer.decided_at ?? transfer.initiated_at) })
                : t('out.party.initiatedRel', { rel: formatRelativeAbsolute(transfer.initiated_at) })
            }
          />
          <OutcomeTimeline events={timeline} />
          <ResolverMessage
            resolver={{
              display_name: transfer.initiator.display_name ?? '',
              role_label: resolverRole,
              avatar_url: transfer.initiator.avatar_url ?? undefined,
            }}
            decided_at={transfer.initiated_at}
            message={transfer.rationale}
            empty_state_copy={t('out.resolver.empty')}
          />

          {canReverse && remaining ? (
            <ReversalWindowCard
              remaining={remaining}
              deadline={formatAbsoluteTimestamp(transfer.reversal_deadline_at!)}
              reversing={reversing}
              disabled={offline}
              onReverse={() => setReverseConfirmOpen(true)}
            />
          ) : null}

          <StateDetail transfer={transfer} perspective={perspective} other={other} agencyName={agencyName} navigate={navigate} addToast={addToast} />

          <p className="pb-[var(--lc-space-xl)] text-center">
            <Link to="/support?context=ownership-transfer" className="text-[var(--lc-text-brand)] underline-offset-2 hover:underline" style={{ font: 'var(--lc-type-body-sm)' }}>
              {t('support.link')}
            </Link>
          </p>
        </div>

        <aside className="hidden lg:sticky lg:top-[var(--lc-space-3xl)] lg:block">
          <PrimaryCtaPerState layout="stacked" primary={cta.primary} secondary={cta.secondary} tertiary={cta.tertiary} className="max-w-none" />
        </aside>
      </div>

      <div
        className={cn(
          'fixed inset-x-0 bottom-0 z-sticky border-t border-[var(--lc-border)] bg-[var(--lc-surface-raised)] px-[var(--lc-space-md)] pt-[var(--lc-space-sm)] shadow-[var(--lc-elevation-md)] lg:hidden',
          'pb-[max(var(--lc-space-sm),env(safe-area-inset-bottom,0px))]',
        )}
      >
        <PrimaryCtaPerState layout="stacked" primary={cta.primary} secondary={cta.secondary} tertiary={cta.tertiary} className="mx-auto max-w-none" />
      </div>

      {/* Reverse: confirm → challenge modal */}
      <ConfirmDialog
        open={reverseConfirmOpen}
        onOpenChange={setReverseConfirmOpen}
        title={t('out.reversal.dialog.title')}
        body={t('out.reversal.dialog.body', { other })}
        confirmLabel={t('out.reversal.dialog.confirm')}
        cancelLabel={t('out.reversal.dialog.cancel')}
        onConfirm={() => {
          setReverseConfirmOpen(false)
          setReverseChallengeOpen(true)
        }}
      />
      <Dialog open={reverseChallengeOpen} onOpenChange={setReverseChallengeOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('out.reversal.dialog.title')}</DialogTitle>
          </DialogHeader>
          <OwnershipTransferChallenge
            agencyName={agencyName}
            ownerEmailMasked={agency.ownerEmailMasked}
            onAllComplete={(proofs) => void doReverse(proofs)}
            onReset={() => {}}
            onStepUp={requestElevation}
            onSendOtp={sendOtp}
          />
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        title={t('out.cancelDialog.title', { other })}
        body={t('out.cancelDialog.body')}
        confirmLabel={t('out.cancelDialog.confirm')}
        cancelLabel={t('out.cancelDialog.cancel')}
        onConfirm={() => {
          setCancelOpen(false)
          setBusy(true)
          void cancel(transfer.id)
            .then(() => addToast({ title: t('out.toast.updated'), variant: 'default' }))
            .catch((err: unknown) => addToast({ title: err instanceof Error ? err.message : 'Cancel failed', variant: 'error' }))
            .finally(() => {
              setBusy(false)
              clearStatusChange()
            })
        }}
      />
    </div>
  )
}

function buildTimeline(
  transfer: OwnershipTransfer,
  other: string,
  t: ReturnType<typeof useOwnershipTransferCopy>['t'],
): OutcomeTimelineEvent[] {
  const status = transfer.status
  const resolved = status !== 'pending'
  const events: OutcomeTimelineEvent[] = [
    { key: 'initiated', label: t('out.timeline.initiated'), timestamp: transfer.initiated_at, state: 'complete' },
    { key: 'sent', label: t('out.timeline.sent', { other }), timestamp: transfer.initiated_at, state: 'complete' },
    {
      key: 'reviewed',
      label: t('out.timeline.reviewed', { other }),
      emptyLabel: t('out.timeline.reviewedPending'),
      state: resolved ? 'complete' : 'pending',
    },
    {
      key: 'decided',
      label: t('out.timeline.decided'),
      timestamp: transfer.decided_at ?? undefined,
      emptyLabel: t('out.timeline.decidedPending'),
      state: resolved ? 'complete' : 'current',
    },
  ]
  if (status === 'executed' || status === 'reversed') {
    events.push({
      key: 'flipped',
      label: t('out.timeline.flipped'),
      timestamp: transfer.executed_at ?? undefined,
      state: 'complete',
    })
  }
  if (status === 'reversed') {
    events.push({
      key: 'reversed',
      label: t('out.timeline.reversed'),
      timestamp: transfer.reversed_at ?? undefined,
      state: 'complete',
    })
  }
  return events
}

interface BuildCtaArgs {
  status: OwnershipTransferStatus
  former: boolean
  canReverse: boolean
  other: string
  agencyName: string
  transferId: string
  offline: boolean
  busy: boolean
  t: ReturnType<typeof useOwnershipTransferCopy>['t']
  navigate: ReturnType<typeof useNavigate>
  openReverse: () => void
  openCancel: () => void
}

function buildCta(a: BuildCtaArgs): { primary: CtaAction; secondary?: CtaAction; tertiary?: CtaAction } {
  const { status, former, canReverse, other, agencyName, transferId, offline, busy, t, navigate } = a
  const goDashboard: CtaAction = {
    key: 'dashboard',
    label: t('out.cta.goDashboard', { agency: agencyName }),
    variant: 'default',
    onClick: () => navigate('/dashboard'),
  }
  const startNew: CtaAction = {
    key: 'start-new',
    label: t('out.cta.startNew'),
    variant: 'default',
    onClick: () => navigate('/agency/settings/ownership-transfer'),
  }
  const viewSettings: CtaAction = {
    key: 'settings',
    label: t('out.cta.viewSettings'),
    variant: 'outline',
    onClick: () => navigate('/agency'),
  }

  if (status === 'pending') {
    if (former) {
      return {
        primary: { key: 'awaiting', label: t('out.cta.awaiting', { other }), variant: 'default', disabled: true },
        secondary: { key: 'profile', label: t('out.cta.viewProfile'), variant: 'outline', onClick: () => navigate('/agency') },
        tertiary: {
          key: 'cancel',
          label: t('out.cta.cancelTransfer'),
          variant: 'ghost',
          disabled: offline || busy,
          onClick: a.openCancel,
        },
      }
    }
    return {
      primary: {
        key: 'review',
        label: t('out.cta.openReview'),
        variant: 'default',
        onClick: () => navigate(`/agency/ownership-transfer/incoming/${encodeURIComponent(transferId)}`),
      },
    }
  }

  if (status === 'executed') {
    if (former) {
      if (canReverse) {
        return {
          primary: { key: 'reverse', label: t('out.cta.reverse'), variant: 'default', disabled: offline || busy, onClick: a.openReverse },
          secondary: goDashboard,
          tertiary: { key: 'profile', label: t('out.cta.viewProfile'), variant: 'ghost', onClick: () => navigate('/agency') },
        }
      }
      return {
        primary: goDashboard,
        secondary: { key: 'profile', label: t('out.cta.viewProfile'), variant: 'outline', onClick: () => navigate('/agency') },
        tertiary: { key: 'support', label: t('out.cta.contactSupport'), variant: 'ghost', onClick: () => navigate('/support?context=ownership-transfer') },
      }
    }
    return {
      primary: { key: 'dashboard-owner', label: t('out.cta.goDashboardOwner', { agency: agencyName }), variant: 'default', onClick: () => navigate('/dashboard') },
      secondary: { key: 'billing', label: t('out.cta.reviewBilling'), variant: 'outline', onClick: () => navigate('/my-invoices') },
      tertiary: { key: 'notify', label: t('out.cta.notifyTeam'), variant: 'ghost', onClick: () => navigate('/agency/members/applications') },
    }
  }

  if (status === 'declined' || status === 'cancelled' || status === 'expired') {
    if (former) {
      return { primary: startNew, secondary: viewSettings }
    }
    return { primary: goDashboard }
  }

  // reversed
  return {
    primary: goDashboard,
    secondary: { key: 'audit', label: t('out.cta.viewAudit'), variant: 'outline', onClick: () => navigate('/agency') },
  }
}

function PartyIdentityCard({
  name,
  avatarUrl,
  roleLabel,
  subline,
}: {
  name: string
  avatarUrl: string | null
  roleLabel: string
  subline: string
}) {
  return (
    <div className="flex items-center gap-[var(--lc-space-md)] rounded-[var(--lc-radius-lg)] border border-[var(--lc-border)] bg-[var(--lc-surface-raised)] p-[var(--lc-space-md)] shadow-[var(--lc-elevation-sm)]">
      <Avatar className="h-12 w-12 rounded-[var(--lc-radius-md)]">
        {avatarUrl ? <AvatarImage src={avatarUrl} alt="" /> : null}
        <AvatarFallback>{monogram(name)}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-[var(--lc-space-xs)]">
          <span className="truncate text-[var(--lc-text-heading)]" style={{ font: 'var(--lc-type-body)' }}>
            {name}
          </span>
          <Badge variant="outline" className="rounded-pill">
            {roleLabel}
          </Badge>
        </div>
        <Numeric className="mt-0.5 block text-[var(--lc-text-muted)]" style={{ font: 'var(--lc-type-caption)' }}>
          {subline}
        </Numeric>
      </div>
    </div>
  )
}

function ReversalWindowCard({
  remaining,
  deadline,
  reversing,
  disabled,
  onReverse,
}: {
  remaining: { days: number; hours: number }
  deadline: string
  reversing: boolean
  disabled: boolean
  onReverse: () => void
}) {
  const { t } = useOwnershipTransferCopy()
  return (
    <section
      aria-live="polite"
      className="rounded-[var(--lc-radius-lg)] bg-[var(--lc-surface-raised)] p-[var(--lc-space-lg)] shadow-[var(--lc-elevation-sm)]"
      style={{ borderInlineStart: '4px solid var(--lc-status-underOffer-fg)' }}
    >
      <h2 className="text-[var(--lc-text-heading)]" style={{ font: 'var(--lc-type-heading-3)' }}>
        {t('out.reversal.heading', { days: remaining.days })}
      </h2>
      <Numeric className="mt-[var(--lc-space-2xs)] block text-[var(--lc-text-secondary)]" style={{ font: 'var(--lc-type-caption)' }}>
        {t('out.reversal.countdown', { days: remaining.days, hours: remaining.hours, deadline })}
      </Numeric>
      <p className="mt-[var(--lc-space-sm)] text-[var(--lc-text-secondary)]" style={{ font: 'var(--lc-type-body)' }}>
        {t('out.reversal.body', { deadline })}
      </p>
      <Button type="button" variant="link" className="mt-[var(--lc-space-sm)] h-auto px-0" disabled={reversing || disabled} onClick={onReverse}>
        {t('out.reversal.link')}
        <ArrowRight className="ms-1 h-4 w-4 rtl:rotate-180" aria-hidden="true" />
      </Button>
    </section>
  )
}

function StateDetail({
  transfer,
  perspective,
  other,
  agencyName,
  navigate,
  addToast,
}: {
  transfer: OwnershipTransfer
  perspective: Perspective
  other: string
  agencyName: string
  navigate: ReturnType<typeof useNavigate>
  addToast: ReturnType<typeof useToast>['addToast']
}) {
  const { t } = useOwnershipTransferCopy()
  const former = perspective === 'former_owner'
  const status = transfer.status
  const date = formatAbsoluteTimestamp(transfer.decided_at ?? transfer.resolved_at ?? transfer.reversed_at ?? transfer.initiated_at)
  const vars = { other, agency: agencyName, reason: transfer.decline_reason ?? '', date, rel: formatRelativeAbsolute(transfer.initiated_at), expiry: formatAbsoluteTimestamp(transfer.expires_at) }

  const wrap = (children: React.ReactNode) => (
    <div className="rounded-[var(--lc-radius-lg)] border border-[var(--lc-border)] bg-[var(--lc-surface-sunken)] p-[var(--lc-space-lg)]">{children}</div>
  )
  const para = (text: string) => (
    <p className="text-[var(--lc-text-primary)]" style={{ font: 'var(--lc-type-body)' }}>
      {text}
    </p>
  )

  if (status === 'executed' && former) {
    return wrap(
      <div className="space-y-[var(--lc-space-sm)]">
        <h2 className="text-[var(--lc-text-heading)]" style={{ font: 'var(--lc-type-heading-3)' }}>
          {t('out.detail.executed.former.heading')}
        </h2>
        <ul className="space-y-[var(--lc-space-2xs)] text-[var(--lc-text-secondary)]" style={{ font: 'var(--lc-type-body)' }}>
          {(['out.detail.executed.former.billing', 'out.detail.executed.former.pa', 'out.detail.executed.former.transfer', 'out.detail.executed.former.unchanged'] as const).map((k) => (
            <li key={k} className="flex gap-2">
              <span aria-hidden="true" className="text-[var(--lc-text-muted)]">•</span>
              <span>{t(k, vars)}</span>
            </li>
          ))}
        </ul>
      </div>,
    )
  }

  if (status === 'executed' && !former) {
    const cards: Array<{ key: string; label: string; to: string }> = [
      { key: 'card1', label: t('out.detail.executed.new.card1'), to: '/my-invoices' },
      { key: 'card2', label: t('out.detail.executed.new.card2'), to: '/support?context=ownership-transfer' },
      { key: 'card3', label: t('out.detail.executed.new.card3'), to: '/agency/members/applications' },
    ]
    return (
      <div className="space-y-[var(--lc-space-md)]">
        <h2 className="text-[var(--lc-text-heading)]" style={{ font: 'var(--lc-type-heading-3)' }}>
          {t('out.detail.executed.new.heading')}
        </h2>
        <div className="space-y-[var(--lc-space-sm)]">
          {cards.map((c) => (
            <Link
              key={c.key}
              to={c.to}
              className="flex min-h-tap items-center justify-between gap-[var(--lc-space-md)] rounded-[var(--lc-radius-lg)] border border-[var(--lc-border)] bg-[var(--lc-surface-raised)] p-[var(--lc-space-md)] text-[var(--lc-text-primary)] hover:bg-[var(--lc-surface-sunken)]"
              style={{ font: 'var(--lc-type-body)' }}
            >
              <span>{c.label}</span>
              <ArrowRight className="h-5 w-5 shrink-0 text-[var(--lc-text-muted)] rtl:rotate-180" aria-hidden="true" />
            </Link>
          ))}
        </div>
        <ClipboardPill text={t('out.detail.executed.new.clipboard', vars)} addToast={addToast} />
      </div>
    )
  }

  if (status === 'pending') {
    return wrap(para(t(former ? 'out.detail.pending.former' : 'out.detail.pending.new', vars)))
  }
  if (status === 'declined') {
    return wrap(para(t(former ? 'out.detail.declined.former' : 'out.detail.declined.new', vars)))
  }
  if (status === 'cancelled') {
    return wrap(para(t(former ? 'out.detail.cancelled.former' : 'out.detail.cancelled.new', vars)))
  }
  if (status === 'expired') {
    return wrap(para(t(former ? 'out.detail.expired.former' : 'out.detail.expired.new', vars)))
  }
  // reversed
  void navigate
  return wrap(para(t(former ? 'out.detail.reversed.former' : 'out.detail.reversed.new', vars)))
}

function ClipboardPill({ text, addToast }: { text: string; addToast: ReturnType<typeof useToast>['addToast'] }) {
  const { t } = useOwnershipTransferCopy()
  return (
    <div className="flex items-start gap-[var(--lc-space-sm)] rounded-[var(--lc-radius-md)] bg-[var(--lc-surface-sunken)] p-[var(--lc-space-md)]">
      <p className="min-w-0 flex-1 text-[var(--lc-text-secondary)]" style={{ font: 'var(--lc-type-body-sm)' }}>
        {text}
      </p>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label={t('out.detail.executed.new.copyAria')}
        onClick={() => {
          void navigator.clipboard?.writeText(text)
          addToast({ title: t('out.detail.executed.new.copied'), variant: 'success' })
        }}
      >
        <Copy className="h-4 w-4" aria-hidden="true" />
      </Button>
    </div>
  )
}

function OutcomeStatus({ label, busy }: { label: string; busy?: boolean }) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center bg-[var(--lc-bg-page)]" aria-busy={busy || undefined}>
      <p className="text-[var(--lc-text-muted)]" style={{ font: 'var(--lc-type-body)' }}>
        {label}
      </p>
    </div>
  )
}

export default OwnershipTransferOutcomePage
