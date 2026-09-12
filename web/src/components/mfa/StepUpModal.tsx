import { Mail, ShieldCheck } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Numeric } from '@/components/ui/numeric'
import { OtpInput } from '@/components/mfa/OtpInput'
import { BackupCodeInput } from '@/components/mfa/BackupCodeInput'
import { RateLimitBanner } from '@/components/mfa/RateLimitBanner'
import { cn } from '@/lib/utils'

export type StepUpMethod = 'totp' | 'email'

export interface StepUpModalProps {
  open: boolean
  /**
   * Human-readable reason shown in the sunken well
   * (e.g. "Turn off two-factor authentication").
   */
  reason?: string
  /** Factor path from `POST /api/auth/step-up`. */
  method?: StepUpMethod
  /** Masked destination for email OTP variant. */
  maskedEmail?: string
  /** Controlled OTP / backup code value. */
  code?: string
  onCodeChange?: (code: string) => void
  /** When true, swap TOTP OtpInput for BackupCodeInput. */
  useBackupCode?: boolean
  remainingAttempts?: number
  rateLimited?: boolean
  rateLimitMinutes?: number
  expired?: boolean
  verifying?: boolean
  /** When false, Verify stays disabled until POST /step-up returns a challenge. */
  challengeReady?: boolean
  error?: string
  resendCooldownSeconds?: number
  onCancel: () => void
  onVerify: () => void
  onResend?: () => void
  onRetryChallenge?: () => void
  onToggleBackupCode?: () => void
  className?: string
}

/**
 * Step-up re-authentication modal (SHR-MFA-007 contract).
 *
 * Used by: SHR-MFA-005/006, SHR-SET-004/005, PA credit surfaces, AGN ownership transfer —
 * via `<StepUpProvider>` from this `components/mfa/` package.
 *
 * **Coexistence note:** A legacy implementation lives at
 * `web/src/components/auth/StepUpModal.tsx` (wired through `web/src/context/StepUpContext.tsx`).
 * This file is the extract-stage stub for future MFA waves. Do **not** modify the legacy
 * files from this package; downstream waves migrate imports here.
 *
 * Stub UI only — no real step-up / TOTP API.
 */
export function StepUpModal({
  open,
  reason = 'an additional check on your account',
  method = 'totp',
  maskedEmail,
  code = '',
  onCodeChange,
  useBackupCode = false,
  remainingAttempts,
  rateLimited = false,
  rateLimitMinutes,
  expired = false,
  verifying = false,
  challengeReady = true,
  error,
  resendCooldownSeconds = 0,
  onCancel,
  onVerify,
  onResend,
  onRetryChallenge,
  onToggleBackupCode,
  className,
}: StepUpModalProps) {
  const isEmail = method === 'email'
  const codeReady = useBackupCode ? code.replace(/-/g, '').length >= 10 : code.length >= 6
  const Icon = isEmail ? Mail : ShieldCheck

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && !verifying) onCancel()
      }}
    >
      <DialogContent
        className={cn(
          'max-w-[440px] border-[var(--lc-border)] bg-[var(--lc-surface-raised)] shadow-[var(--lc-elevation-lg)]',
          'rounded-[var(--lc-radius-lg)]',
          className,
        )}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-[family-name:var(--lc-font-ui)] text-[length:var(--lc-type-heading-3)] text-[var(--lc-text-heading)]">
            <Icon
              className={cn(
                'h-6 w-6',
                isEmail ? 'text-[var(--lc-text-secondary)]' : 'text-[var(--lc-text-brand)]',
              )}
              aria-hidden
            />
            Verify it&apos;s you
          </DialogTitle>
          <DialogDescription className="sr-only">
            Confirm your identity before continuing with a sensitive action.
          </DialogDescription>
        </DialogHeader>

        <div
          className={cn(
            'rounded-[var(--lc-radius-md)] bg-[var(--lc-surface-sunken)]',
            'px-[var(--lc-space-md)] py-[var(--lc-space-sm)]',
            'text-[length:var(--lc-type-body-sm)] text-[var(--lc-text-secondary)]',
          )}
        >
          Confirm your identity to continue: <strong className="text-[var(--lc-text-primary)]">{reason}</strong>
        </div>

        {rateLimited ? (
          <RateLimitBanner
            message={
              typeof rateLimitMinutes === 'number'
                ? `Too many attempts. Wait ${rateLimitMinutes} minutes and try again.`
                : 'Too many attempts. Please wait and try again.'
            }
            retryAfterMinutes={rateLimitMinutes}
          />
        ) : expired ? (
          <div className="space-y-[var(--lc-space-sm)]">
            <RateLimitBanner message="This verification session expired. Please try again." />
            <Button type="button" variant="outline" onClick={onRetryChallenge}>
              Try again
            </Button>
          </div>
        ) : (
          <div className="space-y-[var(--lc-space-md)]">
            <p className="text-[length:var(--lc-type-body-sm)] text-[var(--lc-text-secondary)]">
              {useBackupCode
                ? 'Enter one of your one-time backup codes.'
                : isEmail
                  ? `We sent a 6-digit code to ${maskedEmail ?? 'your email'}. Enter it below.`
                  : 'Enter the 6-digit code from your authenticator app.'}
            </p>

            {useBackupCode ? (
              <BackupCodeInput
                value={code}
                disabled={verifying}
                error={Boolean(error)}
                autoFocus
                onChange={(formatted) => onCodeChange?.(formatted)}
              />
            ) : (
              <OtpInput
                count={6}
                value={code}
                disabled={verifying}
                error={Boolean(error)}
                autoFocus
                onChange={onCodeChange}
              />
            )}

            {error ? (
              <p
                role="alert"
                className="text-[length:var(--lc-type-body-sm)] text-[var(--lc-status-danger-fg)]"
              >
                {error}
              </p>
            ) : null}

            {typeof remainingAttempts === 'number' ? (
              <p className="text-[length:var(--lc-type-caption)] text-[var(--lc-text-muted)]">
                <Numeric>{remainingAttempts}</Numeric> attempts remaining.
              </p>
            ) : null}

            {isEmail && !useBackupCode ? (
              <button
                type="button"
                className="text-[length:var(--lc-type-body-sm)] text-[var(--lc-text-brand)] disabled:opacity-50"
                disabled={verifying || resendCooldownSeconds > 0}
                onClick={onResend}
              >
                {resendCooldownSeconds > 0 ? `Resend in ${resendCooldownSeconds}s` : 'Resend code'}
              </button>
            ) : null}

            {!isEmail && !useBackupCode ? (
              <button
                type="button"
                className="text-[length:var(--lc-type-body-sm)] text-[var(--lc-text-brand)]"
                disabled={verifying}
                onClick={onToggleBackupCode}
              >
                Use a backup code instead
              </button>
            ) : null}
          </div>
        )}

        <div className="flex justify-end gap-[var(--lc-space-sm)]">
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={!codeReady || verifying || rateLimited || expired || !challengeReady}
            onClick={onVerify}
          >
            {verifying ? 'Verifying…' : 'Verify'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
