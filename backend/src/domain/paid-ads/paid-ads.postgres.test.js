/**
 * Wave 2A — Real-PG: paid channels, executions, RLS, approval gate, events.
 */
import { randomUUID } from 'node:crypto'
import { readFile } from 'fs/promises'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { afterEach, expect, it, vi } from 'vitest'
import { skipIfNoPostgres, withTestDb } from '../../testing/postgres.js'
import { closeDb, configure } from '../../persistence/index.js'
import { getPool } from '../../persistence/postgres-adapter.js'
import { listEvents } from '../../lib/growth-os/index.js'
import {
  connectPaidChannel,
  createPaidAdExecution,
  ensurePaidChannelDefinitions,
  launchPaidAdExecution,
  listPaidChannelStatus,
  PROVIDER_NOT_APPROVED,
} from './index.js'

const migrationsDir = join(dirname(fileURLToPath(import.meta.url)), '../../persistence/migrations')

async function seedAgencyAgent(pool, { agencyId, agentId }) {
  const userId = randomUUID()
  await pool.query(
    `INSERT INTO public.users (id, email, name, data)
     VALUES ($1, $2, 'Wave2A', '{}'::jsonb)
     ON CONFLICT (id) DO NOTHING`,
    [userId, `${userId}@wave2a.test`],
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
    [agentId, userId, `${agentId}@wave2a.test`, agencyId],
  )
}

