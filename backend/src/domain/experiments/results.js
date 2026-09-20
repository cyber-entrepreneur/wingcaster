/**
 * Wave 2D — Experiment results from Conversions + frequentist significance.
 *
 * Never claims significance that was not computed. Bandit / sequential methods
 * are out of scope (NOT_CONFIGURED when requested).
 */

import { CONVERSION_EVENT_MAP } from '../attribution/constants.js'
import { listConversions } from '../attribution/conversions.js'
import {
  HOLDOUT_VARIANT,
  MIN_SAMPLE_FOR_SIGNIFICANCE,
} from './constants.js'
import { listAssignments, getExperiment, updateExperiment } from './repository.js'

/**
 * Two-proportion z-test (pooled). Returns null p/z when samples are insufficient.
 * Uses erfc approximation for two-sided p-value — no fabricated confidence.
 */
export function twoProportionZTest({
  successesA,
  trialsA,
  successesB,
  trialsB,
  minSample = MIN_SAMPLE_FOR_SIGNIFICANCE,
}) {
  const aOk = trialsA >= minSample
  const bOk = trialsB >= minSample
  const rateA = trialsA > 0 ? successesA / trialsA : null
  const rateB = trialsB > 0 ? successesB / trialsB : null
  const lift = rateA != null && rateB != null && rateB > 0
    ? (rateA - rateB) / rateB
    : rateA != null && rateB === 0 && rateA > 0
      ? null
      : rateA != null && rateB != null
        ? 0
        : null

  if (!aOk || !bOk) {
    return {
      rate_a: rateA,
      rate_b: rateB,
      lift,
      z: null,
      p_value: null,
      significant_at_95: false,
      confidence: null,
      reason: 'insufficient_sample',
      min_sample: minSample,
      trials_a: trialsA,
      trials_b: trialsB,
    }
  }

  const pPool = (successesA + successesB) / (trialsA + trialsB)
  const se = Math.sqrt(pPool * (1 - pPool) * (1 / trialsA + 1 / trialsB))
  if (!Number.isFinite(se) || se === 0) {
    return {
      rate_a: rateA,
      rate_b: rateB,
      lift: 0,
      z: 0,
      p_value: 1,
      significant_at_95: false,
      confidence: 0,
      reason: 'zero_variance',
      min_sample: minSample,
      trials_a: trialsA,
      trials_b: trialsB,
    }
  }

  const z = (rateA - rateB) / se
  const pValue = 2 * (1 - normalCdf(Math.abs(z)))
  // Wald 95% CI half-width on the rate difference
  const seDiff = Math.sqrt(
    (rateA * (1 - rateA)) / trialsA + (rateB * (1 - rateB)) / trialsB,
  )
  const ciHalf = 1.959963984540054 * seDiff
  const diff = rateA - rateB

  return {
    rate_a: rateA,
    rate_b: rateB,
    lift,
    z,
    p_value: pValue,
    significant_at_95: pValue < 0.05,
    confidence: 1 - pValue,
    diff,
    ci_95: [diff - ciHalf, diff + ciHalf],
    reason: 'two_proportion_z',
    min_sample: minSample,
    trials_a: trialsA,
    trials_b: trialsB,
  }
}

/** Standard normal CDF via erf approximation (Abramowitz & Stegun 7.1.26). */
export function normalCdf(x) {
  return 0.5 * (1 + erf(x / Math.SQRT2))
}

function erf(x) {
  const sign = x < 0 ? -1 : 1
  const ax = Math.abs(x)
  const a1 = 0.254829592
  const a2 = -0.284496736
  const a3 = 1.421413741
  const a4 = -1.453152027
  const a5 = 1.061405429
  const p = 0.3275911
  const t = 1 / (1 + p * ax)
  const y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-ax * ax)
  return sign * y
}

function resolveControlKey(experiment, assignmentCounts) {
  if ((assignmentCounts[HOLDOUT_VARIANT] || 0) > 0) return HOLDOUT_VARIANT
  const controlVariant = (experiment.variants || []).find((v) => v.is_control)
  if (controlVariant) return controlVariant.key
  const first = (experiment.variants || [])[0]
  return first?.key || null
}

/**
 * Compute per-variant funnel outcomes for an experiment's goal_event.
 */
