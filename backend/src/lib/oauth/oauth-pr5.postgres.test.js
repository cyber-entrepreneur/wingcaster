/**
 * Real-PG — LinkedIn OAuth callback persists author URN + agency_id.
 */
import { randomBytes, randomUUID } from 'node:crypto'
import { expect, it, vi } from 'vitest'
import { skipIfNoPostgres, withTestDb } from '../../testing/postgres.js'
import { closeDb, configure, findOne } from '../../persistence/index.js'
import { getPool } from '../../persistence/postgres-adapter.js'
import { create } from './state-store.js'
import { handleCallback } from './index.js'

const TEST_KEY = randomBytes(32).toString('base64')

async function seedAgencyAgent(pool, { agencyId, agentId }) {
  const userId = randomUUID()
  await pool.query(
    `INSERT INTO public.users (id, email, name, data)
     VALUES ($1, $2, 'OAuth PR5 callback', '{}'::jsonb)
     ON CONFLICT (id) DO NOTHING`,
    [userId, `oauth-pr5-cb-${userId}@test.local`],
  )
  await pool.query(
    `INSERT INTO public.agencies (id, name, data)
     VALUES ($1, $2, '{}'::jsonb)
     ON CONFLICT (id) DO NOTHING`,
    [agencyId, `Agency ${agencyId}`],
  )
  await pool.query(
    `INSERT INTO public.agents (id, user_id, email, name, agency_id, data)
     VALUES ($1, $2, $3, 'Agent', $4, '{}'::jsonb)
     ON CONFLICT (id) DO NOTHING`,
    [agentId, userId, `oauth-pr5-cb-${agentId}@test.local`, agencyId],
  )
}

skipIfNoPostgres()('oauth PR5 LinkedIn callback persistence', () => {
  it('creates marketplace_connections with agency_id, connect_method oauth, and li_author_urn', async () => {
    await withTestDb(async (url) => {
      process.env.CREDENTIALS_ENCRYPTION_KEY = TEST_KEY
      process.env.LINKEDIN_OAUTH_CLIENT_ID = 'li-client'
      process.env.LINKEDIN_OAUTH_CLIENT_SECRET = 'li-secret'
      process.env.WINGCASTER_LINKEDIN_OAUTH_ENABLED = 'true'
      process.env.PUBLIC_API_URL = 'https://api.test/api'
      configure({ databaseUrl: url, force: true })
      const pool = getPool()
      const agencyId = `agy_oauth_li_${randomUUID()}`
      const agentId = `agt_oauth_li_${randomUUID()}`

      const fetchFn = vi.fn(async (requestUrl) => {
        if (String(requestUrl).includes('/oauth/v2/accessToken')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              access_token: 'li-access-token',
              refresh_token: 'li-refresh-token',
              expires_in: 5184000,
              scope: 'openid profile email w_member_social',
            }),
          }
        }
        if (String(requestUrl).includes('/v2/userinfo')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ sub: 'person-42', name: 'Alex Agent' }),
          }
        }
        throw new Error(`unexpected fetch: ${requestUrl}`)
      })

      await seedAgencyAgent(pool, { agencyId, agentId })
      const stateRow = await create({
        agentId,
        agencyId,
        platform: 'linkedin',
        codeVerifier: null,
        redirectUri: 'https://api.test/api/social-channels/oauth/linkedin/callback',
      })

      const result = await handleCallback({
        platform: 'linkedin',
        code: 'auth-code',
        state: stateRow.id,
        apiBase: 'https://api.test/api',
        fetch: fetchFn,
      })

      expect(result.status).toBe(200)
      const row = await findOne('marketplace_connections', (c) => c.id === result.connectionId)
      expect(row).toMatchObject({
        agent_id: agentId,
        agency_id: agencyId,
        platform: 'linkedin',
        connect_method: 'oauth',
        status: 'connected',
      })
      expect(row.settings.enterprise_targets.li_author_urn).toBe('urn:li:person:person-42')
      expect(row.settings.credentials.access_token_encrypted).toMatch(/^v1:/)
      await closeDb()
    })
  })
})
