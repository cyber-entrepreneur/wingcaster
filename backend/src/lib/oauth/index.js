/**
 * Shared OAuth module — public surface for channel connect flows.
 */
import { resolveAppCredential } from './app-credentials.js'
import { createPkcePair } from './pkce.js'
import { getProvider, isOAuthProvider } from './provider-registry.js'
import { create as createOAuthState, consumeOnce, OAuthStateError } from './state-store.js'
import { exchangeCode, OAuthTokenError } from './token-exchange.js'
import { getFreshAccessToken, upsertOAuthConnection } from './token-store.js'

export { OAuthStateError, OAuthTokenError }
export { getFreshAccessToken }
export { resolveAppCredential }
export { isOAuthProvider, getProvider }

function buildRedirectUri(apiBase, redirectPath) {
  const base = String(apiBase || '').replace(/\/$/, '')
  const path = redirectPath.startsWith('/') ? redirectPath : `/${redirectPath}`
  return `${base}${path}`
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
}) {
  const providerConfig = getProvider(provider)
  const creds = resolveAppCredential(provider, {
    env,
    region,
    agencyId,
    apiBase: apiBase || redirectUri.replace(providerConfig.redirectPath, ''),
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
  if (!isOAuthProvider(platform)) {
    throw new Error(`${platform} is not an OAuth platform`)
  }

  const providerConfig = getProvider(platform)
  const redirectUri = buildRedirectUri(apiBase, providerConfig.redirectPath)
  const creds = resolveAppCredential(platform, { env, region, agencyId, apiBase })

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
    provider: platform,
    state: stateRow.id,
    redirectUri,
    apiBase,
    codeChallenge: pkce?.codeChallenge || null,
    codeChallengeMethod: pkce?.codeChallengeMethod || 'S256',
    env,
    region,
    agencyId,
  })

  return { auth_url, state: stateRow.id, dev: false }
}

function renderCallbackHtml(platform) {
  return `<!doctype html><html><body style="font-family:system-ui;padding:2rem;text-align:center;">
<h2>Connected to ${platform}</h2>
<p>You can close this window and return to Wingcaster.</p>
<script>try { window.opener && window.opener.postMessage({ type: 'wingcaster:oauth:done', platform: '${platform}' }, '*'); } catch(e){}
setTimeout(() => { window.close() }, 800)</script>
</body></html>`
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
  fetch: fetchFn = fetch,
}) {
  if (!isOAuthProvider(platform)) {
    return { status: 400, body: 'Unsupported platform' }
  }

  const creds = resolveAppCredential(platform, { env, region, agencyId: null, apiBase })
  if (creds.dev || code === 'dev_ok') {
    return { status: 503, body: `${platform} OAuth requires production credentials to be configured` }
  }

  let stateRow
  try {
    stateRow = await consumeOnce(state, { platform, agencyId: null })
  } catch (err) {
    if (err instanceof OAuthStateError) {
      return { status: 400, body: err.message }
    }
    throw err
  }

  const providerConfig = getProvider(platform)
  const redirectUri = stateRow.redirect_uri || buildRedirectUri(apiBase, providerConfig.redirectPath)

  let tokenSet
  try {
    tokenSet = await exchangeCode({
      provider: platform,
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

  let userInfo = { id: tokenSet.user_id || tokenSet.open_id || null, handle: null }
  try {
    userInfo = await providerConfig.resolveIdentity(tokenSet, { fetch: fetchFn })
  } catch {
    // Identity lookup is best-effort; tokens are still persisted.
  }

  const accountName = userInfo.handle || `${platform} account`
  const connectionId = await upsertOAuthConnection({
    agentId: stateRow.agent_id,
    agencyId: stateRow.agency_id,
    platform,
    accountName,
    handle: userInfo.handle || accountName,
    tokenSet: { ...tokenSet, user_id: userInfo.id || tokenSet.user_id },
    capabilities,
  })

  return {
    status: 200,
    html: renderCallbackHtml(platform),
    agentId: stateRow.agent_id,
    agencyId: stateRow.agency_id,
    connectionId,
    elevated: stateRow.elevated,
  }
}
