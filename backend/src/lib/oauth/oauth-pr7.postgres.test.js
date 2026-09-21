/**
 * Real-PG — WhatsApp Embedded Signup persists connect_method=oauth with non-null agency_id.
 */
import { randomBytes, randomUUID } from 'node:crypto'
import { expect, it, vi } from 'vitest'
import { skipIfNoPostgres, withTestDb } from '../../testing/postgres.js'
import { closeDb, configure, findOne } from '../../persistence/index.js'
import { getPool } from '../../persistence/postgres-adapter.js'
import { completeWhatsAppAccountSelection } from './index.js'
import { createWhatsAppSelection } from './meta-whatsapp-signup.js'

const TEST_KEY = randomBytes(32).toString('base64')

async function seedAgencyAgent(pool, { agencyId, agentId }) {
  const userId = randomUUID()
  await pool.query(
    `INSERT INTO public.users (id, email, name, data)
     VALUES ($1, $2, 'OAuth PR7 WhatsApp', '{}'::jsonb)
     ON CONFLICT (id) DO NOTHING`,
    [userId, `oauth-pr7-wa-${userId}@test.local`],
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
    [agentId, userId, `oauth-pr7-wa-${agentId}@test.local`, agencyId],
  )
}

skipIfNoPostgres()('oauth PR7 whatsapp persistence', () => {
  it('persists whatsapp connection with oauth method and agency_id after account selection', async () => {
    await withTestDb(async (url) => {
      process.env.CREDENTIALS_ENCRYPTION_KEY = TEST_KEY
      process.env.WINGCASTER_WHATSAPP_OAUTH_CONNECT_ENABLED = 'true'
      process.env.META_OAUTH_CLIENT_ID = 'meta-app-id'
      process.env.META_OAUTH_CLIENT_SECRET = 'meta-app-secret'
      configure({ databaseUrl: url, force: true })
      const pool = getPool()
      const agencyId = `agy_oauth_pr7_${randomUUID()}`
      const agentId = `agt_oauth_pr7_${randomUUID()}`

      try {
        await seedAgencyAgent(pool, { agencyId, agentId })

        const selection = await createWhatsAppSelection({
          agentId,
          agencyId,
          accounts: [{
            waba_id: 'waba-789',
            waba_name: 'Test WABA',
            phone_number_id: 'phone-456',
            display_phone_number: '+15550123',
            verified_name: 'Test Business',
          }],
          userToken: 'long-lived-wa-token',
          userTokenExpiresAt: new Date(Date.now() + 60 * 24 * 3600 * 1000).toISOString(),
        })

        const result = await completeWhatsAppAccountSelection({
          selectionId: selection.id,
          phoneNumberId: 'phone-456',
          agentId,
          agencyId,
        })

        expect(result.status).toBe(200)
        expect(result.platform).toBe('whatsapp')
        expect(result.isNewConnection).toBe(true)

        const connection = await findOne(
          'marketplace_connections',
          (c) => c.id === result.connectionId,
        )
        expect(connection).toBeTruthy()
        expect(connection.agency_id).toBe(agencyId)
        expect(connection.connect_method).toBe('oauth')
        expect(connection.agent_id).toBe(agentId)
        expect(connection.platform).toBe('whatsapp')
        expect(connection.settings.enterprise_targets.wa_phone_number_id).toBe('phone-456')
        expect(connection.settings.enterprise_targets.wa_business_account_id).toBe('waba-789')
        expect(connection.settings.enterprise_targets.wa_access_token_override_encrypted).toBeTruthy()
      } finally {
        delete process.env.WINGCASTER_WHATSAPP_OAUTH_CONNECT_ENABLED
        await closeDb()
      }
    })
  })
})
