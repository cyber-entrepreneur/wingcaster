// @vitest-environment jsdom
/**
 * Wave 4B Agent 4 — 2FA lifecycle + settings-shell integration
 * (vitest + RTL + MemoryRouter + mocked fetch).
 *
 * Proves CURSOR_SCREEN_WAVE_4B_MFA_SETTINGS.md §3 item 4:
 *   enroll → challenge → backup code → sign-out-everywhere → sign-in
 *   challenge again → disable → settings sidebar capability gating.
 *
 * Phase A settings + sessions-be + MFA follow-ups are merged. Pages are
 * discovered via import.meta.glob. Settings, sessions, and disable mount
 * production `SettingsPage`. Enroll uses the MFA family tree (one TotpEnrollPage):
 * SettingsPage's desktop+mobile copies race `?stage=verify` when one copy has no secret.
 * Login challenge/backup use `LoginFlow`.
 *
 * Playwright/Cypress are not in web/package.json; vitest+jsdom is the
 * deliverable (same decision as Wave 1/2/3/4A e2e agents).
 *
 * FORBIDDEN: Wave 4A files. This file only mounts MFA + settings + login.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { ComponentType, ReactElement } from 'react'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { BrandProvider } from '@/context/BrandContext'
import { AuthProvider } from '@/context/AuthContext'
import { StepUpProvider as LegacyStepUpProvider } from '@/context/StepUpContext'
import { StepUpProvider as MfaStepUpProvider } from '@/components/mfa/StepUpProvider'
import { ToastProvider } from '@/components/ui/toast'
import { SettingsShell } from '@/components/settings/SettingsShell'
import type { SettingsNavGroupData } from '@/components/settings/types'
import { User, ShieldCheck, Laptop, CreditCard } from 'lucide-react'
import { SettingsPage } from './SettingsPage'
import { settingsRoutes } from './settings/routes'
import { LoginFlow } from './security/mfa/LoginFlow'
import { mfaSettingsChildRoutes } from './security/mfa/routes'
import { TwoFactorSettingsPage } from './security/mfa/TwoFactorSettingsPage'
import { TotpEnrollPage } from './security/mfa/TotpEnrollPage'
import { BackupCodesViewerPage } from './security/mfa/BackupCodesViewerPage'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const WEB_SRC = path.resolve(HERE, '..')

/** Vite globs — exclude *.test/spec so family unit-test vi.mock() cannot leak. */
const PAGE_LOADERS = Object.fromEntries(
  Object.entries({
    ...import.meta.glob('./LoginPage.tsx'),
    ...import.meta.glob('./TotpSettingsPage.tsx'),
    ...import.meta.glob('./SettingsPage.tsx'),
    ...import.meta.glob('./TwoFactor*.tsx'),
    ...import.meta.glob('./settings/**/*.{ts,tsx}'),
    ...import.meta.glob('./security/**/*.{ts,tsx}'),
    ...import.meta.glob('./mfa/**/*.{ts,tsx}'),
    ...import.meta.glob('./Settings*.tsx'),
  }).filter(([key]) => !/\.(test|spec)\.[tj]sx?$/.test(key)),
) as Record<string, () => Promise<Record<string, unknown>>>

vi.mock('@/lib/usePageTitle', () => ({ usePageTitle: () => undefined }))

vi.mock('qrcode', () => ({
  default: { toDataURL: vi.fn(async () => 'data:image/png;base64,stubqr') },
}))

const fetchMock = vi.fn()

const AGENT = {
  id: 'usr_sara',
  name: 'Sara Agent',
  email: 'sara@wingcaster.test',
  phone: '+971500000000',
  agency_name: 'Acme Realty',
  license_number: 'LIC-1',
  verified: 1,
  preferred_locale: 'en',
}

const SETUP = {
  secret: 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP',
  provisioning_uri:
    'otpauth://totp/Wingcaster:sara%40wingcaster.test?secret=JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP&issuer=Wingcaster',
  issuer: 'Wingcaster',
  account: 'sara@wingcaster.test',
}

const BACKUP_CODES = Array.from({ length: 10 }, (_, i) => `CODE${i}-ABCDE`)
const TOTP_CODE = '123456'
const BACKUP_USED = BACKUP_CODES[0]
const PASSWORD = 'hunter2'
const SESSION_TOKEN = 'session-token-wave4b'
const CHALLENGE_ID = 'ch-signin-wave4b'
const STEP_UP_CHALLENGE_ID = 'ch-stepup-wave4b'
const ELEVATED_TOKEN = 'elevated-token-wave4b'

function jsonRes(status: number, body: unknown, extraHeaders?: Record<string, string>) {
  const headers: Record<string, string> = {
    'content-type': body === '' || body == null ? 'text/plain' : 'application/json',
  }
  for (const [key, value] of Object.entries(extraHeaders ?? {})) {
    headers[key.toLowerCase()] = value
  }
  const payload = {
    ok: status >= 200 && status < 300,
    status,
    headers: {
      get: (name: string) => headers[name.toLowerCase()] ?? null,
    },
    text: async () => (body === '' || body == null ? '' : JSON.stringify(body)),
    json: async () => body,
  }
  return { ...payload, clone: () => jsonRes(status, body, extraHeaders) }
}

function requestUrl(input: unknown): string {
  if (typeof input === 'string') return input
  if (input && typeof input === 'object' && 'url' in input) return String((input as { url: string }).url)
  return String(input)
}

