/**
 * Platform credit engine — reserve / consume / release / grant.
 *
 * Every mutation locks the wallet row FOR UPDATE. Idempotency is enforced by
 * UNIQUE constraints; replays return the original row.
 */
import { randomUUID } from 'node:crypto'
import { transaction } from '../../db.js'
import { CREDIT_ERROR, CreditEngineError } from './errors.js'
import { FEATURES } from './features.js'
import { approvalThresholdMicroUsd, grantRequiresApproval, perCreditMicroUsd } from './pricing.js'
import { ensureWallet, lockWallet, lookupFinTenantId, syntheticTenantId } from './wallets.js'

export const GRANT_SOURCES = new Set([
  'subscription_cycle', 'topup.stripe', 'topup.paddle',
  'topup.manual_receipt_omt', 'topup.manual_receipt_whish',
  'topup.manual_receipt_monty', 'topup.manual_receipt_bank_transfer',
  'topup.manual_receipt_paypal', 'promo', 'goodwill',
  'migration', 'facility_draw', 'adjustment.correction',
])

export const DEFAULT_RESERVATION_TTL_SECONDS = 15 * 60

function reservationTtlSeconds() {
  const raw = Number(process.env.CREDITS_RESERVATION_TTL_SECONDS)
  return Number.isFinite(raw) && raw > 0 ? Math.trunc(raw) : DEFAULT_RESERVATION_TTL_SECONDS
}

function asPositiveInt(amount, label = 'amount') {
  const n = typeof amount === 'bigint' ? Number(amount) : Number(amount)
  if (!Number.isFinite(n) || n <= 0 || !Number.isInteger(n)) {
    throw new CreditEngineError(CREDIT_ERROR.INVALID_AMOUNT, `${label} must be a positive integer`)
  }
  return n
}

function windowStartSql(kind) {
  switch (kind) {
    case 'MINUTE': return `NOW() - interval '1 minute'`
    case 'HOUR': return `NOW() - interval '1 hour'`
    case 'DAY': return `NOW() - interval '1 day'`
    case 'WEEK': return `NOW() - interval '7 days'`
    case 'MONTH': return `date_trunc('month', NOW())`
    default: return `NOW() - interval '1 hour'`
  }
}

async function setCreditGucs(client) {
  await client.query('SELECT set_config($1, $2, true)', [
    'credits.approval_threshold_micro_usd',
    String(approvalThresholdMicroUsd()),
  ])
  await client.query('SELECT set_config($1, $2, true)', [
    'credits.per_credit_micro_usd',
    String(perCreditMicroUsd()),
  ])
}

function replayGrant(row) {
  return { grant: row, wallet: null, replay: true }
}

export async function getWallet(tenantId) {
  return transaction(async (client) => lockWallet(client, tenantId))
}

export async function ensureTenantWallet({
  tenantId,
  currency = 'USD',
  scope = null,
  scopeId = null,
}) {
  return transaction(async (client) => {
    const finTenantId = scope && scopeId
      ? await lookupFinTenantId(client, scope, String(scopeId))
      : null
    const id = tenantId
      || finTenantId
      || (scope && scopeId ? syntheticTenantId(scope, String(scopeId)) : null)
    if (!id) {
      throw new CreditEngineError(CREDIT_ERROR.INVALID_AMOUNT, 'tenantId or scope/scopeId is required')
    }
    return ensureWallet(client, {
      tenantId: id,
      currency,
      scope,
      scopeId: scopeId == null ? null : String(scopeId),
      finTenantId,
    })
  })
}

