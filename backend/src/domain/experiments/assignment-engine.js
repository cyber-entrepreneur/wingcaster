/**
 * Wave 2D — Assignment engine.
 *
 * even: deterministic stable hash of contact×experiment; honour holdout_pct;
 *       persist every assignment with reason + model_version.
 * bandit: pluggable interface; returns NOT_CONFIGURED (no fake result).
 */

import { createHash, randomUUID } from 'node:crypto'
import {
  EVEN_MODEL_VERSION,
  HOLDOUT_VARIANT,
} from './constants.js'
import {
  getAssignment,
  getExperiment,
  insertAssignment,
} from './repository.js'

/**
 * Stable 32-bit bucket in [0, 10000) from contact×experiment.
 */
export function hashBucket(experimentId, contactId) {
  const seed = `${experimentId}:${contactId || 'anon'}`
  const hash = createHash('sha256').update(seed).digest()
  return {
    holdoutBucket: hash.readUInt32BE(0) % 10000,
    variantBucket: hash.readUInt32BE(4) % 10000,
  }
}

/**
 * Pure even allocation. Holdout first; remaining mass split evenly across variants.
 */
export function computeEvenAssignment(experiment, contactId) {
  const variants = Array.isArray(experiment?.variants) ? experiment.variants : []
  const holdoutPct = Math.max(0, Math.min(100, Number(experiment?.holdout_pct) || 0))
  const { holdoutBucket, variantBucket } = hashBucket(experiment.id, contactId)

  if (holdoutPct > 0 && holdoutBucket < holdoutPct * 100) {
    return {
      variant: HOLDOUT_VARIANT,
      assignment_reason: 'holdout',
      model_version: EVEN_MODEL_VERSION,
      next: experiment?.data?.holdout_next ?? null,
    }
  }

  if (!variants.length) {
    throw Object.assign(new Error('experiment has no variants'), {
      code: 'INVALID_VARIANTS',
    })
  }

  // Even allocation ignores per-variant weights (allocation === 'even').
  const index = variantBucket % variants.length
  const chosen = variants[index]
  return {
    variant: chosen.key,
    assignment_reason: 'even',
    model_version: EVEN_MODEL_VERSION,
    next: chosen.next ?? null,
    variant_payload: chosen,
  }
}

/**
 * Bandit allocator interface — not configured at launch.
 */
export function computeBanditAssignment(_experiment, _contactId) {
  throw Object.assign(
    new Error('Bandit allocation is not configured'),
    { code: 'NOT_CONFIGURED' },
  )
}

export function computeAssignment(experiment, contactId) {
  if (!experiment?.id) {
    throw Object.assign(new Error('experiment required'), { code: 'INVALID_EXPERIMENT' })
  }
  if (experiment.allocation === 'bandit') {
    return computeBanditAssignment(experiment, contactId)
  }
  if (experiment.allocation !== 'even') {
    throw Object.assign(new Error(`unknown allocation: ${experiment.allocation}`), {
      code: 'INVALID_ALLOCATION',
    })
  }
  return computeEvenAssignment(experiment, contactId)
}

/**
 * Assign a contact to an experiment variant (idempotent on experiment×contact).
 * Replays the stored row on re-run so assignment is reproducible.
 */
export async function assignContact({
  experimentId,
  contactId,
  agencyId = null,
  agentId = null,
  experiment: provided = null,
} = {}) {
  if (!experimentId) {
    throw Object.assign(new Error('experimentId required'), { code: 'INVALID_EXPERIMENT' })
  }
  if (!contactId) {
    throw Object.assign(new Error('contactId required'), { code: 'INVALID_CONTACT' })
  }

  const existing = await getAssignment(experimentId, contactId, { agencyId, agentId })
  if (existing) {
    return {
      assignment: existing,
      created: false,
      replayed: true,
    }
  }

  const experiment = provided || await getExperiment(experimentId, { agencyId, agentId })
  if (!experiment) {
    throw Object.assign(new Error('experiment not found'), { code: 'EXPERIMENT_NOT_FOUND' })
  }
  if (experiment.status === 'draft') {
    throw Object.assign(new Error('experiment is draft; start it before assigning'), {
      code: 'EXPERIMENT_NOT_RUNNING',
    })
  }
  if (experiment.status === 'concluded') {
    throw Object.assign(new Error('experiment is concluded'), {
      code: 'EXPERIMENT_CONCLUDED',
    })
  }

  const computed = computeAssignment(experiment, contactId)
  const assignment = await insertAssignment({
    id: `exa_${randomUUID()}`,
    experiment_id: experimentId,
    contact_id: contactId,
    variant: computed.variant,
    assignment_reason: computed.assignment_reason,
    model_version: computed.model_version,
    data: {
      next: computed.next ?? null,
      variant_payload: computed.variant_payload || null,
    },
  }, { agencyId, agentId })

  return {
    assignment,
    created: true,
    replayed: false,
    next: computed.next ?? null,
    variant_payload: computed.variant_payload || null,
  }
}

/**
 * Resolve a creative variant for a contact under a creative-dimension experiment.
 */
export async function resolveAssignedCreativeVariant({
  experimentId,
  contactId,
  creativeId = null,
  agencyId = null,
  agentId = null,
  listVariants,
} = {}) {
  const { assignment, created, replayed, variant_payload } = await assignContact({
    experimentId,
    contactId,
    agencyId,
    agentId,
  })

  if (assignment.variant === HOLDOUT_VARIANT) {
    return {
      assignment,
      created,
      replayed,
      creative_variant_id: null,
      holdout: true,
    }
  }

  let creativeVariantId = variant_payload?.creative_variant_id
    || assignment.data?.variant_payload?.creative_variant_id
    || null

  if (!creativeVariantId && typeof listVariants === 'function' && creativeId) {
    const variants = await listVariants(creativeId, { agencyId, agentId })
    const match = (variants || []).find((v) =>
      v.experiment_id === experimentId
      && (
        v.label === assignment.variant
        || v.data?.variant_key === assignment.variant
        || v.id === assignment.variant
      ),
    )
    creativeVariantId = match?.id || null
  }

  return {
    assignment,
    created,
    replayed,
    creative_variant_id: creativeVariantId,
    holdout: false,
  }
}

/**
 * Build execution.data stamp so Events → Conversions can join back to variant.
 */
export function executionAssignmentStamp(assignment, extras = {}) {
  if (!assignment) return extras
  return {
    ...extras,
    experiment_id: assignment.experiment_id,
    experiment_assignment_id: assignment.id,
    experiment_variant: assignment.variant,
    assignment_reason: assignment.assignment_reason,
    model_version: assignment.model_version,
  }
}
