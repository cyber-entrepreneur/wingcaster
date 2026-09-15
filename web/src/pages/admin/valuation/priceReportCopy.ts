/**
 * PA-PVA-009 / 009b toast + vote copy — LOGIN_COPY shape ({ en, ar } per key).
 * Locale resolved at read time via useLocale(); no title/description bilingual split.
 */

import { useCallback, useMemo } from 'react'
import { useLocale, type AppLocale } from '@/hooks/useLocale'

export type PriceReportAdminLocale = 'en' | 'ar'

export const PRICE_REPORT_COPY = {
  'toast.approve.success': {
    en: 'Approval recorded. Recalculating benchmarks.',
    ar: 'تم تسجيل الموافقة. جارٍ إعادة احتساب المعايير.',
  },
  'toast.decline.success': {
    en: 'Incorporation declined. Report returned to pending review.',
    ar: 'رُفضت عملية الدمج. عاد التقرير إلى قائمة الانتظار.',
  },
  'toast.second_approval.pending': {
    en: 'Incorporation request created. Awaiting second approver.',
    ar: 'أُنشئ طلب الدمج. بانتظار موافقة المراجع الثاني.',
  },
  'toast.undo.success': {
    en: 'Review undone.',
    ar: 'تم التراجع عن المراجعة.',
  },
  'toast.undo.token_consumed': {
    en: 'Undo unavailable — make a corrective decision on this report.',
    ar: 'التراجع غير متاح — اتّخذ قراراً تصحيحياً على هذا التقرير.',
  },
  'toast.undo.expired': {
    en: 'Undo window expired.',
    ar: 'انتهت مهلة التراجع.',
  },
  'toast.vote.same_reviewer': {
    en: 'You cast the first vote. A different PA must cast the second.',
    ar: 'أنت صاحب التصويت الأول. يجب أن يصوّت مسؤول منصة آخر.',
  },
  'toast.vote.own_case': {
    en: "You can't decide your own price report.",
    ar: 'لا يمكنك البت في تقرير السعر الخاص بك.',
  },
  'toast.vote.token_consumed': {
    en: 'This approval was already decided. Choose a corrective action on the report.',
    ar: 'تم حسم طلب الموافقة مسبقاً. اختر قراراً تصحيحياً على التقرير.',
  },
  'toast.action.failed': {
    en: 'Action failed',
    ar: 'تعذّر تنفيذ الإجراء',
  },
  'toast.bulk.failed': {
    en: 'Bulk review failed',
    ar: 'تعذّرت المراجعة الجماعية',
  },
  'toast.incorporate.single_only': {
    en: 'Incorporate must be reviewed one report at a time.',
    ar: 'يجب مراجعة طلب الدمج لتقرير واحد في كل مرة.',
  },
  'toast.preview.expired': {
    en: 'Preview link expired. Refresh page.',
    ar: 'انتهت صلاحية رابط المعاينة. حدّث الصفحة.',
  },
  'toast.own_row.blocked': {
    en: "You can't act on this row — you are the submitting agent.",
    ar: 'لا يمكنك التصرّف في هذا الصف — أنت وكيل التقديم.',
  },
  'toast.review.incorporated': {
    en: 'Report incorporated into benchmark.',
    ar: 'أُدمج التقرير في المعيار.',
  },
  'toast.review.signal_only': {
    en: 'Approved as signal only.',
    ar: 'تمت الموافقة كإشارة فقط.',
  },
  'toast.review.rejected': {
    en: 'Report rejected.',
    ar: 'رُفض التقرير.',
  },
  'toast.review.request_info': {
    en: 'More information requested.',
    ar: 'طُلبت معلومات إضافية.',
  },
} as const

export type PriceReportCopyKey = keyof typeof PRICE_REPORT_COPY

export function priceReportAdminT(
  key: PriceReportCopyKey,
  locale: PriceReportAdminLocale | AppLocale,
): string {
  return PRICE_REPORT_COPY[key][locale === 'ar' ? 'ar' : 'en']
}

/** Locale-aware reader — mirrors LOGIN_COPY + useLocale() consumer shape. */
export function usePriceReportCopy() {
  const { locale, isArabic } = useLocale()
  const resolved = (isArabic ? 'ar' : locale === 'ar' ? 'ar' : 'en') as PriceReportAdminLocale
  const t = useCallback(
    (key: PriceReportCopyKey) => priceReportAdminT(key, resolved),
    [resolved],
  )
  return useMemo(() => ({ t, locale: resolved }), [t, resolved])
}
