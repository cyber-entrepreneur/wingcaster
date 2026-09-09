import { Route } from 'react-router-dom'
import { WhatsAppConnectPage } from './WhatsAppConnectPage'
import { ActivationCodePage } from './ActivationCodePage'
import { FirstMessageWaitingPage } from './FirstMessageWaitingPage'
import { ListingDraftingPage } from './ListingDraftingPage'

/**
 * AGT-WLB tour routes. Does NOT register `/onboarding/whatsapp` (exact) —
 * that path belongs to AGT-ONB-002.
 */
export const whatsappIntakeRoutes = (
  <>
    <Route path="/onboarding/whatsapp/connect" element={<WhatsAppConnectPage />} />
    <Route path="/settings/channels/whatsapp/connect" element={<WhatsAppConnectPage />} />
    <Route path="/onboarding/whatsapp/code" element={<ActivationCodePage />} />
    <Route path="/settings/channels/whatsapp/code" element={<ActivationCodePage />} />
    <Route path="/onboarding/whatsapp/waiting" element={<FirstMessageWaitingPage />} />
    <Route path="/onboarding/whatsapp/drafting/:sessionId" element={<ListingDraftingPage />} />
  </>
)

export {
  WhatsAppConnectPage,
  ActivationCodePage,
  FirstMessageWaitingPage,
  ListingDraftingPage,
}
