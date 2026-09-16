/**
 * PA-POR portal-admin copy (PA-POR-001 list · PA-POR-002 detail · PA-POR-003 history).
 * Shape: { en, ar } per key; locale resolved at read time via useLocale().
 * Real MENA business Arabic — no [TRANSLATION-PENDING], no English fallbacks.
 */
import { useCallback, useMemo } from 'react'
import { useLocale, type AppLocale } from '@/hooks/useLocale'

export const PORTAL_COPY = {
  // ── Shell / shared ────────────────────────────────────────────────────
  'shell.desktopOnly.title': {
    en: 'PA console requires a desktop screen',
    ar: 'تتطلّب وحدة الإدارة شاشة سطح مكتب',
  },
  'shell.desktopOnly.body': {
    en: 'The portal registry needs 1024px or wider. Open this page on a larger display.',
    ar: 'يحتاج سجلّ المنافذ إلى عرض 1024 بكسل أو أكثر. افتح هذه الصفحة على شاشة أكبر.',
  },
  'shell.backHome': { en: 'Back to home', ar: 'العودة إلى الرئيسية' },
  'shell.testStrip': {
    en: 'TEST ENVIRONMENT — portal catalog changes apply platform-wide; agent-connection counts shown are TEST-env only.',
    ar: 'بيئة الاختبار — تغييرات كتالوج المنافذ تُطبَّق على مستوى المنصّة؛ وأعداد ربط الوكلاء المعروضة خاصّة ببيئة الاختبار فقط.',
  },
  'shell.retry': { en: 'Retry', ar: 'إعادة المحاولة' },
  'shell.gate.title': { en: 'Platform admin required', ar: 'مطلوب صلاحية مسؤول منصّة' },
  'shell.gate.body': {
    en: 'The portal registry is restricted to platform admins.',
    ar: 'سجلّ المنافذ مقصور على مسؤولي المنصّة.',
  },

  // ── PA-POR-001 · list ─────────────────────────────────────────────────
  'list.title': { en: 'Portal registry', ar: 'سجلّ المنافذ' },
  'list.subtitle': {
    en: '{total} total · {live} live · {stub} stub · {deprecated} deprecated · {countries} countries covered',
    ar: '{total} الإجمالي · {live} مباشر · {stub} مبدئي · {deprecated} متوقّف · {countries} دولة مغطّاة',
  },
  'list.addPortal': { en: 'Add portal', ar: 'إضافة منفذ' },
  'list.refresh': { en: 'Refresh portal registry', ar: 'تحديث سجلّ المنافذ' },
  'list.exportCsv': { en: 'Export CSV', ar: 'تصدير CSV' },
  'list.shortcuts': { en: 'Show keyboard shortcuts', ar: 'عرض اختصارات لوحة المفاتيح' },
  'list.refreshedToast': { en: 'Portal registry refreshed.', ar: 'تم تحديث سجلّ المنافذ.' },
  'list.loadError': {
    en: "Couldn't load the portal registry. Try again.",
    ar: 'تعذّر تحميل سجلّ المنافذ. حاول مرة أخرى.',
  },
  'list.filter.aria': { en: 'Filter portal registry', ar: 'تصفية سجلّ المنافذ' },
  'list.tab.all': { en: 'All', ar: 'الكل' },
  'list.tab.live': { en: 'LIVE', ar: 'مباشر' },
  'list.tab.stub': { en: 'STUB', ar: 'مبدئي' },
  'list.tab.deprecated': { en: 'DEPRECATED', ar: 'متوقّف' },
  'list.filter.activeOnly': { en: 'Active only', ar: 'النشِطة فقط' },
  'list.filter.country': { en: 'Country', ar: 'الدولة' },
  'list.filter.anyCountry': { en: 'Any country', ar: 'أي دولة' },
  'list.filter.searchPlaceholder': {
    en: 'Search portal code, display name, or adapter class…',
    ar: 'ابحث برمز المنفذ أو الاسم المعروض أو فئة المحوّل…',
  },
  'list.sort.label': { en: 'Sort by', ar: 'الترتيب حسب' },
  'list.sort.lastChangeDesc': { en: 'Last change (newest first)', ar: 'آخر تغيير (الأحدث أولاً)' },
  'list.sort.lastChangeAsc': { en: 'Last change (oldest first)', ar: 'آخر تغيير (الأقدم أولاً)' },
  'list.sort.codeAsc': { en: 'Portal code (A–Z)', ar: 'رمز المنفذ (أ–ي)' },
  'list.sort.displayNameAsc': { en: 'Display name (A–Z)', ar: 'الاسم المعروض (أ–ي)' },
  'list.sort.connectedDesc': { en: 'Connected agents (most first)', ar: 'الوكلاء المرتبطون (الأكثر أولاً)' },
  'list.sort.countryCountDesc': { en: 'Country count (most first)', ar: 'عدد الدول (الأكثر أولاً)' },
  'list.col.portal': { en: 'Portal', ar: 'المنفذ' },
  'list.col.countries': { en: 'Countries', ar: 'الدول' },
  'list.col.adapter': { en: 'Adapter', ar: 'المحوّل' },
  'list.col.active': { en: 'Active', ar: 'نشِط' },
  'list.col.sla': { en: 'SLA', ar: 'مستوى الخدمة' },
  'list.col.connected': { en: 'Connected', ar: 'المرتبطون' },
  'list.col.lastChange': { en: 'Last change', ar: 'آخر تغيير' },
  'list.col.actions': { en: 'Actions', ar: 'الإجراءات' },
  'list.adapter.live': { en: 'LIVE', ar: 'مباشر' },
  'list.adapter.stub': { en: 'STUB', ar: 'مبدئي' },
  'list.adapter.deprecated': { en: 'DEPRECATED', ar: 'متوقّف' },
  'list.adapter.stub.tooltip': {
    en: 'This portal has a registry row but no matching adapter file. Ship the adapter via Cursor before activating.',
    ar: 'لهذا المنفذ سجلّ لكن لا يوجد ملف محوّل مطابق. جهّز المحوّل عبر Cursor قبل التفعيل.',
  },
  'list.adapter.deprecated.tooltip': {
    en: 'This portal is scheduled for removal. Existing publishes complete; no new publishes are accepted.',
    ar: 'هذا المنفذ مُدرَج للإزالة. تكتمل عمليات النشر القائمة؛ ولا تُقبل عمليات نشر جديدة.',
  },
  'list.active.active': { en: 'Active', ar: 'نشِط' },
  'list.active.inactive': { en: 'Inactive', ar: 'غير نشِط' },
  'list.active.pending': { en: 'Pending approval', ar: 'بانتظار الاعتماد' },
  'list.sla.missing': { en: '—', ar: '—' },
  'list.connected.tooltip': {
    en: 'In {env}: {n} agents connected across {m} agencies.',
    ar: 'في {env}: {n} وكيلاً مرتبطاً عبر {m} وكالة.',
  },
  'list.lastChange.by': { en: 'by {name}', ar: 'بواسطة {name}' },
  'list.action.view': { en: 'View {name}', ar: 'عرض {name}' },
  'list.action.edit': { en: 'Edit {name}', ar: 'تعديل {name}' },
  'list.action.history': { en: 'Activation history for {name}', ar: 'سجلّ التفعيل لـ {name}' },
  'list.empty.title': { en: 'No portals in the catalog yet', ar: 'لا توجد منافذ في الكتالوج بعد' },
  'list.empty.body': {
    en: 'Add the first portal to enable publishing and inbound lead capture. A newly-added portal starts as a STUB — activation requires a matching adapter file and a two-person approval.',
    ar: 'أضِف المنفذ الأول لتفعيل النشر والتقاط العملاء المحتملين. يبدأ المنفذ المُضاف حديثاً كمبدئي — ويتطلّب التفعيل ملف محوّل مطابق واعتماد شخصين.',
  },
  'list.empty.cta': { en: 'Add first portal →', ar: 'أضِف أول منفذ ←' },
  'list.emptyFilter.title': { en: 'No portals match your filters', ar: 'لا توجد منافذ تطابق عوامل التصفية' },
  'list.emptyFilter.body': {
    en: 'Try clearing the country filter or switching to All status.',
    ar: 'جرّب مسح تصفية الدولة أو التبديل إلى حالة الكل.',
  },
  'list.emptyFilter.cta': { en: 'Clear filters', ar: 'مسح عوامل التصفية' },
  'list.pagination': { en: '{start}–{end} of {total}', ar: '{start}–{end} من {total}' },
  'list.pageSize': { en: 'Rows per page', ar: 'صفوف في الصفحة' },
  'list.prevPage': { en: 'Previous page', ar: 'الصفحة السابقة' },
  'list.nextPage': { en: 'Next page', ar: 'الصفحة التالية' },
  'list.skipToTable': { en: 'Skip to portal table', ar: 'تخطَّ إلى جدول المنافذ' },

  // ── keyboard shortcuts ────────────────────────────────────────────────
  'kbd.title': { en: 'Keyboard shortcuts', ar: 'اختصارات لوحة المفاتيح' },
  'kbd.close': { en: 'Close', ar: 'إغلاق' },
  'kbd.next': { en: 'Next portal', ar: 'المنفذ التالي' },
  'kbd.prev': { en: 'Previous portal', ar: 'المنفذ السابق' },
  'kbd.open': { en: 'View focused portal', ar: 'عرض المنفذ المحدَّد' },
  'kbd.edit': { en: 'Edit focused portal', ar: 'تعديل المنفذ المحدَّد' },
  'kbd.history': { en: 'Activation history for focused portal', ar: 'سجلّ التفعيل للمنفذ المحدَّد' },
  'kbd.add': { en: 'Add new portal', ar: 'إضافة منفذ جديد' },
  'kbd.refresh': { en: 'Refresh registry', ar: 'تحديث السجلّ' },
  'kbd.help': { en: 'Open shortcuts', ar: 'فتح الاختصارات' },
  'kbd.escape': { en: 'Close modal / sheet', ar: 'إغلاق النافذة / اللوح' },

  // ── PA-POR-002 · detail / edit / create ───────────────────────────────
  'detail.breadcrumb': { en: 'Portal registry', ar: 'سجلّ المنافذ' },
  'detail.create.title': { en: 'Add portal', ar: 'إضافة منفذ' },
  'detail.edit.title': { en: 'Edit {name}', ar: 'تعديل {name}' },
  'detail.view.editCta': { en: 'Edit', ar: 'تعديل' },
  'detail.view.historyCta': { en: 'View activation history', ar: 'عرض سجلّ التفعيل' },
  'detail.discard': { en: 'Discard changes', ar: 'تجاهل التغييرات' },
  'detail.banner.edit': {
    en: 'Editing {name} — changes create a new registry version. Activation flips still require two-person approval.',
    ar: 'جارٍ تعديل {name} — تُنشئ التغييرات نسخة جديدة من السجلّ. ولا تزال تبديلات التفعيل تتطلّب اعتماد شخصين.',
  },
  'detail.banner.create': {
    en: 'New portal — a STUB row is created immediately on save; activation requires an adapter file and a second admin’s approval.',
    ar: 'منفذ جديد — يُنشأ سجلّ مبدئي فور الحفظ؛ ويتطلّب التفعيل ملف محوّل واعتماد مسؤول ثانٍ.',
  },
  'detail.section.identity': { en: 'Identity', ar: 'الهوية' },
  'detail.section.identity.helper': {
    en: 'The public-facing name and code for this portal. Code is immutable after creation.',
    ar: 'الاسم والرمز الظاهران لهذا المنفذ. الرمز غير قابل للتغيير بعد الإنشاء.',
  },
  'detail.field.code': { en: 'Portal code', ar: 'رمز المنفذ' },
  'detail.field.code.helperCreate': {
    en: 'Lowercase letters, digits, and underscores. 3–64 chars. e.g. property_finder_ae.',
    ar: 'أحرف صغيرة وأرقام وشُرَط سفلية. من 3 إلى 64 حرفاً. مثال: property_finder_ae.',
  },
  'detail.field.code.helperEdit': {
    en: 'Portal code is immutable — changing it would break metering event keys and feature registration.',
    ar: 'رمز المنفذ غير قابل للتغيير — تغييره يُعطِّل مفاتيح أحداث القياس وتسجيل الميزات.',
  },
  'detail.field.code.invalid': {
    en: 'Use lowercase letters, digits, and underscores (3–64 chars).',
    ar: 'استخدم أحرفاً صغيرة وأرقاماً وشُرَطاً سفلية (من 3 إلى 64 حرفاً).',
  },
  'detail.field.code.taken': {
    en: 'This portal code is already in use.',
    ar: 'رمز المنفذ هذا مستخدَم بالفعل.',
  },
  'detail.field.displayName': { en: 'Display name', ar: 'الاسم المعروض' },
  'detail.field.displayName.helper': {
    en: 'Shown to agents in the portal picker, publish tracker, and moderation filters.',
    ar: 'يظهر للوكلاء في مُنتقي المنافذ ومتتبّع النشر وعوامل تصفية المراجعة.',
  },
  'detail.field.displayName.required': { en: 'Display name is required.', ar: 'الاسم المعروض مطلوب.' },
  'detail.field.description': { en: 'Description', ar: 'الوصف' },
  'detail.field.description.helper': {
    en: 'Optional. 0–500 chars. Shown in the portal picker card.',
    ar: 'اختياري. من 0 إلى 500 حرف. يظهر في بطاقة مُنتقي المنافذ.',
  },
  'detail.field.logo': { en: 'Logo', ar: 'الشعار' },
  'detail.field.logo.helper': {
    en: 'SVG or PNG, max 200KB, min 64×64. Displayed at 32×32 in the catalog.',
    ar: 'SVG أو PNG، بحدّ أقصى 200 كيلوبايت، وبحدّ أدنى 64×64. يُعرض بحجم 32×32 في الكتالوج.',
  },
  'detail.field.logoUrl': { en: 'Logo URL', ar: 'رابط الشعار' },
  'detail.field.logoUrl.helper': {
    en: 'Reference an uploaded asset path (e.g. /assets/portals/aqar_sa.svg).',
    ar: 'أشِر إلى مسار أصل مرفوع (مثال: /assets/portals/aqar_sa.svg).',
  },
  'detail.section.coverage': { en: 'Coverage', ar: 'التغطية' },
  'detail.section.coverage.helper': {
    en: 'Countries this portal operates in. Multiple countries allowed for pan-regional portals.',
    ar: 'الدول التي يعمل فيها هذا المنفذ. يُسمح بعدّة دول للمنافذ الإقليمية.',
  },
  'detail.field.countryCodes': { en: 'Country codes', ar: 'رموز الدول' },
  'detail.field.countryCodes.helper': {
    en: 'ISO 3166-1 alpha-2. Add at least one. Metered events carry a country_code dimension.',
    ar: 'وفق ISO 3166-1 alpha-2. أضِف واحدة على الأقل. تحمل أحداث القياس بُعد رمز الدولة.',
  },
  'detail.field.countryCodes.required': {
    en: 'Add at least one country code.',
    ar: 'أضِف رمز دولة واحداً على الأقل.',
  },
  'detail.field.countryCodes.addPlaceholder': { en: 'Add ISO code (e.g. AE)', ar: 'أضِف رمز ISO (مثال: AE)' },
  'detail.field.countryCodes.add': { en: 'Add country', ar: 'إضافة دولة' },
  'detail.field.countryCodes.remove': { en: 'Remove {code}', ar: 'إزالة {code}' },
  'detail.field.primaryLanguage': { en: 'Primary language', ar: 'اللغة الأساسية' },
  'detail.lang.en': { en: 'English', ar: 'الإنجليزية' },
  'detail.lang.ar': { en: 'Arabic', ar: 'العربية' },
  'detail.lang.fr': { en: 'French', ar: 'الفرنسية' },
  'detail.lang.other': { en: 'Other', ar: 'أخرى' },
  'detail.section.adapter': { en: 'Adapter', ar: 'المحوّل' },
  'detail.section.adapter.helper': {
    en: 'Publisher and inbound adapter class — the code file that translates listings to and from the portal’s API.',
    ar: 'فئة محوّل النشر والوارد — ملف الكود الذي يترجم الإعلانات من وإلى واجهة المنفذ.',
  },
  'detail.field.adapterClass': { en: 'Adapter class name', ar: 'اسم فئة المحوّل' },
  'detail.field.adapterClass.helper': {
    en: 'Path relative to backend/src/lib/notifications/. If the file doesn’t exist yet, this row becomes a STUB — activation requires the adapter to ship first.',
    ar: 'مسار نسبي إلى backend/src/lib/notifications/. إن لم يوجد الملف بعد، يصبح هذا السجلّ مبدئياً — ويتطلّب التفعيل تجهيز المحوّل أولاً.',
  },
  'detail.field.publisherConfig': { en: 'Publisher config (JSON)', ar: 'إعدادات النشر (JSON)' },
  'detail.field.publisherConfig.helper': {
    en: 'Store secrets in the secrets manager and reference them here as secrets/…/… paths.',
    ar: 'خزِّن الأسرار في مدير الأسرار وأشِر إليها هنا كمسارات secrets/…/….',
  },
  'detail.field.inboundConfig': { en: 'Inbound config (JSON)', ar: 'إعدادات الوارد (JSON)' },
  'detail.field.inboundConfig.helper': {
    en: 'Webhook secret refs, email-forward addresses, inbound polling intervals. Same secret-ref rule.',
    ar: 'مراجع أسرار الويب-هوك، وعناوين تحويل البريد، وفترات جلب الوارد. تنطبق قاعدة مرجع السرّ نفسها.',
  },
  'detail.jsonInvalid': { en: 'Invalid JSON — fix before saving.', ar: 'JSON غير صالح — صحّحه قبل الحفظ.' },
  'detail.secretInJsonb': {
    en: 'Looks like a raw secret. Store the value in the secrets manager and enter its reference path here.',
    ar: 'يبدو أنه سرّ خام. خزِّن القيمة في مدير الأسرار وأدخِل مسار مرجعها هنا.',
  },
  'detail.section.validators': { en: 'Validators', ar: 'أدوات التحقق' },
  'detail.section.validators.helper': {
    en: 'Per-portal validation ruleset — enforces portal-specific required fields.',
    ar: 'مجموعة قواعد تحقّق لكل منفذ — تفرض الحقول المطلوبة الخاصّة بالمنفذ.',
  },
  'detail.field.validatorRef': { en: 'Validator ruleset', ar: 'مجموعة قواعد التحقق' },
  'detail.field.validatorRef.helper': {
    en: 'Points at backend/src/lib/portal-validators/<code>.js.',
    ar: 'يشير إلى backend/src/lib/portal-validators/<code>.js.',
  },
  'detail.section.metering': { en: 'Metering', ar: 'القياس' },
  'detail.section.metering.helper': {
    en: 'Auto-registered metered feature on activation. Per-country pricing lives in package admin.',
    ar: 'ميزة مقيسة تُسجَّل تلقائياً عند التفعيل. يُضبط التسعير لكل دولة في إدارة الباقات.',
  },
  'detail.field.featureCode': { en: 'Feature code', ar: 'رمز الميزة' },
  'detail.field.featureCode.helper': {
    en: 'Auto-generated from the portal code. Reads: PUBLISHING_REALESTATE_{code}.',
    ar: 'يُولَّد تلقائياً من رمز المنفذ. يظهر بالشكل: PUBLISHING_REALESTATE_{code}.',
  },
  'detail.field.featureCode.copy': { en: 'Copy feature code', ar: 'نسخ رمز الميزة' },
  'detail.field.featureCode.copied': { en: 'Feature code copied.', ar: 'تم نسخ رمز الميزة.' },
  'detail.section.sla': { en: 'SLA', ar: 'مستوى الخدمة' },
  'detail.section.sla.helper': {
    en: 'Moderation target. Sets publisher_config.sla_hours on the current version.',
    ar: 'هدف المراجعة. يضبط publisher_config.sla_hours على النسخة الحالية.',
  },
  'detail.field.sla': { en: 'SLA target (hours)', ar: 'هدف مستوى الخدمة (ساعات)' },
  'detail.field.sla.helper': {
    en: 'Bayut standard 4h · Property Finder 6h · Dubizzle 8h. Override at portal renegotiation.',
    ar: 'بيوت 4 ساعات · بروبرتي فايندر 6 ساعات · دوبيزل 8 ساعات. عدِّلها عند إعادة التفاوض.',
  },
  'detail.section.activation': { en: 'Activation', ar: 'التفعيل' },
  'detail.section.activation.helper': {
    en: 'Activation flips require two-person approval. A different admin than the submitter must approve.',
    ar: 'تتطلّب تبديلات التفعيل اعتماد شخصين. ويجب أن يعتمدها مسؤول غير مُقدِّم الطلب.',
  },
  'detail.field.currentState': { en: 'Current state', ar: 'الحالة الحالية' },
  'detail.field.effectiveFrom': { en: 'Effective from', ar: 'يسري اعتباراً من' },
  'detail.field.effectiveFrom.helper': {
    en: 'Date the activation change takes effect. Defaults to now.',
    ar: 'تاريخ سريان تغيير التفعيل. الافتراضي هو الآن.',
  },
  'detail.field.submitterNotes': { en: 'Notes for the second approver', ar: 'ملاحظات للمعتمِد الثاني' },
  'detail.field.submitterNotes.placeholder': {
    en: 'Explain why this portal is ready to activate…',
    ar: 'اشرح سبب جاهزية هذا المنفذ للتفعيل…',
  },
  'detail.field.approverNotes': { en: 'Approver notes', ar: 'ملاحظات المعتمِد' },
  'detail.cta.requestActivation': { en: 'Request activation', ar: 'طلب التفعيل' },
  'detail.cta.requestDeactivation': { en: 'Request deactivation', ar: 'طلب إلغاء التفعيل' },
  'detail.cta.withdraw': { en: 'Withdraw request', ar: 'سحب الطلب' },
  'detail.cta.approveActivation': { en: 'Approve activation', ar: 'اعتماد التفعيل' },
  'detail.cta.approveDeactivation': { en: 'Approve deactivation', ar: 'اعتماد إلغاء التفعيل' },
  'detail.cta.reject': { en: 'Reject request', ar: 'رفض الطلب' },
  'detail.cta.deprecate': { en: 'Deprecate portal', ar: 'إيقاف المنفذ' },
  'detail.activation.stubBlocked': {
    en: 'Adapter file is missing — ship it via Cursor before requesting activation.',
    ar: 'ملف المحوّل مفقود — جهّزه عبر Cursor قبل طلب التفعيل.',
  },
  'detail.activation.pendingOwn': {
    en: 'You submitted this request on {date}. Waiting on a second admin to approve.',
    ar: 'قدّمتَ هذا الطلب في {date}. بانتظار اعتماد مسؤول ثانٍ.',
  },
  'detail.activation.pendingApprover': {
    en: 'Submitted by {name} on {date}. Review and approve or reject.',
    ar: 'قدّمه {name} في {date}. راجِعه واعتمده أو ارفضه.',
  },
  'detail.activation.ownBlock': {
    en: 'You can’t approve your own activation request. A different admin must approve.',
    ar: 'لا يمكنك اعتماد طلب التفعيل الخاص بك. يجب أن يعتمده مسؤول آخر.',
  },
  'detail.deprecate.title': { en: 'Deprecate {name}?', ar: 'إيقاف {name}؟' },
  'detail.deprecate.body': {
    en: 'Deprecation marks this portal as retired. Existing publishes complete; no new publishes are accepted.',
    ar: 'يضع الإيقاف هذا المنفذ في حالة تقاعد. تكتمل عمليات النشر القائمة؛ ولا تُقبل عمليات نشر جديدة.',
  },
  'detail.deprecate.confirm': { en: 'Deprecate', ar: 'إيقاف' },
  'detail.deprecate.cancel': { en: 'Cancel', ar: 'إلغاء' },
  'detail.save.newVersion': { en: 'Save as new version', ar: 'حفظ كنسخة جديدة' },
  'detail.save.create': { en: 'Create portal', ar: 'إنشاء المنفذ' },
  'detail.save.saving': { en: 'Saving…', ar: 'جارٍ الحفظ…' },
  'detail.toast.saved': { en: 'Saved {name} as version {n}.', ar: 'تم حفظ {name} كنسخة {n}.' },
  'detail.toast.created': { en: 'Created {name}.', ar: 'تم إنشاء {name}.' },
  'detail.toast.activationRequested': {
    en: 'Requested activation for {name}. Waiting on a second admin.',
    ar: 'تم طلب تفعيل {name}. بانتظار مسؤول ثانٍ.',
  },
  'detail.toast.deactivationRequested': {
    en: 'Requested deactivation for {name}. Waiting on a second admin.',
    ar: 'تم طلب إلغاء تفعيل {name}. بانتظار مسؤول ثانٍ.',
  },
  'detail.toast.approved': {
    en: 'Approved. {name} is now {state}.',
    ar: 'تم الاعتماد. {name} الآن {state}.',
  },
  'detail.toast.rejected': { en: 'Rejected the request for {name}.', ar: 'تم رفض الطلب الخاص بـ {name}.' },
  'detail.toast.withdrawn': { en: 'Withdrew the request for {name}.', ar: 'تم سحب الطلب الخاص بـ {name}.' },
  'detail.toast.deprecated': { en: 'Deprecated {name}.', ar: 'تم إيقاف {name}.' },
  'detail.loadError': {
    en: "Couldn't load this portal. Try again.",
    ar: 'تعذّر تحميل هذا المنفذ. حاول مرة أخرى.',
  },
  'detail.actionError': {
    en: 'Something went wrong. Try again.',
    ar: 'حدث خطأ ما. حاول مرة أخرى.',
  },
  'detail.version.banner': {
    en: 'Read-only snapshot — version {n} of the registry.',
    ar: 'لقطة للقراءة فقط — النسخة {n} من السجلّ.',
  },
  'detail.preview.title': { en: 'Portal preview across downstream surfaces', ar: 'معاينة المنفذ عبر الواجهات المتأثّرة' },
  'detail.preview.chn': { en: 'In portal picker', ar: 'في مُنتقي المنافذ' },
  'detail.preview.inb': { en: 'In inbox source badge', ar: 'في شارة مصدر البريد' },
  'detail.preview.pub': { en: 'In publish tracker', ar: 'في متتبّع النشر' },
  'detail.preview.publishingTo': { en: 'Publishing to {name}', ar: 'جارٍ النشر إلى {name}' },
  'detail.preview.slaChip': { en: '{n}h SLA', ar: '{n} ساعة مستوى خدمة' },
  'detail.skipToForm': { en: 'Skip to portal form', ar: 'تخطَّ إلى نموذج المنفذ' },

  // ── PA-POR-003 · activation history ───────────────────────────────────
  'history.breadcrumbHistory': { en: 'History', ar: 'السجلّ' },
  'history.title': { en: 'Activation history — {name}', ar: 'سجلّ التفعيل — {name}' },
  'history.backToPortal': { en: 'Back to portal', ar: 'العودة إلى المنفذ' },
  'history.exportCsv': { en: 'Export CSV', ar: 'تصدير CSV' },
  'history.filter.eventType': { en: 'Event type', ar: 'نوع الحدث' },
  'history.filter.allEvents': { en: 'All events', ar: 'كل الأحداث' },
  'history.filter.reset': { en: 'Reset filters', ar: 'إعادة ضبط التصفية' },
  'history.event.created': { en: 'Created', ar: 'أُنشئ' },
  'history.event.submitted': { en: 'Change requested', ar: 'طُلب تغيير' },
  'history.event.approved': { en: 'Approved', ar: 'اعتُمد' },
  'history.event.rejected': { en: 'Rejected', ar: 'رُفض' },
  'history.event.withdrawn': { en: 'Withdrawn', ar: 'سُحب' },
  'history.event.activated': { en: 'Activated', ar: 'فُعِّل' },
  'history.event.deactivated': { en: 'Deactivated', ar: 'أُلغي تفعيله' },
  'history.event.adapter_upgraded': { en: 'Adapter upgraded', ar: 'رُقِّي المحوّل' },
  'history.event.sla_changed': { en: 'SLA changed', ar: 'تغيّر مستوى الخدمة' },
  'history.event.country_coverage_changed': { en: 'Country coverage changed', ar: 'تغيّرت تغطية الدول' },
  'history.event.validator_ruleset_changed': { en: 'Validator ruleset changed', ar: 'تغيّرت قواعد التحقق' },
  'history.event.publisher_config_changed': { en: 'Publisher config changed', ar: 'تغيّرت إعدادات النشر' },
  'history.event.inbound_config_changed': { en: 'Inbound config changed', ar: 'تغيّرت إعدادات الوارد' },
  'history.event.deprecated': { en: 'Deprecated', ar: 'أُوقف' },
  'history.actor.submittedBy': { en: 'Submitted by {name}', ar: 'قدّمه {name}' },
  'history.actor.approvedBy': { en: 'Approved by {name}', ar: 'اعتمده {name}' },
  'history.notes.submitter': { en: 'Submitter', ar: 'المُقدِّم' },
  'history.notes.approver': { en: 'Approver', ar: 'المعتمِد' },
  'history.diff.toggleShow': { en: 'View diff', ar: 'عرض الفروقات' },
  'history.diff.toggleHide': { en: 'Hide diff', ar: 'إخفاء الفروقات' },
  'history.diff.before': { en: 'Before', ar: 'قبل' },
  'history.diff.after': { en: 'After', ar: 'بعد' },
  'history.diff.none': {
    en: 'No shape changes recorded for this event.',
    ar: 'لم تُسجَّل تغييرات بنيوية لهذا الحدث.',
  },
  'history.versionLink': { en: '→ Version {n} of the registry', ar: '← النسخة {n} من السجلّ' },
  'history.empty.title': { en: 'No activation events yet', ar: 'لا توجد أحداث تفعيل بعد' },
  'history.empty.body': {
    en: '{name} hasn’t been activated, edited, or deactivated yet. Events land here as they happen.',
    ar: 'لم يُفعَّل {name} أو يُعدَّل أو يُلغَ تفعيله بعد. تظهر الأحداث هنا فور وقوعها.',
  },
  'history.emptyFilter.title': { en: 'No events match your filters', ar: 'لا توجد أحداث تطابق عوامل التصفية' },
  'history.emptyFilter.cta': { en: 'Reset filters', ar: 'إعادة ضبط التصفية' },
  'history.loadError': {
    en: "Couldn't load activation history. Try again.",
    ar: 'تعذّر تحميل سجلّ التفعيل. حاول مرة أخرى.',
  },
  'history.pagination': { en: '{start}–{end} of {total}', ar: '{start}–{end} من {total}' },
  'history.pageSize': { en: 'Events per page', ar: 'أحداث في الصفحة' },
  'history.skipToTimeline': { en: 'Skip to activation timeline', ar: 'تخطَّ إلى مخطّط التفعيل الزمني' },
} as const

