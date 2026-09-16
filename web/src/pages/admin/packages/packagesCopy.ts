/**
 * PA-PKG family copy — bilingual ({ en, ar }) per key, resolved at read time via
 * useLocale(). Arabic is real MENA Modern Standard Arabic (no pending markers).
 */
import { useCallback, useMemo } from 'react'
import { useLocale, type AppLocale } from '@/hooks/useLocale'

export const PACKAGES_COPY = {
  // ── Shell / shared ────────────────────────────────────────────────
  'shell.viewport.title': {
    en: 'The package console needs a desktop screen (1024px or wider).',
    ar: 'تتطلّب وحدة تحكّم الباقات شاشة سطح مكتب (١٠٢٤ بكسل أو أوسع).',
  },
  'shell.viewport.back': {
    en: '← Back to home',
    ar: '→ العودة إلى الرئيسية',
  },
  'shell.test.strip': {
    en: 'TEST ENVIRONMENT — changes here do not appear on the live pricing page.',
    ar: 'بيئة الاختبار — لا تظهر التغييرات هنا على صفحة الأسعار المباشرة.',
  },
  'shell.forbidden.title': {
    en: 'You need package-admin access to view this page.',
    ar: 'تحتاج إلى صلاحية إدارة الباقات لعرض هذه الصفحة.',
  },
  'shell.forbidden.home': {
    en: 'Go to admin home',
    ar: 'الذهاب إلى الصفحة الرئيسية للإدارة',
  },
  'common.retry': { en: 'Retry', ar: 'إعادة المحاولة' },
  'common.cancel': { en: 'Cancel', ar: 'إلغاء' },
  'common.loading': { en: 'Loading…', ar: 'جارٍ التحميل…' },
  'common.refresh': { en: 'Refresh', ar: 'تحديث' },
  'common.open': { en: 'Open', ar: 'فتح' },
  'common.unlimited': { en: 'Unlimited', ar: 'غير محدود' },

  // ── Status labels ─────────────────────────────────────────────────
  'status.draft': { en: 'Draft', ar: 'مسودّة' },
  'status.pending': { en: 'Pending approval', ar: 'بانتظار الموافقة' },
  'status.active': { en: 'Active', ar: 'نشِطة' },
  'status.deprecated': { en: 'Deprecated', ar: 'موقوفة' },
  'status.inactive': { en: 'Inactive', ar: 'غير نشِطة' },

  // ── PA-PKG-001 list ───────────────────────────────────────────────
  'list.title': { en: 'Packages', ar: 'الباقات' },
  'list.subtitle': {
    en: '{active} active · {pending} pending approval',
    ar: '{active} نشِطة · {pending} بانتظار الموافقة',
  },
  'list.tab.active': { en: 'Active only', ar: 'النشِطة فقط' },
  'list.tab.all': { en: 'All including inactive', ar: 'الكل بما فيها غير النشِطة' },
  'list.sort.label': { en: 'Sort', ar: 'ترتيب' },
  'list.sort.default': { en: 'Default order', ar: 'الترتيب الافتراضي' },
  'list.sort.price_asc': { en: 'Monthly price ↑', ar: 'السعر الشهري ↑' },
  'list.sort.price_desc': { en: 'Monthly price ↓', ar: 'السعر الشهري ↓' },
  'list.sort.recent': { en: 'Recently changed', ar: 'الأحدث تغييراً' },
  'list.search.placeholder': {
    en: 'Search by display name or code…',
    ar: 'ابحث بالاسم المعروض أو الرمز…',
  },
  'list.cta.new': { en: 'New package', ar: 'باقة جديدة' },
  'list.col.package': { en: 'Package', ar: 'الباقة' },
  'list.col.version': { en: 'Current version', ar: 'الإصدار الحالي' },
  'list.col.price': { en: 'Monthly price', ar: 'السعر الشهري' },
  'list.col.properties': { en: 'Properties covered', ar: 'عدد العقارات المشمولة' },
  'list.col.status': { en: 'Status', ar: 'الحالة' },
  'list.col.actions': { en: 'Actions', ar: 'إجراءات' },
  'list.action.history': { en: 'View history', ar: 'عرض السجل' },
  'list.action.newDraft': { en: 'New draft', ar: 'مسودّة جديدة' },
  'list.version.none': { en: 'No published version', ar: 'لا يوجد إصدار منشور' },
  'list.empty.title': { en: 'No packages in this environment yet.', ar: 'لا توجد باقات في هذه البيئة بعد.' },
  'list.empty.body': {
    en: 'Seed the catalog with the New package button — you will be taken into the version editor.',
    ar: 'ابدأ الكتالوج عبر زر «باقة جديدة» — سيتم نقلك إلى محرّر الإصدارات.',
  },
  'list.noresults.title': { en: 'No packages match your filters.', ar: 'لا توجد باقات مطابقة لعوامل التصفية.' },
  'list.error': { en: "Couldn't load packages. Try again.", ar: 'تعذّر تحميل الباقات. حاول مجدّداً.' },

  // New-package modal
  'newpkg.title': { en: 'Create a new package', ar: 'إنشاء باقة جديدة' },
  'newpkg.code.label': { en: 'Package code', ar: 'رمز الباقة' },
  'newpkg.code.helper': {
    en: 'URL-safe, lowercase, dashes only. Cannot change later.',
    ar: 'أحرف صغيرة وشرطات فقط ومتوافقة مع الروابط. لا يمكن تغييره لاحقاً.',
  },
  'newpkg.code.error': { en: 'Only lowercase letters, digits, and dashes.', ar: 'أحرف صغيرة وأرقام وشرطات فقط.' },
  'newpkg.name.label': { en: 'Display name', ar: 'الاسم المعروض' },
  'newpkg.tier.label': { en: 'Tier', ar: 'الفئة' },
  'newpkg.audience.label': { en: 'Target audience', ar: 'الجمهور المستهدف' },
  'newpkg.audience.agent': { en: 'Agent', ar: 'وسيط' },
  'newpkg.audience.agency': { en: 'Agency', ar: 'وكالة' },
  'newpkg.cadence.label': { en: 'Billing cadence', ar: 'دورة الفوترة' },
  'newpkg.cadence.monthly': { en: 'Monthly', ar: 'شهري' },
  'newpkg.cadence.annual': { en: 'Annual', ar: 'سنوي' },
  'newpkg.submit': { en: 'Create and edit', ar: 'إنشاء وتحرير' },
  'newpkg.error': { en: "Couldn't create the package. Try again.", ar: 'تعذّر إنشاء الباقة. حاول مجدّداً.' },

  // ── PA-PKG-002 editor ─────────────────────────────────────────────
  'edit.title': { en: 'Editing {name}', ar: 'تحرير {name}' },
  'edit.subtitle': {
    en: 'Draft v{version} · Based on active v{base}',
    ar: 'مسودّة الإصدار {version} · مبنية على الإصدار النشِط {base}',
  },
  'edit.subtitle.fresh': {
    en: 'Draft v{version} · Brand-new package',
    ar: 'مسودّة الإصدار {version} · باقة جديدة كلّياً',
  },
  'edit.readonly.notice': {
    en: 'This version is {status} and cannot be edited. Only draft versions are editable.',
    ar: 'هذا الإصدار {status} ولا يمكن تحريره. الإصدارات المسودّة فقط قابلة للتحرير.',
  },
  'edit.section.pricing': { en: 'Pricing & coverage', ar: 'التسعير والتغطية' },
  'edit.section.schedule': { en: 'Schedule', ar: 'الجدولة' },
  'edit.section.quotas': { en: 'Feature quotas', ar: 'حصص الميزات' },
  'edit.section.flags': { en: 'Feature toggles', ar: 'مفاتيح الميزات' },
  'edit.field.price.label': { en: 'Monthly price (USD cents)', ar: 'السعر الشهري (سنتات أمريكية)' },
  'edit.field.price.helper': { en: '= {dollars} / mo', ar: '= {dollars} / شهرياً' },
  'edit.field.properties.label': { en: 'Properties covered', ar: 'عدد العقارات المشمولة' },
  'edit.field.effective.label': { en: 'Effective from', ar: 'ساري اعتباراً من' },
  'edit.field.effective.helper': { en: 'Applies once the version is published.', ar: 'يُطبَّق بعد نشر الإصدار.' },
  'edit.quota.empty': { en: 'No feature quotas on this version.', ar: 'لا توجد حصص ميزات في هذا الإصدار.' },
  'edit.quota.credits': { en: '{credits} credits / property', ar: '{credits} رصيد / عقار' },
  'edit.flag.empty': { en: 'No feature toggles on this version.', ar: 'لا توجد مفاتيح ميزات في هذا الإصدار.' },
  'edit.flag.on': { en: 'On', ar: 'مُفعّل' },
  'edit.flag.off': { en: 'Off', ar: 'مُعطّل' },
  'edit.diff.title': { en: 'Diff vs active v{base}', ar: 'الفروق مقارنةً بالإصدار النشِط {base}' },
  'edit.diff.empty': { en: 'No changes yet — start editing to see the diff.', ar: 'لا تغييرات بعد — ابدأ التحرير لعرض الفروق.' },
  'edit.diff.fresh': {
    en: 'New package — no prior version to compare against.',
    ar: 'باقة جديدة — لا يوجد إصدار سابق للمقارنة.',
  },
  'edit.diff.price': { en: 'Monthly price', ar: 'السعر الشهري' },
  'edit.diff.properties': { en: 'Properties covered', ar: 'العقارات المشمولة' },
  'edit.twoperson.title': { en: 'This change requires two-person approval', ar: 'يتطلّب هذا التغيير موافقة شخصين' },
  'edit.twoperson.body': {
    en: 'Price and coverage changes require a second admin to approve. You cannot approve your own submission.',
    ar: 'تتطلّب تغييرات السعر والتغطية موافقة مسؤول ثانٍ. لا يمكنك الموافقة على طلبك بنفسك.',
  },
  'edit.dirty': { en: 'Unsaved changes', ar: 'تغييرات غير محفوظة' },
  'edit.clean': { en: 'All saved', ar: 'تم الحفظ' },
  'edit.save': { en: 'Save draft', ar: 'حفظ المسودّة' },
  'edit.submit': { en: 'Submit for approval', ar: 'إرسال للموافقة' },
  'edit.back': { en: '← Back', ar: '→ رجوع' },
  'edit.toast.saved': { en: 'Draft saved.', ar: 'تم حفظ المسودّة.' },
  'edit.toast.saveFail': { en: "Couldn't save draft. Try again.", ar: 'تعذّر حفظ المسودّة. حاول مجدّداً.' },
  'edit.toast.submitted': { en: 'Submitted v{version} for approval.', ar: 'تم إرسال الإصدار {version} للموافقة.' },
  'edit.toast.submitFail': { en: "Couldn't submit. Try again.", ar: 'تعذّر الإرسال. حاول مجدّداً.' },
  'edit.error': { en: "Couldn't load this draft. Try again.", ar: 'تعذّر تحميل هذه المسودّة. حاول مجدّداً.' },

  // ── PA-PKG-003 approval queue + detail ────────────────────────────
  'appr.title': { en: 'Package approvals', ar: 'موافقات الباقات' },
  'appr.subtitle': {
    en: '{pending} pending · {twoPerson} two-person · {mine} awaiting your review',
    ar: '{pending} بانتظار · {twoPerson} موافقة شخصين · {mine} بانتظار مراجعتك',
  },
  'appr.tab.mine': { en: 'Awaiting my review', ar: 'بانتظار مراجعتي' },
  'appr.tab.all': { en: 'All pending', ar: 'كل ما هو بانتظار الموافقة' },
  'appr.col.submitted': { en: 'Submitted', ar: 'أُرسِلت' },
  'appr.col.package': { en: 'Package', ar: 'الباقة' },
  'appr.col.version': { en: 'Version', ar: 'الإصدار' },
  'appr.col.submitter': { en: 'Submitter', ar: 'مقدّم الطلب' },
  'appr.col.summary': { en: 'Change summary', ar: 'ملخّص التغييرات' },
  'appr.col.type': { en: 'Approval type', ar: 'نوع الموافقة' },
  'appr.col.status': { en: 'Status', ar: 'الحالة' },
  'appr.version.transition': { en: 'v{version} (from v{base})', ar: 'الإصدار {version} (من {base})' },
  'appr.chip.price': { en: 'Price', ar: 'السعر' },
  'appr.chip.coverage': { en: 'Coverage', ar: 'التغطية' },
  'appr.chip.quotas': { en: '{count} quotas', ar: '{count} حصص' },
  'appr.chip.flags': { en: '{count} toggles', ar: '{count} مفاتيح' },
  'appr.badge.twoPerson': { en: 'Two-person', ar: 'موافقة شخصين' },
  'appr.badge.single': { en: 'Single', ar: 'شخص واحد' },
  'appr.empty.title': { en: 'No package approvals pending.', ar: 'لا توجد موافقات باقات معلّقة.' },
  'appr.empty.body': {
    en: 'When a peer submits a package version, it lands here for your review.',
    ar: 'عندما يقدّم زميلٌ إصدار باقة، سيظهر هنا لمراجعتك.',
  },
  'appr.empty.cta': { en: 'Back to packages →', ar: '← العودة إلى الباقات' },
  'appr.error': { en: "Couldn't load approvals. Try again.", ar: 'تعذّر تحميل الموافقات. حاول مجدّداً.' },

  // detail
  'apprd.title': { en: 'Approve v{version} of {name}', ar: 'الموافقة على الإصدار {version} من {name}' },
  'apprd.subtitle': { en: 'Submitted {rel}', ar: 'أُرسِل {rel}' },
  'apprd.back': { en: '← Back to queue', ar: '→ العودة إلى القائمة' },
  'apprd.diff.title': { en: 'Changes in v{version} vs active v{base}', ar: 'التغييرات في الإصدار {version} مقارنةً بالنشِط {base}' },
  'apprd.diff.none': { en: 'No field-level changes detected.', ar: 'لم تُكتشف تغييرات على مستوى الحقول.' },
  'apprd.meta.title': { en: 'Submission details', ar: 'تفاصيل الطلب' },
  'apprd.meta.transition': { en: 'v{base} → v{version}', ar: 'الإصدار {base} ← {version}' },
  'apprd.meta.type': { en: 'Approval type', ar: 'نوع الموافقة' },
  'apprd.actions.title': { en: 'Decision', ar: 'القرار' },
  'apprd.actions.approve': { en: 'Approve and publish', ar: 'الموافقة والنشر' },
  'apprd.actions.reject': { en: 'Reject and return to draft', ar: 'الرفض والإعادة إلى المسودّة' },
  'apprd.actions.recall': { en: 'Recall this submission', ar: 'سحب هذا الطلب' },
  'apprd.actions.footer': {
    en: 'Approval is final. Reversing later requires submitting a new draft version.',
    ar: 'الموافقة نهائية. يتطلّب التراجع لاحقاً إرسال إصدار مسودّة جديد.',
  },
  'apprd.self.note': {
    en: 'You submitted this — a second admin must approve.',
    ar: 'أنت مقدّم هذا الطلب — يجب أن يوافق مسؤول ثانٍ.',
  },
  'apprd.error': { en: "Couldn't load this approval. Try again.", ar: 'تعذّر تحميل هذه الموافقة. حاول مجدّداً.' },
  'apprd.notfound': { en: 'This version is no longer pending approval.', ar: 'لم يعد هذا الإصدار بانتظار الموافقة.' },

  // reject modal
  'reject.title': { en: 'Reject v{version} of {name}', ar: 'رفض الإصدار {version} من {name}' },
  'reject.reason.label': { en: 'Reason for the submitter', ar: 'سبب الرفض لمقدّم الطلب' },
  'reject.reason.placeholder': {
    en: 'Explain what needs changing before resubmission.',
    ar: 'وضّح ما ينبغي تغييره قبل إعادة الإرسال.',
  },
  'reject.reason.helper': { en: 'Required — at least 5 characters.', ar: 'مطلوب — ٥ أحرف على الأقل.' },
  'reject.submit': { en: 'Reject and return to draft', ar: 'الرفض والإعادة إلى المسودّة' },
  'reject.toast.success': { en: 'Rejected v{version} · Submitter notified.', ar: 'تم رفض الإصدار {version} · أُبلِغ مقدّم الطلب.' },
  'reject.toast.fail': { en: "Couldn't reject. Try again.", ar: 'تعذّر الرفض. حاول مجدّداً.' },
  'appr.toast.approved': { en: 'Approved v{version}.', ar: 'تمت الموافقة على الإصدار {version}.' },

  // ── PA-PKG-004 version history ─────────────────────────────────────
  'hist.title': { en: '{name} — version history', ar: '{name} — سجل الإصدارات' },
  'hist.subtitle': {
    en: '{total} versions · {active} active · {deprecated} deprecated',
    ar: '{total} إصدارات · {active} نشِطة · {deprecated} موقوفة',
  },
  'hist.back': { en: '← Back to packages', ar: '→ العودة إلى الباقات' },
  'hist.tab.all': { en: 'All', ar: 'الكل' },
  'hist.tab.draft': { en: 'Draft', ar: 'مسودّة' },
  'hist.tab.pending': { en: 'Pending', ar: 'بانتظار' },
  'hist.tab.active': { en: 'Active', ar: 'نشِطة' },
  'hist.tab.deprecated': { en: 'Deprecated', ar: 'موقوفة' },
  'hist.card.version': { en: 'v{version}', ar: 'الإصدار {version}' },
  'hist.card.effectiveFrom': { en: 'Effective {date}', ar: 'ساري {date}' },
  'hist.card.effectiveRange': { en: 'Effective {from} → {to}', ar: 'ساري {from} ← {to}' },
  'hist.card.created': { en: 'Created {rel}', ar: 'أُنشئ {rel}' },
  'hist.card.editDraft': { en: 'Edit draft', ar: 'تحرير المسودّة' },
  'hist.card.review': { en: 'Review in approvals', ar: 'مراجعة في الموافقات' },
  'hist.empty.title': { en: 'No versions match this filter.', ar: 'لا توجد إصدارات مطابقة لعامل التصفية.' },
  'hist.error': { en: "Couldn't load version history. Try again.", ar: 'تعذّر تحميل سجل الإصدارات. حاول مجدّداً.' },

  // read-only detail
  'ro.title': { en: '{name} — v{version}', ar: '{name} — الإصدار {version}' },
  'ro.back': { en: '← Back to history', ar: '→ العودة إلى السجل' },
  'ro.summary.title': { en: 'Version summary', ar: 'ملخّص الإصدار' },
  'ro.compare.title': { en: 'Compare against', ar: 'قارن مع' },
  'ro.compare.none': { en: 'No prior version', ar: 'لا يوجد إصدار سابق' },
  'ro.compare.v1': { en: 'v1 — original version (nothing to compare).', ar: 'الإصدار ١ — الإصدار الأصلي (لا شيء للمقارنة).' },
  'ro.field.price': { en: 'Monthly price', ar: 'السعر الشهري' },
  'ro.field.properties': { en: 'Properties covered', ar: 'العقارات المشمولة' },
  'ro.field.state': { en: 'State', ar: 'الحالة' },
  'ro.diff.title': { en: 'Comparing v{version} against v{base}', ar: 'مقارنة الإصدار {version} مع {base}' },
  'ro.diff.changed': { en: 'Changed', ar: 'تغيّر' },
  'ro.diff.unchanged': { en: 'No differences from v{base}.', ar: 'لا فروقات عن الإصدار {base}.' },
  'ro.error': { en: "Couldn't load this version. Try again.", ar: 'تعذّر تحميل هذا الإصدار. حاول مجدّداً.' },
} as const

export type PackagesCopyKey = keyof typeof PACKAGES_COPY

type Vars = Record<string, string | number>

function interpolate(template: string, vars?: Vars): string {
  if (!vars) return template
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in vars ? String(vars[key]) : match,
  )
}

export function packagesT(key: PackagesCopyKey, locale: AppLocale, vars?: Vars): string {
  const entry = PACKAGES_COPY[key]
  return interpolate(entry[locale === 'ar' ? 'ar' : 'en'], vars)
}

/** Locale-aware reader — mirrors the PA-PVA-009 copy consumer shape. */
export function usePackagesCopy() {
  const { isArabic } = useLocale()
  const resolved: AppLocale = isArabic ? 'ar' : 'en'
  const t = useCallback(
    (key: PackagesCopyKey, vars?: Vars) => packagesT(key, resolved, vars),
    [resolved],
  )
  return useMemo(() => ({ t, locale: resolved, isArabic }), [t, resolved, isArabic])
}
