/**
 * WF-20 two-person execute + escalate + recall copy.
 * LOGIN_COPY shape ({ en, ar } per key); locale resolved at read time via useLocale().
 * Real MENA business Arabic — no [TRANSLATION-PENDING], no English fallbacks.
 */

import { useCallback, useMemo } from 'react'
import { useLocale, type AppLocale } from '@/hooks/useLocale'

export type TwoPersonLocale = 'en' | 'ar'

export const TWO_PERSON_COPY = {
  // ── Execute modal shell ───────────────────────────────────────────────
  'execute.title': { en: 'Confirm and execute', ar: 'التأكيد والتنفيذ' },
  'execute.subtitle': {
    en: 'Request #{last6} · submitted {rel}',
    ar: 'الطلب رقم {last6} · قُدِّم {rel}',
  },
  'execute.close': { en: 'Close confirmation', ar: 'إغلاق التأكيد' },
  'chip.live': { en: 'LIVE', ar: 'مباشر' },
  'chip.test': { en: 'TEST', ar: 'تجريبي' },

  // ── Summary ───────────────────────────────────────────────────────────
  'summary.action': { en: 'Action', ar: 'الإجراء' },
  'summary.tier': { en: 'Value tier', ar: 'مستوى القيمة' },
  'summary.submittedBy': { en: 'Submitted by', ar: 'مقدِّم الطلب' },
  'summary.approvers': { en: 'Assigned approvers', ar: 'المعتمِدون المكلَّفون' },
  'tier.standard': { en: 'Standard', ar: 'قياسي' },
  'tier.elevated': { en: 'Elevated', ar: 'مرتفع' },
  'tier.high_value': { en: 'High-value', ar: 'عالي القيمة' },

  // ── Two-person progress ───────────────────────────────────────────────
  'progress.first': { en: 'First approver', ar: 'المعتمِد الأول' },
  'progress.second': { en: 'Second approver (you)', ar: 'المعتمِد الثاني (أنت)' },
  'progress.pending': { en: 'Pending — your confirmation', ar: 'قيد الانتظار — تأكيدك' },

  // ── Diff ──────────────────────────────────────────────────────────────
  'diff.title': { en: 'What will change', ar: 'ما الذي سيتغيّر' },
  'diff.empty': {
    en: 'No field-level changes; this is a state transition.',
    ar: 'لا توجد تغييرات على مستوى الحقول؛ هذا انتقال حالة.',
  },

  // ── Risk signals ──────────────────────────────────────────────────────
  'risk.title': { en: 'Risk signals', ar: 'مؤشرات المخاطر' },

  // ── Ledger ────────────────────────────────────────────────────────────
  'ledger.title': { en: 'Ledger impact', ar: 'الأثر المحاسبي' },
  'ledger.account': { en: 'Account', ar: 'الحساب' },
  'ledger.debit': { en: 'Debit', ar: 'مدين' },
  'ledger.credit': { en: 'Credit', ar: 'دائن' },
  'ledger.totals': { en: 'Totals', ar: 'الإجماليات' },
  'ledger.balanced': { en: 'Balances', ar: 'متوازن' },
  'ledger.footer': { en: 'Posts to {env} ledger on confirm.', ar: 'يُرحَّل إلى دفتر {env} عند التأكيد.' },
  'ledger.unbalanced': {
    en: 'Ledger preview does not balance ({delta} off). This request cannot execute — contact backend on-call.',
    ar: 'معاينة الدفتر غير متوازنة (بفارق {delta}). لا يمكن تنفيذ هذا الطلب — تواصل مع المناوب التقني.',
  },

  // ── Consent + type-to-confirm ─────────────────────────────────────────
  'consent.label': {
    en: 'I have reviewed the diff, risk signals, and ledger impact — proceed.',
    ar: 'لقد راجعتُ التغييرات ومؤشرات المخاطر والأثر المحاسبي — تابِع.',
  },
  'ttc.label.before': { en: 'Type', ar: 'اكتب' },
  'ttc.label.after': { en: 'to confirm', ar: 'للتأكيد' },
  'ttc.placeholder': { en: 'Type the phrase above', ar: 'اكتب العبارة أعلاه' },
  'ttc.helper': {
    en: 'Case-sensitive. This phrase is generated per request.',
    ar: 'حسّاسة لحالة الأحرف. تُولَّد هذه العبارة لكل طلب على حدة.',
  },
  'ttc.mismatch': {
    en: "Doesn't match. Type the phrase exactly.",
    ar: 'غير مطابقة. اكتب العبارة تماماً.',
  },

  // ── Buttons ───────────────────────────────────────────────────────────
  'btn.confirm.generic': { en: 'Confirm and execute', ar: 'التأكيد والتنفيذ' },
  'btn.confirm.executing': { en: 'Executing…', ar: 'جارٍ التنفيذ…' },
  'btn.cancel': { en: 'Cancel', ar: 'إلغاء' },
  'audit.note': {
    en: 'This action will be recorded to the immutable audit log.',
    ar: 'سيُسجَّل هذا الإجراء في سجل التدقيق غير القابل للتعديل.',
  },

  // ── Loading / errors ──────────────────────────────────────────────────
  'loading.preview': { en: 'Loading confirmation preview…', ar: 'جارٍ تحميل معاينة التأكيد…' },
  'loading.error': { en: "Couldn't load the preview. Retry.", ar: 'تعذّر تحميل المعاينة. أعد المحاولة.' },
  'loading.retry': { en: 'Retry', ar: 'إعادة المحاولة' },

  // ── Self-approval ─────────────────────────────────────────────────────
  'self.title': { en: "You can't approve your own request.", ar: 'لا يمكنك اعتماد طلبك الخاص.' },
  'self.body': {
    en: 'This request was submitted by you. WingCaster requires a second approver from another Platform Admin. Assign it via Escalate.',
    ar: 'هذا الطلب مقدَّم منك. يتطلّب وينغكاستر معتمِداً ثانياً من مسؤول منصّة آخر. أسنِده عبر التصعيد.',
  },
  'self.cta': { en: 'Assign to another approver via Escalate', ar: 'أسنِد إلى معتمِد آخر عبر التصعيد' },
  'self.close': { en: 'Close', ar: 'إغلاق' },

  // ── Stale ─────────────────────────────────────────────────────────────
  'stale.title': { en: 'This request has changed.', ar: 'لقد تغيّر هذا الطلب.' },
  'stale.body': {
    en: 'Since you opened this confirmation, the underlying request was modified. Review the latest version before executing.',
    ar: 'منذ فتحك هذا التأكيد، عُدِّل الطلب الأساسي. راجِع أحدث نسخة قبل التنفيذ.',
  },
  'stale.cta': { en: 'Reload request', ar: 'إعادة تحميل الطلب' },

  // ── Vote mismatch ─────────────────────────────────────────────────────
  'mismatch.title': { en: 'Votes do not match.', ar: 'الأصوات غير متطابقة.' },
  'mismatch.body': {
    en: 'The first approver rejected this request; your matching approve vote conflicts. This case is being escalated for third-approver resolution.',
    ar: 'رفض المعتمِد الأول هذا الطلب؛ ويتعارض صوتك بالموافقة معه. تجري إحالة الحالة إلى معتمِد ثالث للبتّ فيها.',
  },
  'mismatch.cta': { en: 'Open escalation', ar: 'فتح التصعيد' },

  // ── Toasts ────────────────────────────────────────────────────────────
  'toast.success.title': { en: 'Executed', ar: 'تم التنفيذ' },
  'toast.success.body': { en: '{summary}', ar: '{summary}' },
  'toast.fail.title': { en: 'Action failed', ar: 'تعذّر تنفيذ الإجراء' },
  'toast.fail.generic': {
    en: 'Something went wrong executing this action. The request is unchanged. Try again.',
    ar: 'حدث خطأ أثناء تنفيذ هذا الإجراء. لم يتغيّر الطلب. أعد المحاولة.',
  },

  // ── Escalation modal (PA-APR-005) ─────────────────────────────────────
  'esc.title': { en: 'Escalate to another approver', ar: 'التصعيد إلى معتمِد آخر' },
  'esc.subtitle': {
    en: 'Reassign this request to a Platform Admin better placed to decide.',
    ar: 'أعِد إسناد هذا الطلب إلى مسؤول منصّة أقدر على اتخاذ القرار.',
  },
  'esc.target.label': { en: 'Escalate to', ar: 'التصعيد إلى' },
  'esc.target.placeholder': { en: 'Search Platform Admins…', ar: 'ابحث عن مسؤولي المنصّة…' },
  'esc.target.empty': { en: 'No eligible approvers found.', ar: 'لا يوجد معتمِدون مؤهَّلون.' },
  'esc.target.ooo': { en: 'Out of office', ar: 'خارج المكتب' },
  'esc.reason.label': { en: 'Reason for escalation', ar: 'سبب التصعيد' },
  'esc.reason.out_of_scope_authority': { en: 'Beyond my authority', ar: 'خارج نطاق صلاحيتي' },
  'esc.reason.conflict_of_interest': { en: 'Conflict of interest', ar: 'تضارب مصالح' },
  'esc.reason.requires_domain_expertise': { en: 'Needs domain expertise', ar: 'يتطلّب خبرة متخصّصة' },
  'esc.reason.contentious': { en: 'Contentious decision', ar: 'قرار مثير للجدل' },
  'esc.reason.compliance_concern': { en: 'Compliance concern', ar: 'مخاوف امتثال' },
  'esc.reason.other': { en: 'Other', ar: 'أخرى' },
  'esc.notes.label': { en: 'Rationale', ar: 'المبرِّر' },
  'esc.notes.placeholder': {
    en: 'Explain why this needs another approver…',
    ar: 'اشرح سبب حاجة الطلب إلى معتمِد آخر…',
  },
  'esc.notes.min': { en: 'At least {min} characters.', ar: 'ما لا يقل عن {min} حرفاً.' },
  'esc.notify.label': { en: 'Notify via', ar: 'الإشعار عبر' },
  'esc.notify.email': { en: 'Email', ar: 'بريد إلكتروني' },
  'esc.notify.slack': { en: 'Slack', ar: 'سلاك' },
  'esc.notify.teams': { en: 'Teams', ar: 'تيمز' },
  'esc.submit': { en: 'Escalate request', ar: 'تصعيد الطلب' },
  'esc.submitting': { en: 'Escalating…', ar: 'جارٍ التصعيد…' },
  'esc.success': { en: 'Request escalated. The new approver has been notified.', ar: 'تم تصعيد الطلب. أُشعِر المعتمِد الجديد.' },
  'esc.hop': { en: 'Escalation {hop} of {max}', ar: 'التصعيد {hop} من {max}' },

  // ── Recall / withdraw modal (PA-APR-006) ──────────────────────────────
  'recall.title': { en: 'Recall this request', ar: 'سحب هذا الطلب' },
  'recall.subtitle': {
    en: 'Withdraw your own pending request. It returns to draft and no approver can act on it.',
    ar: 'اسحب طلبك المعلَّق. سيعود إلى المسودّة ولن يتمكّن أي معتمِد من التصرّف فيه.',
  },
  'recall.reason.label': { en: 'Reason for recall', ar: 'سبب السحب' },
  'recall.reason.placeholder': {
    en: 'Explain why you are withdrawing this request…',
    ar: 'اشرح سبب سحبك لهذا الطلب…',
  },
  'recall.submit': { en: 'Recall request', ar: 'سحب الطلب' },
  'recall.submitting': { en: 'Recalling…', ar: 'جارٍ السحب…' },
  'recall.success': { en: 'Request recalled and returned to draft.', ar: 'تم سحب الطلب وأُعيد إلى المسودّة.' },
  'recall.only.title': { en: 'Only the submitter can recall.', ar: 'المُقدِّم وحده يمكنه السحب.' },
} as const

export type TwoPersonCopyKey = keyof typeof TWO_PERSON_COPY

function interpolate(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in vars ? String(vars[key]) : match,
  )
}

export function twoPersonT(
  key: TwoPersonCopyKey,
  locale: TwoPersonLocale | AppLocale,
  vars?: Record<string, string | number>,
): string {
  const entry = TWO_PERSON_COPY[key]
  return interpolate(entry[locale === 'ar' ? 'ar' : 'en'], vars)
}

/** Locale-aware reader — mirrors LOGIN_COPY + useLocale() consumer shape. */
export function useTwoPersonCopy() {
  const { isArabic } = useLocale()
  const resolved: TwoPersonLocale = isArabic ? 'ar' : 'en'
  const t = useCallback(
    (key: TwoPersonCopyKey, vars?: Record<string, string | number>) =>
      twoPersonT(key, resolved, vars),
    [resolved],
  )
  return useMemo(() => ({ t, locale: resolved, isArabic }), [t, resolved, isArabic])
}
