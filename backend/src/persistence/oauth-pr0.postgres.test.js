/**
 * PR0 — Real-PG coverage for typed oauth_states and marketplace_connections connect_method.
 */
import { randomUUID } from 'node:crypto'
import { expect, it } from 'vitest'
import { skipIfNoPostgres, withTestDb } from '../testing/postgres.js'
import { closeDb, configure, findOne, insert } from '../persistence/index.js'
import { getPool } from '../persistence/postgres-adapter.js'

async function seedAgencyAgent(pool, { agencyId, agentId }) {
  const userId = randomUUID()
  await pool.query(
    `INSERT INTO public.users (id, email, name, data)
     VALUES ($1, $2, 'OAuth PR0', '{}'::jsonb)
     ON CONFLICT (id) DO NOTHING`,
    [userId, `oauth-pr0-${userId}@test.local`],
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
    [agentId, userId, `oauth-pr0-${agentId}@test.local`, agencyId],
  )
}

skipIfNoPostgres()('oauth PR0 schema', () => {
  it('oauth_states round-trips typed columns via DAL', async () => {
    await withTestDb(async (url) => {
      configure({ databaseUrl: url, force: true })
      const pool = getPool()
      const agencyId = `agy_oauth_pr0_${randomUUID()}`
      const agentId = `agt_oauth_pr0_${randomUUID()}`
      const stateId = `oauth_state_${randomUUID()}`
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString()

      try {
        await seedAgencyAgent(pool, { agencyId, agentId })

        await insert('oauth_states', {
          id: stateId,
          agent_id: agentId,
          agency_id: agencyId,
          platform: 'x',
          code_verifier_encrypted: 'enc:verifier-sample',
          redirect_uri: 'https://app.test/social-channels/oauth/x/callback',
          return_to: '/settings/channels',
          elevated: true,
          nonce: `nonce_${randomUUID()}`,
          expires_at: expiresAt,
        })

        const row = await findOne('oauth_states', (candidate) => candidate.id === stateId)
        expect(row).toBeTruthy()
        expect(row.id).toBe(stateId)
        expect(row.agent_id).toBe(agentId)
        expect(row.agency_id).toBe(agencyId)
        expect(row.platform).toBe('x')
        expect(row.code_verifier_encrypted).toBe('enc:verifier-sample')
        expect(row.redirect_uri).toBe('https://app.test/social-channels/oauth/x/callback')
        expect(row.return_to).toBe('/settings/channels')
        expect(row.elevated).toBe(true)
        expect(row.nonce).toMatch(/^nonce_/)
        expect(row.consumed_at).toBeFalsy()
        expect(new Date(row.expires_at).getTime()).toBe(new Date(expiresAt).getTime())
        expect(row.created_at).toBeTruthy()
      } finally {
        await closeDb()
      }
    })
  })

  it('marketplace_connections carries connect_method and backfilled agency_id', async () => {
    await withTestDb(async (url) => {
      configure({ databaseUrl: url, force: true })
      const pool = getPool()
      const agencyId = `agy_mc_pr0_${randomUUID()}`
      const agentId = `agt_mc_pr0_${randomUUID()}`
      const connectionId = `mc_oauth_pr0_${randomUUID()}`

      try {
        await seedAgencyAgent(pool, { agencyId, agentId })

        // Legacy-shaped row: agency_id NULL until migration 794 backfill runs.
        await pool.query(
          `INSERT INTO public.marketplace_connections
             (id, agent_id, platform, status, account_name, is_primary, data)
           VALUES ($1, $2, 'x', 'connected', '@handle', true, '{}'::jsonb)`,
          [connectionId, agentId],
        )

        const before = await pool.query(
          `SELECT agency_id, connect_method
             FROM public.marketplace_connections
            WHERE id = $1`,
          [connectionId],
        )
        expect(before.rows[0].agency_id).toBeNull()
        expect(before.rows[0].connect_method).toBeNull()

        // Re-run the migration 794 backfill SQL (one-time for existing rows at deploy).
        await pool.query(
          `UPDATE public.marketplace_connections AS mc
           SET agency_id = a.agency_id
           FROM public.agents AS a
           WHERE mc.agent_id = a.id
             AND mc.agency_id IS NULL
             AND a.agency_id IS NOT NULL
             AND mc.id = $1`,
          [connectionId],
        )

        await pool.query(
          `UPDATE public.marketplace_connections
              SET connect_method = 'oauth'
            WHERE id = $1`,
          [connectionId],
        )

        const { rows } = await pool.query(
          `SELECT agency_id, connect_method
             FROM public.marketplace_connections
            WHERE id = $1`,
          [connectionId],
        )
        expect(rows).toHaveLength(1)
        expect(rows[0].connect_method).toBe('oauth')
        expect(rows[0].agency_id).toBe(agencyId)

        const viaDal = await findOne('marketplace_connections', (c) => c.id === connectionId)
        expect(viaDal.connect_method).toBe('oauth')
        expect(viaDal.agency_id).toBe(agencyId)
      } finally {
        await closeDb()
      }
    })
  })
})
