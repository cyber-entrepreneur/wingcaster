import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * WF-31 anchor discipline (AGN-SET-005 / AGT-REC-006 briefs §Anchor guard):
 * the 3-factor `<OwnershipTransferChallenge>` must be imported by both the
 * initiator and the recipient screens, and the outcome screen must compose the
 * REC-family anchors + the WF-31 challenge anchor rather than re-implementing.
 */
const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')

function read(rel: string): string {
  return readFileSync(path.join(SRC, rel), 'utf8')
}

const CHALLENGE_IMPORT = /from '@\/components\/agency\/OwnershipTransferChallenge'/
const REC_ANCHOR_IMPORT = /from '@\/components\/recipient'/

describe('WF-31 anchor imports', () => {
  it('AGN-SET-005 initiator imports the challenge anchor', () => {
    expect(read('pages/agency/AgencyOwnershipTransferInitiatorPage.tsx')).toMatch(CHALLENGE_IMPORT)
  })

  it('AGN-SET-005b recipient imports the challenge anchor', () => {
    expect(read('pages/agency/AgencyOwnershipTransferAcceptPage.tsx')).toMatch(CHALLENGE_IMPORT)
  })

  it('AGT-REC-006 outcome imports both the REC-family anchors and the challenge anchor', () => {
    const src = read('pages/agent/OwnershipTransferOutcomePage.tsx')
    expect(src).toMatch(REC_ANCHOR_IMPORT)
    expect(src).toMatch(CHALLENGE_IMPORT)
    expect(src).toMatch(/\bStatusHero\b/)
    expect(src).toMatch(/\bPrimaryCtaPerState\b/)
  })
})
