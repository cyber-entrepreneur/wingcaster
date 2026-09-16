/**
 * AGN-ROL-001 / AGN-ROL-002 copy — EN + AR (real strings, no pending markers).
 * Shape + t() helper mirror pages/agent/onboarding/copy.ts.
 */

export type RolesLocale = 'en' | 'ar'

export const ROLES_COPY = {
  'breadcrumb.settings': { en: 'Settings', ar: 'الإعدادات' },
  'breadcrumb.access': { en: 'Access & permissions', ar: 'الوصول والصلاحيات' },
  'breadcrumb.roles': { en: 'Roles', ar: 'الأدوار' },

  'overview.title': { en: 'Roles & permissions', ar: 'الأدوار والصلاحيات' },
  'overview.sub': {
    en: 'Capability packs decide what each teammate can do. Assign packs from the member’s profile.',
    ar: 'حزم الصلاحيات تحدّد ما يمكن لكل عضو فعله. عيّن الحزم من ملف العضو.',
  },
  'overview.help': { en: 'How capability packs work', ar: 'كيف تعمل حزم الصلاحيات' },
  'overview.section.builtin': { en: 'Built-in packs', ar: 'الحزم المدمجة' },
  'overview.section.custom': { en: 'Custom pack', ar: 'الحزمة المخصّصة' },
  'overview.info': {
    en: 'v1 supports one custom pack per agency. Multi-custom packs land in v2.',
    ar: 'الإصدار الأول يدعم حزمة مخصّصة واحدة لكل وكالة. الحزم المتعددة قادمة في الإصدار الثاني.',
  },
  'overview.firstRun': {
    en: 'You haven’t added teammates yet. Invite your first member to start assigning packs.',
    ar: 'لم تُضِف أعضاء بعد. ادعُ أول عضو للبدء في تعيين الحزم.',
  },

  'badge.seeded': { en: 'Built-in — read only', ar: 'مدمجة — للقراءة فقط' },
  'badge.custom': { en: 'Custom — editable', ar: 'مخصّصة — قابلة للتعديل' },

  'members.count': { en: '{n} members assigned', ar: '{n} أعضاء معيّنون' },
  'members.countSuffix': { en: 'members assigned', ar: 'أعضاء معيّنون' },
  'members.zero': {
    en: 'No members yet — assign this pack from a member’s profile.',
    ar: 'لا يوجد أعضاء بعد — عيّن هذه الحزمة من ملف عضو.',
  },
  'chip.more': { en: '+{n} more', ar: '+{n} أخرى' },

  'action.view': { en: 'View permissions', ar: 'عرض الصلاحيات' },
  'action.assign': { en: 'Assign to members', ar: 'تعيين للأعضاء' },

  'warning.secondOwner': {
    en: 'Assigning Finance requires a second owner for two-person approval. Add an owner first.',
    ar: 'يتطلب تعيين حزمة المالية مالكًا ثانيًا للموافقة المزدوجة. أضِف مالكًا أولًا.',
  },
  'warning.secondOwner.cta': { en: 'Ownership settings', ar: 'إعدادات الملكية' },

  'error.load': {
    en: 'We couldn’t load your packs. Try again?',
    ar: 'تعذّر تحميل الحزم. حاول مرة أخرى؟',
  },
  'error.empty': {
    en: 'Something’s wrong — no capability packs are configured. Contact support.',
    ar: 'حدث خطأ ما — لا توجد حزم صلاحيات مُهيّأة. تواصل مع الدعم.',
  },
  'error.assign': {
    en: 'We couldn’t save the assignment. Try again?',
    ar: 'تعذّر حفظ التعيين. حاول مرة أخرى؟',
  },
  'action.retry': { en: 'Retry', ar: 'إعادة المحاولة' },
  'loading.packs': { en: 'Loading capability packs', ar: 'جارٍ تحميل حزم الصلاحيات' },

  // Assign sheet (R13)
  'sheet.title': { en: 'Assign {pack} to members', ar: 'تعيين حزمة {pack} للأعضاء' },
  'sheet.search': { en: 'Search by name or email', ar: 'ابحث بالاسم أو البريد' },
  'sheet.listHeader': { en: 'Members ({total})', ar: 'الأعضاء ({total})' },
  'sheet.already': { en: 'Already has {pack}', ar: 'يملك حزمة {pack} بالفعل' },
  'sheet.secondOwnerRow': {
    en: 'Second owner required — cannot assign yet',
    ar: 'يلزم مالك ثانٍ — لا يمكن التعيين بعد',
  },
  'sheet.assign': { en: 'Assign', ar: 'تعيين' },
  'sheet.cancel': { en: 'Cancel', ar: 'إلغاء' },
  'sheet.empty': { en: 'No members match your search.', ar: 'لا يوجد أعضاء يطابقون بحثك.' },
  'sheet.saving': { en: 'Saving…', ar: 'جارٍ الحفظ…' },
  'sheet.success': {
    en: '{pack} assigned to {n} member(s).',
    ar: 'تم تعيين حزمة {pack} إلى {n} عضو/أعضاء.',
  },
  'sheet.pendingApproval': {
    en: 'Finance assignment sent for second-owner approval.',
    ar: 'أُرسل تعيين حزمة المالية للموافقة من مالك ثانٍ.',
  },

  // AGN-ROL-002 detail
  'detail.title': { en: '{pack} permissions', ar: 'صلاحيات {pack}' },
  'detail.back': { en: 'Roles', ar: 'الأدوار' },
  'detail.readOnlyBanner': {
    en: 'This is a built-in pack — read only. See the Custom pack to edit capabilities.',
    ar: 'هذه حزمة مدمجة — للقراءة فقط. راجع الحزمة المخصّصة لتعديل الصلاحيات.',
  },
  'detail.customViewBanner': {
    en: 'Capability editing arrives in a later release. This view shows the Custom pack’s current capabilities.',
    ar: 'تعديل الصلاحيات سيأتي في إصدار لاحق. يعرض هذا العرض صلاحيات الحزمة المخصّصة الحالية.',
  },
  'detail.openCustom': { en: 'Open Custom', ar: 'فتح المخصّصة' },
  'detail.domainSummary': { en: '{n} of {total} enabled', ar: '{n} من {total} مفعّلة' },
  'detail.domainSummarySuffix': { en: 'enabled', ar: 'مفعّلة' },
  'detail.financialSuffix': {
    en: '(requires two-person approval)',
    ar: '(يتطلب موافقة مزدوجة)',
  },
  'detail.capabilityState.on': { en: 'On', ar: 'مفعّل' },
  'detail.capabilityState.off': { en: 'Off', ar: 'غير مفعّل' },
  'detail.members.header': { en: 'Members with this pack', ar: 'الأعضاء الحاملون لهذه الحزمة' },
  'detail.members.count': { en: '{n} member(s)', ar: '{n} عضو/أعضاء' },
  'detail.members.countSuffix': { en: 'member(s)', ar: 'عضو/أعضاء' },
  'detail.members.empty': {
    en: 'No members yet — assign from the Roles overview.',
    ar: 'لا يوجد أعضاء بعد — عيّن من نظرة الأدوار العامة.',
  },
  'detail.members.seeAll': { en: 'See all', ar: 'عرض الكل' },
  'detail.error.load': {
    en: 'We couldn’t load this pack. Try again?',
    ar: 'تعذّر تحميل هذه الحزمة. حاول مرة أخرى؟',
  },
  'detail.notFound': { en: 'Pack not found.', ar: 'الحزمة غير موجودة.' },
  'detail.loading': { en: 'Loading pack permissions', ar: 'جارٍ تحميل صلاحيات الحزمة' },

  'forbidden.title': {
    en: 'You don’t have access to Roles & permissions.',
    ar: 'ليس لديك صلاحية الوصول إلى الأدوار والصلاحيات.',
  },
  'forbidden.cta': { en: 'Back to agency', ar: 'العودة إلى الوكالة' },
} as const

export type RolesCopyKey = keyof typeof ROLES_COPY

export function tRoles(
  key: RolesCopyKey,
  locale: RolesLocale,
  vars?: Record<string, string | number>,
): string {
  let value: string = ROLES_COPY[key][locale]
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      value = value.replace(`{${k}}`, String(v))
    }
  }
  return value
}
