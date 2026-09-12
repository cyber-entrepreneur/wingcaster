import { Link } from 'react-router-dom'
import { Bath, Bed, Eye, Home, MapPin } from 'lucide-react'
import { Numeric } from '@/components/ui/numeric'
import { formatPrice } from '@/lib/format'
import { normalizeStatus } from '@/lib/listingStatus'
import { cn } from '@/lib/utils'
import type { Property } from '@/types'
import { InquiriesBadge } from './InquiriesBadge'
import { PortalStrip, type SyndicationEntry } from './PortalStrip'
import { StatusPill } from './StatusPill'

export type ListingCardProperty = Property & {
  reference?: string
  inquiries_new_count?: number
  days_on_market?: number
  syndications?: SyndicationEntry[]
  last_activity_at?: string
}

export interface ListingCardProps {
  property: ListingCardProperty
  className?: string
  onInquiriesClick?: (propertyId: string) => void
}

function relativeUpdated(iso?: string): string {
  if (!iso) return ''
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return ''
  const diffMs = Date.now() - then
  const hours = Math.floor(diffMs / 3_600_000)
  if (hours < 1) return 'Updated just now'
  if (hours < 24) return `Updated ${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days === 1) return 'Updated yesterday'
  if (days < 14) return `Updated ${days} days ago`
  return `Updated ${new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`
}

/** Guided listing card — photo-first with status/HRID overlays + portal strip. */
export function ListingCard({ property, className, onInquiriesClick }: ListingCardProps) {
  const photo = property.photos?.[0] || '/placeholder-property.svg'
  const status = normalizeStatus(property.status)
  const hrid = property.reference || property.id.slice(0, 8).toUpperCase()
  const inquiries = property.inquiries_new_count ?? 0
  const days = property.days_on_market ?? 0
  const updated = relativeUpdated(property.last_activity_at || property.listed_date)
  const address = [property.neighborhood || property.location, property.city]
    .filter(Boolean)
    .join(', ')

  return (
    <Link
      to={`/listings/${property.id}`}
      className={cn(
        'group block overflow-hidden rounded-[var(--lc-radius-lg)]',
        'border border-[var(--lc-border)] bg-[var(--lc-surface-raised)]',
        'shadow-[var(--lc-elevation-sm)] transition-[box-shadow]',
        'duration-[var(--lc-duration-fast)] hover:shadow-[var(--lc-elevation-md)]',
        className,
      )}
    >
      <div className="relative aspect-video overflow-hidden">
        <img
          src={photo}
          alt={property.title}
          className="h-full w-full object-cover"
        />
        <div className="absolute inset-x-0 top-0 flex items-start justify-between p-2.5">
          <div className="rounded-[var(--lc-radius-pill)] bg-[color-mix(in_srgb,var(--lc-surface-inverse)_60%,transparent)] p-0.5">
            <StatusPill status={status} />
          </div>
          <span
            className={cn(
              'rounded-[var(--lc-radius-pill)] px-2 py-0.5',
              'bg-[color-mix(in_srgb,var(--lc-surface-inverse)_90%,transparent)]',
              'text-[length:var(--lc-type-caption)] text-[var(--lc-text-inverse)]',
            )}
          >
            <Numeric>{hrid}</Numeric>
          </span>
        </div>
        <div className="absolute inset-x-0 bottom-0 flex items-end justify-between p-2.5">
          {days > 7 ? (
            <span
              className={cn(
                'rounded-[var(--lc-radius-pill)] px-2 py-0.5',
                'bg-[color-mix(in_srgb,var(--lc-surface-inverse)_60%,transparent)]',
                'text-[length:var(--lc-type-caption)] text-[var(--lc-text-inverse)]',
              )}
            >
              <Numeric>{days}</Numeric> days
            </span>
          ) : (
            <span />
          )}
          {inquiries > 0 && (
            <InquiriesBadge
              count={inquiries}
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                onInquiriesClick?.(property.id)
              }}
            />
          )}
        </div>
      </div>

      <div className="p-[var(--lc-space-md)]">
        <h3
          className={cn(
            'mb-1 line-clamp-2 font-[family-name:var(--lc-font-ui)] font-semibold',
            'text-[length:var(--lc-type-heading-3)] leading-6 text-[var(--lc-text-heading)]',
          )}
        >
          {property.title}
        </h3>
        {address && (
          <p className="mb-2 flex items-center gap-1 text-[length:var(--lc-type-body-sm)] text-[var(--lc-text-muted)]">
            <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />
            <span className="line-clamp-1">{address}</span>
          </p>
        )}
        <p className="mb-2 font-[family-name:var(--lc-font-mono)] text-[length:var(--lc-type-data)]">
          <span className="me-1 font-[family-name:var(--lc-font-ui)] text-[var(--lc-text-secondary)]">
            {property.price_unit && !['month', 'year', 'mo', 'yr'].includes(property.price_unit)
              ? property.price_unit
              : 'AED'}
          </span>
          <Numeric>{formatPrice(property.price, property.type, property.price_unit).replace(/^\$/, '')}</Numeric>
          {property.type === 'rent' && (
            <span className="ms-1 text-[var(--lc-text-muted)]">/mo</span>
          )}
        </p>
        <p className="mb-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-[length:var(--lc-type-body-sm)] text-[var(--lc-text-secondary)]">
          <span className="inline-flex items-center gap-1">
            <Bed className="h-4 w-4" aria-hidden />
            <Numeric>{property.bedrooms ?? 0}</Numeric>
          </span>
          <span className="text-[var(--lc-text-muted)]" aria-hidden>
            ·
          </span>
          <span className="inline-flex items-center gap-1">
            <Bath className="h-4 w-4" aria-hidden />
            <Numeric>{property.bathrooms ?? 0}</Numeric>
          </span>
          <span className="text-[var(--lc-text-muted)]" aria-hidden>
            ·
          </span>
          <span className="inline-flex items-center gap-1">
            <Home className="h-4 w-4" aria-hidden />
            <Numeric>{(property.area || 0).toLocaleString()}</Numeric>
            <span>{property.area_unit || 'sqft'}</span>
          </span>
        </p>

        <PortalStrip syndications={property.syndications} className="mb-3" />

        <div className="flex items-center justify-between text-[length:var(--lc-type-caption)] text-[var(--lc-text-muted)]">
          <span>{updated || '—'}</span>
          <span className="inline-flex items-center gap-1">
            <Eye className="h-3.5 w-3.5" aria-hidden />
            <Numeric>{(property.views || 0).toLocaleString()}</Numeric>
          </span>
        </div>
      </div>
    </Link>
  )
}
