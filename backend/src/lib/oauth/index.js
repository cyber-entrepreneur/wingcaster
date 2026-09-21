/**
 * Shared OAuth module — public surface for channel connect flows.
 */
import { resolveAppCredential } from './app-credentials.js'
import { createPkcePair } from './pkce.js'
import {
  getProvider,
  isOAuthProvider,
  resolveOAuthProvider,
} from './provider-registry.js'
import { create as createOAuthState, consumeOnce, OAuthStateError } from './state-store.js'
import { exchangeCode, OAuthTokenError } from './token-exchange.js'
import {
  getFreshAccessToken,
  upsertOAuthConnection,
  upsertMetaOAuthConnection,
  upsertWhatsAppOAuthConnection,
} from './token-store.js'
import {
  assertMetaOAuthEnabled,
  isMetaOAuthPlatform,
  isOAuthCapablePlatform,
} from './meta-oauth.js'
import { isLinkedInOAuthEnabled } from './feature-flags.js'
import {
  assertWhatsAppOAuthEnabled,
  isWhatsAppOAuthPlatform,
} from './meta-whatsapp.js'
import {
  consumePageSelection,
  createPageSelection,
  MetaPageSelectionError,
  sanitizePagesForPicker,
} from './meta-page-selection.js'
import {
  consumeWhatsAppSelection,
  createWhatsAppSelection,
  MetaWhatsAppSelectionError,
  sanitizeWhatsAppAccountsForPicker,
} from './meta-whatsapp-signup.js'

export { OAuthStateError, OAuthTokenError, MetaPageSelectionError, MetaWhatsAppSelectionError }
export { getFreshAccessToken }
export { resolveAppCredential }
export { isOAuthProvider, getProvider, resolveOAuthProvider, isOAuthCapablePlatform }
export { isMetaOAuthPlatform, isMetaOAuthConnectEnabled } from './meta-oauth.js'
export { isLinkedInOAuthEnabled, isOAuthConnectEnabled } from './feature-flags.js'
export { isWhatsAppOAuthPlatform, isWhatsAppOAuthConnectEnabled } from './meta-whatsapp.js'

