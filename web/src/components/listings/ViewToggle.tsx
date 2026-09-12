import { Grid3x3, LayoutGrid, List } from 'lucide-react'
import { cn } from '@/lib/utils'

/** Preserved union — do not rename. Extend additively only. */
export type ViewMode = 'card' | 'list' | 'gallery'

export interface ViewToggleProps {
  mode: ViewMode
  active: ViewMode
  onSelect: (m: ViewMode) => void
  /** Show text labels next to icons (tablet+). */
  showLabel?: boolean
  className?: string
}

const MODE_META: Record<ViewMode, { Icon: typeof Grid3x3; label: string }> = {
  card: { Icon: Grid3x3, label: 'Card' },
  list: { Icon: List, label: 'List' },
  gallery: { Icon: LayoutGrid, label: 'Gallery' },
}

/** Segmented view-mode control — signature preserved from ListingsPage. */
export function ViewToggle({
  mode,
  active,
  onSelect,
  showLabel = true,
  className,
}: ViewToggleProps) {
  const { Icon, label } = MODE_META[mode]
  const isActive = active === mode

  return (
    <button
      type="button"
      onClick={() => onSelect(mode)}
      aria-label={`${label} view`}
      aria-pressed={isActive}
      title={`${label} view`}
      className={cn(
        'inline-flex min-h-[var(--lc-tap-target-min)] min-w-[var(--lc-tap-target-min)]',
        'items-center justify-center gap-1.5 rounded-[var(--lc-radius-md)] px-2.5',
        'text-[length:var(--lc-type-caption)] font-medium transition-colors',
        'duration-[var(--lc-duration-fast)]',
        isActive
          ? 'bg-[var(--lc-action-primary)] text-[var(--lc-action-primary-text)]'
          : 'bg-transparent text-[var(--lc-text-muted)] hover:bg-[var(--lc-surface-sunken)]',
        className,
      )}
    >
      <Icon className="h-4 w-4" aria-hidden />
      {showLabel && <span className="hidden sm:inline">{label}</span>}
    </button>
  )
}

export function ViewToggleGroup({
  active,
  onSelect,
  className,
}: {
  active: ViewMode
  onSelect: (m: ViewMode) => void
  className?: string
}) {
  return (
    <div
      role="group"
      aria-label="View mode"
      className={cn(
        'inline-flex items-center gap-0.5 rounded-[var(--lc-radius-md)]',
        'border border-[var(--lc-border)] p-0.5',
        className,
      )}
    >
      {(['card', 'list', 'gallery'] as ViewMode[]).map((mode) => (
        <ViewToggle key={mode} mode={mode} active={active} onSelect={onSelect} />
      ))}
    </div>
  )
}
