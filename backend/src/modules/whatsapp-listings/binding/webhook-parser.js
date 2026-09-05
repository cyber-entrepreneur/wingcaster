import {
  bindPhoneToCode,
  deactivateCurrentBindingForPhone,
  findActiveCode,
  findPendingSelection,
  getAgentForBindingUser,
  getCurrentBinding,
  getUserName,
  invalidateCode,
  listActiveBindingsForUser,
  setPendingSelection,
} from './service.js'
import { CODE_ALPHABET } from './codes.js'
import { formatLastUsed, maskPhone, toE164 } from './phone.js'

const ALPHABET_SET = new Set(CODE_ALPHABET.split(''))
const COMMANDS = new Set(['BIND', 'UNBIND', 'LIST', 'TRANSFER'])

export { CODE_ALPHABET }

export function humanHintFromName(name) {
  const first = String(name || '').trim().split(/\s+/)[0] || 'AGENT'
  const stripped = first.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6)
  return stripped || 'AGENT'
}

export function formatDisplayCode(code, firstName) {
  return `WC-${code}-${humanHintFromName(firstName)}`
}

/**
 * Classify inbound WhatsApp text for the binding pre-processor.
 * Commands require the WC- prefix (H7). Codes are prefix/suffix optional (H1).
 */
export function parseInboundText(raw) {
  const text = String(raw || '').trim()
  if (!text) return { type: 'none' }

  if (/^[12]$/.test(text)) {
    return { type: 'selector', choice: Number(text) }
  }

  const commandMatch = text.match(/^WC-([A-Za-z]+)(?:\s+(.+))?$/i)
  if (commandMatch) {
    const command = commandMatch[1].toUpperCase()
    if (COMMANDS.has(command)) {
      const arg = commandMatch[2] ? parseCodeCandidate(commandMatch[2].trim()) : { type: 'none' }
      return { type: 'command', command, arg }
    }
  }

  return parseCodeCandidate(text)
}

export function parseCodeCandidate(raw) {
  const text = String(raw || '').trim().toUpperCase().replace(/\s+/g, '')
  if (!text) return { type: 'none' }

  const stripped = text.startsWith('WC-') ? text.slice(3) : text
  const core = stripped.split('-')[0] || ''

  if (core.length === 4 && [...core].every((ch) => ALPHABET_SET.has(ch))) {
    return { type: 'code', code: core }
  }

  if ((core.length === 3 || core.length === 5) && [...core].every((ch) => ALPHABET_SET.has(ch))) {
    return { type: 'partial', code: core }
  }

  return { type: 'none' }
}

export const LINKED_REPLY = "You're linked. Send photos, a voice note, and a location pin to start your first listing."
export const HINT_REPLY = "Please send your activation code. It looks like WC-XXXX-YOURNAME. Tap 'Get a new code' in the WingCaster app if you don't have one."
export const PARTIAL_REPLY = 'That code looks incomplete. Please send the 4-character code from the WingCaster app (like A4K9).'
export const CAP_REPLY = "You've hit today's WingCaster message limit. Try again tomorrow."
export const TRANSFER_REPLY = 'Coming soon. Contact support to change your primary WhatsApp number.'
export const BIND_USAGE_REPLY = 'Send WC-BIND followed by your activation code from the WingCaster app.'
export const UNBIND_NONE_REPLY = 'This phone is not linked to a WingCaster account.'

function selectorPrompt(existingName, newName) {
  return `This phone is linked to ${existingName}. Send \`1\` to keep sending as ${existingName}, \`2\` to switch to ${newName} for this and future messages.`
}

async function maybeSelectorOrBind({ codeRow, from, sendReply }) {
  const current = await getCurrentBinding(from)
  if (current && current.user_id !== codeRow.user_id) {
    const existingName = await getUserName(current.user_id)
    const newName = await getUserName(codeRow.user_id)
    await setPendingSelection(codeRow.id, {
      phone_e164: toE164(from),
      existing_user_id: current.user_id,
      existing_binding_id: current.id,
    })
    await sendReply(selectorPrompt(existingName, newName))
    return { handled: true, reason: 'selector_prompt' }
  }
  const bound = await bindPhoneToCode({ codeRow, phoneRaw: from })
  if (!bound) {
    await sendReply(HINT_REPLY)
    return { handled: true, reason: 'code_claim_lost' }
  }
  await sendReply(LINKED_REPLY)
  return { handled: true, reason: 'bound', user_id: bound.binding.user_id }
}

