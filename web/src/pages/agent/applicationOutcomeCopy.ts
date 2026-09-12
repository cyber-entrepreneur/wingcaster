/**
 * English copy for AGT-REC-004 (brief §Explicit copy).
 * Arabic mirrors marked [TRANSLATION-PENDING] at call sites when locale=ar.
 */

export const APPLICATION_OUTCOME_COPY = {
  navTitle: 'Application status',
  contactSupport: 'Something not right? Contact WingCaster support',
  notFoundTitle: "This application doesn't exist or isn't yours.",
  notFoundCta: 'Go back to inbox',
  networkTitle: 'Check your connection.',
  networkRetry: 'Retry',
  offlineBanner: "You're offline — some actions won't work.",
  liveUpdateAnnounce: (status: string) => `Application status changed to ${status}.`,
  toastUpdated: 'Application updated',
  toastAcceptFailed: 'Could not switch workspace. Try again.',
  toastWithdrawn: 'Application withdrawn',
  toastDeclined: 'Offer declined',
  switchingWorkspace: 'Switching workspace…',
  awaitingChip: 'Awaiting agency response',
  resolverEmpty: 'No message provided.',
  timelineSubmitted: 'Submitted',
  timelineViewed: 'Viewed by agency',
  timelineViewedEmpty: 'Not yet viewed',
  timelineDecided: 'Decided',
  timelineDecidedPending: 'Awaiting decision',
  timelineApproved: 'Approved',
  timelineRejected: 'Declined',
  timelineExpired: 'Timed out',
  timelineWithdrawn: 'Withdrawn',
  timelineAgencyRemoved: 'Agency removed',
  pendingReassurance: (agency: string) =>
    `We'll notify you the moment ${agency} decides.`,
  pendingSla: (slaDays: number, expiresOn: string) =>
    `Typical review: ${slaDays} days · Application expires ${expiresOn}`,
  rejectedEncouragement:
    'The MENA market is wide open. Other agencies may be a better fit — or you can start solo and revisit later.',
  expiredDetail:
    'This application timed out after 30 days without a response. You can re-apply or explore other agencies.',
  withdrawnDetail: (date: string) =>
    `You withdrew this application on ${date}. You can re-apply or explore other agencies.`,
  declinedAttribution: (date: string) => `You declined on ${date}`,
  agencySuspended: (agency: string) =>
    `${agency} is temporarily suspended. WingCaster support is reviewing.`,
  agencyDeleted: 'The agency you applied to no longer exists on WingCaster.',
  approvedRoleLine: (role: string, pack: string) =>
    `You'll join as ${role} with the ${pack} capability pack.`,
  approvedExclusive: (agency: string) =>
    `This is an exclusive affiliation. Your personal workspace stays, but your listings and leads flow to ${agency}.`,
  approvedNonExclusive:
    'This is a non-exclusive affiliation. Your personal workspace stays independent; you can be with other agencies at the same time.',
  approvedTenantNote: (agency: string) =>
    `When you switch, this browser will land in ${agency} until you switch back via the workspace menu.`,
  contextHelperApproved: (agency: string) =>
    `When you accept, your workspace switches to ${agency}. Your personal tenant remains, but this browser will land in ${agency} until you switch back via the tenant menu.`,
  contextHelperPending: (agency: string) =>
    `${agency} typically reviews applications within a few days. You can withdraw anytime and re-apply later.`,
  contextHelperRejected:
    'Rejection is a decision about fit right now — not about your career. Browse other agencies or keep building in your personal workspace.',
  contextHelperExpired:
    'No response arrived before the 30-day window closed. Re-apply to the same agency or explore alternatives.',
  contextHelperWithdrawn:
    'You closed this application. You can start a fresh application anytime.',
  heroPending: (agency: string) => `Awaiting ${agency}'s response`,
  heroApproved: (agency: string) => `You've been accepted by ${agency}`,
  heroRejected: (agency: string) =>
    `${agency} decided not to proceed at this time`,
  heroExpired: 'This application timed out',
  heroWithdrawn: 'You withdrew this application',
  ctaSwitch: (agency: string) => `Switch to ${agency} workspace`,
  ctaBrowse: 'Browse other agencies',
  ctaReapply: (agency: string) => `Re-apply to ${agency}`,
  ctaSolo: 'Continue as solo agent',
  ctaViewProfile: 'View agency profile',
  ctaWithdraw: 'Withdraw application',
  ctaDecline: 'Decline this offer',
  ctaContactSupport: 'Contact WingCaster support',
  withdrawTitle: 'Withdraw your application?',
  withdrawBody: (agency: string) =>
    `You can re-apply to ${agency} anytime, but they'll see this as a fresh application.`,
  withdrawConfirm: 'Withdraw',
  withdrawCancel: 'Keep application open',
  declineTitle: (agency: string) => `Decline ${agency}'s offer?`,
  declineBody: (agency: string) =>
    `You can apply again in future. If you decline now, ${agency}'s decision is final for this application.`,
  declineConfirm: 'Decline offer',
  declineCancel: 'Not yet',
  agencyCardExpandAria: (agency: string) => `View ${agency}'s public profile`,
  celebratoryBanner: (agency: string) => `You're now with ${agency}. Welcome.`,
  smallPrintAppId: 'Application ID',
  smallPrintApplied: 'Applied',
  smallPrintDecided: 'Decided',
} as const
