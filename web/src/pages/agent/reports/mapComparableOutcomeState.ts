import type { ComparableOutcomeVariant, ComparableReportRow, OutcomeHeroMapping } from './outcomeTypes'

/**
 * Map live comparable_reports.status (+ action hints) → REC StatusHero props.
 *
 * Doctrine (AGT-REC-002):
 * - APPROVED-AND-REMOVED → approved + loud
 * - APPROVED-AND-QUARANTINED → approved + default
 */
export function mapComparableOutcomeState(report: ComparableReportRow): OutcomeHeroMapping & {
  variant: ComparableOutcomeVariant
} {
  const status = String(report.status || 'pending').toLowerCase()
  const decisionAction = String(report.data?.decision?.action || '').toLowerCase()
  const pickedUp =
    report.picked_up_at ||
    report.data?.picked_up_at ||
    (status === 'remove_proposed' ? report.reviewed_at : null)

  if (status === 'withdrawn') {
    return { variant: 'withdrawn', heroState: 'withdrawn', emphasis: 'default' }
  }
  if (status === 'expired') {
    return { variant: 'expired', heroState: 'expired', emphasis: 'default' }
  }
  if (
    status === 'closed_as_duplicate' ||
    Boolean(report.superseded_by_report_id)
  ) {
    return { variant: 'superseded', heroState: 'superseded', emphasis: 'default' }
  }
  if (status === 'awaiting_info' || status === 'more_info_requested') {
    return { variant: 'more_info', heroState: 'more_info', emphasis: 'default' }
  }
  if (status === 'rejected' || status === 'dismissed') {
    return { variant: 'rejected', heroState: 'rejected', emphasis: 'default' }
  }
  if (
    status === 'confirmed_removed' ||
    status === 'actioned' ||
    decisionAction === 'confirm_remove' ||
    decisionAction === 'removed'
  ) {
    return { variant: 'approved_removed', heroState: 'approved', emphasis: 'loud' }
  }
  if (
    status === 'confirmed_quarantined' ||
    decisionAction === 'confirm_quarantine' ||
    decisionAction === 'quarantined'
  ) {
    return { variant: 'approved_quarantined', heroState: 'approved', emphasis: 'default' }
  }
  if (status === 'approved') {
    // Brief contract: action=removed|quarantined. Default to quarantined (quiet) if unknown.
    if (decisionAction === 'removed') {
      return { variant: 'approved_removed', heroState: 'approved', emphasis: 'loud' }
    }
    return { variant: 'approved_quarantined', heroState: 'approved', emphasis: 'default' }
  }

  // pending / reviewed (legacy open) / remove_proposed (awaiting second PA)
  if (pickedUp) {
    return { variant: 'pending_in_review', heroState: 'pending', emphasis: 'default' }
  }
  return { variant: 'pending', heroState: 'pending', emphasis: 'default' }
}

export function comparableHeroLabel(variant: ComparableOutcomeVariant): string {
  switch (variant) {
    case 'pending':
    case 'pending_in_review':
      return 'Awaiting Platform Administrator review'
    case 'approved_removed':
      return 'We removed this comparable'
    case 'approved_quarantined':
      return 'We flagged this comparable for further verification'
    case 'rejected':
      return 'We reviewed your report and kept the comparable in place'
    case 'more_info':
      return 'The reviewer needs a bit more from you'
    case 'expired':
      return 'This report timed out'
    case 'withdrawn':
      return 'You withdrew this report'
    case 'superseded':
      return 'You submitted another report about the same comparable. This one is closed as a duplicate; the other one is where the outcome will land.'
  }
}

export function extractImpactCount(report: ComparableReportRow): number {
  const fromDecision = report.data?.decision?.market_impact?.valuations_affected
  if (typeof fromDecision === 'number' && Number.isFinite(fromDecision)) return fromDecision
  const fromData = report.data?.market_impact?.valuations_affected
  if (typeof fromData === 'number' && Number.isFinite(fromData)) return fromData
  const ids =
    report.data?.decision?.market_impact?.affected_property_ids ||
    report.data?.market_impact?.affected_property_ids
  if (Array.isArray(ids)) return ids.length
  return 0
}
