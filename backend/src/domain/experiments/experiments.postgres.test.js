/**
 * Wave 2D — Real-PG coverage for experiments, assignments, results, wiring,
 * and tenant isolation.
 */
import { randomUUID } from 'node:crypto'
import { readFile } from 'fs/promises'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { expect, it } from 'vitest'
import { skipIfNoPostgres, withTestDb } from '../../testing/postgres.js'
import { closeDb, configure } from '../../persistence/index.js'
import { getPool } from '../../persistence/postgres-adapter.js'
import {
  createExecution,
  ingestEvent,
} from '../../lib/growth-os/index.js'
import {
  materialiseConversionFromEvent,
} from '../attribution/index.js'
import {
  assignContact,
  computeExperimentResults,
  concludeExperiment,
  createExperiment,
  listAssignments,
  listExperiments,
  resolveJourneyExperimentNode,
  resolveVariantForExecution,
  startExperiment,
  EVEN_MODEL_VERSION,
} from './index.js'
import { assignExperimentVariant } from '../journeys/graph.js'

const migrationsDir = join(dirname(fileURLToPath(import.meta.url)), '../../persistence/migrations')

const WAVE2D_FILES = [
  '750_experiment_enums.sql',
  '751_experiments_assignments.sql',
]

// Attribution tables needed for conversion fixtures in results tests
const WAVE2C_FILES = [
  '730_attribution_enums.sql',
  '731_conversions_attribution_credits.sql',
]

async function seedAgencyAgent(pool, { agencyId, agentId }) {
  const userId = randomUUID()
  await pool.query(
    `INSERT INTO public.users (id, email, name, data)
     VALUES ($1, $2, 'Wave2D', '{}'::jsonb)
     ON CONFLICT (id) DO NOTHING`,
    [userId, `${userId}@wave2d.test`],
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
    [agentId, userId, `${agentId}@wave2d.test`, agencyId],
  )
}

