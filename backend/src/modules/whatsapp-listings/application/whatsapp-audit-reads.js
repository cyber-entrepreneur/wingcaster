import { z } from 'zod'

export const whatsAppAuditLogListQuerySchema = z
  .object({
    agent_id: z.string().trim().min(1).max(128).optional(),
    action: z.string().trim().min(1).max(80).optional(),
    limit: z.coerce.number().int().min(1).max(500).optional(),
    offset: z.coerce.number().int().min(0).max(100_000).optional(),
  })
  .strict()

export function serializeWhatsAppAuditRow(row) {
  const data = row.data && typeof row.data === 'object' ? row.data : {}
  const meta = row.metadata && typeof row.metadata === 'object' ? row.metadata : {}
  const actor = data.actor_id || meta.actor_id || null
  const tenant = row.agent_id
    || row.agency_id
    || (data.target_scope && data.target_id ? `${data.target_scope}:${data.target_id}` : null)
  const reference = row.entity_id || data.draft_id || data.target_id || null

  return {
    id: row.id,
    at: row.created_at,
    agent_id: row.agent_id,
    agency_id: row.agency_id,
    action: row.action,
    entity_type: row.entity_type,
    entity_id: row.entity_id,
    event: row.action || data.type || 'unknown',
    tenant,
    reference,
    actor,
    metadata: { ...meta, ...data },
  }
}

export async function listWhatsAppAuditLogs(poolQuery, query = {}) {
  const parsed = whatsAppAuditLogListQuerySchema.parse(query)
  const limit = parsed.limit ?? 50
  const offset = parsed.offset ?? 0

  const params = [parsed.agent_id || null, parsed.action || null, limit, offset]
  const { rows } = await poolQuery(
    `SELECT id, agent_id, agency_id, action, entity_type, entity_id, metadata, created_at, data
       FROM wa_listings.audit_logs
      WHERE ($1::text IS NULL OR agent_id = $1)
        AND ($2::text IS NULL OR action = $2)
      ORDER BY created_at DESC
      LIMIT $3 OFFSET $4`,
    params,
  )

  const { rows: countRows } = await poolQuery(
    `SELECT COUNT(*)::int AS total
       FROM wa_listings.audit_logs
      WHERE ($1::text IS NULL OR agent_id = $1)
        AND ($2::text IS NULL OR action = $2)`,
    [parsed.agent_id || null, parsed.action || null],
  )

  return {
    items: rows.map(serializeWhatsAppAuditRow),
    total: countRows[0]?.total ?? 0,
    offset,
    limit,
  }
}

export function whatsAppAuditRowsToCsv(items) {
  const header = ['timestamp', 'tenant', 'event', 'reference', 'actor', 'entity_type', 'entity_id']
  const lines = [header.join(',')]
  for (const row of items) {
    lines.push([
      row.at ? new Date(row.at).toISOString() : '',
      csvEscape(row.tenant),
      csvEscape(row.event),
      csvEscape(row.reference),
      csvEscape(row.actor),
      csvEscape(row.entity_type),
      csvEscape(row.entity_id),
    ].join(','))
  }
  return `${lines.join('\n')}\n`
}

function csvEscape(value) {
  const text = value == null ? '' : String(value)
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`
  return text
}
