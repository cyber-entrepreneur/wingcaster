// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ToastProvider } from '@/components/ui/toast'
import { BulkAssignConversationDialog } from './BulkAssignConversationDialog'
import type { AssignableAgent } from '@/api/client'

const apiMock = vi.hoisted(() => ({
  getAssignableAgents: vi.fn(),
  bulkConversations: vi.fn(),
}))
vi.mock('@/api/client', () => ({ api: apiMock }))
vi.mock('@/hooks/useLocale', () => ({ useLocale: () => ({ locale: 'en', dir: 'ltr' }) }))

const AGENTS: AssignableAgent[] = [
  { id: 'a-self', name: 'Zoe', email: 'z@x.test', role: 'agent', is_self: true },
  { id: 'a-mate', name: 'Amir', email: 'a@x.test', role: 'agent', is_self: false },
]

beforeEach(() => {
  apiMock.getAssignableAgents.mockReset().mockResolvedValue({ agents: AGENTS })
  apiMock.bulkConversations.mockReset().mockResolvedValue({ updated: 2, failed: [] })
})

describe('BulkAssignConversationDialog', () => {
  it('bulk-assigns selected conversations to a teammate', async () => {
    const onAssigned = vi.fn()
    render(
      <ToastProvider>
        <BulkAssignConversationDialog
          open
          onOpenChange={vi.fn()}
          conversationIds={['c1', 'c2']}
          onAssigned={onAssigned}
        />
      </ToastProvider>,
    )
    await waitFor(() => expect(apiMock.getAssignableAgents).toHaveBeenCalledWith('c1'))
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /^Assign$/i }))
    await waitFor(() =>
      expect(apiMock.bulkConversations).toHaveBeenCalledWith({
        conversation_ids: ['c1', 'c2'],
        action: 'assign',
        assign_to_agent_id: 'a-self',
        assignment_note: undefined,
      }),
    )
    expect(onAssigned).toHaveBeenCalled()
  })
})
