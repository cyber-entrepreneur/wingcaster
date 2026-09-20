/**
 * Wave 2C — Attribution engine.
 * Per Conversion, gather touchpoint Executions and write AttributionCredits.
 * Re-runnable: recomputing a model rewrites only that model's credit rows.
 */

import { randomUUID } from 'node:crypto'
import { findAll, insert, query, remove } from '../../persistence/index.js'
import { listEvents, withTenant } from '../../lib/growth-os/index.js'
import {
  ATTRIBUTION_MODELS,
  LAUNCH_ATTRIBUTION_MODELS,
} from './constants.js'
import { getConversion } from './conversions.js'

function prefixedId(prefix) {
  return `${prefix}${randomUUID()}`
}

function mapCreditRow(row) {
  if (!row) return null
  return {
    id: row.id,
    conversion_id: row.conversion_id,
    execution_id: row.execution_id,
    model: row.model,
    credit_weight: row.credit_weight != null ? Number(row.credit_weight) : null,
    agency_id: row.agency_id,
    agent_id: row.agent_id,
    data: row.data,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

/**
 * Ordered unique execution_ids that touched the contact/correlation before conversion.
 * execution_id is the attribution key — campaign_id may be NULL (P1).
 */
export async function gatherTouchpointExecutionIds(conversion, {
  agencyId = null,
  agentId = null,
} = {}) {
  const tenantAgencyId = agencyId ?? conversion.agency_id ?? null
  const tenantAgentId = agentId ?? conversion.agent_id ?? null
  const correlationId = conversion.data?.correlation_id || null
  const contactId = conversion.contact_id || null
  const occurredAt = conversion.occurred_at ? new Date(conversion.occurred_at).getTime() : null

  const events = await listEvents({
    agencyId: tenantAgencyId,
    agentId: tenantAgentId,
    contactId: contactId || undefined,
    correlationId: correlationId || undefined,
  })

  // If both filters were applied narrowly and yielded nothing, broaden to contact OR correlation.
  let candidates = events
  if (candidates.length === 0 && (contactId || correlationId)) {
    const all = await listEvents({
      agencyId: tenantAgencyId,
      agentId: tenantAgentId,
    })
    candidates = all.filter((e) => {
      if (contactId && e.contact_id === contactId) return true
      if (correlationId && e.correlation_id === correlationId) return true
      return false
    })
  }

  const touchCategories = new Set(['engagement', 'delivery', 'business', 'system'])
  const sorted = candidates
    .filter((e) => {
      if (!e.execution_id) return false
      if (!touchCategories.has(e.event_category)) return false
      if (occurredAt != null) {
        const t = e.occurred_at ? new Date(e.occurred_at).getTime() : 0
        if (t > occurredAt) return false
      }
      return true
    })
    .sort((a, b) => {
      const ta = a.occurred_at ? new Date(a.occurred_at).getTime() : 0
      const tb = b.occurred_at ? new Date(b.occurred_at).getTime() : 0
      return ta - tb
    })

  const seen = new Set()
  const ordered = []
  for (const e of sorted) {
    if (seen.has(e.execution_id)) continue
    seen.add(e.execution_id)
    ordered.push(e.execution_id)
  }

  // Fallback: conversion's own linked execution (if any)
  const ownExec = conversion.data?.execution_id
  if (ownExec && !seen.has(ownExec)) {
    ordered.push(ownExec)
  }

  return ordered
}

/**
 * Compute credit weights for a model. Returns [] for data_driven (NOT_CONFIGURED).
 */
export function computeCreditWeights(executionIds, model) {
  if (!ATTRIBUTION_MODELS.includes(model)) {
    throw Object.assign(new Error(`Unknown attribution model: ${model}`), {
      code: 'UNKNOWN_ATTRIBUTION_MODEL',
    })
  }
  if (model === 'data_driven') {
    return { configured: false, code: 'NOT_CONFIGURED', weights: [] }
  }

  const ids = Array.isArray(executionIds) ? executionIds.filter(Boolean) : []
  if (ids.length === 0) {
    return { configured: true, code: null, weights: [] }
  }

  if (model === 'last') {
    return {
      configured: true,
      code: null,
      weights: [{ execution_id: ids[ids.length - 1], credit_weight: 1 }],
    }
  }
  if (model === 'first') {
    return {
      configured: true,
      code: null,
      weights: [{ execution_id: ids[0], credit_weight: 1 }],
    }
  }
  if (model === 'linear') {
    const w = 1 / ids.length
    return {
      configured: true,
      code: null,
      weights: ids.map((execution_id) => ({ execution_id, credit_weight: w })),
    }
  }
  if (model === 'position') {
    if (ids.length === 1) {
      return {
        configured: true,
        code: null,
        weights: [{ execution_id: ids[0], credit_weight: 1 }],
      }
    }
    if (ids.length === 2) {
      return {
        configured: true,
        code: null,
        weights: [
          { execution_id: ids[0], credit_weight: 0.5 },
          { execution_id: ids[1], credit_weight: 0.5 },
        ],
      }
    }
    const middle = ids.slice(1, -1)
    const midEach = 0.2 / middle.length
    return {
      configured: true,
      code: null,
      weights: [
        { execution_id: ids[0], credit_weight: 0.4 },
        ...middle.map((execution_id) => ({ execution_id, credit_weight: midEach })),
        { execution_id: ids[ids.length - 1], credit_weight: 0.4 },
      ],
    }
  }

  return { configured: false, code: 'NOT_CONFIGURED', weights: [] }
}

/**
 * Recompute AttributionCredits for one Conversion + model.
 * Never mutates the Conversion row.
 */
export async function recomputeAttributionCredits({
  conversionId,
  model,
  agencyId = null,
  agentId = null,
  executionIds = null,
} = {}) {
  if (!conversionId) {
    throw Object.assign(new Error('conversionId is required'), {
      code: 'MISSING_CONVERSION_ID',
    })
  }
  if (!model) {
    throw Object.assign(new Error('model is required'), {
      code: 'MISSING_ATTRIBUTION_MODEL',
    })
  }

  const conversion = await getConversion(conversionId, { agencyId, agentId })
  if (!conversion) {
    throw Object.assign(new Error(`Conversion not found: ${conversionId}`), {
      code: 'CONVERSION_NOT_FOUND',
    })
  }

  const tenantAgencyId = agencyId ?? conversion.agency_id ?? null
  const tenantAgentId = agentId ?? conversion.agent_id ?? null

  const touchpoints =
    executionIds ||
    (await gatherTouchpointExecutionIds(conversion, {
      agencyId: tenantAgencyId,
      agentId: tenantAgentId,
    }))

  const computed = computeCreditWeights(touchpoints, model)
  if (!computed.configured) {
    // Clear any stale rows for this model; do not invent credits.
    await withTenant(tenantAgencyId, tenantAgentId, async () => {
      const existing = await findAll(
        'attribution_credits',
        (row) => row.conversion_id === conversionId && row.model === model,
      )
      for (const row of existing) {
        await remove('attribution_credits', (r) => r.id === row.id)
      }
    })
    return {
      conversion_id: conversionId,
      model,
      configured: false,
      code: computed.code || 'NOT_CONFIGURED',
      credits: [],
      touchpoint_execution_ids: touchpoints,
    }
  }

  return withTenant(tenantAgencyId, tenantAgentId, async () => {
    // Delete only this model's credit rows (re-runnable).
    await query(
      `DELETE FROM public.attribution_credits
        WHERE conversion_id = $1 AND model = $2`,
      [conversionId, model],
    )

    const credits = []
    for (const w of computed.weights) {
      const row = await insert('attribution_credits', {
        id: prefixedId('acr_'),
        conversion_id: conversionId,
        execution_id: w.execution_id,
        model,
        credit_weight: w.credit_weight,
        agency_id: tenantAgencyId,
        agent_id: tenantAgentId,
        data: {},
      })
      credits.push(mapCreditRow(row))
    }

    return {
      conversion_id: conversionId,
      model,
      configured: true,
      code: null,
      credits,
      touchpoint_execution_ids: touchpoints,
    }
  })
}

/**
 * Attribute all conversions for a tenant under one or more models.
 */
export async function attributeConversions({
  agencyId = null,
  agentId = null,
  conversionIds = null,
  models = LAUNCH_ATTRIBUTION_MODELS,
} = {}) {
  if ((agencyId == null || agencyId === '') && (agentId == null || agentId === '')) {
    throw Object.assign(new Error('agencyId or agentId required'), {
      code: 'TENANT_SCOPE_REQUIRED',
    })
  }

  const { listConversions } = await import('./conversions.js')
  let conversions
  if (Array.isArray(conversionIds) && conversionIds.length) {
    conversions = []
    for (const id of conversionIds) {
      const c = await getConversion(id, { agencyId, agentId })
      if (c) conversions.push(c)
    }
  } else {
    conversions = await listConversions({ agencyId, agentId })
  }

  const modelList = (Array.isArray(models) ? models : [models]).filter(Boolean)
  const results = []
  for (const conversion of conversions) {
    for (const model of modelList) {
      results.push(
        await recomputeAttributionCredits({
          conversionId: conversion.id,
          model,
          agencyId,
          agentId,
        }),
      )
    }
  }
  return results
}

export async function listAttributionCredits({
  agencyId = null,
  agentId = null,
  conversionId = null,
  executionId = null,
  model = null,
} = {}) {
  if ((agencyId == null || agencyId === '') && (agentId == null || agentId === '')) {
    throw Object.assign(new Error('agencyId or agentId required'), {
      code: 'TENANT_SCOPE_REQUIRED',
    })
  }
  return withTenant(agencyId, agentId, async () => {
    const rows = await findAll('attribution_credits', (row) => {
      if (agencyId != null && row.agency_id !== agencyId) return false
      if (agentId != null && row.agent_id !== agentId) return false
      if (conversionId != null && row.conversion_id !== conversionId) return false
      if (executionId != null && row.execution_id !== executionId) return false
      if (model != null && row.model !== model) return false
      return true
    })
    return rows.map(mapCreditRow)
  })
}

export { mapCreditRow, LAUNCH_ATTRIBUTION_MODELS, ATTRIBUTION_MODELS }
