/**
 * WF-31 / BE-BLOCKER-31 — ownership transfer core logic.
 *
 * Ownership flips happen ONLY here (never via members role PATCH).
 * Accept and reverse run role + packs + audit markers in one DB transaction;
 * notifications are best-effort after commit.
 */

import { createHash, randomInt, randomUUID } from 'node:crypto'
import { findOne, query, transaction } from '../../db.js'
import { bumpTokenVersion } from '../../identity.js'
import { sendOtp } from '../otp.js'
import logger from '../logger.js'
import { agencyTenantId, getAgencyMembership } from '../../tenant-authorization.js'
import { safeEmitOwnershipTransferNotification } from './notify-ownership-transfer.js'

export const OWNERSHIP_TRANSFER_OTP_PURPOSE = 'ownership_transfer_initiate'
export const PENDING_TTL_DAYS = 14
export const REVERSAL_WINDOW_DAYS = 30
export const OTP_TTL_SECONDS = 600
export const OTP_RESEND_COOLDOWN_SECONDS = 60
export const OTP_MAX_PER_HOUR = 5
export const RATIONALE_MIN = 20
export const RATIONALE_MAX = 500
export const DECLINE_REASON_MIN = 20
export const DECLINE_REASON_MAX = 500

const ELIGIBLE_TARGET_ROLES = new Set(['admin', 'senior_admin'])

export const STATUS_DISPLAY = Object.freeze({
  pending: 'pending_recipient_accept',
  accepted: 'recipient_accepted',
  declined: 'target_declined',
  cancelled: 'cancelled_by_initiator',
  expired: 'expired',
  executed: 'executed',
  reversed: 'reversed',
})

function hashCode(code) {
  return createHash('sha256').update(String(code)).digest('hex')
}

function codeMatches(code, expectedHash) {
  if (!expectedHash) return false
  const actual = Buffer.from(hashCode(String(code).trim()), 'hex')
  const expected = Buffer.from(String(expectedHash), 'hex')
  if (actual.length !== expected.length) return false
  return timingSafeEqual(actual, expected)
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false
  let out = 0
  for (let i = 0; i < a.length; i += 1) out |= a[i] ^ b[i]
  return out === 0
}

function generateOtpCode() {
  return String(randomInt(0, 1_000_000)).padStart(6, '0')
}

export function maskEmail(email) {
  const raw = String(email || '').trim()
  const at = raw.indexOf('@')
  if (at <= 0) return '•••'
  const local = raw.slice(0, at)
  const domain = raw.slice(at + 1)
  const keep = local.slice(0, 1)
  return `${keep}•••@${domain}`
}

export function normalizeAgencyName(value) {
  return String(value || '').trim().replace(/\s+/g, ' ').toLowerCase()
}

export function pendingExpiresAt(from = new Date()) {
  const d = new Date(from)
  d.setUTCDate(d.getUTCDate() + PENDING_TTL_DAYS)
  return d.toISOString()
}

export function reversalDeadlineAt(from = new Date()) {
  const d = new Date(from)
  d.setUTCDate(d.getUTCDate() + REVERSAL_WINDOW_DAYS)
  return d.toISOString()
}

export class OwnershipTransferError extends Error {
  constructor(status, code, message, extra = {}) {
    super(message)
    this.name = 'OwnershipTransferError'
    this.status = status
    this.code = code
    Object.assign(this, extra)
  }
}

async function userDisplay(userId) {
  const user = await findOne('users', (u) => u.id === userId)
  if (!user) return { user_id: userId, display_name: null, email: null, avatar_url: null }
  return {
    user_id: userId,
    display_name: user.name || user.email || userId,
    email: user.email || null,
    avatar_url: user.avatar_url || user.data?.avatar_url || null,
  }
}

export function serializeTransfer(row, { includeDisplay = true } = {}) {
  if (!row) return null
  const status = row.status
  return {
    id: row.id,
    agency_id: row.agency_id,
    status,
    status_display: includeDisplay ? (STATUS_DISPLAY[status] || status) : undefined,
    initiator_user_id: row.initiator_user_id,
    target_user_id: row.target_user_id,
    rationale: row.rationale,
    decline_reason: row.decline_reason || null,
    initiated_at: row.initiated_at,
    expires_at: row.expires_at,
    decided_at: row.decided_at || null,
    executed_at: row.executed_at || null,
    reversed_at: row.reversed_at || null,
    reversal_deadline_at: row.reversal_deadline_at || null,
    acknowledged_by_initiator: Boolean(row.acknowledged_by_initiator),
    acknowledged_by_target: Boolean(row.acknowledged_by_target),
    resolved_at: row.decided_at || row.executed_at || row.reversed_at || null,
  }
}

