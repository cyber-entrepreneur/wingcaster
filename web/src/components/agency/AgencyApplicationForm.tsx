import { useId, useMemo, useState, type FormEvent } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Numeric } from '@/components/ui/numeric'
import { GuestSignupCollapsible, isGuestSignupValid } from '@/components/agency/GuestSignupCollapsible'
import {
  EMPTY_IDENTITY_FORM_VALUES,
  type IdentityFormValues,
} from '@/components/forms'
import { cn } from '@/lib/utils'
import type { AgencyApplicationAvailability, AgencyApplicationBody } from '@/api/agencyApply'

export const REFERRAL_OPTIONS = [
  { value: 'bazaar', label: 'WingCaster Bazaar' },
  { value: 'olx', label: 'OLX' },
  { value: 'property_finder', label: 'Property Finder' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'referral', label: 'Referral from a friend' },
  { value: 'direct', label: 'Direct link' },
  { value: 'direct_invitation', label: 'Direct invitation' },
  { value: 'other', label: 'Other' },
] as const

export type ReferralValue = (typeof REFERRAL_OPTIONS)[number]['value']

export const AVAILABILITY_OPTIONS: { value: AgencyApplicationAvailability; label: string }[] = [
  { value: 'immediately', label: 'Immediately' },
  { value: 'within_2_weeks', label: 'Within 2 weeks' },
  { value: 'within_a_month', label: 'Within a month' },
  { value: 'just_exploring', label: 'Just exploring' },
]

/** Map `?ref=` query values onto referral_source enum values. */
export function mapRefQueryToReferral(ref: string | null | undefined): ReferralValue | '' {
  if (!ref) return ''
  const key = ref.trim().toLowerCase()
  const aliases: Record<string, ReferralValue> = {
    bazaar: 'bazaar',
    wingcaster: 'bazaar',
    olx: 'olx',
    pf: 'property_finder',
    propertyfinder: 'property_finder',
    property_finder: 'property_finder',
    instagram: 'instagram',
    ig: 'instagram',
    referral: 'referral',
    friend: 'referral',
    direct: 'direct',
    whatsapp: 'direct',
    invitation: 'direct_invitation',
    direct_invitation: 'direct_invitation',
    other: 'other',
  }
  return aliases[key] ?? 'other'
}

export type AgencyApplicationFormProps = {
  agencyName: string
  signedIn: boolean
  signedInDisplayName?: string
  signedInEmail?: string | null
  /** Invitation path hides referral UI and forces direct_invitation. */
  invitationMode?: boolean
  initialReferral?: ReferralValue | ''
  otherAgencyName?: string | null
  offline?: boolean
  submitting?: boolean
  guestValues: IdentityFormValues
  onGuestValuesChange: (next: IdentityFormValues) => void
  guestOpen: boolean
  onGuestOpenChange: (open: boolean) => void
  onCancel: () => void
  onSubmit: (body: AgencyApplicationBody) => void | Promise<void>
  className?: string
}

