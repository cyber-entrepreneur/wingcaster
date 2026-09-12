import { useEffect, useId, useRef } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import {
  EMPTY_IDENTITY_FORM_VALUES,
  IdentityForm,
  estimatePasswordStrength,
  type IdentityFormValues,
} from '@/components/forms'
import { cn } from '@/lib/utils'

export type GuestSignupCollapsibleProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  values: IdentityFormValues
  onChange: (next: IdentityFormValues) => void
  disabled?: boolean
  className?: string
}

/**
 * AGN-MEM-005 anonymous guest-signup block.
 * Delegates fields to `<IdentityForm variant="compact" embedded hideSubmit />`
 * from `@/components/forms` (Shared Components Prep — do not duplicate).
 */
export function GuestSignupCollapsible({
  open,
  onOpenChange,
  values,
  onChange,
  disabled = false,
  className,
}: GuestSignupCollapsibleProps) {
  const panelId = useId()
  const nameFocusToken = useRef(0)

  useEffect(() => {
    if (!open) return
    // IdentityForm autoFocusFirst remounts via key bump when opened.
    nameFocusToken.current += 1
  }, [open])

  return (
    <div
      className={cn(
        'rounded-[var(--lc-radius-md)] border border-[var(--lc-border)] bg-[var(--lc-surface-raised)]',
        className,
      )}
    >
      <button
        type="button"
        className={cn(
          'flex w-full min-h-[var(--lc-tap-target-min)] items-center justify-between gap-2',
          'px-[var(--lc-space-md)] py-[var(--lc-space-sm)] text-start',
          'text-[var(--lc-text-heading)]',
        )}
        style={{ font: 'var(--lc-type-heading-3)' }}
        aria-expanded={open}
        aria-controls={panelId}
        disabled={disabled}
        onClick={() => onOpenChange(!open)}
      >
        <span>Sign in or continue as guest</span>
        {open ? (
          <ChevronUp className="h-5 w-5 shrink-0" aria-hidden />
        ) : (
          <ChevronDown className="h-5 w-5 shrink-0" aria-hidden />
        )}
      </button>

      <div
        id={panelId}
        hidden={!open}
        className={cn(
          'overflow-hidden border-t border-[var(--lc-border)] px-[var(--lc-space-md)] py-[var(--lc-space-md)]',
          'transition-[height] duration-[var(--lc-duration-slow)] ease-[var(--lc-easing-out)]',
        )}
      >
        {open ? (
          <IdentityForm
            key={nameFocusToken.current}
            variant="compact"
            embedded
            hideSubmit
            autoFocusFirst
            values={values}
            onChange={onChange}
            disabled={disabled}
          />
        ) : null}
      </div>
    </div>
  )
}

export function isGuestSignupValid(values: IdentityFormValues): boolean {
  const nameOk = values.display_name.trim().length >= 2
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())
  const strength = estimatePasswordStrength(values.password)
  const passwordOk = strength !== 'empty' && strength !== 'weak'
  const termsOk = values.consent_terms
  return nameOk && emailOk && passwordOk && termsOk
}

export { EMPTY_IDENTITY_FORM_VALUES }
