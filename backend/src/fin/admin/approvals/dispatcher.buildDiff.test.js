import { describe, it, expect } from 'vitest'
import { buildDiff, actionSummary } from './dispatcher.js'

describe('buildDiff PACKAGE_PUBLISH (WF-07)', () => {
  it('returns state + package fields for approvals UI parity', () => {
    const diff = buildDiff(
      {
        action_kind: 'PACKAGE_PUBLISH',
        status: 'REQUESTED',
        subject_id: 'pkg_1',
        payload: {
          from_status: 'Draft',
          to_status: 'Published',
          package_code: 'pro_elite',
        },
      },
      'WF-07',
    )
    expect(diff).toEqual([
      { field: 'State', before: 'Draft', after: 'Published', kind: 'string' },
      { field: 'Package', before: 'pro_elite', after: 'pro_elite', kind: 'string' },
    ])
    expect(actionSummary({
      action_kind: 'PACKAGE_PUBLISH',
      subject_id: 'pkg_1',
      payload: { package_code: 'pro_elite' },
    }, 'WF-07')).toMatch(/Publish package: pro_elite/)
  })
})
