// @vitest-environment jsdom
import type { ReactElement } from 'react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { InterfaceModeCard } from '@/components/settings/InterfaceModeCard'
import { ModeChip } from '@/components/nav/ModeChip'
import { ProDashboard } from '@/pages/agent/dashboard/ProDashboard'
import { ProListingsTable } from '@/pages/agent/listings/ProListingsTable'
import { ToastProvider } from '@/components/ui/toast'
import type { Property } from '@/types'

const uiModeMock = vi.hoisted(() => ({
  mode: 'guided' as 'guided' | 'pro',
  effectiveMode: 'guided' as 'guided' | 'pro',
  isProCapable: true,
  loading: false,
  switching: false,
  setMode: vi.fn(async () => ({ ok: true as const, mode: 'pro' as const })),
  refresh: vi.fn(async () => {}),
}))

vi.mock('@/hooks/useUiMode', () => ({
  useUiMode: () => uiModeMock,
}))

vi.mock('@/hooks/useIsProCapable', () => ({
  useIsProCapable: (forced?: boolean) =>
    typeof forced === 'boolean' ? forced : uiModeMock.isProCapable,
}))

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ agent: { id: 'a1', name: 'Sara' }, loading: false }),
}))

vi.mock('@/hooks/useTenant', () => ({
  useTenant: () => ({
    activeTenant: {
      id: 'personal:a1',
      name: 'Personal',
      kind: 'personal',
      uiMode: uiModeMock.mode,
    },
  }),
}))

function wrap(ui: ReactElement) {
  return render(
    <MemoryRouter>
      <ToastProvider>{ui}</ToastProvider>
    </MemoryRouter>,
  )
}

describe('AGT-SET-002 InterfaceModeCard', () => {
  beforeEach(() => {
    uiModeMock.mode = 'guided'
    uiModeMock.effectiveMode = 'guided'
    uiModeMock.isProCapable = true
    uiModeMock.setMode.mockClear()
  })

  it('selecting Pro triggers setMode', async () => {
    const user = userEvent.setup()
    wrap(<InterfaceModeCard forceProCapable />)
    await user.click(screen.getByRole('radio', { name: /Pro/i }))
    expect(uiModeMock.setMode).toHaveBeenCalledWith('pro')
  })

  it('disables Pro card below 768px', () => {
    uiModeMock.isProCapable = false
    wrap(<InterfaceModeCard forceProCapable={false} />)
    const pro = screen.getByRole('radio', { name: /Pro/i })
    expect(pro).toBeDisabled()
    expect(screen.getByText(/tablet or larger screens/i)).toBeInTheDocument()
  })
})

describe('AGT-SET-002 ModeChip', () => {
  it('renders Guided and Pro variants', () => {
    uiModeMock.mode = 'guided'
    wrap(<ModeChip forceProCapable />)
    expect(screen.getByTestId('mode-chip')).toHaveAttribute('data-mode', 'guided')

    uiModeMock.mode = 'pro'
    wrap(<ModeChip forceProCapable />)
    const chips = screen.getAllByTestId('mode-chip')
    expect(chips[chips.length - 1]).toHaveAttribute('data-mode', 'pro')
  })
})

describe('D-S-06 Pro viewport gate', () => {
  it('ProDashboard exports a stable mount surface', () => {
    wrap(<ProDashboard greetingName="Sara" stats={{ listings: 4, totalViews: 10, inquiries: 2 }} />)
    expect(screen.getByTestId('pro-dashboard')).toBeInTheDocument()
    expect(screen.getByTestId('quick-actions-bar')).toBeInTheDocument()
  })

  it('ProListingsTable renders table semantics', () => {
    const listings: Property[] = [
      {
        id: 'p1',
        title: 'Marina View',
        description: '',
        type: 'sale',
        property_type: 'apartment',
        price: 1200000,
        bedrooms: 2,
        bathrooms: 2,
        area: 1000,
        area_unit: 'sqft',
        location: 'Dubai Marina',
        city: 'Dubai',
        neighborhood: 'Marina',
        address: '1 Marina',
        amenities: [],
        furnished: false,
        photos: [],
        agent_id: 'a1',
        agent_name: 'Sara',
        agent_photo: '',
        agent_license: '',
        agency_name: '',
        listed_date: '2026-01-01',
        permit_number: '',
        reference: 'HR-001',
        featured: false,
        views: 12,
        status: 'published',
      },
    ]
    wrap(<ProListingsTable listings={listings} />)
    expect(screen.getByTestId('pro-listings-table')).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: /Property/i })).toBeInTheDocument()
    expect(screen.queryByTestId('pro-dashboard')).not.toBeInTheDocument()
  })

  it('effectiveMode fallback contract: pro preference does not imply Pro DOM below 768', () => {
    uiModeMock.mode = 'pro'
    uiModeMock.effectiveMode = 'guided'
    uiModeMock.isProCapable = false
    // Consumers must gate on effectiveMode — ModeChip still shows server preference.
    wrap(<ModeChip forceProCapable={false} />)
    const chip = screen.getByTestId('mode-chip')
    expect(chip).toHaveAttribute('data-mode', 'pro')
    expect(chip).toHaveAttribute('data-effective', 'guided')
  })
})
