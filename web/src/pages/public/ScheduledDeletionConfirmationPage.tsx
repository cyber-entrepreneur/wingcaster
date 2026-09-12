import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import {
  Bell,
  CheckCircle2,
  ChevronDown,
  Hourglass,
  Loader2,
  Unlink,
  WifiOff,
  XCircle,
} from 'lucide-react'
import { StatusHero } from '@/components/recipient/StatusHero'
import { DeletionCountdown } from '@/components/deletion'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Numeric } from '@/components/ui/numeric'
import { useToast } from '@/components/ui/toast'
import { API_BASE } from '@/api/client'
import { usePageTitle } from '@/lib/usePageTitle'
import { cn } from '@/lib/utils'

/** UI states for SHR-AUT-005d (path-token authoritative; never from query). */
export type ScheduledDeletionUiState =
  | 'LOADING'
  | 'VALID_PENDING'
  | 'ALREADY_CANCELLED'
  | 'ALREADY_DELETED'
  | 'INVALID_TOKEN'
  | 'EXPIRED_TOKEN'

/** Backend GET /api/auth/scheduled-deletion/:token body (BE-BLOCKER-19). */
export type ScheduledDeletionPayload = {
  deletion_request_id: string
  status: string
  scheduled_for: string | null
  deletion_date: string | null
  days_remaining: number
  cancelled: boolean
  cancel_available: boolean
  email_masked: string
  purpose?: string
  already_cancelled?: boolean
  completed_at?: string | null
}

const COPY = {
  heroPending: 'Your account is scheduled for deletion',
  heroPendingSub: 'You can still cancel below.',
  heroCancelled: 'This deletion has already been cancelled',
  heroCancelledSub: 'Your account is active. You can sign in below.',
  heroDeleted: 'This account has been deleted',
  heroDeletedSub: 'The cool-down ended and the account was removed.',
  heroInvalid: "This link isn't valid",
  heroInvalidSub: 'It may have been tampered with or copied wrong.',
  heroExpired: 'This link has expired',
  heroExpiredSub: 'Reminder links stay valid until the deletion date.',
  caution: 'This account will be deleted unless you cancel below.',
  cautionFinal: (when: string) => `Final 24 hours — deletion runs at ${when}.`,
  cancel: 'Cancel deletion',
  cancelling: 'Cancelling…',
  cancelToast: 'Deletion cancelled. Your account is active.',
  signIn: 'Sign in to your account',
  signUp: 'Start a new account',
  masked: (email: string) => `Deletion was requested for ${email}.`,
  impactToggle: 'What happens when the account is deleted',
  deletedHeading: 'Deleted at the end of the cool-down:',
  keptHeading: 'Kept for legal reasons:',
  effectiveHeading: 'Effective right now:',
  support: 'Something not right? Contact WingCaster support',
  recoveryInvalid: "If you're locked out, use account recovery.",
  recoveryExpired: 'Sign in to view your deletion status.',
  offline: "You're offline — the cancel button won't work until you reconnect.",
  reminderT7: 'Reminder: 7 days left',
  reminderT1: 'Reminder: 24 hours left',
  rateLimited: (s: number) => `Too many attempts — try again in ${s}s.`,
  cancelFailed: 'Could not cancel deletion. Please try again.',
} as const

const IMPACT = {
  deleted: [
    'Your profile and login',
    'Your listings — archived, then removed',
    'Your contacts — pseudonymized per GDPR',
    'Any unspent credits — forfeited',
  ],
  kept: [
    'Invoices and payment records (7 years)',
    'Aggregate audit trail (redacted)',
  ],
  effective: [
    'You are signed out of every device',
    'Your public profile is hidden',
  ],
} as const

function mapPayloadToUi(body: ScheduledDeletionPayload): ScheduledDeletionUiState {
  if (body.status === 'completed') return 'ALREADY_DELETED'
  if (body.cancelled || body.status === 'cancelled' || body.already_cancelled) {
    return 'ALREADY_CANCELLED'
  }
  if (body.status === 'scheduled' && body.cancel_available) return 'VALID_PENDING'
  if (body.status === 'scheduled') return 'VALID_PENDING'
  return 'ALREADY_DELETED'
}

function mapHttpError(status: number, code?: string): ScheduledDeletionUiState {
  if (status === 410 || code === 'expired') return 'EXPIRED_TOKEN'
  return 'INVALID_TOKEN'
}

async function getScheduledDeletion(token: string): Promise<
  | { ok: true; body: ScheduledDeletionPayload }
  | { ok: false; status: number; code?: string }