async function enrichTransfer(row) {
  if (!row) return null
  const base = serializeTransfer(row)
  const [target, initiator] = await Promise.all([
    userDisplay(row.target_user_id),
    userDisplay(row.initiator_user_id),
  ])
  const targetMembership = await getAgencyMembership(row.agency_id, row.target_user_id, {
    statuses: ['active', 'suspended', 'ended'],
  })
  return {
    ...base,
    target: {
      ...target,
      role: targetMembership?.role || null,
    },
    initiator,
  }
}

export async function loadTransfer(agencyId, transferId) {
  const rows = await query(
    `SELECT * FROM public.ownership_transfer_requests
      WHERE id = $1 AND agency_id = $2
      LIMIT 1`,
    [transferId, agencyId],
  )
  return rows[0] || null
}

export async function loadCurrentTransfer(agencyId) {
  const rows = await query(
    `SELECT * FROM public.ownership_transfer_requests
      WHERE agency_id = $1
        AND status IN ('pending', 'executed')
      ORDER BY
        CASE status WHEN 'pending' THEN 0 WHEN 'executed' THEN 1 ELSE 2 END,
        initiated_at DESC
      LIMIT 1`,
    [agencyId],
  )
  return rows[0] || null
}

async function countEligibleAdmins(agencyId, ownerUserId) {
  const tenantId = agencyTenantId(agencyId)
  const rows = await query(
    `SELECT COUNT(*)::int AS n
       FROM public.tenant_memberships
      WHERE tenant_id = $1
        AND status = 'active'
        AND role IN ('admin', 'senior_admin')
        AND user_id <> $2`,
    [tenantId, ownerUserId],
  )
  return rows[0]?.n || 0
}

async function agencyTransferable(agency) {
  if (!agency) return { transferable: false, block_reason: 'agency_not_found' }
  const status = String(agency.status || agency.data?.status || 'active').toLowerCase()
  if (status === 'suspended' || status === 'closed') {
    return { transferable: false, block_reason: 'agency_suspended' }
  }
  return { transferable: true, block_reason: null }
}

export async function getOwnershipTransferState({ agencyId, callerUserId }) {
  const membership = await getAgencyMembership(agencyId, callerUserId)
  if (!membership) {
    throw new OwnershipTransferError(403, 'FORBIDDEN', 'Forbidden')
  }

  const agency = await findOne('agencies', (a) => a.id === agencyId)
  if (!agency) throw new OwnershipTransferError(404, 'NOT_FOUND', 'Agency not found')

  const ownerMembership = membership.role === 'owner'
    ? membership
    : (await query(
      `SELECT * FROM public.tenant_memberships
        WHERE tenant_id = $1 AND role = 'owner' AND status = 'active'
        LIMIT 1`,
      [agencyTenantId(agencyId)],
    ))[0]

  const ownerUserId = ownerMembership?.user_id || agency.owner_id
  const isOwner = membership.role === 'owner'
  const transfer = await loadCurrentTransfer(agencyId)

  // Non-owners may only see state when they are the target of the current transfer
  // or the initiator of an executed/reversed window they care about.
  if (!isOwner) {
    const involved = transfer
      && (transfer.target_user_id === callerUserId || transfer.initiator_user_id === callerUserId)
    if (!involved) {
      throw new OwnershipTransferError(403, 'FORBIDDEN', 'Only the owner can view transfer state')
    }
  }

  const { transferable, block_reason: suspendReason } = await agencyTransferable(agency)
  let blockReason = suspendReason
  const eligibleCount = ownerUserId
    ? await countEligibleAdmins(agencyId, ownerUserId)
    : 0
  if (transferable && eligibleCount === 0) blockReason = 'no_eligible_admins'

  return {
    transfer: await enrichTransfer(transfer),
    eligibility: {
      caller_is_owner: isOwner,
      agency_transferable: transferable && !blockReason,
      block_reason: blockReason,
      eligible_admin_count: eligibleCount,
    },
  }
}

async function createOtpChallenge({ userId, ip = null }) {
  const code = generateOtpCode()
  const id = randomUUID()
  const expiresAt = new Date(Date.now() + OTP_TTL_SECONDS * 1000).toISOString()
  await query(
    `DELETE FROM public.auth_challenges
      WHERE user_id = $1 AND purpose = $2 AND consumed_at IS NULL`,
    [userId, OWNERSHIP_TRANSFER_OTP_PURPOSE],
  )
  await query(
    `INSERT INTO public.auth_challenges (
       id, user_id, purpose, method, code_hash, expires_at,
       consumed_at, attempts, last_attempt_at, locked_at, created_ip,
       created_at, updated_at, data
     ) VALUES (
       $1, $2, $3, 'email', $4, $5::timestamptz,
       NULL, 0, NULL, NULL, $6,
       CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, '{}'::jsonb
     )`,
    [id, userId, OWNERSHIP_TRANSFER_OTP_PURPOSE, hashCode(code), expiresAt, ip],
  )
  return { id, code, expiresAt }
}

