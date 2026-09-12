// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import {
  AgencyIdentityCard,
  PersonaChip,
  AgencyEmptyState,
  ApplicationSuccessPanel,
  GuestSignupCollapsible,
  AgencyApplicationForm,
  mapRefQueryToReferral,
} from '@/components/agency'
import { EMPTY_IDENTITY_FORM_VALUES } from '@/components/forms'

describe('AgencyIdentityCard', () => {
  it('renders name, meta chips with Numeric, and omits missing chips', () => {
    render(
      <AgencyIdentityCard
        name="Elite Real Estate"
        description="MENA specialist brokerage"
        teamSize={24}
        primaryMarket="UAE"
        activeListingsCount={312}
        foundedYear={2011}
      />,
    )
    expect(screen.getByRole('region', { name: /agency you are applying to/i })).toBeInTheDocument()
    expect(screen.getByText('Elite Real Estate')).toBeInTheDocument()
    expect(screen.getByText(/Team of/)).toBeInTheDocument()
    expect(screen.getByText('24')).toBeInTheDocument()
    expect(screen.getByText('UAE')).toBeInTheDocument()
    expect(screen.getByText('312')).toBeInTheDocument()
    expect(screen.getByText(/Since/)).toBeInTheDocument()
  })

  it('shows invitation badge and expiry caption', () => {
    render(
      <AgencyIdentityCard
        name="Elite Real Estate"
        invitedByLabel="Invited by Rashid"
        invitationExpiresAt="2026-09-20T00:00:00Z"
      />,
    )
    expect(screen.getByText('Invited by Rashid')).toBeInTheDocument()
    expect(screen.getByText(/This invitation expires on/)).toBeInTheDocument()
  })
})

describe('PersonaChip', () => {
  it('renders role badge', () => {
    const { container } = render(<PersonaChip role="owner" />)
    expect(screen.getByText('Owner')).toBeInTheDocument()
    expect(container.querySelector('[data-persona="owner"]')).toBeTruthy()
  })

  it('renders apply anonymous chip with Sign in link', () => {
    render(
      <MemoryRouter>
        <PersonaChip variant="apply" signedIn={false} signInHref="/login?returnTo=%2Fagencies%2Fx%2Fapply" />
      </MemoryRouter>,
    )
    expect(screen.getByText(/Already have an account/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute(
      'href',
      '/login?returnTo=%2Fagencies%2Fx%2Fapply',
    )
  })

  it('renders apply signed-in chip with Sign out', async () => {
    const user = userEvent.setup()
    const onSignOut = vi.fn()
    render(
      <MemoryRouter>
        <PersonaChip
          variant="apply"
          signedIn
          displayName="Sara Almansoori"
          email="sara@example.com"
          onSignOut={onSignOut}
        />
      </MemoryRouter>,
    )
    expect(screen.getByText(/Applying as/)).toBeInTheDocument()
    expect(screen.getByText('Sara Almansoori')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Sign out/i }))
    expect(onSignOut).toHaveBeenCalled()
  })
})

describe('AgencyEmptyState', () => {
  it('renders not-accepting with closed glyph', () => {
    render(
      <MemoryRouter>
        <AgencyEmptyState variant="not-accepting" agencyName="Elite Real Estate" />
      </MemoryRouter>,
    )
    expect(screen.getByRole('alert')).toHaveTextContent(/isn't accepting/)
    expect(screen.getByRole('link', { name: /Browse other agencies/i })).toHaveAttribute(
      'href',
      '/agencies',
    )
  })

  it('renders already-applied with status CTA', () => {
    render(
      <MemoryRouter>
        <AgencyEmptyState
          variant="already-applied"
          agencyName="Elite Real Estate"
          applicationStatus="pending"
          applicationStatusHref="/applications/abc"
        />
      </MemoryRouter>,
    )
    expect(screen.getByText(/already applied/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /See your application status/i })).toHaveAttribute(
      'href',
      '/applications/abc',
    )
  })
})

