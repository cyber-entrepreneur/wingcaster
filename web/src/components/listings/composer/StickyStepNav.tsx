import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export interface StickyStepNavProps {
  onSaveDraft?: () => void
  onNext: () => void
  nextLabel: string
  saveDraftLabel?: string
  hideSaveDraft?: boolean
  nextDisabled?: boolean
  busy?: boolean
  className?: string
}

export function StickyStepNav({
  onSaveDraft,
  onNext,
  nextLabel,
  saveDraftLabel = 'Save draft & exit',
  hideSaveDraft = false,
  nextDisabled = false,
  busy = false,
  className,
}: StickyStepNavProps) {
  return (
    <nav
      role="navigation"
      aria-label="Wizard navigation"
      className={cn(
        'sticky bottom-0 z-10 flex items-center gap-3 border-t border-[var(--lc-border)]',
        'bg-[var(--lc-surface)] px-[var(--lc-space-md)] py-3',
        'pb-[calc(var(--lc-space-md)+env(safe-area-inset-bottom))]',
        'shadow-[var(--lc-elevation-md)]',
        className,
      )}
    >
      {!hideSaveDraft && onSaveDraft && (
        <Button
          type="button"
          variant="outline"
          className="min-h-[var(--lc-tap-target-min)] flex-[0.3]"
          onClick={onSaveDraft}
          disabled={busy}
        >
          {saveDraftLabel}
        </Button>
      )}
      <Button
        type="button"
        className={cn(
          'min-h-[var(--lc-tap-target-min)]',
          hideSaveDraft || !onSaveDraft ? 'flex-1' : 'flex-[0.7]',
        )}
        onClick={onNext}
        disabled={nextDisabled || busy}
      >
        {busy ? 'Working…' : nextLabel}
      </Button>
    </nav>
  )
}