async function assertSpendCaps(client, { tenantId, feature, creditsAmount }) {
  const { rows: caps } = await client.query(
    `SELECT * FROM public.credit_spend_caps
      WHERE tenant_id = $1 AND active = true
        AND (feature IS NULL OR feature = $2)`,
    [tenantId, feature],
  )
  for (const cap of caps) {
    const startExpr = windowStartSql(cap.window_kind)
    const consumed = await client.query(
      `SELECT COALESCE(SUM(credits_amount), 0)::bigint AS qty
         FROM public.credit_consumptions
        WHERE tenant_id = $1
          AND consumed_at >= ${startExpr}
          AND ($2::text IS NULL OR feature = $2)`,
      [tenantId, cap.feature],
    )
    const held = await client.query(
      `SELECT COALESCE(SUM(credits_amount), 0)::bigint AS qty
         FROM public.credit_reservations
        WHERE tenant_id = $1 AND status = 'HELD'
          AND reserved_at >= ${startExpr}
          AND ($2::text IS NULL OR feature = $2)`,
      [tenantId, cap.feature],
    )
    const used = Number(consumed.rows[0].qty) + Number(held.rows[0].qty)
    if (used + creditsAmount > Number(cap.max_credits)) {
      throw new CreditEngineError(
        CREDIT_ERROR.SPEND_CAP_EXCEEDED,
        `Spend cap exceeded for ${cap.window_kind}${cap.feature ? `/${cap.feature}` : ''}`,
        { capId: cap.id, used, adding: creditsAmount, max: Number(cap.max_credits) },
      )
    }
  }
}

export async function reserve({
  tenantId,
  feature,
  requestId,
  creditsAmount,
  idempotencyKey = null,
  expiresAt = null,
  data = {},
  scope = null,
  scopeId = null,
  currency = 'USD',
} = {}) {
  const amount = asPositiveInt(creditsAmount, 'creditsAmount')
  if (!requestId) throw new CreditEngineError(CREDIT_ERROR.INVALID_AMOUNT, 'requestId is required')
  const featureName = feature || FEATURES.WHATSAPP_LISTINGS

  return transaction(async (client) => {
    const finTenantId = scope && scopeId ? await lookupFinTenantId(client, scope, String(scopeId)) : null
    const walletId = tenantId
      || finTenantId
      || (scope && scopeId ? syntheticTenantId(scope, String(scopeId)) : null)
    const wallet = await ensureWallet(client, {
      tenantId: walletId,
      currency,
      scope,
      scopeId: scopeId == null ? null : String(scopeId),
      finTenantId,
    })

    const existing = await client.query(
      `SELECT * FROM public.credit_reservations
        WHERE tenant_id = $1 AND request_id = $2 AND feature = $3`,
      [wallet.tenant_id, String(requestId), featureName],
    )
    if (existing.rows[0]) {
      return { reservation: existing.rows[0], wallet, replay: true }
    }

    await assertSpendCaps(client, {
      tenantId: wallet.tenant_id,
      feature: featureName,
      creditsAmount: amount,
    })

    const available = Number(wallet.credits_remaining) - Number(wallet.credits_reserved)
    if (available < amount) {
      throw new CreditEngineError(
        CREDIT_ERROR.INSUFFICIENT_CREDITS,
        'Insufficient credits',
        { wallet, available, requested: amount },
      )
    }

    const ttlMs = reservationTtlSeconds() * 1000
    const expires = expiresAt || new Date(Date.now() + ttlMs).toISOString()
    const id = randomUUID()
    try {
      const inserted = await client.query(
        `INSERT INTO public.credit_reservations (
           id, tenant_id, feature, request_id, credits_amount, status,
           reserved_at, expires_at, data
         ) VALUES ($1, $2, $3, $4, $5, 'HELD', NOW(), $6, $7::jsonb)
         RETURNING *`,
        [
          id, wallet.tenant_id, featureName, String(requestId), amount, expires,
          JSON.stringify({ ...data, idempotency_key: idempotencyKey || requestId }),
        ],
      )
      const updated = await client.query(
        `UPDATE public.credit_wallets
            SET credits_reserved = credits_reserved + $2,
                version = version + 1,
                updated_at = NOW()
          WHERE tenant_id = $1
          RETURNING *`,
        [wallet.tenant_id, amount],
      )
      return { reservation: inserted.rows[0], wallet: updated.rows[0], replay: false }
    } catch (error) {
      if (error.code !== '23505') throw error
      const replay = await client.query(
        `SELECT * FROM public.credit_reservations
          WHERE tenant_id = $1 AND request_id = $2 AND feature = $3`,
        [wallet.tenant_id, String(requestId), featureName],
      )
      return { reservation: replay.rows[0], wallet: await lockWallet(client, wallet.tenant_id), replay: true }
    }
  })
}

