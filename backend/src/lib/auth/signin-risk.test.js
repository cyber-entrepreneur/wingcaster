/**
 * Unit tests for T1 behavioural risk-scoring engine.
 *
 * Covers:
 *   - hashIdentifier lowercases + trims + sha256 (no PII leakage)
 *   - velocityScore: below tolerance = 0, at cap = 25, cross-tolerance
 *     boundary scores correctly
 *   - timeOfDayScore: <10 prior successes → 0 (no history), inside sigma →
 *     0, outside sigma → 15
 *   - geoInstabilityScore: fewer than 3 distinct countries → 0,
 *     >=3 distinct → 10
 *   - scoreSigninAttempt: aggregates + picks decision; risk >=70 → block,
 *     >=40 → step-up, <40 → allow
 *   - Fail-safe: scoreSigninAttempt returns { decision: 'allow', score: 0 }
 *     when the DB errors
 *   - recordSigninEvent: writes row, swallows insert errors
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const db = vi.hoisted(() => ({ query: vi.fn(), insert: vi.fn() }))
vi.mock('../../db.js', () => db)
vi.mock('../logger.js', () => ({
  default: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}))

let scoreSigninAttempt
let recordSigninEvent
let __testables
let RISK_BLOCK_THRESHOLD
let RISK_STEP_UP_THRESHOLD

beforeEach(async () => {
  vi.resetModules()
  db.query.mockReset()
  db.insert.mockReset()
  ;({
    scoreSigninAttempt,
    recordSigninEvent,
    __testables,
    RISK_BLOCK_THRESHOLD,
    RISK_STEP_UP_THRESHOLD,
  } = await import('./signin-risk.js'))
})

afterEach(() => vi.restoreAllMocks())

describe('hashIdentifier', () => {
  it('lowercases + trims + hashes (deterministic, no PII in output)', () => {
    const a = __testables.hashIdentifier('Alice@Example.COM ')
    const b = __testables.hashIdentifier('alice@example.com')
    expect(a).toBe(b)
    expect(a).toMatch(/^[0-9a-f]{64}$/)
    expect(a).not.toContain('alice')
  })
  it('null / empty → null', () => {
    expect(__testables.hashIdentifier(null)).toBeNull()
    expect(__testables.hashIdentifier('')).toBeNull()
  })
})

describe('meanAndSigma', () => {
  it('returns 0 for empty', () => {
    expect(__testables.meanAndSigma([])).toEqual({ mean: 0, sigma: 0 })
  })
  it('correct for constant series (sigma=0)', () => {
    const r = __testables.meanAndSigma([5, 5, 5, 5])
    expect(r.mean).toBe(5)
    expect(r.sigma).toBe(0)
  })
  it('correct for known series', () => {
    // [1,2,3,4,5] mean=3, sigma≈1.4142
    const r = __testables.meanAndSigma([1, 2, 3, 4, 5])
    expect(r.mean).toBe(3)
    expect(r.sigma).toBeCloseTo(1.4142, 3)
  })
})

describe('velocity scoring — via scoreSigninAttempt', () => {
  it('0 failures → 0 points', async () => {
    db.query.mockImplementation(async (sql) => {
      if (/COUNT\(\*\)/i.test(sql)) return [{ n: 0 }]
      return []
    })
    const r = await scoreSigninAttempt({ userId: 'u-1', ip: '1.1.1.1' })
    expect(r.score).toBe(0)
    expect(r.decision).toBe('allow')
  })
  it('at tolerance (5 failures) → 0 points', async () => {
    db.query.mockImplementation(async (sql) => {
      if (/COUNT\(\*\)/i.test(sql)) return [{ n: 5 }]
      return []
    })
    const r = await scoreSigninAttempt({ userId: 'u-1', ip: '1.1.1.1' })
    expect(r.score).toBe(0)
  })
  it('tolerance+1 failures user side = 5 points', async () => {
    db.query.mockImplementation(async (sql, params) => {
      if (/COUNT\(\*\)/i.test(sql)) {
        // user query has $1=userId, ip query has $1=ip
        if (params?.[0] === 'u-1') return [{ n: 6 }]
        return [{ n: 0 }]
      }
      return []
    })
    const r = await scoreSigninAttempt({ userId: 'u-1', ip: '1.1.1.1' })
    expect(r.score).toBe(5)
    expect(r.reasons.some((x) => x.signal === 'velocity_user')).toBe(true)
  })
  it('runaway failures cap at 25 per signal', async () => {
    db.query.mockImplementation(async (sql) => {
      if (/COUNT\(\*\)/i.test(sql)) return [{ n: 100 }]
      return []
    })
    const r = await scoreSigninAttempt({ userId: 'u-1', ip: '1.1.1.1' })
    // 25 (user) + 25 (ip) = 50 total
    expect(r.score).toBe(50)
    expect(r.decision).toBe('require_step_up')
  })
})

describe('time-of-day scoring — via scoreSigninAttempt', () => {
  it('returns 0 with fewer than MIN_HISTORY prior successes', async () => {
    db.query.mockImplementation(async (sql) => {
      if (/COUNT\(\*\)/i.test(sql)) return [{ n: 0 }]
      if (/EXTRACT\(HOUR/i.test(sql)) {
        return Array.from({ length: 5 }, () => ({ h: 9 }))
      }
      return []
    })
    const r = await scoreSigninAttempt({ userId: 'u-1', atHour: 14 })
    expect(r.reasons.some((x) => x.signal === 'time_of_day_anomaly')).toBe(false)
  })
  it('adds 15 points when current hour > 3σ from user mean', async () => {
    // User has 20 sign-ins at hour 9 sharp → sigma=0 → any different hour is >3σ.
    db.query.mockImplementation(async (sql) => {
      if (/COUNT\(\*\)/i.test(sql)) return [{ n: 0 }]
      if (/EXTRACT\(HOUR/i.test(sql)) {
        return Array.from({ length: 20 }, () => ({ h: 9 }))
      }
      return []
    })
    // Wait — sigma=0 branch returns 0 in the helper, on purpose. Instead
    // give a spread so sigma>0 and hour is comfortably outside.
    db.query.mockImplementation(async (sql) => {
      if (/COUNT\(\*\)/i.test(sql)) return [{ n: 0 }]
      if (/EXTRACT\(HOUR/i.test(sql)) {
        // Mean=9, sigma≈1: 3σ range = [6..12]. atHour=22 is way out.
        return [
          ...Array(10).fill({ h: 8 }),
          ...Array(10).fill({ h: 10 }),
        ]
      }
      return []
    })
    const r = await scoreSigninAttempt({ userId: 'u-1', atHour: 22 })
    expect(r.reasons.some((x) => x.signal === 'time_of_day_anomaly')).toBe(true)
    expect(r.score).toBe(15)
  })
})

describe('geo instability scoring', () => {
  it('<3 distinct countries → 0 points', async () => {
    db.query.mockImplementation(async (sql) => {
      if (/COUNT\(\*\)/i.test(sql)) return [{ n: 0 }]
      if (/EXTRACT\(HOUR/i.test(sql)) return []
      if (/ip_country/i.test(sql)) return [{ ip_country: 'AE' }, { ip_country: 'AE' }]
      return []
    })
    const r = await scoreSigninAttempt({ userId: 'u-1' })
    expect(r.reasons.some((x) => x.signal === 'geo_instability')).toBe(false)
  })
  it('>=3 distinct countries → 10 points', async () => {
    db.query.mockImplementation(async (sql) => {
      if (/COUNT\(\*\)/i.test(sql)) return [{ n: 0 }]
      if (/EXTRACT\(HOUR/i.test(sql)) return []
      if (/ip_country/i.test(sql)) return [
        { ip_country: 'AE' },
        { ip_country: 'SA' },
        { ip_country: 'US' },
      ]
      return []
    })
    const r = await scoreSigninAttempt({ userId: 'u-1' })
    expect(r.reasons.some((x) => x.signal === 'geo_instability')).toBe(true)
    expect(r.score).toBe(10)
  })
})

describe('decision thresholds', () => {
  it('score >= 70 → decision: block', async () => {
    db.query.mockImplementation(async (sql) => {
      if (/COUNT\(\*\)/i.test(sql)) return [{ n: 100 }] // 25+25 = 50 velocity
      if (/EXTRACT\(HOUR/i.test(sql)) {
        // Provide history so time-of-day fires (+15)
        return [...Array(10).fill({ h: 8 }), ...Array(10).fill({ h: 10 })]
      }
      if (/ip_country/i.test(sql)) return [
        { ip_country: 'AE' },
        { ip_country: 'SA' },
        { ip_country: 'US' },
      ] // +10
      return []
    })
    const r = await scoreSigninAttempt({ userId: 'u-1', ip: '1.1.1.1', atHour: 22 })
    expect(r.score).toBeGreaterThanOrEqual(RISK_BLOCK_THRESHOLD)
    expect(r.decision).toBe('block')
    expect(r.decisionReason).toBe('risk_high')
  })
  it('40 <= score < 70 → decision: require_step_up', async () => {
    db.query.mockImplementation(async (sql) => {
      if (/COUNT\(\*\)/i.test(sql)) return [{ n: 100 }] // 50 velocity
      if (/EXTRACT\(HOUR/i.test(sql)) return []
      if (/ip_country/i.test(sql)) return []
      return []
    })
    const r = await scoreSigninAttempt({ userId: 'u-1', ip: '1.1.1.1' })
    expect(r.score).toBe(50)
    expect(r.decision).toBe('require_step_up')
    expect(r.decisionReason).toBe('risk_elevated')
  })
  it('score < 40 → decision: allow', async () => {
    db.query.mockImplementation(async (sql) => {
      if (/COUNT\(\*\)/i.test(sql)) return [{ n: 0 }]
      if (/EXTRACT\(HOUR/i.test(sql)) return []
      if (/ip_country/i.test(sql)) return []
      return []
    })
    const r = await scoreSigninAttempt({ userId: 'u-1', ip: '1.1.1.1' })
    expect(r.decision).toBe('allow')
  })
  it('is fail-safe on DB error (score=0, decision=allow)', async () => {
    db.query.mockRejectedValue(new Error('db down'))
    const r = await scoreSigninAttempt({ userId: 'u-1', ip: '1.1.1.1' })
    expect(r.score).toBe(0)
    expect(r.decision).toBe('allow')
  })
})

describe('recordSigninEvent', () => {
  it('writes user_signin_events row', async () => {
    db.insert.mockResolvedValue({})
    await recordSigninEvent({
      userId: 'u-1',
      identifier: 'alice@example.com',
      outcome: 'success',
      ip: '1.1.1.1',
      riskScore: 12,
      riskReasons: [{ signal: 'velocity_user', points: 5 }],
    })
    const calls = db.insert.mock.calls
    expect(calls[0][0]).toBe('user_signin_events')
    expect(calls[0][1].outcome).toBe('success')
    expect(calls[0][1].risk_score).toBe(12)
    // identifier hashed, not raw
    expect(calls[0][1].identifier_hash).toMatch(/^[0-9a-f]{64}$/)
    expect(calls[0][1].identifier_hash).not.toContain('alice')
  })
  it('is fail-safe on insert error (does not throw)', async () => {
    db.insert.mockRejectedValue(new Error('db down'))
    await expect(
      recordSigninEvent({ userId: 'u-1', outcome: 'password_fail' }),
    ).resolves.toBeUndefined()
  })
})
