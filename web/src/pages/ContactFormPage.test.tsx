// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom'

const addToast = vi.hoisted(() => vi.fn())
const apiMocks = vi.hoisted(() => ({
  getContact: vi.fn(),
  getContacts: vi.fn(),
  createContact: vi.fn(),
  updateContact: vi.fn(),
}))

vi.mock('@/components/ui/toast', () => ({
  useToast: () => ({ addToast, toasts: [], removeToast: vi.fn() }),
}))
// Stable ref — a fresh object per render would re-fire the load effect and loop.
const authValue = vi.hoisted(() => ({ agent: { id: 'agent-1' } }))
vi.mock('@/context/AuthContext', () => ({ useAuth: () => authValue }))
vi.mock('@/lib/usePageTitle', () => ({ usePageTitle: () => {} }))
vi.mock('@/api/client', () => ({ api: apiMocks }))

import { ContactFormPage } from '@/pages/ContactFormPage'

function LocationProbe() {
  const loc = useLocation()
  return <div data-testid="loc" data-path={loc.pathname} />
}

function renderAt(path: string) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/contacts/new/full" element={<ContactFormPage />} />
        <Route path="/contacts/:id/edit" element={<ContactFormPage />} />
        <Route path="/contacts/:id" element={<LocationProbe />} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  addToast.mockReset()
  apiMocks.getContact.mockReset()
  apiMocks.getContacts.mockReset().mockResolvedValue([])
  apiMocks.createContact.mockReset().mockResolvedValue({ id: 'c-new' })
  apiMocks.updateContact.mockReset().mockResolvedValue({ id: 'c1' })
})
afterEach(() => vi.restoreAllMocks())

describe('ContactFormPage — create', () => {
  it('renders the identity, work, and channel sections', () => {
    renderAt('/contacts/new/full')
    expect(screen.getByRole('heading', { name: 'New contact' })).toBeInTheDocument()
    expect(screen.getByText('Role & source')).toBeInTheDocument()
    expect(screen.getByText('Work')).toBeInTheDocument()
    expect(screen.getByText('Phone & email')).toBeInTheDocument()
    expect(screen.getByLabelText('First name')).toBeInTheDocument()
    expect(screen.getByLabelText('Organization name')).toBeInTheDocument()
    expect(screen.getByLabelText('Personal email')).toBeInTheDocument()
    expect(screen.getByLabelText('Mobile phone')).toBeInTheDocument()
  })

  it('blocks create with no identity', () => {
    renderAt('/contacts/new/full')
    // The save action appears in both the header and footer; either triggers it.
    fireEvent.click(screen.getAllByRole('button', { name: /Create contact/ })[0])
    expect(apiMocks.createContact).not.toHaveBeenCalled()
    expect(addToast).toHaveBeenCalledWith(expect.objectContaining({ variant: 'error' }))
  })

  it('creates and navigates to the new detail page', async () => {
    renderAt('/contacts/new/full')
    fireEvent.change(screen.getByLabelText('First name'), { target: { value: 'Ada' } })
    fireEvent.change(screen.getByLabelText('Personal email'), { target: { value: 'ada@x.com' } })
    fireEvent.click(screen.getAllByRole('button', { name: /Create contact/ })[0])
    await waitFor(() => expect(apiMocks.createContact).toHaveBeenCalledTimes(1))
    expect(apiMocks.createContact).toHaveBeenCalledWith(
      expect.objectContaining({ first_name: 'Ada', emails: [{ label: 'personal', address: 'ada@x.com' }] }),
    )
    await waitFor(() => expect(screen.getByTestId('loc').getAttribute('data-path')).toBe('/contacts/c-new'))
  })

  it('adds a second phone, auto-numbers duplicate labels, and saves both', async () => {
    renderAt('/contacts/new/full')
    fireEvent.change(screen.getByLabelText('First name'), { target: { value: 'Ada' } })
    // First phone → Business.
    fireEvent.change(screen.getByLabelText('Phone 1 label'), { target: { value: 'business' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add phone' }))
    // Second phone → Business as well; both should now be numbered.
    fireEvent.change(screen.getByLabelText('Phone 2 label'), { target: { value: 'business' } })
    fireEvent.change(screen.getByLabelText('Business 1 phone'), { target: { value: '+111' } })
    fireEvent.change(screen.getByLabelText('Business 2 phone'), { target: { value: '+222' } })
    fireEvent.click(screen.getAllByRole('button', { name: /Create contact/ })[0])
    await waitFor(() => expect(apiMocks.createContact).toHaveBeenCalledTimes(1))
    expect(apiMocks.createContact).toHaveBeenCalledWith(
      expect.objectContaining({
        phones: [
          { label: 'business', number: '+111' },
          { label: 'business', number: '+222' },
        ],
      }),
    )
  })

  it('captures address and social handles', async () => {
    renderAt('/contacts/new/full')
    fireEvent.change(screen.getByLabelText('First name'), { target: { value: 'Ada' } })
    fireEvent.change(screen.getByLabelText('Address line 1'), { target: { value: '1 Byron St' } })
    fireEvent.change(screen.getByLabelText('City / Municipality / Town / Village'), { target: { value: 'Beirut' } })
    fireEvent.change(screen.getByLabelText('Instagram'), { target: { value: '@ada' } })
    fireEvent.click(screen.getAllByRole('button', { name: /Create contact/ })[0])
    await waitFor(() => expect(apiMocks.createContact).toHaveBeenCalledTimes(1))
    const payload = apiMocks.createContact.mock.calls[0][0]
    expect(payload.address).toMatchObject({ line1: '1 Byron St', city: 'Beirut' })
    expect(payload.socials).toMatchObject({ instagram: '@ada' })
  })
})

describe('ContactFormPage — edit', () => {
  it('loads, prefills, and PATCHes on save', async () => {
    apiMocks.getContact.mockResolvedValue({
      id: 'c1',
      first_name: 'Bo',
      last_name: 'Diaz',
      email: 'bo@x.com',
      contact_role: 'seller',
      status: 'client',
    })
    renderAt('/contacts/c1/edit')
    expect(screen.getByRole('heading', { name: 'Edit contact' })).toBeInTheDocument()
    await waitFor(() => expect((screen.getByLabelText('First name') as HTMLInputElement).value).toBe('Bo'))
    expect((screen.getByLabelText('Personal email') as HTMLInputElement).value).toBe('bo@x.com')

    fireEvent.change(screen.getByLabelText('Last name'), { target: { value: 'Diaz-Smith' } })
    fireEvent.click(screen.getAllByRole('button', { name: /Save changes/ })[0])
    await waitFor(() => expect(apiMocks.updateContact).toHaveBeenCalledTimes(1))
    expect(apiMocks.updateContact).toHaveBeenCalledWith(
      'c1',
      expect.objectContaining({ first_name: 'Bo', last_name: 'Diaz-Smith', contact_role: 'seller' }),
    )
    await waitFor(() => expect(screen.getByTestId('loc').getAttribute('data-path')).toBe('/contacts/c1'))
  })
})
