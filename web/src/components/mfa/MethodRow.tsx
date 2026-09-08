import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export interface MethodRowProps {
  /** Leading icon (lucide). Parent passes `<Smartphone />` etc. */
  icon: ReactNode
  /** Row title — e.g. "Authenticator app". */
  label: string
  /** Optional status / counter text on the trailing side of the label. */
  meta?: ReactNode
  /** Manage / action button label. Parent supplies i18n. */
  actionLabel?: string
  /** Accessible name for the action (include row context). */
  actionAriaLabel?: string
  onAction?: () => void
  /** Visual emphasis for warning / empty backup-code states. */
  tone?: 'default' | 'warning' | 'danger'
  className?: string
  children?: ReactNode
}

/**
 * Reusable settings method row: icon + label + meta + Manage ghost button.
 *
 * Used by: SHR-MFA-001 methods list; reused by SHR-SET-004 (sessions/devices).
 * Stub visual only.
 */
export function MethodRow({
  icon,
  label,
  meta,
  actionLabel = 'Manage',
  actionAriaLabel,
  onAction,
  tone = 'default',
  className,
  children,
}: MethodRowProps) {
  return (
    <div
      className={cn(
        'flex items-center gap-[var(--lc-space-md)] border-b border-[var(--lc-border)]',
        'px-[var(--lc-space-md)] py-[var(--lc-space-md)] last:border-b-0',
        tone === 'warning' && 'bg-[var(--lc-status-warning-bg)] text-[var(--lc-status-warning-fg)]',
        tone === 'danger' && 'bg-[var(--lc-status-danger-bg)] text-[var(--lc-status-danger-fg)]',
        className,
      )}
    >
      <div
        className={cn(
          'flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--lc-radius-md)]',
          'bg-[var(--lc-surface-sunken)] text-[var(--lc-text-secondary)]',
          tone === 'warning' && 'text-[var(--lc-status-warning-fg)]',
          tone === 'danger' && 'text-[var(--lc-status-danger-fg)]',
        )}
        aria-hidden
      >
        {icon}
      </div>

      <div className="min-w-0 flex-1">
        <p className="font-[family-name:var(--lc-font-ui)] text-[length:var(--lc-type-body)] text-[var(--lc-text-primary)]">
          {label}
        </p>
        {meta ? (
          <div className="mt-0.5 text-[length:var(--lc-type-body-sm)] text-[var(--lc-text-secondary)]">
            {meta}
          </div>
        ) : null}
        {children}
      </div>

      {onAction ? (
        <Button
          type="button"
          variant={tone === 'default' ? 'ghost' : 'outline'}
          size="sm"
          onClick={onAction}
          aria-label={actionAriaLabel ?? `${actionLabel} ${label}`}
        >
          {actionLabel}
        </Button>
      ) : null}
    </div>
  )
}
