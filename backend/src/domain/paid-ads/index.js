/**
 * Wave 2A — Paid ads (Meta + Google Demand Gen) public surface.
 */

export { registerPaidAdsRoutes } from './routes.js'
export {
  PAID_PLATFORMS,
  PAID_AD_OBJECTIVES,
  GOOGLE_DEMAND_GEN_FORMATS,
  PAID_FEATURE_CODES,
  PROVIDER_NOT_APPROVED,
  PAID_CHANNEL_KIND,
  PAID_EXECUTION_KIND,
  META_OBJECTIVE_MAP,
  GOOGLE_OBJECTIVE_MAP,
} from './constants.js'
export {
  isProviderApproved,
  assertProviderApproved,
  providerApprovalState,
} from './approval.js'
export {
  assertPaidAdObjective,
  mapObjectiveForProvider,
  normalizeTargeting,
  assertBudget,
} from './objectives.js'
export { createPaidAdsAdapter } from './adapters/index.js'
export { MetaAdsAdapter } from './adapters/meta-ads.js'
export { GoogleAdsAdapter } from './adapters/google-ads.js'
export {
  ensurePaidChannelDefinitions,
  connectPaidChannel,
  listPaidChannelStatus,
} from './channels.js'
export {
  createPaidAdExecution,
  launchPaidAdExecution,
  listPaidAdExecutions,
  getPaidAdExecution,
  listPaidAdEvents,
} from './service.js'
export { recordPaidMetricObservation } from './metrics.js'
export { resolvePaidCredentials } from './credentials.js'
