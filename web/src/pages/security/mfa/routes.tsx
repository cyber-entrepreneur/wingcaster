import { Route } from 'react-router-dom'
import { LoginFlow } from './LoginFlow'
import { TwoFactorSettingsPage } from './TwoFactorSettingsPage'
import { TotpEnrollPage } from './TotpEnrollPage'
import { BackupCodesViewerPage } from './BackupCodesViewerPage'
import { PasskeysPage } from './PasskeysPage'

/**
 * MFA family routes (SHR-MFA-001..007 + issue 189 passkeys).
 *
 * Import from App.tsx:
 * - `mfaRoutes` — top-level `/login` flow wrapper
 * - `mfaSettingsChildRoutes` — nested children of `/settings` (SettingsPage Outlet)
 *
 * Do not register `/settings/2fa` as a second top-level route.
 */
export const mfaRoutes = <Route path="/login" element={<LoginFlow />} />

export const mfaSettingsChildRoutes = (
  <>
    <Route path="2fa" element={<TwoFactorSettingsPage />} />
    <Route path="2fa/enroll" element={<TotpEnrollPage />} />
    <Route path="2fa/backup-codes" element={<BackupCodesViewerPage />} />
    <Route path="2fa/passkeys" element={<PasskeysPage />} />
  </>
)

export { LoginFlow }
