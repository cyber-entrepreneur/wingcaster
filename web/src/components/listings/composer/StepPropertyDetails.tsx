import { Check } from 'lucide-react'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Numeric } from '@/components/ui/numeric'
import { cn } from '@/lib/utils'
import { FEATURE_CHIPS, PROPERTY_TYPES, type ComposerFormState } from './types'

export interface StepPropertyDetailsProps {
  form: ComposerFormState
  errors: Record<string, string>
  onChange: <K extends keyof ComposerFormState>(key: K, value: ComposerFormState[K]) => void
}

export function StepPropertyDetails({ form, errors, onChange }: StepPropertyDetailsProps) {
  const showLot = form.property_type === 'villa' || form.property_type === 'land'

  function toggleAmenity(name: string) {
    const next = form.amenities.includes(name)
      ? form.amenities.filter((a) => a !== name)
      : [...form.amenities, name]
    onChange('amenities', next)
  }

  return (
    <div className="space-y-[var(--lc-space-xl)]">
      <div>
        <Label htmlFor="composer-ptype">
          Property type <span className="text-[var(--lc-status-danger-fg)]">*</span>
        </Label>
        <select
          id="composer-ptype"
          className={selectClass}
          value={form.property_type}
          onChange={(e) => onChange('property_type', e.target.value)}
        >
          {PROPERTY_TYPES.map((t) => (
            <option key={t} value={t}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </option>
          ))}
        </select>
        {errors.property_type && (
          <p className="mt-1 text-[length:var(--lc-type-caption)] text-[var(--lc-status-danger-fg)]">
            {errors.property_type}
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="composer-beds">Bedrooms</Label>
          <Input
            id="composer-beds"
            inputMode="numeric"
            value={form.bedrooms}
            onChange={(e) => onChange('bedrooms', e.target.value.replace(/\D/g, ''))}
            className="font-[family-name:var(--lc-font-mono)]"
          />
        </div>
        <div>
          <Label htmlFor="composer-baths">Bathrooms</Label>
          <Input
            id="composer-baths"
            inputMode="numeric"
            value={form.bathrooms}
            onChange={(e) => onChange('bathrooms', e.target.value.replace(/\D/g, ''))}
            className="font-[family-name:var(--lc-font-mono)]"
          />
        </div>
      </div>

      <div>
        <Label htmlFor="composer-area-size">Floor area</Label>
        <div className="flex gap-2">
          <Input
            id="composer-area-size"
            inputMode="decimal"
            value={form.area}
            onChange={(e) => onChange('area', e.target.value.replace(/[^\d.]/g, ''))}
            className="flex-1 font-[family-name:var(--lc-font-mono)]"
          />
          <div
            role="group"
            aria-label="Area unit"
            className="inline-flex rounded-[var(--lc-radius-md)] border border-[var(--lc-border)] p-0.5"
          >
            {(['sqft', 'sqm'] as const).map((u) => (
              <button
                key={u}
                type="button"
                aria-pressed={form.area_unit === u}
                onClick={() => onChange('area_unit', u)}
                className={cn(
                  'min-h-10 rounded-[var(--lc-radius-md)] px-3 text-[length:var(--lc-type-caption)]',
                  form.area_unit === u
                    ? 'bg-[var(--lc-action-primary)] text-[var(--lc-action-primary-text)]'
                    : 'bg-[var(--lc-surface-sunken)] text-[var(--lc-text-secondary)]',
                )}
              >
                <Numeric>{u}</Numeric>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="composer-year">Year built (optional)</Label>
          <Input
            id="composer-year"
            inputMode="numeric"
            value={form.year_built}
            onChange={(e) => onChange('year_built', e.target.value.replace(/\D/g, ''))}
            className="font-[family-name:var(--lc-font-mono)]"
          />
        </div>
        {form.property_type !== 'land' && (
          <div>
            <Label htmlFor="composer-floor">Floor number (optional)</Label>
            <Input
              id="composer-floor"
              inputMode="numeric"
              value={form.floor}
              onChange={(e) => onChange('floor', e.target.value.replace(/\D/g, ''))}
              className="font-[family-name:var(--lc-font-mono)]"
            />
          </div>
        )}
      </div>

      {showLot && (
        <div>
          <Label htmlFor="composer-lot">Lot / plot size (optional)</Label>
          <Input
            id="composer-lot"
            inputMode="decimal"
            value={form.lot_size}
            onChange={(e) => onChange('lot_size', e.target.value.replace(/[^\d.]/g, ''))}
            className="font-[family-name:var(--lc-font-mono)]"
          />
        </div>
      )}

      <div>
        <p className="mb-1 text-[length:var(--lc-type-body-sm)] text-[var(--lc-text-secondary)]">
          Features & amenities
        </p>
        <p className="mb-3 text-[length:var(--lc-type-caption)] text-[var(--lc-text-muted)]">
          Tap all that apply — buyers filter by these.
        </p>
        <div className="flex flex-wrap gap-2">
          {FEATURE_CHIPS.map((chip) => {
            const selected = form.amenities.includes(chip)
            return (
              <button
                key={chip}
                type="button"
                aria-pressed={selected}
                onClick={() => toggleAmenity(chip)}
                className={cn(
                  'inline-flex min-h-[var(--lc-tap-target-min)] items-center gap-1 rounded-[var(--lc-radius-pill)]',
                  'border px-3 text-[length:var(--lc-type-body-sm)]',
                  selected
                    ? 'border-transparent bg-[var(--lc-action-primary)] text-[var(--lc-action-primary-text)]'
                    : 'border-[var(--lc-border)] bg-[var(--lc-surface-sunken)] text-[var(--lc-text-secondary)]',
                )}
              >
                {selected && <Check className="h-3.5 w-3.5" aria-hidden />}
                {chip}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

const selectClass = cn(
  'mt-1 flex h-10 w-full rounded-[var(--lc-radius-md)] border border-[var(--lc-border-strong)]',
  'bg-[var(--lc-surface-raised)] px-3 text-sm text-[var(--lc-text-primary)]',
)
