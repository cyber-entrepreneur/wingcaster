import { useEffect, useId, useRef, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import { rt, type RegisterLocale } from '@/components/auth/registerCopy'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
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
  /** Phone path country dial prefix (E.164). */
  phone_dial?: string
}

export type IdentityFormFieldErrors = Partial<
  Record<
    | 'email'
    | 'username'
    | 'phone'
    | 'password'
    | 'recovery_email'
    | 'recovery_phone'
    | 'consent_terms'
    | 'display_name',
    string
  >
>

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
  onChange: (next: IdentityFormValues) => void
  /** Tab switch — parent should preserve per-tab values. */
  onIdentifierTypeChange?: (type: IdentityIdentifierType) => void
  /** Parent POSTs `/api/auth/register` (or guest apply). */
  onSubmit?: (values: IdentityFormValues) => void
  /** Override CTA label (default “Continue →”). */
  submit_label?: string
  /** Label while submitting. */
  submitting_label?: string
  /** Disable all controls (OAuth-in-progress / offline). */
  disabled?: boolean
  /** Submit in flight — shows Loader2 + submitting_label. */
  submitting?: boolean
  /** Force Continue disabled (parent path-specific validity). */
  submitDisabled?: boolean
  /** Inline field errors from client or backend validation. */
  fieldErrors?: IdentityFormFieldErrors
  /** Terms / Privacy hrefs for consent links. */
  terms_href?: string
  privacy_href?: string
  /** Hide the Continue button when parent renders it outside (rare). */
  hideSubmit?: boolean
  /**
   * When true, render fields without a wrapping `<form>` so AGN-MEM-005 can
   * nest the compact guest block inside the application form (additive).
   */
  embedded?: boolean
  /** Auto-focus the first field (compact: “Your name”). */
  autoFocusFirst?: boolean
  /** SHR-AUT-006 copy locale; defaults to English when used outside RegisterPage. */
  locale?: RegisterLocale
  className?: string
}

const STRENGTH_LABEL: Record<PasswordStrength, string> = {
  empty: '',
  weak: 'Weak',
  fair: 'Fair',
  strong: 'Strong',
  excellent: 'Excellent',
}

/**
 * SHR-AUT-006 strength bands → brief status tokens.
 * `--lc-brand-accent` is not in broadcast-theme.css; excellent uses `--lc-accent`.
 */
const STRENGTH_SEGMENT_TOKEN: Record<Exclude<PasswordStrength, 'empty'>, string> = {
  weak: 'var(--lc-status-danger)',
  fair: 'var(--lc-status-warning)',
  strong: 'var(--lc-status-success)',
  excellent: 'var(--lc-accent)',
}

const PHONE_DIALS = [
  { code: 'AE', dial: '+971', label: 'AE +971' },
  { code: 'SA', dial: '+966', label: 'SA +966' },
  { code: 'EG', dial: '+20', label: 'EG +20' },
  { code: 'LB', dial: '+961', label: 'LB +961' },
] as const

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const USERNAME_RE = /^[a-zA-Z0-9._-]{3,32}$/
const PHONE_DIGITS_RE = /^\d{8,15}$/

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

export function isEmailValid(value: string): boolean {
  return EMAIL_RE.test(value.trim())
}

export function isUsernameValid(value: string): boolean {
  return USERNAME_RE.test(value.trim())
}

export function isPhoneValid(value: string, dial = '+971'): boolean {
  const digits = value.replace(/[^\d]/g, '')
  if (value.trim().startsWith('+')) {
    return /^\+[1-9]\d{7,14}$/.test(value.replace(/\s/g, ''))
  }
  return PHONE_DIGITS_RE.test(digits) && Boolean(dial)
}

export function normalizePhoneE164(value: string, dial = '+971'): string {
  const trimmed = value.trim().replace(/\s/g, '')
  if (trimmed.startsWith('+')) return trimmed
  const digits = trimmed.replace(/[^\d]/g, '')
  return `${dial}${digits}`
}

