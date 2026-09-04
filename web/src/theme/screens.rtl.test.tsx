// @vitest-environment jsdom
/**
 * Mount every page module in both Broadcast modes. Auth, API, and navigation
 * are stubbed so this asserts renderability and token wiring, not business logic.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { applyLcMode } from '@/theme/mode'

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
      get: () => vi.fn().mockResolvedValue({}),
    },
  ),
}))

vi.mock('@/lib/usePageTitle', () => ({
  usePageTitle: () => undefined,
}))

import { LoginPage } from '@/pages/LoginPage'
import { ForgotPasswordPage } from '@/pages/ForgotPasswordPage'
import { ResetPasswordPage } from '@/pages/ResetPasswordPage'
import { AccountRecoveryPage } from '@/pages/AccountRecoveryPage'
import { AccountRecoveryCompletePage } from '@/pages/AccountRecoveryCompletePage'
import { AgentRegisterPage } from '@/pages/AgentRegisterPage'
import { TermsPage } from '@/pages/TermsPage'
import { PrivacyPage } from '@/pages/PrivacyPage'
import { PlansPage } from '@/pages/PlansPage'
import { ListingsPage } from '@/pages/ListingsPage'
import { AgentDashboardPage } from '@/pages/AgentDashboardPage'
import { InboxPage } from '@/pages/InboxPage'
import { TasksPage } from '@/pages/TasksPage'
import { ContactsPage } from '@/pages/ContactsPage'
import { OpportunitiesPage } from '@/pages/OpportunitiesPage'
import { CampaignsPage } from '@/pages/CampaignsPage'
import { CampaignBuilderPage } from '@/pages/CampaignBuilderPage'
import { CommandCenterPage } from '@/pages/CommandCenterPage'
import { SocialChannelsPage } from '@/pages/SocialChannelsPage'
import { NotificationPreferencesPage } from '@/pages/NotificationPreferencesPage'
import { TotpSettingsPage } from '@/pages/TotpSettingsPage'
import { IntegrationSettingsPage } from '@/pages/IntegrationSettingsPage'
import { AgencyManagementPage } from '@/pages/AgencyManagementPage'
import { WhiteLabelBuilderPage } from '@/pages/WhiteLabelBuilderPage'
import { WidgetBuilderPage } from '@/pages/WidgetBuilderPage'
import { MessageTemplatesPage } from '@/pages/MessageTemplatesPage'
import { MySubscriptionPage } from '@/pages/MySubscriptionPage'
import { MyCreditsPage } from '@/pages/MyCreditsPage'
import { MyCreditNotesPage } from '@/pages/MyCreditNotesPage'
import { MyInvoicesPage } from '@/pages/MyInvoicesPage'
import { AgentPricingPage } from '@/pages/AgentPricingPage'
import { AgencyPricingPage } from '@/pages/AgencyPricingPage'
import { RoutingSettingsPage } from '@/pages/RoutingSettingsPage'
import { HistoricalTransactionsPage } from '@/pages/HistoricalTransactionsPage'
import { PublicAgencyPage } from '@/pages/PublicAgencyPage'
import { PublicAgentPortfolioPage } from '@/pages/PublicAgentPortfolioPage'
import { AreaProfilePage } from '@/pages/AreaProfilePage'
import { NeighborhoodValuatorPage } from '@/pages/NeighborhoodValuatorPage'
import { CrmAnalyticsPage } from '@/pages/CrmAnalyticsPage'
import { ContactDetailPage } from '@/pages/ContactDetailPage'
import { ListingProfilePage } from '@/pages/ListingProfilePage'
import { AgentProfilePage } from '@/pages/AgentProfilePage'
import { PublicWhiteLabelSitePage } from '@/pages/PublicWhiteLabelSitePage'
import { PublicWhiteLabelPropertyPage } from '@/pages/PublicWhiteLabelPropertyPage'
import { ToastProvider } from '@/components/ui/toast'
import { BrandProvider } from '@/context/BrandContext'
import type { ComponentType } from 'react'

const pages: Array<[string, ComponentType]> = [
  ['Login', LoginPage],
  ['Forgot password', ForgotPasswordPage],
  ['Reset password', ResetPasswordPage],
  ['Account recovery', AccountRecoveryPage],
  ['Account recovery complete', AccountRecoveryCompletePage],
  ['Register', AgentRegisterPage],
  ['Terms', TermsPage],
  ['Privacy', PrivacyPage],
  ['Plans', PlansPage],
  ['Listings', ListingsPage],
  ['Dashboard', AgentDashboardPage],
  ['Inbox', InboxPage],
  ['Tasks', TasksPage],
  ['Contacts', ContactsPage],
  ['Opportunities', OpportunitiesPage],
  ['Campaigns', CampaignsPage],
  ['Campaign builder', CampaignBuilderPage],
  ['Command center', CommandCenterPage],
  ['Social channels', SocialChannelsPage],
  ['Notification preferences', NotificationPreferencesPage],
  ['TOTP settings', TotpSettingsPage],
  ['Integrations', IntegrationSettingsPage],
  ['Agency management', AgencyManagementPage],
  ['White-label', WhiteLabelBuilderPage],
  ['Widgets', WidgetBuilderPage],
  ['Message templates', MessageTemplatesPage],
  ['My subscription', MySubscriptionPage],
  ['My credits', MyCreditsPage],
  ['My credit notes', MyCreditNotesPage],
  ['My invoices', MyInvoicesPage],
  ['Agent pricing', AgentPricingPage],
  ['Agency pricing', AgencyPricingPage],
  ['Routing', RoutingSettingsPage],
  ['Historical transactions', HistoricalTransactionsPage],
  ['Public agency', PublicAgencyPage],
  ['Public agent', PublicAgentPortfolioPage],
  ['Area profile', AreaProfilePage],
  ['Neighborhood valuator', NeighborhoodValuatorPage],
  ['CRM analytics', CrmAnalyticsPage],
  ['Contact detail', ContactDetailPage],
  ['Listing profile', ListingProfilePage],
  ['Agent profile', AgentProfilePage],
  ['White-label site', PublicWhiteLabelSitePage],
  ['White-label property', PublicWhiteLabelPropertyPage],
]

function mount(Page: ComponentType) {
  return render(
    <MemoryRouter>
      <BrandProvider>
        <ToastProvider>
          <Page />
        </ToastProvider>
      </BrandProvider>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe.each(['light', 'dark'] as const)('Broadcast %s mode — existing screens', (mode) => {
  it(`renders the catalog without throwing (${mode})`, () => {
    applyLcMode(mode)
    expect(document.documentElement.getAttribute('data-lc-mode')).toBe(mode)
    const failures: string[] = []
    for (const [name, Page] of pages) {
      try {
        const view = mount(Page)
        view.unmount()
      } catch (err) {
        failures.push(`${name}: ${(err as Error).message}`)
      }
    }
    expect(failures).toEqual([])
  })
})
