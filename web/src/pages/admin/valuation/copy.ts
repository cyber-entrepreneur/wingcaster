/** English copy for PA-PVA-008 / 008b (WF-05). */

export const QUEUE_COPY = {
  pageTitle: 'Bad-comparable-report queue',
  subtitleTemplate:
    '{N} pending · {K} at-risk (breach in {T}) · {H} high-impact awaiting 2-person · {M} confirmed this week · {J} rejected this week',
  testEnvStrip:
    'TEST ENVIRONMENT — decisions here do not remove real comparables or re-run real valuations.',
  statusTabs: {
    pending: 'Pending',
    confirmed_removed: 'Confirmed (removed)',
    confirmed_quarantined: 'Confirmed (quarantined)',
    rejected: 'Rejected',
    awaiting_info: 'Awaiting info',
    expired: 'Expired',
  },
  filter: {
    categoryLabel: 'Reason category',
    categoryAny: 'Any category',
    severityLabel: 'Severity',
    severityAny: 'Any',
    impactLabel: 'Market impact',
    impactAny: 'Any',
    withinLabel: 'Submitted within',
    searchPlaceholder: 'Search reporter, agency, comparable title, or case ID…',
  },
  columns: {
    submitted: 'Submitted',
    reporter: 'Reporter · Agency',
    comparable: 'Comparable',
    category: 'Reason',
    severity: 'Severity',
    impact: 'Market impact',
    evidence: 'Evidence',
    status: 'Status',
    actions: 'Actions',
  },
  rowOpen: 'Open',
  slaGreen: '{H}h left',
  slaAmber: '{H}h left · at risk',
  slaRed: 'Review SLA breached by {H}h',
  reporterPatternTooltip:
    'Reporter has filed {N} reports against {agency} in {D} days · possible pattern.',
  sourceAgencyOwned: 'Agency-owned',
  sourceExternal: '{sourceMonogram} · external',
  marketImpactChip: '{N} valuations · ±{P}%',
  marketImpactTooltip:
    'Removing this comparable will re-run {N} valuations · median move {P}% · max move {Q}%.',
  evidenceChip: '{N} files',
  evidenceZero: '0 files ⚠',
  bulk: {
    selectedLabel: 'selected',
    rejectAsInvalid: 'Reject as invalid',
    requestMoreInfo: 'Request more info',
    stepUpNotice: 'Step-up required for high-severity or high-impact bulk decisions.',
    /**
     * WF-05 deliberate omission: confirm-remove / confirm-quarantine are NOT bulk actions.
     * Removal re-runs valuations market-wide — see PAQueueBulkBar `actions` filter.
     */
    confirmRemoveBlockedToast:
      'Confirm-remove decisions are single-row only — open the case on PA-PVA-008b.',
  },
  bulkReject: {
    title: 'Reject {N} reports as invalid',
    reasonLabel: 'Reason (shown to each reporter)',
    notesLabel: 'Notes for the reporters (required)',
    confirm: 'Reject all {N}',
  },
  bulkRequestInfo: {
    title: 'Request more info on {N} reports',
    reasonLabel: 'Reason (shown to each reporter)',
    notesLabel: 'Notes for the reporters (required)',
    confirm: 'Request info on {N}',
  },
  emptyPendingTitle: 'No bad-comparable reports awaiting review',
  emptyPendingBody:
    "When agents flag a comparable that's wrong, they land here for your review. Widen the 'Submitted within' filter if you expected reports.",
  emptyPendingCta: 'Review pricing sources →',
  ownCaseBlock:
    "You can't act on this row — you are the reporter or an agent at the comparable's agency.",
  gateTitle: 'Platform admin required',
  gateBody: 'Comparable-report review is restricted to platform admins.',
  loadError: "Couldn't load comparable reports. Try again.",
  retry: 'Retry',
} as const