async function asGrowthOsRole(pool, gucs, fn) {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query('SET LOCAL ROLE growth_os_app_role')
    for (const [key, value] of Object.entries(gucs || {})) {
      if (value != null) {
        await client.query('SELECT set_config($1, $2, true)', [key, String(value)])
      }
    }
    const result = await fn(client)
    await client.query('COMMIT')
    return result
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

skipIfNoPostgres()('paid-ads Real-PG', () => {
  afterEach(() => {
    delete process.env.META_ADS_PROVIDER_APPROVED
    delete process.env.GOOGLE_ADS_PROVIDER_APPROVED
    delete process.env.GOOGLE_ADS_DEVELOPER_TOKEN
  })

  it('migration 700 is idempotent and admits ad.delivered + objectives', async () => {
    await withTestDb(async (url) => {
      configure({ databaseUrl: url, force: true })
      const pool = getPool()
      const sql = await readFile(join(migrationsDir, '700_paid_ads_enums.sql'), 'utf8')
      await pool.query(sql)
      await pool.query(sql) // second apply

      const obj = await pool.query(
        `SELECT public.growth_os_is_paid_ad_objective('awareness') AS ok,
                public.growth_os_is_paid_ad_objective('viral') AS bad`,
      )
      expect(obj.rows[0].ok).toBe(true)
      expect(obj.rows[0].bad).toBe(false)

      const ev = await pool.query(
        `SELECT public.growth_os_is_event_name('ad.delivered') AS ok,
                public.growth_os_event_name_category('ad.delivered') AS cat`,
      )
      expect(ev.rows[0].ok).toBe(true)
      expect(ev.rows[0].cat).toBe('delivery')
      await closeDb()
    })
  })

  it('creates paid Execution with objective/budget/targeting under strict RLS', async () => {
    await withTestDb(async (url) => {
      configure({ databaseUrl: url, force: true })
      const pool = getPool()
      const agencyId = `agy_${randomUUID()}`
      const agentId = `agt_${randomUUID()}`
      await seedAgencyAgent(pool, { agencyId, agentId })

      const defs = await ensurePaidChannelDefinitions()
      expect(defs.map((d) => d.platform).sort()).toEqual(['google_ads', 'meta_ads'])

      const connection = await connectPaidChannel({
        platform: 'meta_ads',
        agencyId,
        agentId,
        credentialsRef: 'secret:fixture:meta_ads',
        providerAccountId: 'act_111',
        data: { oauth: { access_token: 'test-token' } },
      })

      const execution = await createPaidAdExecution({
        agencyId,
        agentId,
        channelConnectionId: connection.id,
        objective: 'traffic',
        budgetMicros: 50_000_000,
        currency: 'USD',
        targeting: {
          geography: { countries: ['AE'] },
          demographics: { age_min: 25 },
          audience_ref: 'aud_fixture',
        },
        audienceId: 'aud_fixture',
        name: 'Dubai traffic',
      })

      expect(execution.kind).toBe('paid_ad')
      expect(execution.status).toBe('draft')
      expect(execution.objective).toBe('traffic')
      expect(execution.budget_micros).toBe(50_000_000)
      expect(execution.currency).toBe('USD')
      expect(execution.targeting.geography.countries).toEqual(['AE'])
      expect(execution.audience_id).toBe('aud_fixture')
      expect(execution.platform).toBe('meta_ads')

      const asApp = await asGrowthOsRole(pool, {}, async (client) => {
        const r = await client.query(
          `SELECT count(*)::int AS n FROM public.executions WHERE kind = 'paid_ad'`,
        )
        return r.rows[0].n
      })
      expect(asApp).toBe(0)

      const asTenant = await asGrowthOsRole(
        pool,
        { 'app.agency_id': agencyId },
        async (client) => {
          const r = await client.query(
            `SELECT id, data->>'objective' AS objective FROM public.executions WHERE id = $1`,
            [execution.id],
          )
          return r.rows[0]
        },
      )
      expect(asTenant.objective).toBe('traffic')

      const status = await listPaidChannelStatus({ agencyId, agentId })
      const meta = status.find((s) => s.platform === 'meta_ads')
      expect(meta.honest_state).toBe('connect_pending_approval')
      expect(meta.approval.approved).toBe(false)

      await closeDb()
    })
  })

  it('unapproved launch returns PROVIDER_NOT_APPROVED and emits no ad.delivered', async () => {
    await withTestDb(async (url) => {
      configure({ databaseUrl: url, force: true })
      const pool = getPool()
      const agencyId = `agy_${randomUUID()}`
      const agentId = `agt_${randomUUID()}`
      await seedAgencyAgent(pool, { agencyId, agentId })

      await ensurePaidChannelDefinitions()
      const connection = await connectPaidChannel({
        platform: 'google_ads',
        agencyId,
        agentId,
        credentialsRef: 'secret:fixture:google_ads',
        providerAccountId: '1234567890',
        data: { oauth: { access_token: 'tok' } },
      })
      const execution = await createPaidAdExecution({
        agencyId,
        agentId,
        channelConnectionId: connection.id,
        objective: 'awareness',
        budgetMicros: 1_000_000,
        currency: 'AED',
        targeting: { format: 'demand_gen_gmail' },
        format: 'demand_gen_gmail',
      })

      const fetchImpl = vi.fn()
      await expect(
        launchPaidAdExecution(execution.id, { agencyId, agentId, fetchImpl }),
      ).rejects.toMatchObject({ code: PROVIDER_NOT_APPROVED })
      expect(fetchImpl).not.toHaveBeenCalled()

      const events = await listEvents({ agencyId, agentId, executionId: execution.id })
      expect(events.filter((e) => e.event_name === 'ad.delivered')).toHaveLength(0)
      await closeDb()
    })
  })

  it('approved launch calls adapter HTTP, emits ad.delivered idempotently', async () => {
    await withTestDb(async (url) => {
      configure({ databaseUrl: url, force: true })
      process.env.META_ADS_PROVIDER_APPROVED = 'true'
      const pool = getPool()
      const agencyId = `agy_${randomUUID()}`
      const agentId = `agt_${randomUUID()}`
      await seedAgencyAgent(pool, { agencyId, agentId })

      await ensurePaidChannelDefinitions()
      const connection = await connectPaidChannel({
        platform: 'meta_ads',
        agencyId,
        agentId,
        credentialsRef: 'secret:fixture:meta_ads',
        providerAccountId: 'act_55',
        data: { oauth: { access_token: 'live-tok' } },
      })
      const execution = await createPaidAdExecution({
        agencyId,
        agentId,
        channelConnectionId: connection.id,
        objective: 'conversions',
        budgetMicros: 9_000_000,
        currency: 'USD',
        targeting: { geography: { cities: ['Dubai'] } },
      })

      const fetchImpl = vi.fn(async () => ({
        ok: true,
        json: async () => ({ id: 'meta_camp_99' }),
      }))

      const first = await launchPaidAdExecution(execution.id, {
        agencyId,
        agentId,
        fetchImpl,
        emitEngagement: true,
      })
      expect(first.execution.status).toBe('published')
      expect(first.provider.provider_campaign_id).toBe('meta_camp_99')
      expect(fetchImpl).toHaveBeenCalledTimes(1)
      expect(first.events.delivered.event.event_name).toBe('ad.delivered')
      expect(first.events.engagement.event.event_name).toBe('link.clicked')

      const events = await listEvents({ agencyId, agentId, executionId: execution.id })
      expect(events.filter((e) => e.event_name === 'ad.delivered')).toHaveLength(1)
      expect(events.filter((e) => e.event_name === 'link.clicked')).toHaveLength(1)
      await closeDb()
    })
  })
})
