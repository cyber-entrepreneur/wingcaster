/**
 * Hierarchy resolver (agent → agency → platform), generalized to any feature.
 * feature_entitlements (mig 010) is retained and adapted in-place.
 */
import { v4 as uuidv4 } from 'uuid'
import { findAll, findOne, insert, remove, update } from '../../db.js'
import { FEATURES } from './features.js'

const COLLECTION = 'feature_entitlements'
const isProduction = process.env.NODE_ENV === 'production'

export const EntitlementScope = {
  PLATFORM: 'platform',
  AGENCY: 'agency',
  AGENT: 'agent',
}

export function defaultEntitlementConfig() {
  return {
    enabled: true,
    max_drafts_per_month: 50,
    ai_providers_allowed: ['gemini', 'openai'],
    thumbnail_variants: ['luxe', 'modern', 'urgent'],
    auto_publish_social: false,
  }
}

export function createEntitlementService({
  defaultFeature = FEATURES.WHATSAPP_LISTINGS,
  defaultConfig = defaultEntitlementConfig,
} = {}) {
  async function ensureDefaultEntitlement(feature = defaultFeature) {
    const existing = await findOne(COLLECTION, (e) =>
      e.scope === EntitlementScope.PLATFORM && e.feature === feature,
    )
    if (existing) return existing
    const config = defaultConfig()
    if (isProduction) config.enabled = false
    return insert(COLLECTION, {
      id: uuidv4(),
      scope: EntitlementScope.PLATFORM,
      scope_id: 'platform',
      feature,
      enabled: config.enabled,
      config,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
  }

  async function resolveEntitlement({ agentId, agencyId, feature = defaultFeature }) {
    await ensureDefaultEntitlement(feature)
    const all = await findAll(COLLECTION, (e) => e.feature === feature)
    const agentEntitlement = agentId
      ? all.find((e) => e.scope === EntitlementScope.AGENT && e.scope_id === agentId)
      : null
    const agencyEntitlement = agencyId
      ? all.find((e) => e.scope === EntitlementScope.AGENCY && e.scope_id === agencyId)
      : null
    const platformEntitlement = all.find((e) => e.scope === EntitlementScope.PLATFORM)
    const source = agentEntitlement || agencyEntitlement || platformEntitlement
    if (!source) return null
    return {
      ...source,
      config: { ...defaultConfig(), ...(source.config || {}) },
    }
  }

  async function isEnabled(args) {
    const entitlement = await resolveEntitlement(args)
    if (!entitlement) return false
    return entitlement.enabled === true
  }

  async function getConfig(args) {
    return (await resolveEntitlement(args))?.config || defaultConfig()
  }

  async function createEntitlement(payload) {
    const config = { ...defaultConfig(), ...(payload.config || {}) }
    return insert(COLLECTION, {
      id: uuidv4(),
      scope: payload.scope,
      scope_id: payload.scope_id,
      feature: payload.feature || defaultFeature,
      enabled: payload.enabled === undefined ? true : Boolean(payload.enabled),
      config,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
  }

  async function updateEntitlement(id, payload) {
    const existing = await findOne(COLLECTION, (e) => e.id === id)
    if (!existing) return null
    const config = payload.config
      ? { ...defaultConfig(), ...(existing.config || {}), ...payload.config }
      : existing.config
    return update(
      COLLECTION,
      (e) => e.id === id,
      (e) => ({
        ...e,
        ...(payload.scope !== undefined && { scope: payload.scope }),
        ...(payload.scope_id !== undefined && { scope_id: payload.scope_id }),
        ...(payload.feature !== undefined && { feature: payload.feature }),
        ...(payload.enabled !== undefined && { enabled: Boolean(payload.enabled) }),
        ...(payload.config !== undefined && { config }),
        updated_at: new Date().toISOString(),
      }),
    )
  }

  async function deleteEntitlement(id) {
    return remove(COLLECTION, (e) => e.id === id)
  }

  async function listEntitlements({ scope, scope_id, feature = defaultFeature } = {}) {
    return findAll(COLLECTION, (e) => {
      if (feature && e.feature !== feature) return false
      if (scope && e.scope !== scope) return false
      if (scope_id && e.scope_id !== scope_id) return false
      return true
    })
  }

  return {
    resolveEntitlement,
    isEnabled,
    getConfig,
    createEntitlement,
    updateEntitlement,
    deleteEntitlement,
    listEntitlements,
    ensureDefaultEntitlement,
  }
}
