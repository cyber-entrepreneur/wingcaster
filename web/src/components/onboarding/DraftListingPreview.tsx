import { ImageIcon } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Numeric } from '@/components/ui/numeric'
import { cn } from '@/lib/utils'

/** Stub draft fields shown until Wave 4 wires real draft fetch. */
export interface DraftListingPreviewData {
  title?: string
  priceLabel?: string
  beds?: number
  baths?: number
  areaLabel?: string
  address?: string
  description?: string
  photoUrls?: string[]
  aiAttribution?: string
}

export interface DraftListingPreviewProps {
  /** Draft id from WhatsApp listing pipeline / manual wizard. */
  draftId: string
  /** Optional stub payload so inventory/dev pages can render without fetch. */
  draft?: DraftListingPreviewData
  /** Loading skeleton. */
  loading?: boolean
  className?: string
}

const STUB_DRAFT: DraftListingPreviewData = {
  title: '2BR · Downtown Dubai',
  priceLabel: 'AED 2.4M',
  beds: 2,
  baths: 2,
  areaLabel: '1,200 sqft',
  address: 'Downtown Dubai, Burj Vista Tower 1',
  description:
    'Bright 2-bedroom apartment on the 32nd floor with Burj Khalifa view. Fully furnished, ready for immediate move-in…',
  photoUrls: [],
  aiAttribution: 'Drafted from your WhatsApp message',
}

/**
 * Read-only draft listing preview card.
 *
 * Used by: AGT-ONB-003, AGT-WLA-002 (recurring non-onboarding review).
 * Stub visual + prop types only — no draft API.
 */
export function DraftListingPreview({
  draftId,
  draft = STUB_DRAFT,
  loading = false,
  className,
}: DraftListingPreviewProps) {
  if (loading) {
    return (
      <div
        className={cn(
          'animate-pulse rounded-[var(--lc-radius-lg)] border border-[var(--lc-border)]',
          'bg-[var(--lc-surface-raised)] p-[var(--lc-space-lg)]',
          className,
        )}
        data-draft-id={draftId}
        aria-busy="true"
      >
        <div className="mb-3 h-40 rounded-[var(--lc-radius-md)] bg-[var(--lc-surface-sunken)]" />
        <div className="mb-2 h-6 w-1/3 rounded bg-[var(--lc-surface-sunken)]" />
        <div className="h-4 w-2/3 rounded bg-[var(--lc-surface-sunken)]" />
      </div>
    )
  }

  const chips = [
    draft.beds != null ? `${draft.beds} beds` : null,
    draft.baths != null ? `${draft.baths} baths` : null,
    draft.areaLabel ?? null,
  ].filter((value): value is string => Boolean(value))

  return (
    <article
      className={cn(
        'overflow-hidden rounded-[var(--lc-radius-lg)] border border-[var(--lc-border)]',
        'bg-[var(--lc-surface-raised)] shadow-[var(--lc-elevation-sm)]',
        className,
      )}
      data-draft-id={draftId}
    >
      <div className="relative flex h-40 items-center justify-center bg-[var(--lc-surface-sunken)]">
        {draft.photoUrls && draft.photoUrls.length > 0 ? (
          <img
            src={draft.photoUrls[0]}
            alt=""
            className="h-full w-full object-cover"
          />
        ) : (
          <ImageIcon className="h-10 w-10 text-[var(--lc-text-muted)]" aria-hidden="true" />
        )}
        <Badge variant="draft" className="absolute start-3 top-3">
          Draft
        </Badge>
      </div>

      <div className="flex flex-col gap-[var(--lc-space-sm)] p-[var(--lc-space-lg)]">
        {draft.priceLabel ? (
          <Numeric
            as="p"
            className="text-[var(--lc-text-heading)]"
            style={{ font: 'var(--lc-type-heading-2)', fontFamily: 'var(--lc-font-mono)' }}
          >
            {draft.priceLabel}
          </Numeric>
        ) : null}

        {draft.title ? (
          <h3
            className="text-[var(--lc-text-heading)]"
            style={{ font: 'var(--lc-type-heading-3)' }}
          >
            {draft.title}
          </h3>
        ) : null}

        {chips.length > 0 ? (
          <ul className="flex flex-wrap gap-2">
            {chips.map((chip) => (
              <li key={chip}>
                <Badge variant="outline">{chip}</Badge>
              </li>
            ))}
          </ul>
        ) : null}

        {draft.address ? (
          <p
            className="text-[var(--lc-text-secondary)]"
            style={{ font: 'var(--lc-type-body-sm)' }}
          >
            {draft.address}
          </p>
        ) : null}

        {draft.description ? (
          <p
            className="line-clamp-4 text-[var(--lc-text-primary)]"
            style={{ font: 'var(--lc-type-body)' }}
          >
            {draft.description}
          </p>
        ) : null}

        {draft.aiAttribution ? (
          <p
            className="text-[var(--lc-text-muted)]"
            style={{ font: 'var(--lc-type-caption)' }}
          >
            {draft.aiAttribution}
          </p>
        ) : null}
      </div>
    </article>
  )
}
