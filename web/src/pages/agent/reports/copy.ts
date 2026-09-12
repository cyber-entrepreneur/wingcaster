/**
 * EN + AR copy for AGT-APR-004 / AGT-APR-005 submitters.
 * Arabic strings are provisional where marked conceptually as translation-pending.
 */

export type ReportLocale = 'en' | 'ar'

type Localized = { en: string; ar: string }

function L(en: string, ar: string): Localized {
  return { en, ar }
}

export const BAD_COMPARABLE_COPY = {
  pageTitle: L('Report a bad comparable', 'الإبلاغ عن مقارنة غير دقيقة'),
  modalTitle: L('Report this comparable', 'الإبلاغ عن هذه المقارنة'),
  closeAria: L('Cancel report', 'إلغاء البلاغ'),
  pickerLabel: L('Which comparable are you reporting?', 'أي مقارنة تُبلّغ عنها؟'),
  pickerPlaceholder: L('Search by address, portal-ID, or agent…', 'ابحث بالعنوان أو معرّف البوابة أو الوكيل…'),
  comparableIdLabel: L('Comparable ID', 'معرّف المقارنة'),
  comparableIdPlaceholder: L('cmp_… or listing id', 'cmp_… أو معرّف القائمة'),
  comparableTypeLabel: L('Comparable type', 'نوع المقارنة'),
  reasonLabel: L('Why are you reporting this?', 'لماذا تُبلّغ عن هذا؟'),
  notesLabel: L('Tell PA what happened', 'أخبر فريق المراجعة بما حدث'),
  notesPlaceholder: L(
    'Share what you saw. Kind and specific beats terse.',
    'صف ما رأيته. التفاصيل اللطيفة أفضل من الاختصار.',
  ),
  notesTooShort: L(
    'Add a bit more detail so PA can act on it.',
    'أضف مزيدًا من التفاصيل حتى يتمكن فريق المراجعة من التصرف.',
  ),
  notesTooLong: L(
    'Explanation is too long — trim it to 1000 characters.',
    'الشرح طويل جدًا — اختصره إلى 1000 حرف.',
  ),
  evidenceLabel: L('Evidence (optional, up to 3 files)', 'أدلة (اختياري، حتى 3 ملفات)'),
  evidenceHelper: L(
    "Screenshots or PDFs make PA's job faster.",
    'لقطات الشاشة أو ملفات PDF تُسرّع عمل المراجعة.',
  ),
  confidenceLabel: L('How confident are you?', 'ما مدى ثقتك؟'),
  confidenceSelf: L('I saw this myself', 'رأيته بنفسي'),
  confidenceHearsay: L('Colleague told me', 'أخبرني زميل'),
  confidenceEvidence: L('I have hard evidence', 'لدي دليل قوي'),
  submitIdle: L('Submit report', 'إرسال البلاغ'),
  submitBusy: L('Sending…', 'جارٍ الإرسال…'),
  cancel: L('Cancel', 'إلغاء'),
  successLabel: L('Report received — under PA review', 'تم استلام البلاغ — قيد مراجعة المنصة'),
  successSla: L('Typical review: 3 days', 'المراجعة المعتادة: 3 أيام'),
  successBody: L(
    'Thanks. PA will review your report and let you know the outcome on your inbox.',
    'شكرًا. سيراجع فريق المنصة بلاغك ويُعلمك بالنتيجة في صندوق الوارد.',
  ),
  successPrimary: L('View my reports', 'عرض بلاغاتي'),
  successSecondary: L('Close', 'إغلاق'),
  networkError: L(
    "Couldn't send report — check your connection and try again.",
    'تعذّر إرسال البلاغ — تحقق من الاتصال وحاول مجددًا.',
  ),
  comparableRequired: L('Pick a comparable before submitting.', 'اختر مقارنة قبل الإرسال.'),
  reasonRequired: L('Pick a reason first.', 'اختر سببًا أولًا.'),
  waitingUploads: L('Waiting for uploads to finish…', 'بانتظار انتهاء الرفع…'),
  reasonIncorrectPrice: L('Wrong price', 'سعر خاطئ'),
  reasonIncorrectPriceHelp: L(
    "The listed price doesn't match reality.",
    'السعر المدرج لا يطابق الواقع.',
  ),
  reasonWrongDetails: L('Wrong area', 'مساحة خاطئة'),
  reasonWrongDetailsHelp: L(
    'Size, bedrooms, or bathrooms are wrong.',
    'المساحة أو الغرف أو الحمامات غير صحيحة.',
  ),
  reasonAlreadySold: L('Already sold', 'تم البيع'),
  reasonAlreadySoldHelp: L('This property is off the market.', 'هذا العقار لم يعد معروضًا.'),
  reasonFake: L('Spam or fake', 'وهمي أو مزعج'),
  reasonFakeHelp: L('Not a real listing.', 'ليست قائمة حقيقية.'),
  reasonOther: L('Something else', 'شيء آخر'),
  reasonOtherHelp: L('Tell PA what you saw.', 'أخبر فريق المراجعة بما رأيته.'),
  echoAria: L('Comparable being reported', 'المقارنة قيد الإبلاغ'),
} as const

