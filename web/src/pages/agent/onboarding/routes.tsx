import { Navigate, Route } from 'react-router-dom'
import { WelcomePage } from './WelcomePage'
import { WhatsAppIntakeTourPage } from './WhatsAppIntakeTourPage'
import { FirstListingReviewPage } from './FirstListingReviewPage'
import { CelebrationPage } from './CelebrationPage'

/**
 * AGT-ONB routes. Celebration (`published`) MUST register before `:draftId`.
 * WLB tour steps (`/code`, `/waiting`, `/drafting/:sessionId`, `/connect`)
 * are owned by the WhatsApp-intake family — do not register them here.
 */
export const onboardingRoutes = (
  <>
    <Route path="/onboarding" element={<Navigate to="/onboarding/welcome" replace />} />
    <Route path="/onboarding/welcome" element={<WelcomePage />} />
    <Route path="/onboarding/whatsapp" element={<WhatsAppIntakeTourPage />} />
    <Route path="/onboarding/first-listing/published" element={<CelebrationPage />} />
    <Route path="/onboarding/first-listing/:draftId" element={<FirstListingReviewPage />} />
  </>
)
