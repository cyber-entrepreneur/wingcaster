import { describe, expect, it } from 'vitest'
import { buildTelLink, buildWaMeLink } from './waMeLink'

describe('buildWaMeLink', () => {
  it('strips plus, spaces, and punctuation from E.164', () => {
    expect(buildWaMeLink('+971 4 123 4567', 'WC-A4K9-JAMIL')).toBe(
      'https://wa.me/97141234567?text=WC-A4K9-JAMIL',
    )
  })

  it('URL-encodes the display code including RTL characters', () => {
    const href = buildWaMeLink('+971501234567', 'WC-A4K9-جميل')
    expect(href.startsWith('https://wa.me/971501234567?text=')).toBe(true)
    expect(href).toContain(encodeURIComponent('WC-A4K9-جميل'))
  })

  it('handles an empty number without throwing', () => {
    expect(buildWaMeLink('', 'hello world')).toBe(
      `https://wa.me/?text=${encodeURIComponent('hello world')}`,
    )
  })

  it('buildTelLink prefixes digits with plus', () => {
    expect(buildTelLink('+971 4 XXX XXXX')).toBe('tel:+9714')
  })
})
