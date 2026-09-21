/**
 * Real-PG — Meta OAuth persists connect_method=oauth with non-null agency_id.
 */
import { randomBytes, randomUUID } from 'node:crypto'
import { expect, it, vi } from 'vitest'
import { skipIfNoPostgres, withTestDb } from '../../testing/postgres.js'
import { closeDb, configure, findOne } from '../../persistence/index.js'
import { getPool } from '../../persistence/postgres-adapter.js'
import { completeMetaPageSelection } from './index.js'
import { createPageSelection } from './meta-page-selection.js'

const TEST_KEY = randomBytes(32).toString('base64')

async function seedAgencyAgent(pool, { agencyId, agentId }) {
  const userId = randomUUID()
  await pool.query(
    `INSERT INTO public.users (id, email, name, data)
     VALUES ($1, $2, 'OAuth PR4 Meta', '{}'::jsonb)
     ON CONFLICT (id) DO NOTHING`,
    [userId, `oauth-pr4-meta-${userId}@test.local`],
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
    [agentId, userId, `oauth-pr4-meta-${agentId}@test.local`, agencyId],
  )
}

skipIfNoPostgres()('oauth PR4 meta persistence', () => {
  it('persists facebook connection with oauth method and agency_id after page selection', async () => {
    await withTestDb(async (url) => {
      process.env.CREDENTIALS_ENCRYPTION_KEY = TEST_KEY
      process.env.WINGCASTER_META_OAUTH_CONNECT_ENABLED = 'true'
      process.env.META_OAUTH_CLIENT_ID = 'meta-app-id'
      process.env.META_OAUTH_CLIENT_SECRET = 'meta-app-secret'
      configure({ databaseUrl: url, force: true })
      const pool = getPool()
      const agencyId = `agy_oauth_pr4_${randomUUID()}`
      const agentId = `agt_oauth_pr4_${randomUUID()}`

      try {
        await seedAgencyAgent(pool, { agencyId, agentId })

        const selection = await createPageSelection({
          agentId,
          agencyId,
          platform: 'facebook',
          pages: [{
            id: 'fb-page-123',
            name: 'Test Page',
            access_token: 'page-access-token',
            instagram_business_account_id: 'ig-456',
          }],
          userToken: 'long-lived-user-token',
          userTokenExpiresAt: new Date(Date.now() + 60 * 24 * 3600 * 1000).toISOString(),
        })

        const result = await completeMetaPageSelection({
          selectionId: selection.id,
          pageId: 'fb-page-123',
          agentId,
          agencyId,
        })

        expect(result.status).toBe(200)
        expect(result.platform).toBe('facebook')

        const connection = await findOne(
          'marketplace_connections',
          (c) => c.id === result.connectionId,
        )
        expect(connection).toBeTruthy()
        expect(connection.agency_id).toBe(agencyId)
        expect(connection.connect_method).toBe('oauth')
        expect(connection.agent_id).toBe(agentId)
        expect(connection.settings.enterprise_targets.fb_page_id).toBe('fb-page-123')
        expect(connection.settings.enterprise_targets.ig_business_account_id).toBe('ig-456')
        expect(connection.settings.enterprise_targets.fb_page_access_token_override_encrypted).toBeTruthy()
      } finally {
        delete process.env.WINGCASTER_META_OAUTH_CONNECT_ENABLED
        await closeDb()
      }
    })
  })
})
