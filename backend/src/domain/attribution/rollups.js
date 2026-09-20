/**
 * Wave 2C — campaign / execution rollups (funnel → commission → ROAS).
 * Keys off attribution credits' execution_id. Standalone executions
 * (campaign_id = NULL) roll up under execution — never fabricate a campaign.
 */

import { getExecution, listExecutions } from '../../lib/growth-os/index.js'
import { LAUNCH_ATTRIBUTION_MODELS, STAGE_TO_ROLLUP_KEY } from './constants.js'
import { listConversions } from './conversions.js'
import { listAttributionCredits, recomputeAttributionCredits } from './attribution-engine.js'
import { sumSpendMicrosForExecutions } from './metric-observations.js'

function emptyFunnel() {
  return {
    leads: 0,
    qualified: 0,
    viewings: 0,
    offers: 0,
    reservations: 0,
    transactions: 0,
    commissions: 0,
    gtv_micros: 0,
    commission_micros: 0,
    marketing_cost_micros: 0,
    roas: null,
    roi: null,
    currency: null,
  }
}

function applyConversionToFunnel(funnel, conversion, weight = 1) {
  const key = STAGE_TO_ROLLUP_KEY[conversion.to_stage]
  if (key) funnel[key] += weight

  if (conversion.to_stage === 'transaction' && conversion.value_micros != null) {
    funnel.gtv_micros += Number(conversion.value_micros) * weight
    if (conversion.currency) funnel.currency = conversion.currency
  }
  if (conversion.to_stage === 'commission' && conversion.value_micros != null) {
    funnel.commission_micros += Number(conversion.value_micros) * weight
    if (conversion.currency) funnel.currency = conversion.currency
  }
}

function finaliseEconomics(funnel) {
  const cost = funnel.marketing_cost_micros || 0
  const commission = funnel.commission_micros || 0
  if (cost > 0) {
    funnel.roas = commission / cost
    funnel.roi = (commission - cost) / cost
  } else {
    funnel.roas = null
    funnel.roi = null
  }
  return funnel
}

/**
 * Ensure credits exist for the requested model (recompute view without
 * mutating Conversions). data_driven returns NOT_CONFIGURED.
 */
async function ensureModelCredits({ agencyId, agentId, model, conversions }) {
  if (model === 'data_driven') {
    return { configured: false, code: 'NOT_CONFIGURED', credits: [] }
  }
  const credits = await listAttributionCredits({ agencyId, agentId, model })
  const have = new Set(credits.map((c) => c.conversion_id))
  for (const conversion of conversions) {
    if (!have.has(conversion.id)) {
      await recomputeAttributionCredits({
        conversionId: conversion.id,
        model,
        agencyId,
        agentId,
      })
    }
  }
  const refreshed = await listAttributionCredits({ agencyId, agentId, model })
  return { configured: true, code: null, credits: refreshed }
}

/**
 * Build performance rollups for a tenant under an attribution model.
 */
