import { useId } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { LEGAL_ENTITY_OPTIONS, rt, type LegalEntity, type RegisterLocale } from './registerCopy'

export type PathCValues = {
  agency_name: string
  legal_entity: LegalEntity | ''
}

export type PathCFieldsProps = {
  values: PathCValues
  onChange: (next: PathCValues) => void
  locale?: RegisterLocale
  disabled?: boolean
  errors?: Partial<Record<keyof PathCValues, string>>
  className?: string
}

const selectClass =
  'flex h-tap w-full rounded-[var(--lc-radius-md)] border border-[var(--lc-border-strong)] bg-[var(--lc-surface)] px-3 text-sm text-[var(--lc-text-primary)] focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50'

/**
 * SHR-AUT-006 agency details — name, legal entity, and one-or-more primary
 * markets (any country). The "authorized to accept on behalf" consent lives
 * with the other consents (injected into IdentityForm), not here.
 */
export function PathCFields({
  values,
  onChange,
  locale = 'en',
  disabled = false,
  errors,
  className,
}: PathCFieldsProps) {
  const formId = useId()
  const patch = (partial: Partial<PathCValues>) => onChange({ ...values, ...partial })

  return (
    <div
      className={cn(
        'flex flex-col gap-[var(--lc-space-md)] overflow-hidden',
        'motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-top-1',
        'duration-[200ms] ease-out',
        className,
      )}
      data-testid="path-c-fields"
    >
      <span className="sr-only" aria-live="polite">
        {rt('pathC.revealed', locale)}
      </span>

      <h2
        className="text-[var(--lc-text-heading)]"
        style={{ font: 'var(--lc-type-heading-3)', letterSpacing: 'var(--lc-tracking-heading-3)' }}
      >
        {rt('pathC.section.heading', locale)}
      </h2>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${formId}-name`}>{rt('pathC.name.label', locale)}</Label>
        <Input
          id={`${formId}-name`}
          type="text"
          autoComplete="organization"
          placeholder={rt('pathC.name.placeholder', locale)}
          value={values.agency_name}
          disabled={disabled}
          aria-invalid={Boolean(errors?.agency_name)}
          onChange={(e) => patch({ agency_name: e.target.value })}
        />
        {errors?.agency_name ? (
          <p className="text-xs text-[var(--lc-status-unpublished-fg)]" role="alert">
            {errors.agency_name}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${formId}-legal`}>{rt('pathC.legal.label', locale)}</Label>
        <select
          id={`${formId}-legal`}
          className={selectClass}
          value={values.legal_entity}
          disabled={disabled}
          aria-invalid={Boolean(errors?.legal_entity)}
          onChange={(e) => patch({ legal_entity: e.target.value as LegalEntity | '' })}
        >
          <option value="" disabled>
            —
          </option>
          {LEGAL_ENTITY_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label[locale]}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}

export const EMPTY_PATH_C_VALUES: PathCValues = {
  agency_name: '',
  legal_entity: '',
}
