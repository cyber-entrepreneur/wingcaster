/**
 * AGT-ACT activation wizard copy — EN + AR (MENA business tone).
 * Shape mirrors LOGIN_COPY: every string is `{ en, ar }`, resolved via `useLocale()`.
 */

import type { ActivationStep, CompletedVia, SignupPath } from './types'

export type ActivationLocale = 'en' | 'ar'

export type LocalizedString = { en: string; ar: string }

export function at(entry: LocalizedString, locale: ActivationLocale): string {
  return entry[locale] || entry.en
}

export function t(
  entry: LocalizedString,
  locale: ActivationLocale,
  vars?: Record<string, string | number>,
): string {
  let value = at(entry, locale)
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      value = value.split(`{${k}}`).join(String(v))
    }
  }
  return value
}

export const COMPLETED_VIA_LABEL: Record<string, LocalizedString> = {
  onboarding: { en: 'onboarding', ar: 'الإعداد الأولي' },
  whatsapp_intake: { en: 'WhatsApp intake', ar: 'استقبال واتساب' },
  dashboard_action: { en: 'dashboard', ar: 'لوحة التحكم' },
  direct: { en: 'direct', ar: 'مباشر' },
  bulk_import: { en: 'bulk import', ar: 'استيراد جماعي' },
}

export function completedViaPhrase(
  via: CompletedVia | string | null | undefined,
  locale: ActivationLocale = 'en',
): string {
  if (!via) return ''
  const entry = COMPLETED_VIA_LABEL[via]
  if (entry) return at(entry, locale)
  return String(via).replace(/_/g, ' ')
}

export const COUNTRY_NAMES: Record<string, LocalizedString> = {
  AE: { en: 'United Arab Emirates', ar: 'الإمارات العربية المتحدة' },
  SA: { en: 'Saudi Arabia', ar: 'المملكة العربية السعودية' },
  LB: { en: 'Lebanon', ar: 'لبنان' },
  EG: { en: 'Egypt', ar: 'مصر' },
  QA: { en: 'Qatar', ar: 'قطر' },
  KW: { en: 'Kuwait', ar: 'الكويت' },
  BH: { en: 'Bahrain', ar: 'البحرين' },
  OM: { en: 'Oman', ar: 'عُمان' },
  JO: { en: 'Jordan', ar: 'الأردن' },
}

export function countryDisplayName(
  code: string | null | undefined,
  locale: ActivationLocale = 'en',
): string {
  if (!code) return at({ en: 'your country', ar: 'بلدك' }, locale)
  const entry = COUNTRY_NAMES[code.toUpperCase()]
  if (entry) return at(entry, locale)
  return code.toUpperCase()
}

export const INVITE_TEAM_COPY = {
  agencyTitle: { en: 'Invite your team', ar: 'ادعُ فريقك' },
  growTitle: {
    en: "Grow into an agency (when you're ready)",
    ar: 'حوّل عملك إلى وكالة (عندما تكون جاهزًا)',
  },
  agencyDescription: {
    en: 'Bring your agents into your workspace. Share a code, a link, or bulk-email invitations.',
    ar: 'أضِف وسطاءك إلى مساحة عملك. شارك رمزًا أو رابطًا أو أرسل دعوات جماعية بالبريد.',
  },
  joinDescription: {
    en: 'Invite is managed by your agency owner.',
    ar: 'إدارة الدعوات من صلاحيات مالك الوكالة.',
  },
  soloDescription: {
    en: 'Available if you register an agency workspace later.',
    ar: 'متاح إذا سجّلت مساحة عمل للوكالة لاحقًا.',
  },
  learnCta: { en: 'Learn about agencies', ar: 'تعرّف على الوكالات' },
} as const

export function inviteTeamTitle(path: SignupPath, locale: ActivationLocale = 'en'): string {
  return at(path === 'agency' ? INVITE_TEAM_COPY.agencyTitle : INVITE_TEAM_COPY.growTitle, locale)
}

export function inviteTeamDescription(path: SignupPath, locale: ActivationLocale = 'en'): string {
  if (path === 'agency') return at(INVITE_TEAM_COPY.agencyDescription, locale)
  if (path === 'join') return at(INVITE_TEAM_COPY.joinDescription, locale)
  return at(INVITE_TEAM_COPY.soloDescription, locale)
}

