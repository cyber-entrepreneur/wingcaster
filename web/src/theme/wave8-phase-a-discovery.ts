/**
 * Phase A page discovery for Wave 8 Agent 7 (a11y + visual).
 * Confirms Agents 1–5 (+ Agent 6 e2e merge) modules exist on the quality tip.
 */
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

export const PHASE_A_PAGES = {
  /** AGT-DSH-002 */
  proDashboard: path.join(ROOT, 'pages/agent/dashboard/ProDashboard.tsx'),
  /** AGT-DSH-002 mount */
  dshMount: path.join(ROOT, 'pages/agent/dashboard/AgentDashboardModeMount.tsx'),
  /** AGT-LST-002 */
  proListingsTable: path.join(ROOT, 'pages/agent/listings/ProListingsTable.tsx'),
  /** AGT-LST-001 surface */
  listingsPage: path.join(ROOT, 'pages/ListingsPage.tsx'),
  /** AGT-LST-004 */
  manualComposer: path.join(ROOT, 'pages/agent/listings/ManualListingComposerPage.tsx'),
  /** AGT-INB-001/002 */
  inboxPage: path.join(ROOT, 'pages/InboxPage.tsx'),
  /** AGT-INB-005 dual-badge */
  channelSourceBadges: path.join(ROOT, 'components/inbox/ChannelSourceBadges.tsx'),
  /** AGT-CTC-007 */
  relationshipsEditor: path.join(ROOT, 'pages/agent/contacts/RelationshipsEditorPage.tsx'),
  /** AGT-CTC-007b public consent */
  consentLanding: path.join(ROOT, 'pages/public/RelationshipConsentPage.tsx'),
  /** AGT-SET-002 */
  interfaceModeCard: path.join(ROOT, 'components/settings/InterfaceModeCard.tsx'),
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
    proDashboard: phaseAPageExists('proDashboard'),
    dshMount: phaseAPageExists('dshMount'),
    proListingsTable: phaseAPageExists('proListingsTable'),
    listingsPage: phaseAPageExists('listingsPage'),
    manualComposer: phaseAPageExists('manualComposer'),
    inboxPage: phaseAPageExists('inboxPage'),
    channelSourceBadges: phaseAPageExists('channelSourceBadges'),
    relationshipsEditor: phaseAPageExists('relationshipsEditor'),
    consentLanding: phaseAPageExists('consentLanding'),
    interfaceModeCard: phaseAPageExists('interfaceModeCard'),
    readyCount: phaseAReadyCount(),
  }
}
