/**
 * Wave 2D — Experimentation vocabularies.
 */

export const EXPERIMENT_DIMENSIONS = Object.freeze([
  'creative',
  'copy',
  'cta',
  'channel',
  'timing',
  'journey_path',
])

export const EXPERIMENT_ALLOCATIONS = Object.freeze(['even', 'bandit'])

export const EXPERIMENT_STATUSES = Object.freeze(['draft', 'running', 'concluded'])

/** Holdout bucket key — control receives the default / nothing. */
export const HOLDOUT_VARIANT = 'holdout'

/** Deterministic even-allocation model identity for ExperimentAssignment.model_version. */
export const EVEN_MODEL_VERSION = 'even-hash-v1'

/** Minimum assignments per arm before we report frequentist significance. */
export const MIN_SAMPLE_FOR_SIGNIFICANCE = 30