export function AgencyApplicationForm({
  agencyName,
  signedIn,
  signedInDisplayName,
  signedInEmail,
  invitationMode = false,
  initialReferral = '',
  otherAgencyName,
  offline = false,
  submitting = false,
  guestValues,
  onGuestValuesChange,
  guestOpen,
  onGuestOpenChange,
  onCancel,
  onSubmit,
  className,
}: AgencyApplicationFormProps) {
  const formId = useId()
  const [message, setMessage] = useState('')
  const [listings, setListings] = useState('')
  const [portfolio, setPortfolio] = useState('')
  const [availability, setAvailability] = useState<AgencyApplicationAvailability | ''>('')
  const [referral, setReferral] = useState<ReferralValue | ''>(
    invitationMode ? 'direct_invitation' : initialReferral,
  )
  const [referralLocked, setReferralLocked] = useState(
    Boolean(!invitationMode && initialReferral),
  )
  const [consentTerms, setConsentTerms] = useState(false)
  const [consentShare, setConsentShare] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [charAnnounce, setCharAnnounce] = useState('')

  const messageLen = message.length
  const counterHot = messageLen >= 480

  const identityReady = signedIn || (guestOpen && isGuestSignupValid(guestValues))

  const formReady = useMemo(() => {
    if (offline || submitting) return false
    if (!identityReady) return false
    if (!message.trim()) return false
    if (!availability) return false
    if (!consentTerms || !consentShare) return false
    if (listings !== '') {
      const n = Number(listings)
      if (!Number.isFinite(n) || n < 0 || n > 500) return false
    }
    if (portfolio.trim()) {
      try {
        // eslint-disable-next-line no-new
        new URL(portfolio.trim())
      } catch {
        return false
      }
    }
    return true
  }, [
    offline,
    submitting,
    identityReady,
    message,
    availability,
    consentTerms,
    consentShare,
    listings,
    portfolio,
  ])

  const onMessageChange = (value: string) => {
    const next = value.slice(0, 500)
    setMessage(next)
    if (next.length > 0 && next.length % 25 === 0) {
      setCharAnnounce(`${next.length} of 500 characters`)
    }
  }

  const validate = (): boolean => {
    const errors: Record<string, string> = {}
    if (!signedIn && !guestOpen) {
      errors.guest = 'Sign in or continue as guest to submit.'
    } else if (!signedIn && !isGuestSignupValid(guestValues)) {
      errors.guest = 'Complete your guest account details.'
    }
    if (!message.trim()) errors.message = 'Required.'
    if (!availability) errors.availability = 'Required.'
    if (!consentTerms) errors.consentTerms = 'Required.'
    if (!consentShare) errors.consentShare = 'Required.'
    if (listings !== '') {
      const n = Number(listings)
      if (!Number.isFinite(n) || n < 0 || n > 500) {
        errors.listings = 'Enter a number between 0 and 500.'
      }
    }
    if (portfolio.trim()) {
      try {
        // eslint-disable-next-line no-new
        new URL(portfolio.trim())
      } catch {
        errors.portfolio = 'Enter a valid URL.'
      }
    }
    setFieldErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    if (!validate()) return

    const body: AgencyApplicationBody = {
      message: message.trim(),
      availability: availability as AgencyApplicationAvailability,
      referral_source: invitationMode
        ? 'direct_invitation'
        : referral || undefined,
      consents: {
        terms: true,
        profile_share: true,
      },
      locale: typeof document !== 'undefined' ? document.documentElement.lang || 'en' : 'en',
    }
    if (listings !== '') {
      body.current_listings_count = Number(listings)
    }
    if (portfolio.trim()) {
      body.portfolio_url = portfolio.trim()
    }
    void onSubmit(body)
  }

  const fieldsDisabled = submitting || offline || (!signedIn && !guestOpen)
  const referralLabel =
    REFERRAL_OPTIONS.find((o) => o.value === referral)?.label ?? referral

  return (
    <form
      className={cn('flex flex-col gap-[var(--lc-space-lg)]', className)}
      onSubmit={handleSubmit}
      noValidate
      aria-busy={submitting || undefined}
    >
      <h2
        id={`${formId}-heading`}
        className="text-[var(--lc-text-heading)]"
        style={{ font: 'var(--lc-type-heading-3)' }}
      >
        Your application
      </h2>

      {otherAgencyName ? (
        <p
          className="rounded-[var(--lc-radius-md)] bg-[var(--lc-surface-sunken)] px-[var(--lc-space-md)] py-[var(--lc-space-sm)] text-[var(--lc-text-secondary)]"
          style={{ font: 'var(--lc-type-body-sm)' }}
          role="status"
        >
          You&apos;re currently a member of {otherAgencyName}. Applying here does not remove you
          from that agency.
        </p>
      ) : null}

      {offline ? (
        <p
          className="rounded-[var(--lc-radius-md)] bg-[var(--lc-status-unpublished-bg)] px-[var(--lc-space-md)] py-[var(--lc-space-sm)] text-[var(--lc-status-unpublished-fg)]"
          role="alert"
          style={{ font: 'var(--lc-type-body-sm)' }}
        >
          You&apos;re offline. Reconnect to send your application.
        </p>
      ) : null}

      {signedIn ? (
        <div
          className="rounded-[var(--lc-radius-md)] bg-[var(--lc-surface-sunken)] px-[var(--lc-space-md)] py-[var(--lc-space-sm)]"
          style={{ font: 'var(--lc-type-body-sm)' }}
        >
          <span className="text-[var(--lc-text-secondary)]">Applying as </span>
          <span className="font-semibold text-[var(--lc-text-heading)]">
            {signedInDisplayName || 'You'}
          </span>
          {signedInEmail ? (
            <span className="text-[var(--lc-text-muted)]"> · {signedInEmail}</span>
          ) : null}
        </div>
      ) : (
        <div>
          <GuestSignupCollapsible
            open={guestOpen}
            onOpenChange={onGuestOpenChange}
            values={guestValues}
            onChange={onGuestValuesChange}
            disabled={submitting}
          />
          {fieldErrors.guest ? (
            <p className="mt-1 text-[var(--lc-status-unpublished-fg)]" style={{ font: 'var(--lc-type-caption)' }}>
              {fieldErrors.guest}
            </p>
          ) : null}
          {!guestOpen ? (
            <p className="mt-2 text-[var(--lc-text-muted)]" style={{ font: 'var(--lc-type-caption)' }}>
              Sign in to submit your application — or expand guest signup above.
            </p>
          ) : null}
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${formId}-message`} className="text-[var(--lc-text-secondary)]" style={{ font: 'var(--lc-type-overline)' }}>
          Message to the agency
        </Label>
        <p id={`${formId}-message-help`} className="text-[var(--lc-text-muted)]" style={{ font: 'var(--lc-type-caption)' }}>
          Tell them why you&apos;d like to join — what you specialize in, where you sell most, and
          what you&apos;re looking for in an agency.
        </p>
        <textarea
          id={`${formId}-message`}
          rows={4}
          maxLength={500}
          disabled={fieldsDisabled}
          value={message}
          placeholder="I've been selling residential in Dubai Marina for 3 years…"
          aria-invalid={fieldErrors.message ? true : undefined}
          aria-describedby={`${formId}-message-help ${formId}-message-count`}
          onChange={(e) => onMessageChange(e.target.value)}
          className={cn(
            'min-h-[7rem] w-full rounded-[var(--lc-radius-md)] border border-[var(--lc-border-strong)]',
            'bg-[var(--lc-surface)] px-3 py-2 text-[var(--lc-text-primary)]',
            'placeholder:text-[var(--lc-text-muted)] disabled:opacity-50',
          )}
          style={{ font: 'var(--lc-type-body)' }}
        />
        <div className="flex justify-end gap-2">
          <span
            id={`${formId}-message-count`}
            className={cn(counterHot ? 'text-[var(--lc-text-brand)]' : 'text-[var(--lc-text-muted)]')}
            style={{ font: 'var(--lc-type-caption)' }}
          >
            <Numeric>{messageLen}</Numeric> / 500
          </span>
          <span className="sr-only" aria-live="polite">
            {charAnnounce}
          </span>
        </div>
        {fieldErrors.message ? (
          <p className="text-[var(--lc-status-unpublished-fg)]" style={{ font: 'var(--lc-type-caption)' }}>
            {fieldErrors.message}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${formId}-listings`} className="text-[var(--lc-text-secondary)]" style={{ font: 'var(--lc-type-overline)' }}>
          How many active listings do you have today?
        </Label>
        <p id={`${formId}-listings-help`} className="text-[var(--lc-text-muted)]" style={{ font: 'var(--lc-type-caption)' }}>
          Approximate is fine.
        </p>
        <Input
          id={`${formId}-listings`}
          type="number"
          inputMode="numeric"
          min={0}
          max={500}
          dir="ltr"
          disabled={fieldsDisabled}
          value={listings}
          aria-invalid={fieldErrors.listings ? true : undefined}
          aria-describedby={`${formId}-listings-help`}
          onChange={(e) => setListings(e.target.value)}
          className="max-w-[12rem] font-[family-name:var(--lc-font-mono)] tabular-nums"
        />
        {fieldErrors.listings ? (
          <p className="text-[var(--lc-status-unpublished-fg)]" style={{ font: 'var(--lc-type-caption)' }}>
            {fieldErrors.listings}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${formId}-portfolio`} className="text-[var(--lc-text-secondary)]" style={{ font: 'var(--lc-type-overline)' }}>
          Portfolio or profile link (optional)
        </Label>
        <Input
          id={`${formId}-portfolio`}
          type="url"
          inputMode="url"
          dir="ltr"
          disabled={fieldsDisabled}
          value={portfolio}
          placeholder="https://instagram.com/your.handle"
          aria-invalid={fieldErrors.portfolio ? true : undefined}
          onChange={(e) => setPortfolio(e.target.value)}
        />
        {fieldErrors.portfolio ? (
          <p className="text-[var(--lc-status-unpublished-fg)]" style={{ font: 'var(--lc-type-caption)' }}>
            {fieldErrors.portfolio}
          </p>
        ) : null}
      </div>

      <fieldset className="border-0 p-0">
        <legend
          className="mb-2 text-[var(--lc-text-secondary)]"
          style={{ font: 'var(--lc-type-overline)' }}
        >
          When can you start?
        </legend>
        <div
          role="radiogroup"
          aria-label="When can you start?"
          className="flex flex-col gap-2 md:flex-row md:flex-wrap"
        >
          {AVAILABILITY_OPTIONS.map((opt) => {
            const selected = availability === opt.value
            return (
              <label
                key={opt.value}
                className={cn(
                  'flex min-h-[var(--lc-tap-target-min)] cursor-pointer items-center gap-2 rounded-[var(--lc-radius-md)] px-3',
                  selected
                    ? 'border-2 border-[var(--lc-action-primary)] bg-[var(--lc-surface-sunken)]'
                    : 'border border-[var(--lc-border)] bg-[var(--lc-surface)]',
                  fieldsDisabled ? 'opacity-50' : null,
                )}
              >
                <input
                  type="radio"
                  name={`${formId}-availability`}
                  value={opt.value}
                  checked={selected}
                  disabled={fieldsDisabled}
                  className="sr-only"
                  onChange={() => setAvailability(opt.value)}
                />
                <span style={{ font: 'var(--lc-type-body-sm)' }}>{opt.label}</span>
              </label>
            )
          })}
        </div>
        {fieldErrors.availability ? (
          <p className="mt-1 text-[var(--lc-status-unpublished-fg)]" style={{ font: 'var(--lc-type-caption)' }}>
            {fieldErrors.availability}
          </p>
        ) : null}
      </fieldset>

      {!invitationMode ? (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${formId}-referral`} className="text-[var(--lc-text-secondary)]" style={{ font: 'var(--lc-type-overline)' }}>
            Where did you hear about {agencyName}?
          </Label>
          {referralLocked && referral ? (
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                variant="secondary"
                className="rounded-[var(--lc-radius-pill)] bg-[var(--lc-surface-sunken)] text-[var(--lc-text-secondary)]"
              >
                {referralLabel}
              </Badge>
              <button
                type="button"
                className="min-h-[var(--lc-tap-target-min)] text-[var(--lc-text-brand)] underline-offset-2 hover:underline"
                style={{ font: 'var(--lc-type-body-sm)' }}
                disabled={fieldsDisabled}
                onClick={() => setReferralLocked(false)}
              >
                Change
              </button>
            </div>
          ) : (
            <select
              id={`${formId}-referral`}
              disabled={fieldsDisabled}
              value={referral}
              onChange={(e) => setReferral(e.target.value as ReferralValue | '')}
              className={cn(
                'min-h-[var(--lc-tap-target-min)] w-full rounded-[var(--lc-radius-md)] border border-[var(--lc-border-strong)]',
                'bg-[var(--lc-surface)] px-3 text-[var(--lc-text-primary)]',
              )}
            >
              <option value="">Select a source (optional)</option>
              {REFERRAL_OPTIONS.filter((o) => o.value !== 'direct_invitation').map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          )}
        </div>
      ) : null}

      <div className="mt-[var(--lc-space-sm)] flex flex-col gap-[var(--lc-space-sm)]">
        <label className="flex min-h-[var(--lc-tap-target-min)] cursor-pointer items-start gap-2">
          <input
            type="checkbox"
            className="mt-1 h-4 w-4 accent-[var(--lc-action-primary)]"
            checked={consentTerms}
            disabled={submitting}
            onChange={(e) => setConsentTerms(e.target.checked)}
          />
          <span style={{ font: 'var(--lc-type-body-sm)' }}>
            I agree to WingCaster&apos;s{' '}
            <a href="/terms" className="text-[var(--lc-text-brand)] underline-offset-2 hover:underline">
              Terms of Service
            </a>{' '}
            and{' '}
            <a href="/privacy" className="text-[var(--lc-text-brand)] underline-offset-2 hover:underline">
              Privacy Policy
            </a>
            .
            {!consentTerms ? (
              <span className="ms-1 text-[var(--lc-text-muted)]">Required.</span>
            ) : null}
          </span>
        </label>

        <label className="flex min-h-[var(--lc-tap-target-min)] cursor-pointer items-start gap-2">
          <input
            type="checkbox"
            className="mt-1 h-4 w-4 accent-[var(--lc-action-primary)]"
            checked={consentShare}
            disabled={submitting}
            onChange={(e) => setConsentShare(e.target.checked)}
          />
          <span style={{ font: 'var(--lc-type-body-sm)' }}>
            I consent to sharing my WingCaster profile (name, contact, existing listings) with{' '}
            {agencyName} for the purpose of this application.
            {!consentShare ? (
              <span className="ms-1 text-[var(--lc-text-muted)]">Required.</span>
            ) : null}
            <span className="mt-1 block text-[var(--lc-text-muted)]" style={{ font: 'var(--lc-type-caption)' }}>
              The agency sees only what they need to review your application. They can&apos;t act on
              your account.
            </span>
          </span>
        </label>
      </div>

      <div className="flex flex-col-reverse gap-[var(--lc-space-sm)] md:flex-row md:justify-end">
        <Button type="button" variant="ghost" size="lg" className="w-full md:w-auto" onClick={onCancel} disabled={false}>
          Cancel
        </Button>
        <Button
          type="submit"
          variant="default"
          size="lg"
          className="w-full md:w-auto"
          disabled={!formReady}
        >
          {submitting ? (
            <>
              <Loader2 className="me-2 h-4 w-4 animate-spin" aria-hidden />
              Sending your application…
            </>
          ) : (
            'Submit application →'
          )}
        </Button>
      </div>
    </form>
  )
}

export { EMPTY_IDENTITY_FORM_VALUES }
