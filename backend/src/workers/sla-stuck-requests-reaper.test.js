import { describe, expect, it, vi } from 'vitest'
import {
  resolveSlaHours,
  SLA_DEAD_LETTER_STATUS,
  SLA_REAPED_AUDIT_TYPE,
  SLA_STUCK_ACTION_KINDS,
  runSlaStuckRequestsReaper,
} from './sla-stuck-requests-reaper.js'

describe('sla_stuck_requests_reaper', () => {
  it('exports WF-05/WF-06 action kinds and dead_letter constants', () => {
    expect(SLA_STUCK_ACTION_KINDS).toEqual([
      'COMPARABLE_REMOVE',
      'PRICE_REPORT_INCORPORATE',
    ])
    expect(SLA_DEAD_LETTER_STATUS).toBe('dead_letter')
    expect(SLA_REAPED_AUDIT_TYPE).toBe('sla_reaped')
  })

  it('resolveSlaHours falls back to DEFAULT_SLA_HOURS', () => {
    expect(resolveSlaHours(48)).toBe(48)
    expect(resolveSlaHours(0)).toBe(48)
    expect(resolveSlaHours(-1)).toBe(48)
  })

  it('runSlaStuckRequestsReaper reaps REQUESTED rows older than SLA in one txn', async () => {
    const queries = []
    const client = {
      query: vi.fn(async (sql, params) => {
        queries.push({ sql: String(sql), params })
        if (String(sql).includes('FROM fin.approval_requests')) {
          return {
            rows: [
              {
                id: 'apr_wf05',
                action_kind: 'COMPARABLE_REMOVE',
                status: 'REQUESTED',
                subject_id: 'cmr_1',
                payload: { report_id: 'cmr_1' },
                created_at: '2026-01-01T00:00:00.000Z',
              },
              {
                id: 'apr_wf06',
                action_kind: 'PRICE_REPORT_INCORPORATE',
                status: 'REQUESTED',
                subject_id: 'aprt_1',
                payload: { report_id: 'aprt_1' },
                created_at: '2026-01-01T00:00:00.000Z',
              },
            ],
          }
        }
        if (String(sql).startsWith('UPDATE fin.approval_requests')) {
          return {
            rowCount: 1,
            rows: [{
              id: params[0],
              action_kind: params[0] === 'apr_wf05' ? 'COMPARABLE_REMOVE' : 'PRICE_REPORT_INCORPORATE',
              subject_id: params[0] === 'apr_wf05' ? 'cmr_1' : 'aprt_1',
              payload: { report_id: params[0] === 'apr_wf05' ? 'cmr_1' : 'aprt_1' },
            }],
          }
        }
        return { rowCount: 1, rows: [] }
      }),
      release: vi.fn(),
    }
    const pool = { connect: vi.fn(async () => client) }

    const result = await runSlaStuckRequestsReaper({
      pool,
      now: '2026-01-05T00:00:00.000Z',
      slaHours: 48,
    })

    expect(result.reaped).toBe(2)
    expect(result.wf05).toBe(1)
    expect(result.wf06).toBe(1)
    expect(queries.some((q) => q.sql.includes("status = $2") && q.params[1] === 'dead_letter')).toBe(true)
    expect(queries.some((q) => q.sql.includes('INSERT INTO public.audit_log') && q.params[1] === 'sla_reaped')).toBe(true)
    expect(client.query).toHaveBeenCalledWith('BEGIN')
    expect(client.query).toHaveBeenCalledWith('COMMIT')
  })
})
