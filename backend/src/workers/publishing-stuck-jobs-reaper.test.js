import { describe, expect, it, vi } from 'vitest'
import {
  PUBLISHING_DEAD_LETTER_STATUS,
  PUBLISHING_SLA_REAPED_AUDIT_TYPE,
  PUBLISHING_STUCK_DESTINATION_STATUSES,
  resolvePublishingSlaHours,
  runPublishingStuckJobsReaper,
  tick,
} from './publishing-stuck-jobs-reaper.js'

describe('publishing_stuck_jobs_reaper', () => {
  it('exports dead_letter + sla_reaped constants and stuck statuses', () => {
    expect(PUBLISHING_DEAD_LETTER_STATUS).toBe('dead_letter')
    expect(PUBLISHING_SLA_REAPED_AUDIT_TYPE).toBe('sla_reaped')
    expect(PUBLISHING_STUCK_DESTINATION_STATUSES).toContain('pending')
    expect(PUBLISHING_STUCK_DESTINATION_STATUSES).toContain('pending_moderation')
    expect(typeof tick).toBe('function')
  })

  it('resolvePublishingSlaHours falls back to 24h', () => {
    expect(resolvePublishingSlaHours(48)).toBe(48)
    expect(resolvePublishingSlaHours(0)).toBe(24)
    expect(resolvePublishingSlaHours(-1)).toBe(24)
  })

  it('reaps stuck destinations to dead_letter with sla_reaped audit', async () => {
    const queries = []
    const client = {
      query: vi.fn(async (sql, params) => {
        queries.push({ sql: String(sql), params })
        if (String(sql).includes('FROM public.publishing_jobs')) {
          return {
            rows: [{
              id: 'job_stuck',
              property_id: 'prop_1',
              agent_id: 'agent_1',
              agency_id: null,
              submitted_at: '2026-01-01T00:00:00.000Z',
              created_at: '2026-01-01T00:00:00.000Z',
            }],
          }
        }
        if (String(sql).includes('FROM public.distribution_jobs')) {
          return {
            rows: [{
              id: 'dest_1',
              status: 'pending_moderation',
              error_message: null,
              retry_count: 0,
            }],
          }
        }
        if (String(sql).startsWith('UPDATE public.distribution_jobs')) {
          return {
            rowCount: 1,
            rows: [{ id: 'dest_1', status: 'dead_letter', publishing_job_id: 'job_stuck' }],
          }
        }
        return { rowCount: 1, rows: [] }
      }),
      release: vi.fn(),
    }
    const pool = { connect: vi.fn(async () => client) }

    const result = await runPublishingStuckJobsReaper({
      pool,
      now: '2026-01-05T00:00:00.000Z',
      slaHours: 24,
    })

    expect(result.reaped_jobs).toBe(1)
    expect(result.reaped_destinations).toBe(1)
    expect(result.destination_ids).toEqual(['dest_1'])
    expect(queries.some((q) => q.sql.includes('INSERT INTO public.audit_log') && q.params[3] === 'sla_reaped')).toBe(true)
    expect(queries.some((q) => q.sql.includes('UPDATE public.distribution_jobs') && q.params?.[1] === 'dead_letter')).toBe(true)
    expect(client.query).toHaveBeenCalledWith('BEGIN')
    expect(client.query).toHaveBeenCalledWith('COMMIT')
  })
})
