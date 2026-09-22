// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'

const addToast = vi.hoisted(() => vi.fn())
const apiMocks = vi.hoisted(() => ({
  getContactAttachments: vi.fn(),
  uploadContactAttachment: vi.fn(),
  deleteContactAttachment: vi.fn(),
  contactAttachmentDownloadPath: vi.fn(() => '/api/contacts/c1/attachments/v1'),
}))

vi.mock('@/components/ui/toast', () => ({
  useToast: () => ({ addToast, toasts: [], removeToast: vi.fn() }),
}))
vi.mock('@/api/client', () => ({ api: apiMocks, getAuthToken: () => 'tok' }))

import { VoiceNoteField } from '@/components/contacts/VoiceNoteField'

beforeEach(() => {
  addToast.mockReset()
  apiMocks.getContactAttachments.mockReset().mockResolvedValue({ attachments: [] })
  apiMocks.uploadContactAttachment.mockReset().mockResolvedValue({
    attachment: { id: 'v1', kind: 'voice_note', filename: 'voice.webm', content_type: 'audio/webm', size_bytes: 20 },
  })
  apiMocks.deleteContactAttachment.mockReset().mockResolvedValue({ deleted: true })
})
afterEach(() => vi.restoreAllMocks())

describe('VoiceNoteField', () => {
  it('prompts to save first in create mode and loads nothing', () => {
    render(<VoiceNoteField contactId={undefined} />)
    expect(screen.getByText(/Save the contact first, then record/)).toBeInTheDocument()
    expect(apiMocks.getContactAttachments).not.toHaveBeenCalled()
  })

  it('loads existing voice notes for a saved contact', async () => {
    apiMocks.getContactAttachments.mockResolvedValue({ attachments: [{ id: 'v0', filename: 'old.webm' }] })
    render(<VoiceNoteField contactId="c1" />)
    await waitFor(() => expect(apiMocks.getContactAttachments).toHaveBeenCalledWith('c1', 'voice_note'))
    expect(await screen.findByText('old.webm')).toBeInTheDocument()
  })

  it('uploads an audio file via the fallback (no MediaRecorder in jsdom) and can remove it', async () => {
    render(<VoiceNoteField contactId="c1" />)
    const input = await screen.findByLabelText('Voice note audio file')
    const file = new File(['audio'], 'voice.webm', { type: 'audio/webm' })
    fireEvent.change(input, { target: { files: [file] } })
    await waitFor(() => expect(apiMocks.uploadContactAttachment).toHaveBeenCalledWith('c1', file, 'voice_note'))
    expect(await screen.findByText('voice.webm')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Remove voice note/ }))
    await waitFor(() => expect(apiMocks.deleteContactAttachment).toHaveBeenCalledWith('c1', 'v1'))
    await waitFor(() => expect(screen.queryByText('voice.webm')).not.toBeInTheDocument())
  })
})
