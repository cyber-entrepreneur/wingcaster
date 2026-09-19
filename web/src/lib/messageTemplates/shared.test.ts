import { describe, expect, it } from 'vitest'
import { extractTemplateVariables, smsSegmentInfo } from './shared'

describe('messageTemplates/shared', () => {
  it('extracts unique variables from body and subject', () => {
    expect(extractTemplateVariables('Hi {{client_name}}', 'Re: {{property_title}}')).toEqual([
      'client_name',
      'property_title',
    ])
  })

  it('computes SMS segment counts', () => {
    expect(smsSegmentInfo('short')).toEqual({ chars: 5, segments: 1, limit: 160 })
    expect(smsSegmentInfo('x'.repeat(161))).toEqual({ chars: 161, segments: 2, limit: 153 })
  })
})
