/**
 * Phase A page discovery for Wave 5 Agent 7 (a11y + visual).
 * Confirms Agents 1–5 page modules exist after local Phase A merge.
 */
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

export const PHASE_A_PAGES = {
  /** AGT-APR-004 */
  badComparableSubmit: path.join(ROOT, 'pages/agent/reports/BadComparableReportPage.tsx'),
  /** AGT-APR-005 */
  priceReportSubmit: path.join(ROOT, 'pages/agent/reports/PriceReportPage.tsx'),
  /** AGT-REC-002 */
  comparableOutcome: path.join(ROOT, 'pages/agent/reports/ComparableReportOutcomePage.tsx'),
  /** AGT-REC-003 */
  priceOutcome: path.join(ROOT, 'pages/agent/reports/PriceReportOutcomePage.tsx'),
  /** PA-PVA-008 */
  badComparableQueue: path.join(ROOT, 'pages/admin/valuation/BadComparableQueuePage.tsx'),
  /** PA-PVA-008b */
  badComparableDetail: path.join(ROOT, 'pages/admin/valuation/BadComparableDetailPage.tsx'),
  /** PA-PVA-009 */
  priceReportQueue: path.join(ROOT, 'pages/admin/valuation/PriceReportQueuePage.tsx'),
  /** PA-PVA-009b */
  priceReportDetail: path.join(ROOT, 'pages/admin/valuation/PriceReportDetailPage.tsx'),
} as const

export type PhaseAPageKey = keyof typeof PHASE_A_PAGES

export function phaseAPageExists(key: PhaseAPageKey): boolean {
  return existsSync(PHASE_A_PAGES[key])
}

export function phaseAReadyCount(): number {
  return (Object.keys(PHASE_A_PAGES) as PhaseAPageKey[]).filter((k) => phaseAPageExists(k)).length
}

export function phaseAStatus() {
  return {
    badComparableSubmit: phaseAPageExists('badComparableSubmit'),
    priceReportSubmit: phaseAPageExists('priceReportSubmit'),
    comparableOutcome: phaseAPageExists('comparableOutcome'),
    priceOutcome: phaseAPageExists('priceOutcome'),
    badComparableQueue: phaseAPageExists('badComparableQueue'),
    badComparableDetail: phaseAPageExists('badComparableDetail'),
    priceReportQueue: phaseAPageExists('priceReportQueue'),
    priceReportDetail: phaseAPageExists('priceReportDetail'),
    readyCount: phaseAReadyCount(),
  }
}
