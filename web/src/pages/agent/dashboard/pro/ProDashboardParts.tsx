import { type ReactNode } from 'react'
import {
  GripVertical,
  Maximize2,
  MoreHorizontal,
  TrendingDown,
  TrendingUp,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Numeric } from '@/components/ui/numeric'
import { Button } from '@/components/ui/button'

export type DashboardDensity = 'compact' | 'comfortable' | 'spacious'

export interface KpiCardProps {
  label: string
  value: string | number
  delta?: { direction: 'up' | 'down' | 'flat'; label: string }
  onClick?: () => void
  className?: string
}

export function KpiCard({ label, value, delta, onClick, className }: KpiCardProps) {
  const body = (
    <>
      <div
        className="text-[var(--lc-text-muted)]"
        style={{ font: 'var(--lc-type-overline)', letterSpacing: 'var(--lc-tracking-overline)' }}
      >
        {label}
      </div>
      <div className="mt-[var(--lc-space-2xs)] text-[var(--lc-text-heading)]">
        <Numeric style={{ font: 'var(--lc-type-display)', letterSpacing: 'var(--lc-tracking-display)' }}>
          {value}
        </Numeric>
      </div>
      {delta ? (
        <div
          className={cn(
            'mt-[var(--lc-space-2xs)] flex items-center gap-1',
            delta.direction === 'up' && 'text-[var(--lc-status-published-fg)]',
            delta.direction === 'down' && 'text-[var(--lc-status-unpublished-fg)]',
            delta.direction === 'flat' && 'text-[var(--lc-text-muted)]',
          )}
          style={{ font: 'var(--lc-type-caption)' }}
        >
          {delta.direction === 'up' ? (
            <TrendingUp className="h-3.5 w-3.5" aria-hidden="true" />
          ) : delta.direction === 'down' ? (
            <TrendingDown className="h-3.5 w-3.5" aria-hidden="true" />
          ) : null}
          <span>{delta.label}</span>
        </div>
      ) : null}
    </>
  )

  const shellClass = cn(
    'min-h-tap rounded-[var(--lc-radius-lg)] border border-[var(--lc-border)] bg-[var(--lc-surface-raised)] p-[var(--lc-space-lg)] text-start shadow-[var(--lc-elevation-sm)]',
    onClick ? 'hover:bg-[var(--lc-surface-selected)]' : null,
    className,
  )

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={shellClass} data-testid="kpi-card">
        {body}
      </button>
    )
  }

  return (
    <div className={shellClass} data-testid="kpi-card">
      {body}
    </div>
  )
}

export interface WidgetCardProps {
  title: string
  children: ReactNode
  className?: string
  span?: 3 | 4 | 6 | 8 | 12
  onFullscreen?: () => void
  onRemove?: () => void
  dragHandleClassName?: string
}