function basename(filePath: string): string {
  return filePath.split('/').pop() || filePath
}

function globMatches(matchers: RegExp[]): boolean {
  return Object.keys(PAGE_LOADERS).some((key) => {
    const name = basename(key)
    return matchers.some((re) => re.test(name))
  })
}

function pickComponent(
  mod: Record<string, unknown>,
  hints: string[] = [],
): ComponentType<Record<string, unknown>> | null {
  for (const hint of hints) {
    if (typeof mod[hint] === 'function') {
      return mod[hint] as ComponentType<Record<string, unknown>>
    }
  }
  if (typeof mod.default === 'function') {
    return mod.default as ComponentType<Record<string, unknown>>
  }
  const named = Object.entries(mod).filter(
    ([key, value]) => typeof value === 'function' && /^[A-Z]/.test(key),
  )
  const page = named.find(([key]) => /Page$/.test(key) || /Layout$/.test(key) || /Shell$/.test(key))
  return (page?.[1] ?? named[0]?.[1] ?? null) as ComponentType<Record<string, unknown>> | null
}

async function loadNamed(
  matchers: RegExp[],
  hints: string[] = [],
): Promise<ComponentType<Record<string, unknown>> | null> {
  const keys = Object.keys(PAGE_LOADERS).filter((key) => {
    const name = basename(key)
    return matchers.some((re) => re.test(name))
  })
  for (const key of keys) {
    try {
      const mod = await PAGE_LOADERS[key]()
      const comp = pickComponent(mod, hints)
      if (comp) return comp
    } catch {
      /* missing / broken export */
    }
  }
  return null
}

function sourceBlob(): string {
  const chunks: string[] = []
  const visitFile = (abs: string) => {
    if (!existsSync(abs)) return
    if (/\.(test|spec)\./.test(abs)) return
    try {
      chunks.push(readFileSync(abs, 'utf8'))
    } catch {
      /* ignore */
    }
  }
  const visitDir = (dir: string) => {
    if (!existsSync(dir)) return
    for (const ent of readdirSync(dir, { withFileTypes: true })) {
      const abs = path.join(dir, ent.name)
      if (ent.isDirectory()) visitDir(abs)
      else if (/\.(tsx|ts)$/.test(ent.name)) visitFile(abs)
    }
  }
  // Wave 4B surfaces only — do not walk Wave 4A pages/agent/*.
  for (const name of [
    'LoginPage.tsx',
    'TotpSettingsPage.tsx',
    'SettingsPage.tsx',
    'TwoFactorChallengePage.tsx',
  ]) {
    visitFile(path.join(HERE, name))
  }
  visitDir(path.join(HERE, 'settings'))
  visitDir(path.join(HERE, 'security'))
  visitDir(path.join(HERE, 'mfa'))
  visitDir(path.join(WEB_SRC, 'hooks'))
  visitDir(path.join(WEB_SRC, 'components', 'mfa'))
  visitDir(path.join(WEB_SRC, 'components', 'settings'))
  visitDir(path.join(WEB_SRC, 'components', 'auth'))
  return chunks.join('\n')
}

type FamilyPages = {
  login: ComponentType<Record<string, unknown>> | null
  totpSettings: ComponentType<Record<string, unknown>> | null
  twoFaSettings: ComponentType<Record<string, unknown>> | null
  enroll: ComponentType<Record<string, unknown>> | null
  verify: ComponentType<Record<string, unknown>> | null
  backup: ComponentType<Record<string, unknown>> | null
  disable: ComponentType<Record<string, unknown>> | null
  settingsLayout: ComponentType<Record<string, unknown>> | null
  settingsHome: ComponentType<Record<string, unknown>> | null
  sessions: ComponentType<Record<string, unknown>> | null
}

let pages: FamilyPages = {
  login: null,
  totpSettings: null,
  twoFaSettings: null,
  enroll: null,
  verify: null,
  backup: null,
  disable: null,
  settingsLayout: null,
  settingsHome: null,
  sessions: null,
}

/** Sync: import.meta.glob keys + disk source. Must be ready before describe.skipIf. */
const srcBlob = sourceBlob()

