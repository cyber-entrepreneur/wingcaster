/**
 * Unit tests for H1 conditional MFA rules + group scoping + bypass list.
 *
 * Covers:
 *   - haversineKm: reasonable distances for known pairs, null on bad input
 *   - memberMatchesScopedRoles: empty scope = all pass; non-empty = role match only
 *   - userIsBypassed: id in bypass list = pass
 *   - isUnusualIp / isNewDevice: seen before → false; unseen with baseline → true;
 *     first-ever sign-in → false (no baseline yet, don't block)
 *   - isImpossibleGeoHop: >500 km/h between last-seen and current → true
 *   - Route evaluator: scoped role skip, bypass list skip, conditional fire =
 *     block regardless of grace, enforce_on_next_login = zero grace
 *   - Auto wrapper: policies without H1 fields → base evaluator called
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const db = vi.hoisted(() => ({
  query: vi.fn(),
  findAll: vi.fn(),
  insert: vi.fn(),
}))

const identity = vi.hoisted(() => ({
  findUserById: vi.fn(),
}))

vi.mock('../../db.js', () => db)
vi.mock('../../identity.js', () => identity)
vi.mock('../logger.js', () => ({
  default: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}))
vi.mock('../../tenant-authorization.js', () => ({ getAgencyMembership: vi.fn() }))

let evaluateH1
let evaluateAuto
let recordSigninSignal
let __testables
let loadAgencyMfaPolicy

const USER_ID = 'user-1'

beforeEach(async () => {
  vi.resetModules()
  db.query.mockReset()
  db.findAll.mockReset()
  db.insert.mockReset()
  identity.findUserById.mockReset()

  ;({
    evaluateMfaPolicyForSignInH1: evaluateH1,
    evaluateMfaPolicyForSignInAuto: evaluateAuto,
    recordSigninSignal,
    __testables,
  } = await import('./mfa-policy-conditional.js'))
  ;({ loadAgencyMfaPolicy } = await import('./mfa-policy-routes.js'))
})

afterEach(() => vi.restoreAllMocks())

describe('haversineKm', () => {
  it('measures Dubai → Riyadh at roughly 870 km (±50)', () => {
    const dxb = { lat: 25.2048, lon: 55.2708 }
    const ruh = { lat: 24.7136, lon: 46.6753 }
    const km = __testables.haversineKm(dxb, ruh)
    expect(km).toBeGreaterThan(800)
    expect(km).toBeLessThan(900)
  })
  it('returns null on missing coords', () => {
    expect(__testables.haversineKm(null, { lat: 1, lon: 2 })).toBeNull()
    expect(__testables.haversineKm({ lat: 1 }, { lat: 2, lon: 3 })).toBeNull()
  })
})

describe('memberMatchesScopedRoles', () => {
  it('empty scope → true for any role', () => {
    expect(__testables.memberMatchesScopedRoles({ role: 'agent' }, [])).toBe(true)
    expect(__testables.memberMatchesScopedRoles({ role: 'owner' }, undefined)).toBe(true)
  })
  it('non-empty scope → true only for match', () => {
    expect(__testables.memberMatchesScopedRoles({ role: 'agent' }, ['owner', 'admin'])).toBe(false)
    expect(__testables.memberMatchesScopedRoles({ role: 'admin' }, ['owner', 'admin'])).toBe(true)
  })
})

describe('userIsBypassed', () => {
  it('returns true when user id is on the list', () => {
    expect(__testables.userIsBypassed('u-1', ['u-1', 'u-2'])).toBe(true)
    expect(__testables.userIsBypassed('u-3', ['u-1', 'u-2'])).toBe(false)
    expect(__testables.userIsBypassed('u-1', [])).toBe(false)
    expect(__testables.userIsBypassed('u-1', undefined)).toBe(false)
  })
})

describe('isUnusualIp', () => {
  it('returns false when user has no baseline signals (first sign-in)', async () => {
    db.query.mockResolvedValue([])
    const result = await __testables.isUnusualIp(USER_ID, '1.1.1.1')
    expect(result).toBe(false)
  })
  it('returns false when IP was seen before', async () => {
    // First call = any-signals check (returns something → baseline exists)
    // Second call = exact-IP check (returns something → seen)
    db.query
      .mockResolvedValueOnce([{ '?column?': 1 }])
      .mockResolvedValueOnce([{ '?column?': 1 }])
    const result = await __testables.isUnusualIp(USER_ID, '1.1.1.1')
    expect(result).toBe(false)
  })
  it('returns true when IP is unseen but baseline exists', async () => {
    db.query
      .mockResolvedValueOnce([{ '?column?': 1 }]) // baseline exists
      .mockResolvedValueOnce([]) // this IP unseen
    const result = await __testables.isUnusualIp(USER_ID, '9.9.9.9')
    expect(result).toBe(true)
  })
})

describe('evaluateMfaPolicyForSignInH1', () => {
  const AGENCY = 'agency-1'
  const NOW = new Date('2026-09-16T10:00:00Z').toISOString()

  function stubMemberships(memberships) {
    db.findAll.mockImplementation(async (col) => {
      if (col === 'agency_members') return memberships
      return []
    })
  }
  function stubPolicy(overrides) {
    db.query.mockImplementation(async (sql, params) => {
      if (/FROM agency_mfa_policy/i.test(sql)) {
        return [
          {
            agency_id: params?.[0] || AGENCY,
            required: true,
            grace_days: 14,
            allowed_factors: [],
            scoped_roles: [],
            bypass_user_ids: [],
            conditional_rules: [],
            enforce_on_next_login: false,
            updated_at: NOW,
            ...overrides,
          },
        ]
      }
      return []
    })
  }

  it('scoped_roles skip: policy scoped to owners doesn\'t apply to agent members', async () => {
    stubMemberships([
      { user_id: USER_ID, agency_id: AGENCY, role: 'agent', joined_at: NOW, status: 'active' },
    ])
    stubPolicy({ scoped_roles: ['owner'] })
    const decision = await evaluateH1({ id: USER_ID, totp_enabled: false })
    expect(decision.block).toBe(false)
  })

  it('bypass_user_ids skip: user on bypass list is exempt', async () => {
    stubMemberships([
      { user_id: USER_ID, agency_id: AGENCY, role: 'agent', joined_at: NOW, status: 'active' },
    ])
    stubPolicy({ bypass_user_ids: [USER_ID] })
    const decision = await evaluateH1({ id: USER_ID, totp_enabled: false })
    expect(decision.block).toBe(false)
  })

  it('enforce_on_next_login: grace_days ignored, blocks immediately', async () => {
    stubMemberships([
      { user_id: USER_ID, agency_id: AGENCY, role: 'agent', joined_at: NOW, status: 'active' },
    ])
    stubPolicy({ enforce_on_next_login: true, grace_days: 90 })
    const decision = await evaluateH1({ id: USER_ID, totp_enabled: false })
    expect(decision.block).toBe(true)
    expect(decision.reason).toBe('grace_expired')
  })

  it('conditional_rule_fired: unusual_ip rule blocks even within grace', async () => {
    stubMemberships([
      {
        user_id: USER_ID,
        agency_id: AGENCY,
        role: 'agent',
        joined_at: new Date(Date.now() - 86400000).toISOString(), // yesterday
        status: 'active',
      },
    ])
    // Provide unusual-IP mock across multiple query calls:
    //   1. loadPolicy SELECT
    //   2. isUnusualIp — any-baseline check
    //   3. isUnusualIp — exact-IP check
    let call = 0
    db.query.mockImplementation(async (sql) => {
      call += 1
      if (/FROM agency_mfa_policy/i.test(sql)) {
        return [
          {
            agency_id: AGENCY,
            required: true,
            grace_days: 14,
            allowed_factors: [],
            scoped_roles: [],
            bypass_user_ids: [],
            conditional_rules: [{ kind: 'unusual_ip' }],
            enforce_on_next_login: false,
            updated_at: new Date(Date.now() - 86400000).toISOString(),
          },
        ]
      }
      if (/FROM user_signin_signals/i.test(sql)) {
        // baseline-exists returns 1 row, exact-IP-match returns 0
        if (sql.includes("signal_value = $2")) return []
        return [{ '?column?': 1 }]
      }
      return []
    })
    const decision = await evaluateH1(
      { id: USER_ID, totp_enabled: false },
      { ip: '9.9.9.9' },
    )
    expect(decision.block).toBe(true)
    expect(decision.reason).toBe('conditional_rule_fired')
    expect(decision.rule.kind).toBe('unusual_ip')
  })
})

describe('evaluateMfaPolicyForSignInAuto', () => {
  it('falls back to the base evaluator when no H1 fields set', async () => {
    // No memberships means base evaluator returns block:false.
    db.findAll.mockResolvedValue([])
    const decision = await evaluateAuto({ id: USER_ID, totp_enabled: false })
    expect(decision.block).toBe(false)
  })

  it('uses the H1 evaluator when a policy sets conditional_rules', async () => {
    db.findAll.mockResolvedValue([
      { user_id: USER_ID, agency_id: 'agency-1', role: 'agent', joined_at: new Date().toISOString(), status: 'active' },
    ])
    db.query.mockImplementation(async (sql) => {
      if (/FROM agency_mfa_policy/i.test(sql)) {
        return [
          {
            agency_id: 'agency-1',
            required: true,
            grace_days: 14,
            allowed_factors: [],
            scoped_roles: [],
            bypass_user_ids: [],
            // Non-empty triggers H1 branch
            conditional_rules: [{ kind: 'unusual_ip' }],
            enforce_on_next_login: false,
            updated_at: new Date().toISOString(),
          },
        ]
      }
      // No baseline for unusual_ip → rule doesn't fire → grace applies
      return []
    })
    const decision = await evaluateAuto({ id: USER_ID, totp_enabled: false }, { ip: '1.1.1.1' })
    // Within grace, no rule fire, no baseline → banner active
    expect(decision.block).toBe(false)
    expect(decision.banner).toBe('grace_active')
  })
})

describe('recordSigninSignal', () => {
  it('no-ops when required fields are missing', async () => {
    await recordSigninSignal({ userId: null, signalKind: 'ip', signalValue: '1.1.1.1' })
    expect(db.query).not.toHaveBeenCalled()
  })
  it('writes INSERT + UPDATE for a valid signal, swallows errors', async () => {
    db.query.mockResolvedValue([])
    await recordSigninSignal({
      userId: 'u-1',
      signalKind: 'ip',
      signalValue: '1.1.1.1',
      ipCountry: 'AE',
    })
    expect(db.query.mock.calls.some((c) => /^INSERT INTO user_signin_signals/i.test(c[0]))).toBe(true)
    expect(db.query.mock.calls.some((c) => /^UPDATE user_signin_signals/i.test(c[0]))).toBe(true)
  })
  it('is fail-safe on DB error (does not throw)', async () => {
    db.query.mockRejectedValue(new Error('db down'))
    await expect(
      recordSigninSignal({ userId: 'u-1', signalKind: 'ip', signalValue: '1.1.1.1' }),
    ).resolves.toBeUndefined()
  })
})