export type StepCopyEntry = {
  title: LocalizedString
  description: LocalizedString
  cta: LocalizedString
  resumeCta: LocalizedString
}

export const STEP_COPY: Record<string, StepCopyEntry> = {
  whatsapp: {
    title: { en: 'Connect WhatsApp', ar: 'اربط واتساب' },
    description: {
      en: 'Bind your business WhatsApp so leads land in your WingCaster inbox from the first hello.',
      ar: 'اربط واتساب الأعمال ليصل العملاء المحتملون إلى صندوق وارد وينغكاستر من أول رسالة.',
    },
    cta: { en: 'Start with WhatsApp', ar: 'ابدأ بواتساب' },
    resumeCta: { en: 'Resume', ar: 'متابعة' },
  },
  first_listing: {
    title: { en: 'Publish your first listing', ar: 'انشر أول إعلان لك' },
    description: {
      en: 'Create a listing manually or dictate it over WhatsApp — either path counts.',
      ar: 'أنشئ إعلانًا يدويًا أو أمليه عبر واتساب — كلا المسارين يُحسبان.',
    },
    cta: { en: 'Create a listing', ar: 'أنشئ إعلانًا' },
    resumeCta: { en: 'Resume', ar: 'متابعة' },
  },
  portal_credentials: {
    title: { en: 'Add your portal credentials', ar: 'أضِف بيانات بوابات الإعلان' },
    description: {
      en: 'Connect Bayut, Property Finder, Dubizzle, and other portals so WingCaster can publish for you.',
      ar: 'اربط بيوت وProperty Finder ودبيزل وغيرها لينشر وينغكاستر نيابةً عنك.',
    },
    cta: { en: 'Connect a portal', ar: 'اربط بوابة' },
    resumeCta: { en: 'Resume', ar: 'متابعة' },
  },
  working_hours: {
    title: {
      en: 'Set your working hours & response time',
      ar: 'حدّد ساعات عملك ووقت الرد',
    },
    description: {
      en: 'Tell leads when to expect a reply so auto-responders never overpromise.',
      ar: 'أخبر العملاء متى يتوقعون ردًا حتى لا تُبالغ الردود التلقائية في الوعود.',
    },
    cta: { en: 'Set my hours', ar: 'حدّد ساعات عملي' },
    resumeCta: { en: 'Resume', ar: 'متابعة' },
  },
  invite_team: {
    title: { en: 'Invite your team', ar: 'ادعُ فريقك' },
    description: {
      en: 'Bring your agents into your workspace. Share a code, a link, or bulk-email invitations.',
      ar: 'أضِف وسطاءك إلى مساحة عملك. شارك رمزًا أو رابطًا أو أرسل دعوات جماعية بالبريد.',
    },
    cta: { en: 'Invite agents', ar: 'ادعُ الوسطاء' },
    resumeCta: { en: 'Resume', ar: 'متابعة' },
  },
}

export const PORTAL_LOCKED_HELPER: LocalizedString = {
  en: "Available soon — we're finalizing your country's portal list.",
  ar: 'قريبًا — نُكمّل قائمة البوابات لبلدك.',
}

export const LOCK_HELPERS = {
  inviteJoin: {
    en: 'Invite is managed by your agency owner.',
    ar: 'إدارة الدعوات من صلاحيات مالك الوكالة.',
  },
  inviteSolo: {
    en: 'Available if you register an agency later.',
    ar: 'متاح إذا سجّلت وكالة لاحقًا.',
  },
  availableSoon: { en: 'Available soon', ar: 'قريبًا' },
} as const

export function stepLockHelper(
  step: ActivationStep,
  signupPath: SignupPath,
  locale: ActivationLocale = 'en',
): string | null {
  if (step.state !== 'locked') return null
  if (step.id === 'portal_credentials') return at(PORTAL_LOCKED_HELPER, locale)
  if (step.id === 'invite_team') {
    if (signupPath === 'join' || step.lock_reason === 'join_signup_path') {
      return at(LOCK_HELPERS.inviteJoin, locale)
    }
    return at(LOCK_HELPERS.inviteSolo, locale)
  }
  return at(LOCK_HELPERS.availableSoon, locale)
}

