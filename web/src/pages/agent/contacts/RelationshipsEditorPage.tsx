/**
 * AGT-CTC-007 — Contact relationships editor.
 * Consumes BE-BLOCKER-36 endpoints. Pending-only edit/delete; other rows are
 * PII-redacted and non-interactive.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowLeft,
  Building,
  Check,
  FileSignature,
  Handshake,
  Heart,
  Home,
  Loader2,
  Lock,
  Paperclip,
  Plus,
  ShoppingCart,
  Store,
} from 'lucide-react'
import { Drawer } from 'vaul'
import { api } from '@/api/client'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Numeric } from '@/components/ui/numeric'
import { useToast } from '@/components/ui/toast'
import { useAuth } from '@/context/AuthContext'
import { usePageTitle } from '@/lib/usePageTitle'
import { cn } from '@/lib/utils'
import { resolveLcStatus, type LcStatus } from '@/theme/status'
import type {
  ContactRelationship,
  ContactSummary,
  CreateRelationshipBody,
  Exclusivity,
  PartyType,
  RedactedRelationship,
  RelationshipScope,
  RelationshipStatus,
  RelationshipType,
} from './relationshipTypes'

const PROPERTY_TYPE_OPTIONS = ['apartment', 'villa', 'townhouse', 'commercial', 'land', 'mixed'] as const

const TYPE_META: Record<
  RelationshipType,
  { label: string; Glyph: typeof Handshake; className: string; body: string }
> = {
  representation: {
    label: 'Representation',
    Glyph: Handshake,
    className:
      'border-transparent bg-[var(--lc-status-published-bg)] text-[var(--lc-status-published-fg)]',
    body: 'I represent this contact in an ongoing agent capacity for buying/selling/leasing.',
  },
  mandate: {
    label: 'Mandate',
    Glyph: FileSignature,
    className:
      'border border-[var(--lc-accent-bold-edge)] bg-[var(--lc-accent-bold)] text-[var(--lc-accent-bold-text)]',
    body: 'A formal, time-bounded, signed mandate for a specific listing or search brief. Higher fiduciary duty.',
  },
  affinity: {
    label: 'Affinity',
    Glyph: Heart,
    className: 'border-transparent bg-[var(--lc-status-draft-bg)] text-[var(--lc-status-draft-fg)]',
    body: 'Informal preferred-agent relationship. No legal weight; used for lead-routing preference only.',
  },
}

const PARTY_META: Record<PartyType, { label: string; Glyph: typeof ShoppingCart }> = {
  buyer: { label: 'Buyer', Glyph: ShoppingCart },
  seller: { label: 'Seller', Glyph: Store },
  landlord: { label: 'Landlord', Glyph: Building },
  tenant: { label: 'Tenant', Glyph: Home },
}

const STATUS_LABEL: Record<RelationshipStatus, string> = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  active: 'Active',
  suspended: 'Suspended',
  ended: 'Ended',
  expired: 'Expired',
  rejected: 'Rejected',
}

function statusToLc(status: RelationshipStatus): LcStatus {
  switch (status) {
    case 'pending':
      return 'underOffer'
    case 'confirmed':
      return 'draft'
    case 'active':
      return 'published'
    case 'suspended':
      return 'archived'
    case 'ended':
      return 'closed'
    case 'expired':
      return 'archived'
    case 'rejected':
      return 'unpublished'
    default:
      return resolveLcStatus(status)
  }
}

function statusStripeVar(status: RelationshipStatus): string {
  return `var(--lc-status-${statusToLc(status)}-dot)`
}

function monogram(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase()
  return `${parts[0]![0] ?? ''}${parts[1]![0] ?? ''}`.toUpperCase()
}

function formatDay(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

function monthsLeft(endsAt: string | null): string | null {
  if (!endsAt) return null
  const end = new Date(endsAt).getTime()
  if (Number.isNaN(end)) return null
  const diff = end - Date.now()
  if (diff <= 0) return 'ended'
  const months = Math.max(1, Math.round(diff / (30 * 24 * 60 * 60 * 1000)))
  return `${months} month${months === 1 ? '' : 's'} left`
}

function defaultEndsAt(type: RelationshipType, startIso: string): string {
  const start = new Date(startIso)
  const months = type === 'mandate' ? 3 : type === 'affinity' ? 12 : 6
  start.setMonth(start.getMonth() + months)
  return start.toISOString()
}

function toDateInputValue(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toISOString().slice(0, 10)
}

function fromDateInputValue(value: string): string | null {
  if (!value) return null
  const d = new Date(`${value}T00:00:00.000Z`)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

function hasConsent(rel: ContactRelationship): boolean {
  const rec = rel.consent_record || {}
  return Boolean(rec.method || rec.confirmed_at || rec.summary || rec.decision)
}

function isTerminal(status: RelationshipStatus): boolean {
  return status === 'ended' || status === 'expired' || status === 'rejected'
}

function ScopeBlock({ scope }: { scope: RelationshipScope }) {
  const areas = Array.isArray(scope.areas) ? scope.areas : []
  const types = Array.isArray(scope.property_types) ? scope.property_types : []
  const price = scope.price_range
  const subjects = Array.isArray(scope.subject_property_ids) ? scope.subject_property_ids : []
  return (
    <div
      className={cn(
        'rounded-[var(--lc-radius-md)] bg-[var(--lc-surface-sunken)]',
        'p-[var(--lc-space-md)] text-[length:var(--lc-type-body-sm)]',
      )}
    >
      <p className="mb-2 font-semibold text-[var(--lc-text-primary)]">Scope</p>
      <dl className="grid gap-1 text-[var(--lc-text-muted)]">
        <div className="flex gap-2">
          <dt className="w-20 shrink-0">Areas</dt>
          <dd className="text-[var(--lc-text-primary)]">
            {areas.length ? areas.join(' · ') : '—'}
          </dd>
        </div>
        <div className="flex gap-2">
          <dt className="w-20 shrink-0">Type</dt>
          <dd className="text-[var(--lc-text-primary)]">
            {types.length ? types.join(' · ') : '—'}
          </dd>
        </div>
        <div className="flex gap-2">
          <dt className="w-20 shrink-0">Price</dt>
          <dd className="text-[var(--lc-text-primary)]" dir="ltr">
            {price && (price.min != null || price.max != null) ? (
              <Numeric>
                {price.currency || 'AED'}{' '}
                {price.min != null ? Number(price.min).toLocaleString() : '—'}
                {' – '}
                {price.max != null ? Number(price.max).toLocaleString() : '—'}
              </Numeric>
            ) : (
              'Open'
            )}
          </dd>
        </div>
        <div className="flex gap-2">
          <dt className="w-20 shrink-0">Subjects</dt>
          <dd className="text-[var(--lc-text-primary)]">
            {subjects.length ? subjects.join(', ') : 'No specific property — open search'}
          </dd>
        </div>
      </dl>
    </div>
  )
}

function TypePartyBadges({
  relationshipType,
  partyType,
  exclusive,
}: {
  relationshipType: RelationshipType
  partyType: PartyType
  exclusive: boolean
}) {
  const type = TYPE_META[relationshipType]
  const party = PARTY_META[partyType]
  const TypeGlyph = type.Glyph
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Badge className={cn('gap-1', type.className)}>
        <TypeGlyph className="h-3.5 w-3.5" aria-hidden />
        {type.label}
      </Badge>
      <Badge
        variant="outline"
        className="bg-[var(--lc-surface-sunken)] text-[var(--lc-text-primary)]"
      >
        {party.label}
      </Badge>
      {exclusive ? (
        <Badge className="ms-auto gap-1">
          <Lock className="h-3.5 w-3.5" aria-hidden />
          Exclusive
        </Badge>
      ) : null}
    </div>
  )
}

function RelationshipCard({
  relationship,
  contactName,
  onEdit,
  onResend,
  onCancel,
  busyId,
}: {
  relationship: ContactRelationship
  contactName: string
  onEdit: (rel: ContactRelationship) => void
  onResend: (rel: ContactRelationship) => void
  onCancel: (rel: ContactRelationship) => void
  busyId: string | null
}) {
  const pending = relationship.status === 'pending'
  const consentOk = hasConsent(relationship)
  const countdown = monthsLeft(relationship.ends_at)
  const busy = busyId === relationship.id
  const titleId = `rel-title-${relationship.id}`

  return (
    <article
      aria-labelledby={titleId}
      className={cn(
        'rounded-[var(--lc-radius-lg)] border border-[var(--lc-border)]',
        'bg-[var(--lc-surface-raised)] p-[var(--lc-space-lg)]',
        'shadow-[var(--lc-elevation-sm)]',
      )}
      style={{ borderLeftWidth: 4, borderLeftColor: statusStripeVar(relationship.status) }}
    >
      <div className="flex flex-col gap-[var(--lc-space-md)]">
        <div id={titleId}>
          <TypePartyBadges
            relationshipType={relationship.relationship_type}
            partyType={relationship.party_type}
            exclusive={relationship.exclusivity === 'exclusive'}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 text-[length:var(--lc-type-body-sm)]">
          <Badge status={statusToLc(relationship.status)}>
            <span className="sr-only">Status: </span>
            {STATUS_LABEL[relationship.status]}
          </Badge>
          {pending ? (
            <span className="text-[var(--lc-text-muted)]">
              Requested {formatDay(relationship.created_at)} · Would run{' '}
              <Numeric>{formatDay(relationship.starts_at)}</Numeric>
              {' → '}
              <Numeric>{formatDay(relationship.ends_at)}</Numeric>
            </span>
          ) : (
            <span className="text-[var(--lc-text-muted)]">
              Since <Numeric>{formatDay(relationship.starts_at)}</Numeric>
              {relationship.ends_at ? (
                <>
                  {' · Until '}
                  <Numeric>{formatDay(relationship.ends_at)}</Numeric>
                </>
              ) : null}
              {countdown && countdown !== 'ended' ? (
                <>
                  {' · ('}
                  <Numeric>{countdown}</Numeric>)
                </>
              ) : null}
            </span>
          )}
        </div>

        <ScopeBlock scope={relationship.scope || {}} />

        {consentOk ? (
          <Badge
            variant="outline"
            className="w-fit gap-1 bg-[var(--lc-surface-sunken)] text-[var(--lc-text-primary)]"
          >
            <Paperclip className="h-3.5 w-3.5" aria-hidden />
            Consent:{' '}
            {relationship.consent_record.evidence?.filename ||
              relationship.consent_record.summary ||
              relationship.consent_record.method ||
              'On file'}
          </Badge>
        ) : (
          <Badge
            variant="outline"
            className="w-fit gap-1 border-transparent bg-[var(--lc-status-unpublished-bg)] text-[var(--lc-status-unpublished-fg)]"
            aria-live="polite"
          >
            <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
            No consent on file — required
          </Badge>
        )}

        {pending ? (
          <div className="flex flex-wrap items-center gap-2 border-t border-[var(--lc-border)] pt-[var(--lc-space-md)]">
            <p className="flex-1 text-[length:var(--lc-type-body-sm)] text-[var(--lc-text-muted)]">
              Waiting on {contactName || 'contact'} to confirm via link.
            </p>
            <Button
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => onResend(relationship)}
            >
              {busy ? <Loader2 className="me-1 h-3.5 w-3.5 animate-spin" /> : null}
              Resend confirmation
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={() => onEdit(relationship)}
            >
              Edit
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={busy}
              className="text-[var(--lc-status-unpublished-fg)]"
              onClick={() => onCancel(relationship)}
            >
              Cancel request
            </Button>
          </div>
        ) : null}
      </div>
    </article>
  )
}

function RedactedCard({ relationship }: { relationship: RedactedRelationship }) {
  const types = relationship.scope_summary?.property_types || []
  const region = relationship.scope_summary?.areas_region
  return (
    <article
      title="This information comes from another agency's records. You cannot edit it. It appears so you don't accidentally create a conflicting exclusive claim."
      className={cn(
        'cursor-default rounded-[var(--lc-radius-lg)] border border-[var(--lc-border)]',
        'bg-[var(--lc-surface-sunken)] p-[var(--lc-space-lg)] opacity-85',
      )}
      style={{ borderLeftWidth: 4, borderLeftColor: statusStripeVar(relationship.status) }}
    >
      <div className="pointer-events-none flex flex-col gap-[var(--lc-space-sm)]">
        <TypePartyBadges
          relationshipType={relationship.relationship_type}
          partyType={relationship.party_type}
          exclusive={relationship.exclusivity === 'exclusive'}
        />
        <div className="flex flex-wrap items-center gap-2 text-[length:var(--lc-type-body-sm)]">
          <Badge status={statusToLc(relationship.status)}>
            <span className="sr-only">Status: </span>
            {STATUS_LABEL[relationship.status]}
          </Badge>
          <span className="text-[var(--lc-text-muted)]">
            Since <Numeric>{relationship.starts_month || '—'}</Numeric>
            {relationship.ends_month ? (
              <>
                {' · Ends '}
                <Numeric>{relationship.ends_month}</Numeric>
              </>
            ) : null}
          </span>
        </div>
        <p className="text-[length:var(--lc-type-body-sm)] text-[var(--lc-text-muted)]">
          Scope:{' '}
          {[region, ...types].filter(Boolean).join(' · ') || '—'}
          {' · Price range redacted'}
        </p>
        <p className="text-[length:var(--lc-type-caption)] text-[var(--lc-text-muted)]">
          Agent + agency: hidden per contact privacy
        </p>
      </div>
    </article>
  )
}

type Step = 1 | 2 | 3

type DraftForm = {
  relationship_type: RelationshipType | null
  party_type: PartyType | null
  exclusivity: Exclusivity
  areasText: string
  property_types: string[]
  priceMin: string
  priceMax: string
  starts_at: string
  ends_at: string
}

function emptyDraft(type: RelationshipType | null = null): DraftForm {
  const start = new Date().toISOString()
  return {
    relationship_type: type,
    party_type: null,
    exclusivity: 'non_exclusive',
    areasText: '',
    property_types: [],
    priceMin: '',
    priceMax: '',
    starts_at: toDateInputValue(start),
    ends_at: toDateInputValue(defaultEndsAt(type || 'representation', start)),
  }
}

function draftToBody(draft: DraftForm): CreateRelationshipBody | null {
  if (!draft.relationship_type || !draft.party_type) return null
  const areas = draft.areasText
    .split(/[,·\n]/)
    .map((s) => s.trim())
    .filter(Boolean)
  const scope: RelationshipScope = {
    areas,
    property_types: draft.property_types,
    price_range: {
      currency: 'AED',
      min: draft.priceMin ? Number(draft.priceMin) : null,
      max: draft.priceMax ? Number(draft.priceMax) : null,
    },
    subject_property_ids: [],
  }
  return {
    party_type: draft.party_type,
    relationship_type: draft.relationship_type,
    exclusivity: draft.exclusivity,
    scope,
    starts_at: fromDateInputValue(draft.starts_at),
    ends_at: fromDateInputValue(draft.ends_at),
  }
}

function RelationshipFormBody({
  step,
  draft,
  setDraft,
  editingId,
  otherExclusiveParties,
  mineDuplicate,
}: {
  step: Step
  draft: DraftForm
  setDraft: (next: DraftForm) => void
  editingId: string | null
  otherExclusiveParties: Set<PartyType>
  mineDuplicate: boolean
}) {
  const collision =
    draft.exclusivity === 'exclusive' &&
    draft.party_type &&
    otherExclusiveParties.has(draft.party_type)

  return (
    <div className="space-y-[var(--lc-space-md)]">
      {step === 1 && !editingId ? (
        <fieldset>
          <legend className="mb-2 text-[length:var(--lc-type-heading-2)] font-semibold">
            What kind of relationship?
          </legend>
          <p className="mb-3 text-[length:var(--lc-type-body-sm)] text-[var(--lc-text-muted)]">
            You can change this later, but the type sets the fiduciary bar.
          </p>
          <div role="radiogroup" aria-label="Relationship type" className="grid gap-2">
            {(Object.keys(TYPE_META) as RelationshipType[]).map((key) => {
              const meta = TYPE_META[key]
              const Glyph = meta.Glyph
              const selected = draft.relationship_type === key
              return (
                <button
                  key={key}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() =>
                    setDraft({
                      ...draft,
                      relationship_type: key,
                      ends_at: toDateInputValue(
                        defaultEndsAt(key, fromDateInputValue(draft.starts_at) || new Date().toISOString()),
                      ),
                    })
                  }
                  className={cn(
                    'flex min-h-tap items-start gap-3 rounded-[var(--lc-radius-md)] border p-3 text-start',
                    'transition-[background-color,border-color] duration-[var(--lc-duration-fast)]',
                    selected
                      ? 'border-[var(--lc-action-primary)] bg-[var(--lc-action-primary)]/10'
                      : 'border-[var(--lc-border)] bg-[var(--lc-surface-raised)]',
                  )}
                >
                  <Glyph className="mt-0.5 h-5 w-5 shrink-0 text-[var(--lc-action-primary)]" />
                  <span>
                    <span className="block font-semibold">{meta.label}</span>
                    <span className="block text-[length:var(--lc-type-body-sm)] text-[var(--lc-text-muted)]">
                      {meta.body}
                    </span>
                  </span>
                  {selected ? <Check className="ms-auto h-4 w-4 text-[var(--lc-action-primary)]" /> : null}
                </button>
              )
            })}
          </div>
        </fieldset>
      ) : null}

      {step === 2 && !editingId ? (
        <fieldset>
          <legend className="mb-2 text-[length:var(--lc-type-heading-2)] font-semibold">
            Which side is the contact on?
          </legend>
          {mineDuplicate ? (
            <div
              role="status"
              className={cn(
                'mb-3 flex gap-2 rounded-[var(--lc-radius-md)] p-[var(--lc-space-sm)]',
                'bg-[var(--lc-status-underOffer-bg)] text-[var(--lc-status-underOffer-fg)]',
              )}
            >
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <p className="text-[length:var(--lc-type-body-sm)]">
                You already have an active relationship for this party type on this contact.
                Non-exclusive relationships can stack; exclusive cannot.
              </p>
            </div>
          ) : null}
          <div role="radiogroup" aria-label="Party type" className="grid gap-2 sm:grid-cols-2">
            {(Object.keys(PARTY_META) as PartyType[]).map((key) => {
              const meta = PARTY_META[key]
              const Glyph = meta.Glyph
              const selected = draft.party_type === key
              return (
                <button
                  key={key}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setDraft({ ...draft, party_type: key })}
                  className={cn(
                    'flex min-h-tap items-center gap-3 rounded-[var(--lc-radius-md)] border p-3 text-start',
                    selected
                      ? 'border-[var(--lc-action-primary)] bg-[var(--lc-action-primary)]/10'
                      : 'border-[var(--lc-border)] bg-[var(--lc-surface-raised)]',
                  )}
                >
                  <Glyph className="h-5 w-5 text-[var(--lc-action-primary)]" />
                  <span className="font-semibold">{meta.label}</span>
                </button>
              )
            })}
          </div>
        </fieldset>
      ) : null}

      {step === 3 || editingId ? (
        <fieldset className="space-y-4">
          <legend className="mb-2 text-[length:var(--lc-type-heading-2)] font-semibold">
            Scope + dates
          </legend>
          {!editingId ? (
            <div>
              <p className="mb-2 text-sm font-medium">Exclusivity</p>
              {collision ? (
                <div
                  role="status"
                  className={cn(
                    'mb-3 flex gap-2 rounded-[var(--lc-radius-md)] p-[var(--lc-space-sm)]',
                    'bg-[var(--lc-status-underOffer-bg)] text-[var(--lc-status-underOffer-fg)]',
                  )}
                >
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <p className="text-[length:var(--lc-type-body-sm)]">
                    Another agency currently holds this exclusive. Save will fail unless you
                    switch to non-exclusive or keep it pending.
                  </p>
                </div>
              ) : null}
              <div role="radiogroup" aria-label="Exclusivity" className="grid gap-2">
                {(
                  [
                    [
                      'non_exclusive',
                      'Non-exclusive — other agents can also represent this contact for this side.',
                    ],
                    [
                      'exclusive',
                      'Exclusive — no other agent can represent this contact for this side while this is active.',
                    ],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={draft.exclusivity === value}
                    onClick={() => setDraft({ ...draft, exclusivity: value })}
                    className={cn(
                      'rounded-[var(--lc-radius-md)] border p-3 text-start text-[length:var(--lc-type-body-sm)]',
                      draft.exclusivity === value
                        ? 'border-[var(--lc-action-primary)] bg-[var(--lc-action-primary)]/10'
                        : 'border-[var(--lc-border)]',
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <div>
            <Label htmlFor="rel-areas">Areas</Label>
            <Input
              id="rel-areas"
              className="mt-1"
              placeholder="Dubai Marina, JBR, Bluewaters"
              value={draft.areasText}
              onChange={(e) => setDraft({ ...draft, areasText: e.target.value })}
            />
          </div>

          <div>
            <p className="mb-2 text-sm font-medium" id="rel-property-types">
              Property type
            </p>
            <div
              className="flex flex-wrap gap-2"
              role="group"
              aria-labelledby="rel-property-types"
            >
              {PROPERTY_TYPE_OPTIONS.map((opt) => {
                const on = draft.property_types.includes(opt)
                return (
                  <button
                    key={opt}
                    type="button"
                    aria-pressed={on}
                    onClick={() =>
                      setDraft({
                        ...draft,
                        property_types: on
                          ? draft.property_types.filter((t) => t !== opt)
                          : [...draft.property_types, opt],
                      })
                    }
                    className={cn(
                      'min-h-tap rounded-[var(--lc-radius-md)] border px-3 text-sm capitalize',
                      on
                        ? 'border-[var(--lc-action-primary)] bg-[var(--lc-action-primary)] text-[var(--lc-action-primary-text)]'
                        : 'border-[var(--lc-border)] bg-[var(--lc-surface-raised)]',
                    )}
                  >
                    {opt}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="rel-price-min">Min price (AED)</Label>
              <Input
                id="rel-price-min"
                type="number"
                dir="ltr"
                className="mt-1"
                value={draft.priceMin}
                onChange={(e) => setDraft({ ...draft, priceMin: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="rel-price-max">Max price (AED)</Label>
              <Input
                id="rel-price-max"
                type="number"
                dir="ltr"
                className="mt-1"
                value={draft.priceMax}
                onChange={(e) => setDraft({ ...draft, priceMax: e.target.value })}
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="rel-starts">Starts</Label>
              <Input
                id="rel-starts"
                type="date"
                dir="ltr"
                className="mt-1"
                value={draft.starts_at}
                onChange={(e) => setDraft({ ...draft, starts_at: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="rel-ends">Ends</Label>
              <Input
                id="rel-ends"
                type="date"
                dir="ltr"
                className="mt-1"
                value={draft.ends_at}
                onChange={(e) => setDraft({ ...draft, ends_at: e.target.value })}
              />
            </div>
          </div>
        </fieldset>
      ) : null}
    </div>
  )
}

export function RelationshipsEditorPage() {
  const { contactId } = useParams<{ contactId: string }>()
  const { agent } = useAuth()
  const { addToast } = useToast()
  usePageTitle('Relationships')

  const [contact, setContact] = useState<ContactSummary | null>(null)
  const [mine, setMine] = useState<ContactRelationship[]>([])
  const [other, setOther] = useState<RedactedRelationship[]>([])
  const [otherDisabled, setOtherDisabled] = useState(false)
  const [loading, setLoading] = useState(true)
  const [showEnded, setShowEnded] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)

  const [formOpen, setFormOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [step, setStep] = useState<Step>(1)
  const [draft, setDraft] = useState<DraftForm>(() => emptyDraft())
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [conflictOpen, setConflictOpen] = useState(false)
  const [pendingBody, setPendingBody] = useState<CreateRelationshipBody | null>(null)
  const [cancelTarget, setCancelTarget] = useState<ContactRelationship | null>(null)

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)')
    const apply = () => setIsMobile(mq.matches)
    apply()
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [])

  const load = useCallback(async () => {
    if (!contactId) return
    setLoading(true)
    try {
      const [c, mineRes, otherRes] = await Promise.all([
        api.getContact(contactId) as Promise<ContactSummary>,
        api.getContactRelationshipsMine(contactId) as Promise<{ relationships: ContactRelationship[] }>,
        api.getContactRelationshipsOther(contactId).catch((err: Error & { error?: string; status?: number; disabled?: boolean; relationships?: RedactedRelationship[]; message?: string }) => {
          if (err?.error === 'CROSS_TENANT_VISIBILITY_DISABLED' || err?.status === 403) {
            return {
              relationships: [] as RedactedRelationship[],
              disabled: true,
              message: err.message,
            }
          }
          throw err
        }) as Promise<{ relationships: RedactedRelationship[]; disabled?: boolean }>,
      ])
      setContact(c)
      setMine(mineRes.relationships || [])
      setOther(otherRes.relationships || [])
      setOtherDisabled(Boolean(otherRes.disabled))
    } catch (e: unknown) {
      const err = e as Error
      addToast({ title: 'Failed to load relationships', description: err.message, variant: 'error' })
    } finally {
      setLoading(false)
    }
  }, [contactId, addToast])

  useEffect(() => {
    if (!agent || !contactId) return
    void load()
  }, [agent, contactId, load])

  const activeMine = useMemo(() => mine.filter((r) => !isTerminal(r.status)), [mine])
  const endedMine = useMemo(() => mine.filter((r) => isTerminal(r.status)), [mine])

  const otherExclusiveParties = useMemo(() => {
    const set = new Set<PartyType>()
    for (const r of other) {
      if (r.exclusivity === 'exclusive' && (r.status === 'active' || r.status === 'confirmed')) {
        set.add(r.party_type)
      }
    }
    return set
  }, [other])

  const mineDuplicate = useMemo(() => {
    if (!draft.party_type || !draft.relationship_type) return false
    return activeMine.some(
      (r) =>
        r.party_type === draft.party_type &&
        r.relationship_type === draft.relationship_type &&
        r.id !== editingId,
    )
  }, [activeMine, draft.party_type, draft.relationship_type, editingId])

  const openCreate = () => {
    setEditingId(null)
    setDraft(emptyDraft())
    setStep(1)
    setFormOpen(true)
  }

  const openEdit = (rel: ContactRelationship) => {
    if (rel.status !== 'pending') {
      addToast({
        title: 'Only pending relationships can be edited',
        variant: 'error',
      })
      return
    }
    const scope = rel.scope || {}
    setEditingId(rel.id)
    setDraft({
      relationship_type: rel.relationship_type,
      party_type: rel.party_type,
      exclusivity: rel.exclusivity,
      areasText: Array.isArray(scope.areas) ? scope.areas.join(', ') : '',
      property_types: Array.isArray(scope.property_types) ? scope.property_types.map(String) : [],
      priceMin:
        scope.price_range?.min != null ? String(scope.price_range.min) : '',
      priceMax:
        scope.price_range?.max != null ? String(scope.price_range.max) : '',
      starts_at: toDateInputValue(rel.starts_at),
      ends_at: toDateInputValue(rel.ends_at),
    })
    setStep(3)
    setFormOpen(true)
  }

  const canContinue =
    (step === 1 && Boolean(draft.relationship_type)) ||
    (step === 2 && Boolean(draft.party_type)) ||
    step === 3

  const submitCreate = async (body: CreateRelationshipBody) => {
    if (!contactId) return
    setSaving(true)
    try {
      await api.createContactRelationship(contactId, body)
      addToast({
        title: 'Relationship created. Awaiting confirmation from contact.',
        variant: 'success',
      })
      setFormOpen(false)
      setConflictOpen(false)
      setPendingBody(null)
      await load()
    } catch (e: unknown) {
      const err = e as Error & { error?: string; status?: number }
      if (err.error === 'EXCLUSIVE_CONFLICT' || err.status === 409) {
        setPendingBody(body)
        setConflictOpen(true)
        return
      }
      addToast({
        title: 'Could not create relationship',
        description: err.message,
        variant: 'error',
      })
    } finally {
      setSaving(false)
    }
  }

  const submitEdit = async () => {
    if (!contactId || !editingId) return
    const body = draftToBody(draft)
    if (!body) return
    setSaving(true)
    try {
      await api.updateContactRelationship(contactId, editingId, {
        scope: body.scope,
        starts_at: body.starts_at,
        ends_at: body.ends_at,
      })
      addToast({ title: 'Relationship updated', variant: 'success' })
      setFormOpen(false)
      await load()
    } catch (e: unknown) {
      const err = e as Error & { error?: string }
      addToast({
        title: err.error === 'NOT_EDITABLE' ? 'Only pending relationships can be edited' : 'Update failed',
        description: err.message,
        variant: 'error',
      })
    } finally {
      setSaving(false)
    }
  }

  const handleSave = async () => {
    if (editingId) {
      await submitEdit()
      return
    }
    const body = draftToBody(draft)
    if (!body) return
    if (body.starts_at && body.ends_at && new Date(body.ends_at) <= new Date(body.starts_at)) {
      addToast({ title: 'End date must be after start date', variant: 'error' })
      return
    }
    await submitCreate(body)
  }

  const handleResend = async (rel: ContactRelationship) => {
    if (!contactId) return
    setBusyId(rel.id)
    try {
      await api.resendRelationshipConsentLink(contactId, rel.id)
      addToast({ title: 'Confirmation link resent.', variant: 'success' })
    } catch (e: unknown) {
      const err = e as Error
      addToast({ title: 'Resend failed', description: err.message, variant: 'error' })
    } finally {
      setBusyId(null)
    }
  }

  const confirmCancel = async () => {
    if (!contactId || !cancelTarget) return
    setBusyId(cancelTarget.id)
    try {
      await api.deleteContactRelationship(contactId, cancelTarget.id)
      addToast({ title: 'Pending relationship cancelled', variant: 'success' })
      setCancelTarget(null)
      await load()
    } catch (e: unknown) {
      const err = e as Error & { error?: string }
      addToast({
        title: err.error === 'NOT_DELETABLE' ? 'Only pending relationships can be deleted' : 'Cancel failed',
        description: err.message,
        variant: 'error',
      })
    } finally {
      setBusyId(null)
    }
  }

  const stepper = (
    <ol className="mb-4 flex items-center gap-2" aria-label="Add relationship steps">
      {(['Type', 'Party', 'Scope'] as const).map((label, idx) => {
        const n = (idx + 1) as Step
        const current = step === n
        const done = step > n
        return (
          <li
            key={label}
            className="flex flex-1 items-center gap-2"
            aria-current={current ? 'step' : undefined}
          >
            <span
              aria-label={`Step ${n} of 3: ${label}`}
              className={cn(
                'inline-flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold',
                current && 'bg-[var(--lc-action-primary)] text-[var(--lc-action-primary-text)]',
                done && 'bg-[var(--lc-accent-bold)] text-[var(--lc-accent-bold-text)]',
                !current && !done && 'bg-[var(--lc-surface-sunken)] text-[var(--lc-text-muted)]',
              )}
            >
              {done ? <Check className="h-4 w-4" /> : n}
            </span>
            <span
              className={cn(
                'hidden text-sm sm:inline',
                current ? 'text-[var(--lc-text-primary)]' : 'text-[var(--lc-text-muted)]',
              )}
            >
              {label}
            </span>
            {idx < 2 ? <span className="ms-auto hidden h-px flex-1 bg-[var(--lc-border)] sm:block" /> : null}
          </li>
        )
      })}
    </ol>
  )

  const formFooter = (
    <div className="mt-6 flex flex-wrap justify-between gap-2">
      <Button
        type="button"
        variant="ghost"
        disabled={saving || (!editingId && step === 1)}
        onClick={() => {
          if (editingId) {
            setFormOpen(false)
            return
          }
          setStep((s) => (s > 1 ? ((s - 1) as Step) : s))
        }}
      >
        {editingId ? 'Close' : 'Back'}
      </Button>
      {!editingId && step < 3 ? (
        <Button
          type="button"
          disabled={!canContinue || saving}
          onClick={() => setStep((s) => ((s + 1) as Step))}
        >
          Continue →
        </Button>
      ) : (
        <Button type="button" disabled={saving || (!editingId && !draftToBody(draft))} onClick={() => void handleSave()}>
          {saving ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : null}
          {editingId ? 'Save changes' : 'Save relationship'}
        </Button>
      )}
    </div>
  )

  const formInner = (
    <>
      {!editingId ? stepper : null}
      <RelationshipFormBody
        step={editingId ? 3 : step}
        draft={draft}
        setDraft={setDraft}
        editingId={editingId}
        otherExclusiveParties={otherExclusiveParties}
        mineDuplicate={mineDuplicate}
      />
      {formFooter}
    </>
  )

  if (loading || !contact) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center bg-[var(--lc-bg-page)]">
        <Loader2 className="h-8 w-8 animate-spin text-[var(--lc-action-primary)]" aria-label="Loading" />
      </div>
    )
  }

  const contactName = contact.name || 'this contact'

  return (
    <div className="min-h-screen bg-[var(--lc-bg-page)] pb-24">
      <div className="mx-auto max-w-[760px] px-4 py-6 sm:px-6">
        <div className="mb-4 flex items-center gap-2">
          <Link to={`/contacts/${contact.id}`}>
            <Button variant="outline" size="icon" aria-label="Back to contact">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1
              className="font-semibold text-[var(--lc-text-primary)]"
              style={{ font: 'var(--lc-type-heading-1)' }}
            >
              Relationships
            </h1>
            <p className="text-[length:var(--lc-type-body-lg)] text-[var(--lc-text-muted)]">
              Formalize how you represent this contact so leads route correctly and exclusive claims
              are protected.
            </p>
          </div>
        </div>

        <header
          className={cn(
            'sticky top-0 z-10 mb-8 flex items-center gap-3',
            'border-b border-[var(--lc-border)] bg-[var(--lc-surface-sunken)]',
            'px-[var(--lc-space-md)] py-[var(--lc-space-sm)]',
          )}
        >
          <Avatar className="h-12 w-12">
            <AvatarFallback className="bg-[var(--lc-action-secondary)] text-[var(--lc-action-secondary-text)]">
              {monogram(contact.name || 'U')}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold" style={{ font: 'var(--lc-type-heading-2)' }}>
              {contact.name || 'Unknown'}
            </p>
            <p className="truncate text-[length:var(--lc-type-body-sm)] text-[var(--lc-text-muted)]" dir="ltr">
              {contact.email || contact.phone || 'No channel on file'}
            </p>
          </div>
          <Link
            to={`/contacts/${contact.id}`}
            className="text-[length:var(--lc-type-body-sm)] text-[var(--lc-action-primary)] hover:underline"
          >
            View contact →
          </Link>
        </header>

        <section aria-labelledby="mine-heading" className="mt-[var(--lc-space-2xl)]">
          <div className="mb-[var(--lc-space-md)] flex flex-wrap items-center gap-3">
            <h2
              id="mine-heading"
              className="font-semibold text-[var(--lc-text-primary)]"
              style={{ font: 'var(--lc-type-heading-2)' }}
            >
              My relationships{' '}
              <Badge variant="secondary" className="align-middle">
                ({activeMine.length})
              </Badge>
            </h2>
            <Button className="ms-auto hidden sm:inline-flex" onClick={openCreate}>
              <Plus className="me-1 h-4 w-4" />
              Add relationship
            </Button>
          </div>

          {activeMine.length === 0 ? (
            <Card className="border-[var(--lc-border)] bg-[var(--lc-surface-raised)]">
              <CardContent className="space-y-3 p-[var(--lc-space-lg)] text-center">
                <p className="font-semibold text-[var(--lc-text-primary)]">
                  You haven&apos;t formalized any relationship with this contact yet.
                </p>
                <p className="text-[length:var(--lc-type-body-sm)] text-[var(--lc-text-muted)]">
                  Add a representation, mandate, or affinity to make lead routing, exclusive-claim
                  protection, and mandate reporting work.
                </p>
                <Button onClick={openCreate}>+ Add first relationship</Button>
              </CardContent>
            </Card>
          ) : (
            <div className="flex flex-col gap-[var(--lc-space-md)]">
              {activeMine.map((rel) => (
                <RelationshipCard
                  key={rel.id}
                  relationship={rel}
                  contactName={contactName}
                  onEdit={openEdit}
                  onResend={(r) => void handleResend(r)}
                  onCancel={setCancelTarget}
                  busyId={busyId}
                />
              ))}
            </div>
          )}

          {endedMine.length > 0 ? (
            <div className="mt-4">
              <Button variant="ghost" size="sm" onClick={() => setShowEnded((v) => !v)}>
                {showEnded ? 'Hide ended' : `Show ended (${endedMine.length})`}
              </Button>
              {showEnded ? (
                <div className="mt-3 flex flex-col gap-[var(--lc-space-md)] opacity-90">
                  {endedMine.map((rel) => (
                    <RelationshipCard
                      key={rel.id}
                      relationship={rel}
                      contactName={contactName}
                      onEdit={openEdit}
                      onResend={(r) => void handleResend(r)}
                      onCancel={setCancelTarget}
                      busyId={busyId}
                    />
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
        </section>

        <section aria-labelledby="other-heading" className="mt-[var(--lc-space-2xl)]">
          <h2
            id="other-heading"
            className="mb-2 font-semibold text-[var(--lc-text-muted)]"
            style={{ font: 'var(--lc-type-heading-2)' }}
          >
            Other agencies representing this contact
          </h2>
          {otherDisabled ? (
            <p className="text-[length:var(--lc-type-body-sm)] text-[var(--lc-text-muted)]">
              This contact has disabled cross-agency awareness. Exclusive-claim collisions will only
              surface at save time.
            </p>
          ) : (
            <>
              <p className="mb-[var(--lc-space-md)] text-[length:var(--lc-type-body-sm)] text-[var(--lc-text-muted)]">
                You can see that other relationships exist so you don&apos;t create conflicting
                exclusive claims. Names and evidence are redacted per this contact&apos;s privacy
                settings.
              </p>
              {other.length === 0 ? (
                <p className="text-[length:var(--lc-type-body-sm)] text-[var(--lc-text-muted)]">
                  None from other agencies visible.
                </p>
              ) : (
                <div className="flex flex-col gap-[var(--lc-space-md)]">
                  {other.map((rel, idx) => (
                    <RedactedCard key={`${rel.party_type}-${rel.starts_month}-${idx}`} relationship={rel} />
                  ))}
                </div>
              )}
            </>
          )}
        </section>
      </div>

      <Button
        type="button"
        aria-label="Add relationship"
        onClick={openCreate}
        className={cn(
          'fixed bottom-6 end-6 z-20 h-14 w-14 rounded-full p-0 sm:hidden',
          'shadow-[var(--lc-elevation-lg)]',
        )}
      >
        <Plus className="h-6 w-6" />
      </Button>

      {!isMobile ? (
        <Dialog open={formOpen} onOpenChange={setFormOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle id="dialog-title">
                {editingId ? 'Edit pending relationship' : 'Add relationship'}
              </DialogTitle>
              <DialogDescription>
                {editingId
                  ? 'Only scope and dates can be changed while pending.'
                  : 'Creates a pending relationship and emails a consent link to the contact.'}
              </DialogDescription>
            </DialogHeader>
            {formInner}
          </DialogContent>
        </Dialog>
      ) : (
        <Drawer.Root open={formOpen} onOpenChange={setFormOpen}>
          <Drawer.Portal>
            <Drawer.Overlay className="fixed inset-0 z-overlay lc-overlay" />
            <Drawer.Content
              className={cn(
                'fixed inset-x-0 bottom-0 z-modal flex max-h-[95vh] flex-col',
                'rounded-t-[var(--lc-radius-lg)] border border-[var(--lc-border)]',
                'bg-[var(--lc-surface-raised)] p-4 shadow-[var(--lc-elevation-lg)]',
              )}
            >
              <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-[var(--lc-border)]" />
              <Drawer.Title className="mb-1 text-lg font-semibold">
                {editingId ? 'Edit pending relationship' : 'Add relationship'}
              </Drawer.Title>
              <div className="overflow-y-auto pb-6">{formInner}</div>
            </Drawer.Content>
          </Drawer.Portal>
        </Drawer.Root>
      )}

      <Dialog open={conflictOpen} onOpenChange={setConflictOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Another agency holds this exclusive</DialogTitle>
            <DialogDescription>
              {contactName} already has an active exclusive relationship for this party type with a
              different agency. Only one exclusive of this type can be active across all agencies at
              once.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 flex flex-col gap-2">
            <Button
              disabled={saving || !pendingBody}
              onClick={() =>
                pendingBody &&
                void submitCreate({ ...pendingBody, exclusivity: 'non_exclusive' })
              }
            >
              Save as non-exclusive
            </Button>
            <Button
              variant="outline"
              disabled={saving || !pendingBody}
              onClick={() => pendingBody && void submitCreate(pendingBody)}
            >
              Save as pending
            </Button>
            <Button variant="ghost" onClick={() => setConflictOpen(false)}>
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(cancelTarget)} onOpenChange={(open) => !open && setCancelTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel this pending relationship?</DialogTitle>
            <DialogDescription>
              The confirmation link becomes invalid immediately. This hard-deletes the pending row.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setCancelTarget(null)}>
              Keep
            </Button>
            <Button variant="destructive" disabled={Boolean(busyId)} onClick={() => void confirmCancel()}>
              Cancel request
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default RelationshipsEditorPage
