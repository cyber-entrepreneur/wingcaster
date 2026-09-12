import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { api, setAuthToken } from '@/api/client'
import type {
  AgencyApplicationBody,
  AgencyApplicationSuccess,
  AgencyApplyApiError,
  AgencyPublicProfile,
  GuestSignupPayload,
  InvitationResolvePayload,
} from '@/api/agencyApply'
import {
  AgencyApplicationForm,
  AgencyEmptyState,
  AgencyIdentityCard,
  ApplicationSuccessPanel,
  OwnerNoteCallout,
  PersonaChip,
  mapRefQueryToReferral,
  type ReferralValue,
} from '@/components/agency'
import { EMPTY_IDENTITY_FORM_VALUES, type IdentityFormValues } from '@/components/forms'
import { LanguageSelector } from '@/components/nav/LanguageSelector'
import { useToast } from '@/components/ui/toast'
import { useAuth } from '@/context/AuthContext'
import { cn } from '@/lib/utils'

type PageMode = 'slug' | 'invitation'

type EmptyKind =
  | null
  | 'not-accepting'
  | 'invitation-expired'
  | 'invitation-revoked'
  | 'already-applied'

type LoadedAgency = {
  id: string
  name: string
  slug: string
  logoUrl?: string | null
  description?: string | null
  teamSize?: number
  primaryMarket?: string
  activeListingsCount?: number
  foundedYear?: number
  ownerNote?: string | null
  ownerFirstName?: string | null
  ownerLastInitial?: string | null
  publicEmail?: string | null
  publicWhatsapp?: string | null
  publicPhone?: string | null
  accepting: boolean
}

function mapPublicToAgency(raw: AgencyPublicProfile): LoadedAgency {
  return {
    id: raw.id,
    name: raw.name,
    slug: raw.slug || raw.id,
    logoUrl: raw.logo ?? null,
    description: raw.description ?? null,
    teamSize: typeof raw.member_count === 'number' ? raw.member_count : undefined,
    primaryMarket: raw.primary_market || raw.city || undefined,
    activeListingsCount:
      typeof raw.listings_count === 'number' ? raw.listings_count : undefined,
    foundedYear: typeof raw.founded_year === 'number' ? raw.founded_year : undefined,
    ownerNote: raw.owner_note ?? null,
    ownerFirstName: raw.owner_first_name ?? null,
    ownerLastInitial: raw.owner_last_initial ?? null,
    publicEmail: raw.public_email ?? null,
    publicWhatsapp: raw.public_whatsapp ?? null,
    publicPhone: raw.public_phone ?? null,
    accepting: raw.accepting_applications !== false,
  }
}

function ownerAttribution(agency: LoadedAgency): string | null {
  if (!agency.ownerFirstName) return null
  const initial = agency.ownerLastInitial ? ` ${agency.ownerLastInitial}.` : ''
  return `${agency.ownerFirstName}${initial}, Owner`
}

/** Compact IdentityForm → SHR-AUT-006 identity sub-object for guest_signup. */
export function buildGuestSignupPayload(values: IdentityFormValues): GuestSignupPayload {
  return {
    type: 'email',
    identifier: values.email.trim(),
    credentials: { password: values.password },
    recovery: null,
    name: values.display_name.trim(),
  }
}

/**
 * AGN-MEM-005 — Public join / apply to an agency.
 *
 * Routes (wired in App.tsx):
 * - `/agencies/:agencySlug/apply`
 * - `/join/:invitationCode`
 */