export async function getAttributionPerformance({
  agencyId = null,
  agentId = null,
  model = 'last',
  campaignId = null,
  executionId = null,
  ensureCredits = true,
} = {}) {
  if ((agencyId == null || agencyId === '') && (agentId == null || agentId === '')) {
    throw Object.assign(new Error('agencyId or agentId required'), {
      code: 'TENANT_SCOPE_REQUIRED',
    })
  }

  if (!LAUNCH_ATTRIBUTION_MODELS.includes(model) && model !== 'data_driven') {
    throw Object.assign(new Error(`Unknown attribution model: ${model}`), {
      code: 'UNKNOWN_ATTRIBUTION_MODEL',
    })
  }

  const conversions = await listConversions({ agencyId, agentId })
  const conversionById = new Map(conversions.map((c) => [c.id, c]))

  if (model === 'data_driven') {
    return {
      generated_at: new Date().toISOString(),
      agency_id: agencyId,
      agent_id: agentId,
      model,
      configured: false,
      code: 'NOT_CONFIGURED',
      overview: emptyFunnel(),
      by_campaign: [],
      by_execution: [],
      conversions: conversions.map((c) => ({
        id: c.id,
        contact_id: c.contact_id,
        from_stage: c.from_stage,
        to_stage: c.to_stage,
        occurred_at: c.occurred_at,
        value_micros: c.value_micros,
        currency: c.currency,
      })),
    }
  }

  let creditBundle
  if (ensureCredits) {
    creditBundle = await ensureModelCredits({
      agencyId,
      agentId,
      model,
      conversions,
    })
  } else {
    creditBundle = {
      configured: true,
      code: null,
      credits: await listAttributionCredits({ agencyId, agentId, model }),
    }
  }

  const credits = creditBundle.credits
  const executions = await listExecutions({ agencyId, agentId })
  const executionById = new Map(executions.map((e) => [e.id, e]))

  // Optionally filter credits by campaign / execution
  let filteredCredits = credits
  if (executionId) {
    filteredCredits = credits.filter((c) => c.execution_id === executionId)
  } else if (campaignId) {
    filteredCredits = credits.filter((c) => {
      const exec = executionById.get(c.execution_id)
      return exec?.campaign_id === campaignId
    })
  }

  const overview = emptyFunnel()
  const byCampaign = new Map()
  const byExecution = new Map()

  function bucketForCampaign(id) {
    if (!byCampaign.has(id)) {
      byCampaign.set(id, {
        campaign_id: id,
        ...emptyFunnel(),
        execution_ids: new Set(),
      })
    }
    return byCampaign.get(id)
  }

  function bucketForExecution(id, campaignIdValue) {
    if (!byExecution.has(id)) {
      byExecution.set(id, {
        execution_id: id,
        campaign_id: campaignIdValue ?? null,
        ...emptyFunnel(),
      })
    }
    return byExecution.get(id)
  }

  for (const credit of filteredCredits) {
    const conversion = conversionById.get(credit.conversion_id)
    if (!conversion) continue
    const weight = Number(credit.credit_weight) || 0
    const exec = executionById.get(credit.execution_id)
    const campId = exec?.campaign_id ?? null

    applyConversionToFunnel(overview, conversion, weight)

    const execBucket = bucketForExecution(credit.execution_id, campId)
    applyConversionToFunnel(execBucket, conversion, weight)

    if (campId != null) {
      const campBucket = bucketForCampaign(campId)
      applyConversionToFunnel(campBucket, conversion, weight)
      campBucket.execution_ids.add(credit.execution_id)
    }
  }

  // Spend / marketing cost from metric_observations on credited executions
  const allExecIds = [...new Set(filteredCredits.map((c) => c.execution_id))]
  const spend = await sumSpendMicrosForExecutions({
    agencyId,
    agentId,
    executionIds: allExecIds,
  })
  overview.marketing_cost_micros = spend.total_micros

  for (const [execId, bucket] of byExecution) {
    bucket.marketing_cost_micros = spend.by_execution[execId] || 0
    finaliseEconomics(bucket)
  }
  for (const [, bucket] of byCampaign) {
    let cost = 0
    for (const execId of bucket.execution_ids) {
      cost += spend.by_execution[execId] || 0
    }
    bucket.marketing_cost_micros = cost
    delete bucket.execution_ids
    finaliseEconomics(bucket)
  }
  finaliseEconomics(overview)

  return {
    generated_at: new Date().toISOString(),
    agency_id: agencyId,
    agent_id: agentId,
    model,
    configured: true,
    code: null,
    overview,
    by_campaign: [...byCampaign.values()],
    by_execution: [...byExecution.values()],
    conversions: conversions.map((c) => ({
      id: c.id,
      contact_id: c.contact_id,
      from_stage: c.from_stage,
      to_stage: c.to_stage,
      occurred_at: c.occurred_at,
      value_micros: c.value_micros,
      currency: c.currency,
    })),
  }
}

/**
 * Causal drill-down for one conversion: touchpoints + credits per model.
 */
export async function getConversionAttributionChain({
  conversionId,
  agencyId = null,
  agentId = null,
  model = 'last',
} = {}) {
  const conversion = (await listConversions({ agencyId, agentId })).find(
    (c) => c.id === conversionId,
  )
  if (!conversion) {
    // try direct get
    const { getConversion } = await import('./conversions.js')
    const c = await getConversion(conversionId, { agencyId, agentId })
    if (!c) {
      throw Object.assign(new Error(`Conversion not found: ${conversionId}`), {
        code: 'CONVERSION_NOT_FOUND',
      })
    }
    return buildChain(c, { agencyId, agentId, model })
  }
  return buildChain(conversion, { agencyId, agentId, model })
}

async function buildChain(conversion, { agencyId, agentId, model }) {
  const {
    gatherTouchpointExecutionIds,
    recomputeAttributionCredits,
    listAttributionCredits,
  } = await import('./attribution-engine.js')

  const touchpoints = await gatherTouchpointExecutionIds(conversion, {
    agencyId,
    agentId,
  })

  let creditResult
  if (model === 'data_driven') {
    creditResult = {
      configured: false,
      code: 'NOT_CONFIGURED',
      credits: [],
    }
  } else {
    creditResult = await recomputeAttributionCredits({
      conversionId: conversion.id,
      model,
      agencyId,
      agentId,
      executionIds: touchpoints,
    })
  }

  const executions = []
  for (const execId of touchpoints) {
    const exec = await getExecution(execId, { agencyId, agentId })
    executions.push(
      exec
        ? {
            id: exec.id,
            kind: exec.kind,
            status: exec.status,
            campaign_id: exec.campaign_id ?? null,
            subject_type: exec.subject_type,
            subject_id: exec.subject_id,
          }
        : { id: execId, kind: null, status: null, campaign_id: null },
    )
  }

  const allCredits = await listAttributionCredits({
    agencyId,
    agentId,
    conversionId: conversion.id,
  })

  return {
    conversion,
    model,
    configured: creditResult.configured !== false,
    code: creditResult.code || null,
    touchpoint_execution_ids: touchpoints,
    executions,
    credits: creditResult.credits || [],
    credits_by_model: groupCreditsByModel(allCredits),
  }
}

function groupCreditsByModel(credits) {
  const out = {}
  for (const c of credits) {
    if (!out[c.model]) out[c.model] = []
    out[c.model].push(c)
  }
  return out
}
