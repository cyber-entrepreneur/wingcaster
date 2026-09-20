/**
 * Wave 2A — cumulative ad metrics → metric_observations (never events).
 */

import { randomUUID } from 'node:crypto'
import { insert } from '../../persistence/index.js'
import { withTenant } from '../../lib/growth-os/index.js'

function prefixedId(prefix) {
  return `${prefix}${randomUUID()}`
}

/**
 * Record a cumulative/gauge metric snapshot for a paid execution.
 */
export async function recordPaidMetricObservation({
  agencyId = null,
  agentId = null,
  executionId = null,
  subjectType = 'execution',
  subjectId = null,
  metricName,
  metricValue,
  aggregationType = 'cumulative',
  periodStart = null,
  periodEnd = null,
  observedAt = null,
  source = 'paid_ads',
  providerRef = null,
  dimensions = {},
  data = {},
} = {}) {
  if ((agencyId == null || agencyId === '') && (agentId == null || agentId === '')) {
    throw Object.assign(new Error('agencyId or agentId required'), {
      code: 'TENANT_SCOPE_REQUIRED',
    })
  }
  if (!metricName) {
    throw Object.assign(new Error('metricName is required'), { code: 'MISSING_METRIC_NAME' })
  }
  if (metricValue == null || !Number.isFinite(Number(metricValue))) {
    throw Object.assign(new Error('metricValue must be a finite number'), {
      code: 'INVALID_METRIC_VALUE',
    })
  }
  if (!['cumulative', 'gauge'].includes(aggregationType)) {
    throw Object.assign(new Error(`Invalid aggregation_type: ${aggregationType}`), {
      code: 'INVALID_AGGREGATION_TYPE',
    })
  }

  const now = observedAt || new Date().toISOString()
  return withTenant(agencyId, agentId, () =>
    insert('metric_observations', {
      id: prefixedId('mobs_'),
      subject_type: subjectType,
      subject_id: subjectId || executionId,
      execution_id: executionId,
      metric_name: metricName,
      metric_value: Math.trunc(Number(metricValue)),
      aggregation_type: aggregationType,
      period_start: periodStart,
      period_end: periodEnd,
      observed_at: now,
      source,
      provider_ref: providerRef,
      dimensions,
      agency_id: agencyId,
      agent_id: agentId,
      data,
    }),
  )
}
