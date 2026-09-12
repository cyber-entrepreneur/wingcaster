import { createContext, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { api, setElevatedToken } from '@/api/client'
import { StepUpModal, type StepUpMethod } from '@/components/mfa/StepUpModal'
import type { StepUpChallenge } from '@/types/twoFactor'
import { formatBackupCode } from '@/components/mfa/BackupCodeInput'

export interface StepUpResult {
  /** Short-lived elevation token for `X-Elevated-Token`. */
  elevatedToken: string
}

export interface StepUpRequestOptions {
  /** Shown in the modal reason well. Every caller should pass one. */
  reason?: string
}

export interface StepUpContextValue {
  /**
   * Opens the step-up modal and resolves with `{ elevatedToken }` on success.
   * Rejects with `{ reason: 'user_cancelled' }` on cancel / Escape / backdrop.
   */
  requireStepUp: (options?: StepUpRequestOptions) => Promise<StepUpResult>
}

export const StepUpContext = createContext<StepUpContextValue | null>(null)

interface PendingPrompt {
  reason: string
  resolve: (result: StepUpResult) => void
  reject: (reason: { reason: 'user_cancelled' }) => void
}

export interface StepUpProviderProps {
  children: ReactNode
  /**
   * Override challenge method for storybook / inventory previews.
   * Production consumers leave this unset (backend decides).
   */
  previewMethod?: StepUpMethod
  previewMaskedEmail?: string
}

function apiStatus(err: unknown): number | undefined {
  if (err && typeof err === 'object' && 'status' in err) {
    const status = (err as { status?: unknown }).status
    return typeof status === 'number' ? status : undefined
  }
  return undefined
}

function remainingAttemptsOf(err: unknown): number | undefined {
  if (err && typeof err === 'object' && 'remaining_attempts' in err) {
    const n = (err as { remaining_attempts?: unknown }).remaining_attempts
    return typeof n === 'number' ? n : undefined
  }
  return undefined
}

/**
 * App-root provider that mounts `<StepUpModal>` and exposes `useStepUp()`.
 *
 * Used by: SHR-MFA-005/006/007 callers, SHR-SET-004/005, PA credit surfaces, AGN ownership.
 *
 * **Coexistence note:** Legacy provider lives at `web/src/context/StepUpContext.tsx`
 * (imports `auth/StepUpModal`). This is the MFA-brief contract. Do **not**
 * modify the legacy context from this package.
 */
export function StepUpProvider({
  children,
  previewMethod,
  previewMaskedEmail,
}: StepUpProviderProps) {
  const [pending, setPending] = useState<PendingPrompt | null>(null)
  const pendingRef = useRef<PendingPrompt | null>(null)
  const [code, setCode] = useState('')
  const [useBackupCode, setUseBackupCode] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [challenge, setChallenge] = useState<StepUpChallenge | null>(null)
  const [method, setMethod] = useState<StepUpMethod>(previewMethod ?? 'totp')
  const [error, setError] = useState<string | undefined>()
  const [remainingAttempts, setRemainingAttempts] = useState<number | undefined>()
  const [rateLimited, setRateLimited] = useState(false)
  const [expired, setExpired] = useState(false)
  const [resendCooldown, setResendCooldown] = useState(0)
  const cooldownRef = useRef<number | null>(null)

  const resetPromptState = useCallback(() => {
    setCode('')
    setUseBackupCode(false)
    setVerifying(false)
    setChallenge(null)
    setError(undefined)
    setRemainingAttempts(undefined)
    setRateLimited(false)
    setExpired(false)
    setResendCooldown(0)
    if (cooldownRef.current) {
      window.clearInterval(cooldownRef.current)
      cooldownRef.current = null
    }
  }, [])

  const startCooldown = useCallback(() => {
    setResendCooldown(60)
    if (cooldownRef.current) window.clearInterval(cooldownRef.current)
    cooldownRef.current = window.setInterval(() => {
      setResendCooldown((s) => {
        if (s <= 1) {
          if (cooldownRef.current) window.clearInterval(cooldownRef.current)
          cooldownRef.current = null
          return 0
        }
        return s - 1
      })
    }, 1000)
  }, [])

  const requestChallenge = useCallback(async () => {
    setError(undefined)
    setExpired(false)
    setRateLimited(false)
    try {
      const next = await api.stepUp()
      setChallenge(next)
      setMethod(previewMethod ?? next.method)
      if (next.method === 'email') startCooldown()
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : 'Could not send the verification code. Contact your administrator.'
      setError(message)
    }
  }, [previewMethod, startCooldown])

  useEffect(() => {
    if (!pending) return
    void requestChallenge()
  }, [pending, requestChallenge])

  useEffect(() => {
    return () => {
      if (cooldownRef.current) window.clearInterval(cooldownRef.current)
    }
  }, [])

  const closePrompt = useCallback(() => {
    pendingRef.current = null
    setPending(null)
    resetPromptState()
  }, [resetPromptState])

  const settleCancel = useCallback(() => {
    const current = pendingRef.current
    if (!current) return
    current.reject({ reason: 'user_cancelled' })
    closePrompt()
  }, [closePrompt])

  const requireStepUp = useCallback((options?: StepUpRequestOptions) => {
    return new Promise<StepUpResult>((resolve, reject) => {
      resetPromptState()
      const prompt: PendingPrompt = {
        reason: options?.reason ?? 'an additional check on your account',
        resolve,
        reject,
      }
      pendingRef.current = prompt
      setPending(prompt)
    })
  }, [resetPromptState])

  const handleVerify = useCallback(async () => {
    const current = pendingRef.current
    if (!current || !challenge) return
    setVerifying(true)
    setError(undefined)
    const submitCode = useBackupCode ? formatBackupCode(code).normalized : code
    try {
      const result = await api.stepUpVerify(challenge.challenge_id, submitCode)
      setElevatedToken(result.elevated_token)
      current.resolve({ elevatedToken: result.elevated_token })
      closePrompt()
    } catch (err: unknown) {
      const status = apiStatus(err)
      const remaining = remainingAttemptsOf(err)
      if (status === 429) {
        setRateLimited(true)
        setError(undefined)
      } else if (status === 410) {
        setExpired(true)
      } else if (typeof remaining === 'number') {
        setRemainingAttempts(remaining)
        setError('That code did not match. Try again.')
        setCode('')
      } else {
        setError(err instanceof Error ? err.message : 'That code did not match. Try again.')
        setCode('')
      }
      setVerifying(false)
    }
  }, [challenge, code, useBackupCode, closePrompt])

  const value = useMemo<StepUpContextValue>(() => ({ requireStepUp }), [requireStepUp])

  return (
    <StepUpContext.Provider value={value}>
      {children}
      <StepUpModal
        open={pending !== null}
        reason={pending?.reason}
        method={method}
        maskedEmail={previewMaskedEmail}
        code={code}
        onCodeChange={setCode}
        useBackupCode={useBackupCode}
        remainingAttempts={remainingAttempts}
        rateLimited={rateLimited}
        rateLimitMinutes={rateLimited ? 15 : undefined}
        expired={expired}
        verifying={verifying || (pending !== null && !challenge && !error)}
        challengeReady={Boolean(challenge) || Boolean(error)}
        error={error}
        resendCooldownSeconds={resendCooldown}
        onCancel={settleCancel}
        onVerify={() => {
          void handleVerify()
        }}
        onToggleBackupCode={() => {
          setUseBackupCode((v) => !v)
          setCode('')
          setError(undefined)
        }}
        onResend={() => {
          void requestChallenge()
        }}
        onRetryChallenge={() => {
          void requestChallenge()
        }}
      />
    </StepUpContext.Provider>
  )
}
