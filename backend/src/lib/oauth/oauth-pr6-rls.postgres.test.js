/**
 * PR6 — Real-PG RLS on marketplace_connections + oauth_states.
 */
import { randomBytes, randomUUID } from 'node:crypto'
import { expect, it } from 'vitest'
import { skipIfNoPostgres, withTestDb } from '../../testing/postgres.js'
import { closeDb, configure, findOne, update } from '../../persistence/index.js'
import { getPool } from '../../persistence/postgres-adapter.js'
import { create } from './state-store.js'
import { handleCallback } from './index.js'
import {
  ensureChannelDefinitionForPlatform,
  withMarketplaceConnectionWrite,
  withMarketplaceTenant,
} from '../social/marketplace-tenant.js'

const TEST_KEY = randomBytes(32).toString('base64')

async function asGrowthOsRole(pool, gucs, fn) {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query('SET LOCAL ROLE growth_os_app_role')
    for (const [key, value] of Object.entries(gucs || {})) {
      await client.query('SELECT set_config($1, $2, true)', [key, String(value)])
    }
    const result = await fn(client)
    await client.query('COMMIT')
    return result
  } catch (error) {
    try { await client.query('ROLLBACK') } catch { /* aborted */ }
    throw error
  } finally {
    client.release()
  }
}

async function seedAgencyAgent(pool, { agencyId, agentId }) {
  const userId = randomUUID()
  await pool.query(
    `INSERT INTO public.users (id, email, name, data)
     VALUES ($1, $2, 'OAuth PR6 RLS', '{}'::jsonb)
     ON CONFLICT (id) DO NOTHING`,
    [userId, `oauth-pr6-${userId}@test.local`],
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
    [agentId, userId, `oauth-pr6-${agentId}@test.local`, agencyId],
  )
}

