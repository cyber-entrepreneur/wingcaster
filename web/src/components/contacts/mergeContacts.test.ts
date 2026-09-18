import { describe, expect, it } from 'vitest'
import { buildMergePreview, defaultFieldSelections } from './mergeContacts'

const source = {
  id: 'a',
  name: 'Alice',
  email: 'alice@example.com',
  phone: '',
  status: 'lead',
  source: 'portal',
  tags: ['vip'],
}

const target = {
  id: 'b',
  name: 'Alicia',
  email: '',
  phone: '+971500000000',
  status: 'client',
  source: 'whatsapp',
  tags: ['buyer'],
}

describe('mergeContacts helpers', () => {
  it('defaults field picks to the side with data', () => {
    const selections = defaultFieldSelections(source, target)
    expect(selections.phone).toBe('target')
    expect(selections.status).toBe('target')
    expect(selections.name).toBe('source')
  })

  it('builds preview with selected fields and union tags', () => {
    const selections = defaultFieldSelections(source, target)
    selections.name = 'target'
    const preview = buildMergePreview(source, target, selections)
    expect(preview.name).toBe('Alicia')
    expect(preview.phone).toBe('+971500000000')
    expect(preview.status).toBe('client')
    expect(preview.tags).toEqual(['vip', 'buyer'])
  })
})
