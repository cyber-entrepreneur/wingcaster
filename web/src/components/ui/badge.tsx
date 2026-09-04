import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'
import { LC_STATUS_GLYPH, resolveLcStatus, type LcStatus } from '@/theme/status'

const badgeVariants = cva(
  'inline-flex items-center rounded-pill border px-2.5 py-0.5 text-xs font-semibold transition-colors focus-visible:outline-none',
  {
    variants: {
      variant: {
        default:
          'border-transparent bg-[var(--lc-action-primary)] text-[var(--lc-action-primary-text)]',
        secondary:
          'border-transparent bg-[var(--lc-action-secondary)] text-[var(--lc-action-secondary-text)]',
        destructive:
          'border-transparent bg-[var(--lc-status-unpublished-bg)] text-[var(--lc-status-unpublished-fg)]',
        outline: 'text-[var(--lc-text-primary)] border-[var(--lc-border)]',
        draft: 'border-transparent bg-[var(--lc-status-draft-bg)] text-[var(--lc-status-draft-fg)]',
        published: 'border-transparent bg-[var(--lc-status-published-bg)] text-[var(--lc-status-published-fg)]',
        underOffer: 'border-transparent bg-[var(--lc-status-underOffer-bg)] text-[var(--lc-status-underOffer-fg)]',
        closed: 'border-transparent bg-[var(--lc-status-closed-bg)] text-[var(--lc-status-closed-fg)]',
        archived: 'border-transparent bg-[var(--lc-status-archived-bg)] text-[var(--lc-status-archived-fg)]',
        unpublished: 'border-transparent bg-[var(--lc-status-unpublished-bg)] text-[var(--lc-status-unpublished-fg)]',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
)

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {
  /** When set, renders tint + glyph + label (status is never colour alone). */
  status?: string | LcStatus
}

function Badge({ className, variant, status, children, ...props }: BadgeProps) {
  const resolved = status ? resolveLcStatus(status) : null
  const statusVariant = resolved ?? variant
  return (
    <div className={cn(badgeVariants({ variant: statusVariant }), className)} {...props}>
      {resolved ? (
        <>
          <span aria-hidden="true" className="mr-1" style={{ color: `var(--lc-status-${resolved}-dot)` }}>
            {LC_STATUS_GLYPH[resolved]}
          </span>
          {children}
        </>
      ) : (
        children
      )}
    </div>
  )
}

export { Badge, badgeVariants }
