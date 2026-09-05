import { describe, expect, it } from 'vitest'
import { parseInboundText, parseCodeCandidate } from '../webhook-parser.js'

describe('activation code parser (H1)', () => {
  it('is case-insensitive and accepts optional prefix/suffix and whitespace', () => {
    expect(parseCodeCandidate('a4k9')).toEqual({ type: 'code', code: 'A4K9' })
    expect(parseCodeCandidate('  WC-A4K9-JAMIL  ')).toEqual({ type: 'code', code: 'A4K9' })
    expect(parseCodeCandidate('WC-A4K9')).toEqual({ type: 'code', code: 'A4K9' })
    expect(parseCodeCandidate('A4K9-JAMIL')).toEqual({ type: 'code', code: 'A4K9' })
  })

  it('rejects malformed codes and suggests on dropped characters', () => {
    expect(parseCodeCandidate('HELLO WORLD')).toEqual({ type: 'none' })
    expect(parseCodeCandidate('WC-4K9')).toEqual({ type: 'partial', code: '4K9' })
    expect(parseCodeCandidate('O0I1')).toEqual({ type: 'none' })
  })
})

describe('WC-* command router (H7)', () => {
  it('recognizes reserved commands and requires the WC- prefix', () => {
    expect(parseInboundText('WC-BIND A4K9')).toEqual({
      type: 'command',
      command: 'BIND',
      arg: { type: 'code', code: 'A4K9' },
    })
    expect(parseInboundText('wc-unbind')).toEqual({
      type: 'command',
      command: 'UNBIND',
      arg: { type: 'none' },
    })
    expect(parseInboundText('WC-LIST')).toMatchObject({ type: 'command', command: 'LIST' })
    expect(parseInboundText('WC-TRANSFER')).toMatchObject({ type: 'command', command: 'TRANSFER' })
  })

  it('does not treat listing text as a command', () => {
    expect(parseInboundText('BIND this listing to Bayut')).toEqual({ type: 'none' })
    expect(parseInboundText('UNBIND the old unit')).toEqual({ type: 'none' })
    expect(parseInboundText('2 bed in Hamra, 300k')).toEqual({ type: 'none' })
  })

  it('parses H2 selector replies', () => {
    expect(parseInboundText('1')).toEqual({ type: 'selector', choice: 1 })
    expect(parseInboundText('2')).toEqual({ type: 'selector', choice: 2 })
  })
})
