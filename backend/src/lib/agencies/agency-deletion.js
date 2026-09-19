/**
 * AGN-SET-006 / WF-32 — agency deletion scheduling.
 */
import { createHash, randomUUID } from 'node:crypto'
import { findAll, findOne, insert, query, update } from '../../db.js'
import { createCreditService } from '../credits/compat.js'
import { getAgencyMembership } from '../../tenant-authorization.js'
import { normalizeAgencyName } from './ownership-transfer.js'

export const COOLDOWN_DAYS = 30
export const DRAFT_TTL_MINUTES = 15

const WORD_PARTS = [
  'orange', 'piano', 'frost', 'cedar', 'olive', 'nimbus', 'harbor', 'quartz', 'ember', 'saffron',
  'dune', 'atlas', 'pearl', 'cinder', 'lotus',
]

const credits = createCreditService()

export class AgencyDeletionError extends Error {
  constructor(status, code, message, extra = {}) {
    super(message)
    this.name = 'AgencyDeletionError'
    this.status = status
    this.code = code
    Object.assign(this, extra)
  }
}

function hashWord(word) {
  return createHash('sha256').update(String(word).trim().toLowerCase()).digest('hex')
}

function wordMatches(word, hash) {
  if (!hash) return false
  return hashWord(word) === hash
}

function generateLivenessWord() {
  const pick = () => WORD_PARTS[Math.floor(Math.random() * WORD_PARTS.length)]
  return `${pick()}-${pick()}-${pick()}`
}

function scheduledFor(from = new Date()) {
  const d = new Date(from)
  d.setUTCDate(d.getUTCDate() + COOLDOWN_DAYS)
  return d.toISOString()
}

async function loadAgency(agencyId) {
  const agency = await findOne('agencies', (row) => row.id === agencyId)
  if (!agency) throw new AgencyDeletionError(404, 'NOT_FOUND', 'Agency not found')
  return agency
}

async function assertOwner(agencyId, callerUserId) {
  const membership = await getAgencyMembership(agencyId, callerUserId)
  if (!membership || membership.role !== 'owner') {
    throw new AgencyDeletionError(403, 'FORBIDDEN', 'Only the agency owner can delete the agency')
  }
  return membership
}

async function latestRequest(agencyId) {
  const rows = await findAll(
    'agency_deletion_requests',
    (row) => row.agency_id === agencyId && ['draft', 'scheduled'].includes(row.status),
  )
  return rows.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))[0] || null
}

async function countImpact(agencyId) {
  const members = await findAll(
    'agency_members',
    (row) => row.agency_id === agencyId && ['active', 'paused'].includes(String(row.status || 'active')),
  )
  const activeMembers = members.filter((row) => row.role !== 'owner').length
  const listings = await findAll(
    'properties',
    (row) => row.agency_id === agencyId && row.status !== 'deleted',
  )
  let creditsBalanceUsd = 0
  try {
    const balance = await credits.balance('agency', agencyId)
    creditsBalanceUsd = Number(balance?.balance_usd ?? balance?.available_usd ?? 0)
  } catch {
    creditsBalanceUsd = 0
  }

  const pastDueRows = await query(
    `SELECT COUNT(*)::int AS count
       FROM fin.dunning_cases dc
       JOIN public.tenants t ON t.id = dc.billing_account_id
      WHERE t.agency_id = $1
        AND dc.status IN ('OPEN', 'REMINDING', 'REMIND_ESCALATED', 'CREDIT_PAUSED', 'USAGE_SUSPENDED', 'LEGAL')`,
    [agencyId],
  ).catch(() => ({ rows: [{ count: 0 }] }))

  const pastDueInvoices = Number(pastDueRows.rows?.[0]?.count || 0) > 0

  return {
    active_members: activeMembers,
    listings_count: listings.length,
    credits_balance_usd: creditsBalanceUsd,
    past_due_invoices: pastDueInvoices,
  }
}

function buildBlocks(impact) {
  return {
    active_members: impact.active_members > 0,
    past_due: impact.past_due_invoices,
  }
}

export async function getAgencyDeletionState({ agencyId, callerUserId }) {
  await assertOwner(agencyId, callerUserId)
  const agency = await loadAgency(agencyId)
  const impact = await countImpact(agencyId)
  const blocks = buildBlocks(impact)
  const request = await latestRequest(agencyId)
  const deletion = request?.status === 'scheduled'
    ? {
        id: request.id,
        status: request.status,
        scheduled_for: request.scheduled_for,
        reason: request.reason,
      }
    : null

  return {
    agency: { id: agency.id, name: agency.name },
    impact,
    blocks,
    deletion,
    can_schedule: !blocks.active_members && !blocks.past_due && !deletion,
  }
}

