import { API_BASE, setAuthToken } from '@/api/client'
import type { IdentityIdentifierType } from '@/components/forms/IdentityForm'
import type { LegalEntity, PrimaryMarket, RegistrationPath } from './registerCopy'
import type { OAuthProvider } from './loginApi'

export type RegisterIdentityType = OAuthProvider | IdentityIdentifierType

export type RegisterRequestBody = {
  path: RegistrationPath
  identity: {
    type: RegisterIdentityType
    identifier: string
    credentials: { password: string } | { oauth_token: string }
  }
  recovery?: {
    email?: string
    phone?: string
  }
  consents: {
    terms: boolean
    marketing: boolean
  }
  path_data:
    | Record<string, never>
    | { agency_slug_or_code: string }
    | {
        agency_name: string
        legal_entity: LegalEntity
        primary_market: PrimaryMarket
        authorized_to_accept: boolean
      }
  locale: 'en' | 'ar'
  referrer?: string
  plan?: string
}

export type RegisterSuccess = {
  user: {
    id: string
    display_name: string
    identifier_type: string
    identifier_masked: string
  }
  tenant: {
    id: string
    name: string
    role: string
  }
  session: {
    token: string
    expires_at: string
  }
  redirect_to: string
}

export type RegisterFieldErrors = Record<string, string>

export class RegisterApiError extends Error {
  status?: number
  code?: string
  fieldErrors?: RegisterFieldErrors
  helpUrl?: string

  constructor(
    message: string,
    opts?: {
      status?: number
      code?: string
      fieldErrors?: RegisterFieldErrors
      helpUrl?: string
    },
  ) {
    super(message)
    this.name = 'RegisterApiError'
    this.status = opts?.status
    this.code = opts?.code
    this.fieldErrors = opts?.fieldErrors
    this.helpUrl = opts?.helpUrl
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
 * POST /api/auth/register — SHR-AUT-006 backend contract.
 */
export async function postAuthRegister(body: RegisterRequestBody): Promise<RegisterSuccess> {
  let res: Response
  try {
    res = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  } catch {
    throw new RegisterApiError('network', { code: 'network' })
  }

  const parsed = await parseJson(res)

  if (res.status === 409 || parsed?.error === 'FREE_TRIAL_ALREADY_CLAIMED') {
    throw new RegisterApiError('FREE_TRIAL_ALREADY_CLAIMED', {
      status: 409,
      code: 'FREE_TRIAL_ALREADY_CLAIMED',
      helpUrl: typeof parsed?.help_url === 'string' ? parsed.help_url : '/support/duplicate-account',
    })
  }

  if (res.status === 400 || parsed?.error === 'VALIDATION_FAILED') {
    const fieldErrors =
      parsed?.field_errors && typeof parsed.field_errors === 'object'
        ? (parsed.field_errors as RegisterFieldErrors)
        : undefined
    throw new RegisterApiError('VALIDATION_FAILED', {
      status: 400,
      code: 'VALIDATION_FAILED',
      fieldErrors,
    })
  }

  if (!res.ok) {
    throw new RegisterApiError('server', {
      status: res.status,
      code: 'server',
    })
  }

  const sessionRaw = parsed?.session as RegisterSuccess['session'] | undefined
  const token = typeof sessionRaw?.token === 'string' ? sessionRaw.token : ''
  if (!token || !sessionRaw) {
    throw new RegisterApiError('server', { code: 'server' })
  }

  return {
    user: parsed!.user as RegisterSuccess['user'],
    tenant: parsed!.tenant as RegisterSuccess['tenant'],
    session: sessionRaw,
    redirect_to:
      typeof parsed?.redirect_to === 'string'
        ? parsed.redirect_to
        : defaultRedirectForPath(body.path),
  }
}

export function defaultRedirectForPath(path: RegistrationPath): string {
  if (path === 'join') return '/join/pending'
  if (path === 'agency') return '/agency/onboarding'
  return '/onboarding/welcome'
}

export async function adoptRegisterToken(token: string): Promise<void> {
  setAuthToken(token)
}
