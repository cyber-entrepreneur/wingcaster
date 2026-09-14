import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { AlertCircle, Loader2, ShieldCheck } from 'lucide-react'
import { api, clearElevatedToken, setAuthToken } from '@/api/client'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/components/ui/toast'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Numeric } from '@/components/ui/numeric'
import { OtpInput, RateLimitBanner, TrustFooter } from '@/components/mfa'
import { ChallengeLayout } from './ChallengeLayout'
import { apiErrorCode, apiStatus, remainingAttemptsOf, type ChallengeLocationState } from './mfaShared'

const CHALLENGE_TTL_MS = 10 * 60 * 1000

export function SignInChallengePage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const { refreshAgent } = useAuth()
  const { addToast } = useToast()
  const state = (location.state ?? {}) as ChallengeLocationState
  const challengeId = searchParams.get('challenge_id') || state.challenge_id || ''
  const returnTo =
    searchParams.get('redirect_after_login') ||
    (state.returnTo?.startsWith('/') && !state.returnTo.startsWith('//') ? state.returnTo : '/dashboard')

  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [remaining, setRemaining] = useState<number | undefined>()
  const [rateLimited, setRateLimited] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [expiringSoon, setExpiringSoon] = useState(false)
  const [differentUserOpen, setDifferentUserOpen] = useState(false)
  const [offline, setOffline] = useState(typeof navigator === 'undefined' ? false : !navigator.onLine)
  const [success, setSuccess] = useState(false)
  const verifyRef = useRef<HTMLButtonElement>(null)
  const mountedAt = useRef(Date.now())

  useEffect(() => {
    if (!challengeId) {
      addToast({ title: 'Please sign in again.' })
      navigate('/login', { replace: true })
    }
  }, [challengeId, addToast, navigate])

  useEffect(() => {
    const id = window.setInterval(() => {
      const remainingMs = CHALLENGE_TTL_MS - (Date.now() - mountedAt.current)
      if (remainingMs <= 30_000 && remainingMs > 0) setExpiringSoon(true)
    }, 1000)
    return () => window.clearInterval(id)
  }, [])

  useEffect(() => {
    const on = () => setOffline(false)
    const off = () => setOffline(true)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])

  const submit = async () => {
    if (!challengeId || code.length < 6) return
    setVerifying(true)
    setError('')
    try {
      const result = await api.twoFactorChallenge(challengeId, code)
      if (result?.token) {
        setAuthToken(result.token)
        clearElevatedToken()
        await refreshAgent()
      }
      setSuccess(true)
      if (result?.factor_used === 'backup_code') {
        addToast({
          variant: 'warning',
          title: 'You used a backup code. That code is now used up.',
          description: 'Manage codes from two-factor settings.',
        })
      }
      window.setTimeout(() => navigate(returnTo, { replace: true }), 120)
    } catch (err: unknown) {
      const status = apiStatus(err)
      const remainingNext = remainingAttemptsOf(err)
      const codeName = apiErrorCode(err)
      if (status === 429) {
        setRateLimited(true)
        setError('')
      } else if (status === 410 || /expired/i.test(codeName)) {
        addToast({ title: 'Your verification session expired. Please sign in again.' })
        navigate('/login', { replace: true })
      } else if (status === 401 && remainingNext === undefined) {
        addToast({ title: 'This verification session was already used. Please sign in again.' })
        navigate('/login', { replace: true })
      } else if (typeof remainingNext === 'number') {
        setRemaining(remainingNext)
        setError('That code did not match. Check your authenticator and try again.')
        setCode('')
      } else {
        setError('We couldn\'t reach WingCaster. Check your connection and try again.')
      }
    } finally {
      setVerifying(false)
    }
  }

  if (!challengeId) return null

  return (
    <ChallengeLayout>
      <header className="flex h-[72px] flex-col justify-center gap-1">
        <p className="text-[length:var(--lc-type-heading-2)] text-[var(--lc-text-heading)]">WingCaster</p>
        <p className="text-[length:var(--lc-type-caption)] text-[var(--lc-text-muted)]">Verify it&apos;s you.</p>
      </header>

      <ShieldCheck className="h-8 w-8 text-[var(--lc-text-brand)]" aria-hidden />
      <h1
        className="text-[var(--lc-text-heading)]"
        style={{ font: 'var(--lc-type-heading-1)', letterSpacing: 'var(--lc-tracking-heading-1)' }}
      >
        Verify it&apos;s you
      </h1>
      <p className="text-[length:var(--lc-type-body)] text-[var(--lc-text-secondary)]">
        Enter the 6-digit code from your authenticator app.
      </p>

      {offline ? (
        <RateLimitBanner message="We couldn't reach WingCaster. Check your connection and try again." />
      ) : null}

      {rateLimited ? (
        <RateLimitBanner
          message="Too many attempts. For your security, try signing in again in 15 minutes."
          retryAfterMinutes={15}
        />
      ) : null}

      {expiringSoon && !rateLimited ? (
        <p className="text-[length:var(--lc-type-caption)] text-[var(--lc-text-muted)]">
          This code will expire soon.
        </p>
      ) : null}

      {success ? (
        <div className="flex items-center gap-2 text-[var(--lc-status-published-fg)]" aria-live="polite">
          <ShieldCheck className="h-5 w-5" aria-hidden />
          Verified
        </div>
      ) : (
        <OtpInput
          count={6}
          value={code}
          disabled={verifying || rateLimited || offline}
          error={Boolean(error)}
          autoFocus
          aria-label="6-digit verification code"
          onChange={setCode}
          onComplete={() => verifyRef.current?.focus()}
        />
      )}

      {error ? (
        <p
          role="alert"
          aria-live="assertive"
          className="flex items-start gap-2 text-[length:var(--lc-type-body-sm)] text-[var(--lc-status-danger-fg)]"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          {error}
          {typeof remaining === 'number' ? ` ${remaining} attempts remaining.` : ''}
        </p>
      ) : null}

      {typeof remaining === 'number' && !error ? (
        <p className="text-[length:var(--lc-type-caption)] text-[var(--lc-text-muted)]">
          <Numeric>{remaining}</Numeric> attempts remaining.
        </p>
      ) : typeof remaining === 'number' ? (
        <p className="text-[length:var(--lc-type-caption)] text-[var(--lc-text-muted)]">
          <Numeric>{remaining}</Numeric> attempts remaining.
        </p>
      ) : null}

      <Button
        ref={verifyRef}
        type="button"
        size="lg"
        className="w-full"
        disabled={code.length < 6 || verifying || rateLimited || offline}
        onClick={() => {
          void submit()
        }}
      >
        {verifying ? (
          <>
            <Loader2 className="me-2 h-4 w-4 animate-spin" aria-hidden />
            Verifying…
          </>
        ) : (
          'Verify'
        )}
      </Button>

      <div className="flex flex-col items-start gap-[var(--lc-space-xs)] md:flex-row md:items-center md:gap-[var(--lc-space-sm)]">
        <Button
          type="button"
          variant="link"
          className="h-auto px-0"
          disabled={verifying || offline}
          onClick={() =>
            navigate(`/login?stage=backup&challenge_id=${encodeURIComponent(challengeId)}`, {
              state: { challenge_id: challengeId, returnTo },
            })
          }
        >
          Use a backup code instead
        </Button>
        <span className="hidden text-[var(--lc-text-muted)] md:inline" aria-hidden>
          ·
        </span>
        <Button
          type="button"
          variant="link"
          className="h-auto px-0 text-[var(--lc-text-muted)]"
          disabled={verifying}
          onClick={() => setDifferentUserOpen(true)}
        >
          Sign in as different user
        </Button>
      </div>

      <TrustFooter>This code protects your account. It changes every 30 seconds.</TrustFooter>

      <Dialog open={differentUserOpen} onOpenChange={setDifferentUserOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Sign in as different user?</DialogTitle>
            <DialogDescription>
              You&apos;ll return to the sign-in screen and this verification will be cancelled.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-[var(--lc-space-sm)]">
            <Button type="button" variant="ghost" onClick={() => setDifferentUserOpen(false)}>
              Stay here
            </Button>
            <Button type="button" onClick={() => navigate('/login', { replace: true })}>
              Yes, sign out
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </ChallengeLayout>
  )
}