> {
  // Path token is the only auth — do not attach session Bearer / cookies as authority.
  const res = await fetch(
    `${API_BASE}/auth/scheduled-deletion/${encodeURIComponent(token)}`,
    {
      method: 'GET',
      headers: { Accept: 'application/json' },
      credentials: 'omit',
    },
  )
  const json = await res.json().catch(() => ({}))
  if (!res.ok) {
    return { ok: false, status: res.status, code: (json as { code?: string }).code }
  }
  return { ok: true, body: json as ScheduledDeletionPayload }
}

async function postCancelScheduledDeletion(token: string): Promise<
  | { ok: true; body: ScheduledDeletionPayload & { success?: boolean } }
  | { ok: false; status: number; code?: string; error?: string; retryAfter?: number }
> {
  const res = await fetch(
    `${API_BASE}/auth/scheduled-deletion/${encodeURIComponent(token)}/cancel`,
    {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      credentials: 'omit',
      body: '{}',
    },
  )
  const json = await res.json().catch(() => ({}))
  if (!res.ok) {
    const retryHeader = res.headers.get('Retry-After')
    return {
      ok: false,
      status: res.status,
      code: (json as { code?: string }).code,
      error: (json as { error?: string }).error,
      retryAfter: retryHeader ? Number(retryHeader) || undefined : undefined,
    }
  }
  return { ok: true, body: json as ScheduledDeletionPayload & { success?: boolean } }
}

function useOnline(): boolean {
  const [online, setOnline] = useState(
    typeof navigator === 'undefined' ? true : navigator.onLine,
  )
  useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])
  return online
}

function heroForState(ui: ScheduledDeletionUiState): {
  state: 'pending' | 'approved' | 'rejected' | 'expired'
  glyph: typeof Hourglass
  label: string
  sub: string
  bandExtra?: string
} {
  switch (ui) {
    case 'VALID_PENDING':
      return {
        state: 'pending',
        glyph: Hourglass,
        label: COPY.heroPending,
        sub: COPY.heroPendingSub,
        // Amber caution band — StatusHero pending surface + underOffer top border.
        bandExtra:
          '[&>section]:border-t-4 [&>section]:border-t-[var(--lc-status-underOffer-fg)] [&>section]:border-b-0',
      }
    case 'ALREADY_CANCELLED':
      return {
        state: 'approved',
        glyph: CheckCircle2,
        label: COPY.heroCancelled,
        sub: COPY.heroCancelledSub,
        bandExtra:
          '[&>section]:border-t-4 [&>section]:border-t-[var(--lc-status-published-fg)] [&>section]:bg-[var(--lc-surface-raised)]',
      }
    case 'ALREADY_DELETED':
      return {
        state: 'rejected',
        glyph: XCircle,
        label: COPY.heroDeleted,
        sub: COPY.heroDeletedSub,
        bandExtra:
          '[&>section]:border-t-0 [&>section]:bg-[var(--lc-surface-inverse)] [&>section]:text-[var(--lc-text-inverse)] [&_h1]:text-[var(--lc-text-inverse)] [&>section_svg]:text-[var(--lc-text-inverse)]',
      }
    case 'EXPIRED_TOKEN':
      return {
        state: 'expired',
        glyph: Unlink,
        label: COPY.heroExpired,
        sub: COPY.heroExpiredSub,
      }
    case 'INVALID_TOKEN':
    default:
      return {
        state: 'expired',
        glyph: Unlink,
        label: COPY.heroInvalid,
        sub: COPY.heroInvalidSub,
      }
  }
}

function formatScheduledOn(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short',
  }).format(d)
}

/**
 * SHR-AUT-005d — public, path-token-authed scheduled deletion confirmation.
 * Session cookies are never required or trusted for authorization.
 */
