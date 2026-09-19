import { describe, expect, it } from 'vitest'
import {
  serializeWhatsAppAuditRow,
  whatsAppAuditLogListQuerySchema,
  whatsAppAuditRowsToCsv,
} from './whatsapp-audit-reads.js'

describe('whatsAppAuditLogListQuerySchema', () => {
  it('accepts pagination and filters', () => {
    const parsed = whatsAppAuditLogListQuerySchema.parse({
      agent_id: 'agent-1',
      action: 'draft_created',
      limit: '25',
      offset: '0',
    })
    expect(parsed.limit).toBe(25)
    expect(parsed.action).toBe('draft_created')
  })

  it('rejects unknown query keys', () => {
    expect(() => whatsAppAuditLogListQuerySchema.parse({ q: 'x' })).toThrow()
  })
})

describe('serializeWhatsAppAuditRow', () => {
  it('maps tenant, event, reference, and actor', () => {
    const row = serializeWhatsAppAuditRow({
      id: 'log-1',
      agent_id: 'agent-abc',
      agency_id: null,
      action: 'draft_created',
      entity_type: 'draft',
      entity_id: 'draft-9',
      metadata: {},
      created_at: '2026-09-18T12:00:00.000Z',
      data: { actor_id: 'pa-user-1' },
    })
    expect(row.tenant).toBe('agent-abc')
    expect(row.event).toBe('draft_created')
    expect(row.reference).toBe('draft-9')
    expect(row.actor).toBe('pa-user-1')
  })
})

describe('whatsAppAuditRowsToCsv', () => {
  it('escapes commas in tenant labels', () => {
    const csv = whatsAppAuditRowsToCsv([
      {
        at: '2026-09-18T12:00:00.000Z',
        tenant: 'agent, one',
        event: 'approved',
        reference: 'draft-1',
        actor: 'pa-1',
        entity_type: 'draft',
        entity_id: 'draft-1',
      },
    ])
    expect(csv).toContain('"agent, one"')
  })
})
