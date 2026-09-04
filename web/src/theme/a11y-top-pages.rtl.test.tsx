// @vitest-environment jsdom
/**
 * jest-axe pass on the ten highest-traffic screens. Pages are mounted
 * without the app chrome; each is wrapped in <main> so landmark rules
 * match production (App.tsx renders routes inside <main>).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { axe, toHaveNoViolations } from 'jest-axe'
import type { ComponentType } from 'react'

expect.extend(toHaveNoViolations)

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    agent: null,
    isAdmin: false,
    loading: false,
    login: vi.fn(),
    logout: vi.fn(),
    completeTwoFactor: vi.fn(),
  }),
}))

vi.mock('@/api/client', () => ({
  api: new Proxy(
    {},
    {
      get: (_target, prop) =>
        vi.fn().mockImplementation(async () => {
          if (prop === 'getConversations') return []
          if (prop === 'getConversation') return { messages: [], contact: null }
          return {}
        }),
    },
  ),
}))

vi.mock('@/lib/usePageTitle', () => ({
  usePageTitle: () => undefined,
}))

import { AgentDashboardPage } from '@/pages/AgentDashboardPage'
import { ListingsPage } from '@/pages/ListingsPage'
import { ListingProfilePage } from '@/pages/ListingProfilePage'
import { InboxPage } from '@/pages/InboxPage'
import { ContactsPage } from '@/pages/ContactsPage'
import { ContactDetailPage } from '@/pages/ContactDetailPage'
import { LoginPage } from '@/pages/LoginPage'
import { AgentRegisterPage } from '@/pages/AgentRegisterPage'
import { TotpSettingsPage } from '@/pages/TotpSettingsPage'
import { CommandCenterPage } from '@/pages/CommandCenterPage'
import { ToastProvider } from '@/components/ui/toast'
import { BrandProvider } from '@/context/BrandContext'

const pages: Array<[string, ComponentType, string]> = [
  ['Dashboard', AgentDashboardPage, '/dashboard'],
  ['Listings', ListingsPage, '/listings'],
  ['Listing detail', ListingProfilePage, '/listings/listing-1'],
  ['Inbox', InboxPage, '/dashboard/inbox'],
  ['Contacts', ContactsPage, '/contacts'],
  ['Contact detail', ContactDetailPage, '/contacts/contact-1'],
  ['Login', LoginPage, '/login'],
  ['Register', AgentRegisterPage, '/register'],
  ['Settings', TotpSettingsPage, '/settings/2fa'],
  ['Command Center', CommandCenterPage, '/command-center'],
]

describe('Broadcast a11y — top 10 pages', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }))
  })

  it.each(pages)('%s has no axe violations', async (_name, Page, path) => {
    document.documentElement.lang = 'en'
    const { container } = render(
      <MemoryRouter initialEntries={[path]}>
        <BrandProvider>
          <ToastProvider>
            <main>
              <Page />
            </main>
          </ToastProvider>
        </BrandProvider>
      </MemoryRouter>,
    )
    await waitFor(async () => {
      expect(await axe(container)).toHaveNoViolations()
    })
  })
})
