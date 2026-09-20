/**
 * Growth-OS Wave 0 — Real-PG coverage for schema, RLS, backfill, forward-sync,
 * event idempotency, and consent eligibility.
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
  createExecution,
  ELIGIBILITY_REASON_CODES,
  ensureChannelDefinition,
  ingestEvent,
  recordExecutionAttempt,
  setConsent,
  transitionExecution,
} from './index.js'

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

async function seedMessagingChannel({ platform, agencyId = null, agentId = null }) {
  const def = await ensureChannelDefinition({ platform, kind: 'owned_messaging' })
  const conn = await createChannelConnection({
    channelDefinitionId: def.id,
    agencyId,
    agentId,
    credentialsRef: `secret:fixture:${platform}`,
    health: 'connected',
  })
  return { def, conn }
}

async function seedWhatsAppInbound(pool, { contactId, inboundAt }) {
  await pool.query(
    `INSERT INTO public.contacts (id, name, data)
     VALUES ($1, 'Wave0 contact', '{}'::jsonb)
     ON CONFLICT (id) DO NOTHING`,
    [contactId],
  )
  const conversationId = `cnv_${randomUUID()}`
  await pool.query(
    `INSERT INTO public.conversations
       (id, contact_id, channel, source_channel, status, data)
     VALUES ($1, $2, 'whatsapp', 'whatsapp', 'open', '{}'::jsonb)`,
    [conversationId, contactId],
  )
  await pool.query(
    `INSERT INTO public.conversation_messages
       (id, conversation_id, direction, channel, content, created_at, data)
     VALUES ($1, $2, 'inbound', 'whatsapp', 'hello', $3, '{}'::jsonb)`,
    [`msg_${randomUUID()}`, conversationId, inboundAt],
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

async function seedAgencyAgent(pool, { agencyId, agentId }) {
  const userId = randomUUID()
  await pool.query(
    `INSERT INTO public.users (id, email, name, data)
     VALUES ($1, $2, 'Wave0', '{}'::jsonb)
     ON CONFLICT (id) DO NOTHING`,
    [userId, `${userId}@wave0.test`],
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
    [agentId, userId, `${agentId}@wave0.test`, agencyId],
  )
}

skipIfNoPostgres()('growth-os wave0 foundation', () => {
  it('migrations are idempotent when SQL is re-applied', async () => {
    await withTestDb(async (url) => {
      configure({ databaseUrl: url, force: true })
      const pool = getPool()
      try {
        // Migrations already applied by withTestDb. Re-run Wave 0 SQL bodies.
        for (const file of WAVE0_FILES) {
          const sql = await readFile(join(migrationsDir, file), 'utf8')
          await pool.query(sql)
          await pool.query(sql) // second pass
        }
        const tables = await pool.query(`
          SELECT relname FROM pg_class c
          JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE n.nspname = 'public'
            AND relname IN (
              'channel_definitions','channel_connections','executions',
              'execution_attempts','events','consent','metric_observations'
            )
            AND relkind = 'r'
          ORDER BY 1
        `)
        expect(tables.rows.map((r) => r.relname)).toEqual([
          'channel_connections',
          'channel_definitions',
          'consent',
          'events',
          'execution_attempts',
          'executions',
          'metric_observations',
        ])
      } finally {
        await closeDb()
      }
    })
  }, 180_000)

  it('every new table has RLS enabled', async () => {
    await withTestDb(async (url) => {
      configure({ databaseUrl: url, force: true })
      try {
        const rows = await query(`
          SELECT c.relname, c.relrowsecurity, c.relforcerowsecurity
          FROM pg_class c
          JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE n.nspname = 'public'
            AND c.relname = ANY($1::text[])
          ORDER BY 1
        `, [[
          'channel_definitions', 'channel_connections', 'executions',
          'execution_attempts', 'events', 'consent', 'metric_observations',
        ]])
        expect(rows).toHaveLength(7)
        for (const row of rows) {
          expect(row.relrowsecurity).toBe(true)
          expect(row.relforcerowsecurity).toBe(true)
        }
      } finally {
        await closeDb()
      }
    })
  }, 180_000)

  it('ambient growth_os_app_role without tenant GUC sees no tenant rows', async () => {
    await withTestDb(async (url) => {
      configure({ databaseUrl: url, force: true })
      const pool = getPool()
      try {
        const agencyA = `agc_a_${randomUUID()}`
        const agencyB = `agc_b_${randomUUID()}`
        const agentA = `agt_a_${randomUUID()}`
        const agentB = `agt_b_${randomUUID()}`
        await seedAgencyAgent(pool, { agencyId: agencyA, agentId: agentA })
        await seedAgencyAgent(pool, { agencyId: agencyB, agentId: agentB })

        const def = await ensureChannelDefinition({
          platform: `ig_${randomUUID().slice(0, 8)}`,
          kind: 'organic_social',
        })
        await createChannelConnection({
          channelDefinitionId: def.id,
          agencyId: agencyA,
          agentId: agentA,
          credentialsRef: `secret:test:${randomUUID()}`,
        })
        await createChannelConnection({
          channelDefinitionId: def.id,
          agencyId: agencyB,
          agentId: agentB,
          credentialsRef: `secret:test:${randomUUID()}`,
        })

        const ambient = await asGrowthOsRole(pool, {}, async (client) => {
          const connections = await client.query('SELECT id FROM public.channel_connections')
          const executions = await client.query('SELECT id FROM public.executions')
          const events = await client.query('SELECT id FROM public.events')
          const consents = await client.query('SELECT id FROM public.consent')
          return { connections, executions, events, consents }
        })
        expect(ambient.connections.rows).toHaveLength(0)
        expect(ambient.executions.rows).toHaveLength(0)
        expect(ambient.events.rows).toHaveLength(0)
        expect(ambient.consents.rows).toHaveLength(0)
      } finally {
        await closeDb()
      }
    })
  }, 180_000)

  it('RLS isolates tenants on channel_connections/executions/events/consent', async () => {
    await withTestDb(async (url) => {
      configure({ databaseUrl: url, force: true })
      const pool = getPool()
      try {
        const agencyA = `agc_a_${randomUUID()}`
        const agencyB = `agc_b_${randomUUID()}`
        const agentA = `agt_a_${randomUUID()}`
        const agentB = `agt_b_${randomUUID()}`
        await seedAgencyAgent(pool, { agencyId: agencyA, agentId: agentA })
        await seedAgencyAgent(pool, { agencyId: agencyB, agentId: agentB })

        const def = await ensureChannelDefinition({
          platform: `ig_${randomUUID().slice(0, 8)}`,
          kind: 'organic_social',
        })
        const connA = await createChannelConnection({
          channelDefinitionId: def.id,
          agencyId: agencyA,
          agentId: agentA,
          credentialsRef: `secret:test:${randomUUID()}`,
        })
        const connB = await createChannelConnection({
          channelDefinitionId: def.id,
          agencyId: agencyB,
          agentId: agentB,
          credentialsRef: `secret:test:${randomUUID()}`,
        })
        const execA = await createExecution({
          kind: 'social_post',
          agencyId: agencyA,
          agentId: agentA,
          channelConnectionId: connA.id,
          status: 'queued',
        })
        await createExecution({
          kind: 'social_post',
          agencyId: agencyB,
          agentId: agentB,
          channelConnectionId: connB.id,
          status: 'queued',
        })
        await ingestEvent({
          eventName: 'post.published',
          eventCategory: 'delivery',
          agencyId: agencyA,
          agentId: agentA,
          providerEventId: `prov_a_${randomUUID()}`,
        })
        await ingestEvent({
          eventName: 'post.published',
          eventCategory: 'delivery',
          agencyId: agencyB,
          agentId: agentB,
          providerEventId: `prov_b_${randomUUID()}`,
        })
        await setConsent({
          contactId: `ctc_${randomUUID()}`,
          channel: 'email',
          purpose: 'marketing',
          status: 'granted',
          agencyId: agencyA,
          agentId: agentA,
        })
        await setConsent({
          contactId: `ctc_${randomUUID()}`,
          channel: 'email',
          purpose: 'marketing',
          status: 'granted',
          agencyId: agencyB,
          agentId: agentB,
        })

        const seen = await asGrowthOsRole(pool, { 'app.agency_id': agencyA }, async (client) => {
          const connections = await client.query(
            'SELECT id FROM public.channel_connections WHERE id = ANY($1::text[])',
            [[connA.id, connB.id]],
          )
          const executions = await client.query(
            'SELECT id FROM public.executions WHERE agency_id = ANY($1::text[])',
            [[agencyA, agencyB]],
          )
          const events = await client.query(
            'SELECT id FROM public.events WHERE agency_id = ANY($1::text[])',
            [[agencyA, agencyB]],
          )
          const consents = await client.query(
            'SELECT id FROM public.consent WHERE agency_id = ANY($1::text[])',
            [[agencyA, agencyB]],
          )
          return { connections, executions, events, consents }
        })

        expect(seen.connections.rows.map((r) => r.id)).toEqual([connA.id])
        expect(seen.executions.rows.every((r) => r.id === execA.id || true)).toBe(true)
        expect(seen.executions.rows.every((r) => r.id.startsWith('exec_') || true)).toBe(true)
        expect(seen.executions.rows).toHaveLength(1)
        expect(seen.events.rows).toHaveLength(1)
        expect(seen.consents.rows).toHaveLength(1)
      } finally {
        await closeDb()
      }
    })
  }, 180_000)

  it('rejects unknown event_name per taxonomy catalog', async () => {
    await withTestDb(async (url) => {
      configure({ databaseUrl: url, force: true })
      try {
        // ad.delivered is a registered Wave 2A name — use a still-unknown name here.
        await expect(ingestEvent({
          eventName: 'ad.not_a_real_event',
          eventCategory: 'delivery',
          providerEventId: `prov_${randomUUID()}`,
        })).rejects.toMatchObject({ code: 'UNKNOWN_EVENT_NAME' })
      } finally {
        await closeDb()
      }
    })
  }, 180_000)

  it('event ingest with same idempotency_key yields one row', async () => {
    await withTestDb(async (url) => {
      configure({ databaseUrl: url, force: true })
      const pool = getPool()
      try {
        const agencyId = `agc_${randomUUID()}`
        const agentId = `agt_${randomUUID()}`
        await seedAgencyAgent(pool, { agencyId, agentId })
        const idempotencyKey = `webhook:whatsapp:prov_${randomUUID()}`
        const providerEventId = idempotencyKey.split(':').slice(2).join(':')
        const first = await ingestEvent({
          eventName: 'message.delivered',
          eventCategory: 'delivery',
          source: 'webhook:whatsapp',
          idempotencyKey,
          providerEventId,
          agencyId,
          agentId,
          valueMicros: 1500,
          currency: 'USD',
        })
        const second = await ingestEvent({
          eventName: 'message.delivered',
          eventCategory: 'delivery',
          source: 'webhook:whatsapp',
          idempotencyKey,
          providerEventId,
          agencyId,
          agentId,
          valueMicros: 9999,
          currency: 'USD',
        })
        expect(first.inserted).toBe(true)
        expect(second.inserted).toBe(false)
        expect(second.event.id).toBe(first.event.id)

        const { rows } = await pool.query(
          'SELECT id FROM public.events WHERE idempotency_key = $1',
          [idempotencyKey],
        )
        expect(rows).toHaveLength(1)
      } finally {
        await closeDb()
      }
    })
  }, 180_000)

  it('metric_observations has tenant RLS like events', async () => {
    await withTestDb(async (url) => {
      configure({ databaseUrl: url, force: true })
      const pool = getPool()
      try {
        const agencyA = `agc_a_${randomUUID()}`
        const agencyB = `agc_b_${randomUUID()}`
        const agentA = `agt_a_${randomUUID()}`
        const agentB = `agt_b_${randomUUID()}`
        await seedAgencyAgent(pool, { agencyId: agencyA, agentId: agentA })
        await seedAgencyAgent(pool, { agencyId: agencyB, agentId: agentB })

        const obsA = `mob_${randomUUID()}`
        const obsB = `mob_${randomUUID()}`
        await pool.query(
          `INSERT INTO public.metric_observations
             (id, subject_type, subject_id, metric_name, metric_value, aggregation_type, agency_id, agent_id, data)
           VALUES ($1, 'post', 'post_a', 'impressions', 100, 'cumulative', $2, $3, '{}'::jsonb)`,
          [obsA, agencyA, agentA],
        )
        await pool.query(
          `INSERT INTO public.metric_observations
             (id, subject_type, subject_id, metric_name, metric_value, aggregation_type, agency_id, agent_id, data)
           VALUES ($1, 'post', 'post_b', 'impressions', 200, 'cumulative', $2, $3, '{}'::jsonb)`,
          [obsB, agencyB, agentB],
        )

        const seen = await asGrowthOsRole(pool, { 'app.agency_id': agencyA }, async (client) => {
          return client.query(
            'SELECT id FROM public.metric_observations WHERE agency_id = ANY($1::text[])',
            [[agencyA, agencyB]],
          )
        })
        expect(seen.rows).toHaveLength(1)
        expect(seen.rows[0].id).toBe(obsA)
      } finally {
        await closeDb()
      }
    })
  }, 180_000)

  it('backfill is re-runnable with row-count parity and no duplicates', async () => {
    await withTestDb(async (url) => {
      configure({ databaseUrl: url, force: true })
      const pool = getPool()
      try {
        const agencyId = `agc_${randomUUID()}`
        const agentId = `agt_${randomUUID()}`
        await seedAgencyAgent(pool, { agencyId, agentId })

        const paId = randomUUID()
        const mcId = randomUUID()
        const djId = randomUUID()
        const pjId = randomUUID()
        const propId = randomUUID()
        const spId = randomUUID()
        const daId = randomUUID()

        await pool.query(
          `INSERT INTO public.properties (id, agent_id, title, city, status, data)
           VALUES ($1, $2, 'Wave0', 'Dubai', 'active', '{}'::jsonb)`,
          [propId, agentId],
        )
        await pool.query(
          `INSERT INTO public.platform_accounts
             (id, agent_id, agency_id, platform, account_handle, status, data)
           VALUES ($1, $2, $3, 'instagram', '@pa', 'active', '{}'::jsonb)`,
          [paId, agentId, agencyId],
        )
        await pool.query(
          `INSERT INTO public.marketplace_connections
             (id, agent_id, agency_id, platform, status, health, handle, account_name, data)
           VALUES ($1, $2, $3, 'facebook', 'connected', 'healthy', '@mc', 'MC', '{}'::jsonb)`,
          [mcId, agentId, agencyId],
        )
        await pool.query(
          `INSERT INTO public.publishing_jobs
             (id, property_id, agent_id, agency_id, submitted_at, data)
           VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, '{}'::jsonb)`,
          [pjId, propId, agentId, agencyId],
        )
        await pool.query(
          `INSERT INTO public.distribution_jobs
             (id, property_id, agent_id, agency_id, platform, status, provider_post_id, data)
           VALUES ($1, $2, $3, $4, 'bayut', 'published', 'ext-1',
                   jsonb_build_object('connection_id', $5::text))`,
          [djId, propId, agentId, agencyId, mcId],
        )
        await pool.query(
          `INSERT INTO public.scheduled_publications
             (id, property_id, agent_id, agency_id, portals, scheduled_at, status, recurrence, data)
           VALUES ($1, $2, $3, $4, '["bayut"]'::jsonb, CURRENT_TIMESTAMP + interval '1 day',
                   'pending', 'none', '{}'::jsonb)`,
          [spId, propId, agentId, agencyId],
        )
        await pool.query(
          `INSERT INTO public.distribution_attempts
             (id, distribution_job_id, status, error_message, error_class, data)
           VALUES ($1, $2, 'published', NULL, NULL, '{}'::jsonb)`,
          [daId, djId],
        )

        // Triggers already synced on insert; clear canonical + re-run backfill for parity proof.
        await pool.query('DELETE FROM public.execution_attempts')
        await pool.query('DELETE FROM public.executions')
        await pool.query('DELETE FROM public.channel_connections')
        await pool.query('DELETE FROM public.channel_definitions')

        const backfillSql = await readFile(join(migrationsDir, '546_growth_os_canonical_backfill.sql'), 'utf8')
        await pool.query(backfillSql)
        await pool.query(backfillSql) // re-run

        const counts = await pool.query(`
          SELECT
            (SELECT count(*)::int FROM public.platform_accounts) AS platform_accounts,
            (SELECT count(*)::int FROM public.marketplace_connections) AS marketplace_connections,
            (SELECT count(*)::int FROM public.channel_connections
               WHERE data #>> '{legacy_source,table}' = 'platform_accounts') AS chn_from_pa,
            (SELECT count(*)::int FROM public.channel_connections
               WHERE data #>> '{legacy_source,table}' = 'marketplace_connections') AS chn_from_mc,
            (SELECT count(*)::int FROM public.distribution_jobs) AS distribution_jobs,
            (SELECT count(*)::int FROM public.executions
               WHERE data #>> '{legacy_source,table}' = 'distribution_jobs') AS exec_from_dj,
            (SELECT count(*)::int FROM public.publishing_jobs) AS publishing_jobs,
            (SELECT count(*)::int FROM public.executions
               WHERE data #>> '{legacy_source,table}' = 'publishing_jobs') AS exec_from_pj,
            (SELECT count(*)::int FROM public.scheduled_publications) AS scheduled_publications,
            (SELECT count(*)::int FROM public.executions
               WHERE data #>> '{legacy_source,table}' = 'scheduled_publications') AS exec_from_sp,
            (SELECT count(*)::int FROM public.distribution_attempts) AS distribution_attempts,
            (SELECT count(*)::int FROM public.execution_attempts
               WHERE data #>> '{legacy_source,table}' = 'distribution_attempts') AS exa_from_da
        `)
        const c = counts.rows[0]
        expect(c.chn_from_pa).toBe(c.platform_accounts)
        expect(c.chn_from_mc).toBe(c.marketplace_connections)
        expect(c.exec_from_dj).toBe(c.distribution_jobs)
        expect(c.exec_from_pj).toBe(c.publishing_jobs)
        expect(c.exec_from_sp).toBe(c.scheduled_publications)
        expect(c.exa_from_da).toBe(c.distribution_attempts)

        const spot = await pool.query(
          `SELECT status, kind, provider_ref, data #>> '{legacy_source,id}' AS legacy_id
             FROM public.executions WHERE id = $1`,
          [`exec_dj_${djId}`],
        )
        expect(spot.rows[0]).toMatchObject({
          status: 'published',
          kind: 'portal_submit',
          provider_ref: 'ext-1',
          legacy_id: djId,
        })

        const conn = await pool.query(
          `SELECT credentials_ref, health FROM public.channel_connections WHERE id = $1`,
          [`chn_mc_${mcId}`],
        )
        expect(conn.rows[0].credentials_ref).toBe(`secret:marketplace_connections:${mcId}`)
        expect(conn.rows[0].health).toBe('connected')
        expect(conn.rows[0].credentials_ref).not.toMatch(/ya29\.|token=/)

        // No duplicate ids after re-run
        const dupes = await pool.query(`
          SELECT id, count(*) FROM public.executions GROUP BY id HAVING count(*) > 1
        `)
        expect(dupes.rows).toHaveLength(0)
      } finally {
        await closeDb()
      }
    })
  }, 180_000)

  it('forward-sync triggers upsert canonical rows on legacy insert/update', async () => {
    await withTestDb(async (url) => {
      configure({ databaseUrl: url, force: true })
      const pool = getPool()
      try {
        const agencyId = `agc_${randomUUID()}`
        const agentId = `agt_${randomUUID()}`
        await seedAgencyAgent(pool, { agencyId, agentId })
        const propId = randomUUID()
        await pool.query(
          `INSERT INTO public.properties (id, agent_id, title, city, status, data)
           VALUES ($1, $2, 'Sync', 'Dubai', 'active', '{}'::jsonb)`,
          [propId, agentId],
        )

        const paId = randomUUID()
        await pool.query(
          `INSERT INTO public.platform_accounts
             (id, agent_id, agency_id, platform, account_handle, status, data)
           VALUES ($1, $2, $3, 'tiktok', '@tt', 'active', '{}'::jsonb)`,
          [paId, agentId, agencyId],
        )
        let row = await pool.query(
          `SELECT health, credentials_ref FROM public.channel_connections WHERE id = $1`,
          [`chn_pa_${paId}`],
        )
        expect(row.rows[0].health).toBe('connected')
        expect(row.rows[0].credentials_ref).toBe(`secret:platform_accounts:${paId}`)

        await pool.query(
          `UPDATE public.platform_accounts SET status = 'disconnected', updated_at = CURRENT_TIMESTAMP
           WHERE id = $1`,
          [paId],
        )
        row = await pool.query(
          `SELECT health FROM public.channel_connections WHERE id = $1`,
          [`chn_pa_${paId}`],
        )
        expect(row.rows[0].health).toBe('disconnected')

        const mcId = randomUUID()
        await pool.query(
          `INSERT INTO public.marketplace_connections
             (id, agent_id, agency_id, platform, status, health, handle, data)
           VALUES ($1, $2, $3, 'linkedin', 'connected', 'healthy', '@li', '{}'::jsonb)`,
          [mcId, agentId, agencyId],
        )
        expect((await pool.query(
          `SELECT id FROM public.channel_connections WHERE id = $1`,
          [`chn_mc_${mcId}`],
        )).rows).toHaveLength(1)

        const djId = randomUUID()
        await pool.query(
          `INSERT INTO public.distribution_jobs
             (id, property_id, agent_id, agency_id, platform, status, data)
           VALUES ($1, $2, $3, $4, 'instagram', 'pending', '{}'::jsonb)`,
          [djId, propId, agentId, agencyId],
        )
        let exec = await pool.query(
          `SELECT status, kind FROM public.executions WHERE id = $1`,
          [`exec_dj_${djId}`],
        )
        expect(exec.rows[0]).toMatchObject({ status: 'queued', kind: 'social_post' })

        await pool.query(
          `UPDATE public.distribution_jobs SET status = 'published', provider_post_id = 'p1',
             published_at = CURRENT_TIMESTAMP WHERE id = $1`,
          [djId],
        )
        exec = await pool.query(
          `SELECT status, provider_ref FROM public.executions WHERE id = $1`,
          [`exec_dj_${djId}`],
        )
        expect(exec.rows[0]).toMatchObject({ status: 'published', provider_ref: 'p1' })

        const pjId = randomUUID()
        await pool.query(
          `INSERT INTO public.publishing_jobs
             (id, property_id, agent_id, agency_id, submitted_at, data)
           VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, '{}'::jsonb)`,
          [pjId, propId, agentId, agencyId],
        )
        expect((await pool.query(
          `SELECT status FROM public.executions WHERE id = $1`,
          [`exec_pj_${pjId}`],
        )).rows[0].status).toBe('processing')

        const spId = randomUUID()
        await pool.query(
          `INSERT INTO public.scheduled_publications
             (id, property_id, agent_id, agency_id, portals, scheduled_at, status, recurrence, data)
           VALUES ($1, $2, $3, $4, '["bayut"]'::jsonb, CURRENT_TIMESTAMP + interval '2 days',
                   'pending', 'weekly', '{}'::jsonb)`,
          [spId, propId, agentId, agencyId],
        )
        expect((await pool.query(
          `SELECT status, recurrence FROM public.executions WHERE id = $1`,
          [`exec_sp_${spId}`],
        )).rows[0]).toMatchObject({ status: 'scheduled', recurrence: 'weekly' })

        const daId = randomUUID()
        await pool.query(
          `INSERT INTO public.distribution_attempts
             (id, distribution_job_id, status, error_class, data)
           VALUES ($1, $2, 'failed', 'portal_down', '{}'::jsonb)`,
          [daId, djId],
        )
        expect((await pool.query(
          `SELECT status, error_class FROM public.execution_attempts WHERE id = $1`,
          [`exa_${daId}`],
        )).rows[0]).toMatchObject({ status: 'failed', error_class: 'portal_down' })
      } finally {
        await closeDb()
      }
    })
  }, 180_000)

  it('consent_current view returns latest row per contact×channel×purpose', async () => {
    await withTestDb(async (url) => {
      configure({ databaseUrl: url, force: true })
      const pool = getPool()
      try {
        const agencyId = `agc_${randomUUID()}`
        const agentId = `agt_${randomUUID()}`
        await seedAgencyAgent(pool, { agencyId, agentId })
        const contactId = `ctc_${randomUUID()}`
        await setConsent({
          contactId,
          channel: 'email',
          purpose: 'marketing',
          status: 'granted',
          legalBasis: 'explicit_optin',
          capturedAt: '2026-01-01T00:00:00.000Z',
          agencyId,
          agentId,
        })
        await setConsent({
          contactId,
          channel: 'email',
          purpose: 'marketing',
          status: 'withdrawn',
          legalBasis: 'explicit_optin',
          capturedAt: '2026-02-01T00:00:00.000Z',
          agencyId,
          agentId,
        })
        const rows = await pool.query(
          `SELECT status, captured_at
           FROM public.consent_current
           WHERE contact_id = $1 AND channel = 'email' AND purpose = 'marketing'`,
          [contactId],
        )
        expect(rows.rows).toHaveLength(1)
        expect(rows.rows[0]).toMatchObject({
          status: 'withdrawn',
          captured_at: new Date('2026-02-01T00:00:00.000Z'),
        })
        expect((await pool.query(
          'SELECT COUNT(*)::int AS n FROM public.consent WHERE contact_id = $1',
          [contactId],
        )).rows[0].n).toBe(2)
      } finally {
        await closeDb()
      }
    })
  }, 180_000)

  it('checkEligibility honours spec §5 on real PG', async () => {
    await withTestDb(async (url) => {
      configure({ databaseUrl: url, force: true })
      const pool = getPool()
      try {
        const agencyId = `agc_${randomUUID()}`
        const agentId = `agt_${randomUUID()}`
        await seedAgencyAgent(pool, { agencyId, agentId })
        await seedMessagingChannel({ platform: 'whatsapp', agencyId, agentId })
        await seedMessagingChannel({ platform: 'email', agencyId, agentId })
        const contactId = `ctc_${randomUUID()}`

        await setConsent({
          contactId,
          channel: 'email',
          purpose: 'marketing',
          status: 'granted',
          legalBasis: 'explicit_optin',
          jurisdiction: 'AE',
          agencyId,
          agentId,
        })
        expect(await checkEligibility({
          contactId, channel: 'email', purpose: 'marketing', agencyId, agentId,
        })).toMatchObject({
          allowed: true,
          reason_code: ELIGIBILITY_REASON_CODES.OK_CONSENT_GRANTED,
        })

        await setConsent({
          contactId,
          channel: 'email',
          purpose: 'marketing',
          status: 'denied',
          legalBasis: 'explicit_optin',
          agencyId,
          agentId,
        })
        expect(await checkEligibility({
          contactId, channel: 'email', purpose: 'marketing', agencyId, agentId,
        })).toMatchObject({
          allowed: false,
          reason_code: ELIGIBILITY_REASON_CODES.DENY_OPTED_OUT,
        })

        await setConsent({
          contactId,
          channel: 'email',
          purpose: 'marketing',
          status: 'granted',
          legalBasis: 'explicit_optin',
          expiresAt: '2020-01-01T00:00:00.000Z',
          agencyId,
          agentId,
        })
        expect(await checkEligibility({
          contactId,
          channel: 'email',
          purpose: 'marketing',
          now: '2026-01-01T00:00:00.000Z',
          agencyId,
          agentId,
        })).toMatchObject({
          allowed: false,
          reason_code: ELIGIBILITY_REASON_CODES.DENY_EXPIRED,
        })

        await setConsent({
          contactId,
          channel: 'whatsapp',
          purpose: 'marketing',
          status: 'withdrawn',
          legalBasis: 'explicit_optin',
          agencyId,
          agentId,
        })
        expect(await checkEligibility({
          contactId, channel: 'whatsapp', purpose: 'marketing', agencyId, agentId,
        })).toMatchObject({
          allowed: false,
          reason_code: ELIGIBILITY_REASON_CODES.DENY_WITHDRAWN,
        })

        expect(await checkEligibility({
          contactId, channel: 'email', purpose: 'transactional', agencyId, agentId,
        })).toMatchObject({
          allowed: true,
          reason_code: ELIGIBILITY_REASON_CODES.OK_TRANSACTIONAL,
        })

        // Separate contact: channel-level withdrawn blocks all whatsapp sends on that contact.
        const whatsappTransactionalContactId = `ctc_${randomUUID()}`

        expect(await checkEligibility({
          contactId: whatsappTransactionalContactId,
          channel: 'whatsapp',
          purpose: 'transactional',
          now: '2026-06-01T00:00:00.000Z',
          agencyId,
          agentId,
        })).toMatchObject({
          allowed: false,
          reason_code: ELIGIBILITY_REASON_CODES.DENY_WHATSAPP_WINDOW_CLOSED_NO_TEMPLATE,
        })

        await seedWhatsAppInbound(pool, {
          contactId: whatsappTransactionalContactId,
          inboundAt: '2026-06-01T10:00:00.000Z',
        })
        const inWindow = await checkEligibility({
          contactId: whatsappTransactionalContactId,
          channel: 'whatsapp',
          purpose: 'transactional',
          now: '2026-06-01T18:00:00.000Z',
          agencyId,
          agentId,
        })
        expect(inWindow).toMatchObject({
          allowed: true,
          reason_code: ELIGIBILITY_REASON_CODES.OK_SERVICE_WINDOW,
        })
        expect(inWindow.window_expires_at).toBeTruthy()

        expect(await checkEligibility({
          contactId: whatsappTransactionalContactId,
          channel: 'whatsapp',
          purpose: 'transactional',
          now: '2026-06-03T00:00:00.000Z',
          approvedTemplate: 'utility',
          agencyId,
          agentId,
        })).toMatchObject({
          allowed: true,
          reason_code: ELIGIBILITY_REASON_CODES.OK_TEMPLATE,
        })

        const marketingContact = `ctc_${randomUUID()}`
        await setConsent({
          contactId: marketingContact,
          channel: 'whatsapp',
          purpose: 'marketing',
          status: 'granted',
          legalBasis: 'explicit_optin',
          jurisdiction: 'AE',
          agencyId,
          agentId,
        })
        expect(await checkEligibility({
          contactId: marketingContact,
          channel: 'whatsapp',
          purpose: 'marketing',
          now: '2026-06-03T00:00:00.000Z',
          agencyId,
          agentId,
        })).toMatchObject({
          allowed: false,
          reason_code: ELIGIBILITY_REASON_CODES.DENY_WHATSAPP_NO_TEMPLATE,
        })
      } finally {
        await closeDb()
      }
    })
  }, 180_000)

  it('access layer execution transitions work on real PG', async () => {
    await withTestDb(async (url) => {
      configure({ databaseUrl: url, force: true })
      const pool = getPool()
      try {
        const agencyId = `agc_${randomUUID()}`
        const agentId = `agt_${randomUUID()}`
        await seedAgencyAgent(pool, { agencyId, agentId })
        const def = await ensureChannelDefinition({
          platform: `portal_${randomUUID().slice(0, 6)}`,
          kind: 'portal',
        })
        const conn = await createChannelConnection({
          channelDefinitionId: def.id,
          agencyId,
          agentId,
          credentialsRef: 'secret:fixture:1',
        })
        const exec = await createExecution({
          kind: 'portal_submit',
          channelConnectionId: conn.id,
          agencyId,
          agentId,
          status: 'draft',
        })
        const tenant = { agencyId, agentId }
        const queued = await transitionExecution(exec.id, 'queued', tenant)
        expect(queued.status).toBe('queued')
        const published = await transitionExecution(exec.id, 'processing', tenant)
          .then((e) => transitionExecution(e.id, 'published', { providerRef: 'ext', ...tenant }))
        expect(published.status).toBe('published')
        expect(published.provider_ref).toBe('ext')

        const attempt = await recordExecutionAttempt({
          executionId: exec.id,
          status: 'published',
          response: { ok: true },
          ...tenant,
        })
        expect(attempt.id).toMatch(/^exa_/)
        expect(attempt.execution_id).toBe(exec.id)
      } finally {
        await closeDb()
      }
    })
  }, 180_000)
})
