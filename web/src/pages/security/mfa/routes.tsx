import { Route } from 'react-router-dom'
import { LoginFlow } from './LoginFlow'
import { TwoFactorSettingsPage } from './TwoFactorSettingsPage'
import { TotpEnrollPage } from './TotpEnrollPage'
import { BackupCodesViewerPage } from './BackupCodesViewerPage'

/**
 * MFA family routes (SHR-MFA-001..007).
 * Import once from App.tsx.
 */
export const mfaRoutes = (
  <>
    <Route path="/login" element={<LoginFlow />} />
    <Route path="/settings/2fa" element={<TwoFactorSettingsPage />} />
    <Route path="/settings/2fa/enroll" element={<TotpEnrollPage />} />
    <Route path="/settings/2fa/backup-codes" element={<BackupCodesViewerPage />} />
  </>
)

export { LoginFlow }
