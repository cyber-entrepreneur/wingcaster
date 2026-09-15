import { Numeric } from '@/components/ui/numeric'
import { useLocale } from '@/hooks/useLocale'
import { act, type ActivationLocale } from '../copy'

export function ActivationCelebrationBanner() {
  const { locale: rawLocale } = useLocale()
  const locale = (rawLocale === 'ar' ? 'ar' : 'en') as ActivationLocale
  return (
    <div
      role="status"
      aria-live="polite"
      className="mb-[var(--lc-space-sm)] rounded-[var(--lc-radius-md)] bg-[var(--lc-status-published-bg)] px-[var(--lc-space-md)] py-[var(--lc-space-sm)] text-[var(--lc-status-published-fg)] motion-reduce:animate-none motion-safe:animate-in motion-safe:slide-in-from-top-2"
      style={{
        font: 'var(--lc-type-heading-3)',
        animationTimingFunction: 'var(--lc-easing-emphasis)',
        animationDuration: 'var(--lc-duration-slow)',
      }}
      data-activation-celebration
    >
      {act('celebration.title', locale)}{' '}
      <span className="sr-only">
        <Numeric>{act('celebration.sr', locale)}</Numeric>
      </span>
    </div>
  )
}
