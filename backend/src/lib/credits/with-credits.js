/**
 * withCredits helper — reserve, run work, consume (or release on failure).
 *
 * Accepts either `{ work }` or a second-argument callback (PR D spec shape).
 * Looks up credits_per_unit from metered_features. Unknown dotted codes
 * fail closed with FEATURE_NOT_REGISTERED so a missing registry row cannot
 * run at zero cost.
 */
import { query } from '../../db.js'
import { consume, release, reserve } from './engine.js'
import { CREDIT_ERROR, CreditEngineError } from './errors.js'
import { FEATURES } from './features.js'

const ENGINE_UNAVAILABLE_CODES = new Set([
  'ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND',
  '57P01', '57P03', '08006', '08001', '08003', '08004',
])

export async function loadAiCallCost({ tenantId, feature, relatedEntityId }) {
  const rows = await query(
    `SELECT COALESCE(SUM(cost_estimate_micro_usd), 0)::bigint AS qty
       FROM public.ai_call_usage
      WHERE ($1::text IS NULL OR tenant_id = $1)
        AND feature = $2
        AND ($3::text IS NULL OR related_entity_id = $3)`,
    [tenantId == null ? null : String(tenantId), feature, relatedEntityId || null],
  )
  const qty = Number(rows[0]?.qty || 0)
  return qty > 0 ? qty : null
}

function mapEngineFailure(error) {
  if (error instanceof CreditEngineError) return error
  if (ENGINE_UNAVAILABLE_CODES.has(error?.code) || error?.creditEngineUnavailable) {
    return new CreditEngineError(
      CREDIT_ERROR.CREDIT_ENGINE_UNAVAILABLE,
      error.message || 'Credit engine unavailable',
      { cause: error.code },
    )
  }
  return error
}

async function resolveCreditsAmount(feature, requested) {
  if (requested != null) return requested
  const rows = await query(
    `SELECT credits_per_unit, active FROM public.metered_features WHERE code = $1`,
    [feature],
  )
  const row = rows[0]
  if (!row) {
    if (feature === FEATURES.WHATSAPP_LISTINGS) return 1
    throw new CreditEngineError(
      CREDIT_ERROR.FEATURE_NOT_REGISTERED,
      `Feature ${feature} is not in metered_features`,
      { feature },
    )
  }
  if (!row.active) {
    throw new CreditEngineError(
      CREDIT_ERROR.FEATURE_NOT_REGISTERED,
      `Feature ${feature} is inactive`,
      { feature },
    )
  }
  return Number(row.credits_per_unit)
}

export async function withCredits(opts = {}, workFn) {
  const {
    tenantId,
    feature = FEATURES.WHATSAPP_LISTINGS,
    callType = 'default',
    requestId,
    creditsAmount: requestedAmount,
    relatedEntityType = null,
    relatedEntityId = null,
    work: namedWork,
    skipMetering = false,
    consumeOnFailure = null,
  } = opts
  const work = workFn || namedWork
  if (typeof work !== 'function') {
    throw new CreditEngineError(CREDIT_ERROR.INVALID_AMOUNT, 'withCredits requires a work callback')
  }
  if (skipMetering || !tenantId) {
    return work()
  }
  // Fast (no-DB) unit tests still call wrapped adapters. Production always
  // has DATABASE_URL; skip metering only when no database is configured.
  if (!process.env.DATABASE_URL && !process.env.TEST_DATABASE_URL) {
    return work()
  }

  let creditsAmount
  try {
    creditsAmount = await resolveCreditsAmount(feature, requestedAmount)
  } catch (error) {
    throw mapEngineFailure(error)
  }

  try {
    await reserve({ tenantId, feature, requestId, creditsAmount })
  } catch (error) {
    throw mapEngineFailure(error)
  }

  const shouldConsumeOnFailure = consumeOnFailure == null
    ? String(feature).startsWith('publishing.')
    : Boolean(consumeOnFailure)

  const settleConsume = async () => {
    const actualCostMicroUsd = await loadAiCallCost({
      tenantId,
      feature,
      relatedEntityId: relatedEntityId || requestId,
    })
    await consume({
      tenantId,
      feature,
      requestId,
      callType,
      creditsAmount,
      actualCostMicroUsd,
      relatedEntityType,
      relatedEntityId,
      data: {
        feature,
        call_type: callType,
        related_entity_id: relatedEntityId,
        related_entity_type: relatedEntityType,
        cost_estimate_micro_usd: actualCostMicroUsd,
      },
    })
  }

  try {
    const result = await work()
    await settleConsume()
    return result
  } catch (error) {
    if (shouldConsumeOnFailure) {
      await settleConsume().catch(() => release({ tenantId, feature, requestId }).catch(() => {}))
    } else {
      await release({ tenantId, feature, requestId }).catch(() => {})
    }
    throw mapEngineFailure(error)
  }
}

export { mapEngineFailure as mapCreditEngineFailure }
