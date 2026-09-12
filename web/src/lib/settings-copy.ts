import type { AppLocale } from '@/hooks/useLocale'

export const SETTINGS_COPY = {
  en: {
    title: 'Settings',
    'sub.desktopOnly': 'Manage your account, security, billing, and workspace preferences.',
    'search.placeholder': 'Search settings',
    'search.hotkey.mac': '⌘/',
    'search.hotkey.win': 'Ctrl+/',
    'search.empty': "No settings match '{query}'. Try 'password', '2FA', 'invoices', or 'notifications'.",
    'search.clear': 'Clear search',
    'search.label': 'Search settings',
    'footer.feedback': 'Send feedback',
    'footer.offline': "You're offline — some settings may be stale.",
    'error.load': 'Some settings could not be loaded.',
    'error.retry': 'Retry',
    'anchor.editProfile': 'Edit profile',
    'anchor.greeting': 'Signed in via {method}',
    'anchor.security.2fa.on': 'On',
    'anchor.security.2fa.off': 'Off',
    'anchor.security.2fa.action': 'Manage two-factor',
    'anchor.security.sessions.action': 'Manage sessions',
    'anchor.security.password.last': 'Last changed {relativeTime}',
    'anchor.security.password.action': 'Change',
    'anchor.billing.title': 'Current plan',
    'anchor.billing.renewsOn': 'Renews on {date}',
    'anchor.billing.action': 'Manage subscription',
    'anchor.activity.title': 'Recent account activity',
    'anchor.activity.empty': 'No recent activity.',
    'anchor.danger.hint': 'Need to delete your account?',
    'badge.2faOff': '2FA off',
    'badge.pastDue': 'Past due',
  },
  ar: {
    title: 'الإعدادات',
    'sub.desktopOnly': 'إدارة حسابك، الأمان، الفوترة، وتفضيلات مساحة العمل.',
    'search.placeholder': 'ابحث في الإعدادات',
    'search.hotkey.mac': '⌘/',
    'search.hotkey.win': 'Ctrl+/',
    'search.empty': "لا توجد إعدادات تطابق '{query}'. جرّب 'كلمة المرور'، '2FA'، 'الفواتير'، أو 'الإشعارات'.",
    'search.clear': 'مسح البحث',
    'search.label': 'ابحث في الإعدادات',
    'footer.feedback': 'إرسال ملاحظات',
    'footer.offline': '[TRANSLATION-PENDING]',
    'error.load': '[TRANSLATION-PENDING]',
    'error.retry': '[TRANSLATION-PENDING]',
    'anchor.editProfile': 'تعديل الملف',
    'anchor.greeting': 'مسجّل الدخول عبر {method}',
    'anchor.security.2fa.on': 'مفعّل',
    'anchor.security.2fa.off': 'معطّل',
    'anchor.security.2fa.action': 'إدارة المصادقة الثنائية',
    'anchor.security.sessions.action': 'إدارة الجلسات',
    'anchor.security.password.last': 'آخر تغيير {relativeTime}',
    'anchor.security.password.action': 'تغيير',
    'anchor.billing.title': 'الخطة الحالية',
    'anchor.billing.renewsOn': 'يُجدَّد في {date}',
    'anchor.billing.action': 'إدارة الاشتراك',
    'anchor.activity.title': 'نشاط الحساب الأخير',
    'anchor.activity.empty': 'لا يوجد نشاط حديث.',
    'anchor.danger.hint': 'تحتاج إلى حذف حسابك؟',
    'badge.2faOff': '2FA معطّل',
    'badge.pastDue': 'متأخّر',
  },
} as const

export type SettingsCopyKey = keyof typeof SETTINGS_COPY.en

export function settingsCopy(locale: AppLocale | string | undefined) {
  return locale === 'ar' ? SETTINGS_COPY.ar : SETTINGS_COPY.en
}

export function fillCopy(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(vars[key] ?? ''))
}

/** Search synonyms keyed by catalog item id (server never sends these). */
export const SETTINGS_SYNONYMS: Record<string, string[]> = {
  two_factor: ['2FA', 'MFA', 'two-factor', 'authenticator', 'totp'],
  sessions: ['devices', 'signed in', 'logout', 'sign out'],
  password: ['passwd', 'credentials', 'login'],
  profile: ['name', 'avatar', 'email', 'phone', 'username'],
  billing_notifications: ['alerts', 'email prefs', 'notifications'],
  subscription: ['plan', 'paddle', 'invoices', 'billing'],
  delete_account: ['close account', 'gdpr', 'erase', 'danger'],
}