export type BadComparableCopyKey = keyof typeof BAD_COMPARABLE_COPY

export function badComparableT(key: BadComparableCopyKey, locale: ReportLocale): string {
  return BAD_COMPARABLE_COPY[key][locale]
}

/** @deprecated Prefer `badComparableT(key, locale)`. */
export const badComparableCopy = Object.fromEntries(
  Object.entries(BAD_COMPARABLE_COPY).map(([k, v]) => [k, v.en]),
) as { [K in BadComparableCopyKey]: string }

export const PRICE_REPORT_COPY = {
  heroHeading: L('Submit a price report', 'إرسال تقرير أسعار'),
  heroSubheading: L(
    'Your expert take on market pricing, reviewed by PA and published to your public profile.',
    'رؤيتك الخبيرة لتسعير السوق، تُراجعها المنصة وتُنشر على ملفك العام.',
  ),
  proBadge: L('Pro feature', 'ميزة Pro'),
  sectionSubject: L('1. Subject', '١. الموضوع'),
  sectionSubjectHelper: L('What is this report about?', 'عمّ يتحدث هذا التقرير؟'),
  subjectProperty: L('Specific property', 'عقار محدد'),
  subjectExternal: L('External / off-platform sale', 'بيع خارجي / خارج المنصة'),
  propertyIdLabel: L('Listing ID', 'معرّف القائمة'),
  propertyIdPlaceholder: L('Select or paste a listing id…', 'اختر أو الصق معرّف القائمة…'),
  externalTitleLabel: L('Property title', 'عنوان العقار'),
  externalLocationLabel: L('Location', 'الموقع'),
  changeSubject: L('Change', 'تغيير'),
  sectionRecommendation: L('2. Recommendation', '٢. التوصية'),
  sectionRecommendationHelper: L(
    'What sold-price evidence are you reporting?',
    'ما دليل سعر البيع الذي تُبلّغ عنه؟',
  ),
  currencyLabel: L('Currency', 'العملة'),
  amountLabel: L('Sold price', 'سعر البيع'),
  soldDateLabel: L('Completion date', 'تاريخ الإتمام'),
  sectionRationale: L('3. Rationale', '٣. المبررات'),
  sectionRationaleHelper: L('What supports your recommendation?', 'ما الذي يدعم توصيتك؟'),
  notesLabel: L('Evidence notes', 'ملاحظات الأدلة'),
  notesPlaceholder: L(
    'Explain your reasoning. What does the data show that the raw price alone misses?',
    'اشرح منطقك. ماذا تُظهر البيانات مما لا يظهره السعر وحده؟',
  ),
  notesTooShort: L(
    'Editorial reports need more depth — add at least a short paragraph.',
    'التقارير التحريرية تحتاج عمقًا أكبر — أضف فقرة قصيرة على الأقل.',
  ),
  notesTooLong: L(
    'Notes are too long — trim them to 3000 characters.',
    'الملاحظات طويلة جدًا — اختصرها إلى 3000 حرف.',
  ),
  sectionPublication: L('4. Publication', '٤. النشر'),
  sectionPublicationHelper: L('How should PA handle review?', 'كيف يجب أن تتعامل المنصة مع المراجعة؟'),
  evidenceLabel: L('Evidence (optional, up to 5 files)', 'أدلة (اختياري، حتى 5 ملفات)'),
  evidenceHelper: L(
    'Attach the data behind your analysis — CSVs, developer decks, sold-price screenshots. PA reviews faster with sources they can verify.',
    'أرفق البيانات خلف تحليلك — ملفات CSV أو عروض المطوّر أو لقطات أسعار البيع.',
  ),
  submitIdle: L('Submit for PA review', 'إرسال لمراجعة المنصة'),
  submitBusy: L('Sending to PA…', 'جارٍ الإرسال للمنصة…'),
  saveDraft: L('Save as draft', 'حفظ كمسودة'),
  autosaveHelper: L(
    'Your draft autosaves every 30 seconds.',
    'تُحفظ مسودتك تلقائيًا كل 30 ثانية.',
  ),
  successLabel: L(
    'Report received — under PA editorial review',
    'تم استلام التقرير — قيد المراجعة التحريرية',
  ),
  successSla: L('Typical editorial review: 48 hours', 'المراجعة التحريرية المعتادة: 48 ساعة'),
  successBody: L(
    'Thanks. PA will review your report and let you know the outcome on your inbox.',
    'شكرًا. سيراجع فريق المنصة تقريرك ويُعلمك بالنتيجة في صندوق الوارد.',
  ),
  successPrimary: L('View my reports', 'عرض تقاريري'),
  successSecondary: L('Start another report', 'بدء تقرير آخر'),
  upsellHeading: L('Price reports are a Pro feature', 'تقارير الأسعار ميزة Pro'),
  upsellBody: L(
    "Establish yourself as a market voice — Pro-tier agents publish price analyses to their public profile with WingCaster's editorial team.",
    'رسّخ حضورك كصوت في السوق — وكلاء Pro ينشرون تحليلات الأسعار على ملفهم العام مع فريق WingCaster التحريري.',
  ),
  upsellBullet1: L('Publish to your public agent profile.', 'النشر على ملفك العام كوكيل.'),
  upsellBullet2: L('WingCaster editorial team review.', 'مراجعة فريق WingCaster التحريري.'),
  upsellBullet3: L('Featured on Bazaar consumer surfaces.', 'الظهور على أسطح Bazaar الاستهلاكية.'),
  upsellPrimary: L('See Pro plans', 'اطّلع على خطط Pro'),
  upsellSecondary: L('Learn more', 'اعرف المزيد'),
  networkError: L(
    "Couldn't save — check your connection and try again.",
    'تعذّر الحفظ — تحقق من الاتصال وحاول مجددًا.',
  ),
  amountRequired: L('Enter a sold price greater than zero.', 'أدخل سعر بيع أكبر من صفر.'),
  subjectRequired: L('Pick a subject before submitting.', 'اختر موضوعًا قبل الإرسال.'),
  waitingUploads: L('Waiting for uploads to finish…', 'بانتظار انتهاء الرفع…'),
  featureDisabledToast: L(
    'This feature requires a Pro-tier subscription.',
    'هذه الميزة تتطلب اشتراك Pro.',
  ),
  sectionStepperAria: L('Report sections', 'أقسام التقرير'),
  loadingAria: L('Loading', 'جارٍ التحميل'),
} as const

