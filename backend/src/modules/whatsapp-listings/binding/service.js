import { randomInt } from 'crypto'
import { query } from '../../../db.js'
import { getIntakeConfig } from './config.js'
import { sharedNumberIndex } from './round-robin.js'
import { CODE_ALPHABET, formatDisplayCode } from './codes.js'
import { digitsOnly, toE164 } from './phone.js'

function generateCode() {
  let code = ''
  for (let i = 0; i < 4; i += 1) {
    code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]
  }
  return code
}

function rowDate(value) {
  if (!value) return null
  if (value instanceof Date) return value.toISOString()
  return value
}

function toActivationCodeResult(row, sharedNumberE164) {
  return {
    id: row.id,
    code: row.code,
    parseable_code: row.code,
    display_code: row.display_code,
    shared_number_index: row.shared_number_index,
    shared_number_e164: sharedNumberE164,
    expires_at: rowDate(row.expires_at),
  }
}

export async function findActiveCodeForUser(userId) {
  const rows = await query(
    `SELECT * FROM public.whatsapp_activation_codes
      WHERE user_id = $1
        AND claimed_at IS NULL
        AND invalidated_at IS NULL
        AND expires_at > NOW()
      ORDER BY created_at DESC
      LIMIT 1`,
    [userId],
  )
  return rows[0] || null
}

async function insertActivationCode(userId, { firstName } = {}) {
  const cfg = await getIntakeConfig()
  const index = sharedNumberIndex(userId, cfg.poolSize)
  const ttlHours = cfg.WHATSAPP_INTAKE_CODE_TTL_HOURS
  const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000).toISOString()

  let lastError
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = generateCode()
    const displayCode = formatDisplayCode(code, firstName)
    try {
      const rows = await query(
        `INSERT INTO public.whatsapp_activation_codes
           (user_id, code, display_code, shared_number_index, expires_at)
         VALUES ($1, $2, $3, $4, $5::timestamptz)
         RETURNING *`,
        [userId, code, displayCode, index, expiresAt],
      )
      return toActivationCodeResult(rows[0], cfg.sharedNumbers[index].e164)
    } catch (err) {
      lastError = err
      if (err.code !== '23505') throw err
    }
  }
  throw lastError || new Error('Failed to generate a unique activation code')
}

/** Return the user's current active code, or mint one if none exists (idempotent). */
export async function getOrCreateActivationCode(userId, { firstName } = {}) {
  const existing = await findActiveCodeForUser(userId)
  if (existing) {
    const cfg = await getIntakeConfig()
    const index = existing.shared_number_index
    return toActivationCodeResult(existing, cfg.sharedNumbers[index].e164)
  }
  return insertActivationCode(userId, { firstName })
}

/** Explicit regenerate: invalidate prior unclaimed codes, then mint a new one. */
export async function generateActivationCode(userId, { firstName } = {}) {
  await query(
    `UPDATE public.whatsapp_activation_codes
        SET invalidated_at = NOW(),
            invalidated_reason = 'REGENERATED'
      WHERE user_id = $1
        AND claimed_at IS NULL
        AND invalidated_at IS NULL`,
    [userId],
  )
  return insertActivationCode(userId, { firstName })
}

export async function findActiveCode(code) {
  const rows = await query(
    `SELECT * FROM public.whatsapp_activation_codes
      WHERE code = $1
        AND claimed_at IS NULL
        AND invalidated_at IS NULL
        AND expires_at > NOW()
      LIMIT 1`,
    [code],
  )
  return rows[0] || null
}

export async function getCurrentBinding(phoneRaw) {
  const phone = toE164(phoneRaw)
  if (!phone) return null
  const rows = await query(
    `SELECT * FROM public.user_whatsapp_bindings
      WHERE phone_e164 = $1
        AND deactivated_at IS NULL
      ORDER BY active_from DESC
      LIMIT 1`,
    [phone],
  )
  return rows[0] || null
}

export async function listActiveBindingsForPhone(phoneRaw) {
  const phone = toE164(phoneRaw)
  if (!phone) return []
  return query(
    `SELECT * FROM public.user_whatsapp_bindings
      WHERE phone_e164 = $1
        AND deactivated_at IS NULL
      ORDER BY active_from DESC`,
    [phone],
  )
}

