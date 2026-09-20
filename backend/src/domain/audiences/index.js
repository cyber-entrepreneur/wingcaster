export {
  AUDIENCE_TYPES,
  MEMBER_SOURCES,
  MEMBERSHIP_STATES,
  INCLUSION_VALUES,
  RULE_FIELDS,
  RULE_OPERATORS,
} from './constants.js'

export {
  parseAudienceRules,
  contactMatchesAudienceRules,
  filterContactsByRules,
} from './rules-engine.js'

export {
  createAudience,
  getAudience,
  listAudiences,
  updateAudience,
  deleteAudience,
  upsertMembership,
  listMemberships,
  serializeAudience,
} from './repository.js'

export {
  resolveAudience,
  audienceRulesFromCampaign,
  ensureCampaignAudience,
} from './resolve.js'

export { registerAudienceRoutes } from './routes.js'
