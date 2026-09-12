import { Navigate, Route } from 'react-router-dom'
import { SettingsHomePage } from './SettingsHomePage'
import { AccountPage } from './AccountPage'
import { BillingPage } from './BillingPage'
import { SessionsPage } from './SessionsPage'
import { PasswordPage } from './PasswordPage'
import { DeleteAccountPage } from './DeleteAccountPage'
import { SettingsUnavailablePage } from './SettingsUnavailablePage'

/**
 * Child routes of `/settings` (SHR-SET-001..005).
 *
 * MFA-owned pages (`/settings/2fa`, `/settings/2fa/*`) are NOT implemented
 * here. App.tsx nests them as children of `<SettingsPage />` so they inherit
 * the shell; the MFA agent replaces TotpSettingsPage. Brief aliases
 * `/settings/security/2fa` redirect into that MFA route.
 */
export const settingsRoutes = (
  <>
    <Route index element={<SettingsHomePage />} />
    <Route path="account" element={<AccountPage />} />
    <Route path="account/locale" element={<AccountPage section="locale" />} />
    <Route path="account/timezone" element={<AccountPage section="timezone" />} />
    <Route path="password" element={<PasswordPage />} />
    <Route path="security/password" element={<Navigate to="/settings/password" replace />} />
    <Route path="sessions" element={<SessionsPage />} />
    <Route path="security/sessions" element={<Navigate to="/settings/sessions" replace />} />
    <Route path="billing" element={<BillingPage />} />
    <Route path="notifications" element={<BillingPage section="channels" />} />
    <Route path="notifications/billing" element={<Navigate to="/settings/notifications" replace />} />
    <Route path="danger/delete-account" element={<DeleteAccountPage />} />
    <Route path="delete-account" element={<Navigate to="/settings/danger/delete-account" replace />} />
    <Route path="account/delete" element={<Navigate to="/settings/danger/delete-account" replace />} />
    <Route path="security/2fa" element={<Navigate to="/settings/2fa" replace />} />
    <Route path="security/2fa/*" element={<Navigate to="/settings/2fa" replace />} />
    <Route path="*" element={<SettingsUnavailablePage />} />
  </>
)
