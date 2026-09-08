import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  EMPTY_IDENTITY_FORM_VALUES,
  IdentityForm,
  isIdentityFormValid,
  normalizePhoneE164,
  type IdentityFormFieldErrors,
  type IdentityFormValues,
  type IdentityIdentifierType,
} from '@/components/forms/IdentityForm'
import { PathSelector } from '@/components/auth/PathSelector'
import { OAuthTrio } from '@/components/auth/OAuthTrio'
import { PathBFields } from '@/components/auth/PathBFields'
import { PathCFields, EMPTY_PATH_C_VALUES, type PathCValues } from '@/components/auth/PathCFields'
import { HeroPanel } from '@/components/auth/HeroPanel'
import { TrustFooter } from '@/components/auth/TrustFooter'
import { DupIdentityModal } from '@/components/auth/DupIdentityModal'
import {
  adoptRegisterToken,
  defaultRedirectForPath,
  postAuthRegister,
  RegisterApiError,
  type RegisterRequestBody,
} from '@/components/auth/registerApi'
import { startOAuth, type OAuthProvider } from '@/components/auth/loginApi'
import { rt, type RegistrationPath } from '@/components/auth/registerCopy'
import { LanguageSelector } from '@/components/nav/LanguageSelector'
import { useLocale } from '@/hooks/useLocale'
import { useToast } from '@/components/ui/toast'
import { useAuth } from '@/context/AuthContext'

function parsePathParam(raw: string | null, agency: string | null): RegistrationPath | null {
  if (raw === 'solo' || raw === 'join' || raw === 'agency') return raw
  // Compat with TenantSwitcher links (?intent=…) without editing nav files.
  if (raw === null) {
    // fall through
  }
  return agency ? 'join' : null
}

function parseIntentAsPath(intent: string | null): RegistrationPath | null {
  if (intent === 'create-agency') return 'agency'
  if (intent === 'join-agency') return 'join'
  return null
}

/**
 * SHR-AUT-006 — Create account (3 registration paths × 6 identity paths).
 * Route: `/register?path=solo|join|agency&agency=<slug>&plan=<tier>`
 */