export async function listActiveBindingsForUser(userId) {
  return query(
    `SELECT id, user_id, phone_e164, shared_number_index, active_from, last_used_at
       FROM public.user_whatsapp_bindings
      WHERE user_id = $1
        AND deactivated_at IS NULL
      ORDER BY active_from DESC`,
    [userId],
  )
}

export async function getBindingStatus(userId) {
  const rows = await query(
    `SELECT phone_e164, active_from
       FROM public.user_whatsapp_bindings
      WHERE user_id = $1
        AND deactivated_at IS NULL
      ORDER BY active_from DESC
      LIMIT 1`,
    [userId],
  )
  const row = rows[0]
  if (!row) return { bound: false }
  return {
    bound: true,
    phone_e164: row.phone_e164,
    bound_at: rowDate(row.active_from),
  }
}

/**
 * Poll target for AGT-WLB-003 (BE-BLOCKER-14): has inbound listing content
 * arrived after this binding's activation?
 *
 * Ownership: bindingId must belong to userId, else null (caller → 404).
 * Signals (real data only — never invented):
 *   - wa_listings.processed_messages.user_id stamped on content path
 *   - wa_listings.sessions for agent+phone after active_from
 *   - binding.last_used_at only when strictly after active_from
 *     (createBinding sets both to the same NOW())
 */
export async function getInboundStatus({ bindingId, userId }) {
  const bindings = await query(
    `SELECT id, user_id, phone_e164, active_from, deactivated_at, last_used_at
       FROM public.user_whatsapp_bindings
      WHERE id = $1
        AND user_id = $2
      LIMIT 1`,
    [bindingId, userId],
  )
  const binding = bindings[0]
  if (!binding) return null

  const activeFrom = binding.active_from
  const bound = binding.deactivated_at == null

  const stamped = await query(
    `SELECT processed_at
       FROM wa_listings.processed_messages
      WHERE user_id = $1
        AND processed_at >= $2::timestamptz
      ORDER BY processed_at DESC
      LIMIT 1`,
    [userId, activeFrom],
  )

  let draftSessionId = null
  let sessionActivityAt = null
  const agent = await getAgentForBindingUser(userId)
  if (agent?.id) {
    const phoneDigits = digitsOnly(binding.phone_e164)
    const sessions = await query(
      `SELECT id, created_at, last_activity_at
         FROM wa_listings.sessions
        WHERE agent_id = $1
          AND regexp_replace(COALESCE(phone_number, ''), '[^0-9]', '', 'g') = $2
          AND (
            created_at >= $3::timestamptz
            OR COALESCE(last_activity_at, created_at) >= $3::timestamptz
          )
        ORDER BY COALESCE(last_activity_at, created_at) DESC NULLS LAST
        LIMIT 1`,
      [agent.id, phoneDigits, activeFrom],
    )
    const session = sessions[0]
    if (session) {
      draftSessionId = session.id
      sessionActivityAt = session.last_activity_at || session.created_at
    }
  }

  const candidates = []
  if (stamped[0]?.processed_at) candidates.push(stamped[0].processed_at)
  if (sessionActivityAt) candidates.push(sessionActivityAt)

  // last_used_at is set equal to active_from at bind time; only treat a
  // later touch (content path → touchBinding) as an inbound signal.
  if (binding.last_used_at) {
    const lastUsedMs = new Date(binding.last_used_at).getTime()
    const activeFromMs = new Date(activeFrom).getTime()
    if (Number.isFinite(lastUsedMs) && Number.isFinite(activeFromMs) && lastUsedMs > activeFromMs) {
      candidates.push(binding.last_used_at)
    }
  }

  let latestMessageAt = null
  for (const value of candidates) {
    const ms = new Date(value).getTime()
    if (!Number.isFinite(ms)) continue
    if (!latestMessageAt || ms > new Date(latestMessageAt).getTime()) {
      latestMessageAt = value
    }
  }

  return {
    bound,
    binding_id: binding.id,
    latest_message_at: rowDate(latestMessageAt),
    draft_session_id: draftSessionId,
  }
}

export async function createBinding({ userId, phoneRaw, sharedNumberIndex }) {
  const phone = toE164(phoneRaw)
  const rows = await query(
    `INSERT INTO public.user_whatsapp_bindings
       (user_id, phone_e164, shared_number_index, active_from, last_used_at)
     VALUES ($1, $2, $3, NOW(), NOW())
     RETURNING *`,
    [userId, phone, sharedNumberIndex],
  )
  return rows[0]
}

