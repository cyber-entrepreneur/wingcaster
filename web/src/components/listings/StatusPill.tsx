import { Badge } from '@/components/ui/badge'
import { LISTING_STATUS_META, type ListingStatus } from '@/lib/listingStatus'
import { resolveLcStatus } from '@/theme/status'
import { cn } from '@/lib/utils'

export interface StatusPillProps {
  status: ListingStatus | string
  compact?: boolean
  className?: string
}

/** Status pill: tint + glyph + label — never colour alone. */
export function StatusPill({ status, compact = false, className }: StatusPillProps) {
  const resolved = resolveLcStatus(status)
  const meta = LISTING_STATUS_META[resolved as ListingStatus] ?? {
    label: resolved,
    glyph: '○',
    description: '',
  }

  return (
    <Badge
      status={resolved}
      className={cn(compact ? 'px-1.5 py-0 text-[10px]' : undefined, className)}
      aria-label={`Status: ${meta.label}`}
    >
      {meta.label}
    </Badge>
  )
}
