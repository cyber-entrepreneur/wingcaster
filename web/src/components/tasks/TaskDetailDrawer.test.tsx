// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

const addToast = vi.hoisted(() => vi.fn())
const apiMocks = vi.hoisted(() => ({
  getTask: vi.fn(),
  getContacts: vi.fn(),
  updateTask: vi.fn(),
  completeTask: vi.fn(),
  deleteTask: vi.fn(),
}))

vi.mock('@/components/ui/toast', () => ({
  useToast: () => ({ addToast, toasts: [], removeToast: vi.fn() }),
}))

vi.mock('@/api/client', () => ({
  api: apiMocks,
  setAuthToken: vi.fn(),
  getAuthToken: vi.fn(() => 'test-token'),
  API_BASE: '/api',
}))

import { TaskDetailDrawer } from '@/components/tasks/TaskDetailDrawer'

const task = {
  id: 't-1',
  title: 'Call the seller',
  notes: 'Discuss the counter-offer',
  type: 'call' as const,
  status: 'pending' as const,
  priority: 'high' as const,
  due_at: '2026-03-01T09:30:00.000Z',
  completed_at: null,
  assigned_to: 'agent-1',
  contact_id: 'c-1',
  inquiry_id: null,
  opportunity_id: 'o-1',
  viewing_id: null,
  conversation_id: null,
}

const contacts = [
  { id: 'c-1', name: 'Alice Buyer' },
  { id: 'c-2', name: 'Bob Seller' },
]

function renderDrawer(overrides: Partial<{ onClose: () => void; onChanged: () => void }> = {}) {
  const onClose = overrides.onClose || vi.fn()
  const onChanged = overrides.onChanged || vi.fn()
  render(
    <MemoryRouter>
      <TaskDetailDrawer taskId="t-1" onClose={onClose} onChanged={onChanged} />
    </MemoryRouter>,
  )
  return { onClose, onChanged }
}

beforeEach(() => {
  addToast.mockReset()
  apiMocks.getTask.mockReset().mockResolvedValue(task)
  apiMocks.getContacts.mockReset().mockResolvedValue(contacts)
  apiMocks.updateTask.mockReset().mockResolvedValue({})
  apiMocks.completeTask.mockReset().mockResolvedValue({})
  apiMocks.deleteTask.mockReset().mockResolvedValue({})
})

afterEach(() => vi.restoreAllMocks())

describe('TaskDetailDrawer', () => {
  it('loads the task and populates the form', async () => {
    renderDrawer()
    await waitFor(() => expect((screen.getByLabelText('Title') as HTMLInputElement).value).toBe('Call the seller'))
    expect((screen.getByLabelText('Description') as HTMLTextAreaElement).value).toBe('Discuss the counter-offer')
    expect((screen.getByLabelText('Linked contact') as HTMLSelectElement).value).toBe('c-1')
  })

  it('saves edited fields and refreshes', async () => {
    const { onClose, onChanged } = renderDrawer()
    await waitFor(() => expect(screen.getByLabelText('Title')).toBeInTheDocument())
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Call the seller back' } })
    fireEvent.change(screen.getByLabelText('Priority'), { target: { value: 'urgent' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(apiMocks.updateTask).toHaveBeenCalled())
    expect(apiMocks.updateTask).toHaveBeenCalledWith('t-1', expect.objectContaining({
      title: 'Call the seller back',
      priority: 'urgent',
      type: 'call',
      contact_id: 'c-1',
    }))
    expect(onChanged).toHaveBeenCalled()
    expect(onClose).toHaveBeenCalled()
  })

  it('completes the task', async () => {
    renderDrawer()
    await waitFor(() => expect(screen.getByLabelText('Title')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: /Complete/ }))
    await waitFor(() => expect(apiMocks.completeTask).toHaveBeenCalledWith('t-1'))
  })

  it('deletes the task after confirmation', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    renderDrawer()
    await waitFor(() => expect(screen.getByLabelText('Title')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: /Delete/ }))
    await waitFor(() => expect(apiMocks.deleteTask).toHaveBeenCalledWith('t-1'))
  })

  it('shows an error state with retry when the task fails to load', async () => {
    apiMocks.getTask.mockRejectedValueOnce(new Error('boom'))
    renderDrawer()
    await waitFor(() => expect(screen.getByText('boom')).toBeInTheDocument())
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
  })
})
