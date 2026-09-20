/**
 * Wave 2B — Real-PG coverage for calendar filters, reschedule gates,
 * network validation, and tenant isolation.
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
  createChannelConnection,
  createExecution,
  ensureChannelDefinition,
  scheduleExecution,
  transitionExecution,
} from '../../lib/growth-os/index.js'
import {
  queryCalendarExecutions,
  rescheduleCalendarExecution,
} from './calendar.js'
import { validateExecutionNetwork } from './network-validation.js'

const migrationsDir = join(dirname(fileURLToPath(import.meta.url)), '../../persistence/migrations')

const WAVE2B_FILES = [
  '720_executions_calendar_indexes.sql',
]

async function applySqlFiles(pool, files) {
  for (const file of files) {
    const sql = await readFile(join(migrationsDir, file), 'utf8')
    await pool.query(sql)
  }
}

async function seedAgencyAgent(pool, { agencyId, agentId, officeId = null }) {
  const userId = randomUUID()
  await pool.query(
    `INSERT INTO public.users (id, email, name, data)
     VALUES ($1, $2, 'Wave2B', '{}'::jsonb)
     ON CONFLICT (id) DO NOTHING`,
    [userId, `${userId}@wave2b.test`],
  )
  await pool.query(
    `INSERT INTO public.agencies (id, name, data)
     VALUES ($1, $2, '{}'::jsonb)
     ON CONFLICT (id) DO NOTHING`,
    [agencyId, `Agency ${agencyId}`],
  )
  const data = officeId ? { office_id: officeId } : {}
  await pool.query(
    `INSERT INTO public.agents (id, user_id, email, name, agency_id, data)
     VALUES ($1, $2, $3, 'Agent', $4, $5::jsonb)
     ON CONFLICT (id) DO NOTHING`,
    [agentId, userId, `${agentId}@wave2b.test`, agencyId, JSON.stringify(data)],
  )
}

async function seedSocialConnection({ agencyId, agentId, platform = 'instagram', health = 'connected' }) {
  const def = await ensureChannelDefinition({ platform, kind: 'organic_social' })
  return createChannelConnection({
    channelDefinitionId: def.id,
    agencyId,
    agentId,
    credentialsRef: `secret:fixture:${platform}`,
    health,
  })
}

skipIfNoPostgres()('publishing-calendar postgres', () => {
  it('filter dimensions + combinations return matching executions', async () => {
    await withTestDb(async (url) => {
      configure({ databaseUrl: url, force: true })
      const pool = getPool()
      try {
        const agencyId = `agc_${randomUUID()}`
        const agentA = `agt_${randomUUID()}`
        const agentB = `agt_${randomUUID()}`
        await seedAgencyAgent(pool, { agencyId, agentId: agentA, officeId: 'downtown' })
        await seedAgencyAgent(pool, { agencyId, agentId: agentB, officeId: 'marina' })

        const conn = await seedSocialConnection({ agencyId, agentId: agentA })
        await createExecution({
          id: 'exec_cal_1',
          kind: 'social_post',
          status: 'scheduled',
          agencyId,
          agentId: agentA,
          campaignId: 'cmp_1',
          subjectType: 'property',
          subjectId: 'prop_1',
          channelConnectionId: conn.id,
          scheduledAt: '2026-10-10T10:00:00.000Z',
        })
        await createExecution({
          id: 'exec_cal_2',
          kind: 'message',
          status: 'draft',
          agencyId,
          agentId: agentB,
          campaignId: 'cmp_2',
          subjectType: 'property',
          subjectId: 'prop_2',
          scheduledAt: '2026-10-20T10:00:00.000Z',
        })
        await createExecution({
          id: 'exec_cal_3',
          kind: 'social_post',
          status: 'published',
          agencyId,
          agentId: agentA,
          scheduledAt: '2026-09-01T10:00:00.000Z',
        })

        const byRange = await queryCalendarExecutions({
          agencyId,
          from: '2026-10-01T00:00:00.000Z',
          to: '2026-10-15T23:59:59.000Z',
        })
        expect(byRange.executions.map((e) => e.id)).toEqual(['exec_cal_1'])

        const byKindStatus = await queryCalendarExecutions({
          agencyId,
          kind: 'social_post',
          status: 'scheduled',
        })
        expect(byKindStatus.executions.map((e) => e.id)).toEqual(['exec_cal_1'])

        const byProperty = await queryCalendarExecutions({
          agencyId,
          propertyId: 'prop_1',
        })
        expect(byProperty.executions.map((e) => e.id)).toEqual(['exec_cal_1'])

        const byCampaign = await queryCalendarExecutions({
          agencyId,
          campaignId: 'cmp_2',
        })
        expect(byCampaign.executions.map((e) => e.id)).toEqual(['exec_cal_2'])

        const byAgent = await queryCalendarExecutions({
          agencyId,
          agentId: agentB,
        })
        expect(byAgent.executions.map((e) => e.id)).toEqual(['exec_cal_2'])

        const byChannel = await queryCalendarExecutions({
          agencyId,
          channelConnectionId: conn.id,
        })
        expect(byChannel.executions.map((e) => e.id)).toEqual(['exec_cal_1'])

        const byOffice = await queryCalendarExecutions({
          agencyId,
          office: 'downtown',
        })
        expect(byOffice.executions.every((e) => e.agent_id === agentA)).toBe(true)
        expect(byOffice.meta.unsupported_filters).not.toContain('office')

        const combo = await queryCalendarExecutions({
          agencyId,
          from: '2026-10-01T00:00:00.000Z',
          to: '2026-10-31T23:59:59.000Z',
          kind: 'social_post',
          status: 'scheduled',
          campaignId: 'cmp_1',
          propertyId: 'prop_1',
          agentId: agentA,
          channelConnectionId: conn.id,
          office: 'downtown',
        })
        expect(combo.executions.map((e) => e.id)).toEqual(['exec_cal_1'])
      } finally {
        await closeDb()
      }
    })
  }, 180_000)

  it('reschedule updates scheduled_at; blocked on published/processing', async () => {
    await withTestDb(async (url) => {
      configure({ databaseUrl: url, force: true })
      const pool = getPool()
      try {
        const agencyId = `agc_${randomUUID()}`
        const agentId = `agt_${randomUUID()}`
        await seedAgencyAgent(pool, { agencyId, agentId })

        await createExecution({
          id: 'exec_rs_draft',
          kind: 'social_post',
          status: 'draft',
          agencyId,
          agentId,
        })
        const scheduled = await rescheduleCalendarExecution(
          'exec_rs_draft',
          '2026-11-01T09:00:00.000Z',
          { agencyId },
        )
        expect(scheduled.status).toBe('scheduled')
        expect(scheduled.scheduled_at).toBeTruthy()

        const again = await rescheduleCalendarExecution(
          'exec_rs_draft',
          '2026-11-02T09:00:00.000Z',
          { agencyId },
        )
        expect(Date.parse(again.scheduled_at)).toBe(Date.parse('2026-11-02T09:00:00.000Z'))

        await createExecution({
          id: 'exec_rs_pub',
          kind: 'social_post',
          status: 'draft',
          agencyId,
          agentId,
        })
        await scheduleExecution('exec_rs_pub', '2026-11-01T00:00:00.000Z', { agencyId, agentId })
        await transitionExecution('exec_rs_pub', 'processing', { agencyId, agentId })
        await transitionExecution('exec_rs_pub', 'published', { agencyId, agentId })
        await expect(
          rescheduleCalendarExecution('exec_rs_pub', '2026-12-01T00:00:00.000Z', { agencyId }),
        ).rejects.toMatchObject({ code: 'INVALID_EXECUTION_TRANSITION' })

        await createExecution({
          id: 'exec_rs_proc',
          kind: 'portal_submit',
          status: 'draft',
          agencyId,
          agentId,
        })
        await scheduleExecution('exec_rs_proc', '2026-11-03T00:00:00.000Z', { agencyId, agentId })
        await transitionExecution('exec_rs_proc', 'processing', { agencyId, agentId })
        await expect(
          rescheduleCalendarExecution('exec_rs_proc', '2026-12-01T00:00:00.000Z', { agencyId }),
        ).rejects.toMatchObject({ code: 'INVALID_EXECUTION_TRANSITION' })
      } finally {
        await closeDb()
      }
    })
  }, 180_000)

  it('network validation flags missing media and expired connection', async () => {
    await withTestDb(async (url) => {
      configure({ databaseUrl: url, force: true })
      const pool = getPool()
      try {
        const agencyId = `agc_${randomUUID()}`
        const agentId = `agt_${randomUUID()}`
        await seedAgencyAgent(pool, { agencyId, agentId })
        const conn = await seedSocialConnection({
          agencyId,
          agentId,
          platform: 'instagram',
          health: 'expired',
        })

        await createExecution({
          id: 'exec_val_1',
          kind: 'social_post',
          status: 'draft',
          agencyId,
          agentId,
          channelConnectionId: conn.id,
          data: { caption: 'No media here' },
        })

        const result = await validateExecutionNetwork('exec_val_1', { agencyId, agentId })
        expect(result.ok).toBe(false)
        const codes = result.blockers.map((b) => b.code)
        expect(codes).toEqual(expect.arrayContaining(['EXPIRED_TOKEN', 'MISSING_MEDIA']))
      } finally {
        await closeDb()
      }
    })
  }, 180_000)

  it('tenant isolation: agency A calendar excludes agency B executions', async () => {
    await withTestDb(async (url) => {
      configure({ databaseUrl: url, force: true })
      const pool = getPool()
      try {
        const agencyA = `agc_${randomUUID()}`
        const agencyB = `agc_${randomUUID()}`
        const agentA = `agt_${randomUUID()}`
        const agentB = `agt_${randomUUID()}`
        await seedAgencyAgent(pool, { agencyId: agencyA, agentId: agentA })
        await seedAgencyAgent(pool, { agencyId: agencyB, agentId: agentB })

        await createExecution({
          id: 'exec_iso_a',
          kind: 'social_post',
          status: 'scheduled',
          agencyId: agencyA,
          agentId: agentA,
          scheduledAt: '2026-10-10T00:00:00.000Z',
        })
        await createExecution({
          id: 'exec_iso_b',
          kind: 'social_post',
          status: 'scheduled',
          agencyId: agencyB,
          agentId: agentB,
          scheduledAt: '2026-10-10T00:00:00.000Z',
        })

        const calA = await queryCalendarExecutions({ agencyId: agencyA })
        expect(calA.executions.map((e) => e.id)).toEqual(['exec_iso_a'])
        expect(calA.executions.some((e) => e.id === 'exec_iso_b')).toBe(false)

        const calB = await queryCalendarExecutions({ agencyId: agencyB })
        expect(calB.executions.map((e) => e.id)).toEqual(['exec_iso_b'])
      } finally {
        await closeDb()
      }
    })
  }, 180_000)

  it('calendar indexes migration is idempotent', async () => {
    await withTestDb(async (url) => {
      configure({ databaseUrl: url, force: true })
      const pool = getPool()
      try {
        await applySqlFiles(pool, WAVE2B_FILES)
        await applySqlFiles(pool, WAVE2B_FILES)
        const { rows } = await pool.query(
          `SELECT indexname FROM pg_indexes
           WHERE schemaname = 'public'
             AND indexname LIKE 'idx_executions_%scheduled%'
           ORDER BY indexname`,
        )
        expect(rows.length).toBeGreaterThanOrEqual(2)
      } finally {
        await closeDb()
      }
    })
  }, 180_000)
})
