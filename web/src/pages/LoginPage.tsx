import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { AlertCircle, Eye, EyeOff, Loader2, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Numeric } from '@/components/ui/numeric'
import { cn } from '@/lib/utils'
import { useAuth } from '@/context/AuthContext'
import { clearElevatedToken } from '@/api/client'
import type { TwoFactorRequired } from '@/types/twoFactor'
import { OAuthButtons } from '@/components/auth/OAuthButtons'
import {
  adoptLoginToken,
  LoginApiError,
  postAuthLogin,
  startOAuth,
  type IdentifierType,
  type OAuthProvider,
} from '@/components/auth/loginApi'
import { t } from '@/components/auth/loginCopy'
import { LanguageSelector } from '@/components/nav/LanguageSelector'
import { useLocale } from '@/hooks/useLocale'

const PHONE_COUNTRIES = [
  { code: 'AE', dial: '+971', label: 'AE +971' },
  { code: 'SA', dial: '+966', label: 'SA +966' },
  { code: 'EG', dial: '+20', label: 'EG +20' },
  { code: 'LB', dial: '+961', label: 'LB +961' },
] as const

function buildIdentifier(type: IdentifierType, raw: string, dial: string): string {
  const value = raw.trim()
  if (type === 'username') return value.replace(/^@+/, '')
  if (type === 'phone') {
    const digits = value.replace(/[^\d]/g, '')
    return `${dial}${digits}`
  }
  return value
}