function otpResendCooldownSeconds() {
  const raw = process.env.OWNERSHIP_TRANSFER_OTP_COOLDOWN_SECONDS
  if (raw != null && String(raw).trim() !== '') {
    const n = Number(raw)
    return Number.isFinite(n) && n >= 0 ? n : OTP_RESEND_COOLDOWN_SECONDS
  }
  // Vitest runs many OTP sends for the same user within one case; skip the
  // production resend cooldown so suites exercise business rules, not waits.
  if (process.env.NODE_ENV === 'test') return 0
  return OTP_RESEND_COOLDOWN_SECONDS
}

async function assertOtpRateLimit(userId) {
  const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
  const recent = await query(
    `SELECT created_at
       FROM public.auth_challenges
      WHERE user_id = $1
        AND purpose = $2
        AND created_at >= $3::timestamptz
      ORDER BY created_at DESC`,
    [userId, OWNERSHIP_TRANSFER_OTP_PURPOSE, hourAgo],
  )
  if (recent.length >= OTP_MAX_PER_HOUR) {
    throw new OwnershipTransferError(429, 'RATE_LIMITED', 'Too many OTP sends this hour')
  }
  const cooldownSeconds = otpResendCooldownSeconds()
  if (cooldownSeconds > 0 && recent[0]) {
    const last = new Date(recent[0].created_at).getTime()
    const waitMs = cooldownSeconds * 1000 - (Date.now() - last)
    if (waitMs > 0) {
      throw new OwnershipTransferError(429, 'RATE_LIMITED', 'Please wait before requesting another code', {
        retry_after_seconds: Math.ceil(waitMs / 1000),
      })
    }
  }
}

export async function sendOwnershipTransferOtp({ agencyId, callerUserId, ip = null }) {
  const membership = await getAgencyMembership(agencyId, callerUserId)
  if (!membership) {
    throw new OwnershipTransferError(403, 'FORBIDDEN', 'Forbidden')
  }

  const agency = await findOne('agencies', (a) => a.id === agencyId)
  if (!agency) throw new OwnershipTransferError(404, 'NOT_FOUND', 'Agency not found')

  const transfer = await loadCurrentTransfer(agencyId)
  const isOwner = membership.role === 'owner'
  const isTarget = transfer?.status === 'pending' && transfer.target_user_id === callerUserId
  // Former initiator of an executed transfer may always request OTP (even after
  // the 30-day window). Reverse itself returns 410 when the deadline has passed.
  const isFormerOwnerOnExecuted = transfer?.status === 'executed'
    && transfer.initiator_user_id === callerUserId

  if (!isOwner && !isTarget && !isFormerOwnerOnExecuted) {
    throw new OwnershipTransferError(403, 'FORBIDDEN', 'Not eligible to request ownership-transfer OTP')
  }

  const user = await findOne('users', (u) => u.id === callerUserId)
  if (!user?.email) {
    throw new OwnershipTransferError(400, 'EMAIL_REQUIRED', 'Account email is required for OTP')
  }

  await assertOtpRateLimit(callerUserId)
  const challenge = await createOtpChallenge({ userId: callerUserId, ip })
  try {
    await sendOtp({
      channel: 'email',
      contact: user.email,
      code: challenge.code,
      purpose: OWNERSHIP_TRANSFER_OTP_PURPOSE,
    })
  } catch (err) {
    // Keep the challenge so verification still works; surface transport failure
    // except in test / soft-fail mode (no Graph/SMTP in CI).
    logger.warn({ err: err.message }, 'ownership transfer OTP email delivery failed; challenge kept')
    if (process.env.NODE_ENV !== 'test' && process.env.OWNERSHIP_TRANSFER_OTP_SOFT_FAIL !== '1') {
      throw new OwnershipTransferError(503, err.code || 'OTP_TRANSPORT_FAILED', err.message)
    }
  }

  return {
    sent_to: maskEmail(user.email),
    expires_in_seconds: OTP_TTL_SECONDS,
    challenge_id: challenge.id,
    ...(process.env.NODE_ENV === 'test' || process.env.OWNERSHIP_TRANSFER_OTP_SOFT_FAIL === '1'
      ? { __test_code: challenge.code }
      : {}),
  }
}

/**
 * Verify + consume the latest unconsumed ownership-transfer OTP for the user.
 */
