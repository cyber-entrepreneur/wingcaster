import { describe, expect, it, vi } from 'vitest'
import {
  isCommercialPermissionDenied,
  logCommercialWriteAttempt,
  logQuietPeriodEvent,
  watchCommercialWrite,
} from './logger.js'

describe('quiet_period/logger', () => {
  it('inserts via the caller client and never throws', async () => {
    const query = vi.fn(async () => ({ rowCount: 1 }))
    await expect(logQuietPeriodEvent({ query }, {
      kind: 'COMMERCIAL_WRITE_ATTEMPT',
      environment: 'LIVE',
      sourceFile: 'billing/events.js:150',
      message: 'permission denied for table usage_events',
      payload: { tenant_id: 't-1' },
      now: '2026-08-23T00:00:00.000Z',
    })).resolves.toBeUndefined()
    expect(query).toHaveBeenCalledTimes(1)
    const [sql, values] = query.mock.calls[0]
    expect(sql).toMatch(/fin\.cutover_quiet_period_events/)
    expect(values[1]).toBe('LIVE')
    expect(values[2]).toBe('COMMERCIAL_WRITE_ATTEMPT')
    expect(values[3]).toBe('billing/events.js:150')
  })

  it('maps unknown kinds to OTHER', async () => {
    const query = vi.fn(async () => ({ rowCount: 1 }))
    await logQuietPeriodEvent({ query }, { kind: 'NOT_A_KIND', message: 'x' })
    expect(query.mock.calls[0][1][2]).toBe('OTHER')
  })

  it('never throws when the client insert fails', async () => {
    const query = vi.fn(async () => {
      throw Object.assign(new Error('permission denied'), { code: '42501' })
    })
    await expect(logCommercialWriteAttempt({ query }, {
      sourceFile: 'billing/ledger.js',
      message: 'denied',
    })).resolves.toBeUndefined()
  })

  it('never throws when client is null and the pool is unconfigured', async () => {
    await expect(logQuietPeriodEvent(null, { kind: 'OTHER', message: 'no pool' }))
      .resolves.toBeUndefined()
  })

  it('watchCommercialWrite logs 42501 then rethrows', async () => {
    const query = vi.fn(async () => ({ rowCount: 1 }))
    const denied = Object.assign(new Error('permission denied for schema commercial'), { code: '42501' })
    await expect(watchCommercialWrite({ query }, {
      sourceFile: 'billing/events.js',
      environment: 'LIVE',
    }, async () => {
      throw denied
    })).rejects.toBe(denied)
    expect(query).toHaveBeenCalledTimes(1)
  })

  it('watchCommercialWrite does not log non-permission errors', async () => {
    const query = vi.fn(async () => ({ rowCount: 1 }))
    const boom = Object.assign(new Error('unique_violation'), { code: '23505' })
    await expect(watchCommercialWrite({ query }, { sourceFile: 'x' }, async () => {
      throw boom
    })).rejects.toBe(boom)
    expect(query).not.toHaveBeenCalled()
  })

  it('isCommercialPermissionDenied requires 42501 and a commercial hint', () => {
    expect(isCommercialPermissionDenied({ code: '42501', message: 'permission denied for schema commercial' })).toBe(true)
    expect(isCommercialPermissionDenied({ code: '42501', message: 'permission denied for table usage_events' })).toBe(true)
    expect(isCommercialPermissionDenied({ code: '23505', message: 'permission denied for schema commercial' })).toBe(false)
    expect(isCommercialPermissionDenied({ code: '42501', message: 'permission denied for table invoices' })).toBe(false)
  })
})