skipIfNoPostgres()('oauth PR6 RLS', () => {
  it('null-GUC growth_os_app_role sees no marketplace_connections or oauth_states rows', async () => {
    await withTestDb(async (url) => {
      process.env.CREDENTIALS_ENCRYPTION_KEY = TEST_KEY
      configure({ databaseUrl: url, force: true })
      const pool = getPool()
      const agencyId = `agy_pr6_null_${randomUUID()}`
      const agentId = `agt_pr6_null_${randomUUID()}`
      const connectionId = `mc_pr6_null_${randomUUID()}`

      try {
        await seedAgencyAgent(pool, { agencyId, agentId })
        await pool.query(
          `INSERT INTO public.marketplace_connections
             (id, agent_id, agency_id, platform, status, health, data)
           VALUES ($1, $2, $3, 'x', 'connected', 'healthy', '{}'::jsonb)`,
          [connectionId, agentId, agencyId],
        )

        const ambient = await asGrowthOsRole(pool, {}, async (client) => {
          const mc = await client.query('SELECT id FROM public.marketplace_connections')
          const os = await client.query('SELECT id FROM public.oauth_states')
          return { mc, os }
        })
        expect(ambient.mc.rows).toHaveLength(0)
        expect(ambient.os.rows).toHaveLength(0)
      } finally {
        await closeDb()
      }
    })
  })

  it('cross-tenant SELECT/UPDATE blocked; owner allowed under matching GUC', async () => {
    await withTestDb(async (url) => {
      process.env.CREDENTIALS_ENCRYPTION_KEY = TEST_KEY
      configure({ databaseUrl: url, force: true })
      const pool = getPool()
      const agencyA = `agy_pr6_a_${randomUUID()}`
      const agencyB = `agy_pr6_b_${randomUUID()}`
      const agentA = `agt_pr6_a_${randomUUID()}`
      const agentB = `agt_pr6_b_${randomUUID()}`
      const connA = `mc_pr6_a_${randomUUID()}`
      const connB = `mc_pr6_b_${randomUUID()}`
      const stateA = `ost_pr6_a_${randomUUID()}`
      const stateB = `ost_pr6_b_${randomUUID()}`

      try {
        await seedAgencyAgent(pool, { agencyId: agencyA, agentId: agentA })
        await seedAgencyAgent(pool, { agencyId: agencyB, agentId: agentB })

        await pool.query(
          `INSERT INTO public.marketplace_connections
             (id, agent_id, agency_id, platform, status, health, data)
           VALUES ($1, $2, $3, 'x', 'connected', 'healthy', '{}'::jsonb)`,
          [connA, agentA, agencyA],
        )
        await pool.query(
          `INSERT INTO public.marketplace_connections
             (id, agent_id, agency_id, platform, status, health, data)
           VALUES ($1, $2, $3, 'tiktok', 'connected', 'healthy', '{}'::jsonb)`,
          [connB, agentB, agencyB],
        )
        await pool.query(
          `INSERT INTO public.oauth_states
             (id, agent_id, agency_id, platform, redirect_uri, elevated, expires_at, data)
           VALUES ($1, $2, $3, 'x', 'https://api.test/cb', false, now() + interval '10 minutes', '{}'::jsonb)`,
          [stateA, agentA, agencyA],
        )
        await pool.query(
          `INSERT INTO public.oauth_states
             (id, agent_id, agency_id, platform, redirect_uri, elevated, expires_at, data)
           VALUES ($1, $2, $3, 'tiktok', 'https://api.test/cb', false, now() + interval '10 minutes', '{}'::jsonb)`,
          [stateB, agentB, agencyB],
        )

        const crossTenantMc = await asGrowthOsRole(pool, { 'app.agency_id': agencyA }, async (client) => {
          const rows = await client.query(
            'SELECT id FROM public.marketplace_connections WHERE id = ANY($1::text[])',
            [[connA, connB]],
          )
          return rows.rows.map((r) => r.id)
        })
        expect(crossTenantMc).toEqual([connA])

        const crossTenantOs = await asGrowthOsRole(pool, { 'app.agency_id': agencyA }, async (client) => {
          const rows = await client.query(
            'SELECT id FROM public.oauth_states WHERE id = ANY($1::text[])',
            [[stateA, stateB]],
          )
          return rows.rows.map((r) => r.id)
        })
        expect(crossTenantOs).toEqual([stateA])

        const blockedUpdate = await asGrowthOsRole(pool, { 'app.agency_id': agencyA }, async (client) => {
          const result = await client.query(
            `UPDATE public.marketplace_connections
                SET health = 'reauth_required'
              WHERE id = $1`,
            [connB],
          )
          return result.rowCount
        })
        expect(blockedUpdate).toBe(0)

        await ensureChannelDefinitionForPlatform('x')
        const ownerUpdate = await withMarketplaceConnectionWrite(agencyA, agentA, 'x', async () => {
          await update('marketplace_connections', (c) => c.id === connA, (c) => ({
            ...c,
            health: 'healthy',
            updated_at: new Date().toISOString(),
          }))
          return findOne('marketplace_connections', (c) => c.id === connA)
        })
        expect(ownerUpdate?.id).toBe(connA)
      } finally {
        await closeDb()
      }
    })
  })

  it('callback honors elevated flag captured in oauth state', async () => {
    await withTestDb(async (url) => {
      process.env.CREDENTIALS_ENCRYPTION_KEY = TEST_KEY
      configure({ databaseUrl: url, force: true })
      const pool = getPool()
      const agencyId = `agy_pr6_elev_${randomUUID()}`
      const agentId = `agt_pr6_elev_${randomUUID()}`

      const fetchFn = async (requestUrl) => {
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
      }

      try {
        await seedAgencyAgent(pool, { agencyId, agentId })

        const state = await create({
          agentId,
          agencyId,
          platform: 'x',
          codeVerifier: 'verifier-elevated-abcdefghijklmnopqrstuvwxyz',
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
        expect(result.elevated).toBe(true)

        const consumed = await withMarketplaceTenant(agencyId, agentId, () =>
          findOne('oauth_states', (row) => row.id === state.id),
        )
        expect(consumed?.consumed_at).toBeTruthy()
        expect(consumed?.elevated).toBe(true)
      } finally {
        await closeDb()
      }
    })
  })

  it('create refuses oauth state without agency_id', async () => {
    await withTestDb(async (url) => {
      process.env.CREDENTIALS_ENCRYPTION_KEY = TEST_KEY
      configure({ databaseUrl: url, force: true })

      try {
        await expect(create({
          agentId: `agt_pr6_noagy_${randomUUID()}`,
          agencyId: null,
          platform: 'x',
          codeVerifier: 'verifier-noagy-abcdefghijklmnopqrstuvwxyz',
          redirectUri: 'https://api.test/cb',
        })).rejects.toMatchObject({ code: 'TENANT_REQUIRED' })
      } finally {
        await closeDb()
      }
    })
  })
})