export async function regenerateAgencyDeletionWord({ agencyId, callerUserId }) {
  await assertOwner(agencyId, callerUserId)
  const impact = await countImpact(agencyId)
  const blocks = buildBlocks(impact)
  if (blocks.active_members) {
    throw new AgencyDeletionError(
      409,
      'ACTIVE_MEMBERS',
      'End or remove all members before scheduling agency deletion',
    )
  }
  if (blocks.past_due) {
    throw new AgencyDeletionError(
      409,
      'PAST_DUE',
      'Settle outstanding invoices before deleting the agency',
    )
  }

  const word = generateLivenessWord()
  const now = new Date()
  const draftExpires = new Date(now.getTime() + DRAFT_TTL_MINUTES * 60 * 1000).toISOString()
  const existing = await latestRequest(agencyId)

  if (existing?.status === 'draft') {
    await update('agency_deletion_requests', (row) => row.id === existing.id, (row) => ({
      ...row,
      liveness_word_hash: hashWord(word),
      draft_expires_at: draftExpires,
      updated_at: now.toISOString(),
    }))
    return { word, expires_at: draftExpires }
  }

  await insert('agency_deletion_requests', {
    id: randomUUID(),
    agency_id: agencyId,
    requested_by: callerUserId,
    status: 'draft',
    liveness_word_hash: hashWord(word),
    draft_expires_at: draftExpires,
    created_at: now.toISOString(),
    updated_at: now.toISOString(),
  })

  return { word, expires_at: draftExpires }
}

export async function initiateAgencyDeletion({
  agencyId,
  callerUserId,
  word,
  typedAgencyName,
  reason,
  notes,
}) {
  await assertOwner(agencyId, callerUserId)
  const agency = await loadAgency(agencyId)
  const impact = await countImpact(agencyId)
  const blocks = buildBlocks(impact)
  if (blocks.active_members) {
    throw new AgencyDeletionError(409, 'ACTIVE_MEMBERS', 'Active members must be offboarded first')
  }
  if (blocks.past_due) {
    throw new AgencyDeletionError(409, 'PAST_DUE', 'Outstanding invoices must be settled first')
  }

  const trimmedReason = String(reason || '').trim()
  if (trimmedReason.length < 3) {
    throw new AgencyDeletionError(400, 'VALIDATION', 'A deletion reason is required')
  }
  if (normalizeAgencyName(typedAgencyName) !== normalizeAgencyName(agency.name)) {
    throw new AgencyDeletionError(400, 'VALIDATION', 'Typed agency name does not match')
  }

  const draft = await latestRequest(agencyId)
  if (!draft || draft.status !== 'draft') {
    throw new AgencyDeletionError(409, 'NO_DRAFT', 'Generate a confirmation word before scheduling deletion')
  }
  if (draft.draft_expires_at && new Date(draft.draft_expires_at).getTime() < Date.now()) {
    throw new AgencyDeletionError(409, 'WORD_EXPIRED', 'Confirmation word expired — generate a new one')
  }
  if (!wordMatches(word, draft.liveness_word_hash)) {
    throw new AgencyDeletionError(400, 'VALIDATION', 'Confirmation word does not match')
  }

  const now = new Date().toISOString()
  const scheduled = scheduledFor()
  await update('agency_deletion_requests', (row) => row.id === draft.id, (row) => ({
    ...row,
    status: 'scheduled',
    reason: trimmedReason,
    notes: String(notes || '').trim() || null,
    typed_agency_name: String(typedAgencyName || '').trim(),
    scheduled_for: scheduled,
    draft_expires_at: null,
    updated_at: now,
  }))
  await update('agencies', (row) => row.id === agencyId, (row) => ({
    ...row,
    deletion_scheduled_for: scheduled,
    updated_at: now,
  }))

  return {
    id: draft.id,
    status: 'scheduled',
    scheduled_for: scheduled,
    impact,
  }
}

export async function cancelAgencyDeletion({ agencyId, callerUserId }) {
  await assertOwner(agencyId, callerUserId)
  const request = await latestRequest(agencyId)
  if (!request || request.status !== 'scheduled') {
    throw new AgencyDeletionError(404, 'NOT_FOUND', 'No scheduled agency deletion to cancel')
  }
  const now = new Date().toISOString()
  await update('agency_deletion_requests', (row) => row.id === request.id, (row) => ({
    ...row,
    status: 'cancelled',
    cancelled_at: now,
    updated_at: now,
  }))
  await update('agencies', (row) => row.id === agencyId, (row) => ({
    ...row,
    deletion_scheduled_for: null,
    updated_at: now,
  }))
  return { ok: true, cancelled_at: now }
}
