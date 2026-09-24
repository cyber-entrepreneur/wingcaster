import { describe, expect, it } from 'vitest'
import {
  propertyVerificationFor,
  gatePolicyFor,
  normalizeCountryToIso2,
  deriveVerificationStatus,
  publishBlockers,
  badgeFieldsFor,
} from './listingVerification'

describe('normalizeCountryToIso2', () => {
  it('maps free text + aliases to ISO2', () => {
    expect(normalizeCountryToIso2('UAE')).toBe('AE')
    expect(normalizeCountryToIso2('dubai')).toBe('AE')
    expect(normalizeCountryToIso2('United Arab Emirates')).toBe('AE')
    expect(normalizeCountryToIso2('Saudi Arabia')).toBe('SA')
    expect(normalizeCountryToIso2('Lebanon')).toBe('LB')
    expect(normalizeCountryToIso2('')).toBe('')
    expect(normalizeCountryToIso2('Narnia')).toBe('')
  })
})

describe('propertyVerificationFor (from the market registry, gate-eligible permit)', () => {
  it('returns the sourced permit for hard markets', () => {
    expect(propertyVerificationFor('AE').map((f) => f.key)).toEqual(['trakheesi_permit'])
    expect(propertyVerificationFor('SA').map((f) => f.key)).toEqual(['rega_ad_licence'])
  })
  it('returns nothing for soft/none markets', () => {
    expect(propertyVerificationFor('LB')).toHaveLength(0)
    expect(propertyVerificationFor('KW')).toHaveLength(0)
    expect(propertyVerificationFor('US')).toHaveLength(0)
  })
})

describe('gatePolicyFor', () => {
  it('classifies markets', () => {
    expect(gatePolicyFor('AE')).toBe('hard')
    expect(gatePolicyFor('SA')).toBe('hard')
    expect(gatePolicyFor('LB')).toBe('soft')
    expect(gatePolicyFor('KW')).toBe('soft')
    expect(gatePolicyFor('US')).toBe('none')
  })
})

describe('publishBlockers (client mirror of the hard gate)', () => {
  it('blocks hard markets without the permit', () => {
    expect(publishBlockers('AE', {}).map((f) => f.key)).toEqual(['trakheesi_permit'])
    expect(publishBlockers('AE', { trakheesi_permit: '71-1' })).toHaveLength(0)
  })
  it('never blocks soft/none markets', () => {
    expect(publishBlockers('LB', {})).toHaveLength(0)
    expect(publishBlockers('US', {})).toHaveLength(0)
  })
})

describe('deriveVerificationStatus', () => {
  it('hard market earns authorised only with the permit', () => {
    expect(deriveVerificationStatus('AE', {})).toBe('unverified')
    expect(deriveVerificationStatus('AE', { trakheesi_permit: '71-1' })).toBe('authorised')
  })
  it('soft market earns authorised from references', () => {
    expect(deriveVerificationStatus('LB', {})).toBe('unverified')
    expect(deriveVerificationStatus('LB', { authorization_ref: 'A', ownership_ref: 'B' })).toBe(
      'authorised',
    )
  })
  it('none market never earns a badge', () => {
    expect(deriveVerificationStatus('US', { trakheesi_permit: 'x' })).toBe('unverified')
    expect(badgeFieldsFor('US')).toHaveLength(0)
  })
})
