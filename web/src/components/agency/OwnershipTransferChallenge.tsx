import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { Check, Copy, ShieldCheck } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

/** Proofs emitted when all three challenge factors complete (stub tokens). */
export interface OwnershipTransferProofs {
  /** Opaque elevated-session token from SHR-MFA-007 step-up (stub value only). */
  stepUpToken: string
  /** 6-digit email OTP entered by the user. */
  otpCode: string
  /** Typed agency name for audit — server re-validates on submit. */
  typedAgencyName: string
}

/**
 * Props for the WF-31 3-factor ownership-transfer challenge.
 *
 * Contract from AGN-SET-005 §Reusable challenge composition.
 * Used by: AGN-SET-005 (initiator), AGN-SET-005b (recipient accept),
 * AGT-REC-006 (reversal modal).
 *
 * Visual stub only — no real password / OTP / auth API.
 */
export interface OwnershipTransferChallengeProps {
  /** Exact agency display name the user must type in step 3. */
  agencyName: string
  /** Masked account email for OTP destination, e.g. `s•••@elite.ae`. */
  ownerEmailMasked: string
  /** Fires once when password step-up + OTP + typed name are all complete. */
  onAllComplete: (proofs: OwnershipTransferProofs) => void
  /** Reset from a resend or a wrong code (clears step 2+ progress). */
  onReset: () => void
  className?: string
}

type StepStatus = 'pending' | 'current' | 'complete' | 'disabled'

const OTP_LENGTH = 6

function namesMatch(typed: string, expected: string): boolean {
  return typed.trim().toLowerCase() === expected.trim().toLowerCase()
}

/**
 * 3-factor challenge: password step-up → email OTP → typed agency-name.
 *
 * Sequential enablement: step n+1 disabled until n completes.
 * Stub UI — buttons advance local state only; no SHR-MFA-007 / OTP API.
 *
 * A11y: `<ol>` + `<li>` per step; current has `aria-current="step"`;
 * complete steps expose `aria-label="Step {n} complete"`.
 */
