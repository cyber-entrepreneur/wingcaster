import { Navigate, Route } from 'react-router-dom'
import { ActivationFirstListingPage } from './ActivationFirstListingPage'
import { ActivationInviteTeamPage } from './ActivationInviteTeamPage'
import { ActivationPortalCredentialsPage } from './ActivationPortalCredentialsPage'
import { ActivationWelcomePage } from './ActivationWelcomePage'
import { ActivationWhatsAppPage } from './ActivationWhatsAppPage'
import { ActivationWorkingHoursPage } from './ActivationWorkingHoursPage'
import { isActivationWizardEnabled } from './featureFlag'

function Gate({ children }: { children: React.ReactElement }) {
  if (!isActivationWizardEnabled()) return <Navigate to="/dashboard" replace />
  return children
}

/**
 * AGT-ACT family routes. Import into `App.tsx` and spread inside `<Routes>`.
 */
export const activationRoutes = (
  <>
    <Route path="/activate" element={<Gate><ActivationWelcomePage /></Gate>} />
    <Route path="/activate/welcome" element={<Gate><ActivationWelcomePage /></Gate>} />
    <Route path="/activate/whatsapp" element={<Gate><ActivationWhatsAppPage /></Gate>} />
    <Route path="/activate/first-listing" element={<Gate><ActivationFirstListingPage /></Gate>} />
    <Route path="/activate/portal-credentials" element={<Gate><ActivationPortalCredentialsPage /></Gate>} />
    <Route path="/activate/working-hours" element={<Gate><ActivationWorkingHoursPage /></Gate>} />
    <Route path="/activate/invite-team" element={<Gate><ActivationInviteTeamPage /></Gate>} />
  </>
)