async function handleCode({ parsed, from, sendReply }) {
  if (parsed.type === 'partial') {
    await sendReply(PARTIAL_REPLY)
    return { handled: true, reason: 'partial_code' }
  }
  if (parsed.type !== 'code') return null
  const codeRow = await findActiveCode(parsed.code)
  if (!codeRow) return null
  return maybeSelectorOrBind({ codeRow, from, sendReply })
}

async function handleCommand({ parsed, from, sendReply }) {
  if (parsed.command === 'TRANSFER') {
    await sendReply(TRANSFER_REPLY)
    return { handled: true, reason: 'wc_transfer' }
  }

  if (parsed.command === 'BIND') {
    if (parsed.arg?.type === 'partial') {
      await sendReply(PARTIAL_REPLY)
      return { handled: true, reason: 'partial_code' }
    }
    if (parsed.arg?.type !== 'code') {
      await sendReply(BIND_USAGE_REPLY)
      return { handled: true, reason: 'wc_bind_usage' }
    }
    const codeRow = await findActiveCode(parsed.arg.code)
    if (!codeRow) {
      await sendReply(HINT_REPLY)
      return { handled: true, reason: 'code_not_found' }
    }
    return maybeSelectorOrBind({ codeRow, from, sendReply })
  }

  if (parsed.command === 'UNBIND') {
    const removed = await deactivateCurrentBindingForPhone(from)
    if (!removed) {
      await sendReply(UNBIND_NONE_REPLY)
      return { handled: true, reason: 'wc_unbind_none' }
    }
    const name = await getUserName(removed.user_id)
    await sendReply(`Unlinked this phone from ${name}.`)
    return { handled: true, reason: 'wc_unbind', user_id: removed.user_id }
  }

  if (parsed.command === 'LIST') {
    const current = await getCurrentBinding(from)
    if (!current) {
      await sendReply(HINT_REPLY)
      return { handled: true, reason: 'unbound_hint' }
    }
    const bindings = (await listActiveBindingsForUser(current.user_id)).slice(0, 5)
    if (!bindings.length) {
      await sendReply('No phones are currently linked.')
      return { handled: true, reason: 'wc_list_empty' }
    }
    const lines = bindings.map((row, i) =>
      `${i + 1}. ${maskPhone(row.phone_e164)} — last used ${formatLastUsed(row.last_used_at)}`,
    )
    await sendReply(lines.join('\n'))
    return { handled: true, reason: 'wc_list' }
  }

  return null
}

/**
 * Pre-processor: activation codes + WC-* commands. Returns handled:true to STOP
 * the existing intake pipeline.
 */
export async function bindingParser(from, text, { sendReply } = {}) {
  if (!sendReply) throw new Error('sendReply is required')

  const pending = await findPendingSelection(from)
  const parsed = parseInboundText(text)

  if (pending) {
    const pendingSel = typeof pending.pending_selection === 'string'
      ? JSON.parse(pending.pending_selection)
      : pending.pending_selection
    if (parsed.type === 'selector' && parsed.choice === 1) {
      const existingName = await getUserName(pendingSel?.existing_user_id || pending.user_id)
      await invalidateCode(pending.id, 'KEPT_EXISTING_BINDING')
      await sendReply(`OK, still sending as ${existingName}.`)
      return { handled: true, reason: 'selector_keep' }
    }
    if (parsed.type === 'selector' && parsed.choice === 2) {
      const bound = await bindPhoneToCode({ codeRow: pending, phoneRaw: from })
      if (!bound) {
        await sendReply(HINT_REPLY)
        return { handled: true, reason: 'code_claim_lost' }
      }
      await sendReply(LINKED_REPLY)
      return { handled: true, reason: 'bound_switch', user_id: bound.binding.user_id }
    }
    const existingName = await getUserName(pendingSel?.existing_user_id)
    const newName = await getUserName(pending.user_id)
    await sendReply(selectorPrompt(existingName, newName))
    return { handled: true, reason: 'selector_reprompt' }
  }

  if (parsed.type === 'command') {
    return handleCommand({ parsed, from, sendReply })
  }

  const codeResult = await handleCode({ parsed, from, sendReply })
  if (codeResult) return codeResult

  const current = await getCurrentBinding(from)
  if (!current) {
    return { handled: false, reason: 'no_binding' }
  }

  const agent = await getAgentForBindingUser(current.user_id)
  return {
    handled: false,
    reason: 'fallthrough',
    binding: current,
    agent,
  }
}
