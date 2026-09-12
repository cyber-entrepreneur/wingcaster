import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  AlertOctagon,
  Building2,
  ChevronRight,
  Layers,
} from 'lucide-react'
import { Drawer } from 'vaul'
import {
  OutcomeTimeline,
  PrimaryCtaPerState,
  ResolverMessage,
  StatusHero,
  type CtaAction,
  type OutcomeTimelineEvent,
  type StatusHeroProps,
} from '@/components/recipient'
import { Button } from '@/components/ui/button'
import { Numeric } from '@/components/ui/numeric'
import { useToast } from '@/components/ui/toast'
import { setAuthToken } from '@/api/client'
import { useAgencyApplicationOutcome } from '@/hooks/useAgencyApplicationOutcome'
import { useTenant } from '@/hooks/useTenant'
import { cn } from '@/lib/utils'
import { formatAbsoluteTimestamp } from '@/components/recipient/formatRelativeAbsolute'
import { APPLICATION_OUTCOME_COPY as C } from './applicationOutcomeCopy'
import type {
  ApplicationOutcomePayload,
  ApplicationOutcomeStatus,
} from './applicationOutcomeTypes'

const CELEBRATORY_BANNER_KEY = 'wc_agency_join_banner'

function monogram(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase()
  return `${parts[0]![0] ?? ''}${parts[1]![0] ?? ''}`.toUpperCase()
}

function roleLabel(role: string | null): string {
  if (!role) return 'Agent'
  return role.charAt(0).toUpperCase() + role.slice(1)
}

function packLabel(pack: string | null): string {
  if (!pack) return 'Standard'
  return pack.charAt(0).toUpperCase() + pack.slice(1)
}

function buildTimeline(data: ApplicationOutcomePayload): OutcomeTimelineEvent[] {
  const { application, agency } = data
  const status = application.status
  const viewed = Boolean(application.viewed_at)
  const decided = Boolean(application.decided_at || application.resolved_at)
  const agencyGone = Boolean(agency.deleted_at)

  const resolvedLabel =
    status === 'approved'
      ? C.timelineApproved
      : status === 'rejected'
        ? C.timelineRejected
        : status === 'expired'
          ? C.timelineExpired
          : status === 'withdrawn'
            ? C.timelineWithdrawn
            : agencyGone
              ? C.timelineAgencyRemoved
              : C.timelineApproved

  const decidedState: OutcomeTimelineEvent['state'] =
    status === 'pending'
      ? viewed
        ? 'current'
        : 'pending'
      : 'complete'

  const resolvedState: OutcomeTimelineEvent['state'] =
    status === 'pending' ? (agencyGone ? 'complete' : 'pending') : 'complete'

  return [
    {
      key: 'submitted',
      label: C.timelineSubmitted,
      timestamp: application.submitted_at,
      state: 'complete',
    },
    {
      key: 'viewed',
      label: C.timelineViewed,
      timestamp: application.viewed_at ?? undefined,
      emptyLabel: C.timelineViewedEmpty,
      state: viewed || decided || status !== 'pending' ? 'complete' : 'pending',
    },
    {
      key: 'decided',
      label: C.timelineDecided,
      timestamp: application.decided_at ?? undefined,
      emptyLabel: C.timelineDecidedPending,
      state: decidedState,
    },
    {
      key: 'resolved',
      label: resolvedLabel,
      timestamp: application.resolved_at ?? application.decided_at ?? undefined,
      state: resolvedState,
      emptyLabel: status === 'pending' ? C.timelineDecidedPending : undefined,
    },
  ]
}

