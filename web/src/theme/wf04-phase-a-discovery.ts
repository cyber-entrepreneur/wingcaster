/**
 * Phase A page discovery for Wave 3 Agent 5 (a11y + PII-safety visual).
 * When Agents 1–3 land their pages, page-level suites activate.
 */
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

export const PHASE_A_PAGES = {
  deletionConfirm: path.join(ROOT, 'pages/public/ScheduledDeletionConfirmationPage.tsx'),
  deletionCountdown: path.join(ROOT, 'components/deletion/DeletionCountdown.tsx'),
  acrQueue: path.join(ROOT, 'pages/admin/AccountRecoveryQueuePage.tsx'),
  acrDetail: path.join(ROOT, 'pages/admin/AccountRecoveryDetailPage.tsx'),
} as const

export function phaseAPageExists(key: keyof typeof PHASE_A_PAGES): boolean {
  return existsSync(PHASE_A_PAGES[key])
}

export function phaseAReadyCount(): number {
  return (Object.keys(PHASE_A_PAGES) as (keyof typeof PHASE_A_PAGES)[]).filter((k) =>
    phaseAPageExists(k),
  ).length
}

export function phaseAStatus() {
  return {
    deletionConfirm: phaseAPageExists('deletionConfirm'),
    deletionCountdown: phaseAPageExists('deletionCountdown'),
    acrQueue: phaseAPageExists('acrQueue'),
    acrDetail: phaseAPageExists('acrDetail'),
    readyCount: phaseAReadyCount(),
  }
}
