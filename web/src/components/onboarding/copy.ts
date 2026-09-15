/**
 * Shared onboarding UI copy (pill + checklist card) — EN + AR.
 * Shape matches `loginCopy.ts` LOGIN_COPY / t().
 */

export type OnboardingUiLocale = 'en' | 'ar'

export const ONBOARDING_UI_COPY = {
  'pill.aria': {
    en: 'Finish setting up — {completed} of {total} steps done',
    ar: 'أكمل الإعداد — {completed} من {total} خطوات منجزة',
  },
  'card.title': {
    en: 'Finish setting up',
    ar: 'أكمل الإعداد',
  },
  'card.sub.partial': {
    en: "You're {pct}% there — {remaining} steps left.",
    ar: 'أنت عند {pct}% — متبقّي {remaining} خطوات.',
  },
  'card.sub.done': {
    en: "You're all set. Nice work.",
    ar: 'أنت جاهز تمامًا. عمل رائع.',
  },
  'card.showCompleted': {
    en: 'Show completed ({n})',
    ar: 'أظهر المكتمل ({n})',
  },
  'card.hideCompleted': {
    en: 'Hide completed',
    ar: 'أخفِ المكتمل',
  },
  'card.dismiss': {
    en: 'Dismiss this checklist',
    ar: 'إخفاء قائمة التحقق',
  },
  'card.optional': {
    en: 'Optional',
    ar: 'اختياري',
  },
  'card.collapse': {
    en: 'Collapse checklist',
    ar: 'طيّ القائمة',
  },
  'card.expand': {
    en: 'Expand checklist',
    ar: 'توسيع القائمة',
  },
} as const

export type OnboardingUiCopyKey = keyof typeof ONBOARDING_UI_COPY

export function tUi(
  key: OnboardingUiCopyKey,
  locale: OnboardingUiLocale,
  vars?: Record<string, string | number>,
): string {
  let value: string = ONBOARDING_UI_COPY[key][locale]
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      value = value.replace(`{${k}}`, String(v))
    }
  }
  return value
}