export function OwnershipTransferChallenge({
  agencyName,
  ownerEmailMasked,
  onAllComplete,
  onReset,
  className,
}: OwnershipTransferChallengeProps) {
  const liveId = useId()
  const [step1Complete, setStep1Complete] = useState(false)
  const [step2Complete, setStep2Complete] = useState(false)
  const [step3Complete, setStep3Complete] = useState(false)
  const [otpSent, setOtpSent] = useState(false)
  const [otpDigits, setOtpDigits] = useState<string[]>(() => Array(OTP_LENGTH).fill(''))
  const [typedName, setTypedName] = useState('')
  const [typedError, setTypedError] = useState<string | null>(null)
  const [liveMessage, setLiveMessage] = useState('')
  const [copyWarned, setCopyWarned] = useState(false)
  const otpRefs = useRef<Array<HTMLInputElement | null>>([])
  const completedRef = useRef(false)
  const stubTokenRef = useRef(`elev_stub_${Date.now().toString(36)}`)

  const otpCode = otpDigits.join('')

  const step1Status: StepStatus = step1Complete ? 'complete' : 'current'
  const step2Status: StepStatus = !step1Complete
    ? 'disabled'
    : step2Complete
      ? 'complete'
      : 'current'
  const step3Status: StepStatus = !step2Complete
    ? 'disabled'
    : step3Complete
      ? 'complete'
      : 'current'

  useEffect(() => {
    if (!step1Complete || !step2Complete || !step3Complete || completedRef.current) return
    if (otpCode.length !== OTP_LENGTH || !namesMatch(typedName, agencyName)) return
    completedRef.current = true
    onAllComplete({
      stepUpToken: stubTokenRef.current,
      otpCode,
      typedAgencyName: typedName.trim(),
    })
  }, [step1Complete, step2Complete, step3Complete, otpCode, typedName, agencyName, onAllComplete])

  const announce = (msg: string) => setLiveMessage(msg)

  const handleVerifyPassword = () => {
    stubTokenRef.current = `elev_stub_${Date.now().toString(36)}`
    setStep1Complete(true)
    announce('Step 1 complete. Continue to email code.')
  }

  const handleSendOtp = () => {
    setOtpSent(true)
    setOtpDigits(Array(OTP_LENGTH).fill(''))
    setStep2Complete(false)
    setStep3Complete(false)
    completedRef.current = false
    announce(`Code sent to ${ownerEmailMasked}.`)
    queueMicrotask(() => otpRefs.current[0]?.focus())
  }

  const handleResetOtp = () => {
    setOtpSent(false)
    setOtpDigits(Array(OTP_LENGTH).fill(''))
    setStep2Complete(false)
    setStep3Complete(false)
    setTypedName('')
    setTypedError(null)
    completedRef.current = false
    onReset()
    announce('Challenge reset. Re-enter the email code.')
  }

  const commitOtp = (digits: string[]) => {
    setOtpDigits(digits)
    const code = digits.join('')
    if (code.length === OTP_LENGTH && /^\d{6}$/.test(code)) {
      setStep2Complete(true)
      announce('Step 2 complete. Type the agency name to confirm.')
    } else {
      setStep2Complete(false)
      setStep3Complete(false)
      completedRef.current = false
    }
  }

  const handleOtpChange = (index: number, raw: string) => {
    const cleaned = raw.replace(/\D/g, '')
    if (cleaned.length > 1) {
      // Paste-fills-all
      const chars = cleaned.slice(0, OTP_LENGTH).split('')
      const next = Array(OTP_LENGTH)
        .fill('')
        .map((_, i) => chars[i] ?? '')
      commitOtp(next)
      const focusAt = Math.min(chars.length, OTP_LENGTH - 1)
      otpRefs.current[focusAt]?.focus()
      return
    }
    const next = [...otpDigits]
    next[index] = cleaned.slice(-1)
    commitOtp(next)
    if (cleaned && index < OTP_LENGTH - 1) {
      otpRefs.current[index + 1]?.focus()
    }
  }

  const handleOtpKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      otpRefs.current[index - 1]?.focus()
    }
  }

  const handleTypedChange = (value: string) => {
    setTypedName(value)
    if (!value.trim()) {
      setTypedError(null)
      setStep3Complete(false)
      completedRef.current = false
      return
    }
    if (namesMatch(value, agencyName)) {
      setTypedError(null)
      setStep3Complete(true)
      announce('Step 3 complete. Agency name confirmed.')
    } else {
      setTypedError(`That doesn't match "${agencyName}". Check for extra spaces or a typo.`)
      setStep3Complete(false)
      completedRef.current = false
    }
  }

  const handleCopyWarn = () => {
    setCopyWarned(true)
    window.setTimeout(() => setCopyWarned(false), 2500)
  }

  return (
    <div
      className={cn(
        'rounded-[var(--lc-radius-lg)] border border-[var(--lc-border)]',
        'bg-[var(--lc-surface-raised)] p-[var(--lc-space-lg)]',
        className,
      )}
      style={{ boxShadow: 'var(--lc-elevation-sm)' }}
    >
      <p id={liveId} className="sr-only" aria-live="polite">
        {liveMessage}
      </p>

      <ol className="m-0 flex list-none flex-col gap-[var(--lc-space-md)] p-0">
        {/* Step 1 — password step-up stub */}
        <li
          aria-current={step1Status === 'current' ? 'step' : undefined}
          aria-label={step1Complete ? 'Step 1 complete' : undefined}
          className={cn(
            'rounded-[var(--lc-radius-md)] border border-[var(--lc-border)]',
            'bg-[var(--lc-surface-sunken)] p-[var(--lc-space-md)]',
          )}
        >
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <StepBadge n={1} status={step1Status} />
            <span className="font-semibold text-[var(--lc-text-heading)]" style={{ font: 'var(--lc-type-body)' }}>
              Password re-check
            </span>
            {step1Complete ? (
              <span className="ms-auto inline-flex items-center gap-1 text-[var(--lc-text-secondary)]" style={{ font: 'var(--lc-type-caption)' }}>
                <ShieldCheck
                  className="h-4 w-4 rounded-full text-[var(--lc-accent-bold)] outline outline-1 outline-[var(--lc-accent-bold-edge)]"
                  aria-hidden
                />
                Password verified · just now
              </span>
            ) : (
              <Badge variant="outline" className="ms-auto text-[var(--lc-text-muted)]">
                Pending
              </Badge>
            )}
          </div>
          {!step1Complete ? (
            <Button type="button" variant="outline" onClick={handleVerifyPassword}>
              Verify password
            </Button>
          ) : null}
          <p className="mt-2 text-[var(--lc-text-muted)]" style={{ font: 'var(--lc-type-caption)' }}>
            Stub: opens SHR-MFA-007 step-up in consumer screens — no real auth here.
          </p>
        </li>

        {/* Step 2 — email OTP stub */}
        <li
          aria-current={step2Status === 'current' ? 'step' : undefined}
          aria-label={step2Complete ? 'Step 2 complete' : undefined}
          className={cn(
            'rounded-[var(--lc-radius-md)] border border-[var(--lc-border)]',
            'bg-[var(--lc-surface-sunken)] p-[var(--lc-space-md)]',
            step2Status === 'disabled' && 'opacity-50',
          )}
        >
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <StepBadge n={2} status={step2Status} />
            <span className="font-semibold text-[var(--lc-text-heading)]" style={{ font: 'var(--lc-type-body)' }}>
              Email code
            </span>
            {step2Complete ? (
              <span className="ms-auto inline-flex items-center gap-1 text-[var(--lc-text-secondary)]" style={{ font: 'var(--lc-type-caption)' }}>
                <Check className="h-4 w-4 text-[var(--lc-accent-bold)]" aria-hidden />
                Email code verified · just now
              </span>
            ) : (
              <Badge variant="outline" className="ms-auto text-[var(--lc-text-muted)]">
                {step2Status === 'disabled' ? 'Locked' : 'Pending'}
              </Badge>
            )}
          </div>

          {step2Status !== 'disabled' && !otpSent ? (
            <Button type="button" variant="outline" onClick={handleSendOtp}>
              Send code to {ownerEmailMasked}
            </Button>
          ) : null}

          {step2Status !== 'disabled' && otpSent ? (
            <div className="space-y-[var(--lc-space-sm)]">
              <Label className="text-[var(--lc-text-secondary)]" style={{ font: 'var(--lc-type-overline)' }}>
                Enter 6-digit code
              </Label>
              <div className="flex flex-wrap gap-2" role="group" aria-label="One-time passcode">
                {otpDigits.map((digit, i) => (
                  <Input
                    key={i}
                    ref={(el) => {
                      otpRefs.current[i] = el
                    }}
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={i === 0 ? OTP_LENGTH : 1}
                    value={digit}
                    disabled={step2Complete}
                    aria-label={`Digit ${i + 1}`}
                    className={cn(
                      'h-11 w-11 min-h-tap min-w-[44px] p-0 text-center',
                      'rounded-[var(--lc-radius-md)] border-[var(--lc-border-strong)]',
                    )}
                    style={{ font: 'var(--lc-type-data)' }}
                    onChange={(e) => handleOtpChange(i, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(i, e)}
                  />
                ))}
              </div>
              <div className="flex flex-wrap gap-3">
                <Button type="button" variant="link" size="sm" className="h-auto px-0" onClick={handleSendOtp}>
                  Resend code
                </Button>
                <Button type="button" variant="link" size="sm" className="h-auto px-0" onClick={handleResetOtp}>
                  Reset step
                </Button>
              </div>
            </div>
          ) : null}
        </li>

        {/* Step 3 — typed agency name */}
        <li
          aria-current={step3Status === 'current' ? 'step' : undefined}
          aria-label={step3Complete ? 'Step 3 complete' : undefined}
          className={cn(
            'rounded-[var(--lc-radius-md)] border border-[var(--lc-border)]',
            'bg-[var(--lc-surface-sunken)] p-[var(--lc-space-md)]',
            step3Status === 'disabled' && 'opacity-50',
          )}
        >
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <StepBadge n={3} status={step3Status} />
            <span className="font-semibold text-[var(--lc-text-heading)]" style={{ font: 'var(--lc-type-body)' }}>
              Type the agency name
            </span>
            {step3Complete ? (
              <span className="ms-auto inline-flex items-center gap-1 text-[var(--lc-text-secondary)]" style={{ font: 'var(--lc-type-caption)' }}>
                <Check className="h-4 w-4 text-[var(--lc-accent-bold)]" aria-hidden />
                Agency name confirmed
              </span>
            ) : (
              <Badge variant="outline" className="ms-auto text-[var(--lc-text-muted)]">
                {step3Status === 'disabled' ? 'Locked' : 'Pending'}
              </Badge>
            )}
          </div>

          {step3Status !== 'disabled' ? (
            <div className="space-y-[var(--lc-space-sm)]">
              <div
                className={cn(
                  'inline-flex max-w-full items-center gap-2 rounded-[var(--lc-radius-md)]',
                  'bg-[var(--lc-surface-inverse)] px-3 py-2 text-[var(--lc-text-inverse)]',
                )}
                style={{ font: 'var(--lc-type-data)' }}
              >
                <span className="truncate">{agencyName}</span>
                <button
                  type="button"
                  className="shrink-0 text-[var(--lc-text-inverse)] opacity-80 hover:opacity-100"
                  aria-label="Copy agency name (liveness warning)"
                  onClick={handleCopyWarn}
                >
                  <Copy className="h-4 w-4" aria-hidden />
                </button>
              </div>
              {copyWarned ? (
                <p className="text-[var(--lc-text-brand)]" style={{ font: 'var(--lc-type-caption)' }}>
                  Type it, don&apos;t paste — this is a liveness check.
                </p>
              ) : null}

              <div>
                <Label
                  htmlFor="ownership-typed-agency-name"
                  className="text-[var(--lc-text-secondary)]"
                  style={{ font: 'var(--lc-type-overline)' }}
                >
                  Type &quot;{agencyName}&quot; to confirm
                </Label>
                <Input
                  id="ownership-typed-agency-name"
                  value={typedName}
<<<<<<< HEAD
=======
                  disabled={false}
>>>>>>> 01639c9 (fix(web): clear pre-existing tsc errors blocking CI)
                  placeholder={`Type "${agencyName}" to confirm`}
                  autoComplete="off"
                  spellCheck={false}
                  dir="auto"
                  aria-invalid={typedError ? true : undefined}
                  aria-describedby={typedError ? 'ownership-typed-agency-error' : undefined}
                  className="mt-1"
                  onChange={(e) => handleTypedChange(e.target.value)}
                />
                {typedError ? (
                  <p
                    id="ownership-typed-agency-error"
                    className="mt-1 text-[var(--lc-status-unpublished-fg)]"
                    style={{ font: 'var(--lc-type-caption)' }}
                  >
                    {typedError}
                  </p>
                ) : null}
              </div>
            </div>
          ) : null}
        </li>
      </ol>
    </div>
  )
}

function StepBadge({ n, status }: { n: number; status: StepStatus }) {
  return (
    <span
      className={cn(
        'inline-flex h-7 w-7 items-center justify-center rounded-[var(--lc-radius-pill)]',
        'text-xs font-semibold',
        status === 'complete'
          ? 'bg-[var(--lc-accent)] text-[var(--lc-accent-bold-text)] outline outline-1 outline-[var(--lc-accent-bold-edge)]'
          : status === 'current'
            ? 'bg-[var(--lc-action-primary)] text-[var(--lc-action-primary-text)]'
            : 'bg-[var(--lc-surface)] text-[var(--lc-text-muted)] border border-[var(--lc-border)]',
      )}
      aria-hidden
    >
      {status === 'complete' ? <Check className="h-3.5 w-3.5" /> : n}
    </span>
  )
}
