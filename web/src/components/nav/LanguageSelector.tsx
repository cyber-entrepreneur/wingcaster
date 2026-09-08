import { useId, useRef, useState, type KeyboardEvent } from 'react'
import { useToast } from '@/components/ui/toast'
import { cn } from '@/lib/utils'
import { useLocale, type AppLocale } from '@/hooks/useLocale'

/** Copy table from SHR-NAV-006 — pill labels NEVER translate. */
export const LANGUAGE_SELECTOR_COPY = {
  'label.en': { en: 'EN', ar: 'EN' },
  'label.ar': { en: 'العربية', ar: 'العربية' },
  'aria.control': { en: 'Language', ar: 'اللغة' },
  'aria.selected.en': { en: 'English selected', ar: 'تم اختيار الإنجليزية' },
  'aria.selected.ar': { en: 'Arabic selected', ar: 'تم اختيار العربية' },
  'announce.switched.en': {
    en: 'Language changed to English.',
    ar: 'تم تغيير اللغة إلى الإنجليزية.',
  },
  'announce.switched.ar': {
    en: 'Language changed to Arabic.',
    ar: 'تم تغيير اللغة إلى العربية.',
  },
  'error.switchFailed': {
    en: "Couldn't save your language preference. Try again.",
    ar: 'تعذّر حفظ تفضيل اللغة. يرجى المحاولة مرة أخرى.',
  },
} as const

type CopyKey = keyof typeof LANGUAGE_SELECTOR_COPY

function t(key: CopyKey, locale: AppLocale): string {
  return LANGUAGE_SELECTOR_COPY[key][locale]
}

const LOCALES: AppLocale[] = ['en', 'ar']

const ARABIC_PILL_FONT = '"IBM Plex Sans Arabic", Tahoma, "Segoe UI", sans-serif'

export interface LanguageSelectorProps {
  className?: string
}

/**
 * SHR-NAV-006 — segmented EN | العربية control.
 * Pill order is forced LTR so it never flips under `html[dir=rtl]`.
 */
export function LanguageSelector({ className }: LanguageSelectorProps) {
  const { locale, setLocale } = useLocale()
  const { addToast } = useToast()
  const labelId = useId()
  const [announcement, setAnnouncement] = useState('')
  const radiosRef = useRef<Array<HTMLButtonElement | null>>([])

  const switchTo = async (next: AppLocale) => {
    if (next === locale) return
    const result = await setLocale(next)
    setAnnouncement(
      next === 'en' ? t('announce.switched.en', next) : t('announce.switched.ar', next),
    )
    if (!result.ok) {
      addToast({
        variant: 'error',
        description: t('error.switchFailed', next),
      })
    }
  }

  const onRadioKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    // Control is always LTR: ArrowRight → ar, ArrowLeft → en.
    let targetIndex = index
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      event.preventDefault()
      targetIndex = (index + 1) % LOCALES.length
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      event.preventDefault()
      targetIndex = (index - 1 + LOCALES.length) % LOCALES.length
    } else if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault()
      void switchTo(LOCALES[index])
      return
    } else {
      return
    }
    radiosRef.current[targetIndex]?.focus()
    void switchTo(LOCALES[targetIndex])
  }

  return (
    <div className={cn('inline-flex flex-col items-stretch gap-[var(--lc-space-2xs)]', className)}>
      <span id={labelId} className="sr-only">
        {t('aria.control', locale)}
      </span>
      <div
        role="radiogroup"
        aria-labelledby={labelId}
        dir="ltr"
        className={cn(
          'relative inline-grid grid-cols-2 items-stretch',
          'min-h-[var(--lc-tap-target-min)]',
          'rounded-[var(--lc-radius-pill)] border border-[var(--lc-border)]',
          'bg-[var(--lc-surface-sunken)] p-[var(--lc-space-3xs)]',
          'gap-[var(--lc-space-3xs)]',
        )}
      >
        <span
          aria-hidden="true"
          className={cn(
            'pointer-events-none absolute inset-y-[var(--lc-space-3xs)] left-[var(--lc-space-3xs)] z-0',
            'w-[calc((100%-var(--lc-space-3xs)*2-var(--lc-space-3xs))/2)]',
            'rounded-[var(--lc-radius-pill)]',
            'bg-[var(--lc-surface-raised)] shadow-[var(--lc-elevation-sm)]',
            'transition-transform duration-[var(--lc-duration-base)] ease-[var(--lc-easing-in-out)]',
            'motion-reduce:transition-none',
            locale === 'ar'
              ? 'translate-x-[calc(100%+var(--lc-space-3xs))]'
              : 'translate-x-0',
          )}
        />

        {LOCALES.map((value, index) => {
          const checked = locale === value
          const label = value === 'en' ? t('label.en', locale) : t('label.ar', locale)
          const ariaLabel =
            value === 'en' ? t('aria.selected.en', locale) : t('aria.selected.ar', locale)

          return (
            <button
              key={value}
              ref={(el) => {
                radiosRef.current[index] = el
              }}
              type="button"
              role="radio"
              aria-checked={checked}
              aria-label={ariaLabel}
              tabIndex={checked ? 0 : -1}
              onClick={() => void switchTo(value)}
              onKeyDown={(event) => onRadioKeyDown(event, index)}
              className={cn(
                'relative z-10 inline-flex min-h-[var(--lc-tap-target-min)] min-w-[var(--lc-tap-target-min)]',
                'items-center justify-center rounded-[var(--lc-radius-pill)]',
                'px-[var(--lc-space-xs)] py-[var(--lc-space-2xs)]',
                'font-[var(--lc-type-body)] tracking-[var(--lc-tracking-body)]',
                'transition-colors duration-[var(--lc-duration-base)] ease-[var(--lc-easing-in-out)]',
                'motion-reduce:transition-none',
                'focus-visible:outline-none',
                checked
                  ? 'font-semibold text-[var(--lc-text-primary)]'
                  : 'font-medium text-[var(--lc-text-muted)] hover:bg-[var(--lc-action-secondary)]',
              )}
              style={value === 'ar' ? { fontFamily: ARABIC_PILL_FONT } : undefined}
            >
              {label}
            </button>
          )
        })}
      </div>

      <div role="status" aria-live="polite" className="sr-only">
        {announcement}
      </div>
    </div>
  )
}
