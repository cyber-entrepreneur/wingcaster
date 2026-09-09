import { describe, expect, it } from 'vitest'
import {
  formatTenureMonth,
  isHighRisk,
  lintCounts,
  requiresTwoPersonReject,
  sortLintChecks,
  substituteNotificationPreview,
} from '@/api/portalModeration'

describe('portalModeration helpers', () => {
  it('sorts lint fails before warns before passes', () => {
    const sorted = sortLintChecks([
      { code: 'a', severity: 'pass', message: 'ok' },
      { code: 'b', severity: 'fail', message: 'bad' },
      { code: 'c', severity: 'warn', message: 'hmm' },
    ])
    expect(sorted.map((c) => c.code)).toEqual(['b', 'c', 'a'])
  })

  it('counts lint severities', () => {
    expect(
      lintCounts([
        { code: 'a', severity: 'pass', message: '' },
        { code: 'b', severity: 'fail', message: '' },
        { code: 'c', severity: 'fail', message: '' },
        { code: 'd', severity: 'warn', message: '' },
      ]),
    ).toEqual({ pass: 1, warn: 1, fail: 2 })
  })

  it('substitutes notification preview tokens', () => {
    expect(
      substituteNotificationPreview('Reason: {reason_code_label}. Notes: {notes}', {
        reason_code_label: 'Insufficient photos',
        notes: 'Add more photos',
      }),
    ).toBe('Reason: Insufficient photos. Notes: Add more photos')
  })

  it('formats tenure month', () => {
    expect(formatTenureMonth('2024-01')).toMatch(/Jan 2024/)
  })

  it('detects two-person reject gate', () => {
    expect(isHighRisk('high')).toBe(true)
    expect(
      requiresTwoPersonReject({
        tenure_risk: { tier: 'high' },
        agency: { id: 'a', name: 'A', tenant_url: '/', two_person_reject_required: true },
      }),
    ).toBe(true)
    expect(
      requiresTwoPersonReject({
        tenure_risk: { tier: 'low' },
        agency: { id: 'a', name: 'A', tenant_url: '/', two_person_reject_required: true },
      }),
    ).toBe(false)
  })
})