export async function computeExperimentResults({
  experimentId,
  agencyId = null,
  agentId = null,
  persist = false,
} = {}) {
  const experiment = await getExperiment(experimentId, { agencyId, agentId })
  if (!experiment) {
    throw Object.assign(new Error('experiment not found'), { code: 'EXPERIMENT_NOT_FOUND' })
  }

  const mapping = CONVERSION_EVENT_MAP[experiment.goal_event]
  if (!mapping) {
    throw Object.assign(
      new Error(`goal_event ${experiment.goal_event} is not a known conversion event`),
      { code: 'INVALID_GOAL_EVENT' },
    )
  }

  const assignments = await listAssignments({ agencyId, agentId, experimentId })
  const conversions = await listConversions({
    agencyId,
    agentId,
    toStage: mapping.to_stage,
  })

  const assignedByContact = new Map()
  const counts = Object.create(null)
  for (const a of assignments) {
    assignedByContact.set(a.contact_id, a.variant)
    counts[a.variant] = (counts[a.variant] || 0) + 1
  }

  const goalByVariant = Object.create(null)
  let matchedConversions = 0
  for (const c of conversions) {
    if (!c.contact_id) continue
    const variant = assignedByContact.get(c.contact_id)
    if (!variant) continue
    // Prefer exact event_name match when present on conversion.data
    if (c.data?.event_name && c.data.event_name !== experiment.goal_event) continue
    goalByVariant[variant] = (goalByVariant[variant] || 0) + 1
    matchedConversions += 1
  }

  const controlKey = resolveControlKey(experiment, counts)
  const controlTrials = controlKey ? (counts[controlKey] || 0) : 0
  const controlSuccesses = controlKey ? (goalByVariant[controlKey] || 0) : 0

  const variantKeys = new Set([
    ...(experiment.variants || []).map((v) => v.key),
    ...Object.keys(counts),
  ])

  const perVariant = []
  for (const key of variantKeys) {
    const trials = counts[key] || 0
    const successes = goalByVariant[key] || 0
    const rate = trials > 0 ? successes / trials : null
    let vsControl = null
    if (controlKey && key !== controlKey) {
      vsControl = twoProportionZTest({
        successesA: successes,
        trialsA: trials,
        successesB: controlSuccesses,
        trialsB: controlTrials,
      })
    }
    perVariant.push({
      variant: key,
      assigned: trials,
      conversions: successes,
      conversion_rate: rate,
      is_control: key === controlKey,
      vs_control: vsControl,
    })
  }

  const result = {
    computed_at: new Date().toISOString(),
    method: 'frequentist_two_proportion_z',
    goal_event: experiment.goal_event,
    to_stage: mapping.to_stage,
    control_variant: controlKey,
    assignment_count: assignments.length,
    matched_conversions: matchedConversions,
    variants: perVariant,
    // Explicit: sequential / bandit significance not available at launch
    sequential: { code: 'NOT_CONFIGURED' },
    bandit: { code: 'NOT_CONFIGURED' },
  }

  if (persist) {
    await updateExperiment(experimentId, { result }, { agencyId, agentId })
  }

  return result
}

/**
 * Conclude an experiment: recompute results, optionally promote a winner.
 * Winner must be a real variant key (not fabricated).
 */
export async function concludeExperiment({
  experimentId,
  agencyId = null,
  agentId = null,
  winnerVariant = null,
  requireSignificance = false,
} = {}) {
  const results = await computeExperimentResults({
    experimentId,
    agencyId,
    agentId,
    persist: false,
  })

  let winner = winnerVariant
  if (!winner) {
    // Auto-pick best conversion_rate among non-control arms that are significant
    // only when requireSignificance; otherwise pick highest rate with assigned > 0.
    const candidates = results.variants.filter((v) => !v.is_control && v.assigned > 0)
    candidates.sort((a, b) => (b.conversion_rate || 0) - (a.conversion_rate || 0))
    if (requireSignificance) {
      const sig = candidates.find((v) => v.vs_control?.significant_at_95)
      winner = sig?.variant || null
    } else {
      winner = candidates[0]?.variant || null
    }
  }

  if (winner) {
    const known = results.variants.some((v) => v.variant === winner)
    if (!known) {
      throw Object.assign(new Error(`unknown winner variant: ${winner}`), {
        code: 'INVALID_WINNER',
      })
    }
  }

  const result = {
    ...results,
    concluded_at: new Date().toISOString(),
    winner_variant: winner,
    promotion: winner
      ? { promoted: true, variant: winner }
      : { promoted: false, reason: 'no_winner' },
  }

  const updated = await updateExperiment(
    experimentId,
    { status: 'concluded', result },
    { agencyId, agentId },
  )

  return { experiment: updated, results: result }
}
