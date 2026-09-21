/**
 * Meta Graph API helpers for OAuth connect flows.
 * All calls include appsecret_proof (HMAC-SHA256 of token with app secret).
 */
import { createHmac } from 'node:crypto'

export const META_GRAPH_VERSION = 'v21.0'
export const META_AUTH_URL = `https://www.facebook.com/${META_GRAPH_VERSION}/dialog/oauth`
export const META_TOKEN_URL = `https://graph.facebook.com/${META_GRAPH_VERSION}/oauth/access_token`
export const META_GRAPH_BASE = `https://graph.facebook.com/${META_GRAPH_VERSION}`

/**
 * HMAC-SHA256(access_token, app_secret) — required on server-side Graph calls.
 */
export function buildAppSecretProof(accessToken, appSecret) {
  return createHmac('sha256', appSecret).update(accessToken).digest('hex')
}

function graphParams(accessToken, appSecret, extra = {}) {
  const params = new URLSearchParams()
  params.set('access_token', accessToken)
  if (appSecret) {
    params.set('appsecret_proof', buildAppSecretProof(accessToken, appSecret))
  }
  for (const [key, value] of Object.entries(extra)) {
    if (value != null) params.set(key, String(value))
  }
  return params
}

async function graphGet(path, accessToken, appSecret, { fetch: fetchFn = fetch, fields = null } = {}) {
  const url = new URL(`${META_GRAPH_BASE}${path}`)
  const extra = fields ? { fields } : {}
  const params = graphParams(accessToken, appSecret, extra)
  for (const [key, value] of params.entries()) {
    url.searchParams.set(key, value)
  }
  const res = await fetchFn(url.toString())
  const parsed = await res.json().catch(() => ({}))
  if (!res.ok || parsed?.error) {
    const message = parsed?.error?.message || `Graph request failed: ${res.status}`
    throw new Error(message)
  }
  return parsed
}

/**
 * Exchange a short-lived user token for a long-lived token (~60 days).
 */
export async function exchangeLongLivedToken(shortLivedToken, { clientId, clientSecret, fetch: fetchFn = fetch } = {}) {
  const url = new URL(META_TOKEN_URL)
  url.searchParams.set('grant_type', 'fb_exchange_token')
  url.searchParams.set('client_id', clientId)
  url.searchParams.set('client_secret', clientSecret)
  url.searchParams.set('fb_exchange_token', shortLivedToken)

  const res = await fetchFn(url.toString())
  const parsed = await res.json().catch(() => ({}))
  if (!res.ok || parsed?.error || !parsed.access_token) {
    const message = parsed?.error?.message || parsed?.error || `Long-lived exchange failed: ${res.status}`
    throw new Error(message)
  }

  const expiresAt = parsed.expires_in
    ? new Date(Date.now() + Number(parsed.expires_in) * 1000).toISOString()
    : null

  return {
    access_token: parsed.access_token,
    expires_at: expiresAt,
    token_type: parsed.token_type || 'bearer',
  }
}

/**
 * Re-exchange an existing long-lived user token before expiry.
 */
export async function refreshLongLivedToken(currentToken, { clientId, clientSecret, fetch: fetchFn = fetch } = {}) {
  return exchangeLongLivedToken(currentToken, { clientId, clientSecret, fetch: fetchFn })
}

/**
 * List Facebook Pages the user can manage.
 * @returns {Promise<Array<{ id: string, name: string, access_token: string }>>}
 */
export async function fetchManagedPages(userToken, appSecret, { fetch: fetchFn = fetch } = {}) {
  const parsed = await graphGet('/me/accounts', userToken, appSecret, { fetch: fetchFn })
  const pages = Array.isArray(parsed?.data) ? parsed.data : []
  return pages
    .filter((page) => page?.id && page?.access_token)
    .map((page) => ({
      id: String(page.id),
      name: String(page.name || page.id),
      access_token: String(page.access_token),
    }))
}

/**
 * Fetch the linked Instagram Business account for a Facebook Page.
 */
export async function fetchInstagramBusinessAccount(pageId, pageToken, appSecret, { fetch: fetchFn = fetch } = {}) {
  const url = new URL(`${META_GRAPH_BASE}/${pageId}`)
  const params = graphParams(pageToken, appSecret, { fields: 'instagram_business_account' })
  for (const [key, value] of params.entries()) {
    url.searchParams.set(key, value)
  }
  const res = await fetchFn(url.toString())
  const body = await res.json().catch(() => ({}))
  if (!res.ok || body?.error) {
    return null
  }
  const igId = body?.instagram_business_account?.id
  return igId ? String(igId) : null
}

/**
 * List WhatsApp Business Accounts and phone numbers accessible to the OAuth user.
 * Used after Meta Embedded Signup authorization.
 *
 * @returns {Promise<Array<{
 *   waba_id: string,
 *   waba_name: string,
 *   phone_number_id: string,
 *   display_phone_number: string,
 *   verified_name: string|null,
 * }>>}
 */
export async function fetchWhatsAppBusinessAccounts(userToken, appSecret, { fetch: fetchFn = fetch } = {}) {
  const businesses = await graphGet('/me/businesses', userToken, appSecret, { fetch: fetchFn })
  const businessList = Array.isArray(businesses?.data) ? businesses.data : []

  const wabaMap = new Map()

  for (const business of businessList) {
    if (!business?.id) continue
    const businessId = String(business.id)
    const businessName = String(business.name || businessId)

    for (const edge of ['owned_whatsapp_business_accounts', 'client_whatsapp_business_accounts']) {
      try {
        const parsed = await graphGet(
          `/${businessId}/${edge}`,
          userToken,
          appSecret,
          { fetch: fetchFn, fields: 'id,name' },
        )
        const wabas = Array.isArray(parsed?.data) ? parsed.data : []
        for (const waba of wabas) {
          if (!waba?.id) continue
          const wabaId = String(waba.id)
          if (!wabaMap.has(wabaId)) {
            wabaMap.set(wabaId, {
              id: wabaId,
              name: String(waba.name || businessName),
            })
          }
        }
      } catch {
        // Some businesses may not expose WABA edges — continue.
      }
    }
  }

  const accounts = []
  for (const waba of wabaMap.values()) {
    try {
      const phones = await graphGet(
        `/${waba.id}/phone_numbers`,
        userToken,
        appSecret,
        { fetch: fetchFn, fields: 'id,display_phone_number,verified_name' },
      )
      const phoneList = Array.isArray(phones?.data) ? phones.data : []
      for (const phone of phoneList) {
        if (!phone?.id) continue
        accounts.push({
          waba_id: waba.id,
          waba_name: waba.name,
          phone_number_id: String(phone.id),
          display_phone_number: String(phone.display_phone_number || phone.id),
          verified_name: phone.verified_name ? String(phone.verified_name) : null,
        })
      }
    } catch {
      // Skip WABAs without readable phone numbers.
    }
  }

  return accounts
}