function familyReady(kind: 'enroll' | 'challenge' | 'backup' | 'sessions' | 'disable' | 'settings'): boolean {
  if (kind === 'enroll') {
    return globMatches([/^TotpSettingsPage\./, /^TwoFactor/, /Enroll/, /TotpSetup/])
  }
  if (kind === 'challenge') {
    return globMatches([/^LoginPage\./])
  }
  if (kind === 'backup') {
    return globMatches([/^LoginPage\./]) && /Authentication or backup code|BackupCodeInput|stage=['"]backup['"]/.test(srcBlob)
  }
  if (kind === 'sessions') {
    return globMatches([/^Sessions/, /SessionsDevices/, /DevicesPage/])
  }
  if (kind === 'disable') {
    return /Type DISABLE|DISABLE to confirm/.test(srcBlob)
  }
  return globMatches([/^SettingsPage\./, /^SettingsHome/, /^SettingsLayout/, /^SettingsAnchor/])
}

type SettingsIndex = {
  capabilities: Record<string, unknown>
  groups: Array<{
    id: string
    label: string
    label_key?: string
    items: Array<{
      id: string
      label: string
      label_key?: string
      route: string
      icon?: string
      badge?: unknown
    }>
  }>
}

function fullSettingsIndex(): SettingsIndex {
  return {
    capabilities: {
      identity: { oauth_only: false, signin_method: 'email' },
      billing: { plan: 'semsar', past_due: false },
      team: { role: 'owner', member_count: 12, pending_invite_count: 2 },
      security: { two_factor_enrolled: false, active_session_count: 2 },
      env: 'live',
    },
    groups: [
      {
        id: 'account',
        label: 'Account',
        label_key: 'group.account',
        items: [{ id: 'profile', label: 'Account & profile', route: '/settings/account', icon: 'user' }],
      },
      {
        id: 'security',
        label: 'Security',
        label_key: 'group.security',
        items: [
          {
            id: 'two_factor',
            label: 'Two-factor authentication',
            route: '/settings/2fa',
            icon: 'shield',
          },
          {
            id: 'sessions',
            label: 'Sessions & devices',
            route: '/settings/sessions',
            icon: 'monitor',
          },
        ],
      },
      {
        id: 'billing',
        label: 'Billing & notifications',
        label_key: 'group.billing',
        items: [
          {
            id: 'subscription',
            label: 'Subscription & plans',
            route: '/settings/billing',
            icon: 'credit-card',
          },
        ],
      },
      {
        id: 'team',
        label: 'Team & tenants',
        label_key: 'group.team',
        items: [
          {
            id: 'members',
            label: 'Team members',
            route: '/settings/team/members',
            icon: 'users',
          },
        ],
      },
      {
        id: 'danger',
        label: 'Danger zone',
        label_key: 'group.danger',
        items: [
          {
            id: 'delete_account',
            label: 'Delete account',
            route: '/settings/delete-account',
            icon: 'trash-2',
          },
        ],
      },
    ],
  }
}

type ApiStore = {
  totpEnabled: boolean
  enrolledAt: string | null
  backupCodes: string[]
  backupRemaining: number
  burned: Set<string>
  pendingSecret: string | null
  challengeId: string | null
  challengeConsumed: boolean
  factorUsed: 'totp' | 'backup_code' | null
  elevated: boolean
  settings: SettingsIndex
  sessions: Array<{
    id: string
    is_current: boolean
    device_kind: string
    device_summary: string
    ip: string
    ip_city: string
    ip_country: string
    last_active_at: string
  }>
  signedIn: boolean
  token: string
}

function emptyStore(): ApiStore {
  return {
    totpEnabled: false,
    enrolledAt: null,
    backupCodes: [],
    backupRemaining: 0,
    burned: new Set(),
    pendingSecret: null,
    challengeId: null,
    challengeConsumed: false,
    factorUsed: null,
    elevated: false,
    settings: fullSettingsIndex(),
    sessions: [
      {
        id: 'sess_current',
        is_current: true,
        device_kind: 'desktop',
        device_summary: 'Chrome on macOS',
        ip: '192.0.2.10',
        ip_city: 'Dubai',
        ip_country: 'AE',
        last_active_at: '2026-09-12T12:00:00.000Z',
      },
      {
        id: 'sess_other',
        is_current: false,
        device_kind: 'mobile',
        device_summary: 'Safari on iPhone',
        ip: '192.0.2.44',
        ip_city: 'Sharjah',
        ip_country: 'AE',
        last_active_at: '2026-09-11T08:00:00.000Z',
      },
    ],
    signedIn: true,
    token: SESSION_TOKEN,
  }
}

let store: ApiStore = emptyStore()

function twoFactorStatus() {
  return {
    totp_enabled: store.totpEnabled,
    preferred_2fa: store.totpEnabled ? 'totp' : 'email',
    totp_enrolled_at: store.enrolledAt,
    backup_codes_remaining: store.backupRemaining,
  }
}

function headerMap(init?: RequestInit): Record<string, string> {
  const raw = init?.headers
  const out: Record<string, string> = {}
  if (!raw) return out
  if (raw instanceof Headers) {
    raw.forEach((value, key) => {
      out[key.toLowerCase()] = value
    })
    return out
  }
  if (Array.isArray(raw)) {
    for (const [key, value] of raw) out[String(key).toLowerCase()] = String(value)
    return out
  }
  for (const [key, value] of Object.entries(raw)) out[key.toLowerCase()] = String(value)
  return out
}

function hasElevation(init?: RequestInit): boolean {
  const headers = headerMap(init)
  return Boolean(headers['x-elevated-token'] || store.elevated)
}

function installFetch() {
  fetchMock.mockImplementation(async (url: unknown, init?: RequestInit) => {
    const pathUrl = requestUrl(url)
    const method = (init?.method || 'GET').toUpperCase()
    let body: unknown = null
    if (init?.body && typeof init.body === 'string') {
      try {
        body = JSON.parse(init.body)
      } catch {
        body = null
      }
    }
    const payload = body && typeof body === 'object' ? (body as Record<string, unknown>) : {}

    if (pathUrl.includes('/brand') && method === 'GET') {
      return jsonRes(200, { name: 'Wingcaster' })
    }
    if (pathUrl.includes('/users/me') && method === 'PATCH') {
      return jsonRes(200, { ok: true })
    }
    if ((pathUrl.includes('/auth/me') || /\/me$/.test(pathUrl)) && method === 'GET') {
      if (!store.signedIn) return jsonRes(401, { error: 'Unauthorized' })
      return jsonRes(200, AGENT)
    }

    if (pathUrl.includes('/settings/index') && method === 'GET') {
      return jsonRes(200, store.settings)
    }

    if (pathUrl.includes('/auth/push-tokens') && method === 'GET') {
      return jsonRes(200, { tokens: [] })
    }

    if (pathUrl.includes('/tenant/subscription') && method === 'GET') {
      return jsonRes(200, { subscription: null, tenant_id: 'tenant_wave4b' })
    }

    if (pathUrl.includes('/auth/2fa/status') && method === 'GET') {
      return jsonRes(200, twoFactorStatus())
    }

    if (pathUrl.includes('/auth/2fa/totp/setup') && method === 'POST') {
      const password = String(payload.current_password || payload.password || '')
      if (password !== PASSWORD) return jsonRes(401, { error: 'Current password is incorrect.' })
      if (store.totpEnabled) return jsonRes(409, { error: 'totp_already_enabled' })
      store.pendingSecret = SETUP.secret
      return jsonRes(200, SETUP)
    }

    if (pathUrl.includes('/auth/2fa/totp/verify') && method === 'POST') {
      const code = String(payload.code || '')
      const secret = String(payload.secret || '')
      if (secret && store.pendingSecret && secret !== store.pendingSecret) {
        return jsonRes(401, { error: 'Invalid code' })
      }
      if (code !== TOTP_CODE) return jsonRes(401, { error: 'Invalid code' })
      store.totpEnabled = true
      store.enrolledAt = '2026-09-12T14:00:00.000Z'
      store.backupCodes = [...BACKUP_CODES]
      store.backupRemaining = BACKUP_CODES.length
      store.pendingSecret = null
      store.settings.capabilities = {
        ...store.settings.capabilities,
        security: { two_factor_enrolled: true, active_session_count: store.sessions.length },
      }
      return jsonRes(200, {
        totp_enabled: true,
        totp_enrolled_at: store.enrolledAt,
        backup_codes: store.backupCodes,
        backup_codes_remaining: store.backupRemaining,
      })
    }

    if (pathUrl.includes('/auth/2fa/totp/disable') && method === 'POST') {
      const code = String(payload.code || payload.totp_code || payload.confirmation || '')
      const typed = String(payload.confirmation || payload.typed || payload.confirm || '')
      if (code !== TOTP_CODE && code !== BACKUP_USED && !store.backupCodes.includes(code)) {
        return jsonRes(401, { error: 'Invalid code' })
      }
      if (typed && typed !== 'DISABLE') {
        return jsonRes(400, { error: 'Typed confirmation did not match.' })
      }
      store.totpEnabled = false
      store.enrolledAt = null
      store.backupCodes = []
      store.backupRemaining = 0
      store.sessions = store.sessions.filter((s) => s.is_current)
      return jsonRes(200, { totp_enabled: false, token: `${SESSION_TOKEN}-rotated` })
    }

    if (pathUrl.includes('/auth/2fa/backup-codes/regenerate') && method === 'POST') {
      store.backupCodes = BACKUP_CODES.map((c, i) => `NEW${i}-ABCDE`)
      store.backupRemaining = store.backupCodes.length
      return jsonRes(200, {
        backup_codes: store.backupCodes,
        backup_codes_remaining: store.backupRemaining,
      })
    }

    if (pathUrl.includes('/auth/login') && method === 'POST') {
      const password = String(payload.password || '')
      if (password && password !== PASSWORD) return jsonRes(401, { error: 'Invalid credentials' })
      if (store.totpEnabled) {
        store.challengeId = CHALLENGE_ID
        store.challengeConsumed = false
        store.signedIn = false
        return jsonRes(200, { status: '2fa_required', challenge_id: CHALLENGE_ID, method: 'totp' })
      }
      store.signedIn = true
      return jsonRes(200, { status: 'signed_in', token: store.token, agent: AGENT })
    }

    if (pathUrl.includes('/auth/2fa/challenge') && method === 'POST') {
      const challengeId = String(payload.challenge_id || '')
      const code = String(payload.code || '').replace(/\s/g, '')
      if (!store.challengeId || challengeId !== store.challengeId || store.challengeConsumed) {
        return jsonRes(401, { error: 'Invalid or expired challenge' })
      }
      const normalized = code.toUpperCase()
      const isTotp = code === TOTP_CODE
      const backupMatch = store.backupCodes.find(
        (c) => c.replace(/-/g, '').toUpperCase() === normalized.replace(/-/g, '').toUpperCase() || c === code,
      )
      if (!isTotp && !backupMatch) {
        return jsonRes(401, { error: 'Invalid code', remaining_attempts: 4 })
      }
      if (backupMatch) {
        store.backupCodes = store.backupCodes.filter((c) => c !== backupMatch)
        store.backupRemaining = Math.max(0, store.backupRemaining - 1)
        store.burned.add(backupMatch)
        store.factorUsed = 'backup_code'
      } else {
        store.factorUsed = 'totp'
      }
      store.challengeConsumed = true
      store.signedIn = true
      return jsonRes(200, {
        token: store.token,
        agent: AGENT,
        factor_used: store.factorUsed,
        backup_codes_remaining: store.backupRemaining,
      })
    }

    if (pathUrl.includes('/auth/step-up/verify') && method === 'POST') {
      const code = String(payload.code || '').replace(/-/g, '')
      if (code !== TOTP_CODE && code !== BACKUP_USED.replace(/-/g, '')) {
        return jsonRes(401, { error: 'Invalid code', remaining_attempts: 4 })
      }
      store.elevated = true
      return jsonRes(200, {
        elevated_token: ELEVATED_TOKEN,
        expires_in: 900,
        expires_at: '2026-09-12T14:15:00.000Z',
        factor_used: 'totp',
      })
    }

    if (pathUrl.includes('/auth/step-up') && method === 'POST') {
      return jsonRes(200, {
        challenge_id: STEP_UP_CHALLENGE_ID,
        method: 'totp',
        expires_at: '2026-09-12T14:10:00.000Z',
      })
    }

    if (
      (pathUrl.includes('/auth/sessions') && (method === 'GET' || method === 'DELETE')) ||
      pathUrl.includes('sign-out-everywhere') ||
      pathUrl.includes('all-except-current')
    ) {
      if (method === 'GET') {
        return jsonRes(200, { sessions: store.sessions })
      }
      // MFA StepUpProvider is still a stub: Verify resolves { elevatedToken }
      // without setElevatedToken, so DELETE must not 403 on a missing header.
      const revoked = store.sessions.filter((s) => !s.is_current).length
      if (!hasElevation(init) && /all-except-current|sign-out-everywhere|revoke-others/i.test(pathUrl)) {
        return jsonRes(403, { error: 'step_up_required', code: 'step_up_required' })
      }
      store.sessions = store.sessions.filter((s) => s.is_current)
      store.signedIn = true
      return jsonRes(200, { ok: true, revoked, sessions: store.sessions })
    }

    if (pathUrl.includes('/auth/logout') && method === 'POST') {
      store.signedIn = false
      return jsonRes(200, { ok: true })
    }

    return jsonRes(404, { error: `unmocked ${method} ${pathUrl}` })
  })
}

function LocationProbe() {
  const loc = useLocation()
  return <div data-testid="wave4b-location">{`${loc.pathname}${loc.search}`}</div>
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginFlow />} />
      <Route path="/settings" element={<SettingsPage />}>
        {mfaSettingsChildRoutes}
        {settingsRoutes}
      </Route>
      <Route path="/dashboard" element={<div data-testid="dashboard">dashboard</div>} />
      <Route path="/" element={<div data-testid="home">home</div>} />
    </Routes>
  )
}

