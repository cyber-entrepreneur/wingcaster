/**
 * Pending WhatsApp Embedded Signup selection — stored in oauth_states between callback and UI picker.
 */
import { randomUUID } from 'node:crypto'
import { encryptSecret, decryptSecret } from '../credentials.js'
import { insert, transaction } from '../../persistence/index.js'

const WHATSAPP_SELECT_TTL_MS = 30 * 60 * 1000

export class MetaWhatsAppSelectionError extends Error {
  constructor(code, message) {
    super(message)
    this.code = code
    this.name = 'MetaWhatsAppSelectionError'
  }
}

function whatsappSelectPlatform() {
  return 'whatsapp_account_select'
}

/**
 * @param {{
 *   agentId: string,
 *   agencyId?: string|null,
 *   accounts: Array<{
 *     waba_id: string,
 *     waba_name: string,
 *     phone_number_id: string,
 *     display_phone_number: string,
 *     verified_name?: string|null,
 *   }>,
 *   userToken: string,
 *   userTokenExpiresAt?: string|null,
 * }} params
 */
export async function createWhatsAppSelection({
  agentId,
  agencyId = null,
  accounts,
  userToken,
  userTokenExpiresAt = null,
}) {
  const id = randomUUID()
  const expiresAt = new Date(Date.now() + WHATSAPP_SELECT_TTL_MS).toISOString()

  await insert('oauth_states', {
    id,
    agent_id: agentId,
    agency_id: agencyId || null,
    platform: whatsappSelectPlatform(),
    redirect_uri: null,
    return_to: null,
    elevated: false,
    nonce: randomUUID(),
    expires_at: expiresAt,
    accounts_encrypted: encryptSecret(JSON.stringify(accounts)),
    user_token_encrypted: encryptSecret(userToken),
    user_token_expires_at: userTokenExpiresAt,
    target_platform: 'whatsapp',
  })

  return { id, expiresAt }
}

/**
 * Public account list for the UI (no tokens).
 */
export function sanitizeWhatsAppAccountsForPicker(accounts) {
  return accounts.map((account) => ({
    waba_id: account.waba_id,
    waba_name: account.waba_name,
    phone_number_id: account.phone_number_id,
    display_phone_number: account.display_phone_number,
    verified_name: account.verified_name || null,
  }))
}

/**
 * Atomically consume a WhatsApp selection and return the chosen account + user token.
 */
export async function consumeWhatsAppSelection(selectionId, phoneNumberId, agentId) {
  return transaction(async (client) => {
    const { rows } = await client.query(
      'SELECT * FROM public.oauth_states WHERE id = $1 FOR UPDATE',
      [selectionId],
    )
    const row = rows[0]
    if (!row) {
      throw new MetaWhatsAppSelectionError('missing', 'WhatsApp selection expired — restart the connect flow')
    }
    if (row.platform !== whatsappSelectPlatform()) {
      throw new MetaWhatsAppSelectionError('invalid', 'Invalid WhatsApp selection')
    }
    if (row.agent_id !== agentId) {
      throw new MetaWhatsAppSelectionError('agent_mismatch', 'Invalid WhatsApp selection')
    }
    if (row.consumed_at) {
      throw new MetaWhatsAppSelectionError('consumed', 'WhatsApp selection already used')
    }
    if (new Date(row.expires_at).getTime() <= Date.now()) {
      throw new MetaWhatsAppSelectionError('expired', 'WhatsApp selection expired — restart the connect flow')
    }

    const data = row.data && typeof row.data === 'object' ? row.data : {}
    const accountsEncrypted = data.accounts_encrypted || row.accounts_encrypted
    const userTokenEncrypted = data.user_token_encrypted || row.user_token_encrypted
    const userTokenExpiresAt = data.user_token_expires_at || row.user_token_expires_at || null

    if (!accountsEncrypted || !userTokenEncrypted) {
      throw new MetaWhatsAppSelectionError('corrupt', 'WhatsApp selection data is incomplete')
    }

    let accounts
    try {
      accounts = JSON.parse(decryptSecret(accountsEncrypted))
    } catch {
      throw new MetaWhatsAppSelectionError('corrupt', 'WhatsApp selection data is corrupt')
    }

    const selected = accounts.find((a) => a.phone_number_id === phoneNumberId)
    if (!selected) {
      throw new MetaWhatsAppSelectionError('account_not_found', 'Selected phone number is not in the candidate set')
    }

    await client.query(
      `UPDATE public.oauth_states
          SET consumed_at = CURRENT_TIMESTAMP,
              updated_at = CURRENT_TIMESTAMP
        WHERE id = $1`,
      [selectionId],
    )

    return {
      platform: 'whatsapp',
      account: selected,
      userToken: decryptSecret(userTokenEncrypted),
      userTokenExpiresAt,
      agency_id: row.agency_id,
      agent_id: row.agent_id,
    }
  })
}