export async function consume({
  tenantId,
  feature,
  requestId,
  callType,
  creditsAmount,
  actualCostMicroUsd = null,
  provider = null,
  model = null,
  relatedEntityType = null,
  relatedEntityId = null,
  data = {},
  scope = null,
  scopeId = null,
  currency = 'USD',
} = {}) {
  const amount = asPositiveInt(creditsAmount, 'creditsAmount')
  if (!requestId) throw new CreditEngineError(CREDIT_ERROR.INVALID_AMOUNT, 'requestId is required')
  const featureName = feature || FEATURES.WHATSAPP_LISTINGS
  const type = callType || 'default'

  return transaction(async (client) => {
    const finTenantId = scope && scopeId ? await lookupFinTenantId(client, scope, String(scopeId)) : null
    const walletId = tenantId
      || finTenantId
      || (scope && scopeId ? syntheticTenantId(scope, String(scopeId)) : null)
    const wallet = await ensureWallet(client, {
      tenantId: walletId,
      currency,
      scope,
      scopeId: scopeId == null ? null : String(scopeId),
      finTenantId,
    })

    const existing = await client.query(
      `SELECT * FROM public.credit_consumptions
        WHERE tenant_id = $1 AND request_id = $2 AND feature = $3 AND call_type = $4`,
      [wallet.tenant_id, String(requestId), featureName, type],
    )
    if (existing.rows[0]) {
      return { consumption: existing.rows[0], wallet, replay: true }
    }

    const reservationQ = await client.query(
      `SELECT * FROM public.credit_reservations
        WHERE tenant_id = $1 AND request_id = $2 AND feature = $3
        FOR UPDATE`,
      [wallet.tenant_id, String(requestId), featureName],
    )
    const reservation = reservationQ.rows[0] || null
    if (reservation?.status === 'CONSUMED') {
      const prior = await client.query(
        `SELECT * FROM public.credit_consumptions
          WHERE reservation_id = $1 LIMIT 1`,
        [reservation.id],
      )
      if (prior.rows[0]) return { consumption: prior.rows[0], wallet, replay: true }
    }
    if (reservation && reservation.status !== 'HELD' && reservation.status !== 'CONSUMED') {
      throw new CreditEngineError(
        CREDIT_ERROR.RESERVATION_NOT_HELD,
        `Reservation is ${reservation.status}`,
        { reservation },
      )
    }

    const reservedHeld = reservation?.status === 'HELD' ? Number(reservation.credits_amount) : 0
    const remaining = Number(wallet.credits_remaining)
    const reserved = Number(wallet.credits_reserved)
    const available = remaining - reserved + reservedHeld
    if (available < amount) {
      throw new CreditEngineError(
        CREDIT_ERROR.INSUFFICIENT_CREDITS,
        'Insufficient credits',
        { wallet, available, requested: amount },
      )
    }

    const nextRemaining = remaining - amount
    const nextReserved = Math.max(0, reserved - reservedHeld)
    const consumptionId = randomUUID()

    try {
      const inserted = await client.query(
        `INSERT INTO public.credit_consumptions (
           id, tenant_id, feature, call_type, request_id, credits_amount,
           actual_cost_micro_usd, provider, model,
           related_entity_type, related_entity_id, reservation_id, consumed_at, data
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,NOW(),$13::jsonb)
         RETURNING *`,
        [
          consumptionId, wallet.tenant_id, featureName, type, String(requestId), amount,
          actualCostMicroUsd, provider, model,
          relatedEntityType, relatedEntityId,
          reservation?.status === 'HELD' ? reservation.id : null,
          JSON.stringify(data || {}),
        ],
      )
      if (reservation?.status === 'HELD') {
        await client.query(
          `UPDATE public.credit_reservations
              SET status = 'CONSUMED', resolved_at = NOW()
            WHERE id = $1`,
          [reservation.id],
        )
      }
      const updated = await client.query(
        `UPDATE public.credit_wallets
            SET credits_remaining = $2,
                credits_reserved = $3,
                version = version + 1,
                updated_at = NOW()
          WHERE tenant_id = $1
          RETURNING *`,
        [wallet.tenant_id, nextRemaining, nextReserved],
      )
      return { consumption: inserted.rows[0], wallet: updated.rows[0], replay: false }
    } catch (error) {
      if (error.code !== '23505') throw error
      const replay = await client.query(
        `SELECT * FROM public.credit_consumptions
          WHERE tenant_id = $1 AND request_id = $2 AND feature = $3 AND call_type = $4`,
        [wallet.tenant_id, String(requestId), featureName, type],
      )
      return { consumption: replay.rows[0], wallet: await lockWallet(client, wallet.tenant_id), replay: true }
    }
  })
}