export async function deactivateBinding({ bindingId, userId }) {
  const rows = await query(
    `UPDATE public.user_whatsapp_bindings
        SET deactivated_at = NOW(),
            updated_at = NOW()
      WHERE id = $1
        AND user_id = $2
        AND deactivated_at IS NULL
      RETURNING *`,
    [bindingId, userId],
  )
  return rows[0] || null
}

export async function deactivateCurrentBindingForPhone(phoneRaw) {
  const current = await getCurrentBinding(phoneRaw)
  if (!current) return null
  const rows = await query(
    `UPDATE public.user_whatsapp_bindings
        SET deactivated_at = NOW(),
            updated_at = NOW()
      WHERE id = $1
        AND deactivated_at IS NULL
      RETURNING *`,
    [current.id],
  )
  return rows[0] || null
}

export async function touchBinding(bindingId) {
  await query(
    `UPDATE public.user_whatsapp_bindings
        SET last_used_at = NOW(),
            updated_at = NOW()
      WHERE id = $1`,
    [bindingId],
  )
}

export async function claimCodeRow(codeId, phoneRaw) {
  const phone = toE164(phoneRaw)
  const rows = await query(
    `UPDATE public.whatsapp_activation_codes
        SET claimed_at = NOW(),
            claimed_from_phone = $2,
            pending_selection = NULL
      WHERE id = $1
        AND claimed_at IS NULL
        AND invalidated_at IS NULL
        AND expires_at > NOW()
      RETURNING *`,
    [codeId, phone],
  )
  return rows[0] || null
}

export async function setPendingSelection(codeId, pending) {
  await query(
    `UPDATE public.whatsapp_activation_codes
        SET pending_selection = $2::jsonb
      WHERE id = $1`,
    [codeId, JSON.stringify(pending)],
  )
}

export async function findPendingSelection(phoneRaw) {
  const phone = toE164(phoneRaw)
  const rows = await query(
    `SELECT * FROM public.whatsapp_activation_codes
      WHERE pending_selection->>'phone_e164' = $1
        AND claimed_at IS NULL
        AND invalidated_at IS NULL
        AND expires_at > NOW()
      ORDER BY created_at DESC
      LIMIT 1`,
    [phone],
  )
  return rows[0] || null
}

export async function invalidateCode(codeId, reason) {
  await query(
    `UPDATE public.whatsapp_activation_codes
        SET invalidated_at = NOW(),
            invalidated_reason = $2,
            pending_selection = NULL
      WHERE id = $1
        AND claimed_at IS NULL
        AND invalidated_at IS NULL`,
    [codeId, reason],
  )
}

export async function getUserName(userId) {
  const rows = await query(`SELECT id, name FROM public.users WHERE id = $1`, [userId])
  return rows[0]?.name || 'this account'
}

export async function getAgentForBindingUser(userId) {
  const byId = await query(`SELECT * FROM public.agents WHERE id = $1 LIMIT 1`, [userId])
  if (byId[0]) return byId[0]
  const byUser = await query(`SELECT * FROM public.agents WHERE user_id = $1 LIMIT 1`, [userId])
  return byUser[0] || null
}

export async function stampProcessedMessage({ messageId, userId, sharedNumberIndex }) {
  if (!messageId) return
  await query(
    `UPDATE wa_listings.processed_messages
        SET user_id = $2,
            shared_number_index = $3
      WHERE message_id = $1`,
    [messageId, userId || null, sharedNumberIndex ?? null],
  )
}

export async function countAgentMessagesLast24h(userId, { excludeMessageId } = {}) {
  const rows = await query(
    `SELECT COUNT(*)::int AS n
       FROM wa_listings.processed_messages
      WHERE user_id = $1
        AND processed_at >= NOW() - INTERVAL '24 hours'
        AND ($2::text IS NULL OR message_id <> $2)`,
    [userId, excludeMessageId || null],
  )
  return rows[0]?.n || 0
}

export async function bindPhoneToCode({ codeRow, phoneRaw }) {
  const claimed = await claimCodeRow(codeRow.id, phoneRaw)
  if (!claimed) return null
  const binding = await createBinding({
    userId: claimed.user_id,
    phoneRaw,
    sharedNumberIndex: claimed.shared_number_index,
  })
  return { claimed, binding }
}