function heroFor(
  data: ApplicationOutcomePayload,
): Pick<StatusHeroProps, 'state' | 'label' | 'timestamp' | 'timestampPrefix' | 'emphasis' | 'glyph'> {
  const { application, agency } = data
  const name = agency.display_name

  if (agency.deleted_at && application.status === 'pending') {
    return {
      state: 'superseded',
      label: C.agencyDeleted,
      timestamp: agency.deleted_at,
      timestampPrefix: 'Removed',
      emphasis: 'default',
      glyph: Layers,
    }
  }
  if (agency.suspended_at && application.status === 'pending') {
    return {
      state: 'more_info',
      label: C.agencySuspended(name),
      timestamp: agency.suspended_at,
      timestampPrefix: 'Suspended',
      emphasis: 'default',
    }
  }

  switch (application.status) {
    case 'pending':
      return {
        state: 'pending',
        label: C.heroPending(name),
        timestamp: application.submitted_at,
        timestampPrefix: 'Submitted',
        emphasis: 'default',
      }
    case 'approved':
      return {
        state: 'approved',
        label: C.heroApproved(name),
        timestamp: application.decided_at ?? application.resolved_at ?? undefined,
        timestampPrefix: 'Decided',
        emphasis: 'loud',
      }
    case 'rejected':
      return {
        state: 'rejected',
        label:
          application.rejected_by === 'applicant'
            ? C.declinedAttribution(
                formatAbsoluteTimestamp(
                  application.decided_at ?? application.resolved_at ?? application.submitted_at,
                ),
              )
            : C.heroRejected(name),
        timestamp: application.decided_at ?? application.resolved_at ?? undefined,
        timestampPrefix: application.rejected_by === 'applicant' ? undefined : 'Decided',
        emphasis: 'default',
      }
    case 'expired':
      return {
        state: 'expired',
        label: C.heroExpired,
        timestamp: application.resolved_at ?? application.expires_at,
        timestampPrefix: 'Expired',
        emphasis: 'default',
      }
    case 'withdrawn':
      return {
        state: 'withdrawn',
        label: C.heroWithdrawn,
        timestamp: application.resolved_at ?? application.decided_at ?? undefined,
        timestampPrefix: 'Withdrawn',
        emphasis: 'default',
      }
  }
}

function DetailBlock({ data }: { data: ApplicationOutcomePayload }) {
  const { application, agency, decision } = data
  const name = agency.display_name

  if (agency.deleted_at && application.status === 'pending') {
    return (
      <p className="text-[var(--lc-text-secondary)]" style={{ font: 'var(--lc-type-body)' }}>
        {C.agencyDeleted}
      </p>
    )
  }
  if (agency.suspended_at && application.status === 'pending') {
    return (
      <p className="text-[var(--lc-text-secondary)]" style={{ font: 'var(--lc-type-body)' }}>
        {C.agencySuspended(name)}
      </p>
    )
  }

  if (application.status === 'approved') {
    return (
      <div className="space-y-[var(--lc-space-sm)] text-[var(--lc-text-primary)]" style={{ font: 'var(--lc-type-body)' }}>
        <p>
          You&apos;ll join as <strong>{roleLabel(decision.role_offered)}</strong> with the{' '}
          <strong>{packLabel(decision.capability_pack)}</strong> capability pack.
        </p>
        <p>
          {decision.affiliation_mode === 'non_exclusive'
            ? C.approvedNonExclusive
            : C.approvedExclusive(name)}
        </p>
        <p className="text-[var(--lc-text-muted)]">{C.approvedTenantNote(name)}</p>
      </div>
    )
  }

  if (application.status === 'rejected') {
    return (
      <p className="text-[var(--lc-text-secondary)]" style={{ font: 'var(--lc-type-body)' }}>
        {C.rejectedEncouragement}
      </p>
    )
  }

  if (application.status === 'pending') {
    return (
      <div className="space-y-[var(--lc-space-sm)]" style={{ font: 'var(--lc-type-body)' }}>
        <p className="text-[var(--lc-text-primary)]">
          Typical review: <strong>{application.sla_days} days</strong>
          {' · '}
          Application expires{' '}
          <Numeric as="strong">{formatAbsoluteTimestamp(application.expires_at)}</Numeric>
        </p>
        <p className="text-[var(--lc-text-muted)]">{C.pendingReassurance(name)}</p>
      </div>
    )
  }

  if (application.status === 'expired') {
    return (
      <p className="text-[var(--lc-text-secondary)]" style={{ font: 'var(--lc-type-body)' }}>
        {C.expiredDetail}
      </p>
    )
  }

  return (
    <p className="text-[var(--lc-text-secondary)]" style={{ font: 'var(--lc-type-body)' }}>
      {C.withdrawnDetail(
        formatAbsoluteTimestamp(
          application.resolved_at ?? application.decided_at ?? application.submitted_at,
        ),
      )}
    </p>
  )
}

