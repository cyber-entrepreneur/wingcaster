import { describe, expect, it } from 'vitest'
import { buildScopeFilter } from './scope.js'

describe('buildScopeFilter', () => {
  it('returns undefined when nothing is scopeable', () => {
    expect(buildScopeFilter()).toBeUndefined()
    expect(buildScopeFilter({ columns: { agency_id: null, agent_id: undefined } })).toBeUndefined()
    expect(buildScopeFilter({ columns: {}, dateColumn: 'created_at' })).toBeUndefined()
  })

  it('drops empty and nullish column values but keeps empty arrays', () => {
    expect(buildScopeFilter({ columns: { agency_id: '', agent_id: null } })).toBeUndefined()
    expect(buildScopeFilter({ columns: { campaign_id: [] } })).toEqual({ campaign_id: [] })
  })

  it('builds equality and IN column predicates', () => {
    expect(buildScopeFilter({ columns: { agency_id: 'agc_1' } })).toEqual({ agency_id: 'agc_1' })
    expect(buildScopeFilter({ columns: { property_id: ['p1', 'p2'] } })).toEqual({
      property_id: ['p1', 'p2'],
    })
  })

  it('builds a half-open date window as a range spec', () => {
    const start = new Date('2026-01-01T00:00:00Z')
    const end = new Date('2026-02-01T00:00:00Z')
    expect(buildScopeFilter({ dateColumn: 'created_at', startDate: start, endDate: end })).toEqual({
      created_at: { gte: start, lt: end },
    })
  })

  it('coerces ISO date strings to Date instances', () => {
    const result = buildScopeFilter({ dateColumn: 'closed_at', startDate: '2026-03-01T00:00:00Z' })
    expect(result.closed_at.gte).toBeInstanceOf(Date)
    expect(result.closed_at.gte.toISOString()).toBe('2026-03-01T00:00:00.000Z')
    expect(result.closed_at.lt).toBeUndefined()
  })

  it('supports only a start or only an end bound', () => {
    const start = new Date('2026-01-01T00:00:00Z')
    expect(buildScopeFilter({ dateColumn: 'created_at', startDate: start })).toEqual({
      created_at: { gte: start },
    })
    const end = new Date('2026-02-01T00:00:00Z')
    expect(buildScopeFilter({ dateColumn: 'created_at', endDate: end })).toEqual({
      created_at: { lt: end },
    })
  })

  it('combines columns and a date window', () => {
    const start = new Date('2026-01-01T00:00:00Z')
    expect(
      buildScopeFilter({
        columns: { agency_id: 'agc_1', agent_id: 'agt_9' },
        dateColumn: 'created_at',
        startDate: start,
      }),
    ).toEqual({ agency_id: 'agc_1', agent_id: 'agt_9', created_at: { gte: start } })
  })
})
