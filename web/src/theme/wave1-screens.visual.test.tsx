// @vitest-environment jsdom
/**
 * Wave 1 WF-02 screens — visual / DOM snapshot matrix (15).
 *
 * Chromatic / Storybook are not configured (see scratchpad/wave1-chromatic-gap.md).
 * These Vitest snapshots stand in across LTR/RTL × light/dark × mobile/tablet/desktop
 * for the five Wave-1 screens.
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import type { ReactElement } from 'react'
import { applyLcMode } from '@/theme/mode'
import { ToastProvider } from '@/components/ui/toast'
import { BrandProvider } from '@/context/BrandContext'
import { DupIdentityModal } from '@/components/auth/DupIdentityModal'
import type { ApplicationOutcomePayload } from '@/pages/agent/applicationOutcomeTypes'
import type { AgencyApplicationRaw } from '@/pages/agency/applicationsTypes'

const FIXED_NOW = new Date('2026-09-08T12:00:00.000Z').getTime()
const SNAPSHOT_NOW = new Date('2026-09-12T12:00:00.000Z').getTime()

const apiMocks = vi.hoisted(() => ({
  getAgencyPublic: vi.fn(),
  resolveInvitation: vi.fn(),
  applyToAgencyBySlug: vi.fn(),
  acceptInvitation: vi.fn(),
  getMyAgency: vi.fn(),
  listAgencyApplications: vi.fn(),
  approveAgencyApplication: vi.fn(),
  rejectAgencyApplication: vi.fn(),
  getMyAgencyApplicationOutcome: vi.fn(),
  acceptMyAgencyApplication: vi.fn(),
  declineMyAgencyApplication: vi.fn(),
  withdrawMyAgencyApplication: vi.fn(),
}))

const authMock = vi.hoisted(() => ({
  agent: null as null | {
    id: string
    name?: string
    email?: string
    photo?: string | null
    affiliation?: { role: string }
  },
  isAdmin: false,
  loading: false,
  login: vi.fn(),
  logout: vi.fn(),
  register: vi.fn(),
  refreshAgent: vi.fn(),
  completeTwoFactor: vi.fn(),
}))

vi.mock('@/api/client', () => ({
  API_BASE: '/api',
  api: apiMocks,
  setAuthToken: vi.fn(),
  clearElevatedToken: vi.fn(),
}))

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => authMock,
}))

vi.mock('@/hooks/useLocale', () => ({
  useLocale: () => ({
    locale: 'en' as const,
    setLocale: vi.fn(async () => ({ ok: true as const })),
    dir: 'ltr' as const,
    isArabic: false,
  }),
}))

vi.mock('@/components/nav/LanguageSelector', () => ({
  LanguageSelector: () => <div data-testid="language-selector">Language</div>,
}))

vi.mock('@/lib/usePageTitle', () => ({ usePageTitle: () => undefined }))

vi.mock('@/hooks/useTenant', () => ({
  useTenant: () => ({
    tenants: [
      {
        id: 'personal:u1',
        name: 'Personal',
        kind: 'personal',
        role: 'owner',
        avatarUrl: null,
        listingsCount: 0,
        agentsCount: 0,
      },
    ],
    activeTenantId: 'personal:u1',
    activeTenant: null,
    loading: false,
    switching: false,
    error: null,
    isMultiTenant: false,
    refresh: vi.fn(),
    switchTenant: vi.fn().mockResolvedValue({ id: 'agency:a1' }),
  }),
}))

vi.mock('@/components/auth/registerApi', async () => {
  const actual = await vi.importActual<typeof import('@/components/auth/registerApi')>(
    '@/components/auth/registerApi',
  )
  return {
    ...actual,
    postAuthRegister: vi.fn(),
    adoptRegisterToken: vi.fn(),
  }
})

vi.mock('@/components/auth/loginApi', async () => {
  const actual = await vi.importActual<typeof import('@/components/auth/loginApi')>(
    '@/components/auth/loginApi',
  )
  return { ...actual, startOAuth: vi.fn() }
})

import { RegisterPage } from '@/pages/RegisterPage'
import { PublicAgencyApplyPage } from '@/pages/PublicAgencyApplyPage'
import { ApplicationsQueuePage } from '@/pages/agency/ApplicationsQueuePage'
import { ApplicationDetailPage } from '@/pages/agency/ApplicationDetailPage'
import { ApplicationOutcomePage } from '@/pages/agent/ApplicationOutcomePage'

const THEME_CSS = readFileSync(
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../docs/design-tokens/broadcast-theme.css'),
  'utf8',
)

const QUEUE_SAMPLE: AgencyApplicationRaw[] = [
  {
    id: 'app_sara',
    agency_id: 'agc_1',
    agent_name: 'Sara Al Mansouri',
    agent_email: 'sara@example.com',
    message: 'Looking for a stronger MENA-wide platform.',
    current_listings_count: 14,
    status: 'pending',
    created_at: new Date(FIXED_NOW - 2 * 3600000).toISOString(),
    city: 'Dubai',
    years_experience: 5,
  },
  {
    id: 'app_ahmed',
    agency_id: 'agc_1',
    agent_name: 'Ahmed Khan',
    agent_email: 'ahmed@example.com',
    message: 'Interested in joining.',
    current_listings_count: 6,
    status: 'pending',
    created_at: new Date(FIXED_NOW - 5 * 3600000).toISOString(),
    city: 'Abu Dhabi',
    years_experience: 2,
  },
]

function outcomePayload(
  overrides: Partial<ApplicationOutcomePayload> = {},
): ApplicationOutcomePayload {
  return {
    application: {
      id: 'app_01',
      status: 'pending',
      rejected_by: null,
      submitted_at: '2026-09-05T09:14:22Z',
      viewed_at: null,
      decided_at: null,
      resolved_at: null,
      expires_at: '2026-10-05T09:14:22Z',
      sla_days: 3,
      ...(overrides.application || {}),
    },
    agency: {
      tenant_id: 'agency:elite',
      slug: 'elite-real-estate',
      display_name: 'Elite Real Estate',
      logo_url: null,
      primary_market_label: 'Dubai, UAE · Residential & Commercial',
      suspended_at: null,
      deleted_at: null,
      public_profile_url: '/agencies/elite-real-estate',
      ...(overrides.agency || {}),
    },
    decision: {
      resolver: null,
      message: null,
      role_offered: null,
      capability_pack: null,
      affiliation_mode: null,
      ...(overrides.decision || {}),
    },
  }
}

beforeAll(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(SNAPSHOT_NOW)
  class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  vi.stubGlobal('ResizeObserver', ResizeObserverStub)
  Element.prototype.scrollIntoView = vi.fn()
  if (!document.getElementById('broadcast-theme-css')) {
    const style = document.createElement('style')
    style.id = 'broadcast-theme-css'
    style.textContent = THEME_CSS
    document.head.appendChild(style)
  }
})

afterAll(() => {
  vi.useRealTimers()
})

function setViewport(bucket: 'mobile' | 'tablet' | 'desktop') {
  const mobile = bucket === 'mobile'
  const tablet = bucket === 'tablet'
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: (query: string) => {
      let matches = false
      if (query.includes('max-width: 767px')) matches = mobile
      else if (query.includes('max-width: 1023px')) matches = mobile || tablet
      else if (query.includes('min-width: 768px) and (max-width: 1023px)')) matches = tablet
      else if (query.includes('min-width: 768px')) matches = !mobile
      else if (query.includes('min-width: 1024px')) matches = bucket === 'desktop'
      return {
        matches,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }
    },
  })
  Object.defineProperty(window, 'innerWidth', {
    writable: true,
    configurable: true,
    value: bucket === 'mobile' ? 390 : bucket === 'tablet' ? 834 : 1280,
  })
}

function wrapProviders(ui: ReactElement) {
  return (
    <BrandProvider>
      <ToastProvider>{ui}</ToastProvider>
    </BrandProvider>
  )
}

/** Stabilize DOM for snapshots (ids, portals, absolute positions). */
function serialize(root: HTMLElement): string {
  const clone = root.cloneNode(true) as HTMLElement
  clone.querySelectorAll('[id]').forEach((el) => {
    const id = el.getAttribute('id') || ''
    if (id.startsWith('radix-') || id.includes(':') || /^r\d/.test(id)) {
      el.setAttribute('id', '__stable__')
    }
  })
  clone.querySelectorAll('[aria-controls], [aria-labelledby], [aria-describedby], for').forEach((el) => {
    for (const attr of ['aria-controls', 'aria-labelledby', 'aria-describedby', 'for'] as const) {
      if (el.hasAttribute(attr)) el.setAttribute(attr, '__stable__')
    }
  })
  clone.querySelectorAll('[style]').forEach((el) => {
    const style = el.getAttribute('style') || ''
    if (/top:\s*\d/.test(style) || /left:\s*\d/.test(style)) {
      el.setAttribute('style', '/* positioned */')
    }
  })
  const portals = [
    ...document.body.querySelectorAll(
      '[data-radix-portal], [role="dialog"], [role="alertdialog"], [data-vaul-drawer]',
    ),
  ]
    .map((node) => {
      const c = node.cloneNode(true) as HTMLElement
      c.querySelectorAll('[id]').forEach((el) => {
        const id = el.getAttribute('id') || ''
        if (id.startsWith('radix-') || id.includes(':') || /^r\d/.test(id)) {
          el.setAttribute('id', '__stable__')
        }
      })
      return c.outerHTML
    })
    .join('\n')
  const mode = document.documentElement.getAttribute('data-lc-mode') || 'light'
  const dir = document.documentElement.dir || 'ltr'
  const lang = document.documentElement.lang || 'en'
  const vw = window.innerWidth
  return `<!-- mode=${mode} dir=${dir} lang=${lang} vw=${vw} -->\n${clone.innerHTML}\n<!-- portals -->\n${portals}`
}

