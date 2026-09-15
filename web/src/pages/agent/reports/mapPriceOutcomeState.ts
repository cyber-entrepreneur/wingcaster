import type { AgentPriceReportRow, OutcomeHeroMapping, PriceOutcomeVariant } from './outcomeTypes'

/**
 * Map live agent_price_reports.status (+ weight) → REC StatusHero props.
 *
 * Doctrine (AGT-REC-003):
 * - APPROVED-AND-INCORPORATED (weight === 100) → approved + loud
 * - APPROVED-AS-SIGNAL-ONLY (weight < 100) → approved + default
 *
 * Live API has no explicit weight column yet — derive:
 * - incorporated / status=incorporated → 100
 * - verified → data.signal_weight | applied_weight | weight | default 50
 */
export function resolvePriceReportWeight(report: AgentPriceReportRow): number | null {
  const status = String(report.status || '').toLowerCase()
  if (report.incorporated === true || status === 'incorporated') return 100
  if (status === 'verified' || status === 'approved') {
    const raw =
      report.data?.signal_weight ??
      report.data?.applied_weight ??
      report.data?.weight
    const n = Number(raw)
    if (Number.isFinite(n)) return Math.max(0, Math.min(100, n))
    return 50
  }
  return null
}

export function mapPriceOutcomeState(report: AgentPriceReportRow): OutcomeHeroMapping & {
  variant: PriceOutcomeVariant
  weight: number | null
} {
  const status = String(report.status || 'pending_review').toLowerCase()
  const weight = resolvePriceReportWeight(report)
  const pickedUp = report.data?.picked_up_at || report.reviewed_at

  if (status === 'withdrawn') {
    return { variant: 'withdrawn', heroState: 'withdrawn', emphasis: 'default', weight }
  }
  if (status === 'expired') {
    return { variant: 'expired', heroState: 'expired', emphasis: 'default', weight }
  }
  if (status === 'closed_as_duplicate' || Boolean(report.superseded_by_report_id)) {
    return { variant: 'superseded', heroState: 'superseded', emphasis: 'default', weight }
  }
  if (status === 'request_info' || status === 'more_info_requested') {
    return { variant: 'more_info', heroState: 'more_info', emphasis: 'default', weight }
  }
  if (status === 'rejected') {
    return { variant: 'rejected', heroState: 'rejected', emphasis: 'default', weight }
  }
  if (report.incorporated === true || status === 'incorporated') {
    return { variant: 'approved_incorporated', heroState: 'approved', emphasis: 'loud', weight: 100 }
  }
  if (status === 'verified' || (status === 'approved' && weight != null && weight < 100)) {
    return {
      variant: 'approved_signal_only',
      heroState: 'approved',
      emphasis: 'default',
      weight: weight ?? 50,
    }
  }
  if (status === 'approved' && weight === 100) {
    return { variant: 'approved_incorporated', heroState: 'approved', emphasis: 'loud', weight: 100 }
  }

  // pending / pending_review / pending_second_approval
  if (pickedUp || status === 'pending_second_approval') {
    return { variant: 'pending_in_review', heroState: 'pending', emphasis: 'default', weight }
  }
  return { variant: 'pending', heroState: 'pending', emphasis: 'default', weight }
}

export function priceHeroLabel(variant: PriceOutcomeVariant): string {
  switch (variant) {
    case 'pending':
    case 'pending_in_review':
      return 'Awaiting Platform Administrator review'
    case 'approved_incorporated':
      return 'Your price signal is now live'
    case 'approved_signal_only':
      return 'Your signal is accepted as one of several inputs'
    case 'rejected':
      return "We reviewed your report and won't publish it"
    case 'more_info':
      return 'The reviewer needs a bit more from you'
    case 'expired':
      return 'This report timed out'
    case 'withdrawn':
      return 'You withdrew this report'
    case 'superseded':
      return 'You submitted another report about the same market segment. This one is closed as a duplicate.'
  }
}
