// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom'

const addToast = vi.hoisted(() => vi.fn())
const apiMocks = vi.hoisted(() => ({ createContact: vi.fn() }))

vi.mock('@/components/ui/toast', () => ({
  useToast: () => ({ addToast, toasts: [], removeToast: vi.fn() }),
}))
vi.mock('@/api/client', () => ({ api: { createContact: apiMocks.createContact } }))

import { AddContactDialog } from '@/components/contacts/AddContactDialog'

function LocationProbe() {
  const loc = useLocation()
  return (
    <div data-testid="loc" data-path={loc.pathname} data-state={JSON.stringify(loc.state ?? null)} />
  )
}

function setup() {
  const onOpenChange = vi.fn()
  render(
    <MemoryRouter initialEntries={['/contacts']}>
      <AddContactDialog open onOpenChange={onOpenChange} />
      <Routes>
        <Route path="*" element={<LocationProbe />} />
      </Routes>
    </MemoryRouter>,
  )
  return { onOpenChange }
}

beforeEach(() => {
  addToast.mockReset()
  apiMocks.createContact.mockReset().mockResolvedValue({ id: 'c-new' })
})
afterEach(() => vi.restoreAllMocks())

describe('AddContactDialog (quick add)', () => {
  it('renders the shallow capture fields', () => {
    setup()
    expect(screen.getByText('Add contact')).toBeInTheDocument()
    expect(screen.getByLabelText('First name')).toBeInTheDocument()
    expect(screen.getByLabelText('Email')).toBeInTheDocument()
    expect(screen.getByLabelText('Contact role')).toBeInTheDocument()
  })

  it('blocks save with no identity and does not call the API', () => {
    setup()
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(apiMocks.createContact).not.toHaveBeenCalled()
  })

  it('quick-saves and navigates to the new contact detail', async () => {
    const { onOpenChange } = setup()
    fireEvent.change(screen.getByLabelText('First name'), { target: { value: 'Ada' } })
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'ada@x.com' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(apiMocks.createContact).toHaveBeenCalledTimes(1))
    expect(apiMocks.createContact).toHaveBeenCalledWith(
      expect.objectContaining({ first_name: 'Ada', emails: [{ label: 'personal', address: 'ada@x.com' }] }),
    )
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false))
    await waitFor(() => expect(screen.getByTestId('loc').getAttribute('data-path')).toBe('/contacts/c-new'))
  })

  it('carries typed values into the full form via router state', async () => {
    setup()
    fireEvent.change(screen.getByLabelText('First name'), { target: { value: 'Bo' } })
    fireEvent.change(screen.getByLabelText('Phone'), { target: { value: '+9715' } })
    fireEvent.click(screen.getByRole('button', { name: /Go to full form/ }))
    await waitFor(() => expect(screen.getByTestId('loc').getAttribute('data-path')).toBe('/contacts/new/full'))
    const state = JSON.parse(screen.getByTestId('loc').getAttribute('data-state') || 'null')
    expect(state.seed).toMatchObject({ first_name: 'Bo', phone: '+9715' })
    expect(apiMocks.createContact).not.toHaveBeenCalled()
  })
})
