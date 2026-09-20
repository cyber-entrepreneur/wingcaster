/**
 * Wave 1A — Real-PG coverage for journeys schema, RLS, engine, and campaigns compat.
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
  ELIGIBILITY_REASON_CODES,
  ensureChannelDefinition,
  listExecutions,
  listEvents,
  setConsent,
} from '../../lib/growth-os/index.js'
import {
  createJourney,
  enrollContact,
  getJourney,
  listNodeRuns,
  stepsToGraph,
  traverseRun,
} from './index.js'

const migrationsDir = join(dirname(fileURLToPath(import.meta.url)), '../../persistence/migrations')

const WAVE1A_FILES = [
  '600_journey_enums.sql',
  '601_journey_tables.sql',
  '602_campaigns_journeys_compat.sql',
]

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
     VALUES ($1, $2, 'Wave1A', '{}'::jsonb)
     ON CONFLICT (id) DO NOTHING`,
    [userId, `${userId}@wave1a.test`],
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
    [agentId, userId, `${agentId}@wave1a.test`, agencyId],
  )
}

async function seedMessagingChannel({ platform, agencyId = null, agentId = null }) {
  const def = await ensureChannelDefinition({ platform, kind: 'owned_messaging' })
  await createChannelConnection({
    channelDefinitionId: def.id,
    agencyId,
    agentId,
    credentialsRef: `secret:fixture:${platform}`,
    health: 'connected',
  })
  return def
}

async function seedContact(pool, { contactId, agencyId, agentId, tags = ['buyer'] }) {
  await pool.query(
    `INSERT INTO public.contacts (id, name, email, assigned_agent_id, agency_id, tags, data)
     VALUES ($1, 'Test Contact', $2, $3, $4, $5::jsonb, '{}'::jsonb)
     ON CONFLICT (id) DO NOTHING`,
    [contactId, `${contactId}@test.com`, agentId, agencyId, JSON.stringify(tags)],
  )
}

skipIfNoPostgres()('journeys wave 1a', () => {
  it('migrations are idempotent when SQL is re-applied', async () => {
    await withTestDb(async (url) => {
      configure({ databaseUrl: url, force: true })
      const pool = getPool()
      try {
        for (const file of WAVE1A_FILES) {
          const sql = await readFile(join(migrationsDir, file), 'utf8')
          await pool.query(sql)
          await pool.query(sql)
        }
        const tables = await pool.query(`
          SELECT relname FROM pg_class c
          JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE n.nspname = 'public'
            AND relname IN ('journeys','journey_versions','journey_runs','journey_node_runs')
            AND relkind = 'r'
          ORDER BY 1
        `)
        expect(tables.rows.map((r) => r.relname)).toEqual([
          'journey_node_runs',
          'journey_runs',
          'journey_versions',
          'journeys',
        ])
      } finally {
        await closeDb()
      }
    })
  }, 180_000)

  it('ambient growth_os_app_role without tenant GUC sees no journey rows', async () => {
    await withTestDb(async (url) => {
      configure({ databaseUrl: url, force: true })
      const pool = getPool()
      try {
        const agencyId = `agc_${randomUUID()}`
        const agentId = `agt_${randomUUID()}`
        await seedAgencyAgent(pool, { agencyId, agentId })

        await createJourney({
          name: 'RLS test journey',
          status: 'active',
          steps: [{ delay_hours: 0, channel: 'email', subject: 'Hi', body: 'Test' }],
          agencyId,
          agentId,
        })

        const ambient = await asGrowthOsRole(pool, {}, async (client) => {
          const journeys = await client.query('SELECT id FROM public.journeys')
          const versions = await client.query('SELECT id FROM public.journey_versions')
          const runs = await client.query('SELECT id FROM public.journey_runs')
          const nodeRuns = await client.query('SELECT id FROM public.journey_node_runs')
          return { journeys, versions, runs, nodeRuns }
        })
        expect(ambient.journeys.rows).toHaveLength(0)
        expect(ambient.versions.rows).toHaveLength(0)
        expect(ambient.runs.rows).toHaveLength(0)
        expect(ambient.nodeRuns.rows).toHaveLength(0)
      } finally {
        await closeDb()
      }
    })
  }, 180_000)

  it('traverses wait→condition→send and records node runs', async () => {
    await withTestDb(async (url) => {
      configure({ databaseUrl: url, force: true })
      const pool = getPool()
      try {
        const agencyId = `agc_${randomUUID()}`
        const agentId = `agt_${randomUUID()}`
        const contactId = `cnt_${randomUUID()}`
        await seedAgencyAgent(pool, { agencyId, agentId })
        await seedContact(pool, { contactId, agencyId, agentId })
        await seedMessagingChannel({ platform: 'email', agencyId, agentId })

        await setConsent({
          contactId,
          channel: 'email',
          purpose: 'marketing',
          status: 'granted',
          legalBasis: 'explicit_optin',
          agencyId,
          agentId,
        })

        const graph = {
          nodes: [
            { id: 'n_trigger', type: 'trigger', config: {} },
            { id: 'n_wait', type: 'wait', config: { hours: 0 } },
            { id: 'n_cond', type: 'condition', config: { field: 'tags', operator: 'contains', value: 'buyer', true_next: 'n_send', false_next: 'n_exit' } },
            { id: 'n_send', type: 'send', config: { channel: 'email', subject: 'Hi', body: 'Hello' } },
            { id: 'n_exit', type: 'exit', config: {} },
          ],
          edges: [
            { from: 'n_trigger', to: 'n_wait' },
            { from: 'n_wait', to: 'n_cond' },
            { from: 'n_send', to: 'n_exit' },
          ],
        }

        const { current_version: version } = await createJourney({
          name: 'Branch test',
          status: 'active',
          graph,
          agencyId,
          agentId,
        })

        const run = await enrollContact({
          journeyId: version.journey_id,
          contactId,
          agencyId,
          agentId,
        })

        const { run: finalRun, nodeRuns } = await traverseRun(run.id, { agencyId, agentId })
        expect(['completed', 'exited']).toContain(finalRun.status)
        expect(nodeRuns.some((nr) => nr.node_type === 'wait')).toBe(true)
        expect(nodeRuns.some((nr) => nr.node_type === 'condition')).toBe(true)
        expect(nodeRuns.some((nr) => nr.node_type === 'send')).toBe(true)

        const executions = await listExecutions({ agencyId, agentId })
        expect(executions.some((e) => e.kind === 'message')).toBe(true)

        const events = await listEvents({ agencyId, agentId })
        expect(events.some((e) => e.event_name === 'journey.entered')).toBe(true)
      } finally {
        await closeDb()
      }
    })
  }, 180_000)

  it('denied consent suppresses send without execution', async () => {
    await withTestDb(async (url) => {
      configure({ databaseUrl: url, force: true })
      const pool = getPool()
      try {
        const agencyId = `agc_${randomUUID()}`
        const agentId = `agt_${randomUUID()}`
        const contactId = `cnt_${randomUUID()}`
        await seedAgencyAgent(pool, { agencyId, agentId })
        await seedContact(pool, { contactId, agencyId, agentId })
        await seedMessagingChannel({ platform: 'email', agencyId, agentId })

        const { current_version: version } = await createJourney({
          name: 'Consent deny test',
          status: 'active',
          steps: [{ delay_hours: 0, channel: 'email', subject: 'Hi', body: 'No consent' }],
          agencyId,
          agentId,
        })

        const eligibility = await checkEligibility({
          contactId,
          channel: 'email',
          purpose: 'marketing',
          agencyId,
          agentId,
        })
        expect(eligibility.allowed).toBe(false)
        expect(eligibility.reason_code).toBe(ELIGIBILITY_REASON_CODES.DENY_NO_CONSENT)

        const run = await enrollContact({
          journeyId: version.journey_id,
          contactId,
          agencyId,
          agentId,
        })

        const { run: finalRun } = await traverseRun(run.id, { agencyId, agentId })
        expect(finalRun.status).toBe('suppressed')

        const nodeRuns = await listNodeRuns({ journeyRunId: run.id, agencyId, agentId })
        const sendRun = nodeRuns.find((nr) => nr.node_type === 'send')
        expect(sendRun?.result?.outcome).toBe('suppressed')
        expect(sendRun?.execution_id).toBeFalsy()

        const executions = await listExecutions({ agencyId, agentId })
        expect(executions.filter((e) => e.kind === 'message')).toHaveLength(0)

        const events = await listEvents({ agencyId, agentId })
        expect(events.some((e) => e.event_name === 'journey.node.suppressed')).toBe(true)
      } finally {
        await closeDb()
      }
    })
  }, 180_000)

  it('campaigns forward-sync creates journey rows', async () => {
    await withTestDb(async (url) => {
      configure({ databaseUrl: url, force: true })
      const pool = getPool()
      try {
        const agencyId = `agc_${randomUUID()}`
        const agentId = `agt_${randomUUID()}`
        const campaignId = `cmp_${randomUUID()}`
        await seedAgencyAgent(pool, { agencyId, agentId })

        await pool.query(
          `INSERT INTO public.campaigns (id, agency_id, agent_id, name, status, trigger, steps, data)
           VALUES ($1, $2, $3, 'Legacy campaign', 'active', 'manual',
             $4::jsonb, '{"target_channel":"email","tags_filter":["buyer"]}'::jsonb)`,
          [
            campaignId,
            agencyId,
            agentId,
            JSON.stringify([{ delay_hours: 0, channel: 'email', subject: 'Hi', body: 'Test' }]),
          ],
        )

        const journey = await query(
          `SELECT id, legacy_campaign_id FROM public.journeys WHERE legacy_campaign_id = $1`,
          [campaignId],
        )
        expect(journey).toHaveLength(1)
        expect(journey[0].id).toBe(`jrn_${campaignId}`)

        const viewRows = await query(`SELECT id, name FROM public.campaigns_from_journeys WHERE id = $1`, [campaignId])
        expect(viewRows).toHaveLength(1)
        expect(viewRows[0].name).toBe('Legacy campaign')
      } finally {
        await closeDb()
      }
    })
  }, 180_000)
})