export function RegisterPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { locale } = useLocale()
  const { addToast } = useToast()
  const { refreshAgent, agent, loading: authLoading } = useAuth()

  const agencyParam = searchParams.get('agency')
  const planParam = searchParams.get('plan')
  const initialPath =
    parsePathParam(searchParams.get('path'), agencyParam) ??
    parseIntentAsPath(searchParams.get('intent'))

  const [path, setPath] = useState<RegistrationPath | null>(initialPath)
  const [identifierType, setIdentifierType] = useState<IdentityIdentifierType>('email')
  const [identity, setIdentity] = useState<IdentityFormValues>({
    ...EMPTY_IDENTITY_FORM_VALUES,
  })
  const [joinSlug, setJoinSlug] = useState(agencyParam ?? '')
  const [agencyFields, setAgencyFields] = useState<PathCValues>({ ...EMPTY_PATH_C_VALUES })
  const [submitting, setSubmitting] = useState(false)
  const [oauthProvider, setOauthProvider] = useState<OAuthProvider | null>(null)
  const [dupOpen, setDupOpen] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<IdentityFormFieldErrors>({})
  const [pathBError, setPathBError] = useState<string | undefined>()
  const [online, setOnline] = useState(
    typeof navigator === 'undefined' ? true : navigator.onLine,
  )

  useEffect(() => {
    document.title = rt('page.title', locale)
  }, [locale])

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

  useEffect(() => {
    if (!authLoading && agent) {
      navigate(defaultRedirectForPath(path ?? 'solo'), { replace: true })
    }
  }, [authLoading, agent, navigate, path])

  useEffect(() => {
    if (agencyParam) {
      setJoinSlug(agencyParam)
      setPath((prev) => prev ?? 'join')
    }
  }, [agencyParam])

  const pathSpecificValid = useMemo(() => {
    if (!path) return false
    if (path === 'solo') return true
    if (path === 'join') return joinSlug.trim().length > 0
    return (
      agencyFields.agency_name.trim().length > 0 &&
      Boolean(agencyFields.legal_entity) &&
      Boolean(agencyFields.primary_market) &&
      agencyFields.authorized_to_accept
    )
  }, [path, joinSlug, agencyFields])

  const identityValid = isIdentityFormValid(identity, {
    variant: 'full',
    identifier_type: identifierType,
  })

  const formLocked = submitting || Boolean(oauthProvider) || !online

  const buildBody = useCallback(
    (values: IdentityFormValues): RegisterRequestBody | null => {
      if (!path) return null
      let identifier = ''
      if (identifierType === 'email') identifier = values.email.trim()
      else if (identifierType === 'username') identifier = values.username.trim()
      else identifier = normalizePhoneE164(values.phone, values.phone_dial || '+971')

      const path_data: RegisterRequestBody['path_data'] =
        path === 'join'
          ? { agency_slug_or_code: joinSlug.trim() }
          : path === 'agency'
            ? {
                agency_name: agencyFields.agency_name.trim(),
                legal_entity: agencyFields.legal_entity as Exclude<
                  typeof agencyFields.legal_entity,
                  ''
                >,
                primary_market: agencyFields.primary_market as Exclude<
                  typeof agencyFields.primary_market,
                  ''
                >,
                authorized_to_accept: agencyFields.authorized_to_accept,
              }
            : {}

      const body: RegisterRequestBody = {
        path,
        identity: {
          type: identifierType,
          identifier,
          credentials: { password: values.password },
        },
        consents: {
          terms: values.consent_terms,
          marketing: values.consent_marketing,
        },
        path_data,
        locale,
      }

      if (identifierType === 'username') {
        body.recovery = {
          ...(values.recovery_email.trim()
            ? { email: values.recovery_email.trim() }
            : {}),
          ...(values.recovery_phone.trim()
            ? {
                phone: normalizePhoneE164(
                  values.recovery_phone,
                  values.phone_dial || '+971',
                ),
              }
            : {}),
        }
      }

      if (planParam) body.plan = planParam
      const ref = document.referrer
      if (ref) body.referrer = ref

      return body
    },
    [path, identifierType, joinSlug, agencyFields, locale, planParam],
  )

  const handleSubmit = async (values: IdentityFormValues) => {
    if (!path || !pathSpecificValid || !identityValid) return
    setFieldErrors({})
    setPathBError(undefined)
    setSubmitting(true)
    try {
      const body = buildBody(values)
      if (!body) return
      const result = await postAuthRegister(body)
      await adoptRegisterToken(result.session.token)
      await refreshAgent?.()
      navigate(result.redirect_to || defaultRedirectForPath(path), { replace: true })
    } catch (err) {
      if (err instanceof RegisterApiError) {
        if (err.code === 'FREE_TRIAL_ALREADY_CLAIMED') {
          setDupOpen(true)
          return
        }
        if (err.code === 'VALIDATION_FAILED' && err.fieldErrors) {
          const next: IdentityFormFieldErrors = {}
          const fe = err.fieldErrors
          if (fe['identity.identifier']) {
            if (identifierType === 'email') next.email = 'Invalid format'
            else if (identifierType === 'username') next.username = 'Invalid format'
            else next.phone = 'Invalid format'
          }
          if (fe['path_data.agency_slug_or_code']) {
            setPathBError('Agency not found. Check the slug or invitation code.')
          }
          setFieldErrors(next)
          return
        }
        if (err.code === 'network') {
          addToast({
            variant: 'error',
            description: "You're offline. Reconnect to create your account.",
          })
          return
        }
      }
      addToast({
        variant: 'error',
        description: 'Something went wrong. Please try again.',
      })
    } finally {
      setSubmitting(false)
    }
  }

  const handleOAuth = async (provider: OAuthProvider) => {
    if (!path) return
    setOauthProvider(provider)
    try {
      await startOAuth(provider)
    } catch {
      addToast({
        variant: 'error',
        description: 'Something went wrong. Please try again.',
      })
      setOauthProvider(null)
    }
  }

  const onPathChange = (next: RegistrationPath) => {
    setPath(next)
    setPathBError(undefined)
  }

  if (authLoading) {
    return (
      <div
        className="flex min-h-screen items-center justify-center bg-[var(--lc-bg-page)]"
        data-testid="register-skeleton"
      >
        <div className="w-full max-w-md animate-pulse space-y-4 p-6">
          <div className="h-8 rounded bg-[var(--lc-surface-sunken)]" />
          <div className="h-24 rounded bg-[var(--lc-surface-sunken)]" />
          <div className="h-40 rounded bg-[var(--lc-surface-sunken)]" />
        </div>
      </div>
    )
  }

  const showIdentity = path !== null

  return (
    <div className="min-h-screen bg-[var(--lc-bg-page)]" data-testid="register-page">
      <a
        href="#register-content"
        className="sr-only focus:not-sr-only focus:absolute focus:start-4 focus:top-4 focus:z-50 focus:rounded-[var(--lc-radius-md)] focus:bg-[var(--lc-surface-raised)] focus:px-3 focus:py-2"
      >
        {rt('skip.toContent', locale)}
      </a>

      <div className="lg:grid lg:min-h-screen lg:grid-cols-[3fr_2fr]">
        {/* Form column */}
        <main className="flex flex-col px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
          <div className="mx-auto flex w-full max-w-xl flex-col gap-[var(--lc-space-xl)]">
            {/* Sticky mobile top bar */}
            <div className="sticky top-0 z-10 -mx-4 flex items-center justify-between gap-[var(--lc-space-md)] border-b border-[var(--lc-border)] bg-[var(--lc-bg-page)]/95 px-4 py-3 backdrop-blur-sm lg:static lg:mx-0 lg:border-0 lg:bg-transparent lg:p-0 lg:backdrop-blur-none">
              <p
                className="text-[var(--lc-text-heading)]"
                style={{
                  font: 'var(--lc-type-heading-2)',
                  letterSpacing: 'var(--lc-tracking-heading-2)',
                }}
              >
                {rt('brand.wordmark', locale)}
              </p>
              <LanguageSelector />
            </div>

            {/* Mobile compact hero */}
            <div className="lg:hidden">
              <HeroPanel locale={locale} variant="compact" />
            </div>

            {!online ? (
              <div
                role="status"
                className="rounded-[var(--lc-radius-md)] border border-[var(--lc-status-underOffer-bg)] bg-[var(--lc-status-underOffer-bg)] px-3 py-2 text-sm text-[var(--lc-status-underOffer-fg)]"
              >
                {rt('offline.banner', locale)}
              </div>
            ) : null}

            <header id="register-content" className="flex flex-col gap-2">
              <h1
                className="text-[var(--lc-text-heading)] max-lg:hidden"
                style={{
                  font: 'var(--lc-type-display)',
                  letterSpacing: 'var(--lc-tracking-display)',
                }}
              >
                {rt('hero.h1', locale)}
              </h1>
              <h1
                className="text-[var(--lc-text-heading)] lg:hidden"
                style={{
                  font: 'var(--lc-type-heading-1)',
                  letterSpacing: 'var(--lc-tracking-heading-1)',
                }}
              >
                {rt('hero.h1.mobile', locale)}
              </h1>
              <p
                className="text-[var(--lc-text-muted)]"
                style={{ font: 'var(--lc-type-body-lg)' }}
              >
                {rt('hero.sub', locale)}
              </p>
            </header>

            <PathSelector
              value={path}
              onChange={onPathChange}
              locale={locale}
              disabled={formLocked}
            />

            {showIdentity ? (
              <section
                className="flex flex-col gap-[var(--lc-space-lg)]"
                aria-label="Identity handshake"
              >
                <OAuthTrio
                  locale={locale}
                  disabled={formLocked || !path}
                  loadingProvider={oauthProvider}
                  onStart={handleOAuth}
                />

                <IdentityForm
                  variant="full"
                  values={identity}
                  identifier_type={identifierType}
                  onChange={setIdentity}
                  onIdentifierTypeChange={setIdentifierType}
                  onSubmit={handleSubmit}
                  disabled={formLocked}
                  submitting={submitting}
                  submitting_label={rt('submit.creating', locale)}
                  submitDisabled={!pathSpecificValid || !online}
                  fieldErrors={fieldErrors}
                />

                {path === 'join' ? (
                  <PathBFields
                    value={joinSlug}
                    onChange={setJoinSlug}
                    locale={locale}
                    disabled={formLocked}
                    error={pathBError}
                  />
                ) : null}

                {path === 'agency' ? (
                  <PathCFields
                    values={agencyFields}
                    onChange={setAgencyFields}
                    locale={locale}
                    disabled={formLocked}
                  />
                ) : null}
              </section>
            ) : null}

            <div className="flex flex-col gap-[var(--lc-space-md)]">
              <p
                className="text-end text-[var(--lc-text-secondary)]"
                style={{ font: 'var(--lc-type-body-sm)' }}
              >
                {rt('signin.link', locale)}{' '}
                <Link
                  to="/login?from=register"
                  className="font-semibold text-[var(--lc-action-primary)] underline-offset-2 hover:underline"
                >
                  {rt('signin.cta', locale)}
                </Link>
              </p>
              <TrustFooter locale={locale} />
            </div>
          </div>
        </main>

        {/* Desktop hero */}
        <div className="hidden lg:block">
          <HeroPanel locale={locale} variant="full" className="min-h-screen" />
        </div>
      </div>

      <DupIdentityModal open={dupOpen} onOpenChange={setDupOpen} locale={locale} />
    </div>
  )
}

/** @deprecated Use RegisterPage — kept for any lingering imports during Wave 1. */
export const AgentRegisterPage = RegisterPage
