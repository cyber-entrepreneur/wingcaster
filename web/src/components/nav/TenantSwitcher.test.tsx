// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { ToastProvider } from '@/components/ui/toast'
import type { TenantSummary } from '@/hooks/useTenant'

const { useTenantState, switchTenant } = vi.hoisted(() => {
  const switchTenantFn = vi.fn()
  return {
    switchTenant: switchTenantFn,
    useTenantState: {
      value: {
        tenants: [] as TenantSummary[],
        activeTenantId: null as string | null,
        activeTenant: null as TenantSummary | null,
        loading: false,
        switching: false,
        error: null as string | null,
        isMultiTenant: false,
        refresh: vi.fn(),
        switchTenant: switchTenantFn,
      },
    },
  }
})

vi.mock('@/hooks/useTenant', async () => {
  const actual = await vi.importActual<typeof import('@/hooks/useTenant')>('@/hooks/useTenant')
  return {
    ...actual,
    useTenant: () => useTenantState.value,
  }
})

import { TenantSwitcher } from './TenantSwitcher'

const PERSONAL: TenantSummary = {
  id: 'personal:u1',
  name: 'Sara Almansoori',
  avatarUrl: null,
  role: 'owner',
  kind: 'personal',
  listingsCount: 3,
  agentsCount: 1,
}

const ELITE: TenantSummary = {
  id: 'agency-elite',
  name: 'Elite Real Estate',
  avatarUrl: null,
  role: 'owner',
  kind: 'agency',
  listingsCount: 47,
  agentsCount: 5,
  otherMembersCount: 4,
}

const DPC: TenantSummary = {
  id: 'agency-dpc',
  name: 'Dubai Properties Consortium',
  avatarUrl: null,
  role: 'member',
  kind: 'agency',
  listingsCount: 213,
  agentsCount: 23,
  otherMembersCount: 22,
}

function setHook(partial: Partial<typeof useTenantState.value>) {
  useTenantState.value = {
    tenants: [],
    activeTenantId: null,
    activeTenant: null,
    loading: false,
    switching: false,
    error: null,
    isMultiTenant: false,
    refresh: vi.fn(),
    switchTenant,
    ...partial,
  }
}

function renderSwitcher(props?: { locale?: 'en' | 'ar'; forceMobile?: boolean }) {
  return render(
    <MemoryRouter>
      <ToastProvider>
        <TenantSwitcher {...props} />
      </ToastProvider>
    </MemoryRouter>,
  )
}

describe('TenantSwitcher', () => {
  beforeEach(() => {
    switchTenant.mockReset()
    switchTenant.mockImplementation(async (id: string) => {
      const all = [PERSONAL, ELITE, DPC]
      return all.find((t) => t.id === id) ?? PERSONAL
    })
  })

  it('collapses to a static label for single-tenant users', () => {
    setHook({
      tenants: [PERSONAL],
      activeTenantId: PERSONAL.id,
      activeTenant: PERSONAL,
      isMultiTenant: false,
    })
    renderSwitcher()
    expect(screen.getByTestId('tenant-switcher-static')).toBeInTheDocument()
    expect(screen.queryByTestId('tenant-switcher-trigger')).not.toBeInTheDocument()
    expect(screen.getByText(/Sara Almansoori \(personal\)/i)).toBeInTheDocument()
    expect(screen.getByText(/^You$/)).toBeInTheDocument()
  })

  it('opens the popover with personal first, separator, and active check', async () => {
    const user = userEvent.setup()
    setHook({
      tenants: [PERSONAL, ELITE, DPC],
      activeTenantId: PERSONAL.id,
      activeTenant: PERSONAL,
      isMultiTenant: true,
    })
    renderSwitcher({ forceMobile: false })

    const trigger = screen.getByTestId('tenant-switcher-trigger')
    expect(trigger).toHaveAttribute('aria-haspopup', 'listbox')
    expect(trigger).toHaveAttribute('aria-expanded', 'false')

    await user.click(trigger)
    expect(trigger).toHaveAttribute('aria-expanded', 'true')

    const popover = await screen.findByTestId('tenant-switcher-popover')
    const options = within(popover).getAllByRole('option')
    expect(options[0]).toHaveTextContent(/Sara Almansoori/)
    expect(options[0]).toHaveAttribute('aria-selected', 'true')
    expect(within(options[0]).getByText(/listings/i)).toBeInTheDocument()
    expect(screen.queryByPlaceholderText(/Filter tenants/i)).not.toBeInTheDocument()
  })

  it('shows search when there are 5+ tenants and filters live', async () => {
    const user = userEvent.setup()
    const extras: TenantSummary[] = [
      { ...ELITE, id: 'a2', name: 'Beta Agency' },
      { ...ELITE, id: 'a3', name: 'Gamma Agency', role: 'admin' },
    ]
    setHook({
      tenants: [PERSONAL, ELITE, DPC, ...extras],
      activeTenantId: PERSONAL.id,
      activeTenant: PERSONAL,
      isMultiTenant: true,
    })
    renderSwitcher({ forceMobile: false })
    await user.click(screen.getByTestId('tenant-switcher-trigger'))

    const input = await screen.findByPlaceholderText(/Filter tenants/i)
    await user.type(input, 'elite')
    const options = screen.getAllByRole('option')
    expect(options).toHaveLength(1)
    expect(options[0]).toHaveTextContent(/Elite Real Estate/)
  })

  it('commits a switch from a row click', async () => {
    const user = userEvent.setup()
    setHook({
      tenants: [PERSONAL, ELITE, DPC],
      activeTenantId: PERSONAL.id,
      activeTenant: PERSONAL,
      isMultiTenant: true,
    })
    renderSwitcher({ forceMobile: false })
    await user.click(screen.getByTestId('tenant-switcher-trigger'))
    await user.click(screen.getByRole('option', { name: /Elite Real Estate/i }))
    expect(switchTenant).toHaveBeenCalledWith('agency-elite')
  })

  it('renders Arabic copy in RTL locale', async () => {
    const user = userEvent.setup()
    setHook({
      tenants: [PERSONAL, ELITE],
      activeTenantId: PERSONAL.id,
      activeTenant: PERSONAL,
      isMultiTenant: true,
    })
    renderSwitcher({ locale: 'ar', forceMobile: false })
    await user.click(screen.getByTestId('tenant-switcher-trigger'))
    expect(await screen.findByText('التبديل إلى')).toBeInTheDocument()
    expect(screen.getByText('إنشاء وكالة جديدة')).toBeInTheDocument()
  })
})
