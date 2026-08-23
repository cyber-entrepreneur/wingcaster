/**
 * Stage 13e quiet-period display helpers (DL-218 / DL-219). Pure; no I/O.
 * Recon CHECK constraint has no INFO severity — R098/R099 store LOW.
 */

export const QUIET_PERIOD_DAYS_REQUIRED = 90
export const STAGE_13F_ATTESTATION_FRESH_DAYS = 30

export const QUIET_PERIOD_KINDS = Object.freeze([
  'COMMERCIAL_WRITE_ATTEMPT',
  'COMMERCIAL_READ_MISMATCH',
  'PARITY_REPORT_NON_GREEN',
  'ATTESTATION_STALE_WARNING',
  'OTHER',
])

export function quietPeriodDaysElapsed(activatedAt, now) {
  if (!activatedAt || !now) return null
  const start = Date.parse(activatedAt)
  const end = Date.parse(now)
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null
  return Math.floor((end - start) / (24 * 60 * 60 * 1000))
}

export function r098Display(checkResult) {
  if (checkResult === 'DRIFT') return 'WARN'
  return 'GREEN'
}

export function r099Display(checkResult) {
  if (checkResult === 'DRIFT') return 'WARN'
  return 'GREEN'
}

export function readyForStage13f({
  mode = 'OFF',
  r097 = 'GREEN',
  r098 = 'GREEN',
  r099 = 'GREEN',
  attestationFresh = false,
} = {}) {
  return mode === 'FIN_ONLY'
    && r097 === 'GREEN'
    && r098 === 'GREEN'
    && r099 === 'GREEN'
    && Boolean(attestationFresh)
}
