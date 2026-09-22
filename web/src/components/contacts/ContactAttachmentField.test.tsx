// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'

const addToast = vi.hoisted(() => vi.fn())
const apiMocks = vi.hoisted(() => ({
  uploadContactAttachment: vi.fn(),
  deleteContactAttachment: vi.fn(),
  contactAttachmentDownloadPath: vi.fn(() => '/api/contacts/c1/attachments/a1'),
}))

vi.mock('@/components/ui/toast', () => ({
  useToast: () => ({ addToast, toasts: [], removeToast: vi.fn() }),
}))
vi.mock('@/api/client', () => ({ api: apiMocks, getAuthToken: () => 'tok' }))

import { ContactAttachmentField } from '@/components/contacts/ContactAttachmentField'

beforeEach(() => {
  addToast.mockReset()
  apiMocks.uploadContactAttachment.mockReset().mockResolvedValue({
    attachment: { id: 'a1', kind: 'pre_approval_letter', filename: 'letter.pdf', content_type: 'application/pdf', size_bytes: 10 },
  })
  apiMocks.deleteContactAttachment.mockReset().mockResolvedValue({ deleted: true })
})
afterEach(() => vi.restoreAllMocks())

describe('ContactAttachmentField', () => {
  it('prompts to save first when there is no contact id (create mode)', () => {
    render(<ContactAttachmentField contactId={undefined} value={null} onChange={vi.fn()} />)
    expect(screen.getByText(/Save the contact first/)).toBeInTheDocument()
    expect(apiMocks.uploadContactAttachment).not.toHaveBeenCalled()
  })

  it('uploads a chosen file and reports the reference back', async () => {
    const onChange = vi.fn()
    render(<ContactAttachmentField contactId="c1" value={null} onChange={onChange} />)
    const input = screen.getByLabelText('Pre-approval letter file')
    const file = new File(['%PDF-1.4'], 'letter.pdf', { type: 'application/pdf' })
    fireEvent.change(input, { target: { files: [file] } })
    await waitFor(() => expect(apiMocks.uploadContactAttachment).toHaveBeenCalledWith('c1', file, 'pre_approval_letter'))
    await waitFor(() => expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ attachment_id: 'a1', filename: 'letter.pdf' })))
  })

  it('shows the uploaded file and removes it', async () => {
    const onChange = vi.fn()
    render(
      <ContactAttachmentField
        contactId="c1"
        value={{ attachment_id: 'a1', filename: 'letter.pdf' }}
        onChange={onChange}
      />,
    )
    expect(screen.getByText('letter.pdf')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Remove pre-approval letter' }))
    await waitFor(() => expect(apiMocks.deleteContactAttachment).toHaveBeenCalledWith('c1', 'a1'))
    await waitFor(() => expect(onChange).toHaveBeenCalledWith(null))
  })
})
