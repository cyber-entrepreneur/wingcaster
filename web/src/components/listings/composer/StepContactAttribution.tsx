import { Building2, Eye, EyeOff, Globe, Lock, User } from 'lucide-react'
import { cn } from '@/lib/utils'
import type {
  ComposerFormState,
  ContactChannel,
  ListingOwnerChoice,
  VisibilityChoice,
} from './types'

export interface StepContactAttributionProps {
  form: ComposerFormState
  errors: Record<string, string>
  onChange: <K extends keyof ComposerFormState>(key: K, value: ComposerFormState[K]) => void
  isAgency?: boolean
  agencyName?: string
}

const CHANNELS: { id: ContactChannel; label: string }[] = [
  { id: 'whatsapp', label: 'WhatsApp' },
  { id: 'call', label: 'Call' },
  { id: 'sms', label: 'SMS' },
  { id: 'email', label: 'Email' },
  { id: 'in_app', label: 'In-app message' },
]

export function StepContactAttribution({
  form,
  errors,
  onChange,
  isAgency = false,
  agencyName = 'your agency',
}: StepContactAttributionProps) {
  function toggleChannel(id: ContactChannel) {
    const next = form.contact_channels.includes(id)
      ? form.contact_channels.filter((c) => c !== id)
      : [...form.contact_channels, id]
    onChange('contact_channels', next)
  }

  return (
    <div className="space-y-[var(--lc-space-xl)]">
      {isAgency && (
        <fieldset>
          <legend className="mb-2 text-[length:var(--lc-type-body-sm)] text-[var(--lc-text-secondary)]">
            This listing is
          </legend>
          <div className="space-y-2" role="radiogroup" aria-label="Listing owner">
            {(
              [
                {
                  id: 'agency' as ListingOwnerChoice,
                  title: 'Agency-owned',
                  body: `belongs to ${agencyName}. Stays with the agency if you leave.`,
                  Icon: Building2,
                },
                {
                  id: 'self' as ListingOwnerChoice,
                  title: 'My own',
                  body: 'belongs to me personally. Comes with me if I leave the agency.',
                  Icon: User,
                },
                {
                  id: 'review' as ListingOwnerChoice,
                  title: 'Not sure yet',
                  body: 'flag for review with my agency.',
                  Icon: Eye,
                },
              ] as const
            ).map(({ id, title, body, Icon }) => {
              const selected = form.listing_owner === id
              return (
                <button
                  key={id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => {
                    onChange('listing_owner', id)
                    onChange('agency_tied', id === 'agency')
                  }}
                  className={cn(
                    'flex w-full gap-3 rounded-[var(--lc-radius-lg)] p-4 text-start',
                    'border bg-[var(--lc-surface-raised)]',
                    selected
                      ? 'border-2 border-[var(--lc-action-primary)] bg-[var(--lc-surface-sunken)]'
                      : 'border-[var(--lc-border)]',
                  )}
                >
                  <Icon className="mt-0.5 h-5 w-5 shrink-0 text-[var(--lc-text-secondary)]" />
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
      )}

      <fieldset>
        <legend className="mb-1 text-[length:var(--lc-type-body-sm)] text-[var(--lc-text-secondary)]">
          How can buyers reach you?
        </legend>
        <p className="mb-3 text-[length:var(--lc-type-caption)] text-[var(--lc-text-muted)]">
          We recommend keeping at least WhatsApp on — MENA buyers overwhelmingly prefer it.
        </p>
        <div className="flex flex-wrap gap-2">
          {CHANNELS.map(({ id, label }) => {
            const on = form.contact_channels.includes(id)
            return (
              <button
                key={id}
                type="button"
                aria-pressed={on}
                onClick={() => toggleChannel(id)}
                className={cn(
                  'min-h-[var(--lc-tap-target-min)] rounded-[var(--lc-radius-pill)] border px-3',
                  'text-[length:var(--lc-type-body-sm)]',
                  on
                    ? 'border-transparent bg-[var(--lc-action-primary)] text-[var(--lc-action-primary-text)]'
                    : 'border-[var(--lc-border)] bg-[var(--lc-surface-sunken)] text-[var(--lc-text-secondary)]',
                )}
              >
                {label}
              </button>
            )
          })}
        </div>
        {errors.contact_channels && (
          <p className="mt-2 text-[length:var(--lc-type-caption)] text-[var(--lc-status-danger-fg)]">
            {errors.contact_channels}
          </p>
        )}
      </fieldset>

      <fieldset>
        <legend className="mb-2 text-[length:var(--lc-type-body-sm)] text-[var(--lc-text-secondary)]">
          Who can see this listing?
        </legend>
        <div className="space-y-2" role="radiogroup" aria-label="Visibility">
          {(
            [
              {
                id: 'public' as VisibilityChoice,
                title: 'Public',
                body: 'appears on portals, Bazaar, and your public profile.',
                Icon: Globe,
              },
              {
                id: 'private' as VisibilityChoice,
                title: 'Private',
                body: 'visible only to you. Useful for pocket listings and pre-market prep.',
                Icon: Lock,
              },
              {
                id: 'white-label' as VisibilityChoice,
                title: 'White-label only',
                body: "appears on your agency's white-label site + private profile, NOT on public portals or Bazaar.",
                Icon: EyeOff,
              },
            ] as const
          ).map(({ id, title, body, Icon }) => {
            const selected = form.visibility === id
            return (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => onChange('visibility', id)}
                className={cn(
                  'flex w-full gap-3 rounded-[var(--lc-radius-lg)] p-4 text-start',
                  'border bg-[var(--lc-surface-raised)]',
                  selected
                    ? 'border-2 border-[var(--lc-action-primary)] bg-[var(--lc-surface-sunken)]'
                    : 'border-[var(--lc-border)]',
                )}
              >
                <Icon className="mt-0.5 h-5 w-5 shrink-0 text-[var(--lc-text-secondary)]" />
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

      {form.visibility === 'public' && (
        <label className="flex items-start gap-3 rounded-[var(--lc-radius-lg)] border border-[var(--lc-border)] p-4">
          <input
            type="checkbox"
            className="mt-1"
            checked={form.marketplace_syndicated}
            onChange={(e) => onChange('marketplace_syndicated', e.target.checked)}
          />
          <span>
            <span className="block font-medium text-[var(--lc-text-heading)]">
              Syndicate to Real Estate Bazaar
            </span>
            <span className="text-[length:var(--lc-type-body-sm)] text-[var(--lc-text-muted)]">
              Bazaar is our consumer marketplace. Turning this on adds one more channel where buyers
              find you — free while in beta.
            </span>
          </span>
        </label>
      )}
    </div>
  )
}
