import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Numeric } from '@/components/ui/numeric'
import { cn } from '@/lib/utils'
import { SUPPORTED_MARKETS, normalizeCountryToIso2 } from '@/lib/listingVerification'
import { PropertyVerificationSection } from './PropertyVerificationSection'
import { CURRENCIES, type ComposerFormState } from './types'

export interface StepBasicsProps {
  form: ComposerFormState
  errors: Record<string, string>
  onChange: <K extends keyof ComposerFormState>(key: K, value: ComposerFormState[K]) => void
  showWhatsAppNudge?: boolean
  onWhatsAppNudge?: () => void
}

export function StepBasics({
  form,
  errors,
  onChange,
  showWhatsAppNudge,
  onWhatsAppNudge,
}: StepBasicsProps) {
  const normalizedCode = form.country_code || normalizeCountryToIso2(form.country)
  const countrySelectValue = normalizedCode || (form.country ? 'other' : '')
  const isOther = countrySelectValue === 'other'

  function handleCountry(e: React.ChangeEvent<HTMLSelectElement>) {
    const v = e.target.value
    if (v === 'other') {
      onChange('country_code', '')
      return
    }
    if (!v) {
      onChange('country_code', '')
      onChange('country', '')
      return
    }
    onChange('country_code', v)
    const label = SUPPORTED_MARKETS.find((m) => m.code === v)?.label || v
    onChange('country', label)
  }

  return (
    <div className="space-y-[var(--lc-space-xl)]">
      {showWhatsAppNudge && (
        <button
          type="button"
          onClick={onWhatsAppNudge}
          className="text-start text-[length:var(--lc-type-body-sm)] text-[var(--lc-text-brand)] underline-offset-2 hover:underline"
        >
          Prefer to talk it out? Use WhatsApp intake →
        </button>
      )}

      <fieldset>
        <legend className="mb-2 text-[length:var(--lc-type-body-sm)] text-[var(--lc-text-secondary)]">
          I&apos;m listing this for <span className="text-[var(--lc-status-danger-fg)]">*</span>
        </legend>
        <div className="inline-flex rounded-[var(--lc-radius-md)] border border-[var(--lc-border)] p-0.5">
          {(['sale', 'rent'] as const).map((t) => (
            <button
              key={t}
              type="button"
              aria-pressed={form.type === t}
              onClick={() => onChange('type', t)}
              className={cn(
                'min-h-[var(--lc-tap-target-min)] rounded-[var(--lc-radius-md)] px-4 capitalize',
                form.type === t
                  ? 'bg-[var(--lc-action-primary)] text-[var(--lc-action-primary-text)]'
                  : 'bg-[var(--lc-surface-sunken)] text-[var(--lc-text-secondary)]',
              )}
            >
              {t === 'sale' ? 'Sale' : 'Rent'}
            </button>
          ))}
        </div>
      </fieldset>

      <div>
        <Label htmlFor="composer-purpose">Deal purpose</Label>
        <select
          id="composer-purpose"
          className={selectClass}
          value={form.purpose}
          onChange={(e) => onChange('purpose', e.target.value)}
        >
          <option value="primary">Primary residence</option>
          <option value="investment">Investment</option>
          <option value="offplan">Off-plan</option>
          <option value="commercial">Commercial</option>
        </select>
      </div>

      <div>
        <Label htmlFor="composer-country">
          Country <span className="text-[var(--lc-status-danger-fg)]">*</span>
        </Label>
        <p className="mb-1 text-[length:var(--lc-type-caption)] text-[var(--lc-text-muted)]">
          Where the property is located. This drives the verification required to publish
          (Trakheesi in UAE, Fal in KSA, none in Lebanon, etc.)
        </p>
        <select id="composer-country" className={selectClass} value={countrySelectValue} onChange={handleCountry}>
          <option value="">Select…</option>
          {SUPPORTED_MARKETS.map((m) => (
            <option key={m.code} value={m.code}>
              {m.label}
            </option>
          ))}
          <option value="other">Other</option>
        </select>
        {isOther && (
          <Input
            id="composer-country-other"
            className="mt-2"
            value={form.country}
            onChange={(e) => onChange('country', e.target.value)}
            placeholder="e.g. Turkey, Cyprus, United Kingdom"
          />
        )}
      </div>

      <div>
        <Label htmlFor="composer-area">
          Area / neighborhood <span className="text-[var(--lc-status-danger-fg)]">*</span>
        </Label>
        <Input
          id="composer-area"
          value={form.location}
          onChange={(e) => onChange('location', e.target.value)}
          placeholder="e.g. Dubai Marina, Hamra, New Cairo"
          aria-invalid={Boolean(errors.location)}
        />
        {errors.location && (
          <p className="mt-1 text-[length:var(--lc-type-caption)] text-[var(--lc-status-danger-fg)]">
            {errors.location}
          </p>
        )}
      </div>

      <div>
        <Label htmlFor="composer-address">Building or street (optional)</Label>
        <Input
          id="composer-address"
          value={form.address}
          onChange={(e) => onChange('address', e.target.value)}
        />
        <label className="mt-2 flex items-center gap-2 text-[length:var(--lc-type-body-sm)]">
          <input
            type="checkbox"
            checked={form.show_exact_address}
            onChange={(e) => onChange('show_exact_address', e.target.checked)}
          />
          Show exact address on the public listing
        </label>
      </div>

      <div>
        <Label htmlFor="composer-price">
          Asking price <span className="text-[var(--lc-status-danger-fg)]">*</span>
        </Label>
        <div className="flex flex-wrap gap-2">
          <Input
            id="composer-price"
            inputMode="decimal"
            value={form.price}
            onChange={(e) => onChange('price', e.target.value.replace(/[^\d.]/g, ''))}
            placeholder="e.g. 2400000"
            className="min-w-[8rem] flex-1 font-[family-name:var(--lc-font-mono)]"
            aria-invalid={Boolean(errors.price)}
          />
          <div
            role="group"
            aria-label="Currency"
            className="inline-flex flex-wrap rounded-[var(--lc-radius-md)] border border-[var(--lc-border)] p-0.5"
          >
            {CURRENCIES.map((c) => (
              <button
                key={c}
                type="button"
                aria-pressed={form.currency === c}
                onClick={() => onChange('currency', c)}
                className={cn(
                  'min-h-tap rounded-[var(--lc-radius-md)] px-2.5 text-[length:var(--lc-type-caption)]',
                  form.currency === c
                    ? 'bg-[var(--lc-action-primary)] text-[var(--lc-action-primary-text)]'
                    : 'text-[var(--lc-text-secondary)]',
                )}
              >
                <Numeric>{c}</Numeric>
              </button>
            ))}
          </div>
        </div>
        {form.type === 'rent' && (
          <div className="mt-2 inline-flex rounded-[var(--lc-radius-md)] border border-[var(--lc-border)] p-0.5">
            {(['month', 'year'] as const).map((u) => (
              <button
                key={u}
                type="button"
                aria-pressed={form.price_unit === u}
                onClick={() => onChange('price_unit', u)}
                className={cn(
                  'min-h-tap rounded-[var(--lc-radius-md)] px-3 text-[length:var(--lc-type-caption)]',
                  form.price_unit === u
                    ? 'bg-[var(--lc-action-primary)] text-[var(--lc-action-primary-text)]'
                    : 'text-[var(--lc-text-secondary)]',
                )}
              >
                per {u}
              </button>
            ))}
          </div>
        )}
        {errors.price && (
          <p className="mt-1 text-[length:var(--lc-type-caption)] text-[var(--lc-status-danger-fg)]">
            {errors.price}
          </p>
        )}
      </div>

      <PropertyVerificationSection form={form} errors={errors} onChange={onChange} />
    </div>
  )
}

const selectClass = cn(
  'mt-1 flex h-10 w-full rounded-[var(--lc-radius-md)] border border-[var(--lc-border-strong)]',
  'bg-[var(--lc-surface-raised)] px-3 text-sm text-[var(--lc-text-primary)]',
)
