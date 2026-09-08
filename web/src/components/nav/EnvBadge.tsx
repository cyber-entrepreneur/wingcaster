import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { Radio, TestTube } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { WingcasterEnv } from '@/hooks/useEnv'
import type { AppLocale } from '@/hooks/useLocale'

/** PA-NAV-001 copy table — safety token never translates. */
export const ENV_SWITCHER_COPY = {
  'badge.live': { en: 'LIVE', ar: 'مباشر' },
  'badge.test': { en: 'TEST', ar: 'اختبار' },
  'badge.aria.live': {
    en: 'Environment: LIVE. Click to switch.',
    ar: 'البيئة: مباشر. انقر للتبديل.',
  },
  'badge.aria.test': {
    en: 'Environment: TEST. Click to switch.',
    ar: 'البيئة: اختبار. انقر للتبديل.',
  },
  'popover.row.live.label': { en: 'LIVE', ar: 'مباشر' },
  'popover.row.live.desc': {
    en: 'Production data + real Paddle merchant',
    ar: 'بيانات الإنتاج + تاجر Paddle حقيقي',
  },
  'popover.row.test.label': { en: 'TEST', ar: 'اختبار' },
  'popover.row.test.desc': {
    en: 'Sandbox data + sandbox Paddle merchant',
    ar: 'بيانات وضع الاختبار + تاجر Paddle للاختبار',
  },
  'popover.footer.note': {
    en: 'Env changes reload the current page. Confirm on LIVE-bound switches.',
    ar: 'تغيير البيئة يعيد تحميل الصفحة. تأكيد مطلوب للتبديل إلى المباشر.',
  },
  'strip.warning.text': {
    en: 'You are in TEST environment. Actions here do not affect production.',
    ar: 'أنت في بيئة الاختبار. الإجراءات هنا لا تؤثر على الإنتاج.',
  },
  'strip.warning.link': { en: 'Switch to LIVE →', ar: 'التبديل إلى المباشر ←' },
  'confirm.title': { en: 'Switch to LIVE?', ar: 'التبديل إلى المباشر؟' },
  'confirm.body': {
    en: "You're about to switch the admin console to LIVE. Any actions you take will affect real customers, real payments, and real audit records.",
    ar: 'أنت على وشك تبديل وحدة الإدارة إلى بيئة الإنتاج. أي إجراء تقوم به سيؤثر على عملاء حقيقيين ومدفوعات حقيقية وسجلات تدقيق حقيقية.',
  },
  'confirm.check1': {
    en: 'I understand this switches the entire session context.',
    ar: 'أدرك أن هذا يبدّل سياق الجلسة بالكامل.',
  },
  'confirm.check2': {
    en: 'I understand any subsequent action affects production data.',
    ar: 'أدرك أن أي إجراء لاحق يؤثر على بيانات الإنتاج.',
  },
  'confirm.type.label': {
    en: 'Type SWITCH TO LIVE to confirm.',
    ar: 'اكتب SWITCH TO LIVE للتأكيد.',
  },
  'confirm.type.value': { en: 'SWITCH TO LIVE', ar: 'SWITCH TO LIVE' },
  'confirm.cancel': { en: 'Cancel', ar: 'إلغاء' },
  'confirm.cta': { en: 'Switch to LIVE', ar: 'التبديل إلى المباشر' },
  'confirm.sessionChanged': {
    en: 'Session env changed elsewhere; refresh to continue.',
    ar: 'تغيرت بيئة الجلسة في تبويب آخر؛ حدّث الصفحة للمتابعة.',
  },
  'toast.switched.live': {
    en: 'Switched to LIVE environment.',
    ar: 'تم التبديل إلى بيئة المباشر.',
  },
  'toast.switched.test': {
    en: 'Switched to TEST environment.',
    ar: 'تم التبديل إلى بيئة الاختبار.',
  },
  'error.switchFailed': {
    en: "Couldn't switch environments. Try again.",
    ar: 'تعذّر تبديل البيئات. حاول مرة أخرى.',
  },
  'switching.label': { en: 'Switching…', ar: 'جارٍ التبديل…' },
} as const

export type EnvCopyKey = keyof typeof ENV_SWITCHER_COPY

export function envCopy(key: EnvCopyKey, locale: AppLocale): string {
  return ENV_SWITCHER_COPY[key][locale]
}

export interface EnvBadgeProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  env: WingcasterEnv
  locale?: AppLocale
}

/**
 * PA-NAV-001 — always-visible LIVE / TEST badge for the PA top bar.
 * Presentational trigger; wire with EnvSwitcherPopover.
 */
export const EnvBadge = forwardRef<HTMLButtonElement, EnvBadgeProps>(function EnvBadge(
  { env, locale = 'en', className, ...rest },
  ref,
) {
  const isLive = env === 'live'
  const label = isLive ? envCopy('badge.live', locale) : envCopy('badge.test', locale)
  const aria = isLive ? envCopy('badge.aria.live', locale) : envCopy('badge.aria.test', locale)
  const Icon = isLive ? Radio : TestTube

  return (
    <button
      ref={ref}
      type="button"
      role="button"
      aria-haspopup="dialog"
      aria-label={aria}
      className={cn(
        'inline-flex h-6 min-h-6 items-center gap-[var(--lc-space-2xs)]',
        'rounded-[var(--lc-radius-sm)] px-[10px] py-[4px]',
        'font-[var(--lc-type-caption)] font-semibold tracking-[var(--lc-tracking-caption)]',
        'transition-colors duration-[var(--lc-duration-fast)] ease-[var(--lc-easing-out)]',
        'motion-reduce:transition-none',
        'focus-visible:outline-none cursor-pointer',
        isLive
          ? 'bg-[var(--lc-status-published-dot)] text-[var(--lc-text-inverse)] hover:bg-[var(--lc-status-published-fg)]'
          : 'bg-[var(--lc-status-underOffer-dot)] text-[var(--lc-status-underOffer-fg)] hover:bg-[var(--lc-status-underOffer-fg)] hover:text-[var(--lc-text-inverse)]',
        className,
      )}
      {...rest}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span>{label}</span>
    </button>
  )
})