export function LoginPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { completeTwoFactor, agent, loading: authLoading, refreshAgent } = useAuth()

  const { locale } = useLocale()
  const [identifierType, setIdentifierType] = useState<IdentifierType>('email')
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)
  const [countryDial, setCountryDial] = useState<string>(PHONE_COUNTRIES[0].dial)
  const [errorKey, setErrorKey] = useState<
    | null
    | 'error.invalid'
    | 'error.locked'
    | 'error.rate'
    | 'error.network'
    | 'error.oauth.google'
    | 'error.oauth.apple'
    | 'error.oauth.facebook'
  >(null)
  const [errorVars, setErrorVars] = useState<Record<string, string | number>>({})
  const [oauthProvider, setOauthProvider] = useState<OAuthProvider | null>(null)
  const [loading, setLoading] = useState(false)
  const [rateSeconds, setRateSeconds] = useState(0)
  const [challenge, setChallenge] = useState<TwoFactorRequired | null>(null)
  const [code, setCode] = useState('')
  const [twoFactorError, setTwoFactorError] = useState('')
  const identifierRef = useRef<HTMLInputElement>(null)
  const passwordRevealTimer = useRef<number | null>(null)

  const requestedReturnTo = searchParams.get('returnTo')
  const returnTo =
    requestedReturnTo?.startsWith('/') && !requestedReturnTo.startsWith('//')
      ? requestedReturnTo
      : '/dashboard'
  const fromSignup = searchParams.get('from') === 'signup' || searchParams.get('from') === 'register'

  useEffect(() => {
    document.title = t('page.title', locale)
  }, [locale])

  useEffect(() => {
    if (!authLoading && agent) {
      navigate(returnTo, { replace: true })
    }
  }, [authLoading, agent, navigate, returnTo])

  useEffect(() => {
    if (!fromSignup) {
      identifierRef.current?.focus()
    }
  }, [fromSignup, identifierType])

  useEffect(() => {
    if (rateSeconds <= 0) return
    const id = window.setInterval(() => {
      setRateSeconds((s) => Math.max(0, s - 1))
    }, 1000)
    return () => window.clearInterval(id)
  }, [rateSeconds])

  useEffect(() => {
    return () => {
      if (passwordRevealTimer.current) window.clearTimeout(passwordRevealTimer.current)
    }
  }, [])

  const canSubmit =
    identifier.trim().length > 0 && password.length > 0 && !loading && rateSeconds === 0

  const clearFormError = () => {
    setErrorKey(null)
    setErrorVars({})
    setOauthProvider(null)
  }

  const onTabChange = (value: string) => {
    setIdentifierType(value as IdentifierType)
    setIdentifier('')
    clearFormError()
  }

  const togglePassword = () => {
    setShowPassword((prev) => {
      const next = !prev
      if (passwordRevealTimer.current) window.clearTimeout(passwordRevealTimer.current)
      if (next) {
        passwordRevealTimer.current = window.setTimeout(() => setShowPassword(false), 5000)
      }
      return next
    })
  }

  const doLogin = async () => {
    clearFormError()
    if (!identifier.trim() || !password) {
      setErrorKey('error.invalid')
      return
    }
    setLoading(true)
    try {
      const resolved = buildIdentifier(identifierType, identifier, countryDial)
      const outcome = await postAuthLogin({
        identifier: resolved,
        identifier_type: identifierType,
        password,
        remember_me: rememberMe,
      })
      if (outcome.status === '2fa_required') {
        setChallenge(outcome)
        setPassword('')
        return
      }
      await adoptLoginToken(outcome.token)
      clearElevatedToken()
      await refreshAgent()
      navigate(returnTo, { replace: true })
    } catch (err) {
      if (err instanceof LoginApiError) {
        if (err.code === 'network') setErrorKey('error.network')
        else if (err.code === 'rate') {
          setErrorKey('error.rate')
          const seconds = err.retryAfterSeconds ?? 15
          setRateSeconds(seconds)
          setErrorVars({ seconds })
        } else if (err.code === 'locked') {
          setErrorKey('error.locked')
          setErrorVars({ minutes: err.lockedMinutes ?? 15 })
        } else setErrorKey('error.invalid')
      } else {
        setErrorKey('error.network')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await doLogin()
  }

  const handleOAuth = async (provider: OAuthProvider) => {
    clearFormError()
    setOauthProvider(provider)
    try {
      await startOAuth(provider)
    } catch {
      setErrorKey(
        provider === 'google'
          ? 'error.oauth.google'
          : provider === 'apple'
            ? 'error.oauth.apple'
            : 'error.oauth.facebook',
      )
    }
  }

  const handleTwoFactorSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!challenge) return
    setTwoFactorError('')
    if (!code.trim()) {
      setTwoFactorError('Enter the code from your authenticator app.')
      return
    }
    setLoading(true)
    try {
      await completeTwoFactor(challenge.challenge_id, code.trim())
      navigate(returnTo, { replace: true })
    } catch (err: unknown) {
      setTwoFactorError(err instanceof Error ? err.message : 'That code was not accepted.')
      setCode('')
    } finally {
      setLoading(false)
    }
  }

  const cancelTwoFactor = () => {
    setChallenge(null)
    setCode('')
    setTwoFactorError('')
  }

  if (authLoading) {
    return (
      <div className="flex min-h-[calc(100vh-8rem)] items-center justify-center bg-[var(--lc-bg-page)]">
        <Loader2 className="h-8 w-8 animate-spin text-[var(--lc-text-muted)]" />
      </div>
    )
  }

  if (challenge) {
    const isTotp = challenge.method === 'totp'
    return (
      <div className="flex min-h-[calc(100vh-8rem)] items-center justify-center bg-[var(--lc-bg-page)] px-4 py-12">
        <div className="w-full max-w-md">
          <div className="mb-8 text-center">
            <ShieldCheck className="mx-auto mb-4 h-12 w-12 text-[var(--lc-text-primary)]" />
            <h1
              className="text-[var(--lc-text-heading)]"
              style={{ font: 'var(--lc-type-display)', letterSpacing: 'var(--lc-tracking-display)' }}
            >
              Two-factor authentication
            </h1>
            <p className="mt-2 text-[var(--lc-text-muted)]" style={{ font: 'var(--lc-type-body)' }}>
              {isTotp
                ? 'Enter the 6-digit code from your authenticator app'
                : 'Enter the code we just emailed you'}
            </p>
          </div>

          <div className="rounded-[var(--lc-radius-xl)] border border-[var(--lc-border)] bg-[var(--lc-surface-raised)] p-[var(--lc-space-xl)] shadow-sm">
            <p className="mb-4 text-[var(--lc-text-muted)]" style={{ font: 'var(--lc-type-body-sm)' }}>
              {isTotp
                ? 'You can also use one of your backup codes if your phone is unavailable.'
                : 'The code expires in 10 minutes.'}
            </p>
            <form onSubmit={handleTwoFactorSubmit} className="space-y-4" noValidate>
              <div className="space-y-2">
                <Label htmlFor="twofa-code">{isTotp ? 'Authentication or backup code' : 'Emailed code'}</Label>
                <Input
                  id="twofa-code"
                  autoComplete="one-time-code"
                  inputMode={isTotp ? 'text' : 'numeric'}
                  data-lc-numeric=""
                  autoFocus
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder={isTotp ? '123456 or ABCDE-FGHJK' : '123456'}
                  required
                />
              </div>
              {twoFactorError && (
                <div
                  role="alert"
                  className="flex items-start gap-2 rounded-[var(--lc-radius-md)] border border-[var(--lc-status-unpublished-bg)] bg-[var(--lc-status-unpublished-bg)] px-3 py-2 text-sm text-[var(--lc-status-unpublished-fg)]"
                >
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                  <span>{twoFactorError}</span>
                </div>
              )}
              <Button type="submit" className="min-h-[48px] w-full" disabled={loading}>
                {loading ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="me-2 h-4 w-4" />}
                Verify
              </Button>
            </form>
            <button
              type="button"
              onClick={cancelTwoFactor}
              className="mt-4 w-full text-center text-sm text-[var(--lc-text-muted)] underline underline-offset-4 hover:text-[var(--lc-text-primary)]"
            >
              Back to sign in
            </button>
          </div>
        </div>
      </div>
    )
  }

  const identifierLabel =
    identifierType === 'email'
      ? t('field.email.label', locale)
      : identifierType === 'username'
        ? t('field.username.label', locale)
        : t('field.phone.label', locale)

  const identifierPlaceholder =
    identifierType === 'email'
      ? t('field.email.placeholder', locale)
      : identifierType === 'username'
        ? t('field.username.placeholder', locale)
        : t('field.phone.placeholder', locale)

  const errorMessage = errorKey ? t(errorKey, locale, errorVars) : null
  const signInLabel =
    loading
      ? t('success.redirect', locale)
      : rateSeconds > 0
        ? `${t('button.signin', locale)} (${rateSeconds})`
        : t('button.signin', locale)

  const authColumn = (
    <div className="mx-auto flex w-full max-w-[400px] flex-col gap-[var(--lc-space-xl)] pb-[max(var(--lc-space-xl),env(safe-area-inset-bottom))] pt-[var(--lc-space-md)] lg:pt-[var(--lc-space-3xl)]">
      <div className="flex items-start justify-between gap-[var(--lc-space-md)]">
        {fromSignup ? (
          <Link
            to="/register"
            className="inline-flex min-h-tap min-w-tap items-center justify-center text-[var(--lc-text-primary)]"
            aria-label="Back"
          >
            <span aria-hidden="true">←</span>
          </Link>
        ) : (
          <span className="min-w-tap" />
        )}
        <LanguageSelector />
      </div>

      <header className="flex h-[72px] flex-col justify-center gap-1">
        <p
          className="text-[var(--lc-text-heading)]"
          style={{ font: 'var(--lc-type-heading-2)', letterSpacing: 'var(--lc-tracking-heading-2)' }}
        >
          Wingcaster
        </p>
        <h1
          className="text-[var(--lc-text-heading)]"
          style={{ font: 'var(--lc-type-display)', letterSpacing: 'var(--lc-tracking-display)' }}
        >
          {t('hero.tagline', locale)}
        </h1>
      </header>

      <OAuthButtons locale={locale} disabled={loading} onStart={handleOAuth} />

      <div className="relative flex items-center gap-[var(--lc-space-sm)] py-1">
        <Separator className="flex-1" />
        <span
          className="shrink-0 text-[var(--lc-text-muted)]"
          style={{ font: 'var(--lc-type-body-sm)' }}
        >
          {t('divider', locale)}
        </span>
        <Separator className="flex-1" />
      </div>

      <form
        onSubmit={handleSubmit}
        className="flex flex-col gap-[var(--lc-space-sm)] rounded-[var(--lc-radius-xl)] border border-[var(--lc-border)] bg-[var(--lc-surface-raised)] p-[var(--lc-space-md)] shadow-sm"
        noValidate
      >
        {/* Manual tablist (no Radix TabsContent) — avoids orphan aria-controls for axe. */}
        <div
          role="tablist"
          aria-label="Identifier type"
          className="grid h-auto w-full grid-cols-3 rounded-none bg-transparent p-0"
        >
          {(['email', 'username', 'phone'] as const).map((tab) => {
            const selected = identifierType === tab
            return (
              <button
                key={tab}
                type="button"
                role="tab"
                id={`login-tab-${tab}`}
                aria-selected={selected}
                tabIndex={selected ? 0 : -1}
                onClick={() => onTabChange(tab)}
                className={cn(
                  'inline-flex min-h-tap items-center justify-center whitespace-nowrap px-3 py-1.5 text-sm font-medium',
                  'rounded-none border-b-2 bg-transparent transition-all duration-fast ease-out focus-visible:outline-none',
                  selected
                    ? 'border-[var(--lc-action-primary)] text-[var(--lc-text-primary)]'
                    : 'border-transparent text-[var(--lc-text-muted)]',
                )}
              >
                {t(`tab.${tab}`, locale)}
              </button>
            )
          })}
        </div>

        <div className="space-y-2 transition-opacity duration-base ease-out">
          <Label htmlFor="login-identifier">{identifierLabel}</Label>
          {identifierType === 'username' ? (
            <div className="flex items-stretch">
              <span className="inline-flex min-h-tap items-center rounded-s-[var(--lc-radius-md)] border border-e-0 border-[var(--lc-border-strong)] bg-[var(--lc-surface-sunken)] px-3 text-[var(--lc-text-muted)]">
                @
              </span>
              <Input
                ref={identifierRef}
                id="login-identifier"
                type="text"
                autoComplete="username"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder={identifierPlaceholder}
                disabled={loading}
                className="rounded-s-none"
                required
              />
            </div>
          ) : identifierType === 'phone' ? (
            <div className="flex gap-2">
              <Label htmlFor="login-country" className="sr-only">
                {t('field.phone.country', locale)}
              </Label>
              <select
                id="login-country"
                value={countryDial}
                onChange={(e) => setCountryDial(e.target.value)}
                disabled={loading}
                className="min-h-tap rounded-[var(--lc-radius-md)] border border-[var(--lc-border-strong)] bg-[var(--lc-surface)] px-2 text-sm text-[var(--lc-text-primary)]"
              >
                {PHONE_COUNTRIES.map((c) => (
                  <option key={c.code} value={c.dial}>
                    {c.label}
                  </option>
                ))}
              </select>
              <Input
                ref={identifierRef}
                id="login-identifier"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder={identifierPlaceholder}
                disabled={loading}
                className="flex-1"
                required
              />
            </div>
          ) : (
            <Input
              ref={identifierRef}
              id="login-identifier"
              type="email"
              inputMode="email"
              autoComplete="username"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder={identifierPlaceholder}
              disabled={loading}
              required
            />
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="login-password">{t('field.password.label', locale)}</Label>
          <div className="relative">
            <Input
              id="login-password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              className="pe-12"
              required
            />
            <button
              type="button"
              className="absolute end-1 top-1/2 inline-flex min-h-tap min-w-tap -translate-y-1/2 items-center justify-center text-[var(--lc-text-muted)] hover:text-[var(--lc-text-primary)]"
              aria-label={
                showPassword ? t('field.password.hide', locale) : t('field.password.show', locale)
              }
              onClick={togglePassword}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <label className="flex min-h-tap cursor-pointer items-center gap-3 text-sm text-[var(--lc-text-primary)]">
          <input
            type="checkbox"
            className="h-4 w-4 accent-[var(--lc-action-primary)]"
            checked={rememberMe}
            onChange={(e) => setRememberMe(e.target.checked)}
            disabled={loading}
          />
          <span style={{ font: 'var(--lc-type-body-sm)' }}>{t('checkbox.remember', locale)}</span>
        </label>

        <div aria-live="polite" className="min-h-[1.25rem]">
          {errorMessage && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-[var(--lc-radius-md)] border border-[var(--lc-status-unpublished-bg)] bg-[var(--lc-status-unpublished-bg)] px-3 py-2 text-sm text-[var(--lc-status-unpublished-fg)]"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <div className="flex flex-1 flex-col gap-2">
                <span>{errorMessage}</span>
                {(errorKey === 'error.network' || errorKey?.startsWith('error.oauth')) && (
                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      className="underline underline-offset-4"
                      onClick={() => {
                        if (errorKey?.startsWith('error.oauth') && oauthProvider) {
                          void handleOAuth(oauthProvider)
                        } else {
                          void doLogin()
                        }
                      }}
                    >
                      {errorKey?.startsWith('error.oauth')
                        ? t('oauth.tryAgain', locale)
                        : t('error.retry', locale)}
                    </button>
                    {errorKey?.startsWith('error.oauth') && (
                      <button
                        type="button"
                        className="underline underline-offset-4"
                        onClick={clearFormError}
                      >
                        {t('oauth.tryAnother', locale)}
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <Button
          type="submit"
          className="min-h-[48px] w-full"
          disabled={!canSubmit || authLoading}
        >
          {loading && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
          {rateSeconds > 0 ? (
            <>
              {t('button.signin', locale)} (
              <Numeric as="span">{rateSeconds}</Numeric>)
            </>
          ) : (
            signInLabel
          )}
        </Button>

        <div className="flex justify-end">
          <Link
            to="/forgot-password"
            className="text-sm text-[var(--lc-text-brand)] underline-offset-4 hover:underline"
          >
            {t('link.forgot', locale)}
          </Link>
        </div>
      </form>

      <div className="flex flex-col items-center gap-2 text-center">
        <p style={{ font: 'var(--lc-type-body-sm)' }} className="text-[var(--lc-text-secondary)]">
          {t('footer.noaccount', locale)}{' '}
          <Link to="/register" className="font-semibold text-[var(--lc-text-brand)] underline-offset-4 hover:underline">
            {t('footer.create', locale)}
          </Link>
        </p>
        <p
          className="text-[var(--lc-text-muted)]"
          style={{ font: 'var(--lc-type-caption)', letterSpacing: 'var(--lc-tracking-caption)' }}
        >
          {t('footer.paddle', locale)}
        </p>
      </div>
    </div>
  )

  return (
    <div className="min-h-[calc(100vh-8rem)] bg-[var(--lc-bg-page)]">
      <div className="lg:grid lg:min-h-[calc(100vh-8rem)] lg:grid-cols-[3fr_2fr]">
        <aside className="relative hidden overflow-hidden bg-[var(--lc-surface-inverse)] lg:block">
          <div
            className="absolute inset-0 opacity-40"
            style={{
              backgroundImage:
                'linear-gradient(135deg, var(--lc-action-primary) 0%, transparent 55%), linear-gradient(225deg, var(--lc-accent) 0%, transparent 40%)',
            }}
          />
          <div className="relative flex h-full flex-col justify-end gap-[var(--lc-space-md)] p-[var(--lc-space-3xl)] text-[var(--lc-text-inverse)]">
            <p
              className="max-w-md"
              style={{ font: 'var(--lc-type-heading-2)', letterSpacing: 'var(--lc-tracking-heading-2)' }}
            >
              Wingcaster
            </p>
            <p className="max-w-md opacity-90" style={{ font: 'var(--lc-type-body-lg)' }}>
              {t('federated.heading', locale)}
            </p>
          </div>
        </aside>
        {/* App chrome already provides the page <main>; keep this a plain section. */}
        <section
          aria-label={t('page.title', locale)}
          className="flex items-start justify-center px-4 py-6 lg:items-center lg:px-8"
        >
          {authColumn}
        </section>
      </div>
    </div>
  )
}
