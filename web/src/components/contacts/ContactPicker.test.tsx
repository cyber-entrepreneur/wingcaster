// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'

const addToast = vi.hoisted(() => vi.fn())
const apiMocks = vi.hoisted(() => ({ getContacts: vi.fn() }))

vi.mock('@/components/ui/toast', () => ({
  useToast: () => ({ addToast, toasts: [], removeToast: vi.fn() }),
}))
vi.mock('@/api/client', () => ({ api: { getContacts: apiMocks.getContacts } }))

import { ContactPicker } from '@/components/contacts/ContactPicker'

beforeEach(() => {
  addToast.mockReset()
  apiMocks.getContacts.mockReset().mockResolvedValue([
    { id: 'c1', name: 'Ada Lovelace', email: 'ada@x.com' },
    { id: 'self', name: 'Me Myself', email: 'me@x.com' },
    { id: 'c2', name: 'Bo Diaz', phone: '+9715' },
  ])
})
afterEach(() => vi.restoreAllMocks())

describe('ContactPicker', () => {
  it('searches on focus and selects a contact, excluding the current record', async () => {
    const onChange = vi.fn()
    render(<ContactPicker value="" onChange={onChange} excludeId="self" inputId="rt" />)
    fireEvent.focus(screen.getByRole('textbox'))
    await waitFor(() => expect(apiMocks.getContacts).toHaveBeenCalled())
    // The excluded (self) contact must not appear as an option.
    await waitFor(() => expect(screen.getByText('Ada Lovelace')).toBeInTheDocument())
    expect(screen.queryByText('Me Myself')).not.toBeInTheDocument()
    fireEvent.click(screen.getByText('Ada Lovelace'))
    expect(onChange).toHaveBeenCalledWith('c1', 'Ada Lovelace')
  })

  it('shows the selected chip and clears it', () => {
    const onChange = vi.fn()
    render(<ContactPicker value="c1" displayName="Ada Lovelace" onChange={onChange} />)
    expect(screen.getByText('Ada Lovelace')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Clear/ }))
    expect(onChange).toHaveBeenCalledWith('', '')
  })
})
