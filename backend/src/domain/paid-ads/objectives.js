/**
 * Wave 2A — paid ad objective validation + provider mapping.
 */

import {
  GOOGLE_DEMAND_GEN_FORMATS,
  GOOGLE_OBJECTIVE_MAP,
  META_OBJECTIVE_MAP,
  PAID_AD_OBJECTIVES,
} from './constants.js'

export function assertPaidAdObjective(objective) {
  if (!PAID_AD_OBJECTIVES.includes(objective)) {
    throw Object.assign(new Error(`Invalid paid ad objective: ${objective}`), {
      code: 'INVALID_PAID_AD_OBJECTIVE',
    })
  }
  return objective
}

export function mapObjectiveForProvider(platform, objective) {
  assertPaidAdObjective(objective)
  if (platform === 'meta_ads') return META_OBJECTIVE_MAP[objective]
  if (platform === 'google_ads') return GOOGLE_OBJECTIVE_MAP[objective]
  throw Object.assign(new Error(`Unsupported paid platform: ${platform}`), {
    code: 'UNSUPPORTED_PAID_PLATFORM',
  })
}

/**
 * Normalize targeting JSONB. audience_ref may mirror Execution.audience_id.
 * Google Gmail reach must use demand_gen_gmail — never an owned-email blast.
 */
export function normalizeTargeting(raw = {}, { audienceId = null } = {}) {
  const targeting = raw && typeof raw === 'object' && !Array.isArray(raw) ? { ...raw } : {}
  if (audienceId && !targeting.audience_ref) {
    targeting.audience_ref = audienceId
  }
  if (targeting.format != null) {
    const format = String(targeting.format)
    if (format === 'gmail' || format === 'owned_email' || format === 'email_blast') {
      throw Object.assign(
        new Error(
          'Gmail reach is Google Demand Gen (format=demand_gen_gmail), not an owned-email blast',
        ),
        { code: 'INVALID_GMAIL_FORMAT' },
      )
    }
    if (format.startsWith('demand_gen') && !GOOGLE_DEMAND_GEN_FORMATS.includes(format)) {
      throw Object.assign(new Error(`Unknown Demand Gen format: ${format}`), {
        code: 'INVALID_DEMAND_GEN_FORMAT',
      })
    }
  }
  return targeting
}

export function assertBudget(budgetMicros, currency) {
  const micros = Number(budgetMicros)
  if (!Number.isFinite(micros) || micros <= 0 || !Number.isInteger(micros)) {
    throw Object.assign(new Error('budget_micros must be a positive integer (micros)'), {
      code: 'INVALID_BUDGET',
    })
  }
  if (!currency || typeof currency !== 'string' || currency.length !== 3) {
    throw Object.assign(new Error('currency must be a 3-letter ISO code'), {
      code: 'INVALID_CURRENCY',
    })
  }
  return { budgetMicros: micros, currency: currency.toUpperCase() }
}