export async function consumeOwnershipTransferOtp(userId, otpCode) {
  if (!otpCode || String(otpCode).trim().length < 4) {
    throw new OwnershipTransferError(401, 'INVALID_OTP', 'Invalid OTP')
  }
  return transaction(async (client) => {
    const { rows } = await client.query(
      `SELECT * FROM public.auth_challenges
        WHERE user_id = $1
          AND purpose = $2
          AND consumed_at IS NULL
        ORDER BY created_at DESC
        LIMIT 1
        FOR UPDATE`,
      [userId, OWNERSHIP_TRANSFER_OTP_PURPOSE],
    )
    const challenge = rows[0]
    if (!challenge) {
      throw new OwnershipTransferError(401, 'INVALID_OTP', 'Invalid or expired OTP')
    }
    if (new Date(challenge.expires_at).getTime() <= Date.now()) {
      throw new OwnershipTransferError(401, 'EXPIRED_OTP', 'OTP has expired')
    }
    if (challenge.locked_at || challenge.attempts >= 5) {
      throw new OwnershipTransferError(429, 'OTP_LOCKED', 'Too many failed OTP attempts')
    }
    if (!codeMatches(otpCode, challenge.code_hash)) {
      const attempts = challenge.attempts + 1
      const lockedAt = attempts >= 5 ? new Date().toISOString() : null
      await client.query(
        `UPDATE public.auth_challenges
            SET attempts = $2,
                last_attempt_at = CURRENT_TIMESTAMP,
                locked_at = $3::timestamptz,
                updated_at = CURRENT_TIMESTAMP
          WHERE id = $1`,
        [challenge.id, attempts, lockedAt],
      )
      throw new OwnershipTransferError(401, 'INVALID_OTP', 'Invalid OTP')
    }
    await client.query(
      `UPDATE public.auth_challenges
          SET consumed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
        WHERE id = $1`,
      [challenge.id],
    )
    return { challengeId: challenge.id }
  })
}

async function assertTypedAgencyName(agency, typed) {
  if (normalizeAgencyName(agency.name) !== normalizeAgencyName(typed)) {
    throw new OwnershipTransferError(401, 'INVALID_TYPED_NAME', 'Agency name confirmation does not match')
  }
}

async function capabilityPacksColumnExists(client) {
  const { rows } = await client.query(
    `SELECT 1
       FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'tenant_memberships'
        AND column_name = 'capability_packs'
      LIMIT 1`,
  )
  return rows.length > 0
}

/**
 * Atomic ownership flip inside an open transaction client.
 * Demotes current owner to admin; promotes target to owner.
 * Updates agencies.owner_id + legacy agency_members. Tolerates missing
 * capability_packs (Agent 1 lands packs in parallel).
 */
export async function flipOwnershipRoles(client, {
  agencyId,
  fromUserId,
  toUserId,
  nowIso,
  requireTargetAdmin = true,
}) {
  const tenantId = agencyTenantId(agencyId)
  const hasPacks = await capabilityPacksColumnExists(client)
  const packsFragment = hasPacks
    ? `, capability_packs = COALESCE(capability_packs, '[]'::jsonb)`
    : ''

  const { rows: fromRows } = await client.query(
    `SELECT * FROM public.tenant_memberships
      WHERE tenant_id = $1 AND user_id = $2 AND status = 'active'
      FOR UPDATE`,
    [tenantId, fromUserId],
  )
  const { rows: toRows } = await client.query(
    `SELECT * FROM public.tenant_memberships
      WHERE tenant_id = $1 AND user_id = $2 AND status = 'active'
      FOR UPDATE`,
    [tenantId, toUserId],
  )
  const fromMem = fromRows[0]
  const toMem = toRows[0]
  if (!fromMem || fromMem.role !== 'owner') {
    throw new OwnershipTransferError(409, 'OWNER_MISMATCH', 'Current owner membership not found')
  }
  if (!toMem) {
    throw new OwnershipTransferError(409, 'TARGET_NOT_ELIGIBLE', 'Target membership not found')
  }
  if (requireTargetAdmin && !ELIGIBLE_TARGET_ROLES.has(toMem.role) && toMem.role !== 'admin') {
    throw new OwnershipTransferError(409, 'TARGET_NOT_ELIGIBLE', 'Target is not an active admin')
  }

  // Promote target first, then demote former owner (deferred owner-continuity trigger).
  await client.query(
    `UPDATE public.tenant_memberships
        SET role = 'owner',
            affiliation_mode = 'exclusive',
            updated_at = $2::timestamptz,
            data = COALESCE(data, '{}'::jsonb) || jsonb_build_object('role', 'owner')
            ${packsFragment}
      WHERE id = $1`,
    [toMem.id, nowIso],
  )
  await client.query(
    `UPDATE public.tenant_memberships
        SET role = 'admin',
            affiliation_mode = 'exclusive',
            updated_at = $2::timestamptz,
            data = COALESCE(data, '{}'::jsonb) || jsonb_build_object('role', 'admin')
            ${packsFragment}
      WHERE id = $1`,
    [fromMem.id, nowIso],
  )

  if (fromMem.legacy_agency_member_id) {
    await client.query(
      `UPDATE public.agency_members
          SET role = 'admin',
              updated_at = $2::timestamptz,
              data = COALESCE(data, '{}'::jsonb) || jsonb_build_object('role', 'admin')
        WHERE id = $1`,
      [fromMem.legacy_agency_member_id, nowIso],
    )
  }
  if (toMem.legacy_agency_member_id) {
    await client.query(
      `UPDATE public.agency_members
          SET role = 'owner',
              updated_at = $2::timestamptz,
              data = COALESCE(data, '{}'::jsonb) || jsonb_build_object('role', 'owner')
        WHERE id = $1`,
      [toMem.legacy_agency_member_id, nowIso],
    )
  }

  await client.query(
    `UPDATE public.agencies
        SET owner_id = $2,
            updated_at = $3::timestamptz,
            data = COALESCE(data, '{}'::jsonb) || jsonb_build_object('owner_id', $2::text)
      WHERE id = $1`,
    [agencyId, toUserId, nowIso],
  )

  await bumpTokenVersion(client, fromUserId)
  await bumpTokenVersion(client, toUserId)

  return { fromMembershipId: fromMem.id, toMembershipId: toMem.id }
}

