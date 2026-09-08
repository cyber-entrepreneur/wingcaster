import { createContext, useCallback, useMemo, useState, type ReactNode } from 'react'
import { StepUpModal, type StepUpMethod } from '@/components/mfa/StepUpModal'

export interface StepUpResult {
  /** Short-lived elevation token for `X-Elevated-Token`. Stub returns a placeholder. */
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
   *
   * Stub: resolves a placeholder token without calling the API.
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

/**
 * App-root provider that mounts `<StepUpModal>` and exposes `useStepUp()`.
 *
 * Used by: SHR-MFA-005/006/007 callers, SHR-SET-004/005, PA credit surfaces, AGN ownership.
 *
 * **Coexistence note:** Legacy provider lives at `web/src/context/StepUpContext.tsx`
 * (imports `auth/StepUpModal`). This extract-stage stub is the MFA-brief contract for
 * future waves. Do **not** modify the legacy context from this package; do **not**
 * wrap both providers until migration is intentional.
 *
 * Stub only — no real `POST /api/auth/step-up` / verify.
 */
export function StepUpProvider({
  children,
  previewMethod = 'totp',
  previewMaskedEmail,
}: StepUpProviderProps) {
  const [pending, setPending] = useState<PendingPrompt | null>(null)
  const [code, setCode] = useState('')
  const [useBackupCode, setUseBackupCode] = useState(false)
  const [verifying, setVerifying] = useState(false)

  const settleCancel = useCallback(() => {
    pending?.reject({ reason: 'user_cancelled' })
    setPending(null)
    setCode('')
    setUseBackupCode(false)
    setVerifying(false)
  }, [pending])

  const requireStepUp = useCallback((options?: StepUpRequestOptions) => {
    return new Promise<StepUpResult>((resolve, reject) => {
      setCode('')
      setUseBackupCode(false)
      setVerifying(false)
      setPending({
        reason: options?.reason ?? 'an additional check on your account',
        resolve,
        reject,
      })
    })
  }, [])

  const handleVerify = useCallback(() => {
    if (!pending) return
    // Stub success path — real waves call POST /api/auth/step-up/verify.
    setVerifying(true)
    const result: StepUpResult = { elevatedToken: 'stub-elevated-token' }
    pending.resolve(result)
    setPending(null)
    setCode('')
    setUseBackupCode(false)
    setVerifying(false)
  }, [pending])

  const value = useMemo<StepUpContextValue>(() => ({ requireStepUp }), [requireStepUp])

  return (
    <StepUpContext.Provider value={value}>
      {children}
      <StepUpModal
        open={pending !== null}
        reason={pending?.reason}
        method={previewMethod}
        maskedEmail={previewMaskedEmail}
        code={code}
        onCodeChange={setCode}
        useBackupCode={useBackupCode}
        verifying={verifying}
        onCancel={settleCancel}
        onVerify={handleVerify}
        onToggleBackupCode={() => setUseBackupCode((v) => !v)}
        onRetryChallenge={() => {
          setCode('')
        }}
      />
    </StepUpContext.Provider>
  )
}
