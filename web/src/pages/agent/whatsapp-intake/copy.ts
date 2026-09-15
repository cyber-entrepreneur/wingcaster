/**
 * AGT-WLB WhatsApp intake tour copy — EN + AR (LOGIN_COPY shape).
 * MENA business Arabic matching loginCopy.ts tone. No placeholders.
 */

export type WaLocale = 'en' | 'ar'

export const WA_INTAKE_COPY = {
  // —— Shell / strip ——
  'shell.offline.connect': {
    en: "You're offline — connect to set up WhatsApp.",
    ar: 'أنت غير متصل — اتصل بالإنترنت لإعداد واتساب.',
  },
  'shell.offline.code': {
    en: "You're offline — connect to keep watching for WhatsApp.",
    ar: 'أنت غير متصل — اتصل بالإنترنت لمتابعة مراقبة واتساب.',
  },
  'shell.offline.waiting': {
    en: "You're offline — we'll keep listening when you're back.",
    ar: 'أنت غير متصل — سنواصل الاستماع عند عودتك.',
  },
  'shell.offline.drafting': {
    en: "You're offline — drafting continues on our side.",
    ar: 'أنت غير متصل — يستمر إعداد المسودة من جانبنا.',
  },

  // —— Connect (AGT-WLB-001) ——
  'connect.title': {
    en: 'Set up WhatsApp intake',
    ar: 'إعداد استقبال واتساب',
  },
  'connect.title.resume': {
    en: 'Resume WhatsApp setup',
    ar: 'استئناف إعداد واتساب',
  },
  'connect.hero.title': {
    en: 'Draft listings by chatting to WingCaster on WhatsApp',
    ar: 'أنشئ مسودات العقارات بالمراسلة مع وينغكاستر على واتساب',
  },
  'connect.hero.body': {
    en: "Send photos, a voice note, and a location pin. We'll turn them into a listing you can review and publish.",
    ar: 'أرسل صورًا ومذكرة صوتية وموقعًا. نحوّلها إلى إعلان يمكنك مراجعته ونشره.',
  },
  'connect.benefit.speed.label': {
    en: 'Drafts in under 60 seconds',
    ar: 'مسودات في أقل من ٦٠ ثانية',
  },
  'connect.benefit.speed.sub': {
    en: 'From voice note to filled fields — no forms while you work.',
    ar: 'من المذكرة الصوتية إلى الحقول المعبأة — بلا نماذج أثناء عملك.',
  },
  'connect.benefit.media.label': {
    en: 'Voice, photos, and pin work together',
    ar: 'الصوت والصور والموقع يعملان معًا',
  },
  'connect.benefit.media.sub': {
    en: 'Send everything as you normally would on WhatsApp.',
    ar: 'أرسل كل شيء كما تفعل عادة على واتساب.',
  },
  'connect.benefit.road.label': {
    en: 'Built for the road',
    ar: 'مصمّم للعمل من الطريق',
  },
  'connect.benefit.road.sub': {
    en: 'Reply on WhatsApp the same way you already do — WingCaster reads it.',
    ar: 'أرد على واتساب كما تفعل دائمًا — وينغكاستر يقرأ الرسالة.',
  },
  'connect.trust': {
    en: "You'll share the same WingCaster number as other agents. Your listings stay yours.",
    ar: 'ستشارك رقم وينغكاستر نفسه مع وكلاء آخرين. إعلاناتك تبقى خاصة بك.',
  },
  'connect.cta.primary': {
    en: 'Set up WhatsApp intake',
    ar: 'إعداد استقبال واتساب',
  },
  'connect.cta.busy': {
    en: 'Setting up…',
    ar: 'جارٍ الإعداد…',
  },
  'connect.cta.defer': {
    en: 'Not now, remind me later',
    ar: 'ليس الآن، ذكّرني لاحقًا',
  },
  'connect.toast.rateLimited': {
    en: "You just requested a code — check WhatsApp or tap 'I didn't get it' on the next screen.",
    ar: 'طلبت رمزًا للتو — تحقق من واتساب أو اضغط «لم يصلني» في الشاشة التالية.',
  },
  'connect.toast.rateLimited.empty': {
    en: "You're requesting codes too quickly. Wait a moment, then try again.",
    ar: 'تطلب الرموز بسرعة كبيرة. انتظر لحظة ثم حاول مجددًا.',
  },
  'connect.toast.error': {
    en: "Couldn't reach WingCaster. Try again in a moment.",
    ar: 'تعذّر الوصول إلى وينغكاستر. حاول مجددًا بعد لحظة.',
  },
  'connect.illus.send': {
    en: 'You send',
    ar: 'أنت ترسل',
  },
  'connect.illus.sendDetail': {
    en: 'Voice + photos + pin',
    ar: 'صوت + صور + موقع',
  },
  'connect.illus.drafting': {
    en: 'WingCaster is drafting…',
    ar: 'وينغكاستر يعدّ المسودة…',
  },
  'connect.illus.ready': {
    en: 'Ready to publish',
    ar: 'جاهز للنشر',
  },

  // —— Activation code (AGT-WLB-002) ——
  'code.title': {
    en: 'Activation code',
    ar: 'رمز التفعيل',
  },
  'code.hero.title': {
    en: 'Send this code to activate',
    ar: 'أرسل هذا الرمز للتفعيل',
  },
  'code.hero.body': {
    en: "Copy the code below, open WhatsApp, and send it to the WingCaster number. We'll take it from there.",
    ar: 'انسخ الرمز أدناه، افتح واتساب، وأرسله إلى رقم وينغكاستر. نتولى الباقي.',
  },
  'code.cap.title': {
    en: "It's been 24 hours",
    ar: 'مرّت ٢٤ ساعة',
  },
  'code.cap.body': {
    en: 'Your previous code is no longer valid. Get a fresh one to keep going.',
    ar: 'رمزك السابق لم يعد صالحًا. احصل على رمز جديد للمتابعة.',
  },
  'code.cap.cta': {
    en: 'Get a new code',
    ar: 'الحصول على رمز جديد',
  },
  'code.pollError': {
    en: 'Checking your WhatsApp… reconnect to keep watching.',
    ar: 'جارٍ التحقق من واتساب… أعد الاتصال لمتابعة المراقبة.',
  },
  'code.cta.open': {
    en: 'Open WhatsApp with code pre-filled',
    ar: 'افتح واتساب بالرمز مسبق التعبئة',
  },
  'code.cta.manual': {
    en: "I'll send it manually",
    ar: 'سأرسله يدويًا',
  },
  'code.waiting': {
    en: 'Waiting for your message on WhatsApp…',
    ar: 'بانتظار رسالتك على واتساب…',
  },
  'code.dialog.title': {
    en: 'Open WhatsApp on your phone',
    ar: 'افتح واتساب على هاتفك',
  },
  'code.dialog.body': {
    en: 'The code is copied. Or scan the QR.',
    ar: 'تم نسخ الرمز. أو امسح رمز QR.',
  },
  'code.dialog.send': {
    en: 'Send {code} from your phone.',
    ar: 'أرسل {code} من هاتفك.',
  },
  'code.how.title': {
    en: 'How this works',
    ar: 'كيف يعمل هذا',
  },
  'code.how.1': {
    en: 'WingCaster uses one shared WhatsApp number to keep intake fast and free.',
    ar: 'يستخدم وينغكاستر رقم واتساب مشتركًا واحدًا ليبقى الاستقبال سريعًا ومجانيًا.',
  },
  'code.how.2': {
    en: 'Your listings, leads, and conversations stay tied to your account.',
    ar: 'تبقى إعلاناتك والعملاء والمحادثات مرتبطة بحسابك.',
  },
  'code.how.3': {
    en: 'You can disconnect anytime from Settings → Channels.',
    ar: 'يمكنك قطع الربط في أي وقت من الإعدادات ← القنوات.',
  },
  'code.toast.loadError': {
    en: "Couldn't load an activation code. Try again.",
    ar: 'تعذّر تحميل رمز التفعيل. حاول مجددًا.',
  },
  'code.toast.expired': {
    en: "Your code expired. Tap 'I didn't get it' to get a fresh one.",
    ar: 'انتهت صلاحية رمزك. اضغط «لم يصلني» للحصول على رمز جديد.',
  },

  // —— Waiting (AGT-WLB-003) ——
  'waiting.title': {
    en: 'Listening on WhatsApp',
    ar: 'نستمع على واتساب',
  },
  'waiting.hero.title': {
    en: 'Listening on WhatsApp',
    ar: 'نستمع على واتساب',
  },
  'waiting.hero.body': {
    en: "Send photos, a voice note, and a pin to any listing you want to draft first. I'll turn them into a draft you can review.",
    ar: 'أرسل صورًا ومذكرة صوتية وموقعًا لأي إعلان تريد مسودته أولًا. نحوّلها إلى مسودة يمكنك مراجعتها.',
  },
  'waiting.lamp.live': {
    en: 'Live — connected to',
    ar: 'مباشر — متصل بـ',
  },
  'waiting.lamp.offline': {
    en: 'Offline',
    ar: 'غير متصل',
  },
  'waiting.lamp.reconnecting': {
    en: 'Reconnecting…',
    ar: 'جارٍ إعادة الاتصال…',
  },
  'waiting.bound': {
    en: 'Bound to',
    ar: 'مرتبط بـ',
  },
  'waiting.send.title': {
    en: 'What to send',
    ar: 'ماذا ترسل',
  },
  'waiting.tip.photos': {
    en: '3-8 photos of the unit — wide shots, kitchen, bathroom, view.',
    ar: '٣–٨ صور للوحدة — لقطات واسعة، مطبخ، حمّام، إطلالة.',
  },
  'waiting.tip.voice': {
    en: 'A voice note with the address, beds, baths, and price.',
    ar: 'مذكرة صوتية بالعنوان وغرف النوم والحمّامات والسعر.',
  },
  'waiting.tip.pin': {
    en: 'A location pin so we can auto-fill the neighborhood.',
    ar: 'موقع جغرافي لتعبئة الحي تلقائيًا.',
  },
  'waiting.hint': {
    en: 'Not seeing a reply?',
    ar: 'لا ترى ردًا؟',
  },
  'waiting.hint.action': {
    en: 'Send WC-LIST to check your bindings',
    ar: 'أرسل WC-LIST للتحقق من الربط',
  },
  'waiting.cta.change': {
    en: 'Change WhatsApp number',
    ar: 'تغيير رقم واتساب',
  },
  'waiting.cta.later': {
    en: "I'll come back later",
    ar: 'سأعود لاحقًا',
  },
  'waiting.cap.title': {
    en: "It's been a while",
    ar: 'مرّ وقت طويل',
  },
  'waiting.cap.body': {
    en: "We haven't seen a message yet. Get a fresh code if you want to reconnect.",
    ar: 'لم نستلم رسالة بعد. احصل على رمز جديد إن أردت إعادة الربط.',
  },
  'waiting.cap.cta': {
    en: 'Get a fresh code',
    ar: 'الحصول على رمز جديد',
  },
  'waiting.toast.bindingLost': {
    en: 'Your phone was disconnected. Get a fresh code to reconnect.',
    ar: 'تم فصل هاتفك. احصل على رمز جديد لإعادة الربط.',
  },
  'waiting.list.title': {
    en: 'Check your WhatsApp bindings',
    ar: 'تحقق من ربط واتساب',
  },
  'waiting.list.body': {
    en: 'Send WC-LIST from your bound phone. WingCaster will reply with all the accounts currently linked to it.',
    ar: 'أرسل WC-LIST من هاتفك المرتبط. يرد وينغكاستر بجميع الحسابات المرتبطة به حاليًا.',
  },
  'waiting.list.gotIt': {
    en: 'Got it',
    ar: 'حسنًا',
  },
  'waiting.unbind.title': {
    en: 'Change your WhatsApp number',
    ar: 'تغيير رقم واتساب',
  },
  'waiting.unbind.body': {
    en: 'Send WC-UNBIND from your current phone. Then come back and restart WhatsApp setup from a new phone.',
    ar: 'أرسل WC-UNBIND من هاتفك الحالي. ثم عد وابدأ إعداد واتساب من هاتف جديد.',
  },
  'waiting.unbind.notYet': {
    en: 'Not yet',
    ar: 'ليس بعد',
  },
  'waiting.unbind.copy': {
    en: 'Copy WC-UNBIND to clipboard',
    ar: 'نسخ WC-UNBIND إلى الحافظة',
  },
  'waiting.unbind.copied': {
    en: 'Copied',
    ar: 'تم النسخ',
  },

  // —— Drafting / ready (AGT-WLB-004 / 005) ——
  'draft.title': {
    en: 'Drafting your listing',
    ar: 'جارٍ إعداد مسودة إعلانك',
  },
  'draft.ready.titleBar': {
    en: 'Your listing is ready',
    ar: 'إعلانك جاهز',
  },
  'draft.hero.title': {
    en: 'Turning your message into a listing',
    ar: 'نحوّل رسالتك إلى إعلان',
  },
  'draft.hero.body': {
    en: "You'll see each field fill in as I read your photos, voice, and pin. You can review and edit everything on the next screen.",
    ar: 'سترى كل حقل يُعبأ أثناء قراءة صورك وصوتك وموقعك. يمكنك مراجعة كل شيء وتعديله في الشاشة التالية.',
  },
  'draft.fallback': {
    en: 'Drafting your listing… this usually takes 15-30s.',
    ar: 'جارٍ إعداد مسودة إعلانك… يستغرق ذلك عادة ١٥–٣٠ ثانية.',
  },
  'draft.connecting': {
    en: 'Connecting…',
    ar: 'جارٍ الاتصال…',
  },
  'draft.serverSide': {
    en: 'Draft continues server-side.',
    ar: 'تستمر المسودة على الخادم.',
  },
  'draft.cta.cancel': {
    en: 'Cancel this draft',
    ar: 'إلغاء هذه المسودة',
  },
  'draft.cta.editLater': {
    en: 'Edit later',
    ar: 'تعديل لاحقًا',
  },
  'draft.cta.drafting': {
    en: 'Drafting…',
    ar: 'جارٍ الإعداد…',
  },
  'draft.cta.fields': {
    en: 'fields',
    ar: 'حقول',
  },
  'draft.cta.review': {
    en: 'Review & publish →',
    ar: 'مراجعة ونشر ←',
  },
  'draft.cta.saveLater': {
    en: "Save for later — I'll review in Drafts",
    ar: 'حفظ للاحقاً — سأراجع في المسودات',
  },
  'draft.cta.saving': {
    en: 'Saving to Drafts…',
    ar: 'جارٍ الحفظ في المسودات…',
  },
  'draft.cta.opening': {
    en: 'Opening review…',
    ar: 'جارٍ فتح المراجعة…',
  },
  'draft.cancel.title': {
    en: 'Cancel this draft?',
    ar: 'إلغاء هذه المسودة؟',
  },
  'draft.cancel.body': {
    en: "We'll delete what's been drafted so far. You can send a new WhatsApp message anytime to start over.",
    ar: 'سنحذف ما أُعد حتى الآن. يمكنك إرسال رسالة واتساب جديدة في أي وقت للبدء من جديد.',
  },
  'draft.cancel.keep': {
    en: 'Keep drafting',
    ar: 'متابعة الإعداد',
  },
  'draft.cancel.confirm': {
    en: 'Cancel draft',
    ar: 'إلغاء المسودة',
  },
  'draft.cancel.busy': {
    en: 'Cancelling…',
    ar: 'جارٍ الإلغاء…',
  },
  'draft.toast.cancelled': {
    en: 'Draft cancelled.',
    ar: 'تم إلغاء المسودة.',
  },
  'draft.toast.cancelError': {
    en: "Couldn't cancel the draft. Try again.",
    ar: 'تعذّر إلغاء المسودة. حاول مجددًا.',
  },
  'draft.toast.saved': {
    en: 'Your listing is saved as a draft. Publish anytime.',
    ar: 'حُفظ إعلانك كمسودة. انشره في أي وقت.',
  },
  'draft.toast.editLater': {
    en: "We'll keep drafting — find it in your Drafts tab.",
    ar: 'نواصل الإعداد — تجده في تبويب المسودات.',
  },
  'draft.error.title': {
    en: "We couldn't finish your draft",
    ar: 'تعذّر إكمال مسودتك',
  },
  'draft.error.body': {
    en: '{error}. Send another WhatsApp message to try again.',
    ar: '{error}. أرسل رسالة واتساب أخرى للمحاولة مجددًا.',
  },
  'draft.error.back': {
    en: 'Back to WhatsApp',
    ar: 'العودة إلى واتساب',
  },
  'draft.error.support': {
    en: 'Contact support',
    ar: 'التواصل مع الدعم',
  },
  'ready.hero.title': {
    en: 'Your listing is ready',
    ar: 'إعلانك جاهز',
  },
  'ready.hero.body': {
    en: 'Review the details, tweak anything you want, then publish to Bazaar and your connected portals.',
    ar: 'راجع التفاصيل وعدّل ما تشاء، ثم انشر على بازار والبوابات المتصلة.',
  },
  'ready.live': {
    en: 'Your listing is ready. Review and publish, or save for later.',
    ar: 'إعلانك جاهز. راجع وانشر، أو احفظ للاحقاً.',
  },
  'ready.caught.title': {
    en: 'What we caught',
    ar: 'ما التقطناه',
  },
  'ready.caught.address': {
    en: 'Address extracted from your voice note + location pin',
    ar: 'استُخرج العنوان من مذكرتك الصوتية والموقع',
  },
  'ready.caught.price': {
    en: 'Price extracted from your voice note',
    ar: 'استُخرج السعر من مذكرتك الصوتية',
  },
  'ready.caught.photos': {
    en: 'Photos organized by room type',
    ar: 'نُظّمت الصور حسب نوع الغرفة',
  },
  'ready.caught.beds': {
    en: 'Bedrooms + bathrooms extracted from your voice note',
    ar: 'استُخرجت غرف النوم والحمّامات من مذكرتك الصوتية',
  },
  'ready.relative.justNow': {
    en: 'just now',
    ar: 'الآن',
  },
  'ready.relative.min': {
    en: '1 min ago',
    ar: 'منذ دقيقة',
  },
  'ready.relative.mins': {
    en: '{n} min ago',
    ar: 'منذ {n} دقائق',
  },
  'ready.relative.hour': {
    en: '1 hour ago',
    ar: 'منذ ساعة',
  },
  'ready.relative.hours': {
    en: '{n} hours ago',
    ar: 'منذ {n} ساعات',
  },
} as const

export type WaIntakeCopyKey = keyof typeof WA_INTAKE_COPY

export function waT(
  key: WaIntakeCopyKey,
  locale: WaLocale,
  vars?: Record<string, string | number>,
): string {
  let value: string = WA_INTAKE_COPY[key][locale]
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      value = value.replace(`{${k}}`, String(v))
    }
  }
  return value
}

/** Resolve locale from useLocale().isArabic. */
export function waLocale(isArabic: boolean): WaLocale {
  return isArabic ? 'ar' : 'en'
}
