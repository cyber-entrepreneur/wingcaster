/**
 * AGN-DSH-002 agency onboarding checklist copy — EN + AR (real strings).
 * Wire target: GET/PATCH /api/agency/:agencyId/onboarding-state.
 * Backend checklist keys: branding, invites, billing, portal, listing, roles, 2FA.
 */

export type OnboardingLocale = 'en' | 'ar'

export const AGENCY_ONBOARDING_COPY = {
  'hero.greeting': { en: 'Welcome to WingCaster, {agency}', ar: 'مرحبًا بك في وينغكاستر، {agency}' },
  'hero.greetingFallback': { en: 'Welcome to WingCaster', ar: 'مرحبًا بك في وينغكاستر' },
  'hero.sub': {
    en: 'Let’s set your agency up for the whole team — 7 steps, most under 2 minutes each.',
    ar: 'لنُجهّز وكالتك للفريق بأكمله — 7 خطوات، معظمها أقل من دقيقتين لكل خطوة.',
  },
  'progress.caption': { en: 'complete', ar: 'مكتملة' },
  'progress.aria': {
    en: 'Setup progress: {n} of {total} complete',
    ar: 'تقدّم الإعداد: {n} من {total} مكتملة',
  },
  'section.overline': { en: 'Set up your agency workspace', ar: 'جهّز مساحة عمل وكالتك' },

  'task.branding.title': { en: 'Complete your agency profile', ar: 'أكمل ملف وكالتك' },
  'task.branding.desc': {
    en: 'Add your logo, description, address, and business license. Your public agency page uses this.',
    ar: 'أضِف شعارك ووصفك وعنوانك ورخصتك التجارية. تعتمد صفحة وكالتك العامة على هذه المعلومات.',
  },
  'task.branding.time': { en: '~5 min', ar: '~5 دقائق' },
  'task.branding.cta': { en: 'Start', ar: 'ابدأ' },

  'task.invites.title': { en: 'Invite team members', ar: 'ادعُ أعضاء الفريق' },
  'task.invites.desc': {
    en: 'Send agents an invite to join your agency. They’ll sign up under your workspace.',
    ar: 'أرسل للوكلاء دعوة للانضمام إلى وكالتك. سيسجّلون ضمن مساحة عملك.',
  },
  'task.invites.time': { en: '~2 min', ar: '~دقيقتان' },
  'task.invites.cta': { en: 'Invite', ar: 'ادعُ' },

  'task.billing.title': { en: 'Set up billing', ar: 'إعداد الفوترة' },
  'task.billing.desc': {
    en: 'Add a payment method through Paddle. Required to move off the free tier.',
    ar: 'أضِف طريقة دفع عبر Paddle. مطلوبة للانتقال من الباقة المجانية.',
  },
  'task.billing.time': { en: '~3 min', ar: '~3 دقائق' },
  'task.billing.cta': { en: 'Set up billing', ar: 'إعداد الفوترة' },
  'task.billing.badge': { en: 'Financial setup', ar: 'إعداد مالي' },

  'task.portal.title': { en: 'Connect your first portal', ar: 'اربط أول بوابة' },
  'task.portal.desc': {
    en: 'Bayut, Property Finder, Dubizzle, OLX, Aqar — connect a portal to publish there.',
    ar: 'بيوت، بروبرتي فايندر، دوبيزل، OLX، عقار — اربط بوابة للنشر عليها.',
  },
  'task.portal.time': { en: '~5 min', ar: '~5 دقائق' },
  'task.portal.cta': { en: 'Connect', ar: 'اربط' },

  'task.listing.title': { en: 'Publish your first listing', ar: 'انشر أول إعلان' },
  'task.listing.desc': {
    en: 'Get one property live. You’ll see the full publishing flow — portals, Bazaar, social.',
    ar: 'اجعل عقارًا واحدًا مباشرًا. سترى مسار النشر الكامل — البوابات والبازار ووسائل التواصل.',
  },
  'task.listing.time': { en: 'Varies', ar: 'يختلف' },
  'task.listing.cta': { en: 'New listing', ar: 'إعلان جديد' },

  'task.roles.title': { en: 'Set custom roles', ar: 'اضبط الأدوار المخصّصة' },
  'task.roles.desc': {
    en: 'Configure the Custom capability pack for your team’s specific needs.',
    ar: 'اضبط حزمة الصلاحيات المخصّصة وفق احتياجات فريقك.',
  },
  'task.roles.time': { en: '~5 min', ar: '~5 دقائق' },
  'task.roles.cta': { en: 'Configure', ar: 'اضبط' },

  'task.2FA.title': { en: 'Enable 2FA for your owner account', ar: 'فعّل المصادقة الثنائية لحساب المالك' },
  'task.2FA.desc': {
    en: 'Protect your agency with two-factor authentication. TOTP or SMS.',
    ar: 'احمِ وكالتك بالمصادقة الثنائية. عبر تطبيق TOTP أو الرسائل القصيرة.',
  },
  'task.2FA.time': { en: '~3 min', ar: '~3 دقائق' },
  'task.2FA.cta': { en: 'Enable 2FA', ar: 'تفعيل المصادقة الثنائية' },

  'cta.review': { en: 'Review', ar: 'مراجعة' },
  'status.done': { en: 'done', ar: 'مكتملة' },
  'status.todo': { en: 'to do', ar: 'قيد الإنجاز' },

  'placeholder.partial': { en: 'You’re on your way — {n} of 7 done.', ar: 'أنت في طريقك — {n} من 7 مكتملة.' },
  'placeholder.done': { en: 'All set. Take me to my dashboard', ar: 'كل شيء جاهز. اذهب إلى لوحتي' },
  'celebration': {
    en: 'Your agency is set up. Welcome to the network.',
    ar: 'تم إعداد وكالتك. مرحبًا بك في الشبكة.',
  },

  'dismiss.link': { en: 'Dismiss for now', ar: 'إخفاء الآن' },
  'dismiss.confirm.title': { en: 'Hide this checklist?', ar: 'إخفاء قائمة التحقق؟' },
  'dismiss.confirm.body': {
    en: 'You can bring it back from your dashboard’s Setup menu at any time.',
    ar: 'يمكنك إعادتها من قائمة الإعداد في لوحتك في أي وقت.',
  },
  'dismiss.confirm.keep': { en: 'Keep it', ar: 'الإبقاء عليها' },
  'dismiss.confirm.dismiss': { en: 'Dismiss', ar: 'إخفاء' },
  'dismiss.banner': { en: 'You’ve dismissed this checklist.', ar: 'لقد أخفيت قائمة التحقق هذه.' },
  'dismiss.undo': { en: 'Undo', ar: 'تراجع' },

  'error.load': {
    en: 'We couldn’t load your setup progress. Try again?',
    ar: 'تعذّر تحميل تقدّم الإعداد. حاول مرة أخرى؟',
  },
  'error.save': {
    en: 'We couldn’t save your progress. Try again?',
    ar: 'تعذّر حفظ تقدّمك. حاول مرة أخرى؟',
  },
  'action.retry': { en: 'Retry', ar: 'إعادة المحاولة' },
  'loading': { en: 'Loading your setup progress', ar: 'جارٍ تحميل تقدّم الإعداد' },
} as const

