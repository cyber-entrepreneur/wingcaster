import { useEffect, useId, useRef } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/** One keyboard shortcut row in the reference panel. */
export interface PAQueueKeyboardShortcut {
  /** Key chord display (`J`, `Shift + A`, `?`, …). */
  keys: string
  /** Human description (parent may i18n). */
  description: string
}

export interface PAQueueKeyboardShortcutsPanelProps {
  open: boolean
  onOpenChange?: (open: boolean) => void
  /** Override default PA-MOD-001 shortcut list. */
  shortcuts?: readonly PAQueueKeyboardShortcut[]
  title?: string
  className?: string
}

/** Default PA-queue-family shortcuts (PA-MOD-001 §Explicit copy). */
export const PA_QUEUE_DEFAULT_SHORTCUTS: readonly PAQueueKeyboardShortcut[] = [
  { keys: 'J', description: 'Next submission' },
  { keys: 'K', description: 'Previous submission' },
  { keys: 'A', description: 'Approve focused submission' },
  { keys: 'R', description: 'Reject focused submission' },
  { keys: 'I', description: 'Request info on focused submission' },
  { keys: 'Enter', description: 'Open submission detail' },
  { keys: 'X', description: 'Toggle row selection' },
  { keys: 'Shift + A', description: 'Select all visible rows' },
  { keys: '.', description: 'Refresh queue' },
  { keys: '?', description: 'Show keyboard shortcuts' },
  { keys: 'Esc', description: 'Close modal / clear selection' },
] as const

/**
 * Keyboard-shortcuts reference panel (right-side drawer).
 *
 * Documents J / K / A / R / I / Enter / X / Shift+A / . / ? / Esc.
 * Used by: PA-MOD-001, PA-ACR-001, PA-PVA-008, PA-PVA-009, PA-PKG-003, AGN-MEM-002.
 * Focus-trapped + Esc-dismissible. Parents own row-action keydown wiring.
 */
export function PAQueueKeyboardShortcutsPanel({
  open,
  onOpenChange,
  shortcuts = [...PA_QUEUE_DEFAULT_SHORTCUTS],
  title = 'Keyboard shortcuts',
  className,
}: PAQueueKeyboardShortcutsPanelProps) {
  const titleId = useId()
  const panelRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    const previous = document.activeElement as HTMLElement | null
    closeRef.current?.focus()

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onOpenChange?.(false)
        return
      }
      if (e.key !== 'Tab' || !panelRef.current) return
      const focusable = panelRef.current.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      )
      if (focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      previous?.focus?.()
    }
  }, [open, onOpenChange])

  if (!open) return null

  return (
    <>
      <button
        type="button"
        aria-label="Dismiss keyboard shortcuts"
        className="fixed inset-0 z-[calc(var(--lc-z-modal)-1)] bg-[color-mix(in_srgb,var(--lc-surface-inverse)_40%,transparent)]"
        onClick={() => onOpenChange?.(false)}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={cn(
          'fixed inset-y-0 end-0 z-modal flex w-full max-w-sm flex-col',
          'border-s border-[var(--lc-border)] bg-[var(--lc-surface-raised)]',
          'p-[var(--lc-space-md)] shadow-[var(--lc-elevation-lg)]',
          className,
        )}
      >
        <div className="mb-4 flex items-center justify-between gap-2">
          <h2
            id={titleId}
            className="text-[var(--lc-text-heading)]"
            style={{ font: 'var(--lc-type-heading-3)' }}
          >
            {title}
          </h2>
          <Button
            ref={closeRef}
            type="button"
            variant="ghost"
            size="sm"
            aria-label="Close keyboard shortcuts"
            onClick={() => onOpenChange?.(false)}
          >
            Esc
          </Button>
        </div>

        <ul className="flex flex-1 flex-col gap-2 overflow-y-auto">
          {shortcuts.map((item) => (
            <li
              key={item.keys}
              className="flex items-center justify-between gap-3 rounded-[var(--lc-radius-md)] px-2 py-2"
            >
              <span className="text-sm text-[var(--lc-text-primary)]">{item.description}</span>
              <Badge variant="outline" className="shrink-0 font-[family-name:var(--lc-font-mono)]">
                <kbd>{item.keys}</kbd>
              </Badge>
            </li>
          ))}
        </ul>

        <p className="mt-4 text-xs text-[var(--lc-text-muted)]">
          Keyboard-first: every row action reachable without a pointer.
        </p>
      </div>
    </>
  )
}
