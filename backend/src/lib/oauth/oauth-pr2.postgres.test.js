/**
 * Real-PG — refresh failure persists health=reauth_required on marketplace_connections.
 */
import { randomBytes, randomUUID } from 'node:crypto'
import { expect, it, vi } from 'vitest'
import { skipIfNoPostgres, withTestDb } from '../../testing/postgres.js'
import { closeDb, configure, findOne, insert } from '../../persistence/index.js'
import { getPool } from '../../persistence/postgres-adapter.js'
import { encryptSecret } from '../credentials.js'
import { _clearRefreshLocksForTests, getFreshAccessToken } from './token-store.js'

const TEST_KEY = randomBytes(32).toString('base64')

async function seedAgencyAgent(pool, { agencyId, agentId }) {
  const userId = randomUUID()
  await pool.query(
    `INSERT INTO public.users (id, email, name, data)
     VALUES ($1, $2, 'OAuth PR2 health', '{}'::jsonb)
     ON CONFLICT (id) DO NOTHING`,
    [userId, `oauth-pr2-health-${userId}@test.local`],
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
    [agentId, userId, `oauth-pr2-health-${agentId}@test.local`, agencyId],
  )
}

skipIfNoPostgres()('oauth PR2 refresh failure health', () => {
  it('persists health=reauth_required when token refresh fails', async () => {
    await withTestDb(async (url) => {
      process.env.CREDENTIALS_ENCRYPTION_KEY = TEST_KEY
      configure({ databaseUrl: url, force: true })
      const pool = getPool()
      const agencyId = `agy_oauth_pr2_${randomUUID()}`
      const agentId = `agt_oauth_pr2_${randomUUID()}`
      const connectionId = `mc_oauth_pr2_${randomUUID()}`

      const fetchFn = vi.fn(async () => ({
        ok: false,
        status: 400,
        json: async () => ({
          error: 'invalid_grant',
          error_description: 'Token has been revoked',
        }),
      }))

      try {
        await seedAgencyAgent(pool, { agencyId, agentId })
        _clearRefreshLocksForTests()

        await insert('marketplace_connections', {
          id: connectionId,
          agent_id: agentId,
          agency_id: agencyId,
          platform: 'x',
          status: 'connected',
          health: 'healthy',
          connect_method: 'oauth',
          account_name: '@pr2test',
          settings: {
            credentials: {
              access_token_encrypted: encryptSecret('stale-access'),
              refresh_token_encrypted: encryptSecret('refresh-token'),
              expires_at: new Date(Date.now() - 1000).toISOString(),
            },
          },
        })

        const connection = await findOne('marketplace_connections', (c) => c.id === connectionId)
        expect(connection.health).toBe('healthy')

        await expect(
          getFreshAccessToken(connection, {
            fetch: fetchFn,
            env: {
              X_OAUTH_CLIENT_ID: 'x-client',
              X_OAUTH_CLIENT_SECRET: 'x-secret',
            },
          }),
        ).rejects.toMatchObject({ code: 'REAUTH_REQUIRED' })

        const updated = await findOne('marketplace_connections', (c) => c.id === connectionId)
        expect(updated.health).toBe('reauth_required')
      } finally {
        await closeDb()
      }
    })
  })
})