function buildRedirectUri(apiBase, redirectPath) {
  const base = String(apiBase || '').replace(/\/$/, '')
  const path = redirectPath.startsWith('/') ? redirectPath : `/${redirectPath}`
  return `${base}${path}`
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/**
 * Build provider authorize URL with PKCE (when required).
 */
export function buildAuthorizeUrl({
  provider,
  state,
  redirectUri,
  apiBase = null,
  codeChallenge = null,
  codeChallengeMethod = 'S256',
  env = process.env,
  region = null,
  agencyId = null,
  platform = null,
}) {
  const providerConfig = getProvider(provider)
  const creds = resolveAppCredential(provider, {
    env,
    region,
    agencyId,
    apiBase: apiBase || redirectUri.replace(providerConfig.redirectPath, ''),
    platform,
  })

  const authUrl = new URL(providerConfig.authUrl)
  authUrl.searchParams.set('response_type', 'code')
  authUrl.searchParams.set('client_id', creds.client_id)
  authUrl.searchParams.set('redirect_uri', redirectUri)
  authUrl.searchParams.set('scope', creds.scopes.join(provider === 'tiktok' ? ',' : ' '))
  authUrl.searchParams.set('state', state)

  if (providerConfig.usesPKCE && codeChallenge) {
    authUrl.searchParams.set('code_challenge', codeChallenge)
    authUrl.searchParams.set('code_challenge_method', codeChallengeMethod)
  }

  for (const [key, value] of Object.entries(providerConfig.authExtraParams || {})) {
    authUrl.searchParams.set(key, value)
  }

  if (provider === 'tiktok') {
    authUrl.searchParams.set('client_key', creds.client_id)
  }

  return authUrl.toString()
}

/**
 * Start an OAuth connect flow — mint state + PKCE, return authorize URL.
 */
export async function startConnect({
  agentId,
  agencyId = null,
  platform,
  apiBase,
  returnTo = null,
  elevated = false,
  env = process.env,
  region = null,
}) {
  if (!isOAuthCapablePlatform(platform, env)) {
    throw new Error(`${platform} is not an OAuth platform`)
  }

  if (isWhatsAppOAuthPlatform(platform)) {
    assertWhatsAppOAuthEnabled(env)
  } else if (isMetaOAuthPlatform(platform)) {
    assertMetaOAuthEnabled(env)
  }

  if (platform === 'linkedin' && !isLinkedInOAuthEnabled(env)) {
    throw new Error('LinkedIn OAuth connect is not enabled in this environment')
  }

  const oauthProvider = resolveOAuthProvider(platform)
  const providerConfig = getProvider(oauthProvider)
  const redirectUri = buildRedirectUri(apiBase, providerConfig.redirectPath)
  const creds = resolveAppCredential(oauthProvider, { env, region, agencyId, apiBase, platform })

  let pkce = null
  if (providerConfig.usesPKCE) {
    pkce = createPkcePair()
  }

  const stateRow = await createOAuthState({
    agentId,
    agencyId,
    platform,
    codeVerifier: pkce?.codeVerifier || null,
    redirectUri,
    returnTo,
    elevated,
  })

  if (creds.dev) {
    const devUrl = `${redirectUri}?code=dev_ok&state=${stateRow.id}`
    return { auth_url: devUrl, state: stateRow.id, dev: true }
  }

  const auth_url = buildAuthorizeUrl({
    provider: oauthProvider,
    state: stateRow.id,
    redirectUri,
    apiBase,
    codeChallenge: pkce?.codeChallenge || null,
    codeChallengeMethod: pkce?.codeChallengeMethod || 'S256',
    env,
    region,
    agencyId,
    platform,
  })

  return { auth_url, state: stateRow.id, dev: false }
}

function renderCallbackHtml(platform, extraScript = '') {
  const safePlatform = escapeHtml(platform)
  return `<!doctype html><html><body style="font-family:system-ui;padding:2rem;text-align:center;">
<h2>Connected to ${safePlatform}</h2>
<p>You can close this window and return to Wingcaster.</p>
<script>${extraScript}try { window.opener && window.opener.postMessage({ type: 'wingcaster:oauth:done', platform: '${safePlatform}' }, '*'); } catch(e){}
setTimeout(() => { window.close() }, 800)</script>
</body></html>`
}

function renderPagePickerHtml(platform, selectionId, pages) {
  const safePlatform = escapeHtml(platform)
  const safeSelectionId = escapeHtml(selectionId)
  const pagesJson = JSON.stringify(sanitizePagesForPicker(pages))
  return `<!doctype html><html><body style="font-family:system-ui;padding:2rem;text-align:center;">
<h2>Select a Facebook Page</h2>
<p>Choose which Page to connect for ${safePlatform}.</p>
<script>try { window.opener && window.opener.postMessage({ type: 'wingcaster:oauth:pages', platform: '${safePlatform}', selection_id: '${safeSelectionId}', pages: ${pagesJson} }, '*'); } catch(e){}
setTimeout(() => { window.close() }, 800)</script>
</body></html>`
}

function renderWhatsAppPickerHtml(selectionId, accounts) {
  const safeSelectionId = escapeHtml(selectionId)
  const accountsJson = JSON.stringify(sanitizeWhatsAppAccountsForPicker(accounts))
  return `<!doctype html><html><body style="font-family:system-ui;padding:2rem;text-align:center;">
<h2>Select a WhatsApp Business number</h2>
<p>Choose which phone number to connect.</p>
<script>try { window.opener && window.opener.postMessage({ type: 'wingcaster:oauth:whatsapp', platform: 'whatsapp', selection_id: '${safeSelectionId}', accounts: ${accountsJson} }, '*'); } catch(e){}
setTimeout(() => { window.close() }, 800)</script>
</body></html>`
}

async function completeMetaConnection({
  platform,
  page,
  userToken,
  userTokenExpiresAt,
  scope,
  stateRow,
  capabilities,
}) {
  const { connectionId, isNewConnection } = await upsertMetaOAuthConnection({
    agentId: stateRow.agent_id,
    agencyId: stateRow.agency_id,
    platform,
    page,
    userToken,
    userTokenExpiresAt,
    scope,
    capabilities,
  })

  return {
    status: 200,
    html: renderCallbackHtml(platform),
    agentId: stateRow.agent_id,
    agencyId: stateRow.agency_id,
    connectionId,
    isNewConnection,
    elevated: stateRow.elevated,
  }
}

async function completeWhatsAppConnection({
  account,
  userToken,
  userTokenExpiresAt,
  scope,
  stateRow,
  capabilities,
}) {
  const { connectionId, isNewConnection } = await upsertWhatsAppOAuthConnection({
    agentId: stateRow.agent_id,
    agencyId: stateRow.agency_id,
    account,
    userToken,
    userTokenExpiresAt,
    scope,
    capabilities,
  })

  return {
    status: 200,
    html: renderCallbackHtml('whatsapp'),
    agentId: stateRow.agent_id,
    agencyId: stateRow.agency_id,
    connectionId,
    isNewConnection,
    platform: 'whatsapp',
    whatsappPhoneNumber: account.display_phone_number,
    elevated: stateRow.elevated,
  }
}

/**
 * Handle OAuth callback — consume state, exchange code, persist tokens.
 */
export async function handleCallback({
  platform,
  code,
  state,
  apiBase,
  env = process.env,
  region = null,
  capabilities = {},
  capabilitiesByPlatform = {},
  fetch: fetchFn = fetch,
}) {
  const isMetaCallback = platform === 'meta'
  const oauthProvider = isMetaCallback ? 'meta' : resolveOAuthProvider(platform)

  if (!isOAuthProvider(oauthProvider)) {
    return { status: 400, body: 'Unsupported platform' }
  }

  let stateRow
  let targetPlatform = platform
  try {
    if (isMetaCallback) {
      const { findOne } = await import('../../persistence/index.js')
      const pending = await findOne('oauth_states', (s) => s.id === state)
      if (!pending || pending.consumed_at) {
        return { status: 400, body: 'Invalid or expired state' }
      }
      targetPlatform = pending.platform
      if (!isMetaOAuthPlatform(targetPlatform) && !isWhatsAppOAuthPlatform(targetPlatform)) {
        return { status: 400, body: 'Invalid or expired state' }
      }
      stateRow = await consumeOnce(state, { platform: targetPlatform, agencyId: null })
      platform = targetPlatform
    } else {
      stateRow = await consumeOnce(state, { platform, agencyId: null })
    }
  } catch (err) {
    if (err instanceof OAuthStateError) {
      return { status: 400, body: err.message }
    }
    throw err
  }

  const creds = resolveAppCredential(oauthProvider, {
    env,
    region,
    agencyId: stateRow.agency_id,
    apiBase,
    platform: oauthProvider === 'meta' ? platform : null,
  })
  if (creds.dev || code === 'dev_ok') {
    const label = isMetaCallback ? 'Meta' : platform
    return { status: 503, body: `${label} OAuth requires production credentials to be configured` }
  }

  const providerConfig = getProvider(oauthProvider)
  const redirectUri = stateRow.redirect_uri || buildRedirectUri(apiBase, providerConfig.redirectPath)

  let tokenSet
  try {
    tokenSet = await exchangeCode({
      provider: oauthProvider,
      code,
      codeVerifier: stateRow.code_verifier,
      redirectUri,
      env,
      region,
      agencyId: stateRow.agency_id,
      fetch: fetchFn,
    })
  } catch (err) {
    if (err instanceof OAuthTokenError) {
      return { status: err.status, body: `Token exchange failed: ${err.message}` }
    }
    return { status: 502, body: 'OAuth token exchange failed' }
  }

  if (oauthProvider === 'meta') {
    try {
      const identity = await providerConfig.resolveIdentity(tokenSet, {
        fetch: fetchFn,
        clientId: creds.client_id,
        clientSecret: creds.client_secret,
        platform,
      })

      const platformCapabilities = capabilitiesByPlatform[platform] || capabilities
      const scope = creds.scopes.join(' ')

      if (platform === 'whatsapp') {
        const { accounts, userToken, userTokenExpiresAt } = identity.meta
        if (!accounts?.length) {
          return { status: 400, body: 'No WhatsApp Business phone numbers were found for this account' }
        }

        if (accounts.length === 1) {
          return completeWhatsAppConnection({
            account: accounts[0],
            userToken,
            userTokenExpiresAt,
            scope,
            stateRow,
            capabilities: platformCapabilities,
          })
        }

        const selection = await createWhatsAppSelection({
          agentId: stateRow.agent_id,
          agencyId: stateRow.agency_id,
          accounts,
          userToken,
          userTokenExpiresAt,
        })

        return {
          status: 200,
          html: renderWhatsAppPickerHtml(selection.id, accounts),
          agentId: stateRow.agent_id,
          agencyId: stateRow.agency_id,
          pendingWhatsAppSelection: true,
          selectionId: selection.id,
          accounts: sanitizeWhatsAppAccountsForPicker(accounts),
          elevated: stateRow.elevated,
        }
      }

      const { pages, userToken, userTokenExpiresAt } = identity.meta
      if (!pages?.length) {
        return { status: 400, body: 'No Facebook Pages were found for this account' }
      }

      if (pages.length === 1) {
        return completeMetaConnection({
          platform,
          page: pages[0],
          userToken,
          userTokenExpiresAt,
          scope,
          stateRow,
          capabilities: platformCapabilities,
        })
      }

      const selection = await createPageSelection({
        agentId: stateRow.agent_id,
        agencyId: stateRow.agency_id,
        platform,
        pages,
        userToken,
        userTokenExpiresAt,
      })

      return {
        status: 200,
        html: renderPagePickerHtml(platform, selection.id, pages),
        agentId: stateRow.agent_id,
        agencyId: stateRow.agency_id,
        pendingPageSelection: true,
        selectionId: selection.id,
        pages: sanitizePagesForPicker(pages),
        elevated: stateRow.elevated,
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Meta identity resolution failed'
      return { status: 502, body: message }
    }
  }

  let userInfo = {
    id: tokenSet.user_id || tokenSet.open_id || null,
    handle: null,
    authors: [],
    li_author_urn: null,
  }
  try {
    userInfo = await providerConfig.resolveIdentity(tokenSet, { fetch: fetchFn })
  } catch {
    // Identity lookup is best-effort; tokens are still persisted.
  }

  const enterpriseTargets = {}
  const settingsExtras = {}
  if (oauthProvider === 'linkedin') {
    if (userInfo.li_author_urn) {
      enterpriseTargets.li_author_urn = userInfo.li_author_urn
    } else if (userInfo.authors?.length > 1) {
      settingsExtras.pending_author_identities = userInfo.authors
    } else if (userInfo.authors?.length === 1) {
      enterpriseTargets.li_author_urn = userInfo.authors[0].urn
    } else if (userInfo.id && String(userInfo.id).startsWith('urn:li:')) {
      enterpriseTargets.li_author_urn = userInfo.id
    }
  }

  const accountName = userInfo.handle || `${platform} account`
  if (!stateRow.agency_id) {
    return { status: 400, body: 'OAuth state missing tenant context' }
  }

  const connectionId = await upsertOAuthConnection({
    agentId: stateRow.agent_id,
    agencyId: stateRow.agency_id,
    platform,
    accountName,
    handle: userInfo.handle || accountName,
    tokenSet: { ...tokenSet, user_id: userInfo.id || tokenSet.user_id },
    capabilities,
    enterpriseTargets,
    settingsExtras,
  })

  return {
    status: 200,
    html: renderCallbackHtml(platform),
    agentId: stateRow.agent_id,
    agencyId: stateRow.agency_id,
    connectionId,
    elevated: Boolean(stateRow.elevated),
  }
}

/**
 * Complete a Meta OAuth flow after the user picks a Page from the candidate set.
 */
export async function completeMetaPageSelection({
  selectionId,
  pageId,
  agentId,
  agencyId = null,
  capabilities = {},
  capabilitiesByPlatform = {},
  env = process.env,
}) {
  assertMetaOAuthEnabled(env)

  let selection
  try {
    selection = await consumePageSelection(selectionId, pageId, agentId)
  } catch (err) {
    if (err instanceof MetaPageSelectionError) {
      return { status: 400, error: err.message }
    }
    throw err
  }

  if (agencyId && selection.agency_id && selection.agency_id !== agencyId) {
    return { status: 403, error: 'Agency mismatch' }
  }

  const creds = resolveAppCredential('meta', { env })
  const platformCapabilities = capabilitiesByPlatform[selection.platform] || capabilities
  const { connectionId, isNewConnection } = await upsertMetaOAuthConnection({
    agentId: selection.agent_id,
    agencyId: selection.agency_id,
    platform: selection.platform,
    page: selection.page,
    userToken: selection.userToken,
    userTokenExpiresAt: selection.userTokenExpiresAt,
    scope: creds.scopes.join(' '),
    capabilities: platformCapabilities,
  })

  return {
    status: 200,
    connectionId,
    isNewConnection,
    platform: selection.platform,
  }
}

/**
 * Complete a WhatsApp Embedded Signup flow after the user picks a phone number.
 */
export async function completeWhatsAppAccountSelection({
  selectionId,
  phoneNumberId,
  agentId,
  agencyId = null,
  capabilities = {},
  env = process.env,
}) {
  assertWhatsAppOAuthEnabled(env)

  let selection
  try {
    selection = await consumeWhatsAppSelection(selectionId, phoneNumberId, agentId)
  } catch (err) {
    if (err instanceof MetaWhatsAppSelectionError) {
      return { status: 400, error: err.message }
    }
    throw err
  }

  if (agencyId && selection.agency_id && selection.agency_id !== agencyId) {
    return { status: 403, error: 'Agency mismatch' }
  }

  const creds = resolveAppCredential('meta', { env, platform: 'whatsapp' })
  const { connectionId, isNewConnection } = await upsertWhatsAppOAuthConnection({
    agentId: selection.agent_id,
    agencyId: selection.agency_id,
    account: selection.account,
    userToken: selection.userToken,
    userTokenExpiresAt: selection.userTokenExpiresAt,
    scope: creds.scopes.join(' '),
    capabilities,
  })

  return {
    status: 200,
    connectionId,
    isNewConnection,
    platform: 'whatsapp',
    whatsappPhoneNumber: selection.account.display_phone_number,
  }
}
