import { Building2, ExternalLink, List, MapPin, Users } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Numeric } from '@/components/ui/numeric'
import { cn } from '@/lib/utils'

/**
 * Props for the shared agency identity block.
 *
 * Used by: AGN-MEM-005 (apply), SHR-PUB-003 (public profile), AGN-DSH-001 attention cards.
 * Stub visual + prop types only — no API.
 */
export interface AgencyIdentityCardProps {
  /** Agency display name (heading). */
  name: string
  /** One-line description; truncate visually at ~140 chars. */
  description?: string
  /** Logo URL. When omitted, monogram / Building2 fallback renders. */
  logoUrl?: string | null
  /**
   * Team size (member count). Omit the chip entirely when `undefined`
   * — never invent a plausible number.
   */
  teamSize?: number
  /** Primary market label (e.g. "UAE"). Omit chip when unset. */
  primaryMarket?: string
  /** Active listings count. Omit chip when unset. */
  activeListingsCount?: number
  /** Optional founded year chip ("Since {year}"). */
  foundedYear?: number
  /** Optional profile URL for "View agency profile →". */
  profileHref?: string
  /** Called when the view-profile ghost action is activated (stub). */
  onViewProfile?: () => void
  /** Optional invitation badge label (e.g. "Invited by Rashid"). */
  invitedByLabel?: string
  /**
   * Invitation expiry ISO date — shown under the meta strip on `/join/:code`
   * (AGN-MEM-005 invitation variant).
   */
  invitationExpiresAt?: string | null
  className?: string
}

function formatExpiryDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function monogram(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase()
  return `${parts[0]![0] ?? ''}${parts[1]![0] ?? ''}`.toUpperCase()
}

/**
 * Agency identity card — logo well + name + description + meta chips
 * (team size, primary market, active listings).
 *
 * Logo well uses `var(--lc-radius-md)` — never circular (brand mark, not person).
 * Landmark: `role="region"` + `aria-label="Agency you are applying to"` for AGN-MEM-005.
 */
export function AgencyIdentityCard({
  name,
  description,
  logoUrl,
  teamSize,
  primaryMarket,
  activeListingsCount,
  foundedYear,
  profileHref,
  onViewProfile,
  invitedByLabel,
  invitationExpiresAt,
  className,
}: AgencyIdentityCardProps) {
  const handleViewProfile = () => {
    if (onViewProfile) {
      onViewProfile()
      return
    }
    if (profileHref && typeof window !== 'undefined') {
      window.open(profileHref, '_blank', 'noopener,noreferrer')
    }
  }

  const showProfile = Boolean(profileHref || onViewProfile)

  return (
    <Card
      role="region"
      aria-label="Agency you are applying to"
      className={cn(
        'rounded-[var(--lc-radius-lg)] border-[var(--lc-border)] bg-[var(--lc-surface-raised)]',
        className,
      )}
      style={{ boxShadow: 'var(--lc-elevation-sm)' }}
    >
      <CardContent className="flex flex-col gap-[var(--lc-space-md)] p-[var(--lc-space-lg)] md:flex-row md:gap-[var(--lc-space-xl)] md:p-[var(--lc-space-xl)]">
        <div
          className={cn(
            'flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden',
            'rounded-[var(--lc-radius-md)] bg-[var(--lc-surface-sunken)]',
            'md:h-[88px] md:w-[88px]',
          )}
          aria-hidden={logoUrl ? undefined : true}
        >
          {logoUrl ? (
            <img src={logoUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <span
              className="flex flex-col items-center justify-center text-[var(--lc-text-heading)]"
              style={{ font: 'var(--lc-type-heading-1)' }}
            >
              <Building2 className="mb-0.5 h-5 w-5 text-[var(--lc-text-secondary)] md:hidden" aria-hidden />
              <span aria-hidden>{monogram(name)}</span>
            </span>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              {invitedByLabel ? (
                <Badge
                  className={cn(
                    'mb-2 rounded-[var(--lc-radius-pill)] border border-[var(--lc-accent-bold-edge)]',
                    'bg-[var(--lc-accent)] text-[var(--lc-accent-bold-text)]',
                  )}
                >
                  {invitedByLabel}
                </Badge>
              ) : null}
              <h2
                className="truncate text-[var(--lc-text-heading)]"
                style={{ font: 'var(--lc-type-heading-1)' }}
              >
                {name}
              </h2>
              {description ? (
                <p
                  className="mt-1 line-clamp-2 text-[var(--lc-text-secondary)]"
                  style={{ font: 'var(--lc-type-body-lg)' }}
                  title={description}
                >
                  {description}
                </p>
              ) : null}
            </div>

            {showProfile ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="hidden shrink-0 text-[var(--lc-text-secondary)] md:inline-flex"
                onClick={handleViewProfile}
              >
                View agency profile
                <ExternalLink className="ms-1.5 h-3.5 w-3.5" aria-hidden />
              </Button>
            ) : null}
          </div>

          <ul className="mt-[var(--lc-space-md)] flex list-none flex-wrap gap-2 p-0">
            {teamSize !== undefined ? (
              <li>
                <Badge
                  variant="secondary"
                  className="gap-1 rounded-[var(--lc-radius-pill)] bg-[var(--lc-surface-sunken)] text-[var(--lc-text-secondary)]"
                >
                  <Users className="h-3 w-3" aria-hidden />
                  Team of <Numeric>{teamSize}</Numeric> agents
                </Badge>
              </li>
            ) : null}
            {primaryMarket ? (
              <li>
                <Badge
                  variant="secondary"
                  className="gap-1 rounded-[var(--lc-radius-pill)] bg-[var(--lc-surface-sunken)] text-[var(--lc-text-secondary)]"
                >
                  <MapPin className="h-3 w-3" aria-hidden />
                  {primaryMarket}
                </Badge>
              </li>
            ) : null}
            {activeListingsCount !== undefined ? (
              <li>
                <Badge
                  variant="secondary"
                  className="gap-1 rounded-[var(--lc-radius-pill)] bg-[var(--lc-surface-sunken)] text-[var(--lc-text-secondary)]"
                >
                  <List className="h-3 w-3" aria-hidden />
                  <Numeric>{activeListingsCount}</Numeric> active listings
                </Badge>
              </li>
            ) : null}
            {foundedYear !== undefined ? (
              <li>
                <Badge
                  variant="secondary"
                  className="gap-1 rounded-[var(--lc-radius-pill)] bg-[var(--lc-surface-sunken)] text-[var(--lc-text-secondary)]"
                >
                  Since <Numeric>{foundedYear}</Numeric>
                </Badge>
              </li>
            ) : null}
          </ul>

          {invitationExpiresAt ? (
            <p
              className="mt-[var(--lc-space-sm)] text-[var(--lc-text-muted)]"
              style={{ font: 'var(--lc-type-caption)' }}
            >
              This invitation expires on {formatExpiryDate(invitationExpiresAt)}.
            </p>
          ) : null}

          {showProfile ? (
            <Button
              type="button"
              variant="link"
              size="sm"
              className="mt-2 px-0 md:hidden"
              onClick={handleViewProfile}
            >
              View agency profile →
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  )
}
