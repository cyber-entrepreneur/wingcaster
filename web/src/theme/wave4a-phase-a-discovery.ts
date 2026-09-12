/**
 * Phase A page discovery for Wave 4A Agent 7 (a11y + visual).
 * When ONB / WLB / ACT / state-hook / dsh-mount land, page-level suites activate.
 */
import { existsSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

export const PHASE_A_DIRS = {
  onboarding: path.join(ROOT, 'pages/agent/onboarding'),
  whatsappIntake: path.join(ROOT, 'pages/agent/whatsapp-intake'),
  activation: path.join(ROOT, 'pages/agent/activation'),
  stateHook: path.join(ROOT, 'hooks/useOnboardingState.ts'),
  dashboard: path.join(ROOT, 'pages/AgentDashboardPage.tsx'),
} as const

const PAGE_CANDIDATES = {
  'ONB-001': [
    'pages/agent/onboarding/WelcomePage.tsx',
    'pages/agent/onboarding/OnboardingWelcomePage.tsx',
    'pages/agent/onboarding/OnbWelcomePage.tsx',
  ],
  'ONB-002': [
    'pages/agent/onboarding/WhatsAppTourPage.tsx',
    'pages/agent/onboarding/WhatsAppIntakeTourPage.tsx',
  ],
  'ONB-003': [
    'pages/agent/onboarding/FirstListingReviewPage.tsx',
    'pages/agent/onboarding/DraftReviewPage.tsx',
  ],
  'ONB-004': [
    'pages/agent/onboarding/CelebrationPage.tsx',
    'pages/agent/onboarding/FirstListingPublishedPage.tsx',
  ],
  'ONB-005': [
    'pages/agent/onboarding/OnboardingChecklistWidget.tsx',
    'pages/agent/onboarding/ProgressChecklist.tsx',
  ],
  'WLB-001': [
    'pages/agent/whatsapp-intake/WhatsAppConnectPage.tsx',
    'pages/agent/whatsapp-intake/WhatsAppIntakePage.tsx',
  ],
  'WLB-002': [
    'pages/agent/whatsapp-intake/ActivationCodePage.tsx',
    'pages/agent/whatsapp-intake/WhatsAppCodePage.tsx',
  ],
  'WLB-003': [
    'pages/agent/whatsapp-intake/FirstMessageWaitingPage.tsx',
    'pages/agent/whatsapp-intake/FirstMessagePage.tsx',
    'pages/agent/whatsapp-intake/WhatsAppWaitingPage.tsx',
  ],
  'WLB-004': [
    'pages/agent/whatsapp-intake/ListingDraftingPage.tsx',
    'pages/agent/whatsapp-intake/WhatsAppDraftingPage.tsx',
  ],
  'WLB-005': [
    'pages/agent/whatsapp-intake/ListingReadyPage.tsx',
    'pages/agent/whatsapp-intake/ListingDraftingPage.tsx',
    'pages/agent/whatsapp-intake/WhatsAppDraftingPage.tsx',
  ],
  'ACT-001': [
    'pages/agent/activation/ActivationWelcomePage.tsx',
    'pages/agent/activation/ActivatePage.tsx',
  ],
  'ACT-002': [
    'pages/agent/activation/WhatsAppConnectPage.tsx',
    'pages/agent/activation/ActivateWhatsAppPage.tsx',
  ],
  'ACT-003': [
    'pages/agent/activation/FirstListingPage.tsx',
    'pages/agent/activation/ActivateFirstListingPage.tsx',
  ],
  'ACT-004': [
    'pages/agent/activation/PortalCredentialsPage.tsx',
    'pages/agent/activation/PortalCredentialsLockedPage.tsx',
  ],
  'ACT-005': [
    'pages/agent/activation/InviteTeamPage.tsx',
    'pages/agent/activation/InviteTeamStepPage.tsx',
  ],
} as const

export type Wave4aScreenId = keyof typeof PAGE_CANDIDATES

export function phaseADirExists(key: keyof typeof PHASE_A_DIRS): boolean {
  return existsSync(PHASE_A_DIRS[key])
}

export function resolvePhaseAPage(id: Wave4aScreenId): string | null {
  for (const rel of PAGE_CANDIDATES[id]) {
    const full = path.join(ROOT, rel)
    if (existsSync(full)) return full
  }
  return null
}

function listTsx(dir: string): string[] {
  if (!existsSync(dir)) return []
  return readdirSync(dir)
    .filter((name) => /\.tsx$/.test(name) && !name.includes('.test.') && !name.includes('.spec.'))
    .map((name) => path.join(dir, name))
}

export function phaseAStatus() {
  const onboardingFiles = listTsx(PHASE_A_DIRS.onboarding)
  const wlbFiles = listTsx(PHASE_A_DIRS.whatsappIntake)
  const actFiles = listTsx(PHASE_A_DIRS.activation)
  return {
    onboarding: phaseADirExists('onboarding'),
    whatsappIntake: phaseADirExists('whatsappIntake'),
    activation: phaseADirExists('activation'),
    stateHook: existsSync(PHASE_A_DIRS.stateHook),
    onboardingFileCount: onboardingFiles.length,
    wlbFileCount: wlbFiles.length,
    actFileCount: actFiles.length,
    readyCount: onboardingFiles.length + wlbFiles.length + actFiles.length,
    onboardingFiles,
    wlbFiles,
    actFiles,
  }
}