export type PortalCopyKey = keyof typeof PORTAL_COPY

function interpolate(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in vars ? String(vars[key]) : match,
  )
}

export function portalT(
  key: PortalCopyKey,
  locale: AppLocale,
  vars?: Record<string, string | number>,
): string {
  const entry = PORTAL_COPY[key]
  return interpolate(entry[locale === 'ar' ? 'ar' : 'en'], vars)
}

/** Locale-aware reader — mirrors the useTwoPersonCopy() consumer shape. */
export function usePortalCopy() {
  const { isArabic } = useLocale()
  const locale: AppLocale = isArabic ? 'ar' : 'en'
  const t = useCallback(
    (key: PortalCopyKey, vars?: Record<string, string | number>) => portalT(key, locale, vars),
    [locale],
  )
  return useMemo(() => ({ t, locale, isArabic }), [t, locale, isArabic])
}

export const PRIMARY_LANGUAGE_OPTIONS = [
  { value: 'en', key: 'detail.lang.en' as const },
  { value: 'ar', key: 'detail.lang.ar' as const },
  { value: 'fr', key: 'detail.lang.fr' as const },
  { value: 'other', key: 'detail.lang.other' as const },
] as const

export const HISTORY_EVENT_FILTERS = [
  'activated',
  'deactivated',
  'adapter_upgraded',
  'sla_changed',
  'country_coverage_changed',
  'validator_ruleset_changed',
  'publisher_config_changed',
  'inbound_config_changed',
  'deprecated',
] as const