async function writeAudit(client, { type, agentId, meta, logActivity }) {
  const entry = {
    id: randomUUID(),
    type,
    agent_id: agentId,
    meta: meta || {},
    created_at: new Date().toISOString(),
  }
  await client.query(
    `INSERT INTO public.activity_log (id, agent_id, type, meta, created_at, updated_at, data)
     VALUES ($1, $2, $3, $4::jsonb, $5::timestamptz, $5::timestamptz, '{}'::jsonb)`,
    [entry.id, agentId, type, JSON.stringify(entry.meta), entry.created_at],
  )
  if (typeof logActivity === 'function') {
    try { await logActivity(entry) } catch { /* best-effort duplicate sink */ }
  }
}

export async function initiateOwnershipTransfer({
  agencyId,
  callerUserId,
  targetUserId,
  rationale,
  otpCode,
  typedAgencyName,
  logActivity,
}) {
  const membership = await getAgencyMembership(agencyId, callerUserId)
  if (!membership || membership.role !== 'owner') {
    throw new OwnershipTransferError(403, 'FORBIDDEN', 'Only the current owner can initiate a transfer')
  }

  const agency = await findOne('agencies', (a) => a.id === agencyId)
  if (!agency) throw new OwnershipTransferError(404, 'NOT_FOUND', 'Agency not found')

  const { transferable, block_reason } = await agencyTransferable(agency)
  if (!transferable) {
    throw new OwnershipTransferError(409, 'AGENCY_NOT_TRANSFERABLE', 'Agency is not transferable', {
      block_reason,
    })
  }

  const rationaleText = String(rationale || '').trim()
  if (rationaleText.length < RATIONALE_MIN) {
    throw new OwnershipTransferError(400, 'RATIONALE_TOO_SHORT', `Rationale must be at least ${RATIONALE_MIN} characters`)
  }
  if (rationaleText.length > RATIONALE_MAX) {
    throw new OwnershipTransferError(400, 'RATIONALE_TOO_LONG', `Rationale must be at most ${RATIONALE_MAX} characters`)
  }
  if (!targetUserId || targetUserId === callerUserId) {
    throw new OwnershipTransferError(400, 'SELF_TRANSFER_FORBIDDEN', 'Cannot transfer ownership to yourself')
  }

  await assertTypedAgencyName(agency, typedAgencyName)
  await consumeOwnershipTransferOtp(callerUserId, otpCode)

  const targetMembership = await getAgencyMembership(agencyId, targetUserId)
  if (!targetMembership || targetMembership.status !== 'active' || !ELIGIBLE_TARGET_ROLES.has(targetMembership.role)) {
    throw new OwnershipTransferError(400, 'TARGET_NOT_ADMIN', 'Target must be an active admin of this agency')
  }

  const pending = await query(
    `SELECT id FROM public.ownership_transfer_requests
      WHERE agency_id = $1 AND status = 'pending'
      LIMIT 1`,
    [agencyId],
  )
  if (pending.length) {
    throw new OwnershipTransferError(409, 'TRANSFER_ALREADY_PENDING', 'A pending transfer already exists')
  }

  const nowIso = new Date().toISOString()
  const id = randomUUID()
  const expiresAt = pendingExpiresAt(nowIso)

  await query(
    `INSERT INTO public.ownership_transfer_requests (
       id, agency_id, initiator_user_id, target_user_id, status, rationale,
       initiated_at, expires_at, created_at, updated_at, data
     ) VALUES (
       $1, $2, $3, $4, 'pending', $5,
       $6::timestamptz, $7::timestamptz, $6::timestamptz, $6::timestamptz, '{}'::jsonb
     )`,
    [id, agencyId, callerUserId, targetUserId, rationaleText, nowIso, expiresAt],
  )

  if (typeof logActivity === 'function') {
    await logActivity({
      type: 'ownership_transfer_initiated',
      agent_id: callerUserId,
      meta: { transfer_id: id, agency_id: agencyId, target_user_id: targetUserId },
    })
  }

  const initiator = await userDisplay(callerUserId)
  await safeEmitOwnershipTransferNotification({
    userId: targetUserId,
    variant: 'target-invited',
    transferId: id,
    variables: {
      agency_name: agency.name,
      initiator_name: initiator.display_name || 'The owner',
      transfer_id: id,
    },
  })

  const row = await loadTransfer(agencyId, id)
  return {
    transfer: await enrichTransfer(row),
    notifications_dispatched: ['push_to_target', 'email_to_target'],
  }
}