export function PublicAgencyApplyPage() {
  const params = useParams<{ agencySlug?: string; invitationCode?: string }>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { agent, loading: authLoading, logout, refreshAgent } = useAuth()
  const { addToast } = useToast()

  const mode: PageMode = params.invitationCode ? 'invitation' : 'slug'
  const agencySlug = params.agencySlug || ''
  const invitationCode = params.invitationCode || ''
  const refParam = searchParams.get('ref')
  const initialReferral = mapRefQueryToReferral(refParam) as ReferralValue | ''

  const [loading, setLoading] = useState(true)
  const [agency, setAgency] = useState<LoadedAgency | null>(null)
  const [inviteMeta, setInviteMeta] = useState<{
    expiresAt?: string | null
    invitedBy?: string | null
    status?: string | null
  }>({})
  const [empty, setEmpty] = useState<EmptyKind>(null)
  const [existingAppId, setExistingAppId] = useState<string | null>(null)
  const [existingStatus, setExistingStatus] = useState('pending')
  const [success, setSuccess] = useState<AgencyApplicationSuccess | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [offline, setOffline] = useState(
    typeof navigator !== 'undefined' ? !navigator.onLine : false,
  )
  const [guestOpen, setGuestOpen] = useState(false)
  const [guestValues, setGuestValues] = useState<IdentityFormValues>(EMPTY_IDENTITY_FORM_VALUES)
  const [contactOpen, setContactOpen] = useState(false)

  const abortRef = useRef<AbortController | null>(null)
  const signedIn = Boolean(agent)

  useEffect(() => {
    const onOnline = () => setOffline(false)
    const onOffline = () => setOffline(true)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setEmpty(null)
    setSuccess(null)
    setAgency(null)

    async function loadSlug() {
      try {
        const raw = (await api.getAgencyPublic(agencySlug)) as AgencyPublicProfile
        if (cancelled) return
        const mapped = mapPublicToAgency(raw)
        setAgency(mapped)
        if (!mapped.accepting) setEmpty('not-accepting')
      } catch (err) {
        const status = (err as AgencyApplyApiError).status
        if (status === 404) {
          addToast({
            variant: 'error',
            title: "That agency link isn't valid.",
          })
          navigate('/agencies', { replace: true })
          return
        }
        addToast({
          variant: 'error',
          title: 'Something went wrong loading this agency.',
        })
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    async function loadInvite() {
      try {
        const raw = (await api.resolveInvitation(invitationCode)) as InvitationResolvePayload
        if (cancelled) return
        if (!raw.agency) {
          addToast({ variant: 'error', title: "That agency link isn't valid." })
          navigate('/agencies', { replace: true })
          return
        }
        setInviteMeta({
          expiresAt: raw.expires_at,
          invitedBy: raw.invited_by_first_name ?? null,
          status: raw.status,
        })
        if (raw.status === 'expired') {
          setAgency({
            id: raw.agency.id,
            name: raw.agency.name,
            slug: raw.agency.slug || raw.agency.id,
            logoUrl: raw.agency.logo,
            description: raw.agency.description,
            accepting: true,
          })
          setEmpty('invitation-expired')
          setLoading(false)
          return
        }
        if (raw.status === 'revoked' || raw.status === 'used') {
          setAgency({
            id: raw.agency.id,
            name: raw.agency.name,
            slug: raw.agency.slug || raw.agency.id,
            logoUrl: raw.agency.logo,
            description: raw.agency.description,
            accepting: true,
          })
          setEmpty(raw.status === 'revoked' ? 'invitation-revoked' : 'invitation-expired')
          setLoading(false)
          return
        }

        // Enrich with public profile (member_count, accepting_applications, …).
        let mapped: LoadedAgency = {
          id: raw.agency.id,
          name: raw.agency.name,
          slug: raw.agency.slug || raw.agency.id,
          logoUrl: raw.agency.logo,
          description: raw.agency.description,
          accepting: true,
        }
        try {
          const key = raw.agency.slug || raw.agency.id
          const pub = (await api.getAgencyPublic(key)) as AgencyPublicProfile
          mapped = mapPublicToAgency(pub)
        } catch {
          // Keep resolve payload fields.
        }
        if (cancelled) return
        setAgency(mapped)
        if (!mapped.accepting) setEmpty('not-accepting')
      } catch (err) {
        const status = (err as AgencyApplyApiError).status
        if (status === 404) {
          addToast({
            variant: 'error',
            title: "That invitation link isn't valid.",
          })
          navigate('/agencies', { replace: true })
          return
        }
        addToast({
          variant: 'error',
          title: 'Something went wrong loading this invitation.',
        })
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    if (mode === 'invitation') {
      void loadInvite()
    } else if (agencySlug) {
      void loadSlug()
    } else {
      setLoading(false)
    }

    return () => {
      cancelled = true
    }
  }, [mode, agencySlug, invitationCode, navigate, addToast])

  useEffect(() => {
    if (agency?.name) {
      document.title = `Apply to join ${agency.name} · WingCaster`
    } else {
      document.title = 'Apply to join agency · WingCaster'
    }
  }, [agency?.name])

  const signInHref = useMemo(() => {
    const returnTo =
      mode === 'invitation'
        ? `/join/${encodeURIComponent(invitationCode)}`
        : `/agencies/${encodeURIComponent(agencySlug)}/apply${refParam ? `?ref=${encodeURIComponent(refParam)}` : ''}`
    return `/login?returnTo=${encodeURIComponent(returnTo)}`
  }, [mode, invitationCode, agencySlug, refParam])

  const handleCancel = useCallback(() => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      navigate(-1)
      return
    }
    navigate('/')
  }, [navigate])

  const handleSubmit = useCallback(
    async (body: AgencyApplicationBody) => {
      if (!agency) return
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller
      setSubmitting(true)

      try {
        const payload: AgencyApplicationBody = {
          ...body,
          guest_signup: agent ? null : buildGuestSignupPayload(guestValues),
        }

        let result: AgencyApplicationSuccess
        if (mode === 'invitation') {
          result = (await api.acceptInvitation(invitationCode, payload, {
            signal: controller.signal,
          })) as AgencyApplicationSuccess
        } else {
          result = (await api.applyToAgencyBySlug(agency.slug, payload, {
            signal: controller.signal,
          })) as AgencyApplicationSuccess
        }

        if (!agent && result.session?.token) {
          setAuthToken(result.session.token)
          try {
            await refreshAgent()
          } catch {
            // Session token is enough for subsequent navigations; /me may lag.
          }
        }

        setSuccess(result)
        setEmpty(null)
      } catch (err) {
        if ((err as Error).name === 'AbortError') return
        const apiErr = err as AgencyApplyApiError
        const code = String(apiErr.code || apiErr.error || '')
        const status = apiErr.status

        if (status === 401) {
          addToast({
            variant: 'error',
            title: 'Your session expired mid-signup. Please try again.',
          })
          setGuestOpen(true)
          return
        }

        if (
          status === 409 &&
          (code === 'ALREADY_APPLIED' || /already/i.test(String(apiErr.error || apiErr.message)))
        ) {
          setExistingAppId(apiErr.existing_application_id ?? null)
          setExistingStatus(apiErr.existing_status || 'pending')
          setEmpty('already-applied')
          return
        }

        if (
          status === 409 &&
          (code === 'AGENCY_NOT_ACCEPTING' || /not accepting/i.test(String(apiErr.error || apiErr.message)))
        ) {
          setEmpty('not-accepting')
          return
        }

        if (status === 410 && (code === 'INVITATION_EXPIRED' || code === 'INVITATION_REVOKED')) {
          if (apiErr.fallback_slug) {
            setAgency((prev) =>
              prev
                ? { ...prev, slug: apiErr.fallback_slug || prev.slug }
                : prev,
            )
          }
          setEmpty(code === 'INVITATION_REVOKED' ? 'invitation-revoked' : 'invitation-expired')
          return
        }

        if (status === 400 && apiErr.field_errors) {
          const guestKeys = Object.keys(apiErr.field_errors).filter((k) =>
            k.startsWith('guest_signup'),
          )
          if (guestKeys.length) {
            setGuestOpen(true)
            const first = guestKeys[0]!
            addToast({
              variant: 'error',
              title: `${first}: ${apiErr.field_errors[first]}`,
            })
            return
          }
          addToast({
            variant: 'error',
            title: 'Please fix the highlighted fields and try again.',
          })
          return
        }

        if (status === 409 && apiErr.field_errors) {
          const guestKeys = Object.keys(apiErr.field_errors).filter((k) =>
            k.startsWith('guest_signup'),
          )
          if (guestKeys.length) {
            setGuestOpen(true)
            const first = guestKeys[0]!
            addToast({
              variant: 'error',
              title: `${first}: ${apiErr.field_errors[first]}`,
            })
            return
          }
        }

        if (!navigator.onLine || /network|fetch/i.test((err as Error).message || '')) {
          addToast({
            variant: 'error',
            title: "You're offline. Reconnect to send your application.",
          })
          setOffline(true)
          return
        }

        addToast({
          variant: 'error',
          title: 'Something went wrong sending your application. Please try again.',
        })
      } finally {
        setSubmitting(false)
      }
    },
    [
      agency,
      agent,
      guestValues,
      refreshAgent,
      mode,
      invitationCode,
      addToast,
    ],
  )

  // Cancel aborts in-flight submit (brief: Cancel remains enabled while submitting).
  const handleCancelWhileSubmit = useCallback(() => {
    if (submitting) {
      abortRef.current?.abort()
      setSubmitting(false)
      return
    }
    handleCancel()
  }, [submitting, handleCancel])

  const contactHref = agency?.publicEmail
    ? `mailto:${agency.publicEmail}`
    : agency?.publicWhatsapp
      ? `https://wa.me/${agency.publicWhatsapp.replace(/\D/g, '')}`
      : agency?.publicPhone
        ? `tel:${agency.publicPhone}`
        : undefined

  const invitedByLabel =
    mode === 'invitation'
      ? inviteMeta.invitedBy
        ? `Invited by ${inviteMeta.invitedBy}`
        : 'Invitation'
      : undefined

  return (
    <div className="min-h-screen bg-[var(--lc-bg-page)] text-[var(--lc-text-primary)]">
      <a
        href="#agency-identity"
        className="sr-only focus:not-sr-only focus:absolute focus:start-4 focus:top-4 focus:z-50 focus:bg-[var(--lc-surface-raised)] focus:px-3 focus:py-2"
      >
        Skip to content
      </a>

      <header className="border-b border-[var(--lc-border)] bg-[var(--lc-surface-raised)]">
        <div className="mx-auto flex max-w-[720px] items-center justify-between gap-3 px-[var(--lc-space-md)] py-[var(--lc-space-sm)]">
          <Link
            to="/"
            className="font-bold tracking-tight text-[var(--lc-text-heading)]"
            style={{ font: 'var(--lc-type-heading-3)' }}
          >
            WingCaster
          </Link>
          <div className="flex items-center gap-[var(--lc-space-sm)]">
            <LanguageSelector />
            <div className="hidden md:block">
              {!authLoading ? (
                <PersonaChip
                  variant="apply"
                  signedIn={signedIn}
                  displayName={agent?.name}
                  email={agent?.email}
                  avatarUrl={agent?.photo}
                  signInHref={signInHref}
                  onSignOut={logout}
                />
              ) : null}
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[720px] px-[var(--lc-space-md)] pb-[var(--lc-space-5xl)] pt-[var(--lc-space-2xl)] md:pt-[var(--lc-space-4xl)]">
        {agency ? (
          <h1
            className="mb-[var(--lc-space-lg)] text-[var(--lc-text-primary)]"
            style={{ font: 'var(--lc-type-heading-1)' }}
          >
            Apply to join{' '}
            <span className="text-[var(--lc-text-heading)]">{agency.name}</span>
          </h1>
        ) : (
          <h1
            className="mb-[var(--lc-space-lg)] text-[var(--lc-text-heading)]"
            style={{ font: 'var(--lc-type-heading-1)' }}
          >
            Apply to join an agency
          </h1>
        )}

        <div className="mb-[var(--lc-space-lg)] md:hidden">
          {!authLoading ? (
            <PersonaChip
              variant="apply"
              signedIn={signedIn}
              displayName={agent?.name}
              email={agent?.email}
              avatarUrl={agent?.photo}
              signInHref={signInHref}
              onSignOut={logout}
              className="w-full"
            />
          ) : null}
        </div>

        {loading ? (
          <ApplyPageSkeleton />
        ) : empty && agency ? (
          <AgencyEmptyState
            variant={empty}
            agencyName={agency.name}
            applicationStatus={existingStatus}
            applyDirectlyHref={`/agencies/${encodeURIComponent(agency.slug)}/apply`}
            applicationStatusHref={
              existingAppId ? `/applications/${existingAppId}` : undefined
            }
            contactHref={contactHref}
            onContact={contactHref ? undefined : () => setContactOpen(true)}
          />
        ) : success && agency ? (
          <div
            className="transition-opacity duration-[var(--lc-duration-base)] ease-[var(--lc-easing-out)]"
          >
            <ApplicationSuccessPanel
              agencyName={success.application.agency_name || agency.name}
              ownerFirstName={agency.ownerFirstName}
              applicationId={success.application.id}
              trackHref={
                success.redirect_to || `/applications/${success.application.id}`
              }
            />
          </div>
        ) : agency ? (
          <div className="flex flex-col gap-[var(--lc-space-lg)]">
            <div id="agency-identity">
              <AgencyIdentityCard
                name={agency.name}
                description={agency.description || undefined}
                logoUrl={agency.logoUrl}
                teamSize={agency.teamSize}
                primaryMarket={agency.primaryMarket}
                activeListingsCount={agency.activeListingsCount}
                foundedYear={agency.foundedYear}
                profileHref={`/public/agency/${encodeURIComponent(agency.slug)}`}
                invitedByLabel={invitedByLabel}
                invitationExpiresAt={
                  mode === 'invitation' ? inviteMeta.expiresAt : null
                }
              />
            </div>

            {agency.ownerNote && ownerAttribution(agency) ? (
              <OwnerNoteCallout
                body={agency.ownerNote}
                attribution={ownerAttribution(agency)!}
              />
            ) : agency.ownerNote ? (
              <OwnerNoteCallout body={agency.ownerNote} attribution="Owner" />
            ) : null}

            <div
              className={cn(
                'rounded-[var(--lc-radius-lg)] border border-[var(--lc-border)]',
                'bg-[var(--lc-surface-raised)] p-[var(--lc-space-lg)] md:p-[var(--lc-space-xl)]',
              )}
              style={{ boxShadow: 'var(--lc-elevation-sm)' }}
            >
              <AgencyApplicationForm
                agencyName={agency.name}
                signedIn={signedIn}
                signedInDisplayName={agent?.name}
                signedInEmail={agent?.email}
                invitationMode={mode === 'invitation'}
                initialReferral={initialReferral}
                otherAgencyName={
                  agent?.agency_name && agent.agency_name !== agency.name
                    ? agent.agency_name
                    : null
                }
                offline={offline}
                submitting={submitting}
                guestValues={guestValues}
                onGuestValuesChange={setGuestValues}
                guestOpen={guestOpen}
                onGuestOpenChange={setGuestOpen}
                onCancel={handleCancelWhileSubmit}
                onSubmit={handleSubmit}
              />
            </div>

            <footer
              className="flex flex-col gap-1 text-[var(--lc-text-muted)]"
              style={{ font: 'var(--lc-type-caption)' }}
            >
              <p>Applications typically get a response within 2 business days.</p>
              <p>You&apos;ll be notified by email and in the WingCaster app.</p>
              <p>{agency.name} may contact you directly to schedule a call.</p>
            </footer>
          </div>
        ) : (
          <p className="text-[var(--lc-text-muted)]">Agency not found.</p>
        )}
      </main>

      {contactOpen ? (
        <ContactAgencyDialog
          agencyName={agency?.name || 'the agency'}
          onClose={() => setContactOpen(false)}
        />
      ) : null}
    </div>
  )
}

function ApplyPageSkeleton() {
  return (
    <div className="flex flex-col gap-[var(--lc-space-lg)]" aria-busy="true" aria-label="Loading">
      <div className="h-28 animate-pulse rounded-[var(--lc-radius-lg)] bg-[var(--lc-surface-sunken)]" />
      <div className="h-64 animate-pulse rounded-[var(--lc-radius-lg)] bg-[var(--lc-surface-sunken)]" />
    </div>
  )
}

function ContactAgencyDialog({
  agencyName,
  onClose,
}: {
  agencyName: string
  onClose: () => void
}) {
  const dialogRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null
    const node = dialogRef.current
    const focusable = node?.querySelector<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')
    focusable?.focus()

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
        return
      }
      if (event.key !== 'Tab' || !node) return
      const items = Array.from(
        node.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((el) => !el.hasAttribute('disabled'))
      if (items.length === 0) return
      const first = items[0]!
      const last = items[items.length - 1]!
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      prev?.focus?.()
    }
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-[var(--lc-z-modal)] flex items-center justify-center bg-[color-mix(in_srgb,var(--lc-surface-inverse)_50%,transparent)] p-4"
      role="presentation"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="contact-agency-title"
        className="w-full max-w-md rounded-[var(--lc-radius-lg)] border border-[var(--lc-border)] bg-[var(--lc-surface-raised)] p-[var(--lc-space-xl)]"
        style={{ boxShadow: 'var(--lc-elevation-lg)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="contact-agency-title" style={{ font: 'var(--lc-type-heading-3)' }}>
          Contact {agencyName}
        </h2>
        <p className="mt-2 text-[var(--lc-text-secondary)]" style={{ font: 'var(--lc-type-body)' }}>
          This agency has not published a public email or WhatsApp on their profile. Ask the person
          who shared the invitation for a new contact method.
        </p>
        <div className="mt-[var(--lc-space-lg)] flex justify-end">
          <button
            type="button"
            className="min-h-[var(--lc-tap-target-min)] rounded-[var(--lc-radius-md)] bg-[var(--lc-action-primary)] px-4 text-[var(--lc-action-primary-text)] hover:bg-[var(--lc-action-primary-hover)]"
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

export default PublicAgencyApplyPage
