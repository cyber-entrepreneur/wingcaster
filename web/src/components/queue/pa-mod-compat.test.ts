/**
 * Proves PA-queue-family remains importable for PA-MOD after AGN-MEM-002 additive props.
 */
import { describe, expect, it } from 'vitest'
import * as Queue from '@/components/queue'
import type { PAQueueFilterValues, PAQueueSubmittedWithin } from '@/components/queue'

describe('queue family PA-MOD compatibility after AGN-MEM-002', () => {
  it('exports all PA-queue primitives by name', () => {
    expect(typeof Queue.PAQueueFilterStrip).toBe('function')
    expect(typeof Queue.PAQueueTable).toBe('function')
    expect(typeof Queue.PAQueueBulkBar).toBe('function')
    expect(typeof Queue.PAQueueBulkApproveDialog).toBe('function')
    expect(typeof Queue.PAQueueBulkReasonDialog).toBe('function')
    expect(typeof Queue.PAQueueKeyboardShortcutsPanel).toBe('function')
    expect(Queue.PA_QUEUE_DEFAULT_SHORTCUTS.length).toBeGreaterThan(0)
  })

  it('keeps PA-MOD submittedWithin values assignable (incl. additive 90d)', () => {
    const within: PAQueueSubmittedWithin = '7d'
    const values: PAQueueFilterValues = {
      status: 'pending',
      submittedWithin: within,
      riskTier: 'any',
      search: '',
    }
    expect(values.submittedWithin).toBe('7d')
    const with90: PAQueueSubmittedWithin = '90d'
    expect(with90).toBe('90d')
  })
})
