/**
 * WF-31 ownership-transfer copy (AGN-SET-005 initiator, AGN-SET-005b recipient,
 * AGT-REC-006 outcome).
 *
 * Shape `{ en, ar }` per key; locale resolved at read time via useLocale().
 * Real MENA business Arabic — no [TRANSLATION-PENDING], no English fallbacks.
 */

import { useCallback, useMemo } from 'react'
import { useLocale, type AppLocale } from '@/hooks/useLocale'

export type OwnershipTransferLocale = 'en' | 'ar'

export const OWNERSHIP_TRANSFER_COPY = {
  // ── Shell / shared ────────────────────────────────────────────────────
  'nav.title': { en: 'Ownership transfer', ar: 'نقل الملكية' },
  'nav.back': { en: 'Go back', ar: 'رجوع' },
  'loading.label': { en: 'Loading ownership transfer…', ar: 'جارٍ تحميل نقل الملكية…' },
  'error.title': { en: 'Check your connection.', ar: 'تحقّق من اتصالك.' },
  'error.retry': { en: 'Retry', ar: 'إعادة المحاولة' },
  'offline.banner': {
    en: "You're offline — submit is disabled.",
    ar: 'أنت غير متصل — تم تعطيل الإرسال.',
  },
  'support.link': {
    en: 'Something not right? Contact WingCaster support',
    ar: 'هل من خطأ ما؟ تواصل مع دعم وينغكاستر',
  },
  'advisory.mobile': {
    en: 'Ownership transfer is a governance action. Consider completing this from a desktop.',
    ar: 'نقل الملكية إجراء حوكمة. يُفضَّل إتمامه من جهاز مكتبي.',
  },

  // ── AGN-SET-005 initiator ─────────────────────────────────────────────
  'init.breadcrumb': { en: 'Agency settings › Ownership transfer', ar: 'إعدادات الوكالة › نقل الملكية' },
  'init.h1': { en: 'Transfer ownership of {agency}', ar: 'نقل ملكية {agency}' },
  'init.sub': {
    en: "Hand leadership of this agency to another admin. You'll stay as an Admin after they accept.",
    ar: 'سلِّم قيادة هذه الوكالة إلى مسؤول آخر. ستبقى مسؤولاً بعد قبوله.',
  },
  'init.notOwner.title': {
    en: 'Only the agency owner can transfer ownership.',
    ar: 'مالك الوكالة وحده يمكنه نقل الملكية.',
  },
  'init.notOwner.cta': { en: 'Return to agency settings', ar: 'العودة إلى إعدادات الوكالة' },

  'init.impact.heading': { en: 'When {target} accepts:', ar: 'عند قبول {target}:' },
  'init.impact.billing': {
    en: "**Billing address & payment method** move to {target}. Paddle records will re-attribute to {target}'s email for future invoices.",
    ar: '**عنوان الفوترة ووسيلة الدفع** ينتقلان إلى {target}. ستُعاد نسبة سجلّات الدفع إلى بريد {target} للفواتير المقبلة.',
  },
  'init.impact.contract': {
    en: '**Contract signer** on all agency vendor contracts transitions to {target}.',
    ar: '**موقِّع العقود** على جميع عقود موردي الوكالة ينتقل إلى {target}.',
  },
  'init.impact.escalation': {
    en: '**PA escalation privileges** move to {target}. Only the current owner can escalate to WingCaster support.',
    ar: '**صلاحيات التصعيد إلى المنصّة** تنتقل إلى {target}. المالك الحالي وحده يمكنه التصعيد إلى دعم وينغكاستر.',
  },
  'init.impact.legal': {
    en: '**Legal-representative designation** for compliance filings (GDPR, KSA PDPL, UAE DP Law) moves to {target}.',
    ar: '**صفة الممثّل القانوني** للإقرارات التنظيمية (GDPR، نظام حماية البيانات السعودي، قانون حماية البيانات الإماراتي) تنتقل إلى {target}.',
  },
  'init.impact.role': {
    en: '**Your role** flips from Owner to Admin. You keep every admin capability, but you cannot re-transfer ownership back without {target} initiating a new transfer.',
    ar: '**دورك** يتحوّل من مالك إلى مسؤول. تحتفظ بكل صلاحيات المسؤول، لكن لا يمكنك استعادة الملكية دون أن يبدأ {target} عملية نقل جديدة.',
  },
  'init.unchanged.heading': { en: "What doesn't change:", ar: 'ما الذي لا يتغيّر:' },
  'init.unchanged.listings': {
    en: 'Your listings and contacts remain owned by you within the agency.',
    ar: 'تبقى قوائمك وجهات اتصالك مملوكة لك داخل الوكالة.',
  },
  'init.unchanged.capabilities': {
    en: 'Your capability pack and permissions remain the same as any Admin.',
    ar: 'تبقى حزمة صلاحياتك وأذوناتك كما هي لأي مسؤول.',
  },
  'init.unchanged.brand': {
    en: 'The agency name, branding, and public profile are unchanged.',
    ar: 'اسم الوكالة وهويتها البصرية وملفها العام دون تغيير.',
  },

  'init.reversal.notice': {
    en: 'You have **30 days** after the transfer completes to reverse it. After 30 days, this cannot be undone from within the app — you would need WingCaster support to intervene.',
    ar: 'لديك **30 يوماً** بعد اكتمال النقل لعكسه. بعد 30 يوماً لا يمكن التراجع من داخل التطبيق — ستحتاج إلى تدخّل دعم وينغكاستر.',
  },

  'init.section.target': { en: 'Choose the new owner', ar: 'اختر المالك الجديد' },
  'init.target.placeholder': { en: 'Select an admin from your agency', ar: 'اختر مسؤولاً من وكالتك' },
  'init.target.helper': {
    en: 'Only current agency admins can receive ownership. To transfer to someone outside your admins, promote them first (Members → Change role).',
    ar: 'يمكن للمسؤولين الحاليين فقط تلقّي الملكية. لنقلها إلى شخص خارج المسؤولين، رقِّه أولاً (الأعضاء ← تغيير الدور).',
  },
  'init.target.empty': {
    en: 'No eligible admins. Promote a member to Admin first, then return here.',
    ar: 'لا يوجد مسؤولون مؤهَّلون. رقِّ عضواً إلى مسؤول أولاً ثم عُد إلى هنا.',
  },
  'init.target.tenure': { en: '{role} · {tenure}', ar: '{role} · {tenure}' },
  'init.role.admin': { en: 'Admin', ar: 'مسؤول' },
  'init.role.senior_admin': { en: 'Senior admin', ar: 'مسؤول أول' },

  'init.section.rationale': { en: 'Rationale (audit-recorded)', ar: 'المبرِّر (مُسجَّل للتدقيق)' },
  'init.rationale.placeholder': {
    en: "e.g. I'm stepping back from operations. Ahmad has been leading the team for the past year and is ready to sign contracts on the agency's behalf.",
    ar: 'مثال: أتراجع عن العمليات اليومية. يقود أحمد الفريق منذ عام وهو جاهز لتوقيع العقود نيابةً عن الوكالة.',
  },
  'init.rationale.helper': {
    en: 'This message is shown to {target} when they review the transfer, and stays in the agency audit log. Minimum 20 characters.',
    ar: 'تظهر هذه الرسالة لـ {target} عند مراجعة النقل، وتبقى في سجل تدقيق الوكالة. الحد الأدنى 20 حرفاً.',
  },
  'init.rationale.counter': { en: '{n} / 500', ar: '{n} / 500' },

  'init.section.identity': { en: 'Confirm identity (3 factors)', ar: 'تأكيد الهوية (٣ عوامل)' },
  'init.identity.sub': {
    en: 'For safety, we ask for three separate confirmations before starting the transfer.',
    ar: 'من أجل الأمان، نطلب ثلاثة تأكيدات منفصلة قبل بدء النقل.',
  },

  'init.consent': {
    en: 'I understand ownership will transfer to {target} once they accept my request, and I will become an Admin of {agency}.',
    ar: 'أفهم أن الملكية ستنتقل إلى {target} بمجرّد قبوله طلبي، وأنني سأصبح مسؤولاً في {agency}.',
  },
  'init.submit': { en: 'Transfer ownership', ar: 'نقل الملكية' },
  'init.submit.busy': { en: 'Sending request…', ar: 'جارٍ إرسال الطلب…' },
  'init.cancel': { en: 'Cancel and stay owner', ar: 'إلغاء والبقاء مالكاً' },
  'init.submit.missing': {
    en: "Complete these first: target admin, rationale (20+ characters), the 3 identity factors, and consent.",
    ar: 'أكمل هذه أولاً: المسؤول المستهدف، والمبرِّر (20 حرفاً فأكثر)، وعوامل الهوية الثلاثة، والموافقة.',
  },

  'init.confirm.title': { en: 'Send transfer request to {target}?', ar: 'إرسال طلب النقل إلى {target}؟' },
  'init.confirm.body': {
    en: "{target} will get an email and a notification. Ownership doesn't change until they accept. You have 30 days to reverse the transfer after acceptance.",
    ar: 'سيتلقّى {target} بريداً وإشعاراً. لا تتغيّر الملكية حتى يقبل. لديك 30 يوماً لعكس النقل بعد القبول.',
  },
  'init.confirm.confirm': { en: 'Send request', ar: 'إرسال الطلب' },
  'init.confirm.cancel': { en: 'Keep reviewing', ar: 'متابعة المراجعة' },

  'init.cancelDialog.title': { en: 'Cancel ownership transfer?', ar: 'إلغاء نقل الملكية؟' },
  'init.cancelDialog.body': {
    en: 'You will stay as owner. You can start a new transfer any time.',
    ar: 'ستبقى مالكاً. يمكنك بدء عملية نقل جديدة في أي وقت.',
  },
  'init.cancelDialog.confirm': { en: 'Yes, cancel', ar: 'نعم، إلغاء' },
  'init.cancelDialog.reject': { en: 'Keep going', ar: 'المتابعة' },

  'init.toast.sent': {
    en: "Request sent to {target}. You'll be notified when they respond.",
    ar: 'أُرسل الطلب إلى {target}. سنُشعرك عند ردّه.',
  },
  'init.toast.failed': { en: 'Could not send the request. Try again.', ar: 'تعذّر إرسال الطلب. أعد المحاولة.' },

  'init.block.pending': {
    en: 'You already have a pending transfer to {target}, sent {rel}. Cancel it before starting a new one.',
    ar: 'لديك طلب نقل معلّق إلى {target}، أُرسل {rel}. ألغِه قبل بدء طلب جديد.',
  },
  'init.block.suspended': {
    en: "This agency can't be transferred right now because it is suspended. Contact WingCaster support.",
    ar: 'لا يمكن نقل هذه الوكالة الآن لأنها موقوفة. تواصل مع دعم وينغكاستر.',
  },

  // Pending status view
  'pending.heading': { en: 'Waiting on {target} to accept', ar: 'بانتظار قبول {target}' },
  'pending.sub': { en: 'Sent {rel} · Expires {expiry}', ar: 'أُرسل {rel} · ينتهي {expiry}' },
  'pending.timeline.initiated': { en: 'Initiated', ar: 'بُدئ' },
  'pending.timeline.sent': { en: 'Sent to {target}', ar: 'أُرسل إلى {target}' },
  'pending.timeline.awaiting': { en: 'Awaiting acceptance', ar: 'بانتظار القبول' },
  'pending.cancelRequest': { en: 'Cancel request', ar: 'إلغاء الطلب' },
  'pending.toast.cancelled': { en: 'Transfer request cancelled.', ar: 'أُلغي طلب النقل.' },

  // Target-refused / expired view (initiator returns)
  'refused.declined.title': { en: '{target} declined the transfer', ar: 'رفض {target} النقل' },
  'refused.declined.body': {
    en: '{target} declined on {date}. Reason: “{reason}”. You can start a new transfer to a different admin.',
    ar: 'رفض {target} في {date}. السبب: «{reason}». يمكنك بدء نقل جديد إلى مسؤول آخر.',
  },
  'refused.expired.title': {
    en: 'The transfer request expired',
    ar: 'انتهت صلاحية طلب النقل',
  },
  'refused.expired.body': {
    en: 'The request to {target} expired on {date} without a response. You can start a new transfer.',
    ar: 'انتهت صلاحية الطلب المُرسل إلى {target} في {date} دون ردّ. يمكنك بدء نقل جديد.',
  },
  'refused.startNew': { en: 'Start a new transfer', ar: 'بدء نقل جديد' },

  // ── AGN-SET-005b recipient ────────────────────────────────────────────
  'recv.breadcrumb': { en: 'Inbox › Ownership transfer', ar: 'الوارد › نقل الملكية' },
  'recv.h1': {
    en: '{initiator} wants to transfer ownership of {agency} to you',
    ar: 'يريد {initiator} نقل ملكية {agency} إليك',
  },
  'recv.sub': {
    en: "Review the details below. If you accept, you'll become the owner as soon as your identity is verified.",
    ar: 'راجِع التفاصيل أدناه. إذا قبلت، ستصبح المالك بمجرّد التحقّق من هويتك.',
  },
  'recv.identity.subheader': { en: 'Owner of {agency} · Sent {rel}', ar: 'مالك {agency} · أُرسل {rel}' },
  'recv.rationale.header': { en: 'Why {initiator} wants to transfer:', ar: 'لماذا يريد {initiator} النقل:' },

  'recv.impl.heading': { en: 'When you accept:', ar: 'عند قبولك:' },
  'recv.impl.billing': {
    en: '**You** take on billing address & payment method attribution. All future invoices route to your email and payment record.',
    ar: '**أنت** تتحمّل عنوان الفوترة ونسبة وسيلة الدفع. تُوجَّه كل الفواتير المقبلة إلى بريدك وسجلّ الدفع الخاص بك.',
  },
  'recv.impl.contract': {
    en: '**You** become the signer on all agency vendor contracts.',
    ar: '**أنت** تصبح الموقِّع على جميع عقود موردي الوكالة.',
  },
  'recv.impl.escalation': {
    en: '**You** hold PA escalation privileges — only you can escalate to WingCaster support.',
    ar: '**أنت** تملك صلاحيات التصعيد — أنت وحدك من يمكنه التصعيد إلى دعم وينغكاستر.',
  },
  'recv.impl.legal': {
    en: '**You** are the legal-representative designation for compliance filings.',
    ar: '**أنت** الممثّل القانوني للإقرارات التنظيمية.',
  },
  'recv.impl.initiatorRole': {
    en: "**{initiator}'s role** flips from Owner to Admin. They keep every admin capability but cannot re-transfer ownership back without you initiating a new transfer.",
    ar: '**دور {initiator}** يتحوّل من مالك إلى مسؤول. يحتفظ بكل صلاحيات المسؤول لكن لا يمكنه استعادة الملكية دون أن تبدأ أنت نقلاً جديداً.',
  },
  'recv.unchanged.listings': {
    en: 'All existing listings and contacts remain with their current owners.',
    ar: 'تبقى كل القوائم وجهات الاتصال الحالية مع أصحابها الحاليين.',
  },
  'recv.unchanged.capabilities': {
    en: "Every member's capability pack and permissions stay the same.",
    ar: 'تبقى حزمة صلاحيات كل عضو وأذوناته كما هي.',
  },
  'recv.unchanged.brand': {
    en: 'The agency name, branding, and public profile are unchanged.',
    ar: 'اسم الوكالة وهويتها البصرية وملفها العام دون تغيير.',
  },
  'recv.reversal.notice': {
    en: "You'll have **30 days** after accepting to reverse the transfer if you change your mind. After 30 days, this cannot be undone from within the app — you would need WingCaster support to intervene.",
    ar: 'سيكون لديك **30 يوماً** بعد القبول لعكس النقل إن غيّرت رأيك. بعد 30 يوماً لا يمكن التراجع من داخل التطبيق — ستحتاج إلى تدخّل دعم وينغكاستر.',
  },
  'recv.consent': {
    en: 'I understand I will become the owner of {agency} with full billing, contract, and legal responsibility.',
    ar: 'أفهم أنني سأصبح مالك {agency} مع كامل المسؤولية عن الفوترة والعقود والشؤون القانونية.',
  },
  'recv.accept': { en: 'Accept and become owner', ar: 'القبول وتولّي الملكية' },
  'recv.accept.busy': { en: 'Verifying and accepting…', ar: 'جارٍ التحقّق والقبول…' },
  'recv.decline': { en: 'Decline transfer', ar: 'رفض النقل' },
  'recv.accept.missing': {
    en: 'Complete the 3 identity factors and consent to accept.',
    ar: 'أكمل عوامل الهوية الثلاثة والموافقة للقبول.',
  },

  'recv.accept.confirm.title': { en: 'Accept ownership of {agency}?', ar: 'قبول ملكية {agency}؟' },
  'recv.accept.confirm.body': {
    en: "You'll become the owner immediately. {initiator} will be notified. You have 30 days to reverse this.",
    ar: 'ستصبح المالك فوراً. سيتم إشعار {initiator}. لديك 30 يوماً لعكس هذا.',
  },
  'recv.accept.confirm.confirm': { en: 'Accept ownership', ar: 'قبول الملكية' },
  'recv.accept.confirm.cancel': { en: 'Keep reviewing', ar: 'متابعة المراجعة' },

  'recv.decline.title': { en: 'Decline this ownership transfer?', ar: 'رفض نقل الملكية هذا؟' },
  'recv.decline.body': {
    en: '{initiator} will be notified with the reason you provide. They stay as owner and can start a new transfer to a different admin.',
    ar: 'سيتم إشعار {initiator} بالسبب الذي تقدّمه. سيبقى مالكاً ويمكنه بدء نقل جديد إلى مسؤول آخر.',
  },
  'recv.decline.reason.label': { en: 'Reason (required — visible to {initiator})', ar: 'السبب (مطلوب — يظهر لـ {initiator})' },
  'recv.decline.reason.placeholder': {
    en: "e.g. I'm not ready to take on billing responsibility right now. Consider transferring to someone else on the team.",
    ar: 'مثال: لست مستعداً لتحمّل مسؤولية الفوترة الآن. يمكن النظر في نقلها إلى شخص آخر في الفريق.',
  },
  'recv.decline.reason.counter': { en: '{n} / 500', ar: '{n} / 500' },
  'recv.decline.confirm': { en: 'Decline transfer', ar: 'رفض النقل' },
  'recv.decline.cancel': { en: 'Keep reviewing', ar: 'متابعة المراجعة' },

  'recv.toast.accepted': { en: "You're now the owner of {agency}. Redirecting…", ar: 'أصبحت الآن مالك {agency}. جارٍ التحويل…' },
  'recv.toast.declined': { en: '{initiator} has been notified.', ar: 'تم إشعار {initiator}.' },
  'recv.toast.acceptFailed': { en: 'Could not accept the transfer. Try again.', ar: 'تعذّر قبول النقل. أعد المحاولة.' },
  'recv.toast.declineFailed': { en: 'Could not decline the transfer. Try again.', ar: 'تعذّر رفض النقل. أعد المحاولة.' },

  // Terminal states
  'recv.terminal.invalid.title': { en: 'This transfer link is no longer valid.', ar: 'لم يعد رابط النقل هذا صالحاً.' },
  'recv.terminal.invalid.body': {
    en: 'It may have been cancelled, expired, or already resolved. Check your inbox for the latest status.',
    ar: 'ربما أُلغي أو انتهت صلاحيته أو حُسم مسبقاً. راجِع الوارد لديك لمعرفة أحدث حالة.',
  },
  'recv.terminal.cancelled.title': { en: '{initiator} cancelled this transfer request on {date}.', ar: 'ألغى {initiator} طلب النقل هذا في {date}.' },
  'recv.terminal.expired.title': { en: 'This transfer request expired on {date} without a response.', ar: 'انتهت صلاحية طلب النقل هذا في {date} دون ردّ.' },
  'recv.terminal.accepted.title': { en: "You already accepted this transfer on {date}. You're the owner of {agency}.", ar: 'قبلت هذا النقل مسبقاً في {date}. أنت مالك {agency}.' },
  'recv.terminal.declined.title': { en: 'You already declined this transfer on {date}.', ar: 'رفضت هذا النقل مسبقاً في {date}.' },
  'recv.terminal.wrongRecipient.title': { en: "This transfer request wasn't sent to you.", ar: 'لم يُرسَل طلب النقل هذا إليك.' },
  'recv.terminal.backToInbox': { en: 'Back to inbox', ar: 'العودة إلى الوارد' },
  'recv.terminal.goDashboard': { en: 'Go to agency dashboard', ar: 'الذهاب إلى لوحة الوكالة' },

  // ── AGT-REC-006 outcome ───────────────────────────────────────────────
  'out.pill.former': { en: 'You initiated this transfer', ar: 'أنت بدأت هذا النقل' },
  'out.pill.new': { en: 'You accepted this transfer', ar: 'أنت قبلت هذا النقل' },
  'out.pill.newPending': { en: 'You were offered this ownership', ar: 'عُرضت عليك هذه الملكية' },

  // Status hero labels (perspective × status)
  'out.hero.pending.former': { en: 'Waiting on {other} to accept ownership of {agency}', ar: 'بانتظار قبول {other} ملكية {agency}' },
  'out.hero.pending.new': { en: '{other} offered you ownership of {agency}', ar: 'عرض عليك {other} ملكية {agency}' },
  'out.hero.executed.former': { en: "You transferred ownership of {agency}. You're now an Admin.", ar: 'نقلت ملكية {agency}. أنت الآن مسؤول.' },
  'out.hero.executed.new': { en: "You're now the owner of {agency}.", ar: 'أنت الآن مالك {agency}.' },
  'out.hero.declined.former': { en: '{other} declined the ownership transfer', ar: 'رفض {other} نقل الملكية' },
  'out.hero.declined.new': { en: 'You declined the ownership transfer', ar: 'رفضت نقل الملكية' },
  'out.hero.cancelled.former': { en: 'You cancelled the ownership transfer to {other}', ar: 'ألغيت نقل الملكية إلى {other}' },
  'out.hero.cancelled.new': { en: '{other} cancelled the ownership transfer', ar: 'ألغى {other} نقل الملكية' },
  'out.hero.expired.former': { en: 'The ownership transfer to {other} expired', ar: 'انتهت صلاحية نقل الملكية إلى {other}' },
  'out.hero.expired.new': { en: 'The ownership transfer offer from {other} expired', ar: 'انتهت صلاحية عرض نقل الملكية من {other}' },
  'out.hero.reversed.former': { en: "You reversed the ownership transfer. You're the owner again.", ar: 'عكست نقل الملكية. أنت المالك مجدداً.' },
  'out.hero.reversed.new': { en: '{other} reversed the ownership transfer. You are an Admin again.', ar: 'عكس {other} نقل الملكية. أنت مسؤول مجدداً.' },
  'out.hero.timestampPrefix': { en: 'Updated', ar: 'حُدِّث' },

  // Party card
  'out.party.owner': { en: 'Owner', ar: 'مالك' },
  'out.party.adminWasOwner': { en: 'Admin (was Owner)', ar: 'مسؤول (كان مالكاً)' },
  'out.party.acceptedRel': { en: 'Accepted {rel}', ar: 'قُبل {rel}' },
  'out.party.initiatedRel': { en: 'Initiated {rel}', ar: 'بُدئ {rel}' },

  // Timeline
  'out.timeline.initiated': { en: 'Initiated', ar: 'بُدئ' },
  'out.timeline.sent': { en: 'Sent to {other}', ar: 'أُرسل إلى {other}' },
  'out.timeline.reviewed': { en: 'Reviewed by {other}', ar: 'راجعه {other}' },
  'out.timeline.reviewedPending': { en: 'Not yet reviewed', ar: 'لم يُراجَع بعد' },
  'out.timeline.decided': { en: 'Decided', ar: 'حُسم' },
  'out.timeline.decidedPending': { en: 'Awaiting decision', ar: 'بانتظار القرار' },
  'out.timeline.flipped': { en: 'Ownership flipped', ar: 'انتقلت الملكية' },
  'out.timeline.reversed': { en: 'Reversed', ar: 'عُكس' },

  'out.resolver.role': { en: 'Admin (was Owner)', ar: 'مسؤول (كان مالكاً)' },
  'out.resolver.empty': { en: 'No rationale was recorded.', ar: 'لم يُسجَّل أي مبرِّر.' },

  // Reversal card
  'out.reversal.heading': { en: 'You can reverse this transfer for {days} more days.', ar: 'يمكنك عكس هذا النقل لمدة {days} يوماً إضافية.' },
  'out.reversal.body': {
    en: 'If you change your mind, reverse the transfer here without contacting support. After {deadline}, only WingCaster support can reverse it.',
    ar: 'إذا غيّرت رأيك، اعكس النقل من هنا دون التواصل مع الدعم. بعد {deadline}، دعم وينغكاستر وحده يمكنه عكسه.',
  },
  'out.reversal.countdown': { en: '{days}d {hours}h remaining · closes {deadline}', ar: 'يتبقّى {days} يوم {hours} ساعة · يُغلق {deadline}' },
  'out.reversal.link': { en: 'Reverse the transfer', ar: 'عكس النقل' },
  'out.reversal.dialog.title': { en: 'Reverse the ownership transfer?', ar: 'عكس نقل الملكية؟' },
  'out.reversal.dialog.body': {
    en: "You'll become the owner again. {other} will become an Admin. They'll be notified. This action requires the same 3-factor verification as the original transfer.",
    ar: 'ستصبح المالك مجدداً. سيصبح {other} مسؤولاً. سيتم إشعاره. يتطلّب هذا الإجراء التحقّق ذاته بثلاثة عوامل كالنقل الأصلي.',
  },
  'out.reversal.dialog.confirm': { en: 'Yes, reverse', ar: 'نعم، اعكس' },
  'out.reversal.dialog.cancel': { en: 'Keep it as is', ar: 'إبقاؤه كما هو' },
  'out.reversal.toast': { en: "You're back to being the owner of {agency}.", ar: 'عدت إلى كونك مالك {agency}.' },
  'out.reversal.toast.failed': { en: 'Could not reverse the transfer. Try again.', ar: 'تعذّر عكس النقل. أعد المحاولة.' },
  'out.reversal.windowClosed': {
    en: 'The 30-day reversal window has closed. To reverse this transfer, contact WingCaster support.',
    ar: 'أُغلقت نافذة العكس البالغة 30 يوماً. لعكس هذا النقل، تواصل مع دعم وينغكاستر.',
  },

  // Detail blocks
  'out.detail.executed.former.heading': { en: 'What changed for you', ar: 'ما الذي تغيّر بالنسبة لك' },
  'out.detail.executed.former.billing': { en: 'Billing invoices no longer route to you.', ar: 'لم تعد الفواتير تُوجَّه إليك.' },
  'out.detail.executed.former.pa': { en: 'You can no longer escalate to WingCaster PA support.', ar: 'لم يعد بإمكانك التصعيد إلى دعم المنصّة.' },
  'out.detail.executed.former.transfer': { en: 'You can no longer initiate another ownership transfer without {other} starting a new one to you.', ar: 'لم يعد بإمكانك بدء نقل ملكية آخر دون أن يبدأ {other} نقلاً جديداً إليك.' },
  'out.detail.executed.former.unchanged': { en: 'Your listings, contacts, and role permissions are unchanged.', ar: 'قوائمك وجهات اتصالك وأذونات دورك دون تغيير.' },

  'out.detail.executed.new.heading': { en: "Welcome to the responsibility. Here's what's now yours.", ar: 'أهلاً بالمسؤولية. إليك ما أصبح لك الآن.' },
  'out.detail.executed.new.card1': { en: 'Review billing address & payment method', ar: 'راجِع عنوان الفوترة ووسيلة الدفع' },
  'out.detail.executed.new.card2': { en: 'See your PA escalation options', ar: 'اطّلع على خيارات التصعيد إلى المنصّة' },
  'out.detail.executed.new.card3': { en: 'Notify your team', ar: 'أبلِغ فريقك' },
  'out.detail.executed.new.clipboard': {
    en: "I've just taken over as owner of {agency}. {other} stays as an Admin and continues to lead their book. If anything's blocking you, come to me for billing, contract, or PA-support decisions.",
    ar: 'توليت للتو ملكية {agency}. يبقى {other} مسؤولاً ويواصل قيادة محفظته. إذا واجهك ما يعيقك، تواصل معي لقرارات الفوترة أو العقود أو دعم المنصّة.',
  },
  'out.detail.executed.new.copied': { en: 'Copied to clipboard', ar: 'نُسخ إلى الحافظة' },
  'out.detail.executed.new.copyAria': { en: 'Copy suggested team notification message', ar: 'نسخ رسالة إشعار الفريق المقترحة' },

  'out.detail.pending.former': { en: "We'll notify you the moment {other} decides. Sent {rel} · Expires {expiry}.", ar: 'سنُشعرك لحظة اتخاذ {other} قراره. أُرسل {rel} · ينتهي {expiry}.' },
  'out.detail.pending.new': { en: 'This request expires on {expiry}. Open the review page to accept or decline.', ar: 'ينتهي هذا الطلب في {expiry}. افتح صفحة المراجعة للقبول أو الرفض.' },
  'out.detail.declined.former': { en: "The transfer didn't happen. You're still the owner. Reason from {other}: “{reason}”.", ar: 'لم يتم النقل. لا تزال المالك. سبب {other}: «{reason}».' },
  'out.detail.declined.new': { en: 'You declined the transfer on {date}. Reason: “{reason}”. You can still be offered ownership in future.', ar: 'رفضت النقل في {date}. السبب: «{reason}». لا يزال بإمكانك تلقّي عرض ملكية مستقبلاً.' },
  'out.detail.cancelled.former': { en: 'You cancelled the transfer on {date}. You are still the owner.', ar: 'ألغيت النقل في {date}. لا تزال المالك.' },
  'out.detail.cancelled.new': { en: '{other} cancelled before you decided. No action needed.', ar: 'ألغى {other} قبل أن تقرّر. لا حاجة لأي إجراء.' },
  'out.detail.expired.former': { en: 'The transfer request expired after 14 days without a response from {other}.', ar: 'انتهت صلاحية طلب النقل بعد 14 يوماً دون ردّ من {other}.' },
  'out.detail.expired.new': { en: 'The offer expired and is no longer valid.', ar: 'انتهت صلاحية العرض ولم يعد صالحاً.' },
  'out.detail.reversed.former': { en: "You reversed the ownership transfer on {date}. You're back to being the owner of {agency}. The 30-day reversal window has now closed for this transfer.", ar: 'عكست نقل الملكية في {date}. عدت إلى كونك مالك {agency}. أُغلقت الآن نافذة العكس البالغة 30 يوماً لهذا النقل.' },
  'out.detail.reversed.new': { en: '{other} reversed the ownership transfer on {date}. You are an Admin of {agency} again. Your role permissions and access are unchanged.', ar: 'عكس {other} نقل الملكية في {date}. أنت مسؤول في {agency} مجدداً. أذونات دورك وصلاحياتك دون تغيير.' },

  // CTAs
  'out.cta.awaiting': { en: "Awaiting {other}'s response", ar: 'بانتظار ردّ {other}' },
  'out.cta.cancelTransfer': { en: 'Cancel transfer', ar: 'إلغاء النقل' },
  'out.cta.openReview': { en: 'Open review page', ar: 'فتح صفحة المراجعة' },
  'out.cta.reverse': { en: 'Reverse transfer', ar: 'عكس النقل' },
  'out.cta.goDashboard': { en: 'Go to {agency} dashboard', ar: 'الذهاب إلى لوحة {agency}' },
  'out.cta.goDashboardOwner': { en: 'Go to {agency} dashboard as owner', ar: 'الذهاب إلى لوحة {agency} كمالك' },
  'out.cta.reviewBilling': { en: 'Review billing', ar: 'مراجعة الفوترة' },
  'out.cta.notifyTeam': { en: 'Notify team', ar: 'إبلاغ الفريق' },
  'out.cta.viewProfile': { en: 'View agency profile', ar: 'عرض ملف الوكالة' },
  'out.cta.viewSettings': { en: 'View agency settings', ar: 'عرض إعدادات الوكالة' },
  'out.cta.viewAudit': { en: 'View audit log', ar: 'عرض سجل التدقيق' },
  'out.cta.contactSupport': { en: 'Contact support', ar: 'التواصل مع الدعم' },
  'out.cta.startNew': { en: 'Start a new transfer', ar: 'بدء نقل جديد' },

  'out.cancelDialog.title': { en: 'Cancel your transfer request to {other}?', ar: 'إلغاء طلب النقل إلى {other}؟' },
  'out.cancelDialog.body': { en: 'They will be notified. You can start a new transfer any time.', ar: 'سيتم إشعاره. يمكنك بدء نقل جديد في أي وقت.' },
  'out.cancelDialog.confirm': { en: 'Yes, cancel', ar: 'نعم، إلغاء' },
  'out.cancelDialog.cancel': { en: 'Keep it', ar: 'الإبقاء عليه' },

  'out.notFound.title': { en: "This transfer doesn't exist or isn't visible to you.", ar: 'هذا النقل غير موجود أو غير مرئي لك.' },
  'out.notFound.cta': { en: 'Back to inbox', ar: 'العودة إلى الوارد' },
  'out.toast.updated': { en: 'Transfer updated', ar: 'حُدِّث النقل' },
} as const

export type OwnershipTransferCopyKey = keyof typeof OWNERSHIP_TRANSFER_COPY

function interpolate(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in vars ? String(vars[key]) : match,
  )
}

export function ownershipTransferT(
  key: OwnershipTransferCopyKey,
  locale: OwnershipTransferLocale | AppLocale,
  vars?: Record<string, string | number>,
): string {
  const entry = OWNERSHIP_TRANSFER_COPY[key]
  return interpolate(entry[locale === 'ar' ? 'ar' : 'en'], vars)
}

/** Locale-aware reader — mirrors twoPersonCopy + useLocale() consumer shape. */
export function useOwnershipTransferCopy() {
  const { isArabic } = useLocale()
  const resolved: OwnershipTransferLocale = isArabic ? 'ar' : 'en'
  const t = useCallback(
    (key: OwnershipTransferCopyKey, vars?: Record<string, string | number>) =>
      ownershipTransferT(key, resolved, vars),
    [resolved],
  )
  return useMemo(() => ({ t, locale: resolved, isArabic }), [t, resolved, isArabic])
}