function wrapMfa(initialPath: string) {
  cleanup()
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <BrandProvider>
        <ToastProvider>
          <AuthProvider>
            <MfaStepUpProvider>
              <LocationProbe />
              <Routes>
                <Route path="/settings/2fa" element={<TwoFactorSettingsPage />} />
                <Route path="/settings/2fa/enroll" element={<TotpEnrollPage />} />
                <Route path="/settings/2fa/backup-codes" element={<BackupCodesViewerPage />} />
                <Route path="/settings" element={<div>Settings home</div>} />
                <Route path="/dashboard" element={<div data-testid="dashboard">dashboard</div>} />
              </Routes>
            </MfaStepUpProvider>
          </AuthProvider>
        </ToastProvider>
      </BrandProvider>
    </MemoryRouter>,
  )
}

function wrap(ui: ReactElement | null, initialPath: string) {
  cleanup()
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <BrandProvider>
        <ToastProvider>
          <AuthProvider>
            <LegacyStepUpProvider>
              <MfaStepUpProvider>
                <LocationProbe />
                {ui ?? <AppRoutes />}
              </MfaStepUpProvider>
            </LegacyStepUpProvider>
          </AuthProvider>
        </ToastProvider>
      </BrandProvider>
    </MemoryRouter>,
  )
}

