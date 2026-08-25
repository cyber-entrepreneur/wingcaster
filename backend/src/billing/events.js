/**
 * emitUsageEvent — facts-only ingest into fin.usage_events.
 *
 * Every meterable endpoint emits a usage event. Rating and lot-draw
 * happen later on the fin.* pipeline. This wrapper maps a public tenant
 * id onto fin.* context and lands the fact. Errors never throw to the
 * caller.
 */

import { v4 as uuidv4 } from 'uuid'
import { query, transaction } from '../db.js'
import { BusinessClock } from '../fin/clock.js'
import { ingestUsageEventWithClient } from '../fin/usage/ingest.js'

// Sentinel residency for events with no market context (webhook receipts,
// platform-scoped telemetry). Matches fin.usage_events partition default.
export const PLATFORM_TERRITORY_ID = '__platform__'

let injectedLogger = null

/**
 * Called once from server.js boot to attach the shared logger.
 */
export function setBillingLogger(logger) {
  injectedLogger = logger
}

async function resolveFinTenantContext({
  publicTenantId,
  environment = 'LIVE',
  client = null,
} = {}) {
  if (!publicTenantId) return null
  const sessionEnv = environment === 'TEST' || environment === 'LIVE' ? environment : 'LIVE'
  const run = async (q) => {
    const tenants = await q(
      `SELECT id, environment FROM fin.tenants
        WHERE public_tenant_id = $1 AND environment = $2 AND status = 'ACTIVE'`,
      [publicTenantId, sessionEnv],
    )
    const tenant = tenants[0]
    if (!tenant) return null
    const holders = await q(
      `SELECT id FROM fin.holders
        WHERE tenant_id = $1 AND holder_kind = 'TENANT_ROOT'
        ORDER BY created_at ASC LIMIT 1`,
      [tenant.id],
    )
    const billing = await q(
      `SELECT id FROM fin.billing_accounts
        WHERE tenant_id = $1 ORDER BY created_at ASC LIMIT 1`,
      [tenant.id],
    )
    if (!holders[0] || !billing[0]) return null
    return {
      tenantId: tenant.id,
      holderId: holders[0].id,
      billingAccountId: billing[0].id,
      environment: tenant.environment,
      publicTenantId: String(publicTenantId),
    }
  }

  if (client) {
    return run(async (sql, params) => {
      const { rows } = await client.query(sql, params)
      return rows
    })
  }
  return run(query)
}

/**
 * Emit a usage event. All fields except actionKey + tenantId are optional.
 *
 * @param {string} actionKey       — from the §6 catalog
 * @param {string} tenantId        — the agent/agency being metered
 * @param {number} quantity        — default 1
 * @param {string} country         — required for messaging events
 * @param {string} whatsappCategory — 'utility_service' | 'marketing'
 * @param {string} channel         — the source channel (instagram, whatsapp, ...)
 * @param {string} listingId       — the listing this action relates to, if any
 * @param {string} conversationId  — the conversation this action relates to, if any
 * @param {string} distributionId  — the distribution row this action relates to, if any
 * @param {object} metadata        — free-form additional context
 */
export async function emitUsageEvent({
  actionKey,
  tenantId,
  quantity = 1,
  country = null,
  whatsappCategory = null,
  channel = null,
  listingId = null,
  conversationId = null,
  distributionId = null,
  metadata = null,
}) {
  if (!actionKey || !tenantId) {
    injectedLogger?.warn({ actionKey, tenantId }, 'emitUsageEvent skipped — missing actionKey or tenantId')
    return null
  }

  try {
    const environment = metadata?.fin_environment === 'TEST' ? 'TEST' : 'LIVE'
    const eventId = uuidv4()
    const occurredAt = BusinessClock.now()
    const qty = Math.max(1, Number(quantity) || 1)
    const dimensions = {
      ...(metadata && typeof metadata === 'object' ? metadata : {}),
      channel: channel ?? null,
      destination_country: country ?? null,
      whatsapp_category: whatsappCategory ?? null,
      listing_id: listingId ?? null,
      conversation_id: conversationId ?? null,
      distribution_id: distributionId ?? null,
      public_tenant_id: tenantId,
    }

    await transaction(async (client) => {
      const ctx = await resolveFinTenantContext({
        publicTenantId: tenantId,
        environment,
        client,
      })
      if (!ctx) {
        injectedLogger?.warn(
          { actionKey, tenantId, environment },
          'emitUsageEvent skipped — no ACTIVE fin.tenants row',
        )
        return
      }
      await ingestUsageEventWithClient(client, {
        environment: ctx.environment,
        tenantId: ctx.tenantId,
        holderId: ctx.holderId,
        billingAccountId: ctx.billingAccountId,
        sourceSystem: 'app.usage',
        sourceEventId: eventId,
        eventType: actionKey,
        quantityUnits: qty,
        dimensions,
        occurredAt,
        receivedAt: occurredAt,
        subjectType: conversationId ? 'CONVERSATION' : listingId ? 'LISTING' : null,
        subjectId: conversationId || listingId || null,
        eventKind: 'ORIGINAL',
        actorType: 'SYSTEM',
        actorId: null,
        actorEmail: 'system@fin.local',
        now: occurredAt,
      })
    })

    return {
      id: eventId,
      tenant_id: tenantId,
      action_key: actionKey,
      quantity: qty,
      occurred_at: occurredAt,
    }
  } catch (err) {
    injectedLogger?.error({ err, actionKey, tenantId, country }, 'usage ingest failure — event NOT persisted')
    return null
  }
}

/**
 * Fire-and-forget wrapper — the standard call site from HTTP endpoints
 * that don't want to await the write.
 */
export function emitUsageEventAsync(input) {
  void emitUsageEvent(input).catch(() => { /* already logged inside */ })
}

/**
 * Map an action_key to the quota_key it consumes. Only the actions that
 * are quota-bounded are here — everything else emits an event but never
 * touches the ledger.
 */
const QUOTA_KEY_FOR_ACTION = {
  'message.out.whatsapp.utility':   'outbound_whatsapp',
  'message.out.whatsapp.marketing': 'outbound_whatsapp',
  'publish.x.plain':                'x_posts',
  'publish.x.link':                 'x_posts',
  'publish.rpa':                    'portal_publishes',
  'render.template.premium':        'template_renders_premium',
  'score.property.fresh':           'property_scores_fresh',
  'avm.report':                     'avm_reports',
  'staging.ai_image':               'staging_images',
  'ai.reply.drafted':               'ai_reply_drafts',
  'ai.chat.turn':                   'ai_chat_turns',
  'listing.active_day':             'active_listings',
}

export function quotaKeyForAction(actionKey) {
  return QUOTA_KEY_FOR_ACTION[actionKey] || null
}
