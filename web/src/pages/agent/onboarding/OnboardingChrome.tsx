import { LanguageSelector } from '@/components/nav/LanguageSelector'
import { OnboardingProgressMarker, type OnboardingStepIndex } from '@/components/onboarding'
import { ColorModeToggle } from '@/components/ui/color-mode-toggle'
import { cn } from '@/lib/utils'

export interface OnboardingChromeProps {
  step: OnboardingStepIndex
  label: string
  complete?: boolean
  className?: string
}

/**
 * Shared top bar for AGT-ONB-001…004: progress marker + language + color mode.
 * Onboarding routes use bare chrome so this is the only top bar.
 */
export function OnboardingChrome({ step, label, complete = false, className }: OnboardingChromeProps) {
  return (
    <header
      className={cn(
        'flex items-center justify-between gap-[var(--lc-space-sm)]',
        'px-[var(--lc-space-md)] py-[var(--lc-space-sm)]',
        'md:px-[var(--lc-space-xl)]',
        className,
      )}
    >
      <OnboardingProgressMarker step={step} of={4} label={label} complete={complete} />
      <div className="flex items-center gap-[var(--lc-space-sm)]">
        <div
          className="rounded-[var(--lc-radius-pill)] bg-[var(--lc-surface-sunken)] px-1 py-0.5 text-[var(--lc-text-primary)]"
        >
          <LanguageSelector />
        </div>
        <ColorModeToggle className="inline-flex h-tap w-tap min-h-tap min-w-tap items-center justify-center rounded-[var(--lc-radius-lg)] text-[var(--lc-text-muted)] hover:bg-[var(--lc-action-secondary)] hover:text-[var(--lc-text-primary)]" />
      </div>
    </header>
  )
}
