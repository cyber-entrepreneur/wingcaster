// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { PathBFields } from './PathBFields'
import { PathCFields, EMPTY_PATH_C_VALUES } from './PathCFields'
import { HeroPanel } from './HeroPanel'
import { TrustFooter } from './TrustFooter'
import { DupIdentityModal } from './DupIdentityModal'
import { BrandProvider } from '@/context/BrandContext'
import { OAuthTrio } from './OAuthTrio'

vi.mock('@/context/BrandContext', async () => {
  const actual = await vi.importActual<typeof import('@/context/BrandContext')>(
    '@/context/BrandContext',
  )
  return {
    ...actual,
    useMode: () => ['light', vi.fn()] as const,
  }
})

describe('PathBFields', () => {
  it('renders slug input and browse link', () => {
    render(
      <MemoryRouter>
        <PathBFields value="elite-real-estate" onChange={() => undefined} />
      </MemoryRouter>,
    )
    expect(screen.getByLabelText(/Agency slug or invitation code/i)).toHaveValue(
      'elite-real-estate',
    )
    expect(
      screen.getByRole('link', { name: /browse agencies accepting applications/i }),
    ).toBeInTheDocument()
  })
})

describe('PathCFields', () => {
  it('renders agency owner fields', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(
      <PathCFields
        values={EMPTY_PATH_C_VALUES}
        onChange={onChange}
      />,
    )
    await user.type(screen.getByLabelText(/Agency name/i), 'Elite')
    expect(onChange).toHaveBeenCalled()
    expect(screen.getByLabelText(/Legal entity type/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/Primary market/i)).toBeInTheDocument()
    expect(
      screen.getByText(/authorized to accept these terms on behalf of the agency/i),
    ).toBeInTheDocument()
  })
})

describe('HeroPanel', () => {
  it('renders value prop and trusted caption in full variant', () => {
    render(<HeroPanel variant="full" />)
    expect(screen.getByTestId('hero-value-prop')).toBeInTheDocument()
    expect(screen.getByText(/Trusted by MENA real-estate professionals/i)).toBeInTheDocument()
  })

  it('compact variant hides trusted cluster', () => {
    render(<HeroPanel variant="compact" />)
    expect(screen.queryByText(/Trusted by MENA/i)).not.toBeInTheDocument()
  })
})

describe('TrustFooter', () => {
  it('renders Paddle + compliance line', () => {
    render(<TrustFooter />)
    expect(screen.getByTestId('signup-trust-footer')).toHaveTextContent(/Paddle/)
    expect(screen.getByTestId('signup-trust-footer')).toHaveTextContent(/GDPR/)
  })
})

describe('OAuthTrio', () => {
  it('renders three provider buttons with signup copy', async () => {
    const user = userEvent.setup()
    const onStart = vi.fn()
    render(
      <BrandProvider>
        <OAuthTrio onStart={onStart} />
      </BrandProvider>,
    )
    expect(screen.getByTestId('oauth-google')).toHaveTextContent(/Continue with Google/i)
    expect(screen.getByText(/or use your account/i)).toBeInTheDocument()
    await user.click(screen.getByTestId('oauth-apple'))
    expect(onStart).toHaveBeenCalledWith('apple')
  })
})

describe('DupIdentityModal', () => {
  it('shows identifier-agnostic copy', () => {
    render(
      <MemoryRouter>
        <DupIdentityModal open onOpenChange={() => undefined} />
      </MemoryRouter>,
    )
    expect(screen.getByTestId('dup-identity-modal')).toHaveTextContent(
      /already has a WingCaster identity/i,
    )
    expect(screen.getByTestId('dup-identity-modal').textContent).not.toMatch(/email was matched/i)
    expect(screen.getByRole('link', { name: /Sign in/i })).toBeInTheDocument()
  })
})
