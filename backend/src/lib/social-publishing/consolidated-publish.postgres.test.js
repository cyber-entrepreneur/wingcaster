/**
 * Wave 1B — Real-PG tests for consolidated social publishing + canonical Executions.
 */
import { randomUUID } from 'node:crypto'
import { readFile } from 'fs/promises'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { expect, it, vi } from 'vitest'
import { skipIfNoPostgres, withTestDb } from '../../testing/postgres.js'
import { closeDb, configure, query } from '../../persistence/index.js'
import { getPool } from '../../persistence/postgres-adapter.js'
import { publishListingToSocialChannels } from './consolidated-publish.js'
import { setConsent } from '../growth-os/index.js'

const migrationsDir = join(dirname(fileURLToPath(import.meta.url)), '../../persistence/migrations')

const WAVE0_FILES = [
  '542_growth_os_canonical_enums.sql',
  '543_growth_os_channel_tables.sql',
  '544_growth_os_executions.sql',
  '545_growth_os_events_consent.sql',
  '546_growth_os_canonical_backfill.sql',
  '547_growth_os_forward_sync_triggers.sql',
  '548_growth_os_consent_compliance.sql',
  '549_growth_os_event_taxonomy.sql',
  '550_growth_os_event_taxonomy_v2.sql',
  '551_growth_os_tenant_rls_strict.sql',
  '552_growth_os_conversation_read_grants.sql',
]

vi.mock('./platform-dispatch.js', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    dispatchPlatformPublish: vi.fn(async ({ platform }) => ({
      publishResult: {
        provider: `${platform}_mock`,
        provider_message_id: `mock-${platform}-${randomUUID()}`,
      },
      publishError: null,
    })),
  }
})

async function seedAgencyAgent(pool, { agencyId, agentId }) {
  const userId = randomUUID()
  await pool.query(
    `INSERT INTO public.users (id, email, name, data)
     VALUES ($1, $2, 'Wave1B', '{}'::jsonb)
     ON CONFLICT (id) DO NOTHING`,
    [userId, `${userId}@wave1b.test`],
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
    [agentId, userId, `${agentId}@wave1b.test`, agencyId],
  )
}

skipIfNoPostgres()('consolidated social publishing', () => {
  it('creates one execution per connected platform on fan-out', async () => {
    await withTestDb(async (url) => {
      configure({ databaseUrl: url, force: true })
      const pool = getPool()
      const agencyId = `agy_${randomUUID()}`
      const agentId = `agt_${randomUUID()}`
      const propertyId = `prop_${randomUUID()}`
      const connIg = `mc_${randomUUID()}`
      const connFb = `mc_${randomUUID()}`

      try {
        for (const file of WAVE0_FILES) {
          await pool.query(await readFile(join(migrationsDir, file), 'utf8'))
        }

        await seedAgencyAgent(pool, { agencyId, agentId })
        await pool.query(
          `INSERT INTO public.properties (id, agent_id, agency_id, title, city, data)
           VALUES ($1, $2, $3, 'Wave1B listing', 'Dubai', '{"photos":["https://example.com/p.jpg"]}'::jsonb)`,
          [propertyId, agentId, agencyId],
        )
        await pool.query(
          `INSERT INTO public.marketplace_connections
             (id, agent_id, agency_id, platform, status, account_name, is_primary, data)
           VALUES
             ($1, $2, $3, 'instagram', 'connected', '@ig', true, '{}'::jsonb),
             ($4, $2, $3, 'facebook', 'connected', 'Page', true, '{}'::jsonb)`,
          [connIg, agentId, agencyId, connFb],
        )

        const property = {
          id: propertyId,
          title: 'Wave1B listing',
          city: 'Dubai',
          photos: ['https://example.com/p.jpg'],
        }

        const { results } = await publishListingToSocialChannels({
          property,
          agentId,
          agencyId,
          channels: [{ platform: 'instagram' }, { platform: 'facebook' }, { platform: 'x' }],
          defaultCaption: 'Post caption',
        })

        expect(results.filter((r) => r.status === 'published')).toHaveLength(2)
        expect(results.find((r) => r.platform === 'x')?.status).toBe('failed')

        const execRows = await query(
          `SELECT count(*)::int AS n FROM public.executions
            WHERE agent_id = $1 AND kind = 'social_post'`,
          [agentId],
        )
        expect(execRows[0].n).toBeGreaterThanOrEqual(3)
      } finally {
        await closeDb()
      }
    })
  })

  it('suppresses WhatsApp when consent denied but allows Instagram', async () => {
    await withTestDb(async (url) => {
      configure({ databaseUrl: url, force: true })
      const pool = getPool()
      const agencyId = `agy_${randomUUID()}`
      const agentId = `agt_${randomUUID()}`
      const propertyId = `prop_${randomUUID()}`
      const contactId = `ctc_${randomUUID()}`
      const connWa = `mc_${randomUUID()}`
      const connIg = `mc_${randomUUID()}`

      try {
        for (const file of WAVE0_FILES) {
          await pool.query(await readFile(join(migrationsDir, file), 'utf8'))
        }

        await seedAgencyAgent(pool, { agencyId, agentId })
        await pool.query(
          `INSERT INTO public.contacts (id, phone, name, assigned_agent_id, agency_id, data)
           VALUES ($1, '96171111111', 'Buyer', $2, $3, '{}'::jsonb)`,
          [contactId, agentId, agencyId],
        )
        await pool.query(
          `INSERT INTO public.properties (id, agent_id, agency_id, title, data)
           VALUES ($1, $2, $3, 'Consent test', '{}'::jsonb)`,
          [propertyId, agentId, agencyId],
        )
        await pool.query(
          `INSERT INTO public.marketplace_connections
             (id, agent_id, agency_id, platform, status, account_name, is_primary, data)
           VALUES
             ($1, $2, $3, 'whatsapp', 'connected', 'WA', true, '{}'::jsonb),
             ($4, $2, $3, 'instagram', 'connected', '@ig', true, '{}'::jsonb)`,
          [connWa, agentId, agencyId, connIg],
        )

        await setConsent({
          contactId,
          channel: 'whatsapp',
          purpose: 'marketing',
          status: 'denied',
          agencyId,
          agentId,
        })

        const property = { id: propertyId, title: 'Consent test', photos: ['https://example.com/p.jpg'] }
        const { results } = await publishListingToSocialChannels({
          property,
          agentId,
          agencyId,
          channels: [{ platform: 'whatsapp' }, { platform: 'instagram' }],
          recipient: '96171111111',
          contactId,
        })

        expect(results.find((r) => r.platform === 'whatsapp')?.status).toBe('failed')
        expect(results.find((r) => r.platform === 'instagram')?.status).toBe('published')
      } finally {
        await closeDb()
      }
    })
  })
})
