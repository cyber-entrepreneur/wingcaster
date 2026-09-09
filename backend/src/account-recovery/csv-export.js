/**
 * Account-recovery CSV export — BE-BLOCKER-21 / [BE-ACR-08].
 *
 * Masked (mask=true, default): PA auth only.
 * Unmasked (mask=false): requires X-Elevated-Token step-up + bulk-reveal audit.
 */

import { randomUUID } from 'node:crypto'
import { insert, findAll, findOne } from '../db.js'
import { getPool } from '../persistence/postgres-adapter.js'
import {
  parseAccountRecoveryListQuery,
  filterAccountRecoveryCases,
} from './list-query.js'

/** Columns always present in the CSV (order is stable for clients). */
export const ACR_CSV_COLUMNS = Object.freeze([
  'case_id',
  'created_at',
  'status',
  'account_value_tier',
  'requires_two_person',
  'preferred_channel',
  'reason',
  'applicant_name',
  'email',
  'contact',
  'user_id',
  'requested_ip',
  'first_vote',
  'second_vote',
  'escalation_case_id',
  'reviewed_at',
  'reviewed_by',
])

/** Fields that contain PII and are masked / audited on unmasked export. */
export const ACR_CSV_PII_FIELDS = Object.freeze([
  'applicant_name',
  'email',
  'contact',
  'requested_ip',
])

export function maskEmail(email) {
  const raw = String(email || '')
  const at = raw.indexOf('@')
  if (at <= 0) return '•••'
  const local = raw.slice(0, at)
  const domain = raw.slice(at + 1)
  const domainParts = domain.split('.')
  const tld = domainParts.length > 1 ? domainParts[domainParts.length - 1] : ''
  const domainHead = domainParts[0] || ''
  return `${local.slice(0, 1)}***@${'*'.repeat(Math.min(8, Math.max(1, domainHead.length)))}${tld ? `.${tld}` : ''}`
}

export function maskPhoneOrContact(value) {
  const raw = String(value || '').trim()
  if (!raw) return ''
  if (raw.includes('@')) return maskEmail(raw)
  const digits = raw.replace(/\D/g, '')
  if (digits.length < 4) return '***'
  const last2 = digits.slice(-2)
  const prefix = raw.startsWith('+') ? raw.slice(0, Math.min(4, raw.length)) : raw.slice(0, 2)
  return `${prefix} * *** **${last2}`
}

export function maskName(name) {
  const raw = String(name || '').trim()
  if (!raw) return ''
  const parts = raw.split(/\s+/)
  return parts
    .map((part, idx) => {
      if (!part) return ''
      if (idx === 0) return `${part.slice(0, Math.min(4, part.length))}${'*'.repeat(Math.max(3, part.length - 4))}`
      return '*'.repeat(Math.max(4, part.length))
    })
    .join(' ')
}

export function maskIp(ip) {
  const raw = String(ip || '').trim()
  if (!raw) return ''
  if (raw.includes(':')) {
    const parts = raw.split(':')
    return `${parts.slice(0, 2).join(':')}:****`
  }
  const parts = raw.split('.')
  if (parts.length !== 4) return '***.***.***.***'
  return `${parts[0]}.${parts[1]}.XXX.XXX`
}

