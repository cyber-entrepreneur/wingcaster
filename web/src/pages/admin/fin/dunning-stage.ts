/** Mirrors backend dunning CHAIN in steps.js for PA-DUN-003 target preview. */
const DUNNING_CHAIN: Array<{ from: string; to: string; kind: string }> = [
  { from: 'OPEN', to: 'REMINDING', kind: 'REMIND' },
  { from: 'REMINDING', to: 'REMIND_ESCALATED', kind: 'REMIND_ESCALATED' },
  { from: 'REMIND_ESCALATED', to: 'CREDIT_PAUSED', kind: 'PAUSE_NEW_CREDIT' },
  { from: 'CREDIT_PAUSED', to: 'USAGE_SUSPENDED', kind: 'SUSPEND_USAGE' },
  { from: 'USAGE_SUSPENDED', to: 'LEGAL', kind: 'LEGAL_ESCALATION' },
  { from: 'LEGAL', to: 'WRITE_OFF_REVIEW', kind: 'WRITE_OFF_REVIEW' },
]

export function nextDunningStage(currentStatus: string | null | undefined) {
  const status = String(currentStatus || '')
  const step = DUNNING_CHAIN.find((entry) => entry.from === status)
  return step ? { status: step.to, kind: step.kind } : null
}

export function dunningStageWarning(targetStatus: string | null | undefined) {
  const status = String(targetStatus || '')
  if (status === 'CREDIT_PAUSED') {
    return 'Advancing to this stage pauses new credit purchases for the billing account.'
  }
  if (status === 'USAGE_SUSPENDED') {
    return 'Advancing to this stage suspends prepaid and postpaid usage for the tenant.'
  }
  return null
}
