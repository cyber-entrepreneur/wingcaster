/**
 * AGT-INB-004 assignable-agents resolution tests.
 *
 * Exercises getAssignableAgents against an in-memory DAL: same-agency
 * teammates are assignable, other-agency agents are not, the caller is always
 * included ("assign to me") — including the solo/no-agency case — and an
 * unassigned conversation falls back to the caller's own agency footprint.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const store = vi.hoisted(() => ({ data: {} }))
const db = vi.hoisted(() => ({
  findAll: vi.fn((collection, pred) => {
    const rows = store.data[collection] || []
    return Promise.resolve(pred ? rows.filter(pred) : [...rows])
  }),
  findOne: vi.fn((collection, pred) => Promise.resolve((store.data[collection] || []).find(pred))),
}))
vi.mock('../../db.js', () => db)

let getAssignableAgents

const AGENTS = [
  { id: 'a-self', user_id: 'u-self', name: 'Zoe Self', email: 'zoe@x.test', role: 'admin', agency_id: 'ag1' },
  { id: 'a-mate', user_id: 'u-mate', name: 'Amir Mate', email: 'amir@x.test', role: 'agent', agency_id: 'ag1' },
  { id: 'a-other', user_id: 'u-other', name: 'Otto Other', email: 'otto@x.test', role: 'agent', agency_id: 'ag2' },
]
const MEMBERS = [
  { agency_id: 'ag1', agent_id: 'a-self', status: 'active' },
  { agency_id: 'ag1', agent_id: 'a-mate', status: 'active' },
  { agency_id: 'ag2', agent_id: 'a-other', status: 'active' },
]

beforeEach(async () => {
  store.data = { agents: AGENTS, agency_members: MEMBERS }
  db.findAll.mockClear()
  db.findOne.mockClear()
  ;({ getAssignableAgents } = await import('./assignable-agents.js'))
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('getAssignableAgents', () => {
  it('returns same-agency teammates with the caller first, excluding other agencies', async () => {
    const agents = await getAssignableAgents('a-self', { assigned_agent_id: 'a-self' })
    expect(agents.map((a) => a.id)).toEqual(['a-self', 'a-mate'])
    expect(agents[0].is_self).toBe(true)
    expect(agents[1].is_self).toBe(false)
    expect(agents.find((a) => a.id === 'a-other')).toBeUndefined()
  })

  it('falls back to the caller\'s agency for an unassigned conversation', async () => {
    const agents = await getAssignableAgents('a-self', { assigned_agent_id: null })
    expect(agents.map((a) => a.id).sort()).toEqual(['a-mate', 'a-self'])
  })

  it('resolves the caller by user_id too', async () => {
    const agents = await getAssignableAgents('u-self', { assigned_agent_id: 'a-mate' })
    expect(agents.some((a) => a.id === 'a-self' && a.is_self)).toBe(true)
    expect(agents.some((a) => a.id === 'a-mate')).toBe(true)
  })

  it('returns only the caller for a solo agent with no agency', async () => {
    store.data = {
      agents: [{ id: 'solo', user_id: 'u-solo', name: 'Solo', agency_id: null }],
      agency_members: [],
    }
    const agents = await getAssignableAgents('solo', { assigned_agent_id: 'solo' })
    expect(agents).toHaveLength(1)
    expect(agents[0]).toMatchObject({ id: 'solo', is_self: true })
  })

  it('serializes display fields', async () => {
    const agents = await getAssignableAgents('a-self', { assigned_agent_id: 'a-self' })
    const mate = agents.find((a) => a.id === 'a-mate')
    expect(mate).toMatchObject({ name: 'Amir Mate', email: 'amir@x.test', role: 'agent', is_self: false })
  })
})
