/**
 * Consent-aware audience resolution.
 */

import { randomUUID } from 'node:crypto'
import { findAll } from '../../persistence/index.js'
import { checkEligibility, ELIGIBILITY_REASON_CODES, withTenant } from '../../lib/growth-os/index.js'
import { getAudience, upsertMembership } from './repository.js'
import { filterContactsByRules, parseAudienceRules } from './rules-engine.js'

function emptyBreakdown() {
  return {
    matched: 0,
    contactable: 0,
    frequency_capped: 0,
    opted_out: 0,
    conflicting: 0,
    memberIds: {
      matched: [],
      contactable: [],
      frequency_capped: [],
      opted_out: [],
      conflicting: [],
    },
  }
}

function eligibilityToMembershipState(eligibility) {
  if (eligibility.allowed) return 'contactable'
  if (eligibility.reason_code === ELIGIBILITY_REASON_CODES.DENY_FREQUENCY_CAPPED) {
    return 'frequency_capped'
  }
  if (
    eligibility.reason_code === ELIGIBILITY_REASON_CODES.DENY_OPTED_OUT
    || eligibility.reason_code === ELIGIBILITY_REASON_CODES.DENY_WITHDRAWN
    || eligibility.reason_code === ELIGIBILITY_REASON_CODES.DENY_NO_CONSENT
    || eligibility.reason_code === ELIGIBILITY_REASON_CODES.DENY_EXPIRED
  ) {
    return 'opted_out'
  }
  if (eligibility.reason_code === ELIGIBILITY_REASON_CODES.DENY_JURISDICTION_RESTRICTED) {
    return 'conflicting'
  }
  return 'matched'
}

async function loadMatchedContacts(audience, { agencyId, agentId }) {
  const parsed = parseAudienceRules(audience.rules)

  if (audience.type === 'static') {
    const ids = new Set(parsed.static_contact_ids)
    if (ids.size === 0) return []
    const contacts = await findAll('contacts')
    return contacts.filter((c) => ids.has(c.id))
  }

  let contacts = await findAll('contacts')
  if (agentId) {
    contacts = contacts.filter((c) => c.assigned_agent_id === agentId)
  } else if (agencyId) {
    contacts = contacts.filter((c) => c.agency_id === agencyId)
  }

  return filterContactsByRules(contacts, audience.rules)
}

/**
 * Resolve an audience with consent-aware membership states.
 *
 * @returns {Promise<{
 *   audienceId: string,
 *   matched: number,
 *   contactable: number,
 *   frequency_capped: number,
 *   opted_out: number,
 *   conflicting: number,
 *   memberIds: Record<string, string[]>
 * }>}
 */
export async function resolveAudience(
  audienceId,
  {
    channel = 'email',
    purpose = 'marketing',
    agencyId = null,
    agentId = null,
    persistMemberships = true,
    skipChannelHealth = true,
  } = {},
) {
  return withTenant(agencyId, agentId, async () => {
    const audience = await getAudience(audienceId, { agencyId, agentId })
    if (!audience) {
      throw Object.assign(new Error(`Audience not found: ${audienceId}`), { code: 'AUDIENCE_NOT_FOUND' })
    }

    const breakdown = emptyBreakdown()
    const contacts = await loadMatchedContacts(audience, { agencyId, agentId })

    for (const contact of contacts) {
      breakdown.matched += 1
      breakdown.memberIds.matched.push(contact.id)

      const eligibility = await checkEligibility({
        contactId: contact.id,
        channel,
        purpose,
        agencyId,
        agentId,
        skipChannelHealth,
      })

      const state = eligibilityToMembershipState(eligibility)
      breakdown[state] += 1
      breakdown.memberIds[state].push(contact.id)

      if (persistMemberships) {
        await upsertMembership({
          audienceId,
          contactId: contact.id,
          state,
          agencyId,
          agentId,
          data: { reason_code: eligibility.reason_code },
        })
      }
    }

    return {
      audienceId,
      ...breakdown,
    }
  })
}

/**
 * Build an audience payload from legacy inline campaign fields (expand-contract).
 */
export function audienceRulesFromCampaign(campaign = {}) {
  return {
    tags_filter: campaign.tags_filter || campaign.tags || [],
    audience_rules: campaign.audience_rules || [],
  }
}

/**
 * Ensure a campaign has a linked audience row; legacy inline shape stays readable.
 */
export async function ensureCampaignAudience(campaign, { agencyId = null, agentId = null } = {}) {
  if (campaign.audience_id) {
    const existing = await getAudience(campaign.audience_id, { agencyId, agentId })
    if (existing) return existing
  }

  const rules = audienceRulesFromCampaign(campaign)
  const hasRules = rules.tags_filter.length > 0 || rules.audience_rules.length > 0
  if (!hasRules) return null

  const { createAudience } = await import('./repository.js')
  const audience = await createAudience({
    id: campaign.audience_id || `aud_${campaign.id || randomUUID()}`,
    name: `${campaign.name || 'Campaign'} audience`,
    type: 'dynamic',
    rules,
    agencyId: agencyId ?? campaign.agency_id ?? null,
    agentId: agentId ?? campaign.agent_id ?? campaign.created_by ?? null,
    data: {
      legacy_source: { table: 'campaigns', id: campaign.id },
    },
  })
  return audience
}
