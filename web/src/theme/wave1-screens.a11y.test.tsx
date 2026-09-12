// @vitest-environment jsdom
/**
 * Wave 1 WF-02 screens — accessibility contract
 * (CURSOR_SCREEN_WAVE_1_WF02_SIGNUP §3 item 7 / §4 non-negotiables 3–7).
 *
 * Covers: ≥44×44 tap targets, two-tone focus rings, aria-live for status /
 * counter / password strength, focus traps + Escape on dialogs/sheets,
 * RTL dir smoke, jest-axe on key states.
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { axe, toHaveNoViolations } from 'jest-axe'
import type { ReactElement } from 'react'
import { applyLcMode } from '@/theme/mode'
import { ToastProvider } from '@/components/ui/toast'
import { BrandProvider } from '@/context/BrandContext'
import { DupIdentityModal } from '@/components/auth/DupIdentityModal'
import { IdentityForm, EMPTY_IDENTITY_FORM_VALUES } from '@/components/forms/IdentityForm'
import type { ApplicationOutcomePayload } from '@/pages/agent/applicationOutcomeTypes'
import type { AgencyApplicationRaw } from '@/pages/agency/applicationsTypes'

expect.extend(toHaveNoViolations)

const TAP_FLOOR =
  /(^|\s)(min-h-tap|h-tap|min-h-\[var\(--lc-tap-target-min\)\]|min-h-\[44px\])(\s|$)/

const THEME_CSS = readFileSync(
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../docs/design-tokens/broadcast-theme.css'),
  'utf8',
)

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

const FIXED_NOW = new Date('2026-09-08T12:00:00.000Z').getTime()

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

beforeEach(() => {
  cleanup()
  vi.clearAllMocks()
  authMock.agent = null
  authMock.loading = false
  document.documentElement.lang = 'en'
  document.documentElement.dir = 'ltr'
  applyLcMode('light')
  apiMocks.getMyAgency.mockResolvedValue({ id: 'agc_1', slug: 'elite', my_role: 'owner' })
  apiMocks.listAgencyApplications.mockResolvedValue(QUEUE_SAMPLE)
  apiMocks.getAgencyPublic.mockResolvedValue({
    id: 'a1',
    name: 'Elite Real Estate',
    slug: 'elite-real-estate',
    description: 'Premium residential',
    accepting_applications: true,
    member_count: 24,
    listings_count: 312,
  })
  apiMocks.getMyAgencyApplicationOutcome.mockResolvedValue(outcomePayload())
  // Desktop by default for agency console
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: (query: string) => ({
      matches: query.includes('max-width: 767px') ? false : query.includes('min-width: 768px'),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }),
  })
})

function wrapProviders(ui: ReactElement) {
  return (
    <BrandProvider>
      <ToastProvider>{ui}</ToastProvider>
    </BrandProvider>
  )
}

function renderRegister(path = '/register?path=solo') {
  return render(
    wrapProviders(
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/register" element={<RegisterPage />} />
        </Routes>
      </MemoryRouter>,
    ),
  )
}

function renderApply(path = '/agencies/elite-real-estate/apply') {
  return render(
    wrapProviders(
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/agencies/:agencySlug/apply" element={<PublicAgencyApplyPage />} />
          <Route path="/join/:invitationCode" element={<PublicAgencyApplyPage />} />
          <Route path="/agencies" element={<div>Browse</div>} />
          <Route path="/login" element={<div>Login</div>} />
        </Routes>
      </MemoryRouter>,
    ),
  )
}

function renderQueue(path = '/agency/members/applications') {
  authMock.agent = {
    id: 'usr_admin',
    email: 'owner@example.com',
    name: 'Owner',
    affiliation: { role: 'owner' },
  }
  return render(
    wrapProviders(
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/agency/members/applications" element={<ApplicationsQueuePage />} />
          <Route path="/agency" element={<div>agency home</div>} />
        </Routes>
      </MemoryRouter>,
    ),
  )
}

function renderDetail(path = '/agency/members/applications/app_sara') {
  authMock.agent = {
    id: 'usr_admin',
    email: 'owner@example.com',
    name: 'Owner',
    affiliation: { role: 'owner' },
  }
  apiMocks.listAgencyApplications.mockResolvedValue([
    {
      ...QUEUE_SAMPLE[0]!,
      applicant_user_id: 'usr_sara',
      agent_phone: '+971501234567',
      portfolio_url: 'https://sara-portfolio.example.com',
    },
    QUEUE_SAMPLE[1]!,
  ])
  return render(
    wrapProviders(
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/agency/members/applications" element={<div>queue</div>} />
          <Route
            path="/agency/members/applications/:applicationId"
            element={<ApplicationDetailPage />}
          />
          <Route path="/agency" element={<div>agency home</div>} />
        </Routes>
      </MemoryRouter>,
    ),
  )
}

function renderOutcome(path = '/applications/app_01') {
  return render(
    wrapProviders(
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/applications/:applicationId" element={<ApplicationOutcomePage />} />
        </Routes>
      </MemoryRouter>,
    ),
  )
}

function assertTapFloor(el: Element, label: string) {
  const cls = (el as HTMLElement).className || ''
  const styleMin = typeof window !== 'undefined' ? getComputedStyle(el).minHeight : ''
  const hasClass = TAP_FLOOR.test(cls)
  const hasCssFloor =
    styleMin === '44px' ||
    styleMin.includes('var(--lc-tap-target-min)') ||
    (el.tagName === 'BUTTON' && THEME_CSS.includes('min-height: var(--lc-tap-target-min)'))
  expect(hasClass || hasCssFloor, `${label} must meet 44px tap floor`).toBe(true)
}

describe('Wave 1 a11y — theme contracts (focus + tap)', () => {
  it('broadcast theme ships 44px button floor + two-tone focus ring', () => {
    expect(THEME_CSS).toContain('--lc-tap-target-min: 44px')
    expect(THEME_CSS).toMatch(/:where\(button[^)]*\).*min-height:\s*var\(--lc-tap-target-min\)/s)
    expect(THEME_CSS).toContain('0 0 0 2px var(--lc-focus-ring)')
    expect(THEME_CSS).toContain('0 0 0 4px var(--lc-focus-ring-contrast)')
    expect(THEME_CSS).toMatch(/:focus-visible[\s\S]*--lc-focus-ring/)
  })
})

describe('Wave 1 a11y — RegisterPage (SHR-AUT-006)', () => {
  it('path cards and OAuth / Continue meet tap floor; skip link present', async () => {
    renderRegister('/register?path=solo')
    expect(screen.getByText(/Skip to/i)).toHaveAttribute('href', '#register-content')
    const pathCard = screen.getByTestId('path-card-solo')
    assertTapFloor(pathCard, 'path card solo')
    await waitFor(() => expect(screen.getByTestId('identity-form')).toBeInTheDocument())
    const continueBtn = screen.getAllByRole('button', { name: /Continue/i })[0]!
    assertTapFloor(continueBtn, 'Continue')
  })

  it('password strength meter announces via aria-live polite', async () => {
    const user = userEvent.setup()
    const values = { ...EMPTY_IDENTITY_FORM_VALUES, email: 'a@b.co', consent_terms: true }
    const onChange = vi.fn()
    render(
      wrapProviders(
        <IdentityForm
          values={values}
          onChange={onChange}
          onSubmit={() => undefined}
          fieldErrors={{}}
        />,
      ),
    )
    expect(document.querySelector('[aria-live="polite"]')).toBeTruthy()
    const password = screen.getByLabelText('Password', { selector: 'input' })
    await user.type(password, 'FairPass1!')
    expect(document.querySelector('[aria-live="polite"]')).toBeTruthy()
  })

  it('DupIdentityModal traps focus and closes on Escape', async () => {
    const user = userEvent.setup()
    const onOpenChange = vi.fn()
    render(
      wrapProviders(
        <MemoryRouter>
          <DupIdentityModal open onOpenChange={onOpenChange} />
        </MemoryRouter>,
      ),
    )
    const dialog = await screen.findByRole('dialog')
    await waitFor(() => {
      expect(dialog.contains(document.activeElement)).toBe(true)
    })
    for (let i = 0; i < 6; i += 1) {
      await user.tab()
      expect(dialog.contains(document.activeElement)).toBe(true)
    }
    await user.keyboard('{Escape}')
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it.each(['ltr', 'rtl'] as const)('axe clean on path=solo · %s', async (dir) => {
    document.documentElement.dir = dir
    document.documentElement.lang = dir === 'rtl' ? 'ar' : 'en'
    const { container } = renderRegister('/register?path=solo')
    await waitFor(() => expect(screen.getByTestId('identity-form')).toBeInTheDocument())
    expect(
      await axe(container, {
        rules: {
          // React 18 useId() colon ids — known axe false positive on some controls.
          'aria-valid-attr-value': { enabled: false },
        },
      }),
    ).toHaveNoViolations()
  })
})

describe('Wave 1 a11y — PublicAgencyApplyPage (AGN-MEM-005)', () => {
  it('agency card is a labeled region; skip link + tap floor on Submit', async () => {
    renderApply()
    await waitFor(() => {
      expect(screen.getByRole('region', { name: /Agency you are applying to/i })).toBeInTheDocument()
    })
    expect(screen.getByText(/Skip to content/i)).toBeInTheDocument()
    const submit = screen.getByRole('button', { name: /Submit application/i })
    assertTapFloor(submit, 'apply submit')
  })

  it('character counter announces via aria-live on thresholds', async () => {
    const user = userEvent.setup()
    authMock.agent = { id: 'u1', name: 'Sara', email: 'sara@example.com' }
    renderApply()
    await waitFor(() => {
      expect(screen.getByRole('region', { name: /Agency you are applying to/i })).toBeInTheDocument()
    })
    const message = screen.getByRole('textbox', { name: /Message to the agency/i })
    await user.type(message, 'x'.repeat(25))
    expect(document.querySelector('[aria-live="polite"]')).toBeTruthy()
  })

  it('not-accepting empty state is an alert', async () => {
    apiMocks.getAgencyPublic.mockResolvedValue({
      id: 'a1',
      name: 'Elite Real Estate',
      slug: 'elite-real-estate',
      accepting_applications: false,
      member_count: 2,
      listings_count: 1,
      city: 'UAE',
    })
    renderApply()
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/isn't accepting/)
    })
  })

  it('invitation ContactAgencyDialog traps focus and Escape closes', async () => {
    const user = userEvent.setup()
    apiMocks.resolveInvitation.mockResolvedValue({
      code: 'abc',
      status: 'expired',
      expires_at: '2026-09-01T00:00:00Z',
      single_use: true,
      agency: {
        id: 'a1',
        name: 'Elite Real Estate',
        slug: 'elite-real-estate',
        logo: null,
        description: null,
      },
    })
    render(
      wrapProviders(
        <MemoryRouter initialEntries={['/join/abc']}>
          <Routes>
            <Route path="/join/:invitationCode" element={<PublicAgencyApplyPage />} />
            <Route path="/agencies" element={<div>Browse</div>} />
          </Routes>
        </MemoryRouter>,
      ),
    )
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/invitation has expired/i)
    })
    const contact = screen.getByRole('button', { name: /Contact the agency/i })
    await user.click(contact)
    const dialog = await screen.findByRole('dialog')
    await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true))
    await user.keyboard('{Escape}')
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
  })

  it('RTL dir + axe on accepting form', async () => {
    document.documentElement.dir = 'rtl'
    document.documentElement.lang = 'ar'
    const { container } = renderApply()
    await waitFor(() =>
      expect(screen.getByRole('region', { name: /Agency you are applying to/i })).toBeInTheDocument(),
    )
    expect(
      await axe(container, { rules: { 'aria-valid-attr-value': { enabled: false } } }),
    ).toHaveNoViolations()
  })
})

describe('Wave 1 a11y — ApplicationsQueuePage (AGN-MEM-002)', () => {
  it('loads with h1, filter label, and row action tap floors', async () => {
    renderQueue()
    await waitFor(() => expect(screen.getByText(/Sara Al Mansouri/i)).toBeInTheDocument())
    expect(screen.getByRole('heading', { level: 1, name: /Applications/i })).toBeInTheDocument()
    expect(screen.getByLabelText(/Filter applications/i)).toBeInTheDocument()
    const reject = screen.getAllByRole('button', { name: /^Reject$/i })[0]
    assertTapFloor(reject!, 'inline Reject')
  })

  it('keyboard shortcuts panel traps focus and Escape closes', async () => {
    const user = userEvent.setup()
    renderQueue()
    await waitFor(() => expect(screen.getByText(/Sara Al Mansouri/i)).toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: /Show keyboard shortcuts/i }))
    const panel = await screen.findByRole('dialog')
    await waitFor(() => expect(panel.contains(document.activeElement)).toBe(true))
    for (let i = 0; i < 4; i += 1) {
      await user.tab()
      expect(panel.contains(document.activeElement)).toBe(true)
    }
    await user.keyboard('{Escape}')
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
  })

  it('reject dialog exposes aria-live helper and Escape closes', async () => {
    const user = userEvent.setup()
    renderQueue()
    await waitFor(() => expect(screen.getByText(/Sara Al Mansouri/i)).toBeInTheDocument())
    await user.click(screen.getAllByRole('button', { name: /^Reject$/i })[0]!)
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByRole('heading', { name: /Reject/i })).toBeInTheDocument()
    expect(dialog.querySelector('[aria-live="polite"]')).toBeTruthy()
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('axe clean on loaded queue (desktop)', async () => {
    const { container } = renderQueue()
    await waitFor(() => expect(screen.getByText(/Sara Al Mansouri/i)).toBeInTheDocument())
    expect(
      await axe(container, { rules: { 'aria-valid-attr-value': { enabled: false } } }),
    ).toHaveNoViolations()
  })
})

describe('Wave 1 a11y — ApplicationDetailPage (AGN-MEM-002b)', () => {
  it('approve alertdialog traps focus; Escape closes; aria-live present', async () => {
    const user = userEvent.setup()
    renderDetail()
    await waitFor(() => expect(screen.getByTestId('application-detail-page')).toBeInTheDocument())
    expect(document.querySelector('[aria-live="polite"]')).toBeTruthy()
    const approve = screen.getByRole('button', { name: /Approve application/i })
    assertTapFloor(approve, 'detail Approve')
    await user.click(approve)
    const dialog = await screen.findByRole('alertdialog')
    await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true))
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
  })

  it('RTL + axe on loaded detail', async () => {
    document.documentElement.dir = 'rtl'
    const { container } = renderDetail()
    await waitFor(() => expect(screen.getByTestId('application-detail-page')).toBeInTheDocument())
    expect(
      await axe(container, { rules: { 'aria-valid-attr-value': { enabled: false } } }),
    ).toHaveNoViolations()
  })
})

describe('Wave 1 a11y — ApplicationOutcomePage (AGT-REC-004)', () => {
  it('status hero + polite live region; CTA tap floor', async () => {
    renderOutcome()
    await waitFor(() => {
      expect(screen.getByText(/Awaiting Elite Real Estate/i)).toBeInTheDocument()
    })
    expect(document.querySelector('[aria-live="polite"]')).toBeTruthy()
    const withdraw = screen.getAllByRole('button', { name: /Withdraw application/i })[0]!
    assertTapFloor(withdraw, 'Withdraw')
  })

  it('Withdraw confirm dialog traps focus and Escape closes', async () => {
    const user = userEvent.setup()
    renderOutcome()
    await waitFor(() => {
      expect(screen.getByText(/Awaiting Elite Real Estate/i)).toBeInTheDocument()
    })
    await user.click(screen.getAllByRole('button', { name: /Withdraw application/i })[0]!)
    const dialog = await screen.findByRole('dialog')
    await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true))
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it.each(['approved', 'rejected', 'expired'] as const)('axe clean on %s state', async (status) => {
    apiMocks.getMyAgencyApplicationOutcome.mockResolvedValue(
      outcomePayload({
        application: {
          id: 'app_01',
          status,
          rejected_by: status === 'rejected' ? 'agency' : null,
          submitted_at: '2026-09-05T09:14:22Z',
          viewed_at: '2026-09-05T10:00:00Z',
          decided_at: '2026-09-06T10:00:00Z',
          resolved_at: '2026-09-06T10:00:00Z',
          expires_at: '2026-10-05T09:14:22Z',
          sla_days: 3,
        },
        decision:
          status === 'approved'
            ? {
                resolver: {
                  user_id: 'usr_owner',
                  display_name: 'Owner',
                  role_label: 'Owner',
                  avatar_url: null,
                },
                message: 'Welcome aboard.',
                role_offered: 'agent',
                capability_pack: 'standard',
                affiliation_mode: 'non_exclusive',
              }
            : {
                resolver: {
                  user_id: 'usr_owner',
                  display_name: 'Owner',
                  role_label: 'Owner',
                  avatar_url: null,
                },
                message: status === 'rejected' ? 'Not a fit right now.' : null,
                role_offered: null,
                capability_pack: null,
                affiliation_mode: null,
              },
      }),
    )
    const { container } = renderOutcome()
    await waitFor(() => {
      expect(document.body.textContent).toMatch(/Elite Real Estate/)
    })
    expect(
      await axe(container, { rules: { 'aria-valid-attr-value': { enabled: false } } }),
    ).toHaveNoViolations()
  })

  it('dark + rtl outcome pending passes axe', async () => {
    applyLcMode('dark')
    document.documentElement.dir = 'rtl'
    document.documentElement.lang = 'ar'
    const { container } = renderOutcome()
    await waitFor(() => {
      expect(screen.getByText(/Awaiting Elite Real Estate/i)).toBeInTheDocument()
    })
    expect(
      await axe(container, { rules: { 'aria-valid-attr-value': { enabled: false } } }),
    ).toHaveNoViolations()
  })
})
