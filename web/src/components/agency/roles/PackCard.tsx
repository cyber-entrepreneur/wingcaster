import { Coins, Eye, Megaphone, Wrench, ChevronRight } from 'lucide-react'
import type { KeyboardEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Numeric } from '@/components/ui/numeric'
import { cn } from '@/lib/utils'
import {
  packIconKey,
  type CapabilityPackListDto,
  type PackIconKey,
} from '@/pages/agency/settings/rolesTypes'
import { tRoles, type RolesLocale } from '@/pages/agency/settings/rolesCopy'
import { CapabilityChip } from './CapabilityChip'
import { PackWarningBanner } from './PackWarningBanner'

const ICONS: Record<PackIconKey, typeof Coins> = {
  coins: Coins,
  megaphone: Megaphone,
  eye: Eye,
  wrench: Wrench,
}

export interface PackCardProps {
  pack: CapabilityPackListDto
  locale: RolesLocale
  /** Show Assign action (hidden for read-only member persona). */
  canAssign: boolean
  /** Agency owner count — drives the Finance R11 warning. */
  ownerCount: number
  onView: (packId: string) => void
  onAssign: (packId: string) => void
  onWarningAction: () => void
}

const CHIP_LIMIT = 4

/**
 * AGN-ROL-001 R4–R11 pack card. The whole card is role="link" to the detail
 * screen; inner buttons stop propagation so they don't double-fire the nav.
 */
export function PackCard({
  pack,
  locale,
  canAssign,
  ownerCount,
  onView,
  onAssign,
  onWarningAction,
}: PackCardProps) {
  const Icon = ICONS[packIconKey(pack)]
  const isCustom = pack.kind === 'custom'
  const shownChips = pack.capability_summary.slice(0, CHIP_LIMIT)
  const remaining = Math.max(0, pack.capability_total - shownChips.length)
  const showFinanceWarning = pack.id === 'finance' && ownerCount < 2

  const go = () => onView(pack.id)
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      go()
    }
  }

  return (
    <div
      role="link"
      tabIndex={0}
      aria-label={tRoles('action.view', locale) + ' — ' + pack.name}
      onClick={go}
      onKeyDown={onKeyDown}
      className={cn(
        'flex cursor-pointer flex-col gap-3 rounded-[var(--lc-radius-lg)] border p-4',
        'border-[var(--lc-border)] bg-[var(--lc-surface-raised)] shadow-[var(--lc-elevation-sm)]',
        'transition-shadow duration-fast hover:shadow-[var(--lc-elevation-md)]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lc-focus-ring)]',
      )}
      data-pack-card={pack.id}
    >
      <div className="flex items-start gap-3">
        <span
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[var(--lc-radius-md)] bg-[var(--lc-surface-sunken)]"
          aria-hidden="true"
        >
          <Icon
            className={cn(
              'h-6 w-6',
              pack.id === 'finance'
                ? 'text-[var(--lc-status-underOffer-fg)]'
                : isCustom
                  ? 'text-[var(--lc-accent-bold-edge)]'
                  : 'text-[var(--lc-text-brand)]',
            )}
          />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3
              className="text-[var(--lc-text-heading)]"
              style={{ font: 'var(--lc-type-heading-3)' }}
            >
              {pack.name}
            </h3>
            {isCustom ? (
              <Badge
                variant="outline"
                className="border-[var(--lc-action-primary)] text-[var(--lc-text-brand)]"
              >
                {tRoles('badge.custom', locale)}
              </Badge>
            ) : (
              <Badge variant="outline" className="text-[var(--lc-text-muted)]">
                {tRoles('badge.seeded', locale)}
              </Badge>
            )}
          </div>
          <p
            className="mt-1 text-[var(--lc-text-primary)]"
            style={{ font: 'var(--lc-type-body)' }}
          >
            {pack.description}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {shownChips.map((cap) => (
          <CapabilityChip key={cap.key} label={cap.label} />
        ))}
        {remaining > 0 ? (
          <Button
            type="button"
            variant="link"
            className="inline-flex h-auto items-center gap-0.5 p-0 align-baseline"
            style={{ font: 'var(--lc-type-caption)' }}
            onClick={(e) => {
              e.stopPropagation()
              go()
            }}
          >
            {tRoles('chip.more', locale, { n: remaining })}
            <ChevronRight className="h-3 w-3" aria-hidden="true" />
          </Button>
        ) : null}
      </div>

      <p className="text-[var(--lc-text-secondary)]" style={{ font: 'var(--lc-type-body-sm)' }}>
        {pack.member_count > 0 ? (
          <>
            <Numeric>{pack.member_count}</Numeric> {tRoles('members.countSuffix', locale)}
          </>
        ) : (
          tRoles('members.zero', locale)
        )}
      </p>

      {showFinanceWarning ? (
        <PackWarningBanner
          message={tRoles('warning.secondOwner', locale)}
          actionLabel={tRoles('warning.secondOwner.cta', locale)}
          onAction={onWarningAction}
        />
      ) : null}

      <div className="mt-auto flex flex-wrap justify-end gap-2">
        <Button
          type="button"
          variant={isCustom ? 'default' : 'outline'}
          size="sm"
          onClick={(e) => {
            e.stopPropagation()
            onView(pack.id)
          }}
        >
          {tRoles('action.view', locale)}
        </Button>
        {canAssign ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={(e) => {
              e.stopPropagation()
              onAssign(pack.id)
            }}
          >
            {tRoles('action.assign', locale)}
          </Button>
        ) : null}
      </div>
    </div>
  )
}