export type PriceReportCopyKey = keyof typeof PRICE_REPORT_COPY

export function priceReportT(key: PriceReportCopyKey, locale: ReportLocale): string {
  return PRICE_REPORT_COPY[key][locale]
}

/** @deprecated Prefer `priceReportT(key, locale)`. */
export const priceReportCopy = Object.fromEntries(
  Object.entries(PRICE_REPORT_COPY).map(([k, v]) => [k, v.en]),
) as { [K in PriceReportCopyKey]: string }

export function reasonCopy(
  value: 'incorrect_price' | 'wrong_details' | 'already_sold' | 'fake_listing' | 'other',
  locale: ReportLocale,
): { label: string; helper: string } {
  switch (value) {
    case 'incorrect_price':
      return {
        label: badComparableT('reasonIncorrectPrice', locale),
        helper: badComparableT('reasonIncorrectPriceHelp', locale),
      }
    case 'wrong_details':
      return {
        label: badComparableT('reasonWrongDetails', locale),
        helper: badComparableT('reasonWrongDetailsHelp', locale),
      }
    case 'already_sold':
      return {
        label: badComparableT('reasonAlreadySold', locale),
        helper: badComparableT('reasonAlreadySoldHelp', locale),
      }
    case 'fake_listing':
      return {
        label: badComparableT('reasonFake', locale),
        helper: badComparableT('reasonFakeHelp', locale),
      }
    default:
      return {
        label: badComparableT('reasonOther', locale),
        helper: badComparableT('reasonOtherHelp', locale),
      }
  }
}