/** Shared chrome / cross-step strings */
export const ACTIVATION_COPY = {
  'chrome.brand': { en: 'WingCaster', ar: 'وينغكاستر' },
  'chrome.skip': { en: 'Skip wizard', ar: 'تخطَّ المعالج' },
  'chrome.more': { en: 'More', ar: 'المزيد' },
  'chrome.offline': {
    en: "You're offline. Progress won't save until you reconnect.",
    ar: 'أنت غير متصل. لن يُحفظ التقدّم حتى تعود للاتصال.',
  },
  'chrome.breadcrumb': { en: 'Activation wizard', ar: 'معالج التفعيل' },
  'chrome.breadcrumb.step': { en: '→ Step', ar: '← الخطوة' },
  'skip.title': { en: 'Leave the activation wizard?', ar: 'مغادرة معالج التفعيل؟' },
  'skip.body': {
    en: 'Your progress is saved. You can pick this back up any time from your dashboard.',
    ar: 'تقدّمك محفوظ. يمكنك المتابعة في أي وقت من لوحة التحكم.',
  },
  'skip.cancel': { en: 'Never mind, keep going', ar: 'لا بأس، أكمِل' },
  'skip.confirm': { en: "Leave — I'll return later", ar: 'غادر — سأعود لاحقًا' },
  'locked.gotIt': { en: 'Got it', ar: 'حسنًا' },
  'locked.inviteTitle': { en: 'Invite team', ar: 'دعوة الفريق' },
  'locked.genericTitle': { en: 'Not available yet', ar: 'غير متاح بعد' },
  'celebration.title': { en: "You're activated.", ar: 'تم تفعيل حسابك.' },
  'celebration.sr': { en: 'All five steps complete.', ar: 'اكتملت الخطوات الخمس.' },
  'footer.guided': { en: 'Not sure where to start?', ar: 'لست متأكدًا من أين تبدأ؟' },
  'footer.guided.cta': { en: 'Take the guided path →', ar: 'اتبع المسار الموجَّه ←' },
  'footer.dashboard': { en: 'Return to dashboard →', ar: 'العودة إلى لوحة التحكم ←' },
  'common.later': { en: "I'll do this later", ar: 'سأفعل ذلك لاحقًا' },
  'common.resume': { en: 'Resume', ar: 'متابعة' },
  'common.open': { en: 'Open', ar: 'فتح' },
  'common.cancel': { en: 'Cancel', ar: 'إلغاء' },
  'common.retry': { en: 'Retry', ar: 'إعادة المحاولة' },
  'common.returnWizard': {
    en: 'Return to activation wizard →',
    ar: 'العودة إلى معالج التفعيل ←',
  },
  'common.markComplete': { en: 'Mark step complete →', ar: 'علّم الخطوة كمكتملة ←' },
  'common.saving': { en: 'Saving…', ar: 'جارٍ الحفظ…' },
  'common.skippedResume': { en: 'Skipped — resume', ar: 'تم التخطي — متابعة' },
  'common.nothingTodo': { en: 'Nothing to do here.', ar: 'لا يوجد شيء هنا.' },
  'state.not_started': { en: 'Not started', ar: 'لم تبدأ' },
  'state.in_progress': { en: 'In progress', ar: 'قيد التنفيذ' },
  'state.complete': { en: 'Complete', ar: 'مكتملة' },
  'state.deferred': { en: 'Skipped', ar: 'تم التخطي' },
  'state.locked': { en: 'Locked', ar: 'مقفلة' },
  'caption.completedVia': { en: 'Completed via {source}', ar: 'اكتملت عبر {source}' },
  'caption.completedViaWhen': {
    en: 'Completed via {source} — {when}',
    ar: 'اكتملت عبر {source} — {when}',
  },
  'caption.completed': { en: 'Completed', ar: 'مكتملة' },
  'caption.completedWhen': { en: 'Completed — {when}', ar: 'مكتملة — {when}' },

  // Welcome hub
  'welcome.title': { en: 'Activation wizard', ar: 'معالج التفعيل' },
  'welcome.h1': { en: 'Unlock every WingCaster feature', ar: 'فعّل كل مزايا وينغكاستر' },
  'welcome.sub': {
    en: 'Five short steps get you from account-created to fully activated. Do them in any order — your progress saves automatically.',
    ar: 'خمس خطوات قصيرة تنقلك من إنشاء الحساب إلى التفعيل الكامل. نفّذها بأي ترتيب — يُحفظ تقدّمك تلقائيًا.',
  },
  'welcome.error': {
    en: "We couldn't load your activation progress. Try again in a moment.",
    ar: 'تعذّر تحميل تقدّم التفعيل. حاول مجددًا بعد لحظات.',
  },

  // WhatsApp
  'whatsapp.pageTitle': { en: 'Connect WhatsApp', ar: 'اربط واتساب' },
  'whatsapp.h1': {
    en: 'Connect your business WhatsApp',
    ar: 'اربط واتساب الأعمال',
  },
  'whatsapp.sub': {
    en: 'Text this activation code from the WhatsApp account you want to use. It expires in 10 minutes.',
    ar: 'أرسل رمز التفعيل هذا من حساب واتساب الذي تريد استخدامه. ينتهي خلال 10 دقائق.',
  },
  'whatsapp.already': {
    en: 'You already connected WhatsApp on {when}. Nothing to do here.',
    ar: 'لقد ربطت واتساب مسبقًا في {when}. لا يوجد شيء هنا.',
  },
  'whatsapp.connected': { en: 'WhatsApp connected', ar: 'تم ربط واتساب' },
  'whatsapp.connectedMasked': {
    en: 'WhatsApp connected · {masked}',
    ar: 'تم ربط واتساب · {masked}',
  },
  'whatsapp.waiting': { en: 'Waiting for your message…', ar: 'بانتظار رسالتك…' },
  'whatsapp.verifying': { en: 'Message received — verifying…', ar: 'وصلت الرسالة — جارٍ التحقق…' },
  'whatsapp.differentNumber': { en: 'Use a different number', ar: 'استخدم رقمًا آخر' },
  'whatsapp.expired': { en: 'Code expired — get a new one', ar: 'انتهت صلاحية الرمز — احصل على رمز جديد' },
  'whatsapp.skipTertiary': {
    en: "Skip — I don't use WhatsApp for business",
    ar: 'تخطَّ — لا أستخدم واتساب للأعمال',
  },
  'whatsapp.loadError': {
    en: "Couldn't load an activation code. Try again.",
    ar: 'تعذّر تحميل رمز التفعيل. حاول مجددًا.',
  },
  'whatsapp.numberClaimed': {
    en: 'That WhatsApp number is already bound to another WingCaster account. Use a different number or contact support.',
    ar: 'رقم واتساب هذا مرتبط بحساب وينغكاستر آخر. استخدم رقمًا مختلفًا أو تواصل مع الدعم.',
  },
  'whatsapp.expiresIn': { en: 'Expires in {time}', ar: 'ينتهي خلال {time}' },

  // First listing
  'listing.pageTitle': { en: 'First listing', ar: 'أول إعلان' },
  'listing.breadcrumb': { en: 'Publish your first listing', ar: 'انشر أول إعلان لك' },
  'listing.h1': {
    en: 'How do you want to create your first listing?',
    ar: 'كيف تريد إنشاء أول إعلان؟',
  },
  'listing.sub': {
    en: 'Either path counts. You can always use the other one later.',
    ar: 'كلا المسارين يُحسبان. يمكنك استخدام الآخر لاحقًا.',
  },
  'listing.already': {
    en: 'You already published your first listing on {when}. Nothing to do here.',
    ar: 'لقد نشرت أول إعلان مسبقًا في {when}. لا يوجد شيء هنا.',
  },
  'listing.alreadyVia': {
    en: 'You already published your first listing on {when} — via {source}. Nothing to do here.',
    ar: 'لقد نشرت أول إعلان مسبقًا في {when} — عبر {source}. لا يوجد شيء هنا.',
  },
  'listing.seeListings': { en: 'See your listings →', ar: 'عرض إعلاناتك ←' },
  'listing.typeTitle': { en: 'Type it out', ar: 'اكتبه يدويًا' },
  'listing.typeDesc': {
    en: "Fill in the classic listing form — property type, price, beds, baths, photos. Best if you're at your desk.",
    ar: 'عبّئ نموذج الإعلان الكلاسيكي — نوع العقار والسعر والغرف والحمامات والصور. الأنسب وأنت على مكتبك.',
  },
  'listing.typeMeta': { en: '~{n} minutes', ar: '~{n} دقائق' },
  'listing.typeCta': { en: 'Open the composer →', ar: 'افتح محرّر الإعلان ←' },
  'listing.voiceTitle': { en: 'Dictate it via WhatsApp', ar: 'أمله عبر واتساب' },
  'listing.voiceDesc': {
    en: "Send a voice note to your bound WhatsApp — WingCaster transcribes and drafts the listing. Best if you're on-site or in the car.",
    ar: 'أرسل ملاحظة صوتية إلى واتساب المرتبط — وينغكاستر يفرّغها ويُعدّ مسودة الإعلان. الأنسب وأنت في الموقع أو السيارة.',
  },
  'listing.voiceMeta': { en: '~{n} seconds', ar: '~{n} ثانية' },
  'listing.voiceCta': { en: 'Send a voice note →', ar: 'أرسل ملاحظة صوتية ←' },
  'listing.voiceLocked': {
    en: 'Connect WhatsApp first —',
    ar: 'اربط واتساب أولًا —',
  },
  'listing.voiceLockedLink': { en: 'go to Step 1 →', ar: 'انتقل إلى الخطوة 1 ←' },
  'listing.altMark': {
    en: 'Already published a listing elsewhere?',
    ar: 'هل نشرت إعلانًا في مكان آخر؟',
  },
  'listing.altMarkCta': { en: 'Mark this step complete →', ar: 'علّم هذه الخطوة كمكتملة ←' },
  'listing.confirmTitle': {
    en: 'Mark first listing as complete?',
    ar: 'تعليم أول إعلان كمكتمل؟',
  },
  'listing.confirmBody': {
    en: "You're telling us your first listing already exists. This will mark Step 2 complete.",
    ar: 'تخبرنا أن أول إعلان موجود مسبقًا. سيُعلَّم الخطوة 2 كمكتملة.',
  },
  'listing.confirmYes': { en: 'Yes, mark complete', ar: 'نعم، علّم كمكتملة' },

  // Portal credentials
  'portal.pageTitle': { en: 'Portal credentials', ar: 'بيانات بوابات الإعلان' },
  'portal.breadcrumb': {
    en: 'Add your portal credentials',
    ar: 'أضِف بيانات بوابات الإعلان',
  },
  'portal.h1': { en: 'Add your portal credentials', ar: 'أضِف بيانات بوابات الإعلان' },
  'portal.sub': {
    en: 'Connect the portals you already list on. WingCaster will publish, refresh, and unpublish for you — no more copy-paste.',
    ar: 'اربط البوابات التي تعلن عليها أصلًا. وينغكاستر ينشر ويحدّث ويلغي نيابةً عنك — بلا نسخ ولصق.',
  },
  'portal.countryPill': { en: 'Portals available in {country}', ar: 'البوابات المتاحة في {country}' },
  'portal.wrongCountry': { en: 'Wrong country?', ar: 'بلد خاطئ؟' },
  'portal.empty': {
    en: "We're still setting up the portal list for {country}. This step will unlock as soon as it's live — usually within a week.",
    ar: 'ما زلنا نُعدّ قائمة البوابات لـ {country}. ستُفتح هذه الخطوة فور الجاهزية — عادةً خلال أسبوع.',
  },
  'portal.notify': { en: 'Notify me when portals are ready', ar: 'أخبرني عند جاهزية البوابات' },
  'portal.noPortals': { en: 'No portals to connect yet.', ar: 'لا بوابات للربط بعد.' },
  'portal.defaultDesc': {
    en: 'Connect this portal to publish listings.',
    ar: 'اربط هذه البوابة لنشر الإعلانات.',
  },
  'portal.state.not_connected': { en: 'Not connected', ar: 'غير متصل' },
  'portal.state.connecting': { en: 'Connecting…', ar: 'جارٍ الاتصال…' },
  'portal.state.connected': { en: 'Connected · {masked}', ar: 'متصل · {masked}' },
  'portal.state.failed': { en: 'Connection failed — retry', ar: 'فشل الاتصال — أعد المحاولة' },
  'portal.cta.connect': { en: 'Connect →', ar: 'اربط ←' },
  'portal.cta.manage': { en: 'Manage', ar: 'إدارة' },
  'portal.cta.retry': { en: 'Retry', ar: 'إعادة المحاولة' },
  'portal.drawerTitle': { en: 'Connect to {portal}', ar: 'الاتصال بـ {portal}' },
  'portal.drawerTrust': {
    en: 'Your credentials are encrypted at rest and used only to publish your listings.',
    ar: 'بياناتك مشفّرة أثناء التخزين وتُستخدم فقط لنشر إعلاناتك.',
  },
  'portal.drawerSave': { en: 'Save & test connection →', ar: 'احفظ واختبر الاتصال ←' },
  'portal.drawerTesting': { en: 'Testing connection…', ar: 'جارٍ اختبار الاتصال…' },
  'portal.success': {
    en: 'Connected — your {portal} credentials work.',
    ar: 'تم الاتصال — بيانات {portal} تعمل بنجاح.',
  },
  'portal.saveError': {
    en: 'Could not save credentials.',
    ar: 'تعذّر حفظ بيانات الاعتماد.',
  },
  'portal.error.invalid': {
    en: "Those credentials didn't sign in. Check the username/password and retry.",
    ar: 'لم تنجح بيانات الدخول. تحقّق من اسم المستخدم/كلمة المرور وأعد المحاولة.',
  },
  'portal.error.down': {
    en: '{portal} is temporarily unreachable. Try again in a few minutes.',
    ar: '{portal} غير متاح مؤقتًا. حاول مجددًا خلال دقائق.',
  },
  'portal.error.quota': {
    en: 'Your {portal} account is over quota. Increase your plan on their side and retry.',
    ar: 'حسابك في {portal} تجاوز الحصة. ارفع خطتك لديهم ثم أعد المحاولة.',
  },
  'portal.error.generic': {
    en: "We couldn't sign in to {portal} with those credentials. Double-check and try again.",
    ar: 'تعذّر تسجيل الدخول إلى {portal} بهذه البيانات. تحقّق وحاول مجددًا.',
  },
  'portal.tertiary': {
    en: 'None of these portals are relevant to me',
    ar: 'لا تناسبني أي من هذه البوابات',
  },
  'portal.countryTitle': { en: 'Change your country?', ar: 'تغيير بلدك؟' },
  'portal.countryBody': {
    en: 'Your portal list is set from your profile country. Update it in Settings → Account → Region.',
    ar: 'قائمة البوابات مأخوذة من بلد ملفك. حدّثها من الإعدادات ← الحساب ← المنطقة.',
  },
  'portal.countryCta': { en: 'Open Settings', ar: 'افتح الإعدادات' },

  // Working hours
  'hours.pageTitle': { en: 'Working hours', ar: 'ساعات العمل' },
  'hours.breadcrumb': { en: 'Set your working hours', ar: 'حدّد ساعات عملك' },
  'hours.h1': {
    en: 'Set your working hours & response time',
    ar: 'حدّد ساعات عملك ووقت الرد',
  },
  'hours.sub': {
    en: 'Tell leads when to expect a reply so auto-responders never overpromise.',
    ar: 'أخبر العملاء متى يتوقعون ردًا حتى لا تُبالغ الردود التلقائية في الوعود.',
  },
  'hours.weekdayFrom': { en: 'Weekdays from', ar: 'أيام الأسبوع من' },
  'hours.weekdayUntil': { en: 'Weekdays until', ar: 'أيام الأسبوع حتى' },
  'hours.weekendFrom': { en: 'Weekend from', ar: 'عطلة نهاية الأسبوع من' },
  'hours.weekendUntil': { en: 'Weekend until', ar: 'عطلة نهاية الأسبوع حتى' },
  'hours.response': {
    en: 'Typical first-reply time (minutes)',
    ar: 'وقت الرد الأول المعتاد (بالدقائق)',
  },

  // Invite team
  'invite.pageTitle': { en: 'Invite your team', ar: 'ادعُ فريقك' },
  'invite.breadcrumb': { en: 'Invite your team', ar: 'ادعُ فريقك' },
  'invite.h1': { en: 'Invite your team', ar: 'ادعُ فريقك' },
  'invite.sub': {
    en: 'Bring your agents into {agency}. Pick the fastest method for how your team works.',
    ar: 'أضِف وسطاءك إلى {agency}. اختر أسرع طريقة تناسب أسلوب عمل فريقك.',
  },
  'invite.already': {
    en: 'You already sent invitations on {when}. Nothing to do here.',
    ar: 'لقد أرسلت دعوات مسبقًا في {when}. لا يوجد شيء هنا.',
  },
  'invite.tab.link': { en: 'Share link', ar: 'رابط المشاركة' },
  'invite.tab.code': { en: 'Invitation code', ar: 'رمز الدعوة' },
  'invite.tab.email': { en: 'Bulk email', ar: 'بريد جماعي' },
  'invite.link.h2': { en: 'One link, unlimited agents', ar: 'رابط واحد، وسطاء بلا حد' },
  'invite.link.sub': {
    en: 'Share this link anywhere — WhatsApp, email, printed onto onboarding paperwork. Every agent who follows it applies to join {agency}.',
    ar: 'شارك هذا الرابط أينما شئت — واتساب أو البريد أو مطبوعات الانضمام. كل وسيط يتبعه يتقدّم للانضمام إلى {agency}.',
  },
  'invite.link.copy': { en: 'Copy link', ar: 'نسخ الرابط' },
  'invite.link.rotate': { en: 'Rotate this link', ar: 'تدوير هذا الرابط' },
  'invite.link.qr': { en: 'Show QR code', ar: 'عرض رمز QR' },
  'invite.link.expiry': {
    en: 'Link is active until you rotate it or disable it in Settings → Team.',
    ar: 'الرابط فعّال حتى تدورّه أو تعطّله من الإعدادات ← الفريق.',
  },
  'invite.link.aria': { en: 'Share link', ar: 'رابط المشاركة' },
  'invite.link.qrAlt': { en: 'Invitation QR code', ar: 'رمز QR للدعوة' },
  'invite.code.h2': {
    en: 'A short code for phone or in-person',
    ar: 'رمز قصير للهاتف أو الحضور الشخصي',
  },
  'invite.code.sub': {
    en: 'Share this code verbally or over a call. Agents enter it during signup.',
    ar: 'شارك هذا الرمز شفهيًا أو عبر مكالمة. يُدخله الوسطاء أثناء التسجيل.',
  },
  'invite.code.copy': { en: 'Copy code', ar: 'نسخ الرمز' },
  'invite.code.rotate': { en: 'Rotate code', ar: 'تدوير الرمز' },
  'invite.code.expiry': {
    en: 'Code is active until you rotate it or disable it in Settings → Team.',
    ar: 'الرمز فعّال حتى تدورّه أو تعطّله من الإعدادات ← الفريق.',
  },
  'invite.email.h2': { en: 'Send email invitations', ar: 'أرسل دعوات بالبريد' },
  'invite.email.sub': {
    en: 'Paste up to {n} email addresses. Each gets a personalized invitation to join {agency}.',
    ar: 'الصق حتى {n} عناوين بريد. يحصل كل منها على دعوة مخصّصة للانضمام إلى {agency}.',
  },
  'invite.email.label': { en: 'Email addresses', ar: 'عناوين البريد' },
  'invite.email.placeholder': {
    en: 'sara@example.com, ali@example.com, layla@example.com',
    ar: 'sara@example.com, ali@example.com, layla@example.com',
  },
  'invite.email.invalid': { en: 'Invalid: {list}', ar: 'غير صالح: {list}' },
  'invite.email.note': { en: 'Add a personal note (optional)', ar: 'أضِف ملاحظة شخصية (اختياري)' },
  'invite.email.send': { en: 'Send {n} invitations →', ar: 'أرسل {n} دعوات ←' },
  'invite.email.success': { en: '{n} invitations sent.', ar: 'تم إرسال {n} دعوات.' },
  'invite.email.partial': {
    en: "{sent} sent, {failed} couldn't be delivered. See details below.",
    ar: 'أُرسل {sent}، وتعذّر تسليم {failed}. التفاصيل أدناه.',
  },
  'invite.email.rate': {
    en: "You've sent a lot of invitations quickly — please wait a few minutes.",
    ar: 'أرسلت دعوات كثيرة بسرعة — يرجى الانتظار بضع دقائق.',
  },
  'invite.email.sendError': {
    en: 'Could not send invitations.',
    ar: 'تعذّر إرسال الدعوات.',
  },
  'invite.email.capability': {
    en: 'Capability-locked methods stay visible when gated.',
    ar: 'تظل الطرق المقفلة بالصلاحيات ظاهرة عند التقييد.',
  },
  'invite.pending.h3': { en: 'Pending invitations', ar: 'الدعوات المعلّقة' },
  'invite.pending.empty': { en: 'No pending invitations yet.', ar: 'لا دعوات معلّقة بعد.' },
  'invite.pending.email': { en: 'Email', ar: 'البريد' },
  'invite.pending.sent': { en: 'Sent', ar: 'أُرسلت' },
  'invite.pending.status': { en: 'Status', ar: 'الحالة' },
  'invite.pending.actions': { en: 'Actions', ar: 'إجراءات' },
  'invite.pending.resend': { en: 'Resend', ar: 'إعادة الإرسال' },
  'invite.pending.revoke': { en: 'Revoke', ar: 'إلغاء' },
  'invite.pending.resent': { en: 'Invitation resent.', ar: 'أُعيد إرسال الدعوة.' },
  'invite.completeCta': {
    en: 'Mark step complete → Connect channels',
    ar: 'علّم الخطوة كمكتملة ← اربط القنوات',
  },
  'invite.completeHelper': {
    en: 'Send an invitation first, or defer',
    ar: 'أرسل دعوة أولًا، أو أجّل',
  },
  'invite.tertiary': { en: "It's just me for now", ar: 'أنا وحدي في الوقت الحالي' },
  'invite.rotateLinkTitle': { en: 'Rotate the share link?', ar: 'تدوير رابط المشاركة؟' },
  'invite.rotateCodeTitle': { en: 'Rotate the invitation code?', ar: 'تدوير رمز الدعوة؟' },
  'invite.rotateBody': {
    en: 'The previous link stops working. Agents mid-application can still complete.',
    ar: 'يتوقف الرابط السابق عن العمل. الوسطاء في منتصف التقديم يمكنهم الإكمال.',
  },
  'invite.rotateConfirm': { en: 'Rotate', ar: 'تدوير' },
  'invite.rotated': { en: 'Rotated.', ar: 'تم التدوير.' },
  'invite.revokeTitle': { en: 'Revoke this invitation?', ar: 'إلغاء هذه الدعوة؟' },
  'invite.revokeBody': {
    en: "{email} won't be able to join with this invitation. You can invite them again later.",
    ar: 'لن يتمكّن {email} من الانضمام بهذه الدعوة. يمكنك دعوتهم مجددًا لاحقًا.',
  },
  'invite.guard.solo': {
    en: "You're on a solo workspace. Register an agency to invite a team.",
    ar: 'أنت على مساحة عمل فردية. سجّل وكالة لدعوة فريق.',
  },
  'invite.guard.join': {
    en: 'Team invitations are managed by the agency owner. Ask your agency to add you.',
    ar: 'دعوات الفريق من صلاحيات مالك الوكالة. اطلب من وكالتك إضافتك.',
  },
} as const

export type ActivationCopyKey = keyof typeof ACTIVATION_COPY

export function act(
  key: ActivationCopyKey,
  locale: ActivationLocale,
  vars?: Record<string, string | number>,
): string {
  return t(ACTIVATION_COPY[key], locale, vars)
}
