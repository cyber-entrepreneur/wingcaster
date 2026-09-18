// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ToastProvider } from '@/components/ui/toast'
import { AssignConversationMenu } from './AssignConversationMenu'
import type { AssignableAgent } from '@/api/client'

const apiMock = vi.hoisted(() => ({ getAssignableAgents: vi.fn(), assignConversation: vi.fn() }))
const localeMock = vi.hoisted(() => ({ locale: 'en' as 'en' | 'ar', dir: 'ltr' as 'ltr' | 'rtl' }))

vi.mock('@/api/client', () => ({ api: apiMock }))
vi.mock('@/hooks/useLocale', () => ({ useLocale: () => localeMock }))

function agent(id: string, over: Partial<AssignableAgent> = {}): AssignableAgent {
  return { id, name: id, email: `${id}@x.test`, role: 'agent', is_self: false, ...over }
}

const AGENTS: AssignableAgent[] = [
  agent('a-self', { name: 'Zoe Self', is_self: true }),
  agent('a-mate', { name: 'Amir Mate' }),
]

function renderMenu(props: Partial<React.ComponentProps<typeof AssignConversationMenu>> = {}) {
  return render(
    <ToastProvider>
      <AssignConversationMenu conversationId="c1" assignedAgentId={null} {...props} />
    </ToastProvider>,
  )
}

beforeEach(() => {
  apiMock.getAssignableAgents.mockReset().mockResolvedValue({ agents: AGENTS })
  apiMock.assignConversation.mockReset().mockResolvedValue({})
  localeMock.locale = 'en'
  localeMock.dir = 'ltr'
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('AssignConversationMenu', () => {
  it('loads teammates on mount and names the current assignee on the trigger', async () => {
    renderMenu({ assignedAgentId: 'a-mate' })
    await waitFor(() => expect(apiMock.getAssignableAgents).toHaveBeenCalledWith('c1'))
    expect(screen.getByRole('button', { name: /Assigned to: Amir Mate/i })).toBeInTheDocument()
  })

  it('assigns to a chosen teammate and fires onAssigned', async () => {
    const onAssigned = vi.fn()
    renderMenu({ onAssigned })
    await waitFor(() => expect(apiMock.getAssignableAgents).toHaveBeenCalled())

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /Assign/i }))
    await user.click(await screen.findByRole('menuitemradio', { name: /Amir Mate/i }))

    await waitFor(() => expect(apiMock.assignConversation).toHaveBeenCalledWith('c1', 'a-mate'))
    expect(onAssigned).toHaveBeenCalledWith('a-mate')
  })

  it('marks the current assignee as checked', async () => {
    renderMenu({ assignedAgentId: 'a-mate' })
    await waitFor(() => expect(apiMock.getAssignableAgents).toHaveBeenCalled())
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /Assigned to: Amir Mate/i }))
    const mate = await screen.findByRole('menuitemradio', { name: /Amir Mate/i })
    expect(mate).toHaveAttribute('aria-checked', 'true')
  })

  it('shows self with a "You" affordance', async () => {
    renderMenu()
    await waitFor(() => expect(apiMock.getAssignableAgents).toHaveBeenCalled())
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /Assign/i }))
    expect(await screen.findByRole('menuitemradio', { name: /\(You\)/i })).toBeInTheDocument()
  })

  it('recovers from a load error via retry', async () => {
    apiMock.getAssignableAgents.mockRejectedValueOnce(new Error('boom'))
    apiMock.getAssignableAgents.mockResolvedValueOnce({ agents: AGENTS })
    renderMenu()
    await waitFor(() => expect(apiMock.getAssignableAgents).toHaveBeenCalledTimes(1))

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /Assign/i }))
    await user.click(await screen.findByRole('button', { name: 'Try again' }))
    await waitFor(() => expect(apiMock.getAssignableAgents).toHaveBeenCalledTimes(2))
    expect(await screen.findByRole('menuitemradio', { name: /Amir Mate/i })).toBeInTheDocument()
  })

  it('mirrors the document direction for RTL', async () => {
    localeMock.locale = 'ar'
    localeMock.dir = 'rtl'
    renderMenu()
    await waitFor(() => expect(apiMock.getAssignableAgents).toHaveBeenCalled())
    expect(screen.getByTestId('assign-conversation-menu')).toHaveAttribute('dir', 'rtl')
  })
})