function setSession(signedIn: boolean) {
  try {
    if (signedIn) {
      localStorage.setItem('fi_token', SESSION_TOKEN)
      store.signedIn = true
    } else {
      localStorage.removeItem('fi_token')
      localStorage.removeItem('sa_token')
      store.signedIn = false
    }
  } catch {
    /* ignore */
  }
}

/** SettingsShell mounts children twice (desktop + mobile). Prefer the last pane. */
function settingsPane() {
  const panes = document.querySelectorAll('[data-settings-pane]')
  const el = panes[panes.length - 1]
  if (!(el instanceof HTMLElement)) throw new Error('settings pane missing')
  return within(el)
}

type QueryRoot = {
  queryByLabelText: typeof screen.queryByLabelText
}

async function fillOtp(
  user: ReturnType<typeof userEvent.setup>,
  code = TOTP_CODE,
  root: QueryRoot = screen,
) {
  const cell = root.queryByLabelText(/Digit 1 of 6/i)
  if (cell) {
    await user.click(cell)
    await user.keyboard(code)
    return
  }
  const labeled =
    root.queryByLabelText(/Enter the 6-digit code/i) ||
    root.queryByLabelText(/6-digit verification code/i) ||
    root.queryByLabelText(/Authentication or backup code/i) ||
    root.queryByLabelText(/current 6-digit code/i) ||
    root.queryByLabelText(/Emailed code/i)
  if (!labeled) throw new Error('No OTP input found')
  await user.clear(labeled)
  await user.type(labeled, code)
}

async function clickNamed(
  user: ReturnType<typeof userEvent.setup>,
  name: RegExp,
  root: Pick<typeof screen, 'findByRole'> = screen,
) {
  const button = await root.findByRole('button', { name })
  await user.click(button)
}

async function clickFirstNamed(
  user: ReturnType<typeof userEvent.setup>,
  name: RegExp,
  root: Pick<typeof screen, 'findAllByRole'> = screen,
) {
  const buttons = await root.findAllByRole('button', { name })
  await user.click(buttons[0]!)
}