export function ScheduledDeletionConfirmationPage() {
  usePageTitle('Scheduled deletion')
  const { token: pathToken = '' } = useParams<{ token: string }>()
  const [searchParams] = useSearchParams()
  const { addToast } = useToast()
  const online = useOnline()

  // Reminder chip is display-only; auth is path token only (never query).
  const reminderSrc = searchParams.get('src')
  const reminderLabel =
    reminderSrc === 'reminder-t-minus-7'
      ? COPY.reminderT7
      : reminderSrc === 'reminder-t-minus-1'
        ? COPY.reminderT1
        : null

  const [ui, setUi] = useState<ScheduledDeletionUiState>('LOADING')
  const [payload, setPayload] = useState<ScheduledDeletionPayload | null>(null)
  const [cancelling, setCancelling] = useState(false)
  const [impactOpen, setImpactOpen] = useState(false)
  const [finalDay, setFinalDay] = useState(false)

  const token = pathToken.trim()

  const load = useCallback(async () => {
    if (!token) {
      setUi('INVALID_TOKEN')
      setPayload(null)
      return
    }
    try {
      const result = await getScheduledDeletion(token)
      if (!result.ok) {
        setPayload(null)
        setUi(mapHttpError(result.status, result.code))
        return
      }
      setPayload(result.body)
      setUi(mapPayloadToUi(result.body))
    } catch {
      // Network failure while offline: keep prior state if any; else invalid.
      if (!navigator.onLine) return
      setUi('INVALID_TOKEN')
      setPayload(null)
    }
  }, [token])

  useEffect(() => {
    void load()
  }, [load])

  // Desktop: impact expanded by default.
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)')
    const apply = () => setImpactOpen(mq.matches)
    apply()
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [])

  // Re-fetch when tab becomes visible after >60s away.
  useEffect(() => {
    let hiddenAt = 0
    const onVis = () => {
      if (document.visibilityState === 'hidden') {
        hiddenAt = Date.now()
        return
      }
      if (hiddenAt && Date.now() - hiddenAt > 60_000) {
        void load()
      }
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [load])

  const onCancel = async () => {
    if (!token || cancelling || !online) return
    setCancelling(true)
    try {
      const result = await postCancelScheduledDeletion(token)
      if (!result.ok) {
        if (result.status === 429) {
          addToast({
            variant: 'warning',
            title: COPY.rateLimited(result.retryAfter ?? 60),
          })
        } else if (result.code === 'already_completed' || result.status === 409) {
          await load()
        } else {
          addToast({ variant: 'error', title: result.error || COPY.cancelFailed })
          await load()
        }
        return
      }
      setPayload(result.body)
      setUi('ALREADY_CANCELLED')
      addToast({ variant: 'success', title: COPY.cancelToast })
    } catch {
      addToast({ variant: 'error', title: COPY.cancelFailed })
      await load()
    } finally {
      setCancelling(false)
    }
  }

  const hero = useMemo(
    () => (ui === 'LOADING' ? null : heroForState(ui)),
    [ui],
  )

  const signInHref = `/login?returnTo=${encodeURIComponent(
    `/account/scheduled-deletion/${encodeURIComponent(token)}`,
  )}`
  const supportHref = `/support/new?context=deletion${
    payload?.deletion_request_id
      ? `&request_id=${encodeURIComponent(payload.deletion_request_id)}`
      : ''
  }`

  const cautionText =
    finalDay && payload?.scheduled_for
      ? COPY.cautionFinal(formatScheduledOn(payload.scheduled_for))
      : COPY.caution

  return (
    <div className="min-h-screen bg-[var(--lc-bg-page)] text-[var(--lc-text-primary)]">
      <header className="sticky top-0 z-10 flex h-12 items-center justify-center border-b border-[var(--lc-border)] bg-[var(--lc-surface-raised)]">
        <span
          className="text-[var(--lc-text-heading)]"
          style={{ font: 'var(--lc-type-heading-3)' }}
          aria-label="WingCaster"
        >
          WingCaster
        </span>
      </header>

      {!online ? (
        <div
          role="status"
          aria-live="polite"
          className="flex items-start gap-2 border-b border-[var(--lc-border)] bg-[var(--lc-surface-sunken)] px-[var(--lc-space-md)] py-[var(--lc-space-sm)] text-[var(--lc-text-secondary)]"
          style={{ font: 'var(--lc-type-body-sm)' }}
          data-offline-banner
        >
          <WifiOff className="mt-0.5 h-4 w-4 shrink-0 text-[var(--lc-text-muted)]" aria-hidden />
          <span>{COPY.offline}</span>
        </div>
      ) : null}

      <main className="mx-auto w-full max-w-[640px] pb-[var(--lc-space-4xl)]">
        {reminderLabel && ui === 'VALID_PENDING' ? (
          <div className="flex justify-center px-[var(--lc-space-md)] pt-[var(--lc-space-md)]">
            <Badge
              variant="outline"
              className="gap-1 rounded-[var(--lc-radius-pill)] bg-[var(--lc-surface-sunken)]"
              style={{ font: 'var(--lc-type-caption)' }}
            >
              <Bell className="h-3.5 w-3.5 text-[var(--lc-text-muted)] rtl:order-last" aria-hidden />
              {reminderLabel}
            </Badge>
          </div>
        ) : null}

        {ui === 'LOADING' ? (
          <div className="space-y-[var(--lc-space-md)] p-[var(--lc-space-md)]" aria-busy="true">
            <div className="h-28 animate-pulse rounded-[var(--lc-radius-lg)] bg-[var(--lc-surface-sunken)] motion-reduce:animate-none" />
            <div className="h-24 animate-pulse rounded-[var(--lc-radius-lg)] bg-[var(--lc-surface-sunken)] motion-reduce:animate-none" />
            <div className="h-12 animate-pulse rounded-[var(--lc-radius-md)] bg-[var(--lc-surface-sunken)] motion-reduce:animate-none" />
          </div>
        ) : null}

        {hero ? (
          <div
            className={cn(
              'transition-opacity duration-base ease-out motion-reduce:transition-none',
              hero.bandExtra,
            )}
            data-deletion-state={ui}
          >
            <StatusHero state={hero.state} label={hero.label} glyph={hero.glyph} />
            <p
              className="bg-[var(--lc-surface-sunken)] px-[var(--lc-space-md)] pb-[var(--lc-space-md)] text-[var(--lc-text-muted)] -mt-1"
              style={{ font: 'var(--lc-type-body-sm)' }}
            >
              <span className="mx-auto block max-w-[1200px] ps-12 md:ps-14">{hero.sub}</span>
            </p>
          </div>
        ) : null}

        {ui === 'VALID_PENDING' && payload?.scheduled_for ? (
          <>
            <DeletionCountdown
              deletionAt={payload.scheduled_for}
              onReachZero={() => {
                void load()
              }}
              onEnterFinalDay={() => setFinalDay(true)}
            />

            <div className="px-[var(--lc-space-md)]">
              <div
                className="flex items-start gap-2 rounded-[var(--lc-radius-md)] bg-[var(--lc-status-underOffer-bg)] px-[var(--lc-space-md)] py-[var(--lc-space-sm)] text-[var(--lc-status-underOffer-fg)]"
                style={{ font: 'var(--lc-type-body-sm)' }}
                role="status"
              >
                <Hourglass className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                <span>{cautionText}</span>
              </div>
            </div>

            <div
              className={cn(
                'mt-[var(--lc-space-md)] flex flex-col-reverse gap-[var(--lc-space-sm)] px-[var(--lc-space-md)]',
                'md:flex-row md:items-center md:justify-end',
              )}
            >
              <Button variant="outline" size="lg" asChild className="w-full md:w-auto md:max-w-[240px]">
                <Link to={signInHref}>{COPY.signIn}</Link>
              </Button>
              <Button
                variant="default"
                size="lg"
                className="w-full md:w-auto md:max-w-[320px]"
                disabled={cancelling || !online}
                aria-disabled={cancelling || !online}
                aria-label={`Cancel deletion of account for ${payload.email_masked}`}
                title={!online ? COPY.offline : undefined}
                onClick={() => {
                  void onCancel()
                }}
              >
                {cancelling ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin motion-reduce:animate-none" />
                    {COPY.cancelling}
                  </>
                ) : (
                  COPY.cancel
                )}
              </Button>
            </div>
          </>
        ) : null}

        {ui === 'ALREADY_CANCELLED' ? (
          <div className="mt-[var(--lc-space-md)] px-[var(--lc-space-md)]">
            <Button variant="outline" size="lg" asChild className="w-full md:max-w-[320px]">
              <Link to={signInHref}>{COPY.signIn}</Link>
            </Button>
          </div>
        ) : null}

        {ui === 'ALREADY_DELETED' ? (
          <div className="mt-[var(--lc-space-md)] px-[var(--lc-space-md)]">
            <Button variant="default" size="lg" asChild className="w-full md:max-w-[320px]">
              <Link to="/register">{COPY.signUp}</Link>
            </Button>
          </div>
        ) : null}

        {ui === 'INVALID_TOKEN' ? (
          <div className="mt-[var(--lc-space-md)] space-y-[var(--lc-space-sm)] px-[var(--lc-space-md)] text-center">
            <p style={{ font: 'var(--lc-type-body-sm)' }} className="text-[var(--lc-text-muted)]">
              {COPY.recoveryInvalid}
            </p>
            <Button variant="outline" size="lg" asChild className="w-full md:max-w-[320px]">
              <Link to="/account-recovery">Account recovery</Link>
            </Button>
          </div>
        ) : null}

        {ui === 'EXPIRED_TOKEN' ? (
          <div className="mt-[var(--lc-space-md)] space-y-[var(--lc-space-sm)] px-[var(--lc-space-md)] text-center">
            <p style={{ font: 'var(--lc-type-body-sm)' }} className="text-[var(--lc-text-muted)]">
              {COPY.recoveryExpired}
            </p>
            <Button variant="outline" size="lg" asChild className="w-full md:max-w-[320px]">
              <Link to="/login?returnTo=%2Fsettings%2Faccount">{COPY.signIn}</Link>
            </Button>
          </div>
        ) : null}

        {payload?.email_masked &&
        (ui === 'VALID_PENDING' || ui === 'ALREADY_CANCELLED') ? (
          <p
            className="mt-[var(--lc-space-lg)] px-[var(--lc-space-md)] text-center text-[var(--lc-text-muted)]"
            style={{ font: 'var(--lc-type-body-sm)' }}
          >
            {COPY.masked(payload.email_masked)}
          </p>
        ) : null}

        {ui === 'VALID_PENDING' || ui === 'ALREADY_CANCELLED' ? (
          <div className="mt-[var(--lc-space-lg)] px-[var(--lc-space-md)]">
            <div
              className="rounded-[var(--lc-radius-lg)] bg-[var(--lc-surface-raised)] p-[var(--lc-space-md)] shadow-[var(--lc-elevation-sm)]"
              data-impact-list
            >
              <button
                type="button"
                className="flex min-h-[var(--lc-tap-target-min)] w-full items-center justify-between gap-2 text-start text-[var(--lc-text-heading)]"
                style={{ font: 'var(--lc-type-heading-3)' }}
                aria-expanded={impactOpen}
                aria-controls="deletion-impact-panel"
                onClick={() => setImpactOpen((v) => !v)}
              >
                {COPY.impactToggle}
                <ChevronDown
                  className={cn(
                    'h-5 w-5 shrink-0 text-[var(--lc-text-muted)] transition-transform duration-base ease-out motion-reduce:transition-none',
                    impactOpen && 'rotate-180',
                  )}
                  aria-hidden
                />
              </button>
              {impactOpen ? (
                <div id="deletion-impact-panel" className="mt-[var(--lc-space-md)] space-y-[var(--lc-space-md)]">
                  <ImpactGroup heading={COPY.deletedHeading} items={IMPACT.deleted} />
                  <ImpactGroup heading={COPY.keptHeading} items={IMPACT.kept} />
                  <ImpactGroup heading={COPY.effectiveHeading} items={IMPACT.effective} />
                </div>
              ) : null}
            </div>
          </div>
        ) : null}

        <p className="mt-[var(--lc-space-xl)] px-[var(--lc-space-md)] text-center">
          <Link
            to={supportHref}
            className="inline-flex min-h-[var(--lc-tap-target-min)] items-center text-[var(--lc-text-brand)] underline-offset-4 hover:underline"
            style={{ font: 'var(--lc-type-body-sm)' }}
          >
            {COPY.support}
          </Link>
        </p>

        {payload && (ui === 'VALID_PENDING' || ui === 'ALREADY_CANCELLED' || ui === 'ALREADY_DELETED') ? (
          <dl
            className="mt-[var(--lc-space-md)] space-y-1 px-[var(--lc-space-md)] text-center text-[var(--lc-text-muted)]"
            style={{ font: 'var(--lc-type-caption)' }}
          >
            <div>
              <dt className="inline">Request reference: </dt>
              <Numeric as="dd" className="inline">
                {payload.deletion_request_id}
              </Numeric>
            </div>
            <div>
              <dt className="inline">Scheduled on </dt>
              <Numeric as="dd" className="inline">
                {formatScheduledOn(payload.scheduled_for)}
              </Numeric>
            </div>
          </dl>
        ) : null}
      </main>
    </div>
  )
}

function ImpactGroup({ heading, items }: { heading: string; items: readonly string[] }) {
  return (
    <div>
      <h4
        className="text-[var(--lc-text-heading)]"
        style={{ font: 'var(--lc-type-body)', fontWeight: 600 }}
      >
        {heading}
      </h4>
      <ul className="mt-[var(--lc-space-2xs)] list-disc space-y-1 ps-5 text-[var(--lc-text-secondary)]" style={{ font: 'var(--lc-type-body-sm)' }}>
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  )
}

export default ScheduledDeletionConfirmationPage
