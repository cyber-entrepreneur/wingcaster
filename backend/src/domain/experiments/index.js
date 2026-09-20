/**
 * Wave 2D — Experimentation (A/B/n + holdouts) public surface.
 */

export {
  EXPERIMENT_DIMENSIONS,
  EXPERIMENT_ALLOCATIONS,
  EXPERIMENT_STATUSES,
  HOLDOUT_VARIANT,
  EVEN_MODEL_VERSION,
  MIN_SAMPLE_FOR_SIGNIFICANCE,
} from './constants.js'

export {
  createExperiment,
  getExperiment,
  listExperiments,
  updateExperiment,
  getAssignment,
  listAssignments,
  insertAssignment,
} from './repository.js'

export {
  hashBucket,
  computeEvenAssignment,
  computeBanditAssignment,
  computeAssignment,
  assignContact,
  resolveAssignedCreativeVariant,
  executionAssignmentStamp,
} from './assignment-engine.js'

export {
  twoProportionZTest,
  normalCdf,
  computeExperimentResults,
  concludeExperiment,
} from './results.js'

export {
  startExperiment,
  resolveVariantForExecution,
  resolveJourneyExperimentNode,
} from './service.js'

export { registerExperimentRoutes } from './routes.js'