export async function acceptOwnershipTransfer({
  agencyId,
  transferId,
  callerUserId,
  otpCode,
  typedAgencyName,
  logActivity,
}) {
  const agency = await findOne('agencies', (a) => a.id === agencyId)
  if (!agency) throw new OwnershipTransferError(404, 'NOT_FOUND', 'Agency not found')

  // Authz / status before OTP: wrong party must get 403 without burning a code.
  const existing = await loadTransfer(agencyId, transferId)
  if (!existing) throw new OwnershipTransferError(404, 'NOT_FOUND', 'Transfer not found')
  if (existing.target_user_id !== callerUserId) {
    throw new OwnershipTransferError(403, 'FORBIDDEN', 'Only the target can accept this transfer')
  }
  if (existing.status !== 'pending') {
    throw new OwnershipTransferError(409, 'INVALID_STATUS', `Transfer is ${existing.status}`)
  }
  if (new Date(existing.expires_at).getTime() <= Date.now()) {
    throw new OwnershipTransferError(410, 'EXPIRED', 'Transfer request has expired')
  }

  await assertTypedAgencyName(agency, typedAgencyName)
  await consumeOwnershipTransferOtp(callerUserId, otpCode)

  const nowIso = new Date().toISOString()
  const deadline = reversalDeadlineAt(nowIso)

  const result = await transaction(async (client) => {
    const { rows } = await client.query(
      `SELECT * FROM public.ownership_transfer_requests
        WHERE id = $1 AND agency_id = $2
        FOR UPDATE`,
      [transferId, agencyId],
    )
    const transfer = rows[0]
    if (!transfer) throw new OwnershipTransferError(404, 'NOT_FOUND', 'Transfer not found')
    if (transfer.target_user_id !== callerUserId) {
      throw new OwnershipTransferError(403, 'FORBIDDEN', 'Only the target can accept this transfer')
    }
    if (transfer.status !== 'pending') {
      throw new OwnershipTransferError(409, 'INVALID_STATUS', `Transfer is ${transfer.status}`)
    }
    if (new Date(transfer.expires_at).getTime() <= Date.now()) {
      throw new OwnershipTransferError(410, 'EXPIRED', 'Transfer request has expired')
    }

    await flipOwnershipRoles(client, {
      agencyId,
      fromUserId: transfer.initiator_user_id,
      toUserId: transfer.target_user_id,
      nowIso,
      requireTargetAdmin: true,
    })

    const { rows: updated } = await client.query(
      `UPDATE public.ownership_transfer_requests
          SET status = 'executed',
              decided_at = $2::timestamptz,
              executed_at = $2::timestamptz,
              reversal_deadline_at = $3::timestamptz,
              updated_at = $2::timestamptz
        WHERE id = $1
        RETURNING *`,
      [transferId, nowIso, deadline],
    )

    await writeAudit(client, {
      type: 'ownership_transfer_executed',
      agentId: callerUserId,
      meta: {
        transfer_id: transferId,
        agency_id: agencyId,
        former_owner_id: transfer.initiator_user_id,
        new_owner_id: transfer.target_user_id,
      },
      logActivity,
    })

    return updated[0]
  })

  const initiator = await userDisplay(result.initiator_user_id)
  const target = await userDisplay(result.target_user_id)
  await safeEmitOwnershipTransferNotification({
    userId: result.initiator_user_id,
    variant: 'initiator-accepted',
    transferId,
    variables: {
      agency_name: agency.name,
      target_name: target.display_name || 'The new owner',
      transfer_id: transferId,
    },
  })
  await safeEmitOwnershipTransferNotification({
    userId: result.target_user_id,
    variant: 'transfer-executed',
    transferId,
    variables: {
      agency_name: agency.name,
      new_owner_name: target.display_name || 'You',
      former_owner_name: initiator.display_name || 'Former owner',
      reversal_deadline: deadline,
      transfer_id: transferId,
    },
  })

  return { transfer: await enrichTransfer(result) }
}