export const DETAIL_COPY = {
  backToQueue: '‹ Back to queue',
  queuePosition: 'Report {n} of {total} pending',
  copyLinkToast: 'Link copied to clipboard.',
  reporterPatternBanner:
    'This reporter has filed {N} reports against {agency} in {D} days. Read for pattern before deciding.',
  deltaRibbon: 'Δ {field}: {currentValue} → {observedValue} ({deltaPct}%)',
  sideBySideLeft: 'As currently in the pricing pool',
  sideBySideRight: "Reporter's claim",
  reporterMessage: "Reporter's message",
  evidenceHeader: 'Evidence · {N} files',
  evidenceZero:
    'Reporter provided no evidence beyond the claim. Consider `Request more info` before deciding.',
  relatedReports: 'Related reports on this comparable ({N})',
  marketImpactTitle: 'Market impact if removed',
  valuationsAffected: 'Valuations affected',
  medianMove: 'Median price move',
  maxMove: 'Max price move (single valuation)',
  marketsLabel: 'Valuations across markets',
  marketImpactNote:
    'Confirming and removing this comparable will trigger a recalculation job across the affected valuations. Reporter and comparable-owning agent will both be notified.',
  twoPersonBanner:
    'This is a high-market-impact removal. A second PA approval is required per two-person rule.',
  decisionTitle: 'Arbitration decision',
  confirmRemove: 'Confirm and remove',
  confirmQuarantine: 'Confirm and quarantine',
  quarantineHoursLabel: 'Quarantine window (hours)',
  quarantineHoursHelper: 'Default 72 hours. Min 24, max 168.',
  reject: 'Reject as invalid',
  requestInfo: 'Request more info',
  readConfirm: 'I have reviewed the evidence.',
  auditNote:
    'All decisions are audit-logged. Reasons and notes are shown to the reporter on their outcome inbox; the comparable-owning agent sees a courteous notice with appeal path on confirmed decisions.',
  ownCaseDecision:
    "You can't decide this report — you are the reporter or an agent at the comparable's agency.",
  alreadyDecided: 'This report has already been {status} by {decidedBy} on {decidedAt}.',
  confirmRemoveModal: {
    title: 'Remove this comparable from the pricing pool?',
    body: 'This comparable will be tombstoned and a recalculation job will re-run {N} affected valuations. The comparable-owning agency ({agencyName}) will be notified with an appeal path.',
    twoPerson:
      'This removal requires a second PA approval. Your reason will be visible to the second approver. Recalculation will NOT run until the second approval lands.',
    confirm: 'Remove now',
    propose: 'Propose removal',
    cancel: 'Cancel',
  },
  confirmQuarantineModal: {
    title: 'Quarantine this comparable?',
    body: 'This comparable will be held out of the pricing pool for {H} hours while {agencyName} corrects the row. Valuations will NOT re-run automatically; the row rejoins the pool automatically at the end of the window.',
    confirm: 'Quarantine for {H}h',
  },
  rejectModal: {
    title: 'Reject this report as invalid',
    reasonLabel: 'Reason (shown to the reporter)',
    notesLabel: 'Notes for the reporter (required)',
    confirm: 'Reject report',
  },
  requestInfoModal: {
    title: 'Request more info from the reporter',
    notesLabel: 'Notes for the reporter',
    confirm: 'Send request',
  },
  toastRemove: 'Removed comparable. Recalculating {N} valuations…',
  toastTwoPerson: 'Sent to PA-APR-001 for second approval. Recalculation will run when it lands.',
  toastQuarantine: 'Quarantined for {H}h. Comparable rejoins the pool automatically.',
  toastReject: 'Rejected report — {reason}.',
  toastRequestInfo: 'Sent info request to {reporterName}.',
  readConfirmError: 'Confirm you have reviewed the evidence before deciding.',
  notFound: 'Report not found or already withdrawn.',
  tabs: {
    affected: 'Affected valuations',
    audit: 'Audit trail',
    reporterHistory: 'Reporter history',
  },
  openInSource: 'Open in source ↗',
} as const

export const REASON_CATEGORY_OPTIONS = [
  { value: 'wrong_price', label: 'Wrong price', glyph: '▲' },
  { value: 'wrong_area', label: 'Wrong area', glyph: '▲' },
  { value: 'already_sold', label: 'Already sold', glyph: '◆' },
  { value: 'duplicate', label: 'Duplicate', glyph: '▢' },
  { value: 'spam', label: 'Spam', glyph: '✕' },
  { value: 'other', label: 'Other', glyph: '○' },
] as const

export const SEVERITY_OPTIONS = [
  { value: 'low', label: 'Low', glyph: '●' },
  { value: 'medium', label: 'Medium', glyph: '▲' },
  { value: 'high', label: 'High', glyph: '◆' },
  { value: 'critical', label: 'Critical', glyph: '✕' },
] as const

export const IMPACT_OPTIONS = [
  { value: 'none', label: 'None' },
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
] as const

export const REJECT_REASON_VOCAB = [
  { value: 'comparable_correct', label: 'Comparable is correct as reported' },
  { value: 'insufficient_evidence', label: 'Insufficient evidence' },
  { value: 'duplicate_resolved', label: 'Duplicate of a resolved report' },
  { value: 'vexatious_pattern', label: 'Vexatious pattern' },
  { value: 'out_of_scope', label: 'Out of scope' },
  { value: 'other', label: 'Other' },
] as const

export const REQUEST_INFO_REASON_VOCAB = [
  { value: 'attach_portal_url', label: 'Attach portal URL' },
  { value: 'attach_sale_record', label: 'Attach sale record' },
  { value: 'attach_photo', label: 'Attach photo evidence' },
  { value: 'clarify_field', label: 'Clarify which field is wrong' },
  { value: 'clarify_date', label: 'Clarify observation date' },
  { value: 'other', label: 'Other' },
] as const

export const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  confirmed_removed: 'Confirmed (removed)',
  confirmed_quarantined: 'Confirmed (quarantined)',
  rejected: 'Rejected',
  awaiting_info: 'Awaiting info',
  expired: 'Expired',
  pending_second_approval: 'Awaiting 2nd approval',
  REMOVE_PROPOSED: 'Removal proposed',
}
