/**
 * AGT-CTC-007b public consent-landing copy — EN + AR.
 *
 * LOGIN_COPY shape (per-key `{ en, ar }`) mirroring
 * `web/src/pages/agent/dashboard/copy.ts` (which mirrors
 * `components/auth/loginCopy.ts`). Arabic tone: real MENA product Arabic.
 *
 * The consent landing is public + session-free, but it still consumes
 * `useLocale().isArabic` so the AR pass (per PR 145, dsh-mount copy tables)
 * reaches this surface instead of shipping English strings under
 * `dir="rtl" lang="ar"`.
 */

export type ConsentLocale = 'en' | 'ar'

export const LOGIN_COPY = {
  'brand': {
    en: 'WingCaster',
    ar: 'وينغكاستر',
  },
  'loading': {
    en: 'Loading',
    ar: 'جارٍ التحميل',
  },
  'consent.title': {
    en: 'Confirm this relationship',
    ar: 'تأكيد هذه العلاقة',
  },
  'consent.intro': {
    en: 'An agent asked you to confirm how they may represent you. Review the terms, then accept or decline.',
    ar: 'طلب منك أحد الوكلاء تأكيد كيفية تمثيلك. راجع الشروط، ثم وافق أو ارفض.',
  },
  'consent.decline': {
    en: 'Decline',
    ar: 'رفض',
  },
  'consent.accept': {
    en: 'Accept & confirm',
    ar: 'قبول وتأكيد',
  },
  'missingToken.title': {
    en: 'Consent link is incomplete',
    ar: 'رابط الموافقة غير مكتمل',
  },
  'missingToken.detail': {
    en: 'Open the link from your email. Authorization requires a signed token — other URL parameters are ignored.',
    ar: 'افتح الرابط من بريدك الإلكتروني. يتطلب التفويض رمزًا موقّعًا — ويتم تجاهل بقية معطيات الرابط.',
  },
  'error.expired.title': {
    en: 'This consent link has expired',
    ar: 'انتهت صلاحية رابط الموافقة هذا',
  },
  'error.expired.detail': {
    en: 'Ask your agent to resend a new confirmation link.',
    ar: 'اطلب من وكيلك إرسال رابط تأكيد جديد.',
  },
  'error.consumed.title': {
    en: 'This consent link is no longer valid',
    ar: 'لم يعد رابط الموافقة هذا صالحًا',
  },
  'error.consumed.detail': {
    en: 'It may already have been used, or the request was cancelled.',
    ar: 'ربما تم استخدامه بالفعل، أو تم إلغاء الطلب.',
  },
  'error.generic.title': {
    en: 'Unable to open consent link',
    ar: 'تعذّر فتح رابط الموافقة',
  },
  'error.generic.detail': {
    en: 'The link may be invalid or incomplete.',
    ar: 'قد يكون الرابط غير صالح أو غير مكتمل.',
  },
  'error.acceptFail.title': {
    en: 'Could not confirm relationship',
    ar: 'تعذّر تأكيد العلاقة',
  },
  'error.rejectFail.title': {
    en: 'Could not decline relationship',
    ar: 'تعذّر رفض العلاقة',
  },
  'accepted.title': {
    en: 'Relationship confirmed',
    ar: 'تم تأكيد العلاقة',
  },
  'accepted.detail': {
    en: 'Thanks — your agent has been notified. You can close this page.',
    ar: 'شكرًا — تم إخطار وكيلك. يمكنك إغلاق هذه الصفحة.',
  },
  'rejected.title': {
    en: 'Relationship declined',
    ar: 'تم رفض العلاقة',
  },
  'rejected.detail': {
    en: 'No representation was created. You can close this page.',
    ar: 'لم يتم إنشاء أي تمثيل. يمكنك إغلاق هذه الصفحة.',
  },
  'conflict.title': {
    en: 'Another exclusive already exists',
    ar: 'يوجد حصري آخر بالفعل',
  },
  'conflict.detail': {
    en: 'An exclusive relationship for this party type is already active with another agency. Contact your agent before confirming.',
    ar: 'توجد علاقة حصرية لهذا النوع نشطة بالفعل مع وكالة أخرى. تواصل مع وكيلك قبل التأكيد.',
  },
  'terms.starts': {
    en: 'Starts',
    ar: 'يبدأ',
  },
  'terms.ends': {
    en: 'Ends',
    ar: 'ينتهي',
  },
  'terms.areas': {
    en: 'Areas',
    ar: 'المناطق',
  },
  'terms.types': {
    en: 'Types',
    ar: 'الأنواع',
  },
  'terms.exclusive': {
    en: 'Exclusive',
    ar: 'حصري',
  },
  'type.representation': {
    en: 'Representation',
    ar: 'تمثيل',
  },
  'type.mandate': {
    en: 'Mandate',
    ar: 'تفويض',
  },
  'type.affinity': {
    en: 'Affinity',
    ar: 'تقارب',
  },
  'party.buyer': {
    en: 'Buyer',
    ar: 'مشتري',
  },
  'party.seller': {
    en: 'Seller',
    ar: 'بائع',
  },
  'party.landlord': {
    en: 'Landlord',
    ar: 'مالك',
  },
  'party.tenant': {
    en: 'Tenant',
    ar: 'مستأجر',
  },
} as const

export type ConsentCopyKey = keyof typeof LOGIN_COPY

export function t(key: ConsentCopyKey, locale: ConsentLocale): string {
  return LOGIN_COPY[key][locale]
}
