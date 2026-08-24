/**
 * Fast suite — snapshot_note validation on deprecateCommercial.
 */
import { describe, expect, it } from 'vitest'
import { validateSnapshotNote } from '../deprecation.js'

describe('validateSnapshotNote', () => {
  it('refuses missing snapshot note', () => {
    expect(() => validateSnapshotNote(null)).toThrow('SNAPSHOT_NOTE_REQUIRED')
    expect(() => validateSnapshotNote('')).toThrow('SNAPSHOT_NOTE_REQUIRED')
  })

  it('refuses short snapshot note', () => {
    expect(() => validateSnapshotNote('too-short')).toThrow('SNAPSHOT_NOTE_REQUIRED')
    expect(() => validateSnapshotNote('x'.repeat(19))).toThrow('SNAPSHOT_NOTE_REQUIRED')
  })

  it('accepts snapshot note >= 20 chars', () => {
    const note = 'snap-id@2026-08-17, verified by ops lead'
    expect(validateSnapshotNote(note)).toBe(note)
  })
})
