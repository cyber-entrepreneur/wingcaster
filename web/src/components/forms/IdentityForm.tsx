import { useId, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'

/** Identifier tabs for the credential trio (OAuth is sibling, not inside this form). */
export type IdentityIdentifierType = 'email' | 'username' | 'phone'

/** Password strength bands — labels always accompany color (a11y). */
export type PasswordStrength = 'weak' | 'fair' | 'strong' | 'excellent' | 'empty'

export type IdentityFormValues = {
  email: string
  username: string
  phone: string
  /** Username-path recovery (email or phone); at least one required when tab=username. */
  recovery_email: string
  recovery_phone: string
  password: string
  consent_terms: boolean
  consent_marketing: boolean
  /** Guest / AGN-MEM-005 compact fields. */
  display_name: string
}

export type IdentityFormProps = {
  /**
   * `full` — SHR-AUT-006 identity handshake (tabs + password + consents + Continue).
   * `compact` — AGN-MEM-005 guest-signup subset (name + email + password; Terms still required).
   */
  variant?: 'full' | 'compact'
  /** Controlled values; parent owns state. */
  values: IdentityFormValues
  /** Active identifier tab (ignored in `compact`). */
  identifier_type?: IdentityIdentifierType
  /** Stub change handler — no auth / register call. */
  onChange: (next: IdentityFormValues) => void
  /** Stub tab switch — parent should preserve per-tab values. */
  onIdentifierTypeChange?: (type: IdentityIdentifierType) => void
  /** Stub submit — parent POSTs `/api/auth/register`. */
  onSubmit?: (values: IdentityFormValues) => void
  /** Override CTA label (default “Continue →”). */
  submit_label?: string
  /** Disable all controls (loading). */
  disabled?: boolean
  /** Terms / Privacy hrefs for consent links. */
  terms_href?: string
  privacy_href?: string
  className?: string
}

const STRENGTH_LABEL: Record<PasswordStrength, string> = {
  empty: '',
  weak: 'Weak',
  fair: 'Fair',
  strong: 'Strong',
  excellent: 'Excellent',
}

/** Maps brief danger/warning/success/accent bands onto shipped Broadcast status tokens. */
const STRENGTH_SEGMENT_TOKEN: Record<Exclude<PasswordStrength, 'empty'>, string> = {
  weak: 'var(--lc-status-unpublished-dot)',
  fair: 'var(--lc-status-underOffer-dot)',
  strong: 'var(--lc-status-published-dot)',
  excellent: 'var(--lc-accent)',
}

/**
 * Heuristic strength for stub UI only — real policy lands with SHR-AUT-006.
 * Bands: empty → weak → fair → strong → excellent.
 */
export function estimatePasswordStrength(password: string): PasswordStrength {
  if (!password) return 'empty'
  let score = 0
  if (password.length >= 8) score += 1
  if (password.length >= 12) score += 1
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score += 1
  if (/\d/.test(password)) score += 1
  if (/[^A-Za-z0-9]/.test(password)) score += 1
  if (score <= 1) return 'weak'
  if (score === 2) return 'fair'
  if (score === 3) return 'strong'
  return 'excellent'
}

function strengthFilledCount(strength: PasswordStrength): number {
  switch (strength) {
    case 'weak':
      return 1
    case 'fair':
      return 2
    case 'strong':
      return 3
    case 'excellent':
      return 4
    default:
      return 0
  }
}

function PasswordStrengthMeter({ password }: { password: string }) {
  const strength = estimatePasswordStrength(password)
  const filled = strengthFilledCount(strength)
  const fillToken =
    strength === 'empty' ? 'var(--lc-border)' : STRENGTH_SEGMENT_TOKEN[strength]

  return (
    <div className="flex flex-col gap-1" aria-live="polite">
      <div className="flex gap-1" role="meter" aria-valuemin={0} aria-valuemax={4} aria-valuenow={filled} aria-label="Password strength">
        {[0, 1, 2, 3].map((index) => (
          <span
            key={index}
            className="h-1.5 flex-1 rounded-[var(--lc-radius-sm)] bg-[var(--lc-surface-sunken)]"
            style={
              index < filled
                ? { backgroundColor: fillToken }
                : undefined
            }
          />
        ))}
      </div>
      {strength !== 'empty' ? (
        <span className="text-xs text-[var(--lc-text-muted)]">
          Password strength: {STRENGTH_LABEL[strength]}
        </span>
      ) : null}
    </div>
  )
}

/**
 * Identity handshake extract from SHR-AUT-006: identifier tabs + inputs +
 * password + strength meter + consent block (+ Continue).
 *
 * Used by: SHR-AUT-006 (full signup), AGN-MEM-005 guest-signup collapsible (`variant="compact"`).
 *
 * Stub handlers only — no OAuth / register / SMS OTP.
 */
export function IdentityForm({
  variant = 'full',
  values,
  identifier_type = 'email',
  onChange,
  onIdentifierTypeChange,
  onSubmit,
  submit_label = 'Continue →',
  disabled = false,
  terms_href = '/terms',
  privacy_href = '/privacy',
  className,
}: IdentityFormProps) {
  const formId = useId()
  const [showPassword, setShowPassword] = useState(false)

  const patch = (partial: Partial<IdentityFormValues>) => {
    onChange({ ...values, ...partial })
  }

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    onSubmit?.(values)
  }

  const identifierField =
    variant === 'compact'
      ? {
          id: `${formId}-email`,
          label: 'Your email',
          type: 'email' as const,
          inputMode: 'email' as const,
          autoComplete: 'email',
          placeholder: 'you@example.com',
          value: values.email,
          dir: 'ltr' as const,
          onChange: (e: ChangeEvent<HTMLInputElement>) => patch({ email: e.target.value }),
        }
      : identifier_type === 'username'
        ? {
            id: `${formId}-username`,
            label: 'Username',
            type: 'text' as const,
            inputMode: undefined,
            autoComplete: 'username',
            placeholder: 'your.username',
            value: values.username,
            dir: 'ltr' as const,
            onChange: (e: ChangeEvent<HTMLInputElement>) => patch({ username: e.target.value }),
          }
        : identifier_type === 'phone'
          ? {
              id: `${formId}-phone`,
              label: 'Phone',
              type: 'tel' as const,
              inputMode: 'tel' as const,
              autoComplete: 'tel',
              placeholder: '+971 5X XXX XXXX',
              value: values.phone,
              dir: 'ltr' as const,
              onChange: (e: ChangeEvent<HTMLInputElement>) => patch({ phone: e.target.value }),
            }
          : {
              id: `${formId}-email`,
              label: 'Email',
              type: 'email' as const,
              inputMode: 'email' as const,
              autoComplete: 'email',
              placeholder: 'you@example.com',
              value: values.email,
              dir: 'ltr' as const,
              onChange: (e: ChangeEvent<HTMLInputElement>) => patch({ email: e.target.value }),
            }

  return (
    <form
      className={cn('flex flex-col gap-[var(--lc-space-md)]', className)}
      onSubmit={handleSubmit}
      noValidate
    >
      {variant === 'compact' ? (
        <div className="flex flex-col gap-[var(--lc-space-sm)]">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${formId}-name`}>Your name</Label>
            <Input
              id={`${formId}-name`}
              type="text"
              autoComplete="name"
              placeholder="Your name"
              value={values.display_name}
              disabled={disabled}
              onChange={(e) => patch({ display_name: e.target.value })}
            />
          </div>
        </div>
      ) : (
        <Tabs
          value={identifier_type}
          onValueChange={(v) => onIdentifierTypeChange?.(v as IdentityIdentifierType)}
        >
          <TabsList
            className={cn(
              'h-auto w-full justify-start gap-0 rounded-none bg-transparent p-0',
              'border-b border-[var(--lc-border)]',
            )}
          >
            {(
              [
                ['email', 'Email'],
                ['username', 'Username'],
                ['phone', 'Phone'],
              ] as const
            ).map(([value, label]) => (
              <TabsTrigger
                key={value}
                value={value}
                disabled={disabled}
                className={cn(
                  'rounded-none border-b-2 border-transparent bg-transparent px-3 shadow-none',
                  'text-[var(--lc-text-muted)] data-[state=active]:bg-transparent',
                  'data-[state=active]:text-[var(--lc-text-heading)]',
                  'data-[state=active]:border-[var(--lc-action-primary)]',
                  'data-[state=active]:shadow-none',
                )}
              >
                {label}
              </TabsTrigger>
            ))}
          </TabsList>
          <TabsContent value={identifier_type} className="mt-[var(--lc-space-md)]">
            {/* Content rendered below shared fields for a stable password/consent block */}
          </TabsContent>
        </Tabs>
      )}

      <div className="flex flex-col gap-[var(--lc-space-sm)]">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={identifierField.id}>{identifierField.label}</Label>
          <Input
            id={identifierField.id}
            type={identifierField.type}
            inputMode={identifierField.inputMode}
            autoComplete={identifierField.autoComplete}
            placeholder={identifierField.placeholder}
            value={identifierField.value}
            dir={identifierField.dir}
            disabled={disabled}
            onChange={identifierField.onChange}
          />
        </div>

        {variant === 'full' && identifier_type === 'username' ? (
          <div className="grid gap-[var(--lc-space-sm)] sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`${formId}-recovery-email`}>Recovery email</Label>
              <Input
                id={`${formId}-recovery-email`}
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={values.recovery_email}
                dir="ltr"
                disabled={disabled}
                onChange={(e) => patch({ recovery_email: e.target.value })}
              />
              <p className="text-xs text-[var(--lc-text-muted)]">
                We need a recovery email — required to recover your account if you lose access.
              </p>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`${formId}-recovery-phone`}>Or recovery phone</Label>
              <Input
                id={`${formId}-recovery-phone`}
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder="+971 5X XXX XXXX"
                value={values.recovery_phone}
                dir="ltr"
                disabled={disabled}
                onChange={(e) => patch({ recovery_phone: e.target.value })}
              />
            </div>
          </div>
        ) : null}

        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${formId}-password`}>
            {variant === 'compact' ? 'Choose a password' : 'Password'}
          </Label>
          <div className="relative">
            <Input
              id={`${formId}-password`}
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              placeholder="Choose a strong password"
              value={values.password}
              dir="ltr"
              disabled={disabled}
              className="pe-12"
              onChange={(e) => patch({ password: e.target.value })}
            />
            <button
              type="button"
              className={cn(
                'absolute end-1 top-1/2 flex h-tap w-tap -translate-y-1/2 items-center justify-center',
                'rounded-[var(--lc-radius-md)] text-[var(--lc-text-muted)]',
                'hover:text-[var(--lc-text-primary)] focus-visible:outline-none',
              )}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              disabled={disabled}
              onClick={() => setShowPassword((v) => !v)}
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4" aria-hidden />
              ) : (
                <Eye className="h-4 w-4" aria-hidden />
              )}
            </button>
          </div>
          <PasswordStrengthMeter password={values.password} />
        </div>
      </div>

      <fieldset className="flex flex-col gap-[var(--lc-space-sm)] border-0 p-0">
        <legend className="sr-only">Consents</legend>
        <label className="flex min-h-tap cursor-pointer items-start gap-2 text-sm text-[var(--lc-text-primary)]">
          <input
            type="checkbox"
            className={cn(
              'mt-1 h-4 w-4 shrink-0 rounded border border-[var(--lc-border-strong)]',
              'accent-[var(--lc-action-primary)]',
            )}
            checked={values.consent_terms}
            disabled={disabled}
            onChange={(e) => patch({ consent_terms: e.target.checked })}
            required
          />
          <span>
            I agree to the{' '}
            <a
              href={terms_href}
              className="text-[var(--lc-action-primary)] underline-offset-2 hover:underline"
            >
              Terms of Service
            </a>{' '}
            and{' '}
            <a
              href={privacy_href}
              className="text-[var(--lc-action-primary)] underline-offset-2 hover:underline"
            >
              Privacy Policy
            </a>
            .
          </span>
        </label>
        {variant === 'full' ? (
          <label className="flex min-h-tap cursor-pointer items-start gap-2 text-sm text-[var(--lc-text-primary)]">
            <input
              type="checkbox"
              className={cn(
                'mt-1 h-4 w-4 shrink-0 rounded border border-[var(--lc-border-strong)]',
                'accent-[var(--lc-action-primary)]',
              )}
              checked={values.consent_marketing}
              disabled={disabled}
              onChange={(e) => patch({ consent_marketing: e.target.checked })}
            />
            <span>Send me product updates and MENA real-estate insights.</span>
          </label>
        ) : null}
      </fieldset>

      <Button type="submit" variant="default" size="lg" className="w-full sm:w-auto" disabled={disabled}>
        {submit_label}
      </Button>
    </form>
  )
}

/** Empty controlled values for parents bootstrapping local state. */
export const EMPTY_IDENTITY_FORM_VALUES: IdentityFormValues = {
  email: '',
  username: '',
  phone: '',
  recovery_email: '',
  recovery_phone: '',
  password: '',
  consent_terms: false,
  consent_marketing: false,
  display_name: '',
}
