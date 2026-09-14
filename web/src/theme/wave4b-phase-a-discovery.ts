/**
 * Phase A page discovery for Wave 4B Agent 5 (a11y + visual).
 * When MFA / Settings / sessions-be land, page-level suites can activate.
 */
import { existsSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

export const PHASE_A_DIRS = {
  mfaPages: path.join(ROOT, 'pages/security/mfa'),
  mfaPagesAlt: path.join(ROOT, 'pages/mfa'),
  settingsPages: path.join(ROOT, 'pages/settings'),
  settingsPage: path.join(ROOT, 'pages/SettingsPage.tsx'),
  printCss: path.join(ROOT, 'print.css'),
} as const

const PAGE_CANDIDATES = {
  'MFA-001': [
    'pages/security/mfa/TwoFactorSettingsPage.tsx',
    'pages/settings/TwoFactorSettingsPage.tsx',
    'pages/settings/2fa/TwoFactorSettingsPage.tsx',
    'pages/TotpSettingsPage.tsx',
  ],
  'MFA-002': [
    'pages/security/mfa/TotpSetupQrPage.tsx',
    'pages/settings/2fa/TotpSetupPage.tsx',
    'pages/settings/2fa/EnrollQrPage.tsx',
  ],
  'MFA-003': [
    'pages/security/mfa/TotpVerifyPage.tsx',
    'pages/settings/2fa/TotpVerifyPage.tsx',
    'pages/settings/2fa/EnrollVerifyPage.tsx',
  ],
  'MFA-004': [
    'pages/security/mfa/TwoFactorChallengePage.tsx',
    'pages/LoginPage.tsx',
  ],
  'MFA-004b': [
    'pages/security/mfa/BackupCodeSignInPage.tsx',
    'pages/LoginPage.tsx',
  ],
  'MFA-005': [
    'pages/security/mfa/BackupCodesPage.tsx',
    'pages/settings/2fa/BackupCodesPage.tsx',
    'pages/settings/BackupCodesPage.tsx',
  ],
  'SET-001': [
    'pages/SettingsPage.tsx',
    'pages/settings/SettingsHomePage.tsx',
    'pages/settings/SettingsIndexPage.tsx',
  ],
  'SET-002': [
    'pages/settings/AccountPage.tsx',
    'pages/settings/AccountProfilePage.tsx',
    'pages/settings/ProfilePage.tsx',
  ],
  'SET-003': [
    'pages/settings/BillingNotificationsPage.tsx',
    'pages/settings/BillingPage.tsx',
    'pages/NotificationPreferencesPage.tsx',
  ],
  'SET-004': [
    'pages/settings/SessionsPage.tsx',
    'pages/settings/SessionsDevicesPage.tsx',
    'pages/settings/SessionsAndDevicesPage.tsx',
  ],
  'SET-005': [
    'pages/settings/DeleteAccountPage.tsx',
    'pages/settings/DangerZonePage.tsx',
  ],
} as const

export type Wave4bScreenId = keyof typeof PAGE_CANDIDATES

export function resolvePhaseAPage(id: Wave4bScreenId): string | null {
  for (const rel of PAGE_CANDIDATES[id]) {
    const full = path.join(ROOT, rel)
    if (existsSync(full)) return full
  }
  return null
}

function listTsx(dir: string, acc: string[] = []): string[] {
  if (!existsSync(dir)) return acc
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name)
    const stat = statSync(full)
    if (stat.isDirectory()) {
      listTsx(full, acc)
    } else if (/\.tsx$/.test(name) && !name.includes('.test.') && !name.includes('.spec.')) {
      acc.push(full)
    }
  }
  return acc
}

export function phaseAStatus() {
  const mfaFiles = [
    ...listTsx(PHASE_A_DIRS.mfaPages),
    ...listTsx(PHASE_A_DIRS.mfaPagesAlt),
    ...listTsx(path.join(ROOT, 'pages/settings/2fa')),
  ]
  const settingsFiles = [
    ...(existsSync(PHASE_A_DIRS.settingsPage) ? [PHASE_A_DIRS.settingsPage] : []),
    ...listTsx(PHASE_A_DIRS.settingsPages),
  ]
  const unique = [...new Set([...mfaFiles, ...settingsFiles])]
  return {
    mfaDir: existsSync(PHASE_A_DIRS.mfaPages) || existsSync(PHASE_A_DIRS.mfaPagesAlt),
    settingsDir: existsSync(PHASE_A_DIRS.settingsPages),
    settingsPage: existsSync(PHASE_A_DIRS.settingsPage),
    printCss: existsSync(PHASE_A_DIRS.printCss),
    mfaFileCount: mfaFiles.length,
    settingsFileCount: settingsFiles.length,
    readyCount: unique.length,
    resolved: (Object.keys(PAGE_CANDIDATES) as Wave4bScreenId[]).map((id) => ({
      id,
      path: resolvePhaseAPage(id),
    })),
  }
}