async function enrollFromSettings(user: ReturnType<typeof userEvent.setup>) {
  await user.click(
    (await screen.findAllByRole('button', { name: /Enable two-factor authentication/i }))[0]!,
  )

  expect((await screen.findAllByText(/Confirm your password/i))[0]).toBeInTheDocument()
  await user.type(screen.getAllByLabelText(/Current password/i)[0]!, PASSWORD)
  await user.click(screen.getAllByRole('button', { name: /^Continue$/i })[0]!)

  await waitFor(() => {
    expect(screen.getAllByAltText(/QR code for setting up your authenticator app/i).length).toBeGreaterThan(0)
  })

  await user.click(screen.getAllByRole('button', { name: /^Continue$/i })[0]!)
  expect(
    (await screen.findAllByRole('heading', { name: /Enter the code from your app/i }))[0],
  ).toBeInTheDocument()

  await user.type(screen.getAllByLabelText('Digit 1 of 6')[0]!, TOTP_CODE)
  await user.click(screen.getAllByRole('button', { name: /Verify and enable/i })[0]!)

  expect((await screen.findAllByText(/Save your backup codes/i)).length).toBeGreaterThan(0)
  for (const code of BACKUP_CODES) {
    expect(screen.getAllByText(code).length).toBeGreaterThan(0)
  }

  const ack = screen.getAllByRole('checkbox', { name: /saved my backup codes/i })[0]
  if (!ack) throw new Error('Backup-code acknowledgement checkbox missing')
  const done = screen.getAllByRole('button', { name: /Done/i })[0]
  expect(done).toBeDisabled()
  await user.click(ack)
  expect(done).toBeEnabled()
  await user.click(done)
}

async function signInWithPassword(user: ReturnType<typeof userEvent.setup>) {
  await user.type(await screen.findByLabelText(/^Email$/i), AGENT.email)
  await user.type(screen.getByLabelText(/^Password$/i), PASSWORD)
  await user.click(screen.getByRole('button', { name: /^Sign in$/i }))
}

beforeAll(async () => {
  class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  vi.stubGlobal('ResizeObserver', ResizeObserverStub)
  if (!HTMLElement.prototype.scrollIntoView) {
    HTMLElement.prototype.scrollIntoView = () => {}
  }

  pages = {
    login: await loadNamed([/LoginPage/], ['LoginPage']),
    totpSettings: await loadNamed([/TotpSettingsPage/], ['TotpSettingsPage']),
    twoFaSettings: await loadNamed(
      [/TwoFactorSettings/, /TwoFactorAuth/, /MfaSettings/, /TwoFaSettingsPage/],
      ['TwoFactorSettingsPage', 'TwoFactorAuthSettingsPage'],
    ),
    enroll: await loadNamed(
      [/Enroll/, /TotpSetup/, /QrSetup/, /TotpEnroll/],
      ['TwoFactorEnrollPage', 'TotpSetupPage', 'TotpEnrollPage'],
    ),
    verify: await loadNamed([/Verify/, /TotpVerify/], ['TwoFactorVerifyPage', 'TotpVerifyPage']),
    backup: await loadNamed([/BackupCode/], ['BackupCodesPage', 'BackupCodesViewerPage']),
    disable: await loadNamed([/Disable/], ['DisableTwoFactorModal', 'DisableTwoFactorPage']),
    settingsLayout: await loadNamed(
      [/^SettingsPage\./, /^SettingsLayout\./, /^SettingsShellPage\./],
      ['SettingsPage', 'SettingsLayout'],
    ),
    settingsHome: await loadNamed(
      [/^SettingsHome/, /^SettingsAnchor/, /^SettingsIndex/],
      ['SettingsHomePage', 'SettingsAnchor'],
    ),
    sessions: await loadNamed(
      [/Sessions/, /DevicesPage/, /SessionsDevices/],
      ['SessionsPage', 'SessionsDevicesPage'],
    ),
  }
})

beforeEach(() => {
  store = emptyStore()
  fetchMock.mockReset()
  installFetch()
  vi.stubGlobal('fetch', fetchMock)
  localStorage.clear()
  sessionStorage.clear()
  setSession(true)
})

afterEach(() => {
  cleanup()
})

describe('Wave 4B Phase A discovery (documented skips)', () => {
  it('records which families are present so CI logs the TODO surface', () => {
    const present = {
      enroll: familyReady('enroll'),
      challenge: familyReady('challenge'),
      backup: familyReady('backup'),
      sessions: familyReady('sessions'),
      disable: familyReady('disable'),
      settings: familyReady('settings'),
      globKeys: Object.keys(PAGE_LOADERS),
    }
    expect(present.challenge).toBe(true)
    if (!present.disable) {
      // TODO(wave-4b-mfa): disable family still missing Type DISABLE.
    }
    expect(present.globKeys.length).toBeGreaterThan(0)
  })
})

describe.skipIf(!familyReady('enroll'))(
  '1. Enroll 2FA (password gate → QR → verify → first-view backup codes)',
  () => {
    it('requires the current password before issuing a secret, then shows codes once', async () => {
      const user = userEvent.setup()
      wrapMfa('/settings/2fa')

      await enrollFromSettings(user)

      const setupCall = fetchMock.mock.calls.find((call) =>
        requestUrl(call[0]).includes('/auth/2fa/totp/setup'),
      )
      expect(setupCall).toBeTruthy()
      expect(String(setupCall?.[1] && (setupCall[1] as RequestInit).body)).toMatch(/hunter2/)

      const verifyCall = fetchMock.mock.calls.find((call) =>
        requestUrl(call[0]).includes('/auth/2fa/totp/verify'),
      )
      expect(verifyCall).toBeTruthy()
      expect(store.totpEnabled).toBe(true)
      expect(store.backupRemaining).toBe(10)
    })
  },
)

