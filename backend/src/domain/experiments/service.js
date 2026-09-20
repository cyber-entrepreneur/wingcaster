/**
 * Wave 2D — Experiment service orchestration.
 */

import { CONVERSION_EVENT_MAP } from '../attribution/constants.js'
import { listVariantsForCreative } from '../creative/repository.js'
import {
  assignContact,
  executionAssignmentStamp,
  resolveAssignedCreativeVariant,
} from './assignment-engine.js'
import {
  createExperiment,
  getExperiment,
  listExperiments,
  updateExperiment,
  listAssignments,
} from './repository.js'
import { computeExperimentResults, concludeExperiment } from './results.js'
import { EXPERIMENT_STATUSES } from './constants.js'

export async function startExperiment(id, { agencyId, agentId }) {
  const experiment = await getExperiment(id, { agencyId, agentId })
  if (!experiment) {
    throw Object.assign(new Error('experiment not found'), { code: 'EXPERIMENT_NOT_FOUND' })
  }
  if (experiment.status === 'concluded') {
    throw Object.assign(new Error('cannot restart a concluded experiment'), {
      code: 'EXPERIMENT_CONCLUDED',
    })
  }
  if (!CONVERSION_EVENT_MAP[experiment.goal_event]) {
    throw Object.assign(
      new Error(`goal_event ${experiment.goal_event} is not a known conversion event`),
      { code: 'INVALID_GOAL_EVENT' },
    )
  }
  return updateExperiment(id, { status: 'running' }, { agencyId, agentId })
}

/**
 * Resolve variant for an Execution / creative send path.
 * Stamps experiment fields for Event → Conversion join via execution_id.
 */
export async function resolveVariantForExecution({
  experimentId,
  contactId,
  creativeId = null,
  agencyId = null,
  agentId = null,
  baseData = {},
} = {}) {
  if (!experimentId) {
    return { assignment: null, data: baseData, creative_variant_id: null, holdout: false }
  }

  const experiment = await getExperiment(experimentId, { agencyId, agentId })
  if (!experiment) {
    throw Object.assign(new Error('experiment not found'), { code: 'EXPERIMENT_NOT_FOUND' })
  }

  if (experiment.dimension === 'creative' || experiment.dimension === 'copy' || experiment.dimension === 'cta') {
    const resolved = await resolveAssignedCreativeVariant({
      experimentId,
      contactId,
      creativeId,
      agencyId,
      agentId,
      listVariants: listVariantsForCreative,
    })
    return {
      assignment: resolved.assignment,
      creative_variant_id: resolved.creative_variant_id,
      holdout: resolved.holdout,
      data: executionAssignmentStamp(resolved.assignment, baseData),
    }
  }

  const { assignment } = await assignContact({
    experimentId,
    contactId,
    agencyId,
    agentId,
    experiment,
  })
  return {
    assignment,
    creative_variant_id: null,
    holdout: assignment.variant === 'holdout',
    data: executionAssignmentStamp(assignment, baseData),
  }
}

/**
 * Journey experiment node: prefer persisted experiment when experiment_id set.
 */
export async function resolveJourneyExperimentNode({
  nodeConfig,
  contactId,
  agencyId = null,
  agentId = null,
  fallbackAssign,
} = {}) {
  const experimentId = nodeConfig?.experiment_id
  if (!experimentId) {
    if (typeof fallbackAssign !== 'function') {
      throw Object.assign(new Error('experiment_id or fallbackAssign required'), {
        code: 'INVALID_EXPERIMENT',
      })
    }
    const local = fallbackAssign(nodeConfig, contactId)
    return {
      variant: local.variant,
      next: local.next,
      assignment_reason: local.assignment_reason,
      model_version: null,
      assignment: null,
      persisted: false,
      experiment_id: null,
    }
  }

  const { assignment, next, variant_payload } = await assignContact({
    experimentId,
    contactId,
    agencyId,
    agentId,
  })

  // Prefer next from variant payload / assignment data; else node-config match
  let resolvedNext = next
    ?? assignment.data?.next
    ?? variant_payload?.next
    ?? null
  if (!resolvedNext && Array.isArray(nodeConfig?.variants)) {
    const match = nodeConfig.variants.find((v) => (v.key || v.id || v.name) === assignment.variant)
    resolvedNext = match?.next || null
  }
  if (assignment.variant === 'holdout') {
    resolvedNext = resolvedNext || nodeConfig?.holdout_next || null
  }

  return {
    variant: assignment.variant,
    next: resolvedNext,
    assignment_reason: assignment.assignment_reason,
    model_version: assignment.model_version,
    assignment,
    persisted: true,
    experiment_id: experimentId,
  }
}

export {
  createExperiment,
  getExperiment,
  listExperiments,
  updateExperiment,
  listAssignments,
  assignContact,
  computeExperimentResults,
  concludeExperiment,
  EXPERIMENT_STATUSES,
}