export async function declineOwnershipTransfer({
  agencyId,
  transferId,
  callerUserId,
  declineReason,
  logActivity,
}) {
  const reason = String(declineReason || '').trim()
  if (reason.length < DECLINE_REASON_MIN) {
    throw new OwnershipTransferError(400, 'DECLINE_REASON_TOO_SHORT', `Decline reason must be at least ${DECLINE_REASON_MIN} characters`)
  }
  if (reason.length > DECLINE_REASON_MAX) {
    throw new OwnershipTransferError(400, 'DECLINE_REASON_TOO_LONG', `Decline reason must be at most ${DECLINE_REASON_MAX} characters`)
  }

  const nowIso = new Date().toISOString()
  // `query()` returns the rows array (not pg's `{ rows }`).
  const rows = await query(
    `UPDATE public.ownership_transfer_requests
        SET status = 'declined',
            decline_reason = $3,
            decided_at = $4::timestamptz,
            updated_at = $4::timestamptz
      WHERE id = $1
        AND agency_id = $2
        AND status = 'pending'
        AND target_user_id = $5
      RETURNING *`,
    [transferId, agencyId, reason, nowIso, callerUserId],
  )
  if (!rows.length) {
    const existing = await loadTransfer(agencyId, transferId)
    if (!existing) throw new OwnershipTransferError(404, 'NOT_FOUND', 'Transfer not found')
    if (existing.target_user_id !== callerUserId) {
      throw new OwnershipTransferError(403, 'FORBIDDEN', 'Only the target can decline this transfer')
    }
    throw new OwnershipTransferError(409, 'INVALID_STATUS', `Transfer is ${existing.status}`)
  }

  if (typeof logActivity === 'function') {
    await logActivity({
      type: 'ownership_transfer_declined',
      agent_id: callerUserId,
      meta: { transfer_id: transferId, agency_id: agencyId },
    })
  }

  const agency = await findOne('agencies', (a) => a.id === agencyId)
  const target = await userDisplay(callerUserId)
  await safeEmitOwnershipTransferNotification({
    userId: rows[0].initiator_user_id,
    variant: 'target-declined',
    transferId,
    variables: {
      agency_name: agency?.name || 'the agency',
      target_name: target.display_name || 'The admin',
      decline_reason: reason,
      transfer_id: transferId,
    },
  })

  return { transfer: await enrichTransfer(rows[0]) }
}

export async function cancelOwnershipTransfer({
  agencyId,
  transferId,
  callerUserId,
  logActivity,
}) {
  const nowIso = new Date().toISOString()
  // `query()` returns the rows array (not pg's `{ rows }`).
  const rows = await query(
    `UPDATE public.ownership_transfer_requests
        SET status = 'cancelled',
            decided_at = $3::timestamptz,
            updated_at = $3::timestamptz
      WHERE id = $1
        AND agency_id = $2
        AND status = 'pending'
        AND initiator_user_id = $4
      RETURNING *`,
    [transferId, agencyId, nowIso, callerUserId],
  )
  if (!rows.length) {
    const existing = await loadTransfer(agencyId, transferId)
    if (!existing) throw new OwnershipTransferError(404, 'NOT_FOUND', 'Transfer not found')
    if (existing.initiator_user_id !== callerUserId) {
      throw new OwnershipTransferError(403, 'FORBIDDEN', 'Only the initiator can cancel this transfer')
    }
    throw new OwnershipTransferError(409, 'INVALID_STATUS', `Transfer is ${existing.status}`)
  }

  if (typeof logActivity === 'function') {
    await logActivity({
      type: 'ownership_transfer_cancelled',
      agent_id: callerUserId,
      meta: { transfer_id: transferId, agency_id: agencyId },
    })
  }

  return { transfer: await enrichTransfer(rows[0]) }
}

