/**
 * AGT-TSK-002 — task detail/edit backend coverage.
 *
 * The task detail drawer edits core fields plus the task type and its linked
 * contact/opportunity. This locks in that (a) taskUpdateSchema accepts those
 * fields and stays strict, and (b) updateTask persists them and validates the
 * type enum. db is mocked so the fast suite runs without Postgres.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const db = vi.hoisted(() => ({
  findAll: vi.fn(),
  findOne: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
}))

vi.mock('./db.js', () => db)

let updateTask
let taskUpdateSchema

beforeEach(async () => {
  vi.resetModules()
  for (const fn of Object.values(db)) fn.mockReset?.()
  ;({ updateTask } = await import('./tasks.js'))
  ;({ taskUpdateSchema } = await import('./lib/validation.js'))
})

afterEach(() => vi.restoreAllMocks())

describe('taskUpdateSchema', () => {
  it('accepts type, contact_id and opportunity_id', () => {
    const parsed = taskUpdateSchema.safeParse({ type: 'call', contact_id: 'c-1', opportunity_id: 'o-1' })
    expect(parsed.success).toBe(true)
  })

  it('allows nulling the linked contact', () => {
    const parsed = taskUpdateSchema.safeParse({ contact_id: null })
    expect(parsed.success).toBe(true)
  })

  it('rejects an unknown field (stays strict)', () => {
    const parsed = taskUpdateSchema.safeParse({ title: 'x', bogus: true })
    expect(parsed.success).toBe(false)
  })

  it('rejects an invalid type', () => {
    const parsed = taskUpdateSchema.safeParse({ type: 'sms' })
    expect(parsed.success).toBe(false)
  })
})

describe('updateTask', () => {
  it('persists type and the linked contact/opportunity', async () => {
    const existing = { id: 't-1', title: 'Follow up', type: 'follow_up', status: 'pending', contact_id: null, opportunity_id: null }
    let stored = existing
    db.findOne.mockImplementation(async () => stored)
    db.update.mockImplementation(async (_c, _pred, fn) => {
      stored = fn(stored)
      return stored
    })

    const result = await updateTask('t-1', { type: 'call', contact_id: 'c-9', opportunity_id: 'o-9' })
    expect(result).toMatchObject({ type: 'call', contact_id: 'c-9', opportunity_id: 'o-9' })
    expect(db.update).toHaveBeenCalledWith('tasks', expect.any(Function), expect.any(Function))
  })

  it('throws on an invalid type', async () => {
    db.findOne.mockResolvedValue({ id: 't-1', status: 'pending', type: 'follow_up' })
    await expect(updateTask('t-1', { type: 'sms' })).rejects.toThrow(/Invalid task type/)
    expect(db.update).not.toHaveBeenCalled()
  })

  it('returns null when the task does not exist', async () => {
    db.findOne.mockResolvedValue(null)
    const result = await updateTask('ghost', { title: 'x' })
    expect(result).toBeNull()
    expect(db.update).not.toHaveBeenCalled()
  })

  it('sets completed_at when transitioning to completed', async () => {
    const existing = { id: 't-1', status: 'pending', type: 'follow_up', completed_at: null }
    let stored = existing
    db.findOne.mockImplementation(async () => stored)
    db.update.mockImplementation(async (_c, _pred, fn) => {
      stored = fn(stored)
      return stored
    })
    const result = await updateTask('t-1', { status: 'completed' })
    expect(result.completed_at).toBeTruthy()
  })
})