export function isPasswordAcceptable(password: string): boolean {
  const strength = estimatePasswordStrength(password)
  return strength !== 'empty' && strength !== 'weak'
}

/** Client-side validity for Continue enablement. */
export function isIdentityFormValid(
  values: IdentityFormValues,
  opts: { variant: 'full' | 'compact'; identifier_type: IdentityIdentifierType },
): boolean {
  if (!values.consent_terms) return false
  if (!isPasswordAcceptable(values.password)) return false

  if (opts.variant === 'compact') {
    return values.display_name.trim().length > 0 && isEmailValid(values.email)
  }

  if (opts.identifier_type === 'email') return isEmailValid(values.email)
  if (opts.identifier_type === 'phone') {
    return isPhoneValid(values.phone, values.phone_dial || '+971')
  }
  // username — need username + at least one recovery
  if (!isUsernameValid(values.username)) return false
  const hasRecovery =
    isEmailValid(values.recovery_email) ||
    isPhoneValid(values.recovery_phone, values.phone_dial || '+971')
  return hasRecovery
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
  const fillToken = strength === 'empty' ? 'var(--lc-border)' : STRENGTH_SEGMENT_TOKEN[strength]

  return (
    <div className="flex flex-col gap-1" aria-live="polite">
      <div
        className="flex gap-1"
        role="meter"
        aria-valuemin={0}
        aria-valuemax={4}
        aria-valuenow={filled}
        aria-label="Password strength"
      >
        {[0, 1, 2, 3].map((index) => (
          <span
            key={index}
            className="h-1.5 flex-1 rounded-[var(--lc-radius-sm)] bg-[var(--lc-surface-sunken)]"
            style={index < filled ? { backgroundColor: fillToken } : undefined}
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
 * Path: `@/components/forms/IdentityForm` — keep stable for Agent 2.
 */
export function IdentityForm({
  variant = 'full',
  values,
  identifier_type = 'email',
  onChange,
  onIdentifierTypeChange,
  onSubmit,
  submit_label = 'Continue →',
  submitting_label = 'Creating account…',
  disabled = false,
  submitting = false,
  submitDisabled = false,
  fieldErrors,
  terms_href = '/terms',
  privacy_href = '/privacy',
  hideSubmit = false,
  embedded = false,
  autoFocusFirst = false,
  locale = 'en',
  className,
}: IdentityFormProps) {
  const formId = useId()
  const [showPassword, setShowPassword] = useState(false)
  const revealTimer = useRef<number | null>(null)
  const locked = disabled || submitting
  const termsCheckboxId = `${formId}-consent-terms`
  const marketingCheckboxId = `${formId}-consent-marketing`

  const patch = (partial: Partial<IdentityFormValues>) => {
    onChange({ ...values, ...partial })
  }

  useEffect(() => {
    return () => {
      if (revealTimer.current) window.clearTimeout(revealTimer.current)
    }
  }, [])

  const togglePassword = () => {
    setShowPassword((prev) => {
      const next = !prev
      if (revealTimer.current) window.clearTimeout(revealTimer.current)
      if (next) {
        // Brief: auto re-mask after 10s if user isn't actively typing.
        revealTimer.current = window.setTimeout(() => setShowPassword(false), 10_000)
      }
      return next
    })
  }

  const onPasswordChange = (e: ChangeEvent<HTMLInputElement>) => {
    patch({ password: e.target.value })
    if (showPassword) {
      if (revealTimer.current) window.clearTimeout(revealTimer.current)
      revealTimer.current = window.setTimeout(() => setShowPassword(false), 10_000)
    }
  }

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    if (!isIdentityFormValid(values, { variant, identifier_type })) return
    onSubmit?.(values)
  }

  const formValid = isIdentityFormValid(values, { variant, identifier_type })
  const continueDisabled = locked || submitDisabled || !formValid

  const strength = estimatePasswordStrength(values.password)
  const passwordWeakError =
    values.password.length > 0 && strength === 'weak'
      ? 'Password must be at least Fair strength.'
      : fieldErrors?.password

  const dial = values.phone_dial || '+971'
  const Root = embedded ? 'div' : 'form'
  const rootProps = embedded
    ? {}
    : { onSubmit: handleSubmit, noValidate: true as const }

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
          error: fieldErrors?.email,
          errorId: `${formId}-email-err`,
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
            error:
              fieldErrors?.username ||
              (values.username && !isUsernameValid(values.username)
                ? 'Use 3–32 letters, numbers, dots, underscores, or hyphens.'
                : undefined),
            errorId: `${formId}-username-err`,
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
              error:
                fieldErrors?.phone ||
                (values.phone && !isPhoneValid(values.phone, dial)
                  ? 'Enter a valid phone number.'
                  : undefined),
              errorId: `${formId}-phone-err`,
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
              error:
                fieldErrors?.email ||
                (values.email && !isEmailValid(values.email)
                  ? 'Enter a valid email address.'
                  : undefined),
              errorId: `${formId}-email-err`,
              onChange: (e: ChangeEvent<HTMLInputElement>) => patch({ email: e.target.value }),
            }

  return (
    <Root
      className={cn('flex flex-col gap-[var(--lc-space-md)]', className)}
      data-testid="identity-form"
      data-variant={variant}
      {...rootProps}
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
              disabled={locked}
              autoFocus={autoFocusFirst}
              aria-invalid={Boolean(fieldErrors?.display_name)}
              onChange={(e) => patch({ display_name: e.target.value })}
            />
            {fieldErrors?.display_name ? (
              <p className="text-xs text-[var(--lc-status-unpublished-fg)]" role="alert">
                {fieldErrors.display_name}
              </p>
            ) : null}
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
                disabled={locked}
                className={cn(
                  'min-h-[var(--lc-tap-target-min)] rounded-none border-b-2 border-transparent bg-transparent px-3 shadow-none',
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
          <TabsContent value={identifier_type} className="mt-0" />
        </Tabs>
      )}

      <div className="flex flex-col gap-[var(--lc-space-sm)]">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={identifierField.id}>{identifierField.label}</Label>
          {variant === 'full' && identifier_type === 'phone' ? (
            <div className="flex items-stretch gap-0">
              <select
                aria-label="Country dial code"
                className={cn(
                  'min-h-[var(--lc-tap-target-min)] shrink-0 rounded-s-[var(--lc-radius-md)]',
                  'border border-e-0 border-[var(--lc-border-strong)] bg-[var(--lc-surface-sunken)]',
                  'px-2 text-sm text-[var(--lc-text-primary)] focus-visible:outline-none',
                )}
                value={dial}
                disabled={locked}
                onChange={(e) => patch({ phone_dial: e.target.value })}
              >
                {PHONE_DIALS.map((c) => (
                  <option key={c.code} value={c.dial}>
                    {c.label}
                  </option>
                ))}
              </select>
              <Input
                id={identifierField.id}
                type={identifierField.type}
                inputMode={identifierField.inputMode}
                autoComplete={identifierField.autoComplete}
                placeholder={identifierField.placeholder}
                value={identifierField.value}
                dir={identifierField.dir}
                disabled={locked}
                className="rounded-s-none"
                aria-invalid={Boolean(identifierField.error)}
                aria-describedby={identifierField.error ? identifierField.errorId : undefined}
                onChange={identifierField.onChange}
                onBlur={() => {
                  if (values.phone.trim()) {
                    patch({ phone: normalizePhoneE164(values.phone, dial) })
                  }
                }}
              />
            </div>
          ) : (
            <Input
              id={identifierField.id}
              type={identifierField.type}
              inputMode={identifierField.inputMode}
              autoComplete={identifierField.autoComplete}
              placeholder={identifierField.placeholder}
              value={identifierField.value}
              dir={identifierField.dir}
              disabled={locked}
              aria-invalid={Boolean(identifierField.error)}
              aria-describedby={identifierField.error ? identifierField.errorId : undefined}
              onChange={identifierField.onChange}
            />
          )}
          {identifierField.error ? (
            <p
              id={identifierField.errorId}
              className="text-xs text-[var(--lc-status-unpublished-fg)]"
              role="alert"
            >
              {identifierField.error}
            </p>
          ) : null}
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
                disabled={locked}
                aria-describedby={`${formId}-recovery-hint`}
                onChange={(e) => patch({ recovery_email: e.target.value })}
              />
              <p id={`${formId}-recovery-hint`} className="text-xs text-[var(--lc-text-muted)]">
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
                disabled={locked}
                onChange={(e) => patch({ recovery_phone: e.target.value })}
              />
              <p className="text-xs text-[var(--lc-text-muted)]">
                Or a recovery phone — required to recover your account if you lose access.
              </p>
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
              disabled={locked}
              className="pe-12"
              aria-invalid={Boolean(passwordWeakError)}
              aria-describedby={passwordWeakError ? `${formId}-password-err` : undefined}
              onChange={onPasswordChange}
            />
            <button
              type="button"
              className={cn(
                'absolute end-1 top-1/2 flex h-tap w-tap -translate-y-1/2 items-center justify-center',
                'rounded-[var(--lc-radius-md)] text-[var(--lc-text-muted)]',
                'hover:text-[var(--lc-text-primary)] focus-visible:outline-none',
              )}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              disabled={locked}
              onClick={togglePassword}
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4" aria-hidden />
              ) : (
                <Eye className="h-4 w-4" aria-hidden />
              )}
            </button>
          </div>
          <PasswordStrengthMeter password={values.password} />
          {passwordWeakError ? (
            <p
              id={`${formId}-password-err`}
              className="text-xs text-[var(--lc-status-unpublished-fg)]"
              role="alert"
            >
              {passwordWeakError}
            </p>
          ) : null}
        </div>
      </div>

      <fieldset className="flex flex-col gap-[var(--lc-space-sm)] border-0 p-0">
        <legend className="sr-only">Consents</legend>
        <div className="flex min-h-tap items-start gap-2 text-sm text-[var(--lc-text-primary)]">
          <Checkbox
            id={termsCheckboxId}
            className="mt-1"
            checked={values.consent_terms}
            disabled={locked}
            required
            onCheckedChange={(checked) => patch({ consent_terms: checked === true })}
            aria-invalid={!values.consent_terms}
            aria-label="I agree to the Terms of Service and Privacy Policy"
          />
          <Label htmlFor={termsCheckboxId} className="cursor-pointer font-normal leading-snug">
            I agree to the{' '}
            <a
              href={terms_href}
              className="text-[var(--lc-action-primary)] underline-offset-2 hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              Terms of Service
            </a>{' '}
            and{' '}
            <a
              href={privacy_href}
              className="text-[var(--lc-action-primary)] underline-offset-2 hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              Privacy Policy
            </a>
            .
            {!values.consent_terms ? (
              <span className="ms-1 text-[var(--lc-status-unpublished-fg)]">
                {rt('consent.required', locale)}
              </span>
            ) : null}
          </Label>
        </div>
        {variant === 'full' ? (
          <div className="flex min-h-tap items-start gap-2 text-sm text-[var(--lc-text-primary)]">
            <Checkbox
              id={marketingCheckboxId}
              className="mt-1"
              checked={values.consent_marketing}
              disabled={locked}
              onCheckedChange={(checked) => patch({ consent_marketing: checked === true })}
              aria-label="Send me product updates and MENA real-estate insights."
            />
            <Label
              htmlFor={marketingCheckboxId}
              className="cursor-pointer font-normal leading-snug"
            >
              Send me product updates and MENA real-estate insights.
            </Label>
          </div>
        ) : null}
      </fieldset>

      {!hideSubmit ? (
        <Button
          type="submit"
          variant="default"
          size="lg"
          className="w-full sm:w-auto"
          disabled={continueDisabled}
        >
          {submitting ? (
            <>
              <Loader2 className="me-2 h-4 w-4 animate-spin" aria-hidden />
              {submitting_label}
            </>
          ) : (
            submit_label
          )}
        </Button>
      ) : null}
    </Root>
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
  phone_dial: '+971',
}
