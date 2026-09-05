/**
 * One-time free-trial claim per identity (email OR phone OR username).
 *
 * Support waive (no HTTP endpoint — automated waive is the abuse vector
 * this module closes):
 *
 *   UPDATE public.free_trial_claims
 *      SET waived_at = NOW(),
 *          waived_reason = 'Support ticket #12345: user lost access to original email'
 *    WHERE id = '<claim-id>';
 */
import { randomUUID } from 'node:crypto'
import { query as dbQuery } from '../../db.js'
import { logger } from '../logger.js'
import { identityHashes } from './identity-normalize.js'

const CONSTRAINT_DIMENSION = {
  uq_ftc_email_hash: 'email',
  uq_ftc_phone_hash: 'phone',
  uq_ftc_username_hash: 'username',
}

export class FreeTrialAlreadyClaimedError extends Error {
  constructor(blockingDimensions = []) {
    super('This identity has already claimed the free trial')
    this.name = 'FreeTrialAlreadyClaimedError'
    this.code = 'FREE_TRIAL_ALREADY_CLAIMED'
    this.blockingDimensions = blockingDimensions
  }
}

function runner(client) {
  if (client?.query) {
    return async (sql, params) => {
      const result = await client.query(sql, params)
      return result.rows ?? result
    }
  }
  return dbQuery
}

export function hashesForClaim({ email, phone, username, userId }) {
  return identityHashes({
    email,
    phone,
    username,
    absentSeed: userId || randomUUID(),
  })
}

export async function findMatchingClaims({ email, phone, username, client } = {}) {
  const hashes = identityHashes({ email, phone, username, absentSeed: randomUUID() })
  const { normalized } = hashes
  const clauses = []
  const params = []
  if (normalized.email) {
    params.push(hashes.email)
    clauses.push(`email_hash = $${params.length}`)
  }
  if (normalized.phone) {
    params.push(hashes.phone)
    clauses.push(`phone_hash = $${params.length}`)
  }
  if (normalized.username) {
    params.push(hashes.username)
    clauses.push(`username_hash = $${params.length}`)
  }
  if (!clauses.length) return []

  const run = runner(client)
  const rows = await run(
    `SELECT id, email_hash, phone_hash, username_hash, original_user_id, waived_at
       FROM public.free_trial_claims
      WHERE waived_at IS NULL
        AND (${clauses.join(' OR ')})`,
    params,
  )
  return Array.isArray(rows) ? rows : []
}

export function blockingDimensionsFromRow(row, hashes) {
  const dims = []
  if (row.email_hash === hashes.email) dims.push('email')
  if (row.phone_hash === hashes.phone) dims.push('phone')
  if (row.username_hash === hashes.username) dims.push('username')
  return dims
}

export async function assertNoPriorClaim({ email, phone, username, client } = {}) {
  const hashes = identityHashes({ email, phone, username, absentSeed: randomUUID() })
  const matches = await findMatchingClaims({ email, phone, username, client })
  if (!matches.length) return
  const dims = [...new Set(matches.flatMap((row) => blockingDimensionsFromRow(row, hashes)))]
  throw new FreeTrialAlreadyClaimedError(dims)
}

function dimensionFromUniqueViolation(error) {
  const constraint = error?.constraint || ''
  if (CONSTRAINT_DIMENSION[constraint]) return CONSTRAINT_DIMENSION[constraint]
  const message = String(error?.message || '')
  for (const [name, dimension] of Object.entries(CONSTRAINT_DIMENSION)) {
    if (message.includes(name)) return dimension
  }
  return null
}

export async function recordClaim({
  userId,
  email,
  phone,
  username,
  client,
} = {}) {
  if (!userId) throw new Error('recordClaim requires userId')
  const hashes = hashesForClaim({ email, phone, username, userId })
  const run = runner(client)
  try {
    const rows = await run(
      `INSERT INTO public.free_trial_claims (
         id, email_hash, phone_hash, username_hash,
         original_user_id, original_email, original_phone, original_username
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        randomUUID(),
        hashes.email,
        hashes.phone,
        hashes.username,
        userId,
        email ?? null,
        phone ?? null,
        username ?? null,
      ],
    )
    return Array.isArray(rows) ? rows[0] : rows
  } catch (error) {
    if (error?.code === '23505') {
      const matches = await findMatchingClaims({ email, phone, username, client })
      const fromRows = [...new Set(matches.flatMap((row) => blockingDimensionsFromRow(row, hashes)))]
      const fromConstraint = dimensionFromUniqueViolation(error)
      const blockingDimensions = fromRows.length
        ? fromRows
        : (fromConstraint ? [fromConstraint] : [])
      throw new FreeTrialAlreadyClaimedError(blockingDimensions)
    }
    throw error
  }
}

export async function isFreeTierTenant(client, { userId } = {}) {
  const run = runner(client)
  const rows = await run(
    `SELECT p.tier
       FROM public.credit_wallets w
       JOIN public.tenant_subscriptions s ON s.tenant_id = w.tenant_id
       JOIN public.product_package_versions v ON v.id = s.package_version_id
       JOIN public.product_packages p ON p.id = v.package_id
      WHERE w.scope = 'personal'
        AND w.scope_id = $1
        AND s.status IN ('PENDING_START', 'ACTIVE', 'PAUSED', 'CANCELED_AT_PERIOD_END')
      LIMIT 1`,
    [String(userId)],
  )
  const row = Array.isArray(rows) ? rows[0] : null
  return row?.tier === 'free'
}

/**
 * Safety net for free-tier listing create. Own claim is allowed.
 * A match for a different identity, or no claim at all on free tier,
 * means signup enforcement was bypassed — log ERROR and block.
 */
export async function assertFreeTierListingAllowed({
  userId,
  email,
  phone,
  username,
  client,
} = {}) {
  const onFreeTier = await isFreeTierTenant(client, { userId })
  if (!onFreeTier) return

  const hashes = identityHashes({ email, phone, username, absentSeed: userId })
  const matches = await findMatchingClaims({ email, phone, username, client })
  const foreign = matches.filter((row) => row.original_user_id && row.original_user_id !== userId)
  const own = matches.filter((row) => row.original_user_id === userId)

  if (foreign.length) {
    logger.error({
      userId,
      claimIds: foreign.map((row) => row.id),
      blockingDimensions: foreign.flatMap((row) => blockingDimensionsFromRow(row, hashes)),
    }, 'free-trial listing blocked: identity already claimed by another account (signup check bypassed or drifted)')
    throw new FreeTrialAlreadyClaimedError(
      [...new Set(foreign.flatMap((row) => blockingDimensionsFromRow(row, hashes)))],
    )
  }

  if (!own.length) {
    logger.error({
      userId,
    }, 'free-trial listing blocked: no claim row for this identity (signup check bypassed)')
    throw new FreeTrialAlreadyClaimedError([])
  }
}

export function freeTrialClaimedHttpBody(error, { includeBlockingDimensions = true } = {}) {
  return {
    error: 'This identity has already claimed the WingCaster free trial',
    code: 'FREE_TRIAL_ALREADY_CLAIMED',
    blocking_dimensions: includeBlockingDimensions ? (error.blockingDimensions || []) : null,
  }
}