beforeEach(() => {
  cleanup()
  vi.clearAllMocks()
  vi.setSystemTime(SNAPSHOT_NOW)
  authMock.agent = null
  authMock.loading = false
  document.documentElement.lang = 'en'
  document.documentElement.dir = 'ltr'
  applyLcMode('light')
  setViewport('desktop')
  document.body.querySelectorAll('[data-radix-portal]').forEach((n) => n.remove())
  apiMocks.getMyAgency.mockResolvedValue({ id: 'agc_1', slug: 'elite', my_role: 'owner' })
  apiMocks.listAgencyApplications.mockResolvedValue(QUEUE_SAMPLE)
  apiMocks.getAgencyPublic.mockResolvedValue({
    id: 'a1',
    name: 'Elite Real Estate',
    slug: 'elite-real-estate',
    description: 'Premium residential brokerage across Dubai Marina and Downtown.',
    accepting_applications: true,
    member_count: 24,
    listings_count: 312,
  })
  apiMocks.getMyAgencyApplicationOutcome.mockResolvedValue(outcomePayload())
})

type Fixture = {
  id: string
  mode: 'light' | 'dark'
  dir: 'ltr' | 'rtl'
  viewport: 'mobile' | 'tablet' | 'desktop'
  setup?: () => void | Promise<void>
  render: () => Promise<HTMLElement> | HTMLElement
  after?: () => void | Promise<void>
}

