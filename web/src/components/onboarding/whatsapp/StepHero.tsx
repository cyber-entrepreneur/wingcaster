import type { LucideIcon } from 'lucide-react'
import { ChannelMark } from '@/components/ui/channel-mark'
import { cn } from '@/lib/utils'

export type StepHeroEmphasis = 'neutral' | 'default' | 'success'

export type StepHeroGlyph = LucideIcon | 'whatsapp-mark' | 'listing-mark'

export interface StepHeroProps {
  /**
   * Lucide icon, official WhatsApp channel mark, or listing mark placeholder.
   * `'whatsapp-mark'` resolves to `<ChannelMark channel="whatsapp">`.
   */
  glyph: StepHeroGlyph
  title: string
  body: string
  /**
   * Brief palette: `'neutral' | 'success'` (`neutral` default).
   * Prep also accepts `'default'` as an alias for `'neutral'`.
   * `success` — loud-orange `--lc-action-primary` band; legal ONLY on AGT-WLB-005.
   */
  emphasis?: StepHeroEmphasis
  className?: string
  /** Override the default `step-hero-title` id when multiple heroes mount. */
  titleId?: string
}

/**
 * Calm guidance header for a WhatsApp intake tour step.
 *
 * Used by: AGT-WLB-001, AGT-WLB-002, AGT-WLB-003, AGT-WLB-004 (neutral/default);
 * AGT-WLB-005 only for `emphasis="success"`.
 *
 * Distinct from REC-family `<StatusHero>` — StepHero is guidance, not outcome.
 * Stub visual + prop types only.
 */
export function StepHero({
  glyph,
  title,
  body,
  emphasis = 'neutral',
  className,
  titleId = 'step-hero-title',
}: StepHeroProps) {
  const isSuccess = emphasis === 'success'
  const GlyphIcon = typeof glyph === 'string' ? null : glyph

  return (
    <section
      aria-labelledby={titleId}
      className={cn(
        'flex w-full flex-col items-center px-[var(--lc-space-lg)] py-[var(--lc-space-xl)] text-center',
        'transition-[background-color] duration-[var(--lc-duration-slow)]',
        'ease-[var(--lc-easing-emphasis)] motion-reduce:transition-none',
        isSuccess
          ? 'bg-[var(--lc-action-primary)] text-[var(--lc-action-primary-text)]'
          : 'bg-[var(--lc-surface-sunken)] text-[var(--lc-text-primary)]',
        className,
      )}
    >
      <div
        aria-hidden
        className={cn(
          'mb-[var(--lc-space-md)] flex h-10 w-10 items-center justify-center rounded-full border md:h-12 md:w-12',
          isSuccess
            ? 'border-transparent bg-[var(--lc-surface-raised)] text-[var(--lc-action-primary)]'
            : 'border-[var(--lc-border)] bg-[var(--lc-surface-raised)] text-[var(--lc-text-brand)]',
        )}
      >
        {glyph === 'whatsapp-mark' ? (
          <ChannelMark channel="whatsapp" className="h-6 w-6 md:h-7 md:w-7" />
        ) : glyph === 'listing-mark' ? (
          <span className="text-xs font-semibold uppercase tracking-wide">LST</span>
        ) : GlyphIcon ? (
          <GlyphIcon className="h-6 w-6 md:h-7 md:w-7" />
        ) : null}
      </div>

      <h1
        id={titleId}
        className={cn(
          'max-w-xl font-extrabold tracking-tight',
          'text-[length:var(--lc-type-heading-1)] md:text-[length:var(--lc-type-display)]',
          isSuccess ? 'text-[var(--lc-action-primary-text)]' : 'text-[var(--lc-text-primary)]',
        )}
      >
        {title}
      </h1>

      <p
        className={cn(
          'mt-[var(--lc-space-sm)] max-w-xl text-[length:var(--lc-type-body-lg)]',
          isSuccess
            ? 'text-[var(--lc-action-primary-text)] opacity-90'
            : 'text-[var(--lc-text-secondary)]',
        )}
      >
        {body}
      </p>
    </section>
  )
}
