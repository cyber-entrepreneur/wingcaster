/**
 * OAuth token exchange — authorization_code + refresh_token grants.
 */
import { getProvider } from './provider-registry.js'
import { resolveAppCredential } from './app-credentials.js'
import { refreshLongLivedToken } from './meta-graph.js'

export class OAuthTokenError extends Error {
  constructor(code, message, { status = 502 } = {}) {
    super(message)
    this.code = code
    this.status = status
    this.name = 'OAuthTokenError'
  }
}

function sanitizeProviderError(parsed, status) {
  const raw = parsed?.error_description || parsed?.error || parsed?.message
  if (typeof raw === 'string' && raw.length > 0) {
    return raw.replace(/client_secret|refresh_token|access_token/gi, '[redacted]')
  }
  return `Token request failed (HTTP ${status})`
}

function normalizeTokenResponse(parsed, providerConfig) {
  const expiresAt = parsed.expires_in
    ? new Date(Date.now() + Number(parsed.expires_in) * 1000).toISOString()
    : null

  return {
    access_token: parsed.access_token,
    refresh_token: parsed.refresh_token || null,
    expires_at: expiresAt,
    scope: parsed.scope || providerConfig.scopes.join(providerConfig.authUrl.includes('tiktok') ? ',' : ' '),
    open_id: parsed.open_id || null,
    user_id: parsed.user_id || parsed.open_id || null,
    token_type: parsed.token_type || 'bearer',
  }
}

/**
 * @param {{
 *   provider: string,
 *   code: string,
 *   codeVerifier?: string|null,
 *   redirectUri: string,
 *   env?: Record<string, string|undefined>,
 *   region?: string|null,
 *   agencyId?: string|null,
 *   fetch?: typeof fetch,
 * }} params
 */
export async function exchangeCode({
  provider,
  code,
  codeVerifier = null,
  redirectUri,
  env = process.env,
  region = null,
  agencyId = null,
  fetch: fetchFn = fetch,
}) {
  const providerConfig = getProvider(provider)
  const creds = resolveAppCredential(provider, { env, region, agencyId })

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code: String(code),
    redirect_uri: redirectUri,
  })

  const headers = { 'Content-Type': 'application/x-www-form-urlencoded' }

  if (provider === 'x') {
    body.set('client_id', creds.client_id)
    if (codeVerifier) body.set('code_verifier', codeVerifier)
    if (creds.client_secret) {
      const basic = Buffer.from(`${creds.client_id}:${creds.client_secret}`).toString('base64')
      headers.Authorization = `Basic ${basic}`
    }
  } else if (provider === 'tiktok') {
    body.set('client_key', creds.client_id)
    body.set('client_secret', creds.client_secret)
    if (codeVerifier) body.set('code_verifier', codeVerifier)
  } else {
    body.set('client_id', creds.client_id)
    if (creds.client_secret) body.set('client_secret', creds.client_secret)
    if (codeVerifier) body.set('code_verifier', codeVerifier)
  }

  const res = await fetchFn(providerConfig.tokenUrl, { method: 'POST', headers, body })
  const parsed = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new OAuthTokenError(
      parsed?.error || 'exchange_failed',
      sanitizeProviderError(parsed, res.status),
      { status: 502 },
    )
  }

  return normalizeTokenResponse(parsed, providerConfig)
}

/**
 * @param {{
 *   provider: string,
 *   refreshToken: string,
 *   env?: Record<string, string|undefined>,
 *   region?: string|null,
 *   agencyId?: string|null,
 *   fetch?: typeof fetch,
 * }} params
 */
export async function refreshToken({
  provider,
  refreshToken: refreshTokenValue,
  env = process.env,
  region = null,
  agencyId = null,
  fetch: fetchFn = fetch,
}) {
  const providerConfig = getProvider(provider)
  if (!providerConfig.supportsRefresh) {
    throw new OAuthTokenError('refresh_unsupported', 'Provider does not support refresh tokens')
  }

  const creds = resolveAppCredential(provider, { env, region, agencyId })

  // Meta long-lived tokens are re-exchanged via fb_exchange_token (no refresh_token grant).
  if (providerConfig.tokenStyle === 'meta_longlived') {
    try {
      const refreshed = await refreshLongLivedToken(refreshTokenValue, {
        clientId: creds.client_id,
        clientSecret: creds.client_secret,
        fetch: fetchFn,
      })
      return {
        access_token: refreshed.access_token,
        refresh_token: refreshed.access_token,
        expires_at: refreshed.expires_at,
        scope: providerConfig.scopes.join(' '),
        token_type: refreshed.token_type,
      }
    } catch (err) {
      throw new OAuthTokenError(
        'meta_refresh_failed',
        err instanceof Error ? err.message : 'Meta token re-exchange failed',
        { status: 502 },
      )
    }
  }

  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshTokenValue,
  })

  const headers = { 'Content-Type': 'application/x-www-form-urlencoded' }

  if (provider === 'x') {
    body.set('client_id', creds.client_id)
    if (creds.client_secret) {
      const basic = Buffer.from(`${creds.client_id}:${creds.client_secret}`).toString('base64')
      headers.Authorization = `Basic ${basic}`
    }
  } else if (provider === 'tiktok') {
    body.set('client_key', creds.client_id)
    body.set('client_secret', creds.client_secret)
  } else {
    body.set('client_id', creds.client_id)
    if (creds.client_secret) body.set('client_secret', creds.client_secret)
  }

  const res = await fetchFn(providerConfig.tokenUrl, { method: 'POST', headers, body })
  const parsed = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new OAuthTokenError(
      parsed?.error || 'refresh_failed',
      sanitizeProviderError(parsed, res.status),
      { status: 502 },
    )
  }

  const tokenSet = normalizeTokenResponse(parsed, providerConfig)
  if (!tokenSet.refresh_token) {
    tokenSet.refresh_token = refreshTokenValue
  }
  return tokenSet
}
