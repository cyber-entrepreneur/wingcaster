import type { ReactNode } from 'react'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export type TourFrameStep = 1 | 2 | 3 | 4 | 5

export interface TourFrameProps {
  /** 1-based active step (AGT-WLB-001…005 map to steps 2…5 of the tour; step 1 reserved). */
  step: TourFrameStep
  /** Always 5 for the AGT-WLB family. */
  totalSteps: 5
  /** Screen title under the progress dots (parent supplies i18n). */
  title: string
  /**
   * Safe-exit handler. Navigates to the fallback route and drops a persistent
   * "resume tour" banner — does NOT open a confirm dialog.
   */
  onExit: () => void
  children: ReactNode
  className?: string
}

/**
 * WhatsApp intake tour chrome: 5-dot progress rail + safe-exit close.
 *
 * Used by: AGT-WLB-001, AGT-WLB-002, AGT-WLB-003, AGT-WLB-004, AGT-WLB-005
 * (and any future AGT-ONB tour steps that opt into the same frame).
 *
 * Stub visual + prop types only — no navigation / banner side-effects.
 */
export function TourFrame({
  step,
  totalSteps,
  title,
  onExit,
  children,
  className,
}: TourFrameProps) {
  const steps = Array.from({ length: totalSteps }, (_, i) => (i + 1) as TourFrameStep)

  return (
    <div
      className={cn(
        'flex min-h-full flex-col bg-[var(--lc-surface)] text-[var(--lc-text-primary)]',
        className,
      )}
    >
      <header
        className={cn(
          'sticky top-0 z-10 flex flex-col border-b border-[var(--lc-border)]',
          'bg-[var(--lc-surface-raised)] pt-[env(safe-area-inset-top)]',
        )}
      >
        <div className="relative flex min-h-12 items-center justify-center px-[var(--lc-space-md)]">
          <ol
            role="progressbar"
            aria-valuenow={step}
            aria-valuemin={1}
            aria-valuemax={totalSteps}
            aria-valuetext={`Step ${step} of ${totalSteps}: ${title}`}
            className="flex items-center gap-2"
          >
            {steps.map((n) => {
              const completed = n < step
              const active = n === step
              return (
                <li
                  key={n}
                  aria-current={active ? 'step' : undefined}
                  className={cn(
                    'h-2.5 w-2.5 rounded-full border transition-[background-color,border-color,transform]',
                    'duration-[var(--lc-duration-base)] ease-[var(--lc-easing-out)]',
                    completed &&
                      'border-[var(--lc-accent-bold-edge)] bg-[var(--lc-accent-bold)]',
                    active &&
                      'scale-110 border-[var(--lc-action-primary)] bg-[var(--lc-action-primary)]',
                    !completed &&
                      !active &&
                      'border-[var(--lc-border-strong)] bg-transparent',
                  )}
                />
              )
            })}
          </ol>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute end-2 top-1/2 -translate-y-1/2"
            aria-label="Exit setup — you can resume from settings"
            onClick={onExit}
          >
            <X className="h-5 w-5" aria-hidden />
          </Button>
        </div>

        <p
          className={cn(
            'pb-[var(--lc-space-sm)] text-center text-[length:var(--lc-type-caption)]',
            'text-[var(--lc-text-muted)]',
          )}
        >
          {title}
        </p>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
    </div>
  )
}