export async function acknowledgeOwnershipTransfer({
  agencyId,
  transferId,
  callerUserId,
}) {
  const transfer = await loadTransfer(agencyId, transferId)
  if (!transfer) throw new OwnershipTransferError(404, 'NOT_FOUND', 'Transfer not found')

  const isInitiator = transfer.initiator_user_id === callerUserId
  const isTarget = transfer.target_user_id === callerUserId
  if (!isInitiator && !isTarget) {
    throw new OwnershipTransferError(403, 'FORBIDDEN', 'Only transfer parties can acknowledge')
  }

  const ackStatuses = new Set(['executed', 'declined', 'expired', 'cancelled', 'reversed'])
  if (!ackStatuses.has(transfer.status)) {
    throw new OwnershipTransferError(409, 'INVALID_STATUS', 'Transfer cannot be acknowledged in its current status')
  }

  const nowIso = new Date().toISOString()
  // `query()` returns the rows array (not pg's `{ rows }`).
  const rows = await query(
    `UPDATE public.ownership_transfer_requests
        SET acknowledged_by_initiator = CASE WHEN $3 THEN TRUE ELSE acknowledged_by_initiator END,
            acknowledged_by_target = CASE WHEN $4 THEN TRUE ELSE acknowledged_by_target END,
            acknowledged_at = $5::timestamptz,
            updated_at = $5::timestamptz
      WHERE id = $1 AND agency_id = $2
      RETURNING *`,
    [transferId, agencyId, isInitiator, isTarget, nowIso],
  )
  if (!rows.length) {
    throw new OwnershipTransferError(404, 'NOT_FOUND', 'Transfer not found')
  }

  return { transfer: await enrichTransfer(rows[0]) }
}

export async function reverseOwnershipTransfer({
  agencyId,
  transferId,
  callerUserId,
  otpCode,
  typedAgencyName,
  logActivity,
}) {
  const agency = await findOne('agencies', (a) => a.id === agencyId)
  if (!agency) throw new OwnershipTransferError(404, 'NOT_FOUND', 'Agency not found')

  const existing = await loadTransfer(agencyId, transferId)
  if (!existing) throw new OwnershipTransferError(404, 'NOT_FOUND', 'Transfer not found')
  if (existing.status !== 'executed') {
    throw new OwnershipTransferError(409, 'INVALID_STATUS', `Transfer is ${existing.status}`)
  }
  if (!existing.reversal_deadline_at || new Date(existing.reversal_deadline_at).getTime() <= Date.now()) {
    throw new OwnershipTransferError(410, 'REVERSAL_WINDOW_CLOSED', 'The 30-day reversal window has closed. Contact support.')
  }
  if (existing.initiator_user_id !== callerUserId) {
    throw new OwnershipTransferError(403, 'FORBIDDEN', 'Only the former owner can reverse this transfer')
  }

  await assertTypedAgencyName(agency, typedAgencyName)
  await consumeOwnershipTransferOtp(callerUserId, otpCode)

  const nowIso = new Date().toISOString()

  const result = await transaction(async (client) => {
    const { rows } = await client.query(
      `SELECT * FROM public.ownership_transfer_requests
        WHERE id = $1 AND agency_id = $2
        FOR UPDATE`,
      [transferId, agencyId],
    )
    const transfer = rows[0]
    if (!transfer || transfer.status !== 'executed') {
      throw new OwnershipTransferError(409, 'INVALID_STATUS', 'Transfer is no longer reversible')
    }
    if (!transfer.reversal_deadline_at || new Date(transfer.reversal_deadline_at).getTime() <= Date.now()) {
      throw new OwnershipTransferError(410, 'REVERSAL_WINDOW_CLOSED', 'The 30-day reversal window has closed. Contact support.')
    }

    // Current owner is the target; flip back to initiator.
    await flipOwnershipRoles(client, {
      agencyId,
      fromUserId: transfer.target_user_id,
      toUserId: transfer.initiator_user_id,
      nowIso,
      requireTargetAdmin: false,
    })

    const { rows: updated } = await client.query(
      `UPDATE public.ownership_transfer_requests
          SET status = 'reversed',
              reversed_at = $2::timestamptz,
              updated_at = $2::timestamptz
        WHERE id = $1
        RETURNING *`,
      [transferId, nowIso],
    )

    await writeAudit(client, {
      type: 'ownership_transfer_reversed',
      agentId: callerUserId,
      meta: {
        transfer_id: transferId,
        agency_id: agencyId,
        restored_owner_id: transfer.initiator_user_id,
        demoted_owner_id: transfer.target_user_id,
      },
      logActivity,
    })

    return updated[0]
  })

  return { transfer: await enrichTransfer(result) }
}
