import { API_BASE, setAuthToken } from '@/api/client'
import type { TwoFactorRequired } from '@/types/twoFactor'

export type IdentifierType = 'email' | 'username' | 'phone'
export type OAuthProvider = 'google' | 'apple' | 'facebook'

export type LoginApiResult =
  | { status: 'signed_in'; token: string; agent?: unknown }
  | TwoFactorRequired

export class LoginApiError extends Error {
  status?: number
  code?: string
  retryAfterSeconds?: number
  lockedMinutes?: number

  constructor(
    message: string,
    opts?: { status?: number; code?: string; retryAfterSeconds?: number; lockedMinutes?: number },
  ) {
    super(message)
    this.name = 'LoginApiError'
    this.status = opts?.status
    this.code = opts?.code
    this.retryAfterSeconds = opts?.retryAfterSeconds
    this.lockedMinutes = opts?.lockedMinutes
  }
}

async function parseJson(res: Response): Promise<Record<string, unknown> | null> {
  const text = await res.text()
  if (!text) return null
  try {
    return JSON.parse(text) as Record<string, unknown>
  } catch {
    return null
  }
}

/**
 * POST /api/auth/login with identifier_type.
 * Bridges current backend (email + password) by also sending `email` when type is email.
 */
export async function postAuthLogin(input: {
  identifier: string
  identifier_type: IdentifierType
  password: string
  remember_me: boolean
}): Promise<LoginApiResult> {
  const payload: Record<string, unknown> = {
    identifier: input.identifier,
    identifier_type: input.identifier_type,
    password: input.password,
    remember_me: input.remember_me,
  }
  // Existing loginSchema requires `email` until identifier_type lands server-side.
  if (input.identifier_type === 'email') {
    payload.email = input.identifier
  }

  let res: Response
  try {
    res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
  } catch {
    throw new LoginApiError('network', { code: 'network' })
  }

  const body = await parseJson(res)

  if (!res.ok) {
    const retryAfterHeader = res.headers.get('Retry-After')
    const retryAfterSeconds =
      Number(body?.retry_after ?? body?.retryAfter ?? retryAfterHeader) || undefined
    const lockedMinutes = Number(body?.locked_minutes ?? body?.lockedMinutes) || undefined
    const errCode = String(body?.error || body?.code || '')
    if (res.status === 429 || errCode === 'rate_limited') {
      throw new LoginApiError('rate', {
        status: res.status,
        code: 'rate',
        retryAfterSeconds: retryAfterSeconds ?? 15,
      })
    }
    if (res.status === 423 || errCode === 'locked') {
      throw new LoginApiError('locked', {
        status: res.status,
        code: 'locked',
        lockedMinutes: lockedMinutes ?? 15,
      })
    }
    throw new LoginApiError('invalid', { status: res.status, code: 'invalid' })
  }

  if (body?.status === '2fa_required') {
    return {
      status: '2fa_required',
      challenge_id: String(body.challenge_id),
      method: (body.method as TwoFactorRequired['method']) || 'totp',
    }
  }

  const token = typeof body?.token === 'string' ? body.token : ''
  if (!token) throw new LoginApiError('invalid', { code: 'invalid' })
  return { status: 'signed_in', token, agent: body?.agent }
}

export async function adoptLoginToken(token: string): Promise<void> {
  setAuthToken(token)
}

/**
 * POST /api/auth/oauth/:provider/start — opens authorize URL in popup or same tab.
 * Backend route is Wave 0 work; failures surface as oauth errors.
 */
export async function startOAuth(provider: OAuthProvider): Promise<void> {
  let res: Response
  try {
    res = await fetch(`${API_BASE}/auth/oauth/${provider}/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider }),
    })
  } catch {
    throw new LoginApiError('oauth', { code: `oauth.${provider}` })
  }

  const body = await parseJson(res)
  if (!res.ok) {
    throw new LoginApiError('oauth', { status: res.status, code: `oauth.${provider}` })
  }

  const url = typeof body?.url === 'string' ? body.url : typeof body?.authorize_url === 'string' ? body.authorize_url : null
  if (!url) {
    throw new LoginApiError('oauth', { code: `oauth.${provider}` })
  }

  const popup = window.open(url, `wc-oauth-${provider}`, 'popup,width=480,height=720')
  if (!popup) {
    window.location.assign(url)
  }
}