export function WidgetCard({
  title,
  children,
  className,
  span = 6,
  onFullscreen,
  onRemove,
  dragHandleClassName,
}: WidgetCardProps) {
  const spanClass =
    span === 12
      ? 'md:col-span-12'
      : span === 8
        ? 'md:col-span-8'
        : span === 4
          ? 'md:col-span-4'
          : span === 3
            ? 'md:col-span-3'
            : 'md:col-span-6'

  return (
    <section
      className={cn(
        'group col-span-12 flex h-full flex-col rounded-[var(--lc-radius-lg)] border border-[var(--lc-border)] bg-[var(--lc-surface-raised)] shadow-[var(--lc-elevation-sm)]',
        spanClass,
        className,
      )}
      data-testid="widget-card"
    >
      <header className="flex items-center gap-2 border-b border-[var(--lc-border)] px-[var(--lc-space-lg)] py-[var(--lc-space-sm)]">
        <h3
          className="min-w-0 flex-1 text-[var(--lc-text-heading)]"
          style={{ font: 'var(--lc-type-heading-3)', letterSpacing: 'var(--lc-tracking-heading-3)' }}
        >
          {title}
        </h3>
        <button
          type="button"
          className={cn(
            'inline-flex h-tap w-tap cursor-grab items-center justify-center rounded-md text-[var(--lc-text-muted)] opacity-0 transition-opacity group-hover:opacity-100 hover:text-[var(--lc-text-brand)] active:cursor-grabbing',
            dragHandleClassName,
          )}
          aria-label={`Drag ${title}`}
          title="Drag to rearrange"
        >
          <GripVertical className="h-4 w-4" aria-hidden="true" />
        </button>
        {onFullscreen ? (
          <button
            type="button"
            className="inline-flex h-tap w-tap items-center justify-center rounded-md text-[var(--lc-text-muted)] hover:text-[var(--lc-text-primary)]"
            aria-label={`Fullscreen ${title}`}
            onClick={onFullscreen}
          >
            <Maximize2 className="h-4 w-4" aria-hidden="true" />
          </button>
        ) : null}
        {onRemove ? (
          <button
            type="button"
            className="inline-flex h-tap w-tap items-center justify-center rounded-md text-[var(--lc-text-muted)] hover:text-[var(--lc-status-unpublished-fg)]"
            aria-label={`Remove ${title}`}
            onClick={onRemove}
          >
            <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
          </button>
        ) : (
          <button
            type="button"
            className="inline-flex h-tap w-tap items-center justify-center rounded-md text-[var(--lc-text-muted)] hover:text-[var(--lc-text-primary)]"
            aria-label={`${title} menu`}
          >
            <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
      </header>
      <div className="min-h-0 flex-1 overflow-auto p-[var(--lc-space-lg)]">{children}</div>
    </section>
  )
}

export interface QuickActionsBarProps {
  density: DashboardDensity
  onDensityChange: (d: DashboardDensity) => void
  onAction?: (id: string) => void
  saveState?: 'idle' | 'saving' | 'saved'
}

const QUICK_ACTIONS = [
  { id: 'listing', label: 'New listing' },
  { id: 'contact', label: 'Contact' },
  { id: 'task', label: 'Task' },
  { id: 'publish', label: 'Publish' },
  { id: 'inbox', label: 'Inbox' },
  { id: 'search', label: 'Search' },
] as const

const DENSITIES: DashboardDensity[] = ['compact', 'comfortable', 'spacious']

export function QuickActionsBar({
  density,
  onDensityChange,
  onAction,
  saveState = 'idle',
}: QuickActionsBarProps) {
  return (
    <div
      className="sticky top-14 z-20 flex flex-wrap items-center gap-[var(--lc-space-xs)] border-b border-[var(--lc-border)] bg-[var(--lc-surface-raised)] px-[var(--lc-space-md)] py-[var(--lc-space-sm)]"
      data-testid="quick-actions-bar"
    >
      {QUICK_ACTIONS.map((action) => (
        <Button
          key={action.id}
          type="button"
          variant="secondary"
          size="default"
          onClick={() => onAction?.(action.id)}
        >
          {action.label}
        </Button>
      ))}

      <div className="ms-auto flex flex-wrap items-center gap-[var(--lc-space-xs)]">
        {saveState !== 'idle' ? (
          <span className="text-[var(--lc-text-muted)]" style={{ font: 'var(--lc-type-caption)' }}>
            {saveState === 'saving' ? 'Saving…' : 'Saved'}
          </span>
        ) : null}
        <div
          role="radiogroup"
          aria-label="Dashboard density"
          className="flex items-center gap-1 rounded-[var(--lc-radius-md)] bg-[var(--lc-surface-sunken)] p-0.5"
        >
          {DENSITIES.map((d) => {
            const active = density === d
            return (
              <button
                key={d}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => onDensityChange(d)}
                className={cn(
                  'min-h-tap rounded-[var(--lc-radius-sm)] px-2.5 capitalize',
                  active
                    ? 'bg-[var(--lc-action-primary)] text-[var(--lc-action-primary-text)]'
                    : 'text-[var(--lc-text-muted)] hover:text-[var(--lc-text-primary)]',
                )}
                style={{ font: 'var(--lc-type-caption)' }}
              >
                {d}
              </button>
            )
          })}
        </div>
        <Button type="button" variant="outline" onClick={() => onAction?.('add-widget')}>
          Add widget +
        </Button>
      </div>
    </div>
  )
}
