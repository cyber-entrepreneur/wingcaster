/**
 * Real-PG — OAuth callback persists non-null agency_id on marketplace_connections.
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
     VALUES ($1, $2, 'OAuth PR1 callback', '{}'::jsonb)
     ON CONFLICT (id) DO NOTHING`,
    [userId, `oauth-pr1-cb-${userId}@test.local`],
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
    [agentId, userId, `oauth-pr1-cb-${agentId}@test.local`, agencyId],
  )
}

skipIfNoPostgres()('oauth PR1 callback persistence', () => {
  it('creates marketplace_connections with non-null agency_id', async () => {
    await withTestDb(async (url) => {
      process.env.CREDENTIALS_ENCRYPTION_KEY = TEST_KEY
      configure({ databaseUrl: url, force: true })
      const pool = getPool()
      const agencyId = `agy_oauth_cb_${randomUUID()}`
      const agentId = `agt_oauth_cb_${randomUUID()}`

      const fetchFn = vi.fn(async (requestUrl) => {
        if (String(requestUrl).includes('oauth2/token')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              access_token: 'access-token',
              refresh_token: 'refresh-token',
              expires_in: 3600,
              scope: 'tweet.read tweet.write users.read offline.access',
            }),
          }
        }
        if (String(requestUrl).includes('users/me')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ data: { id: '123', username: 'wingcaster' } }),
          }
        }
        throw new Error(`unexpected fetch: ${requestUrl}`)
      })

      try {
        await seedAgencyAgent(pool, { agencyId, agentId })

        const state = await create({
          agentId,
          agencyId,
          platform: 'x',
          codeVerifier: 'verifier-callback-abcdefghijklmnopqrstuvwxyz',
          redirectUri: 'https://api.test/api/social-channels/oauth/x/callback',
          elevated: true,
        })

        const result = await handleCallback({
          platform: 'x',
          code: 'auth-code',
          state: state.id,
          apiBase: 'https://api.test/api',
          env: {
            X_OAUTH_CLIENT_ID: 'x-client',
            X_OAUTH_CLIENT_SECRET: 'x-secret',
            PUBLIC_API_URL: 'https://api.test/api',
          },
          fetch: fetchFn,
        })

        expect(result.status).toBe(200)
        expect(result.agencyId).toBe(agencyId)
        expect(result.html).toContain('wingcaster:oauth:done')

        const connection = await findOne(
          'marketplace_connections',
          (c) => c.id === result.connectionId,
        )
        expect(connection).toBeTruthy()
        expect(connection.agency_id).toBe(agencyId)
        expect(connection.connect_method).toBe('oauth')
        expect(connection.agent_id).toBe(agentId)
      } finally {
        await closeDb()
      }
    })
  })
})
