import { ShieldCheck, ShieldQuestion, BadgeCheck } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { VerificationStatus } from '@/lib/listingVerification'

const META: Record<
  VerificationStatus,
  { label: string; Icon: typeof ShieldCheck; className: string }
> = {
  unverified: {
    label: 'Unverified',
    Icon: ShieldQuestion,
    className:
      'border-[var(--lc-border-strong)] bg-[var(--lc-surface-sunken)] text-[var(--lc-text-muted)]',
  },
  authorised: {
    label: 'Authorised',
    Icon: ShieldCheck,
    className:
      'border-[var(--lc-status-underOffer-fg)] bg-[var(--lc-status-underOffer-bg)] text-[var(--lc-status-underOffer-fg)]',
  },
  registry_verified: {
    label: 'Registry-verified',
    Icon: BadgeCheck,
    className:
      'border-[var(--lc-status-published-fg)] bg-[var(--lc-status-published-bg)] text-[var(--lc-status-published-fg)]',
  },
}

export interface VerificationBadgeProps {
  status?: VerificationStatus | null
  /** Hide the badge entirely when the listing is in a no-badge (none-tier) market. */
  hideWhenUnverified?: boolean
  className?: string
}

export function VerificationBadge({
  status,
  hideWhenUnverified = false,
  className,
}: VerificationBadgeProps) {
  const resolved: VerificationStatus = status ?? 'unverified'
  if (hideWhenUnverified && resolved === 'unverified') return null
  const meta = META[resolved]
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-[var(--lc-radius-pill)] border px-2 py-0.5',
        'text-[length:var(--lc-type-caption)] font-medium',
        meta.className,
        className,
      )}
    >
      <meta.Icon className="h-3.5 w-3.5" aria-hidden />
      {meta.label}
    </span>
  )
}
