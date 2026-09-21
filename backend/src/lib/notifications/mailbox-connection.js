/**
 * Resolve a tenant's connected delegated mailbox (Google or Microsoft OAuth).
 */
import { findAll } from '../../persistence/index.js'
import { withMarketplaceTenant } from '../social/marketplace-tenant.js'
import { isEmailOAuthConnectEnabled } from '../oauth/email-oauth.js'

const MAILBOX_PLATFORMS = ['google', 'microsoft']

/**
 * @param {{ agencyId?: string|null, agentId?: string|null, env?: Record<string, string|undefined> }} ctx
 * @returns {Promise<object|null>} marketplace_connections row or null
 */
export async function findConnectedMailbox({ agencyId = null, agentId = null, env = process.env } = {}) {
  if (!agencyId && !agentId) return null

  const enabledPlatforms = MAILBOX_PLATFORMS.filter((p) => isEmailOAuthConnectEnabled(p, env))
  if (!enabledPlatforms.length) return null

  return withMarketplaceTenant(agencyId, agentId, async () => {
    const rows = await findAll(
      'marketplace_connections',
      (c) => c.agent_id === agentId
        && enabledPlatforms.includes(c.platform)
        && c.status === 'connected'
        && c.connect_method === 'oauth',
    )

    if (!rows.length) return null

    return rows.sort((a, b) => {
      const aTs = new Date(a.updated_at || a.created_at || 0).getTime()
      const bTs = new Date(b.updated_at || b.created_at || 0).getTime()
      return bTs - aTs
    })[0]
  })
}
