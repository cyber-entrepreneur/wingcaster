import type { ReactNode } from 'react'
import { ArrowRight, Edit3, Sheet, Sparkles, Users, Bell, Share2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ChannelMark } from '@/components/ui/channel-mark'
import { cn } from '@/lib/utils'

/** Intake paths on AGT-ONB-001, plus next-action reuse on AGT-ONB-004. */
export type IntakePathVariant = 'whatsapp' | 'manual' | 'import' | 'nextAction'

export interface IntakePathCardProps {
  /**
   * Visual / semantic variant.
   * - `whatsapp` | `manual` | `import` — AGT-ONB-001 path picker
   * - `nextAction` — AGT-ONB-004 next-actions (always-visible CTA)
   */
  variant: IntakePathVariant
  /** Card title. Parent supplies i18n. */
  label: string
  /** One-line description. */
  description: string
  /** Time-to-value caption (path picker) or supporting sub (nextAction). */
  timeToValue?: string
  /** Selected radio state (path picker only). */
  selected?: boolean
  /** Recommended badge — WhatsApp card only; never two at once. */
  recommended?: boolean
  /** Recommended badge copy override. */
  recommendedLabel?: string
  /** CTA label; shown on selected path cards or always for `nextAction`. */
  ctaLabel?: string
  /** Called when the card is selected (radio) or activated. */
  onSelect?: () => void
  /** Called when the card-level CTA is pressed. */
  onCta?: () => void
  /** Optional leading icon override (nextAction icons). */
  icon?: ReactNode
  /** Disable interaction (submitting / offline). */
  disabled?: boolean
  className?: string
}

function DefaultIcon({ variant }: { variant: IntakePathVariant }) {
  if (variant === 'whatsapp') {
    return <ChannelMark channel="whatsapp" className="h-5 w-5" />
  }
  if (variant === 'manual') {
    return <Edit3 className="h-5 w-5 text-[var(--lc-text-heading)]" aria-hidden="true" />
  }
  if (variant === 'import') {
    return <Sheet className="h-5 w-5 text-[var(--lc-text-heading)]" aria-hidden="true" />
  }
  return <Share2 className="h-5 w-5 text-[var(--lc-text-heading)]" aria-hidden="true" />
}

/**
 * Intake-path / next-action card (Broadcast A3–A6).
 *
 * Used by: AGT-ONB-001 (path picker), AGT-ONB-004 (`variant="nextAction"`).
 * Stub visual + prop types only — parent owns PATCH + navigation.
 */
export function IntakePathCard({
  variant,
  label,
  description,
  timeToValue,
  selected = false,
  recommended = false,
  recommendedLabel = 'Recommended · fastest to your first listing',
  ctaLabel = 'Get started →',
  onSelect,
  onCta,
  icon,
  disabled = false,
  className,
}: IntakePathCardProps) {
  const isNextAction = variant === 'nextAction'
  const showCta = isNextAction || selected

  return (
    <div
      role={isNextAction ? 'group' : 'radio'}
      aria-checked={isNextAction ? undefined : selected}
      aria-disabled={disabled || undefined}
      tabIndex={disabled ? -1 : 0}
      onClick={() => {
        if (disabled) return
        onSelect?.()
      }}
      onKeyDown={(event) => {
        if (disabled) return
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          if (selected && onCta) onCta()
          else onSelect?.()
          return
        }
        // AGT-ONB-001: arrow keys move focus within the parent radiogroup.
        if (isNextAction) return
        const group = event.currentTarget.closest('[role="radiogroup"]')
        if (!group) return
        const radios = [...group.querySelectorAll<HTMLElement>('[role="radio"]')]
        const index = radios.indexOf(event.currentTarget)
        if (index < 0) return
        if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
          event.preventDefault()
          radios[(index + 1) % radios.length]?.focus()
        } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
          event.preventDefault()
          radios[(index - 1 + radios.length) % radios.length]?.focus()
        }
      }}
      className={cn(
        'relative flex min-h-[144px] w-full flex-col gap-[var(--lc-space-sm)]',
        'rounded-[var(--lc-radius-lg)] border bg-[var(--lc-surface-raised)] p-[var(--lc-space-lg)]',
        'shadow-[var(--lc-elevation-sm)] transition-[border-color,background-color]',
        'duration-[var(--lc-duration-fast)] ease-[var(--lc-easing-out)]',
        'focus-visible:outline-none',
        selected
          ? 'border-2 border-[var(--lc-action-primary)] bg-[var(--lc-surface-sunken)]'
          : 'border border-[var(--lc-border)] hover:border-[var(--lc-border-strong)]',
        disabled && 'pointer-events-none opacity-50',
        className,
      )}
      data-intake-variant={variant}
      data-selected={selected || undefined}
    >
      {recommended ? (
        <Badge
          variant="outline"
          className="absolute end-[var(--lc-space-sm)] top-[var(--lc-space-sm)] border-[var(--lc-border)] text-[var(--lc-text-brand)]"
          style={{ font: 'var(--lc-type-caption)' }}
        >
          {recommendedLabel}
        </Badge>
      ) : null}

      <div className="flex h-12 w-12 items-center justify-center rounded-[var(--lc-radius-md)] bg-[var(--lc-surface-sunken)]">
        {icon ?? <DefaultIcon variant={variant} />}
      </div>

      <div className="flex flex-1 flex-col gap-1">
        <p
          className="text-[var(--lc-text-heading)]"
          style={{ font: 'var(--lc-type-heading-3)' }}
        >
          {label}
        </p>
        <p
          className="text-[var(--lc-text-secondary)]"
          style={{ font: 'var(--lc-type-body-sm)' }}
        >
          {description}
        </p>
        {timeToValue ? (
          <p
            className="text-[var(--lc-text-muted)]"
            style={{ font: 'var(--lc-type-caption)' }}
          >
            {timeToValue}
          </p>
        ) : null}
      </div>

      <div className={cn('min-h-tap', !showCta && 'opacity-0')} aria-hidden={!showCta}>
        {showCta && isNextAction ? (
          <Button
            type="button"
            variant="default"
            size="lg"
            className="w-full"
            disabled={disabled}
            onClick={(event) => {
              event.stopPropagation()
              onCta?.()
            }}
          >
            {ctaLabel}
          </Button>
        ) : showCta ? (
          // Radio cards: visual CTA only — parent radio is the interactive control
          // (nested-interactive). Enter on a selected card fires onCta.
          <span
            className={cn(
              'inline-flex w-full min-h-tap items-center justify-center rounded-md px-8',
              'bg-[var(--lc-action-primary)] text-[var(--lc-action-primary-text)]',
              'text-sm font-medium',
            )}
          >
            {ctaLabel}
            <ArrowRight className="ms-2 h-4 w-4" aria-hidden="true" />
          </span>
        ) : (
          <div className="flex min-h-tap items-center justify-center text-[var(--lc-text-muted)]">
            <Sparkles className="h-4 w-4" aria-hidden="true" />
          </div>
        )}
      </div>
    </div>
  )
}

/** Convenience icons for AGT-ONB-004 next-action cards. */
export const IntakeNextActionIcons = {
  channels: <Share2 className="h-5 w-5 text-[var(--lc-text-heading)]" aria-hidden="true" />,
  invite: <Users className="h-5 w-5 text-[var(--lc-text-heading)]" aria-hidden="true" />,
  alerts: <Bell className="h-5 w-5 text-[var(--lc-text-heading)]" aria-hidden="true" />,
} as const
