import { useEffect, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { AlertCircle, KeySquare, Loader2 } from 'lucide-react'
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
import { BackupCodeInput, formatBackupCode, RateLimitBanner, TrustFooter } from '@/components/mfa'
import { ChallengeLayout } from './ChallengeLayout'
import { apiErrorCode, apiStatus, remainingAttemptsOf, type ChallengeLocationState } from './mfaShared'

export function BackupCodeSignInPage() {
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
  const [normalized, setNormalized] = useState('')
  const [error, setError] = useState('')
  const [remaining, setRemaining] = useState<number | undefined>()
  const [rateLimited, setRateLimited] = useState(false)
  const [exhausted, setExhausted] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [differentUserOpen, setDifferentUserOpen] = useState(false)
  const [offline, setOffline] = useState(typeof navigator === 'undefined' ? false : !navigator.onLine)

  useEffect(() => {
    if (!challengeId) {
      addToast({ title: 'Please sign in again.' })
      navigate('/login', { replace: true })
    }
  }, [challengeId, addToast, navigate])

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
    if (!challengeId || normalized.length < 10) return
    setVerifying(true)
    setError('')
    try {
      const result = await api.twoFactorChallenge(challengeId, normalized)
      if (result?.token) {
        setAuthToken(result.token)
        clearElevatedToken()
        await refreshAgent()
      }
      addToast({
        variant: 'warning',
        title: 'You used a backup code. That code is now used up.',
        description: 'Manage remaining codes from two-factor settings.',
      })
      navigate(returnTo, { replace: true })
    } catch (err: unknown) {
      const status = apiStatus(err)
      const remainingNext = remainingAttemptsOf(err)
      const codeName = apiErrorCode(err)
      if (status === 429) {
        setRateLimited(true)
      } else if (status === 410 || /expired/i.test(codeName)) {
        addToast({ title: 'Your verification session expired. Please sign in again.' })
        navigate('/login', { replace: true })
      } else if (/no unused backup/i.test(codeName) || /no backup/i.test(codeName)) {
        setExhausted(true)
        setError("This account has no unused backup codes. Recover your account instead.")
      } else if (typeof remainingNext === 'number') {
        setRemaining(remainingNext)
        setError('That backup code did not match. Check for typos and try another.')
        setCode('')
        setNormalized('')
      } else if (status === 401 && remainingNext === undefined) {
        addToast({ title: 'This verification session was already used. Please sign in again.' })
        navigate('/login', { replace: true })
      } else {
        setError("We couldn't reach WingCaster. Check your connection and try again.")
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
      </header>

      <KeySquare className="h-8 w-8 text-[var(--lc-text-brand)]" aria-hidden />
      <h1
        className="text-[var(--lc-text-heading)]"
        style={{ font: 'var(--lc-type-heading-1)', letterSpacing: 'var(--lc-tracking-heading-1)' }}
      >
        Enter a backup code
      </h1>
      <p className="text-[length:var(--lc-type-body)] text-[var(--lc-text-secondary)]">
        Type one of the 10 one-time codes you saved when you set up two-factor. Each code works only
        once.
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

      <BackupCodeInput
        value={code}
        disabled={verifying || rateLimited || exhausted || offline}
        error={Boolean(error)}
        autoFocus
        aria-label="Backup code"
        onChange={(formatted, nextNormalized) => {
          setCode(formatted)
          setNormalized(nextNormalized || formatBackupCode(formatted).normalized)
        }}
      />

      {error ? (
        <p
          role="alert"
          aria-live="assertive"
          className="flex items-start gap-2 text-[length:var(--lc-type-body-sm)] text-[var(--lc-status-danger-fg)]"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          {error}
        </p>
      ) : null}

      {typeof remaining === 'number' ? (
        <p className="text-[length:var(--lc-type-caption)] text-[var(--lc-text-muted)]">
          <Numeric>{remaining}</Numeric> attempts remaining.
        </p>
      ) : null}

      <Button
        type="button"
        size="lg"
        className="w-full"
        disabled={normalized.length < 10 || verifying || rateLimited || exhausted || offline}
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

      <div className="flex flex-col items-start gap-[var(--lc-space-xs)]">
        <Button
          type="button"
          variant="link"
          className="h-auto px-0"
          disabled={verifying}
          onClick={() =>
            navigate(`/login?stage=2fa&challenge_id=${encodeURIComponent(challengeId)}`, {
              state: { challenge_id: challengeId, returnTo },
            })
          }
        >
          Try my authenticator code instead
        </Button>
        <Button
          type="button"
          variant="link"
          className="h-auto px-0 text-[var(--lc-text-muted)]"
          onClick={() => navigate('/account-recovery')}
        >
          I&apos;ve lost my codes too — recover my account
        </Button>
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

      <TrustFooter>Backup codes are one-time only. Once you use one, it&apos;s gone.</TrustFooter>

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
