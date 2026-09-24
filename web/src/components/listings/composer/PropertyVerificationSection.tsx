import { Building2, UserCheck } from 'lucide-react'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { VerificationBadge } from '@/components/listings/VerificationBadge'
import {
  deriveVerificationStatus,
  gatePolicyFor,
  normalizeCountryToIso2,
  verificationCaptureFor,
  type CredentialField,
  type ListingRole,
  type RepresentsType,
} from '@/lib/listingVerification'
import type { ComposerFormState } from './types'

export interface PropertyVerificationSectionProps {
  form: ComposerFormState
  errors: Record<string, string>
  onChange: <K extends keyof ComposerFormState>(key: K, value: ComposerFormState[K]) => void
}

const POLICY_NOTE: Record<'hard' | 'soft' | 'none', string> = {
  hard: 'This market enforces an advertising permit by law — the permit below is required before you can publish.',
  soft: 'No advertising permit is required here. Add the references below to earn a verification badge buyers can trust.',
  none: 'No listing verification is required in this market.',
}

export function PropertyVerificationSection({
  form,
  errors,
  onChange,
}: PropertyVerificationSectionProps) {
  const code = form.country_code || normalizeCountryToIso2(form.country)
  const policy = gatePolicyFor(code)
  const capture = verificationCaptureFor(code)
  const status = deriveVerificationStatus(code, form.verification)

  const setRole = (role: ListingRole) => {
    onChange('listing_role', role)
    if (role === 'principal') {
      onChange('represents_type', '')
      onChange('represents_name', '')
    }
  }
  const setVerification = (key: string, value: string) => {
    onChange('verification', { ...form.verification, [key]: value })
  }

  return (
    <div className="space-y-[var(--lc-space-xl)] rounded-[var(--lc-radius-lg)] border border-[var(--lc-border)] bg-[var(--lc-surface-raised)] p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-[length:var(--lc-type-body-lg)] font-semibold text-[var(--lc-text-heading)]">
          Authorization &amp; verification
        </h2>
        {policy !== 'none' && <VerificationBadge status={status} />}
      </div>

      {/* Role — principal vs referral */}
      <fieldset>
        <legend className="mb-2 text-[length:var(--lc-type-body-sm)] text-[var(--lc-text-secondary)]">
          Your role on this property <span className="text-[var(--lc-status-danger-fg)]">*</span>
        </legend>
        <div className="space-y-2" role="radiogroup" aria-label="Your role on this property">
          {(
            [
              {
                id: 'principal' as ListingRole,
                title: 'Principal',
                body: 'I hold the mandate/licence to sell this property directly.',
                Icon: UserCheck,
              },
              {
                id: 'referral' as ListingRole,
                title: 'Referral',
                body: 'I’m selling on behalf of a licensed principal (e.g. a developer or another brokerage).',
                Icon: Building2,
              },
            ] as const
          ).map(({ id, title, body, Icon }) => {
            const selected = form.listing_role === id
            return (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setRole(id)}
                className={cn(
                  'flex w-full gap-3 rounded-[var(--lc-radius-lg)] p-4 text-start',
                  'border bg-[var(--lc-surface)]',
                  selected
                    ? 'border-2 border-[var(--lc-action-primary)] bg-[var(--lc-surface-sunken)]'
                    : 'border-[var(--lc-border)]',
                )}
              >
                <Icon className="mt-0.5 h-5 w-5 shrink-0 text-[var(--lc-text-secondary)]" aria-hidden />
                <span>
                  <span className="block font-semibold text-[var(--lc-text-heading)]">{title}</span>
                  <span className="text-[length:var(--lc-type-body-sm)] text-[var(--lc-text-muted)]">
                    {body}
                  </span>
                </span>
              </button>
            )
          })}
        </div>
      </fieldset>

      {form.listing_role === 'referral' && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="composer-represents-type">Who you represent</Label>
            <select
              id="composer-represents-type"
              className={selectClass}
              value={form.represents_type}
              onChange={(e) => onChange('represents_type', e.target.value as RepresentsType | '')}
            >
              <option value="">Select…</option>
              <option value="developer">Developer</option>
              <option value="brokerage">Licensed brokerage</option>
            </select>
          </div>
          <div>
            <Label htmlFor="composer-represents-name">Their name</Label>
            <Input
              id="composer-represents-name"
              value={form.represents_name}
              onChange={(e) => onChange('represents_name', e.target.value)}
              placeholder="e.g. Aldar Properties"
            />
          </div>
        </div>
      )}

      {/* Property verification — driven by where the property is */}
      <div>
        <p className="mb-1 text-[length:var(--lc-type-body-sm)] font-medium text-[var(--lc-text-heading)]">
          Property verification
        </p>
        {!code ? (
          <p className="text-[length:var(--lc-type-caption)] text-[var(--lc-text-muted)]">
            Select the property’s country (above) to see what’s required.
          </p>
        ) : (
          <>
            <p className="mb-3 text-[length:var(--lc-type-caption)] text-[var(--lc-text-muted)]">
              {POLICY_NOTE[policy]}
            </p>
            <div className="space-y-4">
              {capture.permit.map((field) =>
                renderField(field, form, errors, setVerification, policy === 'hard' && Boolean(field.required)),
              )}
              {[...capture.authorization, ...capture.ownership].map((field) =>
                renderField(field, form, errors, setVerification, false),
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function renderField(
  field: CredentialField,
  form: ComposerFormState,
  errors: Record<string, string>,
  setVerification: (key: string, value: string) => void,
  required: boolean,
) {
  const value = form.verification[field.key] ?? ''
  const errKey = `verification.${field.key}`
  return (
    <div key={field.key}>
      <Label htmlFor={`composer-verify-${field.key}`}>
        {field.label}
        {required && <span className="text-[var(--lc-status-danger-fg)]"> *</span>}
      </Label>
      {field.help && (
        <p className="mb-1 text-[length:var(--lc-type-caption)] text-[var(--lc-text-muted)]">
          {field.help}
        </p>
      )}
      <Input
        id={`composer-verify-${field.key}`}
        value={value}
        onChange={(e) => setVerification(field.key, e.target.value)}
        placeholder={field.placeholder}
        aria-invalid={Boolean(errors[errKey])}
      />
      {errors[errKey] && (
        <p className="mt-1 text-[length:var(--lc-type-caption)] text-[var(--lc-status-danger-fg)]">
          {errors[errKey]}
        </p>
      )}
    </div>
  )
}

const selectClass = cn(
  'mt-1 flex h-10 w-full rounded-[var(--lc-radius-md)] border border-[var(--lc-border-strong)]',
  'bg-[var(--lc-surface-raised)] px-3 text-sm text-[var(--lc-text-primary)]',
)
