/**
 * PR8 — Real-PG mailbox OAuth connection persist + RLS scoping.
 */
import { randomBytes, randomUUID } from 'node:crypto'
import { expect, it, vi } from 'vitest'
import { skipIfNoPostgres, withTestDb } from '../../testing/postgres.js'
import { closeDb, configure, findOne } from '../../persistence/index.js'
import { getPool } from '../../persistence/postgres-adapter.js'
import { create } from './state-store.js'
import { handleCallback } from './index.js'
import { withMarketplaceTenant } from '../social/marketplace-tenant.js'

const TEST_KEY = randomBytes(32).toString('base64')

async function seedAgencyAgent(pool, { agencyId, agentId }) {
  const userId = randomUUID()
  await pool.query(
    `INSERT INTO public.users (id, email, name, data)
     VALUES ($1, $2, 'OAuth PR8 mailbox', '{}'::jsonb)
     ON CONFLICT (id) DO NOTHING`,
    [userId, `oauth-pr8-${userId}@test.local`],
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
    [agentId, userId, `oauth-pr8-${agentId}@test.local`, agencyId],
  )
}

skipIfNoPostgres()('oauth PR8 email mailbox', () => {
  it('google callback persists mailbox connection with non-null agency_id under tenant GUC', async () => {
    await withTestDb(async (url) => {
      process.env.CREDENTIALS_ENCRYPTION_KEY = TEST_KEY
      configure({ databaseUrl: url, force: true })
      const pool = getPool()
      const agencyId = `agy_pr8_google_${randomUUID()}`
      const agentId = `agt_pr8_google_${randomUUID()}`

      const fetchFn = vi.fn(async (requestUrl) => {
        const href = String(requestUrl)
        if (href.includes('oauth2.googleapis.com/token')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              access_token: 'google-access',
              refresh_token: 'google-refresh',
              expires_in: 3600,
              scope: 'openid email profile https://www.googleapis.com/auth/gmail.send',
            }),
          }
        }
        if (href.includes('openidconnect.googleapis.com/v1/userinfo')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              sub: 'google-sub-1',
              email: 'mailbox@example.com',
              name: 'Mailbox User',
            }),
          }
        }
        throw new Error(`unexpected fetch: ${href}`)
      })

      try {
        await seedAgencyAgent(pool, { agencyId, agentId })

        const state = await create({
          agentId,
          agencyId,
          platform: 'google',
          codeVerifier: 'verifier-google-pr8-abcdefghijklmnopqrstuvwxyz',
          redirectUri: 'https://api.test/api/social-channels/oauth/google/callback',
          elevated: true,
        })

        const result = await handleCallback({
          platform: 'google',
          code: 'auth-code',
          state: state.id,
          apiBase: 'https://api.test/api',
          env: {
            WINGCASTER_GOOGLE_EMAIL_OAUTH_CONNECT_ENABLED: 'true',
            GOOGLE_OAUTH_CLIENT_ID: 'google-client',
            GOOGLE_OAUTH_CLIENT_SECRET: 'google-secret',
            PUBLIC_API_URL: 'https://api.test/api',
          },
          fetch: fetchFn,
        })

        expect(result.status).toBe(200)
        expect(result.agencyId).toBe(agencyId)

        const connection = await withMarketplaceTenant(agencyId, agentId, () =>
          findOne('marketplace_connections', (c) => c.id === result.connectionId),
        )
        expect(connection).toBeTruthy()
        expect(connection.agency_id).toBe(agencyId)
        expect(connection.connect_method).toBe('oauth')
        expect(connection.platform).toBe('google')
        expect(connection.settings?.mailbox_email).toBe('mailbox@example.com')
        expect(connection.settings?.credentials?.access_token_encrypted).toBeTruthy()
        expect(connection.settings?.credentials?.refresh_token_encrypted).toBeTruthy()
      } finally {
        await closeDb()
      }
    })
  })

  it('cross-tenant cannot read another agency google mailbox connection', async () => {
    await withTestDb(async (url) => {
      process.env.CREDENTIALS_ENCRYPTION_KEY = TEST_KEY
      configure({ databaseUrl: url, force: true })
      const pool = getPool()
      const agencyA = `agy_pr8_a_${randomUUID()}`
      const agencyB = `agy_pr8_b_${randomUUID()}`
      const agentA = `agt_pr8_a_${randomUUID()}`
      const agentB = `agt_pr8_b_${randomUUID()}`
      const connA = `mc_pr8_google_${randomUUID()}`

      try {
        await seedAgencyAgent(pool, { agencyId: agencyA, agentId: agentA })
        await seedAgencyAgent(pool, { agencyId: agencyB, agentId: agentB })

        await pool.query(
          `INSERT INTO public.marketplace_connections
             (id, agent_id, agency_id, platform, status, health, connect_method, data)
           VALUES ($1, $2, $3, 'google', 'connected', 'healthy', 'oauth', $4::jsonb)`,
          [
            connA,
            agentA,
            agencyA,
            JSON.stringify({
              mailbox_email: 'tenant-a@example.com',
              credentials: { access_token_encrypted: 'v1:abc:def:ghi' },
            }),
          ],
        )

        const visible = await withMarketplaceTenant(agencyA, agentA, () =>
          findOne('marketplace_connections', (c) => c.id === connA),
        )
        expect(visible?.id).toBe(connA)

        const crossTenant = await withMarketplaceTenant(agencyB, agentB, () =>
          findOne('marketplace_connections', (c) => c.id === connA),
        )
        expect(crossTenant).toBeNull()
      } finally {
        await closeDb()
      }
    })
  })
})
