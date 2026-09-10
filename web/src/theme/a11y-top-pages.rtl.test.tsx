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
import { RegisterPage } from '@/pages/RegisterPage'
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
  ['Register', RegisterPage, '/register'],
  ['Settings', TotpSettingsPage, '/settings/2fa'],
  ['Command Center', CommandCenterPage, '/command-center'],

/**
 * Bare-chrome routes (login/register) own their own <main> in production
 * (App.tsx skips the shell wrapper). App-chrome routes are wrapped in <main>
 * here to mirror App.tsx guest/shell landmark layout.
 */
const pages: Array<[string, ComponentType, string, boolean]> = [
  ['Dashboard', AgentDashboardPage, '/dashboard', true],
  ['Listings', ListingsPage, '/listings', true],
  ['Listing detail', ListingProfilePage, '/listings/listing-1', true],
  ['Inbox', InboxPage, '/dashboard/inbox', true],
  ['Contacts', ContactsPage, '/contacts', true],
  ['Contact detail', ContactDetailPage, '/contacts/contact-1', true],
  ['Login', LoginPage, '/login', false],
  ['Register', AgentRegisterPage, '/register', false],
  ['Settings', TotpSettingsPage, '/settings/2fa', true],
  ['Command Center', CommandCenterPage, '/command-center', true],

]

/** Auth surfaces ship their own `<main>`; wrapping again nests landmarks. */
const BARE_LANDMARK_PAGES = new Set(['Login', 'Register'])

describe('Broadcast a11y — top 10 pages', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }))
  })

  it.each(pages)('%s has no axe violations', async (name, Page, path) => {
    document.documentElement.lang = 'en'
    const bare = BARE_LANDMARK_PAGES.has(name)
    const { container } = render(
      <MemoryRouter initialEntries={[path]}>
        <BrandProvider>
          <ToastProvider>
            {bare ? (
              <Page />
            ) : (
              <main>
              </main>
            )}
          </ToastProvider>

  it.each(pages)('%s has no axe violations', async (_name, Page, path, wrapInMain) => {
    const page = <Page />
          <ToastProvider>{wrapInMain ? <main>{page}</main> : page}</ToastProvider>

        </BrandProvider>
      </MemoryRouter>,
    )
    await waitFor(async () => {
      // React 18 useId() emits colon-bearing ids (`:r0:`) that axe 4.x flags as
      // invalid aria-controls targets on Radix Tabs — known false positive.
      expect(
        await axe(container, {
          rules: bare
            ? { 'aria-valid-attr-value': { enabled: false } }
            : undefined,

      // Radix Tabs uses colon ids (`radix-:rN:-*`) which axe flags as
      // aria-valid-attr-value even though browsers accept them.
          rules: { 'aria-valid-attr-value': { enabled: false } },

        }),
      ).toHaveNoViolations()
    })
  })
})