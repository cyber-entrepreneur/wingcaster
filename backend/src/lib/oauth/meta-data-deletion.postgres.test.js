/**
 * Real-PG — Meta data-deletion scrubs the connection cross-tenant (bypassing RLS)
 * and records a status row keyed by confirmation code.
 */
import { createHmac, randomUUID } from 'node:crypto'
import { expect, it } from 'vitest'
import { skipIfNoPostgres, withTestDb } from '../../testing/postgres.js'
import { closeDb, configure, findOne, insert } from '../../persistence/index.js'
import { getPool } from '../../persistence/postgres-adapter.js'
import { handleMetaDataDeletion, getDeletionStatus } from './meta-data-deletion.js'

const APP_SECRET = 'meta-secret-pg'

function makeSignedRequest(payload, secret = APP_SECRET) {
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const sig = createHmac('sha256', secret).update(encodedPayload).digest('base64url')
  return `${sig}.${encodedPayload}`
}

async function seedAgencyAgent(pool, { agencyId, agentId }) {
  const userId = randomUUID()
  await pool.query(
    `INSERT INTO public.users (id, email, name, data)
     VALUES ($1, $2, 'Meta Del', '{}'::jsonb) ON CONFLICT (id) DO NOTHING`,
    [userId, `meta-del-${userId}@test.local`],
  )
  await pool.query(
    `INSERT INTO public.agencies (id, name, data)
     VALUES ($1, $2, '{}'::jsonb) ON CONFLICT (id) DO NOTHING`,
    [agencyId, `Agency ${agencyId}`],
  )
  await pool.query(
    `INSERT INTO public.agents (id, user_id, email, name, agency_id, data)
     VALUES ($1, $2, $3, 'Agent', $4, '{}'::jsonb) ON CONFLICT (id) DO NOTHING`,
    [agentId, userId, `meta-del-${agentId}@test.local`, agencyId],
  )
}

skipIfNoPostgres()('meta data-deletion (Real-PG)', () => {
  it('scrubs the matching Meta connection and records a completed status row', async () => {
    await withTestDb(async (url) => {
      configure({ databaseUrl: url, force: true })
      const pool = getPool()
      const agencyId = `agy_metadel_${randomUUID()}`
      const agentId = `agt_metadel_${randomUUID()}`
      const connectionId = `mc_metadel_${randomUUID()}`
      const metaUserId = `meta_${randomUUID()}`

      try {
        await seedAgencyAgent(pool, { agencyId, agentId })

        // A connected Facebook connection carrying the Meta app-scoped user id.
        await insert('marketplace_connections', {
          id: connectionId,
          agent_id: agentId,
          agency_id: agencyId,
          platform: 'facebook',
          account_name: 'FB Page',
          status: 'connected',
          health: 'healthy',
          connect_method: 'oauth',
          settings: {
            handle: 'fb-page',
            credentials: {
              user_id: metaUserId,
              access_token_encrypted: 'v1:enc:sample',
              scope: 'pages_manage_posts',
            },
          },
        })

        const signedRequest = makeSignedRequest({
          user_id: metaUserId,
          algorithm: 'HMAC-SHA256',
          issued_at: Math.floor(Date.now() / 1000),
        })

        const result = await handleMetaDataDeletion({
          signedRequest,
          appSecret: APP_SECRET,
          statusBaseUrl: 'https://api.wingcaster.test',
        })

        expect(result.scrubbed).toBe(1)
        expect(result.confirmation_code).toMatch(/^del_/)
        expect(result.url).toContain(`/api/oauth/meta/data-deletion/status?code=${result.confirmation_code}`)

        // Connection is disconnected + tokens wiped.
        const scrubbed = await findOne('marketplace_connections', (c) => c.id === connectionId)
        expect(scrubbed.status).toBe('disconnected')
        expect(scrubbed.health).toBe('data_deleted')
        expect(scrubbed.settings.credentials).toEqual({})
        expect(scrubbed.settings.data_deleted_at).toBeTruthy()

        // Status row is queryable by confirmation code.
        const status = await getDeletionStatus(result.confirmation_code)
        expect(status).toBeTruthy()
        expect(status.status).toBe('completed')
        expect(status.connections_scrubbed).toBe(1)
        expect(status.provider_user_id).toBe(metaUserId)
        expect(status.completed_at).toBeTruthy()
      } finally {
        await closeDb()
      }
    })
  })

  it('rejects a signed_request signed with the wrong secret (no scrub)', async () => {
    await withTestDb(async (url) => {
      configure({ databaseUrl: url, force: true })
      const pool = getPool()
      const agencyId = `agy_metadel2_${randomUUID()}`
      const agentId = `agt_metadel2_${randomUUID()}`
      const connectionId = `mc_metadel2_${randomUUID()}`
      const metaUserId = `meta2_${randomUUID()}`

      try {
        await seedAgencyAgent(pool, { agencyId, agentId })
        await insert('marketplace_connections', {
          id: connectionId,
          agent_id: agentId,
          agency_id: agencyId,
          platform: 'instagram',
          account_name: 'IG',
          status: 'connected',
          health: 'healthy',
          connect_method: 'oauth',
          settings: { credentials: { user_id: metaUserId, access_token_encrypted: 'v1:enc:x' } },
        })

        const forged = makeSignedRequest({ user_id: metaUserId }, 'WRONG-SECRET')
        await expect(
          handleMetaDataDeletion({ signedRequest: forged, appSecret: APP_SECRET, statusBaseUrl: 'https://x.test' }),
        ).rejects.toMatchObject({ code: 'BAD_SIGNATURE' })

        // Connection untouched.
        const untouched = await findOne('marketplace_connections', (c) => c.id === connectionId)
        expect(untouched.status).toBe('connected')
        expect(untouched.settings.credentials.access_token_encrypted).toBe('v1:enc:x')
      } finally {
        await closeDb()
      }
    })
  })
})