const FIXTURES: Fixture[] = [
  {
    id: 'register-solo',
    mode: 'light',
    dir: 'ltr',
    viewport: 'desktop',
    render: () => {
      const view = render(
        wrapProviders(
          <MemoryRouter initialEntries={['/register?path=solo']}>
            <Routes>
              <Route path="/register" element={<RegisterPage />} />
            </Routes>
          </MemoryRouter>,
        ),
      )
      return view.container
    },
    after: async () => {
      await waitFor(() => expect(screen.getByTestId('identity-form')).toBeInTheDocument())
    },
  },
  {
    id: 'register-join',
    mode: 'dark',
    dir: 'rtl',
    viewport: 'mobile',
    render: () => {
      const view = render(
        wrapProviders(
          <MemoryRouter initialEntries={['/register?path=join&agency=elite-real-estate']}>
            <Routes>
              <Route path="/register" element={<RegisterPage />} />
            </Routes>
          </MemoryRouter>,
        ),
      )
      return view.container
    },
    after: async () => {
      await waitFor(() => expect(screen.getByTestId('identity-form')).toBeInTheDocument())
    },
  },
  {
    id: 'register-agency',
    mode: 'light',
    dir: 'rtl',
    viewport: 'tablet',
    render: () => {
      const view = render(
        wrapProviders(
          <MemoryRouter initialEntries={['/register?path=agency']}>
            <Routes>
              <Route path="/register" element={<RegisterPage />} />
            </Routes>
          </MemoryRouter>,
        ),
      )
      return view.container
    },
    after: async () => {
      await waitFor(() => expect(screen.getByTestId('identity-form')).toBeInTheDocument())
    },
  },
  {
    id: 'public-apply-form',
    mode: 'light',
    dir: 'ltr',
    viewport: 'desktop',
    render: () => {
      const view = render(
        wrapProviders(
          <MemoryRouter initialEntries={['/agencies/elite-real-estate/apply']}>
            <Routes>
              <Route path="/agencies/:agencySlug/apply" element={<PublicAgencyApplyPage />} />
            </Routes>
          </MemoryRouter>,
        ),
      )
      return view.container
    },
    after: async () => {
      await waitFor(() =>
        expect(screen.getByRole('region', { name: /Agency you are applying to/i })).toBeInTheDocument(),
      )
    },
  },
  {
    id: 'public-apply-not-accepting',
    mode: 'dark',
    dir: 'rtl',
    viewport: 'mobile',
    setup: () => {
      apiMocks.getAgencyPublic.mockResolvedValue({
        id: 'a1',
        name: 'Elite Real Estate',
        slug: 'elite-real-estate',
        accepting_applications: false,
        member_count: 24,
        listings_count: 312,
        city: 'UAE',
      })
    },
    render: () => {
      const view = render(
        wrapProviders(
          <MemoryRouter initialEntries={['/agencies/elite-real-estate/apply']}>
            <Routes>
              <Route path="/agencies/:agencySlug/apply" element={<PublicAgencyApplyPage />} />
              <Route path="/agencies" element={<div>Browse</div>} />
            </Routes>
          </MemoryRouter>,
        ),
      )
      return view.container
    },
    after: async () => {
      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent(/isn't accepting/)
      })
    },
  },
  {
    id: 'applications-queue',
    mode: 'light',
    dir: 'ltr',
    viewport: 'desktop',
    setup: () => {
      authMock.agent = {
        id: 'usr_admin',
        email: 'owner@example.com',
        name: 'Owner',
        affiliation: { role: 'owner' },
      }
    },
    render: () => {
      const view = render(
        wrapProviders(
          <MemoryRouter initialEntries={['/agency/members/applications']}>
            <Routes>
              <Route path="/agency/members/applications" element={<ApplicationsQueuePage />} />
            </Routes>
          </MemoryRouter>,
        ),
      )
      return view.container
    },
    after: async () => {
      await waitFor(() => expect(screen.getByText(/Sara Al Mansouri/i)).toBeInTheDocument())
    },
  },
  {
    id: 'applications-queue-mobile-gate',
    mode: 'light',
    dir: 'ltr',
    viewport: 'mobile',
    setup: () => {
      authMock.agent = {
        id: 'usr_admin',
        email: 'owner@example.com',
        name: 'Owner',
        affiliation: { role: 'owner' },
      }
    },
    render: () => {
      const view = render(
        wrapProviders(
          <MemoryRouter initialEntries={['/agency/members/applications']}>
            <Routes>
              <Route path="/agency/members/applications" element={<ApplicationsQueuePage />} />
              <Route path="/agency" element={<div>agency home</div>} />
            </Routes>
          </MemoryRouter>,
        ),
      )
      return view.container
    },
    after: async () => {
      await waitFor(() =>
        expect(screen.getByTestId('applications-queue-mobile-gate')).toBeInTheDocument(),
      )
    },
  },
  {
    id: 'applications-queue-shortcuts',
    mode: 'dark',
    dir: 'rtl',
    viewport: 'desktop',
    setup: () => {
      authMock.agent = {
        id: 'usr_admin',
        email: 'owner@example.com',
        name: 'Owner',
        affiliation: { role: 'owner' },
      }
    },
    render: () => {
      const view = render(
        wrapProviders(
          <MemoryRouter initialEntries={['/agency/members/applications']}>
            <Routes>
              <Route path="/agency/members/applications" element={<ApplicationsQueuePage />} />
            </Routes>
          </MemoryRouter>,
        ),
      )
      return view.container
    },
    after: async () => {
      await waitFor(() => expect(screen.getByText(/Sara Al Mansouri/i)).toBeInTheDocument())
      const user = userEvent.setup()
      await user.click(screen.getByRole('button', { name: /Show keyboard shortcuts/i }))
      await screen.findByRole('dialog')
    },
  },
  {
    id: 'application-detail',
    mode: 'light',
    dir: 'ltr',
    viewport: 'desktop',
    setup: () => {
      authMock.agent = {
        id: 'usr_admin',
        email: 'owner@example.com',
        name: 'Owner',
        affiliation: { role: 'owner' },
      }
      apiMocks.listAgencyApplications.mockResolvedValue([
          {
            ...QUEUE_SAMPLE[0],
            applicant_user_id: 'usr_sara',
            agent_phone: '+971501234567',
            portfolio_url: 'https://sara-portfolio.example.com',
          },
          QUEUE_SAMPLE[1],
        ])
    },
    render: () => {
      const view = render(
        wrapProviders(
          <MemoryRouter initialEntries={['/agency/members/applications/app_sara']}>
            <Routes>
              <Route
                path="/agency/members/applications/:applicationId"
                element={<ApplicationDetailPage />}
              />
            </Routes>
          </MemoryRouter>,
        ),
      )
      return view.container
    },
    after: async () => {
      await waitFor(() => expect(screen.getByTestId('application-detail-page')).toBeInTheDocument())
    },
  },
  {
    id: 'application-detail-approve-dialog',
    mode: 'dark',
    dir: 'ltr',
    viewport: 'desktop',
    setup: () => {
      authMock.agent = {
        id: 'usr_admin',
        email: 'owner@example.com',
        name: 'Owner',
        affiliation: { role: 'owner' },
      }
      apiMocks.listAgencyApplications.mockResolvedValue([
          {
            ...QUEUE_SAMPLE[0],
            applicant_user_id: 'usr_sara',
            agent_phone: '+971501234567',
          },
          QUEUE_SAMPLE[1],
        ])
    },
    render: () => {
      const view = render(
        wrapProviders(
          <MemoryRouter initialEntries={['/agency/members/applications/app_sara']}>
            <Routes>
              <Route
                path="/agency/members/applications/:applicationId"
                element={<ApplicationDetailPage />}
              />
            </Routes>
          </MemoryRouter>,
        ),
      )
      return view.container
    },
    after: async () => {
      await waitFor(() => expect(screen.getByTestId('application-detail-page')).toBeInTheDocument())
      const user = userEvent.setup()
      await user.click(screen.getByRole('button', { name: /Approve application/i }))
      await screen.findByRole('alertdialog')
    },
  },
  {
    id: 'outcome-pending',
    mode: 'light',
    dir: 'ltr',
    viewport: 'mobile',
    render: () => {
      const view = render(
        wrapProviders(
          <MemoryRouter initialEntries={['/applications/app_01']}>
            <Routes>
              <Route path="/applications/:applicationId" element={<ApplicationOutcomePage />} />
            </Routes>
          </MemoryRouter>,
        ),
      )
      return view.container
    },
    after: async () => {
      await waitFor(() => {
        expect(screen.getByText(/Awaiting Elite Real Estate/i)).toBeInTheDocument()
      })
    },
  },
  {
    id: 'outcome-approved',
    mode: 'dark',
    dir: 'rtl',
    viewport: 'desktop',
    setup: () => {
      apiMocks.getMyAgencyApplicationOutcome.mockResolvedValue(
        outcomePayload({
          application: {
            id: 'app_01',
            status: 'approved',
            rejected_by: null,
            submitted_at: '2026-09-05T09:14:22Z',
            viewed_at: '2026-09-05T10:00:00Z',
            decided_at: '2026-09-06T10:00:00Z',
            resolved_at: '2026-09-06T10:00:00Z',
            expires_at: '2026-10-05T09:14:22Z',
            sla_days: 3,
          },
          decision: {
            resolver: {
              user_id: 'usr_nadia',
              display_name: 'Nadia Owner',
              role_label: 'Owner',
              avatar_url: null,
            },
            message: 'Welcome to Elite.',
            role_offered: 'agent',
            capability_pack: 'standard',
            affiliation_mode: 'non_exclusive',
          },
        }),
      )
    },
    render: () => {
      const view = render(
        wrapProviders(
          <MemoryRouter initialEntries={['/applications/app_01']}>
            <Routes>
              <Route path="/applications/:applicationId" element={<ApplicationOutcomePage />} />
            </Routes>
          </MemoryRouter>,
        ),
      )
      return view.container
    },
    after: async () => {
      await waitFor(() => expect(document.body.textContent).toMatch(/Welcome|approved|Elite/i))
    },
  },
  {
    id: 'outcome-rejected',
    mode: 'light',
    dir: 'rtl',
    viewport: 'tablet',
    setup: () => {
      apiMocks.getMyAgencyApplicationOutcome.mockResolvedValue(
        outcomePayload({
          application: {
            id: 'app_01',
            status: 'rejected',
            rejected_by: 'agency',
            submitted_at: '2026-09-05T09:14:22Z',
            viewed_at: '2026-09-05T10:00:00Z',
            decided_at: '2026-09-06T10:00:00Z',
            resolved_at: '2026-09-06T10:00:00Z',
            expires_at: '2026-10-05T09:14:22Z',
            sla_days: 3,
          },
          decision: {
            resolver: {
              user_id: 'usr_nadia',
              display_name: 'Nadia Owner',
              role_label: 'Owner',
              avatar_url: null,
            },
            message: 'Not a fit for our current markets.',
            role_offered: null,
            capability_pack: null,
            affiliation_mode: null,
          },
        }),
      )
    },
    render: () => {
      const view = render(
        wrapProviders(
          <MemoryRouter initialEntries={['/applications/app_01']}>
            <Routes>
              <Route path="/applications/:applicationId" element={<ApplicationOutcomePage />} />
            </Routes>
          </MemoryRouter>,
        ),
      )
      return view.container
    },
    after: async () => {
      await waitFor(() =>
        expect(document.body.textContent).toMatch(/not to proceed|decided not|Not a fit/i),
      )
    },
  },
  {
    id: 'outcome-expired',
    mode: 'dark',
    dir: 'ltr',
    viewport: 'mobile',
    setup: () => {
      apiMocks.getMyAgencyApplicationOutcome.mockResolvedValue(
        outcomePayload({
          application: {
            id: 'app_01',
            status: 'expired',
            rejected_by: null,
            submitted_at: '2026-08-01T09:14:22Z',
            viewed_at: null,
            decided_at: null,
            resolved_at: '2026-08-31T09:14:22Z',
            expires_at: '2026-08-31T09:14:22Z',
            sla_days: 3,
          },
        }),
      )
    },
    render: () => {
      const view = render(
        wrapProviders(
          <MemoryRouter initialEntries={['/applications/app_01']}>
            <Routes>
              <Route path="/applications/:applicationId" element={<ApplicationOutcomePage />} />
            </Routes>
          </MemoryRouter>,
        ),
      )
      return view.container
    },
    after: async () => {
      await waitFor(() => expect(document.body.textContent).toMatch(/expir/i))
    },
  },
  {
    id: 'dup-identity-modal',
    mode: 'light',
    dir: 'rtl',
    viewport: 'desktop',
    render: () => {
      const view = render(
        wrapProviders(
          <MemoryRouter>
            <DupIdentityModal open onOpenChange={() => {}} />
          </MemoryRouter>,
        ),
      )
      return view.container
    },
    after: async () => {
      await screen.findByRole('dialog')
    },
  },
]

expect(FIXTURES.length).toBe(15)

describe('Wave 1 visual matrix — 15 snapshots (LTR/RTL × light/dark × viewport)', () => {
  for (const fixture of FIXTURES) {
    it(`${fixture.id} · ${fixture.mode} · ${fixture.dir} · ${fixture.viewport}`, async () => {
      applyLcMode(fixture.mode)
      document.documentElement.dir = fixture.dir
      document.documentElement.lang = fixture.dir === 'rtl' ? 'ar' : 'en'
      setViewport(fixture.viewport)
      await fixture.setup?.()
      const container = await fixture.render()
      await fixture.after?.()
      expect(serialize(container)).toMatchSnapshot()
    })
  }
})
