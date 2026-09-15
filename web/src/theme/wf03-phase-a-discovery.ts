/**
 * Phase A page discovery for Wave 2 Agent 7.
 * When Agents 1–5 land their pages, page-level a11y/visual suites activate.
 */
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

export const PHASE_A_PAGES = {
  receipt: path.join(ROOT, 'pages/agent/PublishReceiptPage.tsx'),
  tracker: path.join(ROOT, 'pages/agent/PortalTrackerPage.tsx'),
  paQueue: path.join(ROOT, 'pages/admin/PortalModerationQueuePage.tsx'),
  paDetail: path.join(ROOT, 'pages/admin/PortalModerationDetailPage.tsx'),
  submit:
    [
      path.join(ROOT, 'pages/agent/PortalSubmitPage.tsx'),
      path.join(ROOT, 'pages/agent/PublishSubmitPage.tsx'),
      path.join(ROOT, 'pages/listings/PortalSubmitPage.tsx'),
    ].find((p) => existsSync(p)) ?? path.join(ROOT, 'pages/agent/PortalSubmitPage.tsx'),
} as const

export function phaseAPageExists(key: keyof typeof PHASE_A_PAGES): boolean {
  return existsSync(PHASE_A_PAGES[key])
}

export function phaseAReadyCount(): number {
  return (['receipt', 'tracker', 'paQueue', 'paDetail', 'submit'] as const).filter((k) =>
    phaseAPageExists(k),
  ).length
}

export function phaseAStatus() {
  return {
    receipt: phaseAPageExists('receipt'),
    tracker: phaseAPageExists('tracker'),
    paQueue: phaseAPageExists('paQueue'),
    paDetail: phaseAPageExists('paDetail'),
    submit: phaseAPageExists('submit'),
    readyCount: phaseAReadyCount(),
  }
}
