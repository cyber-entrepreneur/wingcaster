/**
 * Wave 1D — Real-PG coverage for audiences, memberships, RLS, consent resolution.
 */
import { randomUUID } from 'node:crypto'
import { readFile } from 'fs/promises'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { expect, it } from 'vitest'
import { skipIfNoPostgres, withTestDb } from '../../testing/postgres.js'
import { closeDb, configure, query } from '../../persistence/index.js'
import { getPool } from '../../persistence/postgres-adapter.js'
import {
  checkEligibility,
  createChannelConnection,
  ensureChannelDefinition,
  setConsent,
} from '../../lib/growth-os/index.js'
import {
  createAudience,
  getAudience,
  listAudiences,
  resolveAudience,
} from './index.js'

const migrationsDir = join(dirname(fileURLToPath(import.meta.url)), '../../persistence/migrations')

const WAVE1D_FILES = [
  '645_growth_os_audience_enums.sql',
  '646_growth_os_audiences.sql',
  '647_growth_os_audience_memberships.sql',
  '648_campaigns_audience_expand.sql',
  '649_growth_os_audience_contact_read_grants.sql',
]

async function seedAgencyAgent(pool, { agencyId, agentId }) {
  const userId = randomUUID()
  await pool.query(
    `INSERT INTO public.users (id, email, name, data)
     VALUES ($1, $2, 'Wave1D', '{}'::jsonb)
     ON CONFLICT (id) DO NOTHING`,
    [userId, `${userId}@wave1d.test`],
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
    [agentId, userId, `${agentId}@wave1d.test`, agencyId],
  )
}

async function seedContact(pool, { contactId, agentId, agencyId, tags = [], status = 'lead' }) {
  await pool.query(
    `INSERT INTO public.contacts
       (id, name, status, tags, assigned_agent_id, agency_id, data)
     VALUES ($1, $2, $3, $4::jsonb, $5, $6, '{}'::jsonb)
     ON CONFLICT (id) DO NOTHING`,
    [contactId, 'Contact', status, JSON.stringify(tags), agentId, agencyId],
  )
}

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

