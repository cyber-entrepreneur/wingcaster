// @vitest-environment jsdom
/**
 * jest-axe pass on the ten highest-traffic screens.
 * Bare-chrome routes (login/register) own their own <main> in production;
 * app-chrome routes are wrapped here to mirror App.tsx landmarks.
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
import { RegisterPage } from '@/pages/RegisterPage'
import { TotpSettingsPage } from '@/pages/TotpSettingsPage'
import { CommandCenterPage } from '@/pages/CommandCenterPage'
import { ToastProvider } from '@/components/ui/toast'
import { BrandProvider } from '@/context/BrandContext'

const pages: Array<[string, ComponentType, string, boolean]> = [
  ['Dashboard', AgentDashboardPage, '/dashboard', true],
  ['Listings', ListingsPage, '/listings', true],
  ['Listing detail', ListingProfilePage, '/listings/listing-1', true],
  ['Inbox', InboxPage, '/dashboard/inbox', true],
  ['Contacts', ContactsPage, '/contacts', true],
  ['Contact detail', ContactDetailPage, '/contacts/contact-1', true],
  ['Login', LoginPage, '/login', false],
  ['Register', RegisterPage, '/register', false],
  ['Settings', TotpSettingsPage, '/settings/2fa', true],
  ['Command Center', CommandCenterPage, '/command-center', true],
]

describe('Broadcast a11y — top 10 pages', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }))
  })

  it.each(pages)('%s has no axe violations', async (_name, Page, path, wrapInMain) => {
    document.documentElement.lang = 'en'
    const page = <Page />
    const { container } = render(
      <MemoryRouter initialEntries={[path]}>
        <BrandProvider>
          <ToastProvider>{wrapInMain ? <main>{page}</main> : page}</ToastProvider>
        </BrandProvider>
      </MemoryRouter>,
    )

    await waitFor(async () => {
      // Radix Tabs uses colon ids (`radix-:rN:-*`) that axe 4.x can flag even though browsers accept them.
      expect(
        await axe(container, {
          rules: { 'aria-valid-attr-value': { enabled: false } },
        }),
      ).toHaveNoViolations()
    })
  })
})
