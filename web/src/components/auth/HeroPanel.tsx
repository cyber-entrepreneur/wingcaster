import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import { rt, type RegisterLocale } from './registerCopy'

export type HeroPanelProps = {
  locale?: RegisterLocale
  /** `full` = desktop right column; `compact` = mobile top block. */
  variant?: 'full' | 'compact'
  className?: string
  /** Optional illustration URL; on error falls back to gradient + wordmark. */
  illustrationSrc?: string
}

const VALUE_KEYS = ['value.1', 'value.2', 'value.3'] as const
const ROTATE_MS = 4000

/**
 * SHR-AUT-006 hero panel — gradient + illustration + rotating value props.
 * Uses Broadcast action-primary / accent / surface-inverse (no invented hero-gradient token).
 */
export function HeroPanel({
  locale = 'en',
  variant = 'full',
  className,
  illustrationSrc,
}: HeroPanelProps) {
  const [index, setIndex] = useState(0)
  const [imgFailed, setImgFailed] = useState(!illustrationSrc)

  useEffect(() => {
    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (prefersReduced) return
    const id = window.setInterval(() => {
      setIndex((i) => (i + 1) % VALUE_KEYS.length)
    }, ROTATE_MS)
    return () => window.clearInterval(id)
  }, [])

  const valueLine = rt(VALUE_KEYS[index], locale)
  const isCompact = variant === 'compact'
  // Distinct labels when both variants mount (mobile + desktop columns) — axe landmark-unique.
  const landmarkLabel = rt(isCompact ? 'hero.landmark.compact' : 'hero.landmark', locale)

  return (
    <aside
      aria-label={landmarkLabel}
      className={cn(
        'relative overflow-hidden text-[var(--lc-text-inverse)]',
        isCompact
          ? 'rounded-[var(--lc-radius-lg)] p-[var(--lc-space-md)]'
          : 'flex h-full min-h-full flex-col justify-between p-[var(--lc-space-3xl)]',
        className,
      )}
      data-testid="hero-panel"
      data-variant={variant}
      style={{
        background:
          'linear-gradient(135deg, var(--lc-action-primary) 0%, color-mix(in srgb, var(--lc-surface-inverse) 70%, var(--lc-action-primary)) 55%, var(--lc-surface-inverse) 100%)',
      }}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        aria-hidden
        style={{
          backgroundImage: 'linear-gradient(225deg, var(--lc-accent) 0%, transparent 45%)',
        }}
      />

      <div
        className={cn(
          'relative z-[1] flex flex-col',
          isCompact ? 'gap-[var(--lc-space-sm)]' : 'flex-1 gap-[var(--lc-space-xl)]',
        )}
      >
        <div
          className={cn(
            'flex items-center justify-center rounded-[var(--lc-radius-lg)]',
            isCompact ? 'h-[200px]' : 'min-h-[280px] flex-1',
          )}
          style={{
            border: '1px solid color-mix(in srgb, var(--lc-text-inverse) 20%, transparent)',
            background: 'color-mix(in srgb, var(--lc-text-inverse) 10%, transparent)',
          }}
        >
          {!imgFailed && illustrationSrc ? (
            <img
              src={illustrationSrc}
              alt={rt('hero.illustration.alt', locale)}
              className={cn(
                'max-h-full w-auto object-contain',
                isCompact ? 'max-h-[180px]' : 'max-h-[480px]',
              )}
              onError={() => setImgFailed(true)}
            />
          ) : (
            <div className="flex flex-col items-center gap-2 px-4 text-center">
              <span
                className="opacity-95"
                style={{
                  font: 'var(--lc-type-display)',
                  letterSpacing: 'var(--lc-tracking-display)',
                }}
              >
                {rt('hero.illustration.fallback', locale)}
              </span>
              {!isCompact ? (
                <span className="opacity-70" style={{ font: 'var(--lc-type-caption)' }}>
                  {rt('hero.illustration.alt', locale)}
                </span>
              ) : null}
            </div>
          )}
        </div>

        <p
          className="relative z-[1] max-w-md"
          style={{ font: isCompact ? 'var(--lc-type-body)' : 'var(--lc-type-heading-3)' }}
          aria-live="polite"
          data-testid="hero-value-prop"
        >
          {valueLine}
        </p>
      </div>

      {!isCompact ? (
        <div className="relative z-[1] mt-[var(--lc-space-xl)] flex flex-col gap-[var(--lc-space-sm)]">
          <div className="flex -space-x-2 rtl:space-x-reverse" aria-hidden>
            {[0, 1, 2, 3, 4].map((i) => (
              <span
                key={i}
                className="inline-block h-8 w-8 rounded-full border-2 border-[var(--lc-surface-inverse)]"
                style={{
                  background: `color-mix(in srgb, var(--lc-accent) ${20 + i * 12}%, var(--lc-surface-raised))`,
                }}
              />
            ))}
          </div>
          <p style={{ font: 'var(--lc-type-caption)' }} className="opacity-90">
            {rt('hero.trusted', locale)}
          </p>
        </div>
      ) : null}
    </aside>
  )
}
