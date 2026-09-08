import { Bath, Bed, Ruler } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Numeric } from '@/components/ui/numeric'
import { cn } from '@/lib/utils'

/**
 * Minimal listing shape for WLB-005 / LST-003 preview stubs.
 * Full domain `Listing` lands with consumer screens.
 */
export interface ListingPreviewListing {
  id: string
  address: string
  photos: string[]
  bedrooms?: number
  bathrooms?: number
  area?: number
  areaUnit?: string
  price?: number
  currency?: string
  description?: string
  status?: string
}

export type ListingPreviewVariant = 'preview' | 'compact'

export interface ListingPreviewCardProps {
  listing: ListingPreviewListing
  variant: ListingPreviewVariant
  onTap?: () => void
  className?: string
}

/**
 * Draft listing preview card (photo strip + address + meta + price + status).
 *
 * Used by: AGT-WLB-005; reused by AGT-LST-003 and future card composers.
 *
 * Stub visual + prop types only — no listing API.
 */
export function ListingPreviewCard({
  listing,
  variant,
  onTap,
  className,
}: ListingPreviewCardProps) {
  const photos = listing.photos ?? []
  const visible = variant === 'compact' ? 3 : 5
  const shown = photos.slice(0, visible)
  const surplus = Math.max(0, photos.length - shown.length)
  const interactive = typeof onTap === 'function'

  const content = (
    <>
      <div className="mb-[var(--lc-space-md)] flex gap-2 overflow-hidden">
        {shown.length === 0 ? (
          <div
            className={cn(
              'flex h-24 w-full items-center justify-center rounded-[var(--lc-radius-md)]',
              'bg-[var(--lc-surface-sunken)] text-sm text-[var(--lc-text-muted)]',
            )}
          >
            No photos yet
          </div>
        ) : (
          shown.map((src, i) => (
            <div
              key={`${src}-${i}`}
              className={cn(
                'relative overflow-hidden rounded-[var(--lc-radius-md)] bg-[var(--lc-surface-sunken)]',
                i === 0 ? 'h-28 w-40 shrink-0' : 'h-28 w-20 shrink-0',
                variant === 'compact' && 'h-20 w-16',
                variant === 'compact' && i === 0 && 'h-20 w-28',
              )}
            >
              <img src={src} alt="" className="h-full w-full object-cover" />
              {i === shown.length - 1 && surplus > 0 ? (
                <span
                  className={cn(
                    'absolute inset-0 flex items-center justify-center',
                    'lc-overlay text-[var(--lc-text-inverse)]',
                  )}
                >
                  +<Numeric>{surplus}</Numeric>
                </span>
              ) : null}
            </div>
          ))
        )}
      </div>

      <div className="mb-[var(--lc-space-sm)] flex flex-wrap items-start justify-between gap-2">
        <h2 className="text-[length:var(--lc-type-heading-2)] text-[var(--lc-text-primary)]">
          {listing.address}
        </h2>
        <Badge status="draft">Draft</Badge>
      </div>

      <div className="mb-[var(--lc-space-sm)] flex flex-wrap gap-4 text-sm text-[var(--lc-text-secondary)]">
        {listing.bedrooms != null ? (
          <span className="inline-flex items-center gap-1">
            <Bed className="h-4 w-4" aria-hidden />
            Bed <Numeric>{listing.bedrooms}</Numeric>
          </span>
        ) : null}
        {listing.bathrooms != null ? (
          <span className="inline-flex items-center gap-1">
            <Bath className="h-4 w-4" aria-hidden />
            Bath <Numeric>{listing.bathrooms}</Numeric>
          </span>
        ) : null}
        {listing.area != null ? (
          <span className="inline-flex items-center gap-1">
            <Ruler className="h-4 w-4" aria-hidden />
            <Numeric>{listing.area.toLocaleString()}</Numeric> {listing.areaUnit ?? 'sqft'}
          </span>
        ) : null}
      </div>

      {listing.price != null ? (
        <div className="mb-[var(--lc-space-sm)] flex items-baseline gap-2">
          <Numeric
            as="p"
            className="font-mono text-[length:var(--lc-type-display)] text-[var(--lc-text-primary)]"
          >
            {listing.price.toLocaleString()}
          </Numeric>
          <Badge variant="outline">{listing.currency ?? 'AED'}</Badge>
        </div>
      ) : null}

      {listing.description && variant === 'preview' ? (
        <p className="line-clamp-3 text-sm text-[var(--lc-text-secondary)]">
          {listing.description}
        </p>
      ) : null}
    </>
  )

  const shellClass = cn(
    'rounded-[var(--lc-radius-lg)] border border-[var(--lc-border)]',
    'bg-[var(--lc-surface-raised)] p-[var(--lc-space-lg)] text-start',
    interactive && 'cursor-pointer hover:border-[var(--lc-border-strong)]',
    className,
  )

  if (interactive) {
    return (
      <button type="button" className={cn(shellClass, 'w-full')} onClick={onTap}>
        {content}
      </button>
    )
  }

  return <article className={shellClass}>{content}</article>
}