skipIfNoPostgres()('wave 1d audiences', () => {
  it('migrations are idempotent when SQL is re-applied', async () => {
    await withTestDb(async (url) => {
      configure({ databaseUrl: url, force: true })
      const pool = getPool()
      try {
        for (const file of WAVE1D_FILES) {
          const sql = await readFile(join(migrationsDir, file), 'utf8')
          await pool.query(sql)
          await pool.query(sql)
        }
        const tables = await pool.query(`
          SELECT relname FROM pg_class c
          JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE n.nspname = 'public'
            AND relname IN ('audiences', 'audience_memberships')
            AND relkind = 'r'
          ORDER BY 1
        `)
        expect(tables.rows.map((r) => r.relname)).toEqual(['audience_memberships', 'audiences'])
      } finally {
        await closeDb()
      }
    })
  })

  it('strict RLS hides audience rows without tenant GUC', async () => {
    await withTestDb(async (url) => {
      configure({ databaseUrl: url, force: true })
      const pool = getPool()
      const agencyId = `agy_${randomUUID()}`
      const agentId = `agt_${randomUUID()}`
      try {
        await seedAgencyAgent(pool, { agencyId, agentId })
        const audience = await createAudience({
          name: 'RLS audience',
          agencyId,
          agentId,
          rules: { tags_filter: ['buyer'] },
        })

        const visible = await asGrowthOsRole(pool, { 'app.agent_id': agentId }, (client) =>
          client.query('SELECT id FROM public.audiences WHERE id = $1', [audience.id]),
        )
        expect(visible.rows).toHaveLength(1)

        const hidden = await asGrowthOsRole(pool, { 'app.agent_id': `other_${randomUUID()}` }, (client) =>
          client.query('SELECT id FROM public.audiences WHERE id = $1', [audience.id]),
        )
        expect(hidden.rows).toHaveLength(0)
      } finally {
        await closeDb()
      }
    })
  })

  it('dynamic resolution returns matched contacts and consent-aware breakdown', async () => {
    await withTestDb(async (url) => {
      configure({ databaseUrl: url, force: true })
      const pool = getPool()
      const agencyId = `agy_${randomUUID()}`
      const agentId = `agt_${randomUUID()}`
      const contactOk = `cnt_${randomUUID()}`
      const contactOpted = `cnt_${randomUUID()}`
      try {
        await seedAgencyAgent(pool, { agencyId, agentId })
        await seedContact(pool, { contactId: contactOk, agentId, agencyId, tags: ['buyer'] })
        await seedContact(pool, { contactId: contactOpted, agentId, agencyId, tags: ['buyer'] })

        const def = await ensureChannelDefinition({ platform: 'email', kind: 'owned_messaging' })
        await createChannelConnection({
          channelDefinitionId: def.id,
          agencyId,
          agentId,
          credentialsRef: 'secret:fixture:email',
          health: 'connected',
        })

        await setConsent({
          contactId: contactOk,
          channel: 'email',
          purpose: 'marketing',
          status: 'granted',
          legalBasis: 'explicit_optin',
          agencyId,
          agentId,
        })
        await setConsent({
          contactId: contactOpted,
          channel: 'email',
          purpose: 'marketing',
          status: 'denied',
          agencyId,
          agentId,
        })

        const audience = await createAudience({
          name: 'Buyers',
          rules: { tags_filter: ['buyer'] },
          agencyId,
          agentId,
        })

        const result = await resolveAudience(audience.id, {
          channel: 'email',
          purpose: 'marketing',
          agencyId,
          agentId,
        })

        expect(result.matched).toBe(2)
        expect(result.contactable).toBe(1)
        expect(result.opted_out).toBe(1)
        expect(result.memberIds.contactable).toContain(contactOk)
        expect(result.memberIds.opted_out).toContain(contactOpted)

        const eligibility = await checkEligibility({
          contactId: contactOpted,
          channel: 'email',
          purpose: 'marketing',
          agencyId,
          agentId,
          skipChannelHealth: true,
        })
        expect(eligibility.allowed).toBe(false)
      } finally {
        await closeDb()
      }
    })
  })

  it('lifts inline campaign rules into audiences while keeping legacy shape readable', async () => {
    await withTestDb(async (url) => {
      configure({ databaseUrl: url, force: true })
      const pool = getPool()
      const agencyId = `agy_${randomUUID()}`
      const agentId = `agt_${randomUUID()}`
      const campaignId = randomUUID()
      try {
        await seedAgencyAgent(pool, { agencyId, agentId })
        await pool.query(
          `INSERT INTO public.campaigns
             (id, agent_id, agency_id, name, status, trigger, tags, steps, data)
           VALUES ($1, $2, $3, 'Nurture', 'draft', 'manual', '[]'::jsonb, '[]'::jsonb, $4::jsonb)`,
          [
            campaignId,
            agentId,
            agencyId,
            JSON.stringify({
              tags_filter: ['buyer'],
              audience_rules: [{ field: 'status', operator: 'is', value: 'lead' }],
            }),
          ],
        )

        const sql = await readFile(join(migrationsDir, '648_campaigns_audience_expand.sql'), 'utf8')
        await pool.query(sql)

        const campaign = await query('SELECT * FROM public.campaigns WHERE id = $1', [campaignId])
        const row = Array.isArray(campaign) ? campaign[0] : campaign?.rows?.[0]
        expect(row.audience_id).toBe(`aud_${campaignId}`)
        expect(row.data.tags_filter).toEqual(['buyer'])
        expect(row.data.audience_rules).toEqual([{ field: 'status', operator: 'is', value: 'lead' }])

        const audience = await getAudience(`aud_${campaignId}`, { agencyId, agentId })
        expect(audience).not.toBeNull()
        expect(audience.tags_filter).toEqual(['buyer'])
      } finally {
        await closeDb()
      }
    })
  })

  it('lists audiences for tenant', async () => {
    await withTestDb(async (url) => {
      configure({ databaseUrl: url, force: true })
      const pool = getPool()
      try {
        const agencyId = `agy_${randomUUID()}`
        const agentId = `agt_${randomUUID()}`
        await seedAgencyAgent(pool, { agencyId, agentId })
        await createAudience({ name: 'A', agencyId, agentId })
        await createAudience({ name: 'B', agencyId, agentId })
        const rows = await listAudiences({ agencyId, agentId })
        expect(rows.length).toBeGreaterThanOrEqual(2)
      } finally {
        await closeDb()
      }
    })
  })
})
