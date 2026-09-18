// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'

const addToast = vi.hoisted(() => vi.fn())
const apiMocks = vi.hoisted(() => ({
  contactsExportPath: vi.fn(),
  getAuthToken: vi.fn(() => 'test-token'),
}))

vi.mock('@/components/ui/toast', () => ({
  useToast: () => ({ addToast, toasts: [], removeToast: vi.fn() }),
}))

vi.mock('@/api/client', () => ({
  api: { contactsExportPath: apiMocks.contactsExportPath },
  getAuthToken: apiMocks.getAuthToken,
  CONTACT_EXPORT_FIELDS: [
    { key: 'name', label: 'Name' },
    { key: 'email', label: 'Email' },
    { key: 'phone', label: 'Phone' },
  ],
}))

import { ContactExportDialog } from '@/components/contacts/ContactExportDialog'

function setup(overrides: Partial<{ onClose: () => void }> = {}) {
  const onClose = overrides.onClose || vi.fn()
  render(<ContactExportDialog open onClose={onClose} contactCount={12} />)
  return { onClose }
}

beforeEach(() => {
  addToast.mockReset()
  apiMocks.contactsExportPath.mockReset().mockReturnValue('/api/contacts/export?format=csv')
  apiMocks.getAuthToken.mockReturnValue('test-token')
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: true,
    blob: async () => new Blob(['data']),
    headers: { get: () => 'attachment; filename="contacts-2026-03-02.csv"' },
  }))
  vi.stubGlobal('URL', {
    ...URL,
    createObjectURL: vi.fn(() => 'blob:mock'),
    revokeObjectURL: vi.fn(),
  })
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('ContactExportDialog', () => {
  it('renders format options and CSV columns', () => {
    setup()
    expect(screen.getByText('Export contacts')).toBeInTheDocument()
    expect(screen.getByText('CSV')).toBeInTheDocument()
    expect(screen.getByText('vCard')).toBeInTheDocument()
    expect(screen.getByText('Columns')).toBeInTheDocument()
    expect(screen.getByLabelText('Email')).toBeInTheDocument()
  })

  it('exports CSV: fetches with auth header, downloads, toasts, and closes', async () => {
    const { onClose } = setup()
    fireEvent.click(screen.getByRole('button', { name: /Export/ }))
    await waitFor(() => expect(fetch).toHaveBeenCalledWith('/api/contacts/export?format=csv', expect.objectContaining({
      headers: { Authorization: 'Bearer test-token' },
    })))
    await waitFor(() => expect(addToast).toHaveBeenCalledWith(expect.objectContaining({ variant: 'success' })))
    expect(onClose).toHaveBeenCalled()
  })

  it('switches to vCard and hides the columns picker', () => {
    setup()
    fireEvent.click(screen.getByDisplayValue('vcard'))
    expect(screen.queryByText('Columns')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Export/ }))
    expect(apiMocks.contactsExportPath).toHaveBeenCalledWith(expect.objectContaining({ format: 'vcard' }))
  })

  it('disables export when no CSV columns are selected', () => {
    setup()
    fireEvent.click(screen.getByLabelText('Name'))
    fireEvent.click(screen.getByLabelText('Email'))
    fireEvent.click(screen.getByLabelText('Phone'))
    expect(screen.getByText('Select at least one column.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Export/ })).toBeDisabled()
  })

  it('shows an error toast when the download fails', async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>
    fetchMock.mockResolvedValueOnce({ ok: false, status: 500 })
    setup()
    fireEvent.click(screen.getByRole('button', { name: /Export/ }))
    await waitFor(() => expect(addToast).toHaveBeenCalledWith(expect.objectContaining({ variant: 'error' })))
  })
})
