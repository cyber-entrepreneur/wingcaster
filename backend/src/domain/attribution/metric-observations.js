/**
 * Wave 2C — metric_observations read helpers (spend/reach context).
 * Schema from Wave 0; no prior DAL. Always under withTenant.
 */

import { findAll } from '../../persistence/index.js'
import { withTenant } from '../../lib/growth-os/index.js'
import { SPEND_METRIC_NAMES } from './constants.js'

function mapRow(row) {
  if (!row) return null
  return {
    id: row.id,
    subject_type: row.subject_type,
    subject_id: row.subject_id,
    execution_id: row.execution_id,
    metric_name: row.metric_name,
    metric_value: row.metric_value != null ? Number(row.metric_value) : null,
    aggregation_type: row.aggregation_type,
    period_start: row.period_start,
    period_end: row.period_end,
    observed_at: row.observed_at,
    source: row.source,
    provider_ref: row.provider_ref,
    dimensions: row.dimensions,
    agency_id: row.agency_id,
    agent_id: row.agent_id,
    data: row.data,
  }
}

export async function listMetricObservations({
  agencyId = null,
  agentId = null,
  executionId = null,
  subjectType = null,
  subjectId = null,
  metricName = null,
} = {}) {
  if ((agencyId == null || agencyId === '') && (agentId == null || agentId === '')) {
    throw Object.assign(new Error('agencyId or agentId required'), {
      code: 'TENANT_SCOPE_REQUIRED',
    })
  }
  return withTenant(agencyId, agentId, async () => {
    const rows = await findAll('metric_observations', (row) => {
      if (agencyId != null && row.agency_id !== agencyId) return false
      if (agentId != null && row.agent_id !== agentId) return false
      if (executionId != null && row.execution_id !== executionId) return false
      if (subjectType != null && row.subject_type !== subjectType) return false
      if (subjectId != null && row.subject_id !== subjectId) return false
      if (metricName != null && row.metric_name !== metricName) return false
      return true
    })
    return rows.map(mapRow)
  })
}

/**
 * Latest cumulative spend (micros) per execution_id.
 */
export async function sumSpendMicrosForExecutions({
  agencyId = null,
  agentId = null,
  executionIds = [],
} = {}) {
  if (!executionIds?.length) return { total_micros: 0, by_execution: {} }
  const observations = await listMetricObservations({ agencyId, agentId })
  const spendNames = new Set(SPEND_METRIC_NAMES)
  const byExecution = {}

  for (const execId of executionIds) {
    const relevant = observations
      .filter(
        (o) =>
          o.execution_id === execId &&
          spendNames.has(o.metric_name) &&
          o.metric_value != null,
      )
      .sort((a, b) => {
        const ta = a.observed_at ? new Date(a.observed_at).getTime() : 0
        const tb = b.observed_at ? new Date(b.observed_at).getTime() : 0
        return tb - ta
      })

    if (!relevant.length) {
      byExecution[execId] = 0
      continue
    }

    // Prefer latest cumulative snapshot; otherwise sum gauges.
    const cumulatives = relevant.filter((o) => o.aggregation_type === 'cumulative')
    if (cumulatives.length) {
      byExecution[execId] = Number(cumulatives[0].metric_value) || 0
    } else {
      byExecution[execId] = relevant.reduce(
        (sum, o) => sum + (Number(o.metric_value) || 0),
        0,
      )
    }
  }

  const total = Object.values(byExecution).reduce((s, v) => s + v, 0)
  return { total_micros: total, by_execution: byExecution }
}
