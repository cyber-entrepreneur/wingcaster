/**
 * AGT-DSH-002 Pro dashboard stub copy — EN + AR.
 * LOGIN_COPY shape (per-key `{ en, ar }`) matching `components/auth/loginCopy.ts`.
 */

export type DashboardLocale = 'en' | 'ar'

export const LOGIN_COPY = {
  'greeting.goodDay': {
    en: 'Good day, {name}',
    ar: 'يوم سعيد، {name}',
  },
  'greeting.nameFallback': {
    en: 'there',
    ar: 'هناك',
  },
  'action.newListing': {
    en: 'New listing',
    ar: 'إعلان جديد',
  },
  'action.contact': {
    en: 'Contact',
    ar: 'جهة اتصال',
  },
  'action.task': {
    en: 'Task',
    ar: 'مهمة',
  },
  'action.publish': {
    en: 'Publish',
    ar: 'نشر',
  },
  'action.inbox': {
    en: 'Inbox',
    ar: 'الوارد',
  },
  'action.search': {
    en: 'Search',
    ar: 'بحث',
  },
  'footer.density': {
    en: 'Pro · density TBD',
    ar: 'Pro · الكثافة قيد التحديد',
  },
  'widget.urgent': {
    en: 'Urgent',
    ar: 'عاجل',
  },
  'widget.quota': {
    en: 'Quota',
    ar: 'الحصة',
  },
  'widget.recentListings': {
    en: 'Recent listings',
    ar: 'أحدث الإعلانات',
  },
  'widget.inboxPreview': {
    en: 'Inbox preview',
    ar: 'معاينة الوارد',
  },
  'kpi.listings': {
    en: 'Listings',
    ar: 'الإعلانات',
  },
  'kpi.views': {
    en: 'Views',
    ar: 'المشاهدات',
  },
  'kpi.inquiries': {
    en: 'Inquiries',
    ar: 'الاستفسارات',
  },
  'kpi.pipeline': {
    en: 'Pipeline',
    ar: 'المسار',
  },
  'widget.slotPlaceholder': {
    en: 'Widget slot — Agent 1',
    ar: 'خانة الودجة — الوكيل 1',
  },
  'aria.widgetGrid': {
    en: 'Pro dashboard widgets',
    ar: 'ودجات لوحة Pro',
  },
  'common.loading': {
    en: 'Loading',
    ar: 'جارٍ التحميل',
  },
} as const

export type DashboardCopyKey = keyof typeof LOGIN_COPY

export function t(
  key: DashboardCopyKey,
  locale: DashboardLocale,
  vars?: Record<string, string | number>,
): string {
  let value: string = LOGIN_COPY[key][locale]
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      value = value.replace(`{${k}}`, String(v))
    }
  }
  return value
}