export async function release({
  tenantId,
  feature,
  requestId,
  scope = null,
  scopeId = null,
} = {}) {
  if (!requestId) throw new CreditEngineError(CREDIT_ERROR.INVALID_AMOUNT, 'requestId is required')
  const featureName = feature || FEATURES.WHATSAPP_LISTINGS

  return transaction(async (client) => {
    const finTenantId = scope && scopeId ? await lookupFinTenantId(client, scope, String(scopeId)) : null
    const walletId = tenantId
      || finTenantId
      || (scope && scopeId ? syntheticTenantId(scope, String(scopeId)) : null)
    const wallet = walletId ? await lockWallet(client, walletId) : null
    if (!wallet) {
      return { reservation: null, wallet: null, replay: true }
    }

    const reservationQ = await client.query(
      `SELECT * FROM public.credit_reservations
        WHERE tenant_id = $1 AND request_id = $2 AND feature = $3
        FOR UPDATE`,
      [wallet.tenant_id, String(requestId), featureName],
    )
    const reservation = reservationQ.rows[0]
    if (!reservation) {
      return { reservation: null, wallet, replay: true }
    }
    if (reservation.status !== 'HELD') {
      return { reservation, wallet, replay: true }
    }

    await client.query(
      `UPDATE public.credit_reservations
          SET status = 'RELEASED', resolved_at = NOW()
        WHERE id = $1`,
      [reservation.id],
    )
    const amount = Number(reservation.credits_amount)
    const updated = await client.query(
      `UPDATE public.credit_wallets
          SET credits_reserved = GREATEST(credits_reserved - $2, 0),
              version = version + 1,
              updated_at = NOW()
        WHERE tenant_id = $1
        RETURNING *`,
      [wallet.tenant_id, amount],
    )
    return { reservation: { ...reservation, status: 'RELEASED' }, wallet: updated.rows[0], replay: false }
  })
}

