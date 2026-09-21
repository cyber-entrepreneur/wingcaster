/**
 * Real-PG — oauth state-store consumeOnce semantics.
 */
import { randomBytes, randomUUID } from 'node:crypto'
import { expect, it } from 'vitest'
import { skipIfNoPostgres, withTestDb } from '../../testing/postgres.js'
import { closeDb, configure, findOne } from '../../persistence/index.js'
import { getPool } from '../../persistence/postgres-adapter.js'
import { create, consumeOnce } from './state-store.js'

const TEST_KEY = randomBytes(32).toString('base64')

async function seedAgencyAgent(pool, { agencyId, agentId }) {
  const userId = randomUUID()
  await pool.query(
    `INSERT INTO public.users (id, email, name, data)
     VALUES ($1, $2, 'OAuth PR1', '{}'::jsonb)
     ON CONFLICT (id) DO NOTHING`,
    [userId, `oauth-pr1-${userId}@test.local`],
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
    [agentId, userId, `oauth-pr1-${agentId}@test.local`, agencyId],
  )
}

skipIfNoPostgres()('oauth state-store', () => {
  it('consumeOnce is single-use and enforces expiry/platform/agency', async () => {
    await withTestDb(async (url) => {
      process.env.CREDENTIALS_ENCRYPTION_KEY = TEST_KEY
      configure({ databaseUrl: url, force: true })
      const pool = getPool()
      const agencyId = `agy_oauth_pr1_${randomUUID()}`
      const otherAgencyId = `agy_oauth_pr1_other_${randomUUID()}`
      const agentId = `agt_oauth_pr1_${randomUUID()}`

      try {
        await seedAgencyAgent(pool, { agencyId, agentId })

        const live = await create({
          agentId,
          agencyId,
          platform: 'x',
          codeVerifier: 'verifier-live-abcdefghijklmnopqrstuvwxyz',
          redirectUri: 'https://api.test/api/social-channels/oauth/x/callback',
        })

        const consumed = await consumeOnce(live.id, { platform: 'x', agencyId })
        expect(consumed.agent_id).toBe(agentId)
        expect(consumed.agency_id).toBe(agencyId)
        expect(consumed.code_verifier).toBe('verifier-live-abcdefghijklmnopqrstuvwxyz')

        const row = await findOne('oauth_states', (candidate) => candidate.id === live.id)
        expect(row.consumed_at).toBeTruthy()

        await expect(consumeOnce(live.id, { platform: 'x', agencyId }))
          .rejects.toMatchObject({ code: 'consumed' })

        const wrongPlatform = await create({
          agentId,
          agencyId,
          platform: 'tiktok',
          codeVerifier: 'verifier-tiktok-abcdefghijklmnopqrstuvwxyz',
          redirectUri: 'https://api.test/api/social-channels/oauth/tiktok/callback',
        })
        await expect(consumeOnce(wrongPlatform.id, { platform: 'x', agencyId }))
          .rejects.toMatchObject({ code: 'platform_mismatch' })

        const agencyMismatch = await create({
          agentId,
          agencyId,
          platform: 'x',
          codeVerifier: 'verifier-agency-abcdefghijklmnopqrstuvwxyz',
          redirectUri: 'https://api.test/api/social-channels/oauth/x/callback',
        })
        await expect(consumeOnce(agencyMismatch.id, { platform: 'x', agencyId: otherAgencyId }))
          .rejects.toMatchObject({ code: 'agency_mismatch' })

        const expired = await create({
          agentId,
          agencyId,
          platform: 'x',
          codeVerifier: 'verifier-expired-abcdefghijklmnopqrstuvwxyz',
          redirectUri: 'https://api.test/api/social-channels/oauth/x/callback',
          ttlMs: -1000,
        })
        await expect(consumeOnce(expired.id, { platform: 'x', agencyId }))
          .rejects.toMatchObject({ code: 'expired' })
      } finally {
        await closeDb()
      }
    })
  })
})