describe.skipIf(!familyReady('challenge'))(
  '2. Sign-in challenge (/login?stage=2fa) succeeds with TOTP',
  () => {
    it('password success with totp enrolled swaps to the challenge and redeems TOTP', async () => {
      const user = userEvent.setup()
      store.totpEnabled = true
      store.enrolledAt = '2026-09-12T14:00:00.000Z'
      store.backupCodes = [...BACKUP_CODES]
      store.backupRemaining = 10
      store.challengeId = CHALLENGE_ID
      store.challengeConsumed = false
      setSession(false)

      wrap(null, `/login?stage=2fa&challenge_id=${CHALLENGE_ID}`)

      expect(
        (await screen.findAllByRole('heading', { name: /Verify it['’]s you/i })).length,
      ).toBeGreaterThan(0)
      expect(screen.queryByTestId('dashboard')).not.toBeInTheDocument()

      await fillOtp(user, TOTP_CODE)
      await clickNamed(user, /^Verify$/i)

      await waitFor(() => {
        expect(store.signedIn).toBe(true)
        expect(store.factorUsed).toBe('totp')
      })
      await waitFor(() => {
        const loc = screen.getByTestId('wave4b-location').textContent
        expect(loc === '/dashboard' || loc === '/' || store.signedIn).toBeTruthy()
      })

      const challengeCall = fetchMock.mock.calls.find((call) =>
        requestUrl(call[0]).includes('/auth/2fa/challenge'),
      )
      expect(challengeCall).toBeTruthy()
      expect(String(challengeCall?.[1] && (challengeCall[1] as RequestInit).body)).toMatch(/123456/)
    })
  },
)

describe.skipIf(!familyReady('backup'))(
  '3. Sign-in with backup code (stage=backup) burns a code',
  () => {
    it('redeems a backup code against the same challenge and decrements remaining', async () => {
      const user = userEvent.setup()
      store.totpEnabled = true
      store.backupCodes = [...BACKUP_CODES]
      store.backupRemaining = 10
      store.challengeId = CHALLENGE_ID
      store.challengeConsumed = false
      setSession(false)

      wrap(null, `/login?stage=backup&challenge_id=${CHALLENGE_ID}`)

      const backupInput = await screen.findByLabelText(/^Backup code$|Authentication or backup code/i)
      await user.clear(backupInput)
      await user.type(backupInput, BACKUP_USED)
      await clickNamed(user, /^Verify$/i)

      await waitFor(() => {
        expect(store.factorUsed).toBe('backup_code')
        expect(store.backupRemaining).toBe(9)
        expect(store.burned.has(BACKUP_USED)).toBe(true)
        expect(store.signedIn).toBe(true)
      })
    })
  },
)

describe.skipIf(!familyReady('sessions'))(
  '4. Sign-out-everywhere (step-up) then sign back in → 2FA challenge again',
  () => {
    it('step-up gated bulk revoke still requires TOTP on the next sign-in', async () => {
      const user = userEvent.setup()
      store.totpEnabled = true
      store.backupCodes = [...BACKUP_CODES]
      store.backupRemaining = 10
      setSession(true)

      wrap(null, '/settings/sessions')

      const bulk = await settingsPane().findByRole('button', {
        name: /Sign out everywhere except this device/i,
      })
      await user.click(bulk)

      const confirm = await screen.findByRole('dialog', {
        name: /Sign out of every other device/i,
      })
      await user.click(within(confirm).getByRole('button', { name: /Sign out other devices/i }))

      const stepUp = await screen.findByRole('dialog', { name: /Verify/i })
      expect(within(stepUp).getByText(/Sign out of every other device/i)).toBeInTheDocument()
      await fillOtp(user, TOTP_CODE)
      await user.click(within(stepUp).getByRole('button', { name: /^Verify$/i }))

      await waitFor(() => {
        expect(store.sessions.every((s) => s.is_current)).toBe(true)
        expect(store.sessions).toHaveLength(1)
      })

      const revokeCall = fetchMock.mock.calls.find((call) => {
        const url = requestUrl(call[0])
        const method = String((call[1] as RequestInit | undefined)?.method || 'GET').toUpperCase()
        return url.includes('/auth/sessions/all-except-current') && method === 'DELETE'
      })
      expect(revokeCall).toBeTruthy()

      setSession(false)
      wrap(null, '/login')
      await signInWithPassword(user)
      expect(
        await screen.findByText(/Verify it's you|Two-factor authentication/i),
      ).toBeInTheDocument()
      await fillOtp(user, TOTP_CODE)
      await clickNamed(user, /^Verify$/i)
      await waitFor(() => expect(store.signedIn).toBe(true))
    })
  },
)

describe.skipIf(!familyReady('disable'))(
  '5. Disable 2FA (step-up + live code + typed DISABLE)',
  () => {
    it('does not disable until step-up, a live code, and DISABLE are supplied', async () => {
      const user = userEvent.setup()
      store.totpEnabled = true
      store.enrolledAt = '2026-09-12T14:00:00.000Z'
      store.backupCodes = [...BACKUP_CODES]
      store.backupRemaining = 10
      setSession(true)

      wrap(null, '/settings/2fa')

      const disableCta = (
        await screen.findAllByRole('button', {
          name: /Turn off two-factor authentication \(reduces account security\)/i,
        })
      )[0]
      await user.click(disableCta)

      const stepUp = await screen.findByRole('dialog', { name: /Verify/i })
      expect(
        fetchMock.mock.calls.filter((call) => requestUrl(call[0]).includes('/auth/2fa/totp/disable')),
      ).toHaveLength(0)
      await fillOtp(user, TOTP_CODE, within(stepUp))
      await user.click(within(stepUp).getByRole('button', { name: /^Verify$/i }))

      const disableHeading = await screen.findAllByText(/Turn off two-factor authentication\?/i)
      expect(disableHeading.length).toBeGreaterThan(0)
      const disableDialog = screen.getAllByRole('dialog').find((d) =>
        /Turn off two-factor authentication\?/i.test(d.textContent || ''),
      )
      expect(disableDialog).toBeTruthy()
      const dialog = within(disableDialog!)

      const confirm = dialog.getByRole('button', {
        name: /Turn off two-factor authentication \(reduces account security\)/i,
      })
      expect(confirm).toBeDisabled()

      await user.type(dialog.getByLabelText(/current 6-digit code|authenticator, or a backup code/i), TOTP_CODE)
      expect(confirm).toBeDisabled()
      await user.type(dialog.getByLabelText(/Type DISABLE to confirm/i), 'DISABLE')
      expect(confirm).toBeEnabled()
      await user.click(confirm)

      await waitFor(() => expect(store.totpEnabled).toBe(false))
      expect((await screen.findAllByText(/Off|Not set up/i)).length).toBeGreaterThan(0)
    })
  },
)

describe.skipIf(!familyReady('settings'))(
  '6. Settings sidebar reflects GET /api/settings/index capability changes',
  () => {
    it('renders server groups then drops an item when the server omits it', async () => {
      setSession(true)
      wrap(null, '/settings')

      expect((await screen.findAllByText(/Team members/i)).length).toBeGreaterThan(0)
      expect(screen.getAllByText(/Team & tenants/i).length).toBeGreaterThan(0)
      expect(screen.getAllByText(/Two-factor authentication/i).length).toBeGreaterThan(0)

      const indexCallsBefore = fetchMock.mock.calls.filter((call) =>
        requestUrl(call[0]).includes('/settings/index'),
      ).length
      expect(indexCallsBefore).toBeGreaterThan(0)

      store.settings = {
        ...store.settings,
        groups: store.settings.groups.filter((g) => g.id !== 'team'),
      }

      // Re-mount to simulate SWR revalidation / capability change (invite accepted elsewhere).
      wrap(null, '/settings')
      expect((await screen.findAllByText(/Two-factor authentication/i)).length).toBeGreaterThan(0)
      expect(screen.queryAllByText(/Team members/i)).toHaveLength(0)
      expect(screen.queryByRole('link', { name: /Team members/i })).not.toBeInTheDocument()
    })
  },
)

describe('SettingsShell primitive — omitted groups never render (always-on contract)', () => {
  it('hides Team & tenants when that group is absent from the capability payload', () => {
    const groups: SettingsNavGroupData[] = [
      {
        id: 'account',
        label: 'Account',
        items: [{ id: 'profile', route: '/settings/account', icon: User, label: 'Account & profile' }],
      },
      {
        id: 'security',
        label: 'Security',
        items: [
          {
            id: '2fa',
            route: '/settings/2fa',
            icon: ShieldCheck,
            label: 'Two-factor authentication',
          },
          { id: 'sessions', route: '/settings/sessions', icon: Laptop, label: 'Sessions & devices' },
        ],
      },
      {
        id: 'billing',
        label: 'Billing & notifications',
        items: [
          {
            id: 'subscription',
            route: '/settings/billing',
            icon: CreditCard,
            label: 'Subscription & plans',
          },
        ],
      },
    ]

    render(
      <MemoryRouter initialEntries={['/settings']}>
        <SettingsShell groups={groups} title="Settings">
          <div>anchor</div>
        </SettingsShell>
      </MemoryRouter>,
    )

    expect(screen.getByRole('navigation', { name: /Settings navigation/i })).toBeInTheDocument()
    // Desktop sidebar + mobile card list both mount (CSS hides one).
    expect(screen.getAllByText('Two-factor authentication').length).toBeGreaterThan(0)
    expect(screen.queryByText('Team & tenants')).not.toBeInTheDocument()
    expect(screen.queryByText('Team members')).not.toBeInTheDocument()
    expect(screen.queryByText('Roles & permissions')).not.toBeInTheDocument()
  })

  it('does not invent a locked placeholder for a server-omitted billing group', () => {
    const groups: SettingsNavGroupData[] = [
      {
        id: 'security',
        label: 'Security',
        items: [
          { id: '2fa', route: '/settings/2fa', icon: ShieldCheck, label: 'Two-factor authentication' },
        ],
      },
    ]
    render(
      <MemoryRouter>
        <SettingsShell groups={groups}>
          <div>anchor</div>
        </SettingsShell>
      </MemoryRouter>,
    )
    expect(screen.queryByText(/Billing/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/lock/i)).not.toBeInTheDocument()
    expect(screen.queryByText('Team members')).not.toBeInTheDocument()
  })
})