export async function grant({
  tenantId,
  source,
  amount,
  currency = 'USD',
  grantRef = {},
  packageId = null,
  billingPeriodStart = null,
  billingPeriodEnd = null,
  expiresAt = null,
  grantedByActorType = null,
  grantedByActorId = null,
  approvalRequestId = null,
  data = {},
  scope = null,
  scopeId = null,
} = {}) {
  const units = asPositiveInt(amount, 'amount')
  if (!GRANT_SOURCES.has(source)) {
    throw new CreditEngineError(CREDIT_ERROR.INVALID_SOURCE, `Invalid grant source: ${source}`)
  }
  if (grantRequiresApproval(source, units) && !approvalRequestId) {
    throw new CreditEngineError(
      CREDIT_ERROR.CREDIT_GRANT_APPROVAL_REQUIRED,
      'CREDIT_GRANT_APPROVAL_REQUIRED',
      { source, amount: units, threshold: approvalThresholdMicroUsd() },
    )
  }

  const idempotencyKey = grantRef?.idempotency_key || null

  return transaction(async (client) => {
    await setCreditGucs(client)
    const finTenantId = scope && scopeId ? await lookupFinTenantId(client, scope, String(scopeId)) : null
    const walletId = tenantId
      || finTenantId
      || (scope && scopeId ? syntheticTenantId(scope, String(scopeId)) : null)
    const wallet = await ensureWallet(client, {
      tenantId: walletId,
      currency,
      scope,
      scopeId: scopeId == null ? null : String(scopeId),
      finTenantId,
    })
    if (wallet.currency !== currency) {
      throw new CreditEngineError(
        CREDIT_ERROR.CURRENCY_MISMATCH,
        `Grant currency ${currency} != wallet currency ${wallet.currency}`,
        { wallet, currency },
      )
    }

    if (idempotencyKey) {
      const prior = await client.query(
        `SELECT * FROM public.credit_grants
          WHERE source = $1 AND grant_ref->>'idempotency_key' = $2`,
        [source, String(idempotencyKey)],
      )
      if (prior.rows[0]) {
        return { ...replayGrant(prior.rows[0]), wallet }
      }
    }

    const id = randomUUID()
    try {
      const inserted = await client.query(
        `INSERT INTO public.credit_grants (
           id, tenant_id, source, amount, currency, grant_ref, package_id,
           billing_period_start, billing_period_end, expires_at,
           granted_at, granted_by_actor_type, granted_by_actor_id,
           approval_request_id, data
         ) VALUES (
           $1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9,$10,NOW(),$11,$12,$13,$14::jsonb
         )
         RETURNING *`,
        [
          id, wallet.tenant_id, source, units, currency,
          JSON.stringify(grantRef || {}),
          packageId, billingPeriodStart, billingPeriodEnd, expiresAt,
          grantedByActorType, grantedByActorId, approvalRequestId,
          JSON.stringify(data || {}),
        ],
      )
      const updated = await client.query(
        `UPDATE public.credit_wallets
            SET credits_remaining = credits_remaining + $2,
                version = version + 1,
                updated_at = NOW()
          WHERE tenant_id = $1
          RETURNING *`,
        [wallet.tenant_id, units],
      )
      return { grant: inserted.rows[0], wallet: updated.rows[0], replay: false }
    } catch (error) {
      const msg = String(error.message || '')
      if (msg.includes('CREDIT_GRANT_APPROVAL_REQUIRED')) {
        throw new CreditEngineError(
          CREDIT_ERROR.CREDIT_GRANT_APPROVAL_REQUIRED,
          msg,
          { source, amount: units },
        )
      }
      if (msg.includes('CURRENCY_MISMATCH')) {
        throw new CreditEngineError(CREDIT_ERROR.CURRENCY_MISMATCH, msg)
      }
      if (error.code === '23505' && idempotencyKey) {
        const prior = await client.query(
          `SELECT * FROM public.credit_grants
            WHERE source = $1 AND grant_ref->>'idempotency_key' = $2`,
          [source, String(idempotencyKey)],
        )
        return { ...replayGrant(prior.rows[0]), wallet: await lockWallet(client, wallet.tenant_id) }
      }
      throw error
    }
  })
}

export async function listTransactions(tenantId, { limit = 100 } = {}) {
  return transaction(async (client) => {
    const grants = await client.query(
      `SELECT id, tenant_id, 'grant' AS kind, source AS type, amount,
              granted_at AS created_at, grant_ref AS data
         FROM public.credit_grants
        WHERE tenant_id = $1
        ORDER BY granted_at DESC
        LIMIT $2`,
      [tenantId, limit],
    )
    const consumptions = await client.query(
      `SELECT id, tenant_id, 'consumption' AS kind, feature AS type,
              credits_amount AS amount, consumed_at AS created_at, data
         FROM public.credit_consumptions
        WHERE tenant_id = $1
        ORDER BY consumed_at DESC
        LIMIT $2`,
      [tenantId, limit],
    )
    return [...grants.rows, ...consumptions.rows]
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, limit)
  })
}

export async function upsertSpendCap({
  id = randomUUID(),
  tenantId,
  feature = null,
  windowKind,
  maxCredits,
  active = true,
  data = {},
} = {}) {
  const max = asPositiveInt(maxCredits, 'maxCredits')
  return transaction(async (client) => {
    const { rows } = await client.query(
      `INSERT INTO public.credit_spend_caps (
         id, tenant_id, feature, window_kind, max_credits, active, data, created_at
       ) VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,NOW())
       RETURNING *`,
      [id, tenantId, feature, windowKind, max, active, JSON.stringify(data || {})],
    )
    return rows[0]
  })
}
