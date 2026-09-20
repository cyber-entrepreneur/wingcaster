/**
 * Wave 2E — Real-PG coverage for ContactPolicy + journey engine extensions.
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
  ingestEvent,
  listEvents,
  setConsent,
  upsertContactPolicy,
} from '../../lib/growth-os/index.js'
import {
  createJourney,
  enrollContact,
  getRunWithNodeRuns,
  listTransitions,
  traverseRun,
} from '../../domain/journeys/index.js'

const migrationsDir = join(dirname(fileURLToPath(import.meta.url)), '../../persistence/migrations')

const WAVE2E_FILES = [
  '770_contact_policy_enums.sql',
  '771_contact_policies.sql',
  '772_journey_transitions.sql',
  '773_journey_reentry_expand.sql',
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
     VALUES ($1, $2, 'Wave2E', '{}'::jsonb)
     ON CONFLICT (id) DO NOTHING`,
    [userId, `${userId}@wave2e.test`],
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
    [agentId, userId, `${agentId}@wave2e.test`, agencyId],
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

async function grantMarketing({ contactId, channel, agencyId, agentId }) {
  await setConsent({
    contactId,
    channel,
    purpose: 'marketing',
    status: 'granted',
    legalBasis: 'explicit_optin',
    agencyId,
    agentId,
  })
}

skipIfNoPostgres()('wave 2e contact policy + journey engine', () => {
  it('migrations are idempotent when SQL is re-applied', async () => {
    await withTestDb(async (url) => {
      configure({ databaseUrl: url, force: true })
      const pool = getPool()
      try {
        for (const file of WAVE2E_FILES) {
          const sql = await readFile(join(migrationsDir, file), 'utf8')
          await pool.query(sql)
          await pool.query(sql)
        }
        const tables = await pool.query(`
          SELECT relname FROM pg_class c
          JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE n.nspname = 'public'
            AND relname IN ('contact_policies','journey_transitions')
            AND relkind = 'r'
          ORDER BY 1
        `)
        expect(tables.rows.map((r) => r.relname)).toEqual([
          'contact_policies',
          'journey_transitions',
        ])
      } finally {
        await closeDb()
      }
    })
  }, 180_000)

  it('tenant isolation on contact_policies', async () => {
    await withTestDb(async (url) => {
      configure({ databaseUrl: url, force: true })
      const pool = getPool()
      try {
        const agencyA = `agc_${randomUUID()}`
        const agentA = `agt_${randomUUID()}`
        const agencyB = `agc_${randomUUID()}`
        const agentB = `agt_${randomUUID()}`
        await seedAgencyAgent(pool, { agencyId: agencyA, agentId: agentA })
        await seedAgencyAgent(pool, { agencyId: agencyB, agentId: agentB })

        await upsertContactPolicy({
          scope: 'agency',
          name: 'A caps',
          agencyId: agencyA,
          agentId: agentA,
          rules: {
            frequency_caps: [{ channel: 'whatsapp', purpose: 'marketing', max_sends: 2, window_hours: 24 }],
          },
        })

        const ambient = await asGrowthOsRole(pool, {}, async (client) => {
          const rows = await client.query('SELECT id FROM public.contact_policies')
          return rows.rows
        })
        expect(ambient).toHaveLength(0)

        const tenantA = await asGrowthOsRole(pool, { 'app.agency_id': agencyA }, async (client) => {
          const rows = await client.query('SELECT id, name FROM public.contact_policies')
          return rows.rows
        })
        expect(tenantA).toHaveLength(1)
        expect(tenantA[0].name).toBe('A caps')

        const tenantB = await asGrowthOsRole(pool, { 'app.agency_id': agencyB }, async (client) => {
          const rows = await client.query('SELECT id FROM public.contact_policies')
          return rows.rows
        })
        expect(tenantB).toHaveLength(0)
      } finally {
        await closeDb()
      }
    })
  }, 180_000)

  it('frequency cap denies 3rd promo WhatsApp in window', async () => {
    await withTestDb(async (url) => {
      configure({ databaseUrl: url, force: true })
      const pool = getPool()
      try {
        const agencyId = `agc_${randomUUID()}`
        const agentId = `agt_${randomUUID()}`
        const contactId = `cnt_${randomUUID()}`
        await seedAgencyAgent(pool, { agencyId, agentId })
        await seedContact(pool, { contactId, agencyId, agentId })
        await seedMessagingChannel({ platform: 'whatsapp', agencyId, agentId })
        await grantMarketing({ contactId, channel: 'whatsapp', agencyId, agentId })

        await upsertContactPolicy({
          scope: 'agency',
          agencyId,
          agentId,
          rules: {
            frequency_caps: [
              { channel: 'whatsapp', purpose: 'marketing', max_sends: 2, window_hours: 24 },
            ],
          },
        })

        for (let i = 0; i < 2; i++) {
          await ingestEvent({
            eventName: 'message.submitted',
            actorType: 'system',
            actorId: 'test',
            objectType: 'message',
            objectId: `msg_${i}_${randomUUID()}`,
            contactId,
            agencyId,
            agentId,
            context: { channel: 'whatsapp', purpose: 'marketing' },
            idempotencyKey: `wave2e.freq:${contactId}:${i}`,
          })
        }

        const third = await checkEligibility({
          contactId,
          channel: 'whatsapp',
          purpose: 'marketing',
          agencyId,
          agentId,
          approvedTemplate: 'marketing',
          skipChannelHealth: false,
        })
        expect(third.allowed).toBe(false)
        expect(third.reason_code).toBe(ELIGIBILITY_REASON_CODES.DENY_FREQUENCY_CAPPED)
        expect(third.frequency_reason).toBe('frequency_cap')
      } finally {
        await closeDb()
      }
    })
  }, 180_000)

  it('quiet hours and do-not-contact suppress eligibility', async () => {
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
        await grantMarketing({ contactId, channel: 'email', agencyId, agentId })

        const now = new Date()
        const hh = String(now.getUTCHours()).padStart(2, '0')
        const mm = String(now.getUTCMinutes()).padStart(2, '0')
        const startMin = (now.getUTCHours() * 60 + now.getUTCMinutes() + 24 * 60 - 30) % (24 * 60)
        const endMin = (now.getUTCHours() * 60 + now.getUTCMinutes() + 30) % (24 * 60)
        const toHm = (mins) => `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`

        await upsertContactPolicy({
          scope: 'agency',
          agencyId,
          agentId,
          rules: {
            quiet_hours: {
              timezone: 'UTC',
              windows: [{ days: [0, 1, 2, 3, 4, 5, 6], start: toHm(startMin), end: toHm(endMin) }],
            },
          },
        })

        const quiet = await checkEligibility({
          contactId,
          channel: 'email',
          purpose: 'marketing',
          agencyId,
          agentId,
          now,
        })
        expect(quiet.allowed).toBe(false)
        expect(quiet.reason_code).toBe(ELIGIBILITY_REASON_CODES.DENY_FREQUENCY_CAPPED)
        expect(quiet.frequency_reason).toBe('quiet_hours')

        await upsertContactPolicy({
          scope: 'agency',
          agencyId,
          agentId,
          rules: {
            do_not_contact_windows: [{
              start: new Date(now.getTime() - 3600_000).toISOString(),
              end: new Date(now.getTime() + 3600_000).toISOString(),
              channels: ['email'],
            }],
          },
        })

        const dnc = await checkEligibility({
          contactId,
          channel: 'email',
          purpose: 'marketing',
          agencyId,
          agentId,
          now,
        })
        expect(dnc.allowed).toBe(false)
        expect(dnc.reason_code).toBe(ELIGIBILITY_REASON_CODES.DENY_FREQUENCY_CAPPED)
        expect(dnc.frequency_reason).toBe('do_not_contact_window')
        expect(hh.length + mm.length).toBeGreaterThan(0)
      } finally {
        await closeDb()
      }
    })
  }, 180_000)

  it('event branch routes on message.replied vs not', async () => {
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
        await grantMarketing({ contactId, channel: 'email', agencyId, agentId })

        const graph = {
          nodes: [
            { id: 'n_trigger', type: 'trigger', config: {} },
            {
              id: 'n_cond',
              type: 'condition',
              config: {
                kind: 'event',
                event_name: 'message.replied',
                window_hours: 48,
                operator: 'occurred',
                true_next: 'n_send_yes',
                false_next: 'n_send_no',
              },
            },
            { id: 'n_send_yes', type: 'send', config: { channel: 'email', subject: 'Replied', body: 'Thanks' } },
            { id: 'n_send_no', type: 'send', config: { channel: 'email', subject: 'Nudge', body: 'Still there?' } },
            { id: 'n_exit', type: 'exit', config: {} },
          ],
          edges: [
            { from: 'n_trigger', to: 'n_cond' },
            { from: 'n_send_yes', to: 'n_exit' },
            { from: 'n_send_no', to: 'n_exit' },
          ],
        }

        const journey = await createJourney({
          name: 'Event branch',
          status: 'active',
          graph,
          agencyId,
          agentId,
        })

        // No reply → false branch
        const runNo = await enrollContact({
          journeyId: journey.id,
          contactId,
          agencyId,
          agentId,
        })
        const resultNo = await traverseRun(runNo.id, { agencyId, agentId })
        expect(resultNo.nodeRuns.some((nr) => nr.node_id === 'n_send_no')).toBe(true)
        expect(resultNo.nodeRuns.some((nr) => nr.node_id === 'n_send_yes')).toBe(false)

        // Reply then re-enter with allow
        await ingestEvent({
          eventName: 'message.replied',
          actorType: 'contact',
          actorId: contactId,
          objectType: 'message',
          objectId: `msg_${randomUUID()}`,
          contactId,
          agencyId,
          agentId,
          idempotencyKey: `wave2e.replied:${contactId}`,
        })

        await query(
          `UPDATE public.journeys SET reentry_rules = $1::jsonb WHERE id = $2`,
          [JSON.stringify({ allow: true, cooldown_hours: 0, max_entries: 5 }), journey.id],
        )

        const runYes = await enrollContact({
          journeyId: journey.id,
          contactId,
          agencyId,
          agentId,
        })
        const resultYes = await traverseRun(runYes.id, { agencyId, agentId })
        expect(resultYes.nodeRuns.some((nr) => nr.node_id === 'n_send_yes')).toBe(true)

        const transitions = await listTransitions({ journeyRunId: runYes.id, agencyId, agentId })
        expect(transitions.some((t) => t.reason?.matched === true)).toBe(true)
      } finally {
        await closeDb()
      }
    })
  }, 180_000)

  it('exit + re-entry rules behave', async () => {
    await withTestDb(async (url) => {
      configure({ databaseUrl: url, force: true })
      const pool = getPool()
      try {
        const agencyId = `agc_${randomUUID()}`
        const agentId = `agt_${randomUUID()}`
        const contactId = `cnt_${randomUUID()}`
        await seedAgencyAgent(pool, { agencyId, agentId })
        await seedContact(pool, { contactId, agencyId, agentId })

        const journey = await createJourney({
          name: 'Reentry',
          status: 'active',
          graph: {
            nodes: [
              { id: 'n_trigger', type: 'trigger', config: {} },
              { id: 'n_exit', type: 'exit', config: { reason: 'early_exit' } },
            ],
            edges: [{ from: 'n_trigger', to: 'n_exit' }],
          },
          reentryRules: { allow: false, cooldown_hours: 0, max_entries: 1 },
          agencyId,
          agentId,
        })

        const run = await enrollContact({ journeyId: journey.id, contactId, agencyId, agentId })
        const { run: finalRun } = await traverseRun(run.id, { agencyId, agentId })
        expect(finalRun.status).toBe('exited')

        let denied = null
        try {
          await enrollContact({ journeyId: journey.id, contactId, agencyId, agentId })
        } catch (err) {
          denied = err
        }
        expect(denied?.code).toMatch(/REENTRY_/)
      } finally {
        await closeDb()
      }
    })
  }, 180_000)

  it('frequency-capped journey send emits journey.node.suppressed', async () => {
    await withTestDb(async (url) => {
      configure({ databaseUrl: url, force: true })
      const pool = getPool()
      try {
        const agencyId = `agc_${randomUUID()}`
        const agentId = `agt_${randomUUID()}`
        const contactId = `cnt_${randomUUID()}`
        await seedAgencyAgent(pool, { agencyId, agentId })
        await seedContact(pool, { contactId, agencyId, agentId })
        const journey = await createJourney({
          name: 'Cap suppress',
          status: 'active',
          steps: [{ delay_hours: 0, channel: 'email', subject: 'Promo', body: 'Promo', purpose: 'marketing' }],
          agencyId,
          agentId,
        })

        await upsertContactPolicy({
          scope: 'agency',
          agencyId,
          agentId,
          rules: {
            frequency_caps: [
              { channel: 'email', purpose: 'marketing', max_sends: 0, window_hours: 24 },
            ],
          },
        })

        await seedMessagingChannel({ platform: 'email', agencyId, agentId })
        await grantMarketing({ contactId, channel: 'email', agencyId, agentId })

        const run = await enrollContact({ journeyId: journey.id, contactId, agencyId, agentId })
        const { run: finalRun, nodeRuns } = await traverseRun(run.id, { agencyId, agentId })
        expect(finalRun.status).toBe('suppressed')
        const send = nodeRuns.find((nr) => nr.node_type === 'send')
        expect(send?.result?.reason_code).toBe(ELIGIBILITY_REASON_CODES.DENY_FREQUENCY_CAPPED)

        const events = await listEvents({ agencyId, agentId, contactId })
        const suppressed = events.find((e) => e.event_name === 'journey.node.suppressed')
        expect(suppressed?.context?.reason_code).toBe(ELIGIBILITY_REASON_CODES.DENY_FREQUENCY_CAPPED)
      } finally {
        await closeDb()
      }
    })
  }, 180_000)

  it('run inspector reconstructs path from node_runs + transitions', async () => {
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
        await grantMarketing({ contactId, channel: 'email', agencyId, agentId })

        const graph = {
          nodes: [
            { id: 'n_trigger', type: 'trigger', config: {} },
            { id: 'n_score', type: 'lead_score', config: { score_delta: 5 } },
            { id: 'n_send', type: 'send', config: { channel: 'email', subject: 'Hi', body: 'Path' } },
            { id: 'n_exit', type: 'exit', config: {} },
          ],
          edges: [
            { from: 'n_trigger', to: 'n_score' },
            { from: 'n_score', to: 'n_send' },
            { from: 'n_send', to: 'n_exit' },
          ],
        }

        const journey = await createJourney({
          name: 'Inspector',
          status: 'active',
          graph,
          agencyId,
          agentId,
        })
        const run = await enrollContact({ journeyId: journey.id, contactId, agencyId, agentId })
        await traverseRun(run.id, { agencyId, agentId })

        const inspected = await getRunWithNodeRuns(run.id, { agencyId, agentId })
        expect(inspected.node_runs.length).toBeGreaterThanOrEqual(2)
        expect(inspected.transitions.length).toBeGreaterThanOrEqual(1)
        expect(inspected.transitions[0].from_node).toBeTruthy()
        expect(inspected.transitions[0].reason).toBeTruthy()
        expect(inspected.state?.lead_score).toBe(5)
      } finally {
        await closeDb()
      }
    })
  }, 180_000)
})
