/**
 * Growth-OS Wave 0 — public access surface for later waves.
 */

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
} from './executions.js'

export {
  ingestEvent,
  ingestEventSafe,
  getEvent,
  listEvents,
  EVENT_CATEGORIES,
} from './events.js'

export {
  checkEligibility,
  setConsent,
  getConsent,
  upsertConsentSql,
  CONSENT_STATUSES,
  CONSENT_PURPOSES,
} from './consent.js'