function contextHelperCopy(data: ApplicationOutcomePayload): string {
  const name = data.agency.display_name
  switch (data.application.status) {
    case 'approved':
      return C.contextHelperApproved(name)
    case 'pending':
      return C.contextHelperPending(name)
    case 'rejected':
      return C.contextHelperRejected
    case 'expired':
      return C.contextHelperExpired
    case 'withdrawn':
      return C.contextHelperWithdrawn
  }
}

function AgencyIdentityBlock({
  data,
  onExpand,
}: {
  data: ApplicationOutcomePayload
  onExpand: () => void
}) {
  const { agency } = data
  return (
    <button
      type="button"
      onClick={onExpand}
      aria-label={C.agencyCardExpandAria(agency.display_name)}
      className={cn(
        'flex w-full min-h-tap items-center gap-[var(--lc-space-md)] rounded-[var(--lc-radius-lg)] border border-[var(--lc-border)] bg-[var(--lc-surface-raised)] p-[var(--lc-space-md)] text-start shadow-[var(--lc-elevation-sm)]',
        'transition-colors hover:bg-[var(--lc-surface-sunken)]',
      )}
    >
      {agency.logo_url ? (
        <img
          src={agency.logo_url}
          alt=""
          className="h-14 w-14 shrink-0 rounded-[var(--lc-radius-md)] object-cover"
        />
      ) : (
        <span
          className="inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-[var(--lc-radius-md)] bg-[var(--lc-surface-sunken)] text-[var(--lc-text-muted)]"
          style={{ font: 'var(--lc-type-heading-3)' }}
          aria-hidden="true"
        >
          {monogram(agency.display_name)}
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span
          className="block truncate text-[var(--lc-text-heading)]"
          style={{ font: 'var(--lc-type-heading-3)' }}
        >
          {agency.display_name}
        </span>
        {agency.primary_market_label ? (
          <span
            className="mt-0.5 block truncate text-[var(--lc-text-muted)]"
            style={{ font: 'var(--lc-type-body-sm)' }}
          >
            {agency.primary_market_label}
          </span>
        ) : null}
      </span>
      <ChevronRight className="h-5 w-5 shrink-0 text-[var(--lc-text-muted)] rtl:rotate-180" aria-hidden="true" />
    </button>
  )
}

function OutcomeSkeleton() {
  return (
    <div className="animate-pulse" aria-busy="true" aria-label="Loading application status">
      <div className="h-[180px] bg-[var(--lc-surface-sunken)]" />
      <div className="mx-auto max-w-[1200px] space-y-[var(--lc-space-md)] p-[var(--lc-space-md)]">
        <div className="h-20 rounded-[var(--lc-radius-lg)] bg-[var(--lc-surface-sunken)]" />
        <div className="h-40 rounded-[var(--lc-radius-lg)] bg-[var(--lc-surface-sunken)]" />
        <div className="h-24 rounded-[var(--lc-radius-lg)] bg-[var(--lc-surface-sunken)]" />
      </div>
    </div>
  )
}

/**
 * AGT-REC-004 — Agency application outcome (REC-family anchor screen).
 *
 * Routes:
 * - `/applications/:applicationId` (Agent 5 deep-link + AGN-MEM-005 redirect)
 * - `/inbox/applications/:applicationId`
 * - `/agency/applications/:appId/status`
 */
export function ApplicationOutcomePage() {
  const params = useParams<{ applicationId?: string; appId?: string }>()
  const applicationId = params.applicationId ?? params.appId
  const navigate = useNavigate()
  const { addToast } = useToast()
  const { switchTenant, tenants } = useTenant()
  const {
    state,
    offline,
    statusChangedTo,
    clearStatusChange,
    reload,
    accept,
    decline,
    withdraw,
  } = useAgencyApplicationOutcome(applicationId)

  const [profileOpen, setProfileOpen] = useState(false)
  const [accepting, setAccepting] = useState(false)
  const [actionBusy, setActionBusy] = useState(false)

  useEffect(() => {
    if (!statusChangedTo) return
    addToast({ title: C.toastUpdated, variant: 'default' })
    const t = window.setTimeout(() => clearStatusChange(), 4000)
    return () => window.clearTimeout(t)
  }, [statusChangedTo, addToast, clearStatusChange])

  const data = state.status === 'ready' ? state.data : null

  const ctaBundle = useMemo(() => {
    if (!data) return null
    const name = data.agency.display_name
    const slug = data.agency.slug
    const status = data.application.status as ApplicationOutcomeStatus
    const agencyGone = Boolean(data.agency.deleted_at)
    const agencySuspended = Boolean(data.agency.suspended_at)

    const viewProfile: CtaAction = {
      key: 'view-profile',
      label: C.ctaViewProfile,
      variant: 'outline',
      onClick: () => setProfileOpen(true),
      disabled: offline || actionBusy,
    }

    if (agencyGone && status === 'pending') {
      return {
        primary: {
          key: 'browse',
          label: C.ctaBrowse,
          variant: 'default' as const,
          href: '/agencies',
          disabled: offline,
        },
        secondary: undefined,
        tertiary: undefined,
      }
    }

    if (agencySuspended && status === 'pending') {
      return {
        primary: {
          key: 'support',
          label: C.ctaContactSupport,
          variant: 'default' as const,
          href: '/support?context=application&id=' + encodeURIComponent(data.application.id),
          disabled: offline,
        },
        secondary: viewProfile,
        tertiary: undefined,
      }
    }

    if (status === 'pending') {
      return {
        primary: {
          key: 'awaiting',
          label: C.awaitingChip,
          variant: 'default' as const,
          disabled: true,
        },
        secondary: viewProfile,
        tertiary: {
          key: 'withdraw',
          label: C.ctaWithdraw,
          variant: 'ghost' as const,
          disabled: offline || actionBusy,
          confirm: {
            title: C.withdrawTitle,
            body: C.withdrawBody(name),
            confirm_label: C.withdrawConfirm,
            cancel_label: C.withdrawCancel,
          },
          onClick: () => {
            setActionBusy(true)
            void withdraw()
              .then(() => addToast({ title: C.toastWithdrawn, variant: 'success' }))
              .catch((err: unknown) =>
                addToast({
                  title: err instanceof Error ? err.message : 'Withdraw failed',
                  variant: 'error',
                }),
              )
              .finally(() => setActionBusy(false))
          },
        },
      }
    }

    if (status === 'approved') {
      return {
        primary: {
          key: 'switch',
          label: accepting ? C.switchingWorkspace : C.ctaSwitch(name),
          variant: 'default' as const,
          loading: accepting,
          disabled: offline || accepting,
          onClick: () => {
            setAccepting(true)
            void accept()
              .then(async (result) => {
                if (result.token) setAuthToken(result.token)
                const tenantId =
                  result.active_tenant_id ?? result.activeTenantId ?? data.agency.tenant_id
                try {
                  await switchTenant(tenantId)
                } catch {
                  /* accept may already have switched; continue */
                }
                try {
                  sessionStorage.setItem(
                    CELEBRATORY_BANNER_KEY,
                    JSON.stringify({ agency: name, at: Date.now() }),
                  )
                } catch {
                  /* private mode */
                }
                navigate('/dashboard')
              })
              .catch((err: unknown) => {
                addToast({
                  title: C.toastAcceptFailed,
                  description: err instanceof Error ? err.message : undefined,
                  variant: 'error',
                })
              })
              .finally(() => setAccepting(false))
          },
        },
        secondary: viewProfile,
        tertiary: {
          key: 'decline',
          label: C.ctaDecline,
          variant: 'ghost' as const,
          disabled: offline || actionBusy || accepting,
          confirm: {
            title: C.declineTitle(name),
            body: C.declineBody(name),
            confirm_label: C.declineConfirm,
            cancel_label: C.declineCancel,
          },
          onClick: () => {
            setActionBusy(true)
            void decline()
              .then(() => addToast({ title: C.toastDeclined, variant: 'default' }))
              .catch((err: unknown) =>
                addToast({
                  title: err instanceof Error ? err.message : 'Decline failed',
                  variant: 'error',
                }),
              )
              .finally(() => setActionBusy(false))
          },
        },
      }
    }

    if (status === 'rejected') {
      return {
        primary: {
          key: 'browse',
          label: C.ctaBrowse,
          variant: 'default' as const,
          href: '/agencies',
          disabled: offline,
        },
        secondary: {
          key: 'solo',
          label: C.ctaSolo,
          variant: 'outline' as const,
          disabled: offline || actionBusy,
          onClick: () => {
            setActionBusy(true)
            void (async () => {
              const personal = tenants.find((t) => t.kind === 'personal')
              if (personal) {
                try {
                  await switchTenant(personal.id)
                } catch {
                  /* still land on dashboard */
                }
              }
              navigate('/dashboard')
            })().finally(() => setActionBusy(false))
          },
        },
      }
    }

    // expired | withdrawn
    return {
      primary: {
        key: 'reapply',
        label: C.ctaReapply(name),
        variant: 'default' as const,
        href: `/agencies/${encodeURIComponent(slug)}/apply`,
        disabled: offline,
      },
      secondary: {
        key: 'browse',
        label: C.ctaBrowse,
        variant: 'outline' as const,
        href: '/agencies',
        disabled: offline,
      },
    }
  }, [
    data,
    offline,
    actionBusy,
    accepting,
    accept,
    decline,
    withdraw,
    addToast,
    navigate,
    switchTenant,
    tenants,
  ])

  if (state.status === 'loading') {
    return (
      <div className="min-h-full bg-[var(--lc-bg-page)]">
        <header className="sticky top-0 z-sticky flex h-12 items-center justify-center border-b border-[var(--lc-border)] bg-[var(--lc-surface-raised)]">
          <h1 className="text-[var(--lc-text-heading)]" style={{ font: 'var(--lc-type-body)' }}>
            {C.navTitle}
          </h1>
        </header>
        <OutcomeSkeleton />
      </div>
    )
  }

  if (state.status === 'not_found') {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-[var(--lc-space-md)] bg-[var(--lc-bg-page)] p-[var(--lc-space-xl)] text-center">
        <AlertOctagon className="h-10 w-10 text-[var(--lc-text-muted)]" aria-hidden="true" />
        <p className="text-[var(--lc-text-heading)]" style={{ font: 'var(--lc-type-heading-2)' }}>
          {C.notFoundTitle}
        </p>
        <Button asChild variant="default">
          <Link to="/inbox">{C.notFoundCta}</Link>
        </Button>
      </div>
    )
  }

  if (state.status === 'error' || !data || !ctaBundle) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-[var(--lc-space-md)] bg-[var(--lc-bg-page)] p-[var(--lc-space-xl)] text-center">
        <AlertOctagon className="h-10 w-10 text-[var(--lc-text-muted)]" aria-hidden="true" />
        <p className="text-[var(--lc-text-heading)]" style={{ font: 'var(--lc-type-heading-2)' }}>
          {C.networkTitle}
        </p>
        <Button type="button" variant="default" onClick={() => void reload()}>
          {C.networkRetry}
        </Button>
      </div>
    )
  }

  const hero = heroFor(data)
  const timeline = buildTimeline(data)
  const showResolver =
    data.application.status !== 'pending' &&
    (data.decision.resolver != null || data.decision.message != null || data.application.decided_at)

  const inert = accepting

  return (
    <div
      className={cn('min-h-full bg-[var(--lc-bg-page)]', inert && 'pointer-events-none opacity-90')}
      aria-busy={accepting || undefined}
    >
      <div aria-live="polite" className="sr-only">
        {statusChangedTo ? C.liveUpdateAnnounce(statusChangedTo) : ''}
      </div>

      {offline ? (
        <div
          role="status"
          className="border-b border-[var(--lc-border)] bg-[var(--lc-surface-sunken)] px-[var(--lc-space-md)] py-[var(--lc-space-xs)] text-center text-[var(--lc-text-muted)]"
          style={{ font: 'var(--lc-type-caption)' }}
        >
          {C.offlineBanner}
        </div>
      ) : null}

      <header className="sticky top-0 z-sticky flex h-12 items-center justify-between border-b border-[var(--lc-border)] bg-[var(--lc-surface-raised)] px-[var(--lc-space-sm)]">
        <Button
          type="button"
          variant="ghost"
          className="min-h-tap min-w-tap px-2"
          aria-label="Go back"
          onClick={() => navigate(-1)}
        >
          <ChevronRight className="h-5 w-5 rotate-180 rtl:rotate-0" aria-hidden="true" />
        </Button>
        <h1 className="text-[var(--lc-text-heading)]" style={{ font: 'var(--lc-type-body)' }}>
          {C.navTitle}
        </h1>
        <span className="inline-block min-w-tap" aria-hidden="true" />
      </header>

      <StatusHero {...hero} />

      <div className="mx-auto grid max-w-[1200px] gap-[var(--lc-space-xl)] px-[var(--lc-space-md)] py-[var(--lc-space-md)] lg:grid-cols-[65%_35%] lg:items-start">
        <div className="min-w-0 space-y-[var(--lc-space-lg)] pb-28 lg:pb-0">
          <AgencyIdentityBlock data={data} onExpand={() => setProfileOpen(true)} />
          <OutcomeTimeline events={timeline} />
          {showResolver && data.decision.resolver ? (
            <ResolverMessage
              resolver={{
                display_name: data.decision.resolver.display_name,
                role_label: data.decision.resolver.role_label,
                avatar_url: data.decision.resolver.avatar_url ?? undefined,
              }}
              decided_at={
                data.application.decided_at ??
                data.application.resolved_at ??
                data.application.submitted_at
              }
              message={data.decision.message}
              empty_state_copy={C.resolverEmpty}
            />
          ) : showResolver ? (
            <ResolverMessage
              resolver={{ display_name: data.agency.display_name, role_label: 'Owner' }}
              decided_at={
                data.application.decided_at ??
                data.application.resolved_at ??
                data.application.submitted_at
              }
              message={data.decision.message}
              empty_state_copy={C.resolverEmpty}
            />
          ) : null}
          <DetailBlock data={data} />
          <p className="pb-[var(--lc-space-xl)] text-center">
            <Link
              to={`/support?context=application&id=${encodeURIComponent(data.application.id)}`}
              className="text-[var(--lc-text-brand)] underline-offset-2 hover:underline"
              style={{ font: 'var(--lc-type-body-sm)' }}
            >
              {C.contactSupport}
            </Link>
          </p>
        </div>

        {/* Desktop sidebar */}
        <aside className="hidden lg:sticky lg:top-[var(--lc-space-3xl)] lg:block lg:space-y-[var(--lc-space-md)]">
          <PrimaryCtaPerState
            layout="stacked"
            primary={ctaBundle.primary}
            secondary={ctaBundle.secondary}
            tertiary={ctaBundle.tertiary}
            className="max-w-none"
          />
          <div className="rounded-[var(--lc-radius-lg)] bg-[var(--lc-surface-sunken)] p-[var(--lc-space-md)]">
            <p className="text-[var(--lc-text-secondary)]" style={{ font: 'var(--lc-type-body-sm)' }}>
              {contextHelperCopy(data)}
            </p>
          </div>
          <dl className="space-y-[var(--lc-space-2xs)] text-[var(--lc-text-muted)]" style={{ font: 'var(--lc-type-caption)' }}>
            <div className="flex justify-between gap-2">
              <dt>{C.smallPrintAppId}</dt>
              <Numeric as="dd" className="font-mono" dir="ltr">
                {data.application.id}
              </Numeric>
            </div>
            <div className="flex justify-between gap-2">
              <dt>{C.smallPrintApplied}</dt>
              <Numeric as="dd">{formatAbsoluteTimestamp(data.application.submitted_at)}</Numeric>
            </div>
            {data.application.decided_at ? (
              <div className="flex justify-between gap-2">
                <dt>{C.smallPrintDecided}</dt>
                <Numeric as="dd">{formatAbsoluteTimestamp(data.application.decided_at)}</Numeric>
              </div>
            ) : null}
          </dl>
        </aside>
      </div>

      {/* Mobile sticky CTA */}
      <div
        className={cn(
          'fixed inset-x-0 bottom-0 z-sticky border-t border-[var(--lc-border)] bg-[var(--lc-surface-raised)] px-[var(--lc-space-md)] pt-[var(--lc-space-sm)] shadow-[var(--lc-elevation-md)] lg:hidden',
          'pb-[max(var(--lc-space-sm),env(safe-area-inset-bottom,0px))]',
        )}
      >
        <PrimaryCtaPerState
          layout="stacked"
          primary={ctaBundle.primary}
          secondary={ctaBundle.secondary}
          tertiary={ctaBundle.tertiary}
          className="mx-auto max-w-none"
        />
      </div>

      <Drawer.Root open={profileOpen} onOpenChange={setProfileOpen} direction="bottom">
        <Drawer.Portal>
          <Drawer.Overlay className="fixed inset-0 z-overlay lc-overlay" />
          <Drawer.Content
            className="fixed inset-x-0 bottom-0 z-modal flex max-h-[85vh] flex-col rounded-t-[var(--lc-radius-xl)] border border-[var(--lc-border)] border-b-0 bg-[var(--lc-surface-raised)] p-[var(--lc-space-lg)] outline-none"
            aria-describedby={undefined}
          >
            <div className="mx-auto mb-[var(--lc-space-md)] h-1 w-6 rounded-pill bg-[var(--lc-border)]" aria-hidden="true" />
            <Drawer.Title
              className="mb-[var(--lc-space-md)] text-[var(--lc-text-heading)]"
              style={{ font: 'var(--lc-type-heading-3)' }}
            >
              {data.agency.display_name}
            </Drawer.Title>
            <div className="flex items-start gap-[var(--lc-space-md)]">
              <Building2 className="h-8 w-8 text-[var(--lc-text-muted)]" aria-hidden="true" />
              <div>
                {data.agency.primary_market_label ? (
                  <p className="text-[var(--lc-text-muted)]" style={{ font: 'var(--lc-type-body-sm)' }}>
                    {data.agency.primary_market_label}
                  </p>
                ) : null}
                <Link
                  to={data.agency.public_profile_url}
                  className="mt-[var(--lc-space-sm)] inline-flex min-h-tap items-center text-[var(--lc-text-brand)] underline-offset-2 hover:underline"
                  style={{ font: 'var(--lc-type-body)' }}
                >
                  Open full public profile
                </Link>
              </div>
            </div>
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>
    </div>
  )
}

export default ApplicationOutcomePage
