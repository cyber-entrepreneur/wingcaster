/**
 * Growth-OS Wave 0 — public access surface for later waves.
 */

export { withTenant } from './with-tenant.js'

export {
  ensureChannelDefinition,
  createChannelConnection,
  getChannelConnection,
  listChannelConnections,
  resolveCapabilities,
  updateChannelConnectionHealth,
  CHANNEL_KINDS,
  CONNECTION_HEALTH,
} from './channels.js'

export {
  createExecution,
  scheduleExecution,
  transitionExecution,
  getExecution,
  listExecutions,
  recordExecutionAttempt,
  EXECUTION_KINDS,
  EXECUTION_STATUSES,
  TRANSITIONS,
  RESCHEDULABLE_STATUSES,
  isReschedulable,
} from './executions.js'

export {
  ingestEvent,
  ingestEventSafe,
  getEvent,
  listEvents,
  buildIdempotencyKey,
  buildProviderIdempotencyKey,
  buildProviderEventId,
  EVENT_CATEGORIES,
  EVENT_NAMES,
  EVENT_NAME_CATEGORIES,
  ACTOR_TYPES,
  OBJECT_TYPES,
} from './events.js'

export {
  checkEligibility,
  setConsent,
  getConsent,
  insertConsentSql,
  upsertConsentSql,
  CONSENT_STATUSES,
  CONSENT_PURPOSES,
  CONSENT_LEGAL_BASES,
  ELIGIBILITY_REASON_CODES,
} from './consent.js'

export {
  resolveContactPolicy,
  getContactPolicy,
  listContactPolicies,
  upsertContactPolicy,
  checkFrequencyCap,
  isInQuietHours,
  isInDoNotContactWindow,
  CONTACT_POLICY_SCOPES,
  normalizeRules,
} from './contact-policy.js'