async function seedContact(pool, { contactId, agentId, agencyId }) {
  await pool.query(
    `INSERT INTO public.contacts
       (id, name, status, tags, assigned_agent_id, agency_id, data)
     VALUES ($1, $2, 'lead', '[]'::jsonb, $3, $4, '{}'::jsonb)
     ON CONFLICT (id) DO NOTHING`,
    [contactId, 'Contact', agentId, agencyId],
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

async function applySqlFiles(pool, files) {
  for (const file of files) {
    const sql = await readFile(join(migrationsDir, file), 'utf8')
    await pool.query(sql)
  }
}

skipIfNoPostgres()('wave 2d experimentation', () => {
  it('migrations are idempotent when SQL is re-applied', async () => {
    await withTestDb(async (url) => {
      configure({ databaseUrl: url, force: true })
      const pool = getPool()
      try {
        for (const file of WAVE2D_FILES) {
          const sql = await readFile(join(migrationsDir, file), 'utf8')
          await pool.query(sql)
          await pool.query(sql)
        }
        const tables = await pool.query(`
          SELECT relname FROM pg_class c
          JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE n.nspname = 'public'
            AND relname IN ('experiments', 'experiment_assignments')
            AND relkind = 'r'
          ORDER BY 1
        `)
        expect(tables.rows.map((r) => r.relname)).toEqual([
          'experiment_assignments',
          'experiments',
        ])
      } finally {
        await closeDb()
      }
    })
  }, 180_000)

  it('deterministic assignment + holdout + recorded reason/model_version; reproducible on re-run', async () => {
    await withTestDb(async (url) => {
      configure({ databaseUrl: url, force: true })
      const pool = getPool()
      const agencyId = `agy_${randomUUID()}`
      const agentId = `agt_${randomUUID()}`
      const contactId = `ctc_${randomUUID()}`
      try {
        await applySqlFiles(pool, WAVE2D_FILES)
        await seedAgencyAgent(pool, { agencyId, agentId })
        await seedContact(pool, { contactId, agentId, agencyId })

        const experiment = await createExperiment({
          agencyId,
          agentId,
          dimension: 'copy',
          variants: [{ key: 'A' }, { key: 'B' }],
          allocation: 'even',
          holdoutPct: 25,
          goalEvent: 'lead.created',
          status: 'draft',
        })
        await startExperiment(experiment.id, { agencyId, agentId })

        const first = await assignContact({
          experimentId: experiment.id,
          contactId,
          agencyId,
          agentId,
        })
        expect(first.created).toBe(true)
        expect(first.assignment.model_version).toBe(EVEN_MODEL_VERSION)
        expect(['even', 'holdout']).toContain(first.assignment.assignment_reason)
        expect(first.assignment.variant).toBeTruthy()

        const second = await assignContact({
          experimentId: experiment.id,
          contactId,
          agencyId,
          agentId,
        })
        expect(second.created).toBe(false)
        expect(second.replayed).toBe(true)
        expect(second.assignment.id).toBe(first.assignment.id)
        expect(second.assignment.variant).toBe(first.assignment.variant)

        const rows = await listAssignments({ agencyId, agentId, experimentId: experiment.id })
        expect(rows).toHaveLength(1)
      } finally {
        await closeDb()
      }
    })
  }, 180_000)

  it('bandit allocation returns NOT_CONFIGURED on assign', async () => {
    await withTestDb(async (url) => {
      configure({ databaseUrl: url, force: true })
      const pool = getPool()
      const agencyId = `agy_${randomUUID()}`
      const agentId = `agt_${randomUUID()}`
      const contactId = `ctc_${randomUUID()}`
      try {
        await applySqlFiles(pool, WAVE2D_FILES)
        await seedAgencyAgent(pool, { agencyId, agentId })
        await seedContact(pool, { contactId, agentId, agencyId })

        const experiment = await createExperiment({
          agencyId,
          agentId,
          dimension: 'channel',
          variants: [{ key: 'email' }, { key: 'whatsapp' }],
          allocation: 'bandit',
          holdoutPct: 0,
          goalEvent: 'lead.created',
        })
        await startExperiment(experiment.id, { agencyId, agentId })

        await expect(
          assignContact({
            experimentId: experiment.id,
            contactId,
            agencyId,
            agentId,
          }),
        ).rejects.toMatchObject({ code: 'NOT_CONFIGURED' })
      } finally {
        await closeDb()
      }
    })
  }, 180_000)

  it('journey experiment node + execution resolve assigned variant', async () => {
    await withTestDb(async (url) => {
      configure({ databaseUrl: url, force: true })
      const pool = getPool()
      const agencyId = `agy_${randomUUID()}`
      const agentId = `agt_${randomUUID()}`
      const contactId = `ctc_${randomUUID()}`
      try {
        await applySqlFiles(pool, WAVE2D_FILES)
        await seedAgencyAgent(pool, { agencyId, agentId })
        await seedContact(pool, { contactId, agentId, agencyId })

        const experiment = await createExperiment({
          agencyId,
          agentId,
          dimension: 'journey_path',
          variants: [
            { key: 'path_a', next: 'node_a' },
            { key: 'path_b', next: 'node_b' },
          ],
          allocation: 'even',
          holdoutPct: 0,
          goalEvent: 'viewing.booked',
        })
        await startExperiment(experiment.id, { agencyId, agentId })

        const resolved = await resolveJourneyExperimentNode({
          nodeConfig: {
            experiment_id: experiment.id,
            variants: [
              { key: 'path_a', next: 'node_a' },
              { key: 'path_b', next: 'node_b' },
            ],
            holdout_pct: 0,
          },
          contactId,
          agencyId,
          agentId,
          fallbackAssign: assignExperimentVariant,
        })
        expect(resolved.persisted).toBe(true)
        expect(resolved.assignment?.id).toBeTruthy()
        expect(['path_a', 'path_b']).toContain(resolved.variant)
        expect(resolved.model_version).toBe(EVEN_MODEL_VERSION)
        expect(['node_a', 'node_b']).toContain(resolved.next)

        const execResolved = await resolveVariantForExecution({
          experimentId: experiment.id,
          contactId,
          agencyId,
          agentId,
          baseData: { channel: 'email' },
        })
        expect(execResolved.assignment.variant).toBe(resolved.variant)
        expect(execResolved.data.experiment_id).toBe(experiment.id)
        expect(execResolved.data.experiment_variant).toBe(resolved.variant)
        expect(execResolved.data.experiment_assignment_id).toBe(resolved.assignment.id)

        const execution = await createExecution({
          kind: 'message',
          status: 'draft',
          agencyId,
          agentId,
          subjectType: 'contact',
          subjectId: contactId,
          data: execResolved.data,
        })
        // createExecution spreads data attrs onto the row (not nested under .data)
        expect(execution.experiment_variant).toBe(resolved.variant)
        expect(execution.experiment_id).toBe(experiment.id)
        expect(execution.experiment_assignment_id).toBe(resolved.assignment.id)
      } finally {
        await closeDb()
      }
    })
  }, 180_000)

  it('results from conversion fixtures; significance math is honest', async () => {
    await withTestDb(async (url) => {
      configure({ databaseUrl: url, force: true })
      const pool = getPool()
      const agencyId = `agy_${randomUUID()}`
      const agentId = `agt_${randomUUID()}`
      try {
        await applySqlFiles(pool, [...WAVE2C_FILES, ...WAVE2D_FILES])
        await seedAgencyAgent(pool, { agencyId, agentId })

        const experiment = await createExperiment({
          agencyId,
          agentId,
          dimension: 'copy',
          variants: [
            { key: 'control', is_control: true },
            { key: 'treatment' },
          ],
          allocation: 'even',
          holdoutPct: 0,
          goalEvent: 'lead.created',
        })
        await startExperiment(experiment.id, { agencyId, agentId })

        // Seed enough contacts; force variants via direct assignment insert path
        // by picking contacts whose hash lands in each arm, then materialise conversions.
        const controlContacts = []
        const treatmentContacts = []
        for (let i = 0; i < 120; i += 1) {
          const contactId = `ctc_${randomUUID()}`
          await seedContact(pool, { contactId, agentId, agencyId })
          const { assignment } = await assignContact({
            experimentId: experiment.id,
            contactId,
            agencyId,
            agentId,
          })
          if (assignment.variant === 'control') controlContacts.push(contactId)
          else if (assignment.variant === 'treatment') treatmentContacts.push(contactId)
        }

        expect(controlContacts.length).toBeGreaterThan(20)
        expect(treatmentContacts.length).toBeGreaterThan(20)

        // Convert ~10% of control, ~40% of treatment via Events → Conversions
        const convertSlice = async (ids, rate, label) => {
          const n = Math.floor(ids.length * rate)
          for (let i = 0; i < n; i += 1) {
            const contactId = ids[i]
            const ingested = await ingestEvent({
              eventName: 'lead.created',
              source: 'test:wave2d',
              agencyId,
              agentId,
              contactId,
              idempotencyKey: `wave2d:${label}:${contactId}`,
              occurredAt: new Date().toISOString(),
            })
            const event = ingested?.event || ingested
            expect(event?.id).toBeTruthy()
            expect(event?.event_name).toBe('lead.created')
            await materialiseConversionFromEvent(event, { agencyId, agentId })
          }
        }
        await convertSlice(controlContacts, 0.1, 'control')
        await convertSlice(treatmentContacts, 0.4, 'treatment')

        const results = await computeExperimentResults({
          experimentId: experiment.id,
          agencyId,
          agentId,
        })
        expect(results.method).toBe('frequentist_two_proportion_z')
        expect(results.control_variant).toBe('control')
        expect(results.sequential.code).toBe('NOT_CONFIGURED')
        expect(results.bandit.code).toBe('NOT_CONFIGURED')

        const treatment = results.variants.find((v) => v.variant === 'treatment')
        expect(treatment).toBeTruthy()
        expect(treatment.conversion_rate).toBeGreaterThan(0.2)

        // With ~60 per arm and large rate gap, expect either significance or
        // honest insufficient_sample — never a fabricated p-value.
        if (treatment.vs_control.reason === 'insufficient_sample') {
          expect(treatment.vs_control.p_value).toBeNull()
          expect(treatment.vs_control.confidence).toBeNull()
          expect(treatment.vs_control.significant_at_95).toBe(false)
        } else {
          expect(treatment.vs_control.p_value).toEqual(expect.any(Number))
          expect(treatment.vs_control.confidence).toEqual(expect.any(Number))
          expect(treatment.vs_control.reason).toBe('two_proportion_z')
        }

        const concluded = await concludeExperiment({
          experimentId: experiment.id,
          agencyId,
          agentId,
          winnerVariant: 'treatment',
        })
        expect(concluded.experiment.status).toBe('concluded')
        expect(concluded.results.winner_variant).toBe('treatment')
        expect(concluded.results.promotion.promoted).toBe(true)
      } finally {
        await closeDb()
      }
    })
  }, 180_000)

  it('tenant isolation: agency A cannot read agency B experiments/assignments', async () => {
    await withTestDb(async (url) => {
      configure({ databaseUrl: url, force: true })
      const pool = getPool()
      const agencyA = `agy_${randomUUID()}`
      const agentA = `agt_${randomUUID()}`
      const agencyB = `agy_${randomUUID()}`
      const agentB = `agt_${randomUUID()}`
      const contactA = `ctc_${randomUUID()}`
      try {
        await applySqlFiles(pool, WAVE2D_FILES)
        await seedAgencyAgent(pool, { agencyId: agencyA, agentId: agentA })
        await seedAgencyAgent(pool, { agencyId: agencyB, agentId: agentB })
        await seedContact(pool, { contactId: contactA, agentId: agentA, agencyId: agencyA })

        const expA = await createExperiment({
          agencyId: agencyA,
          agentId: agentA,
          dimension: 'cta',
          variants: [{ key: 'x' }, { key: 'y' }],
          allocation: 'even',
          holdoutPct: 0,
          goalEvent: 'lead.created',
        })
        await startExperiment(expA.id, { agencyId: agencyA, agentId: agentA })
        await assignContact({
          experimentId: expA.id,
          contactId: contactA,
          agencyId: agencyA,
          agentId: agentA,
        })

        const fromB = await listExperiments({ agencyId: agencyB, agentId: agentB })
        expect(fromB.find((e) => e.id === expA.id)).toBeUndefined()

        const assignmentsB = await listAssignments({
          agencyId: agencyB,
          agentId: agentB,
          experimentId: expA.id,
        })
        expect(assignmentsB).toHaveLength(0)

        const rlsRows = await asGrowthOsRole(pool, { 'app.agency_id': agencyB }, async (client) => {
          const r = await client.query('SELECT id FROM public.experiments')
          return r.rows
        })
        expect(rlsRows.find((r) => r.id === expA.id)).toBeUndefined()

        const rlsEmpty = await asGrowthOsRole(pool, {}, async (client) => {
          const r = await client.query('SELECT id FROM public.experiments')
          return r.rows
        })
        expect(rlsEmpty).toHaveLength(0)
      } finally {
        await closeDb()
      }
    })
  }, 180_000)
})
