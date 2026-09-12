// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { ToastProvider } from '@/components/ui/toast'
import { StepUpProvider } from '@/components/mfa'
import { SessionsPage } from './SessionsPage'

const apiMock = vi.hoisted(() => ({
  getAuthSessions: vi.fn(),
  getPushTokens: vi.fn(),
  deleteAuthSession: vi.fn(),
  deleteAuthSessionsExceptCurrent: vi.fn(),
  deletePushToken: vi.fn(),
}))

vi.mock('@/api/client', async () => {
  const actual = await vi.importActual<typeof import('@/api/client')>('@/api/client')
  return { ...actual, api: apiMock }
})

function wrap() {
  return render(
    <MemoryRouter>
      <ToastProvider>
        <StepUpProvider>
          <SessionsPage />
        </StepUpProvider>
      </ToastProvider>
    </MemoryRouter>,
  )
}

describe('SessionsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    apiMock.getPushTokens.mockResolvedValue({ tokens: [] })
  })

  it('shows an honest empty / available-soon state when sessions API is missing', async () => {
    apiMock.getAuthSessions.mockRejectedValue(Object.assign(new Error('not found'), { status: 404 }))
    wrap()
    expect(await screen.findByText('Available soon')).toBeInTheDocument()
    expect(screen.getByText(/Session history is not on this environment yet/i)).toBeInTheDocument()
    expect(screen.getByText('No mobile devices registered.')).toBeInTheDocument()
    expect(screen.queryByText('Chrome 141 on macOS 26')).not.toBeInTheDocument()
  })

  it('shows an error when sessions fail for a non-404 reason', async () => {
    apiMock.getAuthSessions.mockRejectedValue(Object.assign(new Error('backend down'), { status: 500 }))
    wrap()
    expect(await screen.findByRole('alert')).toHaveTextContent('backend down')
  })
})