function csvEscape(value) {
  if (value == null) return ''
  const str = String(value)
  if (/[",\n\r]/.test(str)) return `"${str.replace(/"/g, '""')}"`
  return str
}

export function rowsToCsv(columns, rows) {
  const header = columns.join(',')
  const lines = rows.map((row) => columns.map((col) => csvEscape(row[col])).join(','))
  return `${[header, ...lines].join('\n')}\n`
}

export function caseToCsvRow(recoveryCase, agent, { mask = true } = {}) {
  const name = agent?.name || agent?.display_name || ''
  const email = recoveryCase.email || agent?.email || ''
  const contact = recoveryCase.contact || ''
  const ip = recoveryCase.requested_ip || recoveryCase.ip || ''

  return {
    case_id: recoveryCase.id,
    created_at: recoveryCase.created_at || recoveryCase.requested_at || '',
    status: recoveryCase.status || '',
    account_value_tier: recoveryCase.account_value_tier || '',
    requires_two_person: recoveryCase.requires_two_person == null
      ? ''
      : String(Boolean(recoveryCase.requires_two_person)),
    preferred_channel: recoveryCase.preferred_channel || '',
    reason: recoveryCase.reason || '',
    applicant_name: mask ? maskName(name) : name,
    email: mask ? maskEmail(email) : email,
    contact: mask ? maskPhoneOrContact(contact) : contact,
    user_id: recoveryCase.user_id || '',
    requested_ip: mask ? maskIp(ip) : ip,
    first_vote: recoveryCase.first_vote || '',
    second_vote: recoveryCase.second_vote || '',
    escalation_case_id: recoveryCase.escalation_approval_request_id || '',
    reviewed_at: recoveryCase.reviewed_at || '',
    reviewed_by: recoveryCase.reviewed_by || '',
  }
}

/**
 * Write bulk-reveal audit for an unmasked export (every case_id + fields).
 * Also mirrors into public.audit_log for PA-AUD surfaces.
 */
export async function writeBulkRevealAudit({
  exportedBy,
  caseIds,
  fieldsExported = [...ACR_CSV_PII_FIELDS],
  queryParams = {},
  ip = null,
  userAgent = null,
}) {
  const id = randomUUID()
  const createdAt = new Date().toISOString()
  const pool = getPool()
  await pool.query(
    `INSERT INTO public.account_recovery_export_audits (
       id, exported_by, masked, query_params, case_ids, fields_exported,
       row_count, ip, user_agent, created_at
     ) VALUES (
       $1, $2, false, $3::jsonb, $4::text[], $5::text[],
       $6, $7, $8, $9::timestamptz
     )`,
    [
      id,
      exportedBy,
      JSON.stringify(queryParams || {}),
      caseIds,
      fieldsExported,
      caseIds.length,
      ip,
      userAgent,
      createdAt,
    ],
  )

  await insert('audit_log', {
    id: randomUUID(),
    agent_id: exportedBy,
    type: 'account_recovery',
    action: 'pa_pii_bulk_revealed',
    entity_type: 'account_recovery_export',
    entity_id: id,
    ip,
    user_agent: userAgent,
    metadata: {
      case_ids: caseIds,
      fields_exported: fieldsExported,
      row_count: caseIds.length,
      query_params: queryParams,
      export_audit_id: id,
    },
    created_at: createdAt,
  })

  return { id, row_count: caseIds.length }
}

/**
 * Build CSV body for the current query. Does not enforce auth/elevation.
 *
 * @returns {Promise<{ csv: string, mask: boolean, caseIds: string[], filters: object, filename: string }>}
 */
export async function buildAccountRecoveryCsv({
  query = {},
  findAllFn = findAll,
  findOneFn = findOne,
} = {}) {
  const parsed = parseAccountRecoveryListQuery(query)
  if (!parsed.ok) {
    const err = new Error('Invalid query parameters')
    err.code = 'INVALID_QUERY'
    err.httpStatus = 400
    err.issues = parsed.errors
    throw err
  }

  const { filters } = parsed
  const cases = await findAllFn('account_recovery_cases')
  const agentByUserId = new Map()
  for (const row of cases) {
    const uid = String(row.user_id || '')
    if (!uid || agentByUserId.has(uid)) continue
    const agent = await findOneFn('agents', (a) => a.id === uid || a.user_id === uid)
    if (agent) agentByUserId.set(uid, agent)
  }

  const filtered = filterAccountRecoveryCases(cases, filters, {
    agentByUserId,
    paginate: false,
  })

  const csvRows = filtered.rows.map((row) => {
    const agent = agentByUserId.get(String(row.user_id)) || null
    return caseToCsvRow(row, agent, { mask: filters.mask })
  })

  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  const filename = filters.mask
    ? `account-recovery-masked-${stamp}.csv`
    : `account-recovery-pii-${stamp}.csv`

  return {
    csv: rowsToCsv(ACR_CSV_COLUMNS, csvRows),
    mask: filters.mask,
    caseIds: filtered.rows.map((r) => r.id),
    filters,
    filename,
    truncated: filtered.truncated,
    total: filtered.total,
  }
}
