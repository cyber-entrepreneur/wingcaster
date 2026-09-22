/**
 * AGT-ONB family explicit copy — EN + AR (MENA).
 * Shape matches `loginCopy.ts` LOGIN_COPY / t().
 */

export type OnboardingLocale = 'en' | 'ar'

export const ONBOARDING_COPY = {
  // —— Welcome (AGT-ONB-001) ——
  'welcome.progress': {
    en: 'Step 1 of 4 · Welcome',
    ar: 'الخطوة 1 من 4 · مرحبًا',
  },
  'welcome.h1.named': {
    en: 'Welcome to WingCaster, {firstName}',
    ar: 'مرحبًا بك في وينغكاستر، {firstName}',
  },
  'welcome.h1': {
    en: 'Welcome to WingCaster',
    ar: 'مرحبًا بك في وينغكاستر',
  },
  'welcome.sub': {
    en: "Let's get your first listing on WhatsApp — under 3 minutes.",
    ar: 'لنضع إعلانك الأول على واتساب — في أقل من 3 دقائق.',
  },
  'welcome.section': {
    en: 'How would you like to start?',
    ar: 'كيف تود أن تبدأ؟',
  },
  'welcome.path.whatsapp.label': {
    en: 'WhatsApp voice memo',
    ar: 'ملاحظة صوتية عبر واتساب',
  },
  'welcome.path.whatsapp.description': {
    en: 'Send photos + a voice note to our WhatsApp. We draft the listing for you.',
    ar: 'أرسل صورًا ومذكرة صوتية إلى واتسابنا. نصيغ الإعلان نيابة عنك.',
  },
  'welcome.path.whatsapp.time': {
    en: '~2 min',
    ar: '~٢ دقائق',
  },
  'welcome.path.whatsapp.recommended': {
    en: 'Recommended · fastest to your first listing',
    ar: 'موصى به · الأسرع لإعلانك الأول',
  },
  'welcome.path.manual.label': {
    en: 'Add manually',
    ar: 'إضافة يدوية',
  },
  'welcome.path.manual.description': {
    en: 'Step-by-step wizard. You type; we help.',
    ar: 'معالج خطوة بخطوة. أنت تكتب؛ نحن نساعد.',
  },
  'welcome.path.manual.time': {
    en: '~5 min',
    ar: '~٥ دقائق',
  },
  'welcome.path.import.label': {
    en: 'Import a spreadsheet',
    ar: 'استيراد جدول بيانات',
  },
  'welcome.path.import.description': {
    en: "Upload existing inventory as CSV or Excel. We'll map the columns.",
    ar: 'ارفع مخزونك الحالي كملف CSV أو Excel. سنطابق الأعمدة.',
  },
  'welcome.path.import.time': {
    en: 'Depends on file size',
    ar: 'يعتمد على حجم الملف',
  },
  'welcome.cta': {
    en: 'Get started →',
    ar: 'ابدأ ←',
  },
  'welcome.cta.saving': {
    en: 'Saving…',
    ar: 'جارٍ الحفظ…',
  },
  'welcome.skip': {
    en: 'Skip for now, take me to the dashboard',
    ar: 'تخطَّ الآن، خذني إلى لوحة التحكم',
  },
  'welcome.value.1': {
    en: 'Draft listings from a voice memo.',
    ar: 'صغ الإعلانات من مذكرة صوتية.',
  },
  'welcome.value.2': {
    en: 'Publish once, syndicate everywhere.',
    ar: 'انشر مرة واحدة، ووزّع في كل مكان.',
  },
  'welcome.value.3': {
    en: 'Every inquiry, one inbox.',
    ar: 'كل استفسار في صندوق وارد واحد.',
  },
  'welcome.agentCount': {
    en: 'Joining {agentCount}+ MENA agents on WingCaster',
    ar: 'انضم إلى أكثر من {agentCount} وكيل في المنطقة على وينغكاستر',
  },
  'welcome.error.save': {
    en: "We couldn't save your choice. Try again?",
    ar: 'تعذّر حفظ اختيارك. أعد المحاولة؟',
  },
  'welcome.error.state': {
    en: "We couldn't check your progress. Continue anyway?",
    ar: 'تعذّر التحقق من تقدّمك. هل تتابع على أي حال؟',
  },
  'welcome.offline': {
    en: "You're offline. Reconnect to continue setup — your progress is saved.",
    ar: 'أنت غير متصل. أعد الاتصال لمتابعة الإعداد — تقدّمك محفوظ.',
  },
  'welcome.hero.alt': {
    en: 'MENA agent listing a property on WhatsApp',
    ar: 'وكيل في المنطقة يعرض عقارًا عبر واتساب',
  },
  'welcome.skip.queued': {
    en: 'Skip queued until you reconnect.',
    ar: 'تم وضع التخطي في الانتظار حتى تعيد الاتصال.',
  },
  'welcome.toast.skip': {
    en: 'Welcome skipped — finish setup anytime from your checklist.',
    ar: 'تم تخطي الترحيب — أكمل الإعداد في أي وقت من قائمة التحقق.',
  },

  // —— WhatsApp intake (AGT-ONB-002) ——
  'whatsapp.progress': {
    en: 'Step 2 of 4 · WhatsApp intake',
    ar: 'الخطوة 2 من 4 · واتساب',
  },
  'whatsapp.h1': {
    en: 'Bind your WhatsApp to WingCaster.',
    ar: 'اربط واتسابك بوينغكاستر.',
  },
  'whatsapp.sub': {
    en: 'Send the code below to our WhatsApp. Then send photos + a voice memo of the property.',
    ar: 'أرسل الرمز أدناه إلى واتسابنا. ثم أرسل صورًا ومذكرة صوتية للعقار.',
  },
  'whatsapp.sub.bound': {
    en: 'Now send photos + a voice memo of the property.',
    ar: 'الآن أرسل صورًا ومذكرة صوتية للعقار.',
  },
  'whatsapp.cta.open': {
    en: 'Open WhatsApp with the code',
    ar: 'افتح واتساب مع الرمز',
  },
  'whatsapp.escape': {
    en: 'Prefer to type it yourself? Add manually →',
    ar: 'تفضل الكتابة بنفسك؟ أضف يدويًا ←',
  },
  'whatsapp.poll.listening': {
    en: 'Listening for your message…',
    ar: 'نستمع لرسالتك…',
  },
  'whatsapp.poll.waiting': {
    en: 'Waiting for your first listing message…',
    ar: 'بانتظار رسالة إعلانك الأولى…',
  },
  'whatsapp.poll.drafting': {
    en: "We're drafting your listing… almost there.",
    ar: 'نصيغ إعلانك… اقتربنا.',
  },
  'whatsapp.nudge': {
    en: 'Still no message? Make sure you saved the number correctly, and send a photo to start.',
    ar: 'ما زالت لا رسالة؟ تأكد أنك حفظت الرقم بشكل صحيح، وأرسل صورة للبدء.',
  },
  'whatsapp.error.code': {
    en: "We couldn't generate a code. Try again?",
    ar: 'تعذّر إنشاء رمز. أعد المحاولة؟',
  },
  'whatsapp.error.poll': {
    en: "We're having trouble checking status. Refreshing in {n}s…",
    ar: 'نواجه صعوبة في التحقق من الحالة. التحديث خلال {n} ث…',
  },
  'whatsapp.retry': {
    en: 'Retry now',
    ar: 'أعد المحاولة الآن',
  },
  'whatsapp.tryAgain': {
    en: 'Try again',
    ar: 'أعد المحاولة',
  },
  'whatsapp.offline': {
    en: "You're offline. We can't check for new messages until you reconnect.",
    ar: 'أنت غير متصل. لا يمكننا التحقق من الرسائل حتى تعيد الاتصال.',
  },
  'whatsapp.step.getCode': {
    en: 'Get code',
    ar: 'احصل على الرمز',
  },
  'whatsapp.step.sendCode': {
    en: 'Send code to WingCaster',
    ar: 'أرسل الرمز إلى وينغكاستر',
  },
  'whatsapp.step.sendPhotos': {
    en: 'Send photos + voice memo',
    ar: 'أرسل صورًا ومذكرة صوتية',
  },
  'whatsapp.step.draft': {
    en: 'We draft your listing',
    ar: 'نصيغ إعلانك',
  },

  // —— First listing review (AGT-ONB-003) ——
  'review.progress': {
    en: 'Step 3 of 4 · Review your listing',
    ar: 'الخطوة 3 من 4 · راجع إعلانك',
  },
  'review.h1': {
    en: 'We drafted your first listing from your voice memo.',
    ar: 'صغنا إعلانك الأول من مذكرتك الصوتية.',
  },
  'review.sub': {
    en: "Look it over. Change anything. Then publish when you're ready.",
    ar: 'راجعه. غيّر ما تشاء. ثم انشر عندما تكون جاهزًا.',
  },
  'review.photoNudge': {
    en: 'Send more photos on WhatsApp →',
    ar: 'أرسل المزيد من الصور على واتساب ←',
  },
  'review.chip.area': {
    en: 'Add area',
    ar: 'أضف المنطقة',
  },
  'review.chip.building': {
    en: 'Add building name',
    ar: 'أضف اسم المبنى',
  },
  'review.chip.floor': {
    en: 'Add floor',
    ar: 'أضف الطابق',
  },
  'review.aiAttribution': {
    en: 'Drafted by WingCaster AI from your voice memo · you can edit anything before publishing.',
    ar: 'صيغ بواسطة ذكاء وينغكاستر من مذكرتك الصوتية · يمكنك تعديل أي شيء قبل النشر.',
  },
  'review.publishWhat': {
    en: 'What happens when you publish',
    ar: 'ماذا يحدث عند النشر',
  },
  'review.publish.1': {
    en: 'Your listing goes live on your WingCaster public page.',
    ar: 'يظهر إعلانك على صفحتك العامة في وينغكاستر.',
  },
  'review.publish.2': {
    en: "We'll suggest which social channels to post to next.",
    ar: 'نقترح عليك قنوات التواصل للنشر التالي.',
  },
  'review.publish.3': {
    en: 'You keep control — edit or unpublish anytime.',
    ar: 'تبقى السيطرة بيدك — عدّل أو ألغِ النشر في أي وقت.',
  },
  'review.cta.publish': {
    en: 'Publish my first listing',
    ar: 'انشر إعلاني الأول',
  },
  'review.cta.editor': {
    en: 'Open full editor',
    ar: 'افتح المحرر الكامل',
  },
  'review.cta.discard': {
    en: 'Discard and start over',
    ar: 'تجاهل وابدأ من جديد',
  },
  'review.discard.title': {
    en: 'Discard this draft?',
    ar: 'هل تتجاهل هذه المسودة؟',
  },
  'review.discard.body': {
    en: 'Your photos and voice memo will be removed. You can start a new listing from WhatsApp anytime.',
    ar: 'ستُحذف صورك ومذكرتك الصوتية. يمكنك بدء إعلان جديد من واتساب في أي وقت.',
  },
  'review.discard.confirm': {
    en: 'Yes, discard',
    ar: 'نعم، تجاهل',
  },
  'review.discard.cancel': {
    en: 'Keep the draft',
    ar: 'أبقِ المسودة',
  },
  'review.publishing': {
    en: 'Publishing to WingCaster… syndicating to your channels…',
    ar: 'جارٍ النشر على وينغكاستر… والتوزيع على قنواتك…',
  },
  'review.error.publish': {
    en: "Publishing didn't go through. Try again?",
    ar: 'لم يكتمل النشر. أعد المحاولة؟',
  },
  'review.error.load': {
    en: "We couldn't load your draft. Refresh?",
    ar: 'تعذّر تحميل مسودتك. حدّث؟',
  },
  'review.error.discard': {
    en: "We couldn't discard that draft. Try again?",
    ar: 'تعذّر تجاهل تلك المسودة. أعد المحاولة؟',
  },
  'review.error.patch': {
    en: "We couldn't save that edit. Try again?",
    ar: 'تعذّر حفظ ذلك التعديل. أعد المحاولة؟',
  },
  'review.refresh': {
    en: 'Refresh',
    ar: 'تحديث',
  },
  'review.offline': {
    en: "You're offline. Editing is paused until you reconnect.",
    ar: 'أنت غير متصل. التحرير متوقف حتى تعيد الاتصال.',
  },
  'review.toast.discard': {
    en: "Draft discarded. Send us new photos + a voice memo on WhatsApp whenever you're ready.",
    ar: 'تم تجاهل المسودة. أرسل لنا صورًا جديدة ومذكرة صوتية على واتساب متى شئت.',
  },
  'review.edit.photos': {
    en: 'Edit photos',
    ar: 'تعديل الصور',
  },
  'review.edit.price': {
    en: 'Edit price',
    ar: 'تعديل السعر',
  },
  'review.edit.address': {
    en: 'Edit address',
    ar: 'تعديل العنوان',
  },
  'review.edit.description': {
    en: 'Edit description',
    ar: 'تعديل الوصف',
  },
  'review.edit.save': {
    en: 'Save',
    ar: 'حفظ',
  },
  'review.edit.cancel': {
    en: 'Cancel',
    ar: 'إلغاء',
  },
  'review.price.currency': {
    en: 'Currency',
    ar: 'العملة',
  },
  'review.price.amount': {
    en: 'Amount',
    ar: 'المبلغ',
  },
  'review.address.area': {
    en: 'Area',
    ar: 'المنطقة',
  },
  'review.address.building': {
    en: 'Building name',
    ar: 'اسم المبنى',
  },
  'review.address.floor': {
    en: 'Floor',
    ar: 'الطابق',
  },
  'review.address.full': {
    en: 'Full address',
    ar: 'العنوان الكامل',
  },
  'review.description.label': {
    en: 'Description',
    ar: 'الوصف',
  },
  'review.photos.add': {
    en: 'Add photos',
    ar: 'أضف صورًا',
  },
  'review.photos.remove': {
    en: 'Remove photo',
    ar: 'إزالة الصورة',
  },

  // —— Celebration (AGT-ONB-004) ——
  'celebration.progress': {
    en: "Step 4 of 4 · You're set ✓",
    ar: 'الخطوة 4 من 4 · أنت جاهز ✓',
  },
  'celebration.h1': {
    en: 'Your first listing is live!',
    ar: 'إعلانك الأول أصبح مباشرًا!',
  },
  'celebration.sub.named.elapsed': {
    en: '{firstName} — you turned a voice memo into a live listing in {elapsed} minutes.',
    ar: '{firstName} — حوّلت مذكرة صوتية إلى إعلان مباشر في {elapsed} دقائق.',
  },
  'celebration.sub.named': {
    en: '{firstName} — you just turned a voice memo into a live listing.',
    ar: '{firstName} — حوّلت للتو مذكرة صوتية إلى إعلان مباشر.',
  },
  'celebration.sub.elapsed': {
    en: 'You turned a voice memo into a live listing in {elapsed} minutes.',
    ar: 'حوّلت مذكرة صوتية إلى إعلان مباشر في {elapsed} دقائق.',
  },
  'celebration.sub': {
    en: 'You just turned a voice memo into a live listing.',
    ar: 'حوّلت للتو مذكرة صوتية إلى إعلان مباشر.',
  },
  'celebration.next': {
    en: "What's next",
    ar: 'ما التالي',
  },
  'celebration.later': {
    en: 'Skip for now — take me to the dashboard',
    ar: 'تخطَّ الآن — خذني إلى لوحة التحكم',
  },
  'celebration.error.finalize': {
    en: "Nice work — but we couldn't save your progress. Your listing is still live.",
    ar: 'عمل رائع — لكن تعذّر حفظ تقدّمك. إعلانك ما زال مباشرًا.',
  },
  'celebration.offline': {
    en: "You're offline. Your listing is live; next actions will work once you reconnect.",
    ar: 'أنت غير متصل. إعلانك مباشر؛ الإجراءات التالية تعمل بعد إعادة الاتصال.',
  },

  // —— Checklist widget (AGT-ONB-005) ——
  'checklist.title': {
    en: 'Finish setting up',
    ar: 'أكمل الإعداد',
  },
  'checklist.sub.partial': {
    en: "You're {pct}% there — {remaining} steps left.",
    ar: 'أنت عند {pct}% — متبقّي {remaining} خطوات.',
  },
  'checklist.sub.done': {
    en: "You're all set. Nice work.",
    ar: 'أنت جاهز تمامًا. عمل رائع.',
  },
  'checklist.step.publish': {
    en: 'Publish your first listing',
    ar: 'انشر إعلانك الأول',
  },
  'checklist.step.publish.sub': {
    en: 'Make it live on your public page',
    ar: 'اجعله مباشرًا على صفحتك العامة',
  },
  'checklist.step.markets': {
    en: 'Set the market(s) you’re based in',
    ar: 'حدّد الأسواق التي تتمركز بها',
  },
  'checklist.step.markets.sub': {
    en: 'Where you’re licensed — unlocks portals & licence details',
    ar: 'حيث أنت مُرخّص — يفتح البوابات وتفاصيل الترخيص',
  },
  'checklist.step.channels': {
    en: 'Connect a social media channel',
    ar: 'اربط قناة تواصل اجتماعي',
  },
  'checklist.step.channels.sub': {
    en: 'Instagram, Facebook, LinkedIn — cast your listings',
    ar: 'إنستغرام، فيسبوك، لينكدإن — وزّع إعلاناتك',
  },
  'checklist.step.comms': {
    en: 'Connect your comms channels',
    ar: 'اربط قنوات المراسلة',
  },
  'checklist.step.comms.sub': {
    en: 'WhatsApp, Telegram, email — reply where clients already are',
    ar: 'واتساب، تيليجرام، البريد — تواصل حيث يوجد عملاؤك',
  },
  'checklist.step.listing': {
    en: 'List your property',
    ar: 'أضف عقارك',
  },
  'checklist.step.listing.sub': {
    en: 'Enter manually, bulk upload, or integrate your CRM',
    ar: 'أدخِل يدويًا، أو رفع جماعي، أو ربط نظام إدارة العملاء',
  },
  'checklist.step.designpost': {
    en: 'Design your first post',
    ar: 'صمّم منشورك الأول',
  },
  'checklist.step.designpost.sub': {
    en: 'Turn a listing into a shareable social post',
    ar: 'حوّل إعلانًا إلى منشور اجتماعي قابل للمشاركة',
  },
  'checklist.listing.chooser.title': {
    en: 'How would you like to add your property?',
    ar: 'كيف تريد إضافة عقارك؟',
  },
  'checklist.listing.chooser.sub': {
    en: 'Pick the way that fits your inventory.',
    ar: 'اختر الطريقة التي تناسب مخزونك.',
  },
  'checklist.listing.manual': {
    en: 'Enter manually',
    ar: 'إدخال يدوي',
  },
  'checklist.listing.manual.desc': {
    en: 'Add one property with the step-by-step composer.',
    ar: 'أضف عقارًا واحدًا عبر المُنشئ خطوة بخطوة.',
  },
  'checklist.listing.bulk': {
    en: 'Bulk upload',
    ar: 'رفع جماعي',
  },
  'checklist.listing.bulk.desc': {
    en: 'Import many properties from a CSV or Excel file.',
    ar: 'استورد عدة عقارات من ملف CSV أو Excel.',
  },
  'checklist.listing.integrate': {
    en: 'Integrate',
    ar: 'ربط',
  },
  'checklist.listing.integrate.desc': {
    en: 'Sync from your own CRM, website, or system.',
    ar: 'زامن من نظام إدارة العملاء أو موقعك أو نظامك.',
  },
  'checklist.step.notifications': {
    en: 'Turn on notifications',
    ar: 'فعّل الإشعارات',
  },
  'checklist.step.notifications.sub': {
    en: 'Never miss a new lead',
    ar: 'لا تفوّت أي عميل محتمل',
  },
  'checklist.step.profile': {
    en: 'Complete your public profile',
    ar: 'أكمل ملفك العام',
  },
  'checklist.step.profile.sub': {
    en: 'Photo, bio, contact — for your Bazaar profile',
    ar: 'صورة، نبذة، تواصل — لملف البازار',
  },
  'checklist.step.upgrade': {
    en: 'Upgrade to paid',
    ar: 'الترقية إلى مدفوع',
  },
  'checklist.step.upgrade.sub': {
    en: 'Unlock unlimited listings and portal integrations',
    ar: 'افتح إعلانات غير محدودة وتكاملات البوابات',
  },
  'checklist.dismiss': {
    en: 'Dismiss this checklist',
    ar: 'إخفاء قائمة التحقق',
  },
  'checklist.dismiss.title': {
    en: 'Dismiss this checklist?',
    ar: 'هل تخفي قائمة التحقق؟',
  },
  'checklist.dismiss.body': {
    en: 'You can bring it back from Settings → Onboarding progress.',
    ar: 'يمكنك إعادتها من الإعدادات ← تقدّم الإعداد.',
  },
  'checklist.dismiss.confirm': {
    en: 'Yes, dismiss',
    ar: 'نعم، أخفِ',
  },
  'checklist.dismiss.cancel': {
    en: 'Keep it',
    ar: 'أبقِها',
  },
  'checklist.dismiss.toast': {
    en: 'Checklist dismissed. Bring it back from Settings → Onboarding progress.',
    ar: 'تم إخفاء القائمة. أعدها من الإعدادات ← تقدّم الإعداد.',
  },
  'checklist.error.patch': {
    en: "We couldn't save that. Try again?",
    ar: 'تعذّر حفظ ذلك. أعد المحاولة؟',
  },
  'checklist.pill.aria': {
    en: 'Onboarding progress: {completed} of {total} steps complete. Open checklist.',
    ar: 'تقدّم الإعداد: {completed} من {total} خطوات مكتملة. افتح القائمة.',
  },
  'checklist.region': {
    en: 'Onboarding progress',
    ar: 'تقدّم الإعداد',
  },
} as const

export type OnboardingCopyKey = keyof typeof ONBOARDING_COPY

export function t(
  key: OnboardingCopyKey,
  locale: OnboardingLocale,
  vars?: Record<string, string | number>,
): string {
  let value: string = ONBOARDING_COPY[key][locale]
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      value = value.replace(`{${k}}`, String(v))
    }
  }
  return value
}
