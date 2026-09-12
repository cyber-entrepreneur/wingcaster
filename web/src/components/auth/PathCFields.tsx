import { useId } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import {
  LEGAL_ENTITY_OPTIONS,
  PRIMARY_MARKET_OPTIONS,
  rt,
  type LegalEntity,
  type PrimaryMarket,
  type RegisterLocale,
} from './registerCopy'

export type PathCValues = {
  agency_name: string
  legal_entity: LegalEntity | ''
  primary_market: PrimaryMarket | ''
  authorized_to_accept: boolean
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
 * SHR-AUT-006 Step 3 for path=agency — name, legal entity, market, consent-on-behalf.
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

      <div className="grid gap-[var(--lc-space-sm)] sm:grid-cols-2">
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

        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${formId}-market`}>{rt('pathC.market.label', locale)}</Label>
          <select
            id={`${formId}-market`}
            className={selectClass}
            value={values.primary_market}
            disabled={disabled}
            aria-invalid={Boolean(errors?.primary_market)}
            onChange={(e) => patch({ primary_market: e.target.value as PrimaryMarket | '' })}
          >
            <option value="" disabled>
              —
            </option>
            {PRIMARY_MARKET_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label[locale]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <label className="flex min-h-[var(--lc-tap-target-min)] cursor-pointer items-start gap-2 text-sm text-[var(--lc-text-primary)]">
        <input
          type="checkbox"
          className={cn(
            'mt-1 h-4 w-4 shrink-0 rounded border border-[var(--lc-border-strong)]',
            'accent-[var(--lc-action-primary)]',
          )}
          checked={values.authorized_to_accept}
          disabled={disabled}
          onChange={(e) => patch({ authorized_to_accept: e.target.checked })}
        />
        <span>
          {rt('pathC.consent', locale)}
          {!values.authorized_to_accept ? (
            <span className="ms-1 text-[var(--lc-status-unpublished-fg)]">Required.</span>
          ) : null}
        </span>
      </label>
    </div>
  )
}

export const EMPTY_PATH_C_VALUES: PathCValues = {
  agency_name: '',
  legal_entity: '',
  primary_market: '',
  authorized_to_accept: false,
}
