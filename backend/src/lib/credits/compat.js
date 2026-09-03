/**
 * WhatsApp-listings-compatible CreditService facade over the platform engine.
 * Preserves reserve/consume/release/topUp signatures used by pipeline + routes.
 */
import { randomUUID } from 'node:crypto'
import { consume, ensureTenantWallet, getWallet, grant, listTransactions, release, reserve } from './engine.js'

const CreditType = {
  TOP_UP: 'top_up',
  CONSUMPTION: 'consumption',
  REFUND: 'refund',
  ADJUSTMENT: 'adjustment',
}

const CreditScope = {
  AGENT: 'agent',
  AGENCY: 'agency',
}
import { CREDIT_ERROR, CreditEngineError } from './errors.js'
import { FEATURES } from './features.js'
import { fromCreditUnits, toCreditUnits } from './scale.js'
import { syntheticTenantId } from './wallets.js'

function legacyBalance(wallet, scope, scopeId) {
  if (!wallet) {
    return {
      id: `${scope}:${scopeId}`,
      scope,
      scope_id: scopeId,
      credits_remaining: 0,
      credits_reserved: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
  }
  return {
    id: `${scope}:${scopeId}`,
    scope,
    scope_id: scopeId,
    tenant_id: wallet.tenant_id,
    credits_remaining: fromCreditUnits(wallet.credits_remaining),
    credits_reserved: fromCreditUnits(wallet.credits_reserved),
    currency: wallet.currency,
    created_at: wallet.updated_at,
    updated_at: wallet.updated_at,
  }
}

function requestKey(opts = {}, fallbackPrefix) {
  return opts.requestId || opts.relatedDraftId || opts.idempotencyKey || `${fallbackPrefix}:${randomUUID()}`
}

export function createCreditService(_deps = {}) {
  async function walletFor(scope, scopeId) {
    return ensureTenantWallet({ scope, scopeId, currency: 'USD' })
  }

  async function topUp(scope, scopeId, amount, { paymentIntentId, description, idempotencyKey } = {}) {
    const units = toCreditUnits(amount)
    if (!units) throw new Error('Top-up amount must be positive')
    const result = await grant({
      scope,
      scopeId,
      source: paymentIntentId ? 'topup.stripe' : 'goodwill',
      amount: units,
      currency: 'USD',
      grantRef: {
        idempotency_key: idempotencyKey || (paymentIntentId ? `pi:${paymentIntentId}` : `topup:${scope}:${scopeId}:${randomUUID()}`),
        payment_intent_id: paymentIntentId || undefined,
        reason: description || 'top_up',
        note: description || undefined,
      },
      data: { description, paymentIntentId },
    })
    return legacyBalance(result.wallet, scope, scopeId)
  }

  async function reserveCredits(scope, scopeId, amount, opts = {}) {
    const units = toCreditUnits(amount)
    if (!units) {
      const wallet = await walletFor(scope, scopeId)
      return { ok: true, balance: legacyBalance(wallet, scope, scopeId) }
    }
    try {
      const result = await reserve({
        scope,
        scopeId,
        feature: opts.feature || FEATURES.WHATSAPP_LISTINGS,
        requestId: requestKey(opts, 'reserve'),
        creditsAmount: units,
        idempotencyKey: opts.idempotencyKey,
        data: { description: opts.description, relatedDraftId: opts.relatedDraftId },
      })
      return { ok: true, balance: legacyBalance(result.wallet, scope, scopeId) }
    } catch (error) {
      if (error instanceof CreditEngineError && error.code === CREDIT_ERROR.INSUFFICIENT_CREDITS) {
        const wallet = error.extra?.wallet || await walletFor(scope, scopeId)
        return { ok: false, error: 'Insufficient credits', balance: legacyBalance(wallet, scope, scopeId) }
      }
      throw error
    }
  }

  async function consumeCredits(scope, scopeId, amount, opts = {}) {
    const units = toCreditUnits(amount)
    if (!units) return legacyBalance(await walletFor(scope, scopeId), scope, scopeId)
    const result = await consume({
      scope,
      scopeId,
      feature: opts.feature || FEATURES.WHATSAPP_LISTINGS,
      requestId: requestKey(opts, 'consume'),
      callType: opts.callType || 'draft',
      creditsAmount: units,
      actualCostMicroUsd: opts.actualCostMicroUsd ?? null,
      provider: opts.provider,
      model: opts.model,
      relatedEntityType: opts.relatedDraftId ? 'draft' : null,
      relatedEntityId: opts.relatedDraftId || null,
      data: { description: opts.description },
    })
    return legacyBalance(result.wallet, scope, scopeId)
  }

  async function releaseCredits(scope, scopeId, amount, opts = {}) {
    const result = await release({
      scope,
      scopeId,
      feature: opts.feature || FEATURES.WHATSAPP_LISTINGS,
      requestId: requestKey(opts, 'release'),
    })
    const wallet = result.wallet || await walletFor(scope, scopeId)
    return legacyBalance(wallet, scope, scopeId)
  }

  async function refund(scope, scopeId, amount, { description } = {}) {
    const units = toCreditUnits(amount)
    if (!units) throw new Error('Refund amount must be positive')
    const result = await grant({
      scope,
      scopeId,
      source: 'adjustment.correction',
      amount: units,
      currency: 'USD',
      grantRef: {
        reason: description || 'refund',
        note: description || 'refund',
        idempotency_key: `refund:${scope}:${scopeId}:${randomUUID()}`,
      },
    })
    return legacyBalance(result.wallet, scope, scopeId)
  }

  async function balance(scope, scopeId) {
    return legacyBalance(await walletFor(scope, scopeId), scope, scopeId)
  }

  async function transactions(scope, scopeId, { limit = 100 } = {}) {
    const wallet = await walletFor(scope, scopeId)
    const rows = await listTransactions(wallet.tenant_id, { limit })
    return rows.map((row) => ({
      id: row.id,
      scope,
      scope_id: scopeId,
      type: row.kind === 'grant' ? CreditType.TOP_UP : CreditType.CONSUMPTION,
      amount: fromCreditUnits(row.amount),
      description: row.data?.description || row.data?.reason || row.type,
      related_draft_id: row.data?.relatedDraftId || null,
      created_at: row.created_at,
    }))
  }

  async function allocateAgencyToAgent(agencyId, agentId, amount, { description } = {}) {
    const units = toCreditUnits(amount)
    if (!units) return { ok: false, error: 'Insufficient agency credits' }
    const requestId = `allocate:${agencyId}:${agentId}:${randomUUID()}`
    try {
      await consume({
        scope: CreditScope.AGENCY,
        scopeId: agencyId,
        feature: FEATURES.WHATSAPP_LISTINGS,
        requestId,
        callType: 'allocate',
        creditsAmount: units,
        data: { description: description || `Allocated to agent ${agentId}` },
      })
    } catch (error) {
      if (error instanceof CreditEngineError && error.code === CREDIT_ERROR.INSUFFICIENT_CREDITS) {
        return { ok: false, error: 'Insufficient agency credits' }
      }
      throw error
    }
    await grant({
      scope: CreditScope.AGENT,
      scopeId: agentId,
      source: 'promo',
      amount: units,
      currency: 'USD',
      grantRef: {
        reason: description || `Allocated from agency ${agencyId}`,
        idempotency_key: `allocate-grant:${requestId}`,
      },
    })
    return {
      ok: true,
      agencyBalance: await balance(CreditScope.AGENCY, agencyId),
      agentBalance: await balance(CreditScope.AGENT, agentId),
    }
  }

  return {
    topUp,
    reserve: reserveCredits,
    consume: consumeCredits,
    release: releaseCredits,
    refund,
    balance,
    transactions,
    allocateAgencyToAgent,
    _engine: { getWallet, syntheticTenantId },
  }
}
