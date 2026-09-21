/**
 * Pending Meta page selection — stored in oauth_states between callback and UI picker.
 */
import { randomUUID } from 'node:crypto'
import { encryptSecret, decryptSecret } from '../credentials.js'
import { insert, transaction } from '../../persistence/index.js'

const PAGE_SELECT_TTL_MS = 30 * 60 * 1000

export class MetaPageSelectionError extends Error {
  constructor(code, message) {
    super(message)
    this.code = code
    this.name = 'MetaPageSelectionError'
  }
}

function pageSelectPlatform(platform) {
  return `${platform}_page_select`
}

/**
 * @param {{
 *   agentId: string,
 *   agencyId?: string|null,
 *   platform: 'facebook'|'instagram',
 *   pages: Array<{ id: string, name: string, access_token: string, instagram_business_account_id?: string|null }>,
 *   userToken: string,
 *   userTokenExpiresAt?: string|null,
 * }} params
 */
export async function createPageSelection({
  agentId,
  agencyId = null,
  platform,
  pages,
  userToken,
  userTokenExpiresAt = null,
}) {
  const id = randomUUID()
  const expiresAt = new Date(Date.now() + PAGE_SELECT_TTL_MS).toISOString()

  await insert('oauth_states', {
    id,
    agent_id: agentId,
    agency_id: agencyId || null,
    platform: pageSelectPlatform(platform),
    redirect_uri: null,
    return_to: null,
    elevated: false,
    nonce: randomUUID(),
    expires_at: expiresAt,
    pages_encrypted: encryptSecret(JSON.stringify(pages)),
    user_token_encrypted: encryptSecret(userToken),
    user_token_expires_at: userTokenExpiresAt,
    target_platform: platform,
  })

  return { id, expiresAt }
}

/**
 * Public page list for the UI (no tokens).
 */
export function sanitizePagesForPicker(pages) {
  return pages.map((page) => ({
    id: page.id,
    name: page.name,
    has_instagram: Boolean(page.instagram_business_account_id),
  }))
}

/**
 * Atomically consume a page selection and return the chosen page + user token.
 */
export async function consumePageSelection(selectionId, pageId, agentId) {
  return transaction(async (client) => {
    const { rows } = await client.query(
      'SELECT * FROM public.oauth_states WHERE id = $1 FOR UPDATE',
      [selectionId],
    )
    const row = rows[0]
    if (!row) {
      throw new MetaPageSelectionError('missing', 'Page selection expired — restart the connect flow')
    }
    if (!row.platform?.endsWith('_page_select')) {
      throw new MetaPageSelectionError('invalid', 'Invalid page selection')
    }
    if (row.agent_id !== agentId) {
      throw new MetaPageSelectionError('agent_mismatch', 'Invalid page selection')
    }
    if (row.consumed_at) {
      throw new MetaPageSelectionError('consumed', 'Page selection already used')
    }
    if (new Date(row.expires_at).getTime() <= Date.now()) {
      throw new MetaPageSelectionError('expired', 'Page selection expired — restart the connect flow')
    }

    const data = row.data && typeof row.data === 'object' ? row.data : {}
    const pagesEncrypted = data.pages_encrypted || row.pages_encrypted
    const userTokenEncrypted = data.user_token_encrypted || row.user_token_encrypted
    const targetPlatform = data.target_platform || row.target_platform
    const userTokenExpiresAt = data.user_token_expires_at || row.user_token_expires_at || null

    if (!pagesEncrypted || !userTokenEncrypted || !targetPlatform) {
      throw new MetaPageSelectionError('corrupt', 'Page selection data is incomplete')
    }

    let pages
    try {
      pages = JSON.parse(decryptSecret(pagesEncrypted))
    } catch {
      throw new MetaPageSelectionError('corrupt', 'Page selection data is corrupt')
    }

    const selected = pages.find((p) => p.id === pageId)
    if (!selected) {
      throw new MetaPageSelectionError('page_not_found', 'Selected page is not in the candidate set')
    }

    await client.query(
      `UPDATE public.oauth_states
          SET consumed_at = CURRENT_TIMESTAMP,
              updated_at = CURRENT_TIMESTAMP
        WHERE id = $1`,
      [selectionId],
    )

    return {
      platform: targetPlatform,
      page: selected,
      userToken: decryptSecret(userTokenEncrypted),
      userTokenExpiresAt,
      agency_id: row.agency_id,
      agent_id: row.agent_id,
    }
  })
}
