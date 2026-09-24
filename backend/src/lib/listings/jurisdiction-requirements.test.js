/**
 * Unit tests for the listing-verification jurisdiction gate + parity with the
 * per-portal validators (the hard-gate permit field names must agree).
 */
import { describe, expect, it } from 'vitest'
import {
  GATE_ELIGIBLE_PERMITS,
  GATE_POLICY,
  resolvePropertyCountry,
  gatePolicyForProperty,
  hardGateBlockers,
  deriveVerificationStatus,
  isPublishedState,
  normalizeCountry,
} from './jurisdiction-requirements.js'
import { validate as validateBayut } from '../portal-validators/bayut.js'

describe('resolvePropertyCountry', () => {
  it('prefers explicit country_code', () => {
    expect(resolvePropertyCountry({ country_code: 'AE' })).toBe('AE')
  })
  it('falls back to free-text country / city', () => {
    expect(resolvePropertyCountry({ country: 'United Arab Emirates' })).toBe('AE')
    expect(resolvePropertyCountry({ city: 'Dubai' })).toBe('AE')
    expect(resolvePropertyCountry({ country: 'Lebanon' })).toBe('LB')
  })
  it('returns empty for unknown markets', () => {
    expect(resolvePropertyCountry({ country: 'Narnia' })).toBe('')
    expect(normalizeCountry('')).toBe('')
  })
})

describe('gatePolicyForProperty', () => {
  it('maps hard / soft / none', () => {
    expect(gatePolicyForProperty({ country_code: 'AE' })).toBe('hard')
    expect(gatePolicyForProperty({ country_code: 'SA' })).toBe('hard')
    expect(gatePolicyForProperty({ country_code: 'LB' })).toBe('soft')
    expect(gatePolicyForProperty({ country_code: 'US' })).toBe('none')
  })
})

describe('hardGateBlockers', () => {
  it('blocks a UAE property with no permit', () => {
    const gate = hardGateBlockers({ country_code: 'AE' })
    expect(gate.policy).toBe('hard')
    expect(gate.missing).toHaveLength(1)
    expect(gate.missing[0].key).toBe('trakheesi_permit')
  })
  it('passes a UAE property with a permit', () => {
    expect(hardGateBlockers({ country_code: 'AE', trakheesi_number: '71-123' }).missing).toHaveLength(0)
  })
  it('passes a UAE property with the permit nested in data', () => {
    expect(hardGateBlockers({ country_code: 'AE', data: { trakheesi_number: '71-123' } }).missing).toHaveLength(0)
  })
  it('blocks a KSA property with no advertiser licence', () => {
    expect(hardGateBlockers({ country_code: 'SA' }).missing[0].key).toBe('rega_ad_licence')
  })
  it('never blocks soft / none markets', () => {
    expect(hardGateBlockers({ country_code: 'LB' }).missing).toHaveLength(0)
    expect(hardGateBlockers({ country_code: 'US' }).missing).toHaveLength(0)
  })
})

describe('deriveVerificationStatus', () => {
  it('hard market → authorised only with the permit', () => {
    expect(deriveVerificationStatus({ country_code: 'AE' })).toBe('unverified')
    expect(deriveVerificationStatus({ country_code: 'AE', trakheesi_number: '71-1' })).toBe('authorised')
  })
  it('soft market → authorised when references present', () => {
    expect(deriveVerificationStatus({ country_code: 'LB' })).toBe('unverified')
    expect(
      deriveVerificationStatus({ country_code: 'LB', authorization_ref: 'A', ownership_ref: 'B' }),
    ).toBe('authorised')
  })
  it('none market → always unverified', () => {
    expect(deriveVerificationStatus({ country_code: 'US', trakheesi_number: 'x' })).toBe('unverified')
  })
})

describe('isPublishedState', () => {
  it('active/public is published', () => {
    expect(isPublishedState({ status: 'active', visibility: 'public' })).toBe(true)
    expect(isPublishedState({ status: 'published' })).toBe(true)
  })
  it('draft / private / pocket are DB-only (not published)', () => {
    expect(isPublishedState({ status: 'draft' })).toBe(false)
    expect(isPublishedState({ status: 'active', visibility: 'private' })).toBe(false)
    expect(isPublishedState({ status: 'active', visibility: 'pocket' })).toBe(false)
  })
})

describe('parity with per-portal validators', () => {
  it('AE hard-gate permit name matches the Bayut trakheesi requirement', () => {
    // Bayut (UAE) requires trakheesi_number — the gate must key on the same field.
    const result = validateBayut(
      { trakheesi_number: '71-123', broker_orn: 'X' },
      { countryCode: 'AE' },
    )
    const trakheesiCheck = result.checks.find((c) => c.code === 'required_trakheesi_number')
    expect(trakheesiCheck.severity).toBe('pass')
    expect(GATE_ELIGIBLE_PERMITS.AE.names).toContain('trakheesi_number')
  })
  it('every hard-policy market has a gate-eligible permit definition', () => {
    for (const [code, policy] of Object.entries(GATE_POLICY)) {
      if (policy === 'hard') expect(GATE_ELIGIBLE_PERMITS[code]).toBeTruthy()
    }
  })
})
