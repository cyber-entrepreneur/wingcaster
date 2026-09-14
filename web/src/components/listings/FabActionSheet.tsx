import { Drawer } from 'vaul'
import { FileSpreadsheet, Link2, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface FabActionSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onGuided: () => void
  onPro?: () => void
  onImportUrl?: () => void
}

const ROW =
  'flex min-h-14 w-full items-center gap-3 px-4 text-start text-[length:var(--lc-type-body)] text-[var(--lc-text-primary)] transition-colors hover:bg-[var(--lc-surface-sunken)]'

/** FAB action sheet: Guided wizard / Pro form / Import URL. */
export function FabActionSheet({
  open,
  onOpenChange,
  onGuided,
  onPro,
  onImportUrl,
}: FabActionSheetProps) {
  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-overlay bg-[color-mix(in_srgb,var(--lc-surface-inverse)_40%,transparent)]" />
        <Drawer.Content
          className={cn(
            'fixed inset-x-0 bottom-0 z-modal mx-auto flex max-w-lg flex-col',
            'rounded-t-[var(--lc-radius-xl)] border border-[var(--lc-border)]',
            'bg-[var(--lc-surface-raised)] pb-[env(safe-area-inset-bottom)]',
            'shadow-[var(--lc-elevation-lg)] outline-none',
            'duration-[var(--lc-duration-slow)] ease-[var(--lc-easing-out)]',
          )}
          aria-label="Add a listing"
        >
          <div className="mx-auto mt-3 h-1.5 w-10 rounded-full bg-[var(--lc-border-strong)]" />
          <Drawer.Title className="sr-only">Add a listing</Drawer.Title>
          <div className="py-2">
            <button
              type="button"
              className={ROW}
              onClick={() => {
                onOpenChange(false)
                onGuided()
              }}
            >
              <Sparkles className="h-5 w-5 text-[var(--lc-action-primary)]" aria-hidden />
              Add a listing (Guided)
            </button>
            {onPro && (
              <button
                type="button"
                className={ROW}
                onClick={() => {
                  onOpenChange(false)
                  onPro()
                }}
              >
                <FileSpreadsheet className="h-5 w-5 text-[var(--lc-text-secondary)]" aria-hidden />
                Add a listing (Pro form)
              </button>
            )}
            {onImportUrl && (
              <button
                type="button"
                className={ROW}
                onClick={() => {
                  onOpenChange(false)
                  onImportUrl()
                }}
              >
                <Link2 className="h-5 w-5 text-[var(--lc-text-secondary)]" aria-hidden />
                Import from portal URL
              </button>
            )}
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  )
}
