import { Link } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { useIsProCapable } from '@/hooks/useIsProCapable'
import { useUiMode } from '@/hooks/useUiMode'

export interface ModeChipProps {
  className?: string
  forceProCapable?: boolean
}

/**
 * AGT-SET-002 — persistent top-bar chip showing Guided / Pro preference.
 * Links to `/settings/preferences#interface-mode`.
 */
export function ModeChip({ className, forceProCapable }: ModeChipProps) {
  const { mode } = useUiMode({ forceProCapable })
  const isProCapable = useIsProCapable(forceProCapable)
  const isPro = mode === 'pro'
  const mobilePro = isPro && !isProCapable

  const label = isPro ? 'Pro' : 'Guided'
  const glyph = isPro ? '◆' : '○'
  const tooltip = mobilePro
    ? 'Rendering Guided at this viewport size. Pro returns on tablet+.'
    : `Interface mode — ${label}. Click to change.`

  return (
    <Link
      to="/settings/preferences#interface-mode"
      className={cn(
        'inline-flex min-h-tap min-w-tap items-center justify-center rounded-pill px-3 focus-visible:outline-none',
        className,
      )}
      aria-label={`Interface mode: ${label}. Click to change.`}
      title={tooltip}
      data-testid="mode-chip"
      data-mode={mode}
      data-effective={isPro && isProCapable ? 'pro' : 'guided'}
    >
      <Badge
        variant="outline"
        className={cn(
          'h-8 rounded-pill border px-2.5 font-medium',
          isPro
            ? 'border-[var(--lc-accent-bold-edge)] bg-transparent text-[var(--lc-accent-bold-edge)]'
            : 'border-transparent bg-[var(--lc-surface-sunken)] text-[var(--lc-text-secondary)]',
        )}
      >
        <span aria-hidden="true" className="me-1">
          {glyph}
        </span>
        {label}
      </Badge>
    </Link>
  )
}
