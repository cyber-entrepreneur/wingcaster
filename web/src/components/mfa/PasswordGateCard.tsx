import { useId, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

export interface PasswordGateCardProps {
  /** Controlled password value. */
  value?: string
  onChange?: (value: string) => void
  /** Heading — default matches SHR-MFA-002. */
  title?: string
  /** Supporting copy under the heading. */
  subtitle?: string
  /** Submit button label. */
  submitLabel?: string
  /** Inline error (wrong password / setup failed). */
  error?: string
  loading?: boolean
  disabled?: boolean
  onSubmit?: () => void
  className?: string
}

/**
 * Current-password confirmation card before sensitive MFA actions.
 *
 * Used by: SHR-MFA-002 (enroll gate), SHR-MFA-006 (disable flow).
 * Stub visual only — parent POSTs `/api/auth/2fa/totp/setup` etc.
 */
export function PasswordGateCard({
  value = '',
  onChange,
  title = 'Confirm your password',
  subtitle = 'For your security, please confirm your current password before enabling two-factor.',
  submitLabel = 'Continue',
  error,
  loading = false,
  disabled = false,
  onSubmit,
  className,
}: PasswordGateCardProps) {
  const id = useId()
  const inputId = `${id}-password`

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!value || loading || disabled) return
    onSubmit?.()
  }

  return (
    <form
      noValidate
      onSubmit={handleSubmit}
      className={cn(
        'rounded-[var(--lc-radius-lg)] border border-[var(--lc-border)]',
        'bg-[var(--lc-surface-raised)] p-[var(--lc-space-lg)] shadow-[var(--lc-elevation-sm)]',
        className,
      )}
    >
      <h2 className="font-[family-name:var(--lc-font-ui)] text-[length:var(--lc-type-heading-3)] text-[var(--lc-text-heading)]">
        {title}
      </h2>
      <p className="mt-[var(--lc-space-xs)] text-[length:var(--lc-type-body-sm)] text-[var(--lc-text-secondary)]">
        {subtitle}
      </p>

      <div className="mt-[var(--lc-space-md)] space-y-[var(--lc-space-xs)]">
        <Label htmlFor={inputId}>Current password</Label>
        <Input
          id={inputId}
          type="password"
          autoComplete="current-password"
          value={value}
          disabled={disabled || loading}
          aria-invalid={Boolean(error) || undefined}
          onChange={(e) => onChange?.(e.target.value)}
        />
        {error ? (
          <p role="alert" className="text-[length:var(--lc-type-body-sm)] text-[var(--lc-status-danger-fg)]">
            {error}
          </p>
        ) : null}
      </div>

      <div className="mt-[var(--lc-space-lg)]">
        <Button type="submit" size="lg" disabled={!value || disabled || loading}>
          {loading ? 'Continuing…' : submitLabel}
        </Button>
      </div>
    </form>
  )
}
