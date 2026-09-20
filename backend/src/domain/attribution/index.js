/**
 * Wave 2C — Attribution & Commission Engine public surface.
 */

export {
  FUNNEL_STAGES,
  CONVERSION_EVENT_MAP,
  ATTRIBUTION_MODELS,
  LAUNCH_ATTRIBUTION_MODELS,
  STAGE_TO_ROLLUP_KEY,
  SPEND_METRIC_NAMES,
} from './constants.js'

export {
  majorToMicros,
  readDealEconomics,
  listDealEconomics,
  attestTransactionClosed,
  attestCommissionEarned,
  resolveAttestedValueFromEvent,
} from './finance-attest.js'

export {
  isConversionEvent,
  materialiseConversionFromEvent,
  materialiseConversionsForTenant,
  getConversion,
  listConversions,
} from './conversions.js'

export {
  gatherTouchpointExecutionIds,
  computeCreditWeights,
  recomputeAttributionCredits,
  attributeConversions,
  listAttributionCredits,
} from './attribution-engine.js'

export {
  listMetricObservations,
  sumSpendMicrosForExecutions,
} from './metric-observations.js'

export {
  getAttributionPerformance,
  getConversionAttributionChain,
} from './rollups.js'

export { registerAttributionRoutes } from './routes.js'