describe('ApplicationSuccessPanel', () => {
  it('shows published glyph and last-6 ref', () => {
    render(
      <MemoryRouter>
        <ApplicationSuccessPanel
          agencyName="Elite Real Estate"
          ownerFirstName="Rashid"
          applicationId="12345678-abcd-ef00-0000-abcdef123456"
        />
      </MemoryRouter>,
    )
    expect(screen.getByRole('status')).toHaveTextContent(/Application sent to Elite Real Estate/)
    expect(screen.getByText('123456')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Track your application/i })).toHaveAttribute(
      'href',
      '/applications/12345678-abcd-ef00-0000-abcdef123456',
    )
  })
})

describe('GuestSignupCollapsible + IdentityForm compact', () => {
  it('embeds IdentityForm compact fields when expanded', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    const onOpenChange = vi.fn()
    render(
      <GuestSignupCollapsible
        open={false}
        onOpenChange={onOpenChange}
        values={EMPTY_IDENTITY_FORM_VALUES}
        onChange={onChange}
      />,
    )
    expect(screen.queryByLabelText('Your name')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Sign in or continue as guest/i }))
    expect(onOpenChange).toHaveBeenCalledWith(true)
  })

  it('shows compact identity fields when open', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(
      <GuestSignupCollapsible
        open
        onOpenChange={vi.fn()}
        values={{ ...EMPTY_IDENTITY_FORM_VALUES, display_name: 'Sara' }}
        onChange={onChange}
      />,
    )
    expect(screen.getByLabelText('Your name')).toHaveValue('Sara')
    expect(screen.getByLabelText('Your email')).toBeInTheDocument()
    expect(screen.getByLabelText('Choose a password')).toBeInTheDocument()
    await user.type(screen.getByLabelText('Your email'), 'a@b.co')
    expect(onChange).toHaveBeenCalled()
  })
})

describe('mapRefQueryToReferral', () => {
  it('maps known ref aliases', () => {
    expect(mapRefQueryToReferral('bazaar')).toBe('bazaar')
    expect(mapRefQueryToReferral('whatsapp')).toBe('direct')
    expect(mapRefQueryToReferral('unknown-source')).toBe('other')
    expect(mapRefQueryToReferral(null)).toBe('')
  })
})

describe('AgencyApplicationForm', () => {
  beforeEach(() => {
    vi.stubGlobal('navigator', { ...navigator, onLine: true })
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('disables submit until consents + message + availability for signed-in user', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(
      <AgencyApplicationForm
        agencyName="Elite Real Estate"
        signedIn
        signedInDisplayName="Sara"
        signedInEmail="sara@example.com"
        initialReferral="bazaar"
        guestValues={EMPTY_IDENTITY_FORM_VALUES}
        onGuestValuesChange={vi.fn()}
        guestOpen={false}
        onGuestOpenChange={vi.fn()}
        onCancel={vi.fn()}
        onSubmit={onSubmit}
      />,
    )

    const submit = screen.getByRole('button', { name: /Submit application/i })
    expect(submit).toBeDisabled()

    await user.type(
      screen.getByLabelText(/Message to the agency/i),
      'I sell in Dubai Marina and want a stronger off-plan pipeline.',
    )
    await user.click(screen.getByText('Within 2 weeks'))
    const checkboxes = screen.getAllByRole('checkbox')
    await user.click(checkboxes[0]!)
    await user.click(checkboxes[1]!)

    expect(submit).not.toBeDisabled()
    await user.click(submit)
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining('Dubai Marina'),
        availability: 'within_2_weeks',
        referral_source: 'bazaar',
        consents: { terms: true, profile_share: true },
      }),
    )
  })

  it('hides referral field in invitation mode', () => {
    render(
      <AgencyApplicationForm
        agencyName="Elite Real Estate"
        signedIn
        invitationMode
        guestValues={EMPTY_IDENTITY_FORM_VALUES}
        onGuestValuesChange={vi.fn()}
        guestOpen={false}
        onGuestOpenChange={vi.fn()}
        onCancel={vi.fn()}
        onSubmit={vi.fn()}
      />,
    )
    expect(screen.queryByText(/Where did you hear about/i)).not.toBeInTheDocument()
  })
})