export type AgencyOnboardingCopyKey = keyof typeof AGENCY_ONBOARDING_COPY

export function tOnboarding(
  key: AgencyOnboardingCopyKey,
  locale: OnboardingLocale,
  vars?: Record<string, string | number>,
): string {
  let value: string = AGENCY_ONBOARDING_COPY[key][locale]
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      value = value.replace(`{${k}}`, String(v))
    }
  }
  return value
}

/** Task definitions — checklist key ↔ deep-link (all real routes on main). */
export interface AgencyTaskDef {
  key: string
  titleKey: AgencyOnboardingCopyKey
  descKey: AgencyOnboardingCopyKey
  timeKey: AgencyOnboardingCopyKey
  ctaKey: AgencyOnboardingCopyKey
  href: string
  financial?: boolean
}

export const AGENCY_TASKS: AgencyTaskDef[] = [
  {
    key: 'branding',
    titleKey: 'task.branding.title',
    descKey: 'task.branding.desc',
    timeKey: 'task.branding.time',
    ctaKey: 'task.branding.cta',
    href: '/agency',
  },
  {
    key: 'invites',
    titleKey: 'task.invites.title',
    descKey: 'task.invites.desc',
    timeKey: 'task.invites.time',
    ctaKey: 'task.invites.cta',
    href: '/agency',
  },
  {
    key: 'billing',
    titleKey: 'task.billing.title',
    descKey: 'task.billing.desc',
    timeKey: 'task.billing.time',
    ctaKey: 'task.billing.cta',
    href: '/my-subscription',
    financial: true,
  },
  {
    key: 'portal',
    titleKey: 'task.portal.title',
    descKey: 'task.portal.desc',
    timeKey: 'task.portal.time',
    ctaKey: 'task.portal.cta',
    href: '/settings/channels',
  },
  {
    key: 'listing',
    titleKey: 'task.listing.title',
    descKey: 'task.listing.desc',
    timeKey: 'task.listing.time',
    ctaKey: 'task.listing.cta',
    href: '/listings',
  },
  {
    key: 'roles',
    titleKey: 'task.roles.title',
    descKey: 'task.roles.desc',
    timeKey: 'task.roles.time',
    ctaKey: 'task.roles.cta',
    href: '/agency/settings/roles',
  },
  {
    key: '2FA',
    titleKey: 'task.2FA.title',
    descKey: 'task.2FA.desc',
    timeKey: 'task.2FA.time',
    ctaKey: 'task.2FA.cta',
    href: '/settings',
  },
]

/** Normalize a checklist value (boolean or {done}) to a boolean. */
export function isTaskDone(value: unknown): boolean {
  if (value === true) return true
  if (value && typeof value === 'object' && 'done' in value) {
    return Boolean((value as { done?: unknown }).done)
  }
  return false
}
