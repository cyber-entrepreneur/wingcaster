import { describe, expect, it } from 'vitest'
import { authorizeInspectorPropertyRate, propertyMatchesArea } from './property-area-match.js'

describe('propertyMatchesArea', () => {
  it('matches a neighborhood area by name against property.neighborhood', () => {
    expect(propertyMatchesArea(
      { city: 'Beirut', neighborhood: 'Hamra' },
      { name: 'Hamra', slug: 'hamra', level: 'neighborhood' },
    )).toBe(true)
  })

  it('matches a city area by name against property.city', () => {
    expect(propertyMatchesArea(
      { city: 'Beirut', neighborhood: 'Hamra' },
      { name: 'Beirut', slug: 'beirut', level: 'city' },
    )).toBe(true)
  })

  it('rejects a neighborhood assignment for a property in a different area', () => {
    expect(propertyMatchesArea(
      { city: 'Beirut', neighborhood: 'Achrafieh' },
      { name: 'Hamra', slug: 'hamra', level: 'neighborhood' },
    )).toBe(false)
  })
})

describe('authorizeInspectorPropertyRate', () => {
  const property = { id: 'p1', city: 'Beirut', neighborhood: 'Hamra' }
  const area = { id: 'area-hamra', name: 'Hamra', slug: 'hamra', level: 'neighborhood' }
  const assignment = { id: 'asg-1', agent_id: 'inspector-1', area_id: 'area-hamra' }

  it('requires assignment_id for inspectors', async () => {
    const result = await authorizeInspectorPropertyRate({
      user: { id: 'inspector-1' },
      assignmentId: null,
      property,
      inspectorService: { getAssignmentById: async () => assignment },
      areaService: { getById: async () => area },
    })
    expect(result).toMatchObject({ ok: false, status: 400 })
  })

  it('rejects an assignment owned by someone else', async () => {
    const result = await authorizeInspectorPropertyRate({
      user: { id: 'inspector-2' },
      assignmentId: 'asg-1',
      property,
      inspectorService: { getAssignmentById: async () => assignment },
      areaService: { getById: async () => area },
    })
    expect(result).toMatchObject({ ok: false, status: 403 })
  })

  it('rejects when the assignment area does not cover the property', async () => {
    const result = await authorizeInspectorPropertyRate({
      user: { id: 'inspector-1' },
      assignmentId: 'asg-1',
      property: { id: 'p1', city: 'Beirut', neighborhood: 'Achrafieh' },
      inspectorService: { getAssignmentById: async () => assignment },
      areaService: { getById: async () => area },
    })
    expect(result).toMatchObject({ ok: false, status: 403, error: expect.stringMatching(/does not cover/) })
  })

  it('allows an inspector whose assignment covers the property', async () => {
    const result = await authorizeInspectorPropertyRate({
      user: { id: 'inspector-1' },
      assignmentId: 'asg-1',
      property,
      inspectorService: { getAssignmentById: async () => assignment },
      areaService: { getById: async () => area },
    })
    expect(result.ok).toBe(true)
    expect(result.assignment.id).toBe('asg-1')
  })

  it('lets a platform admin skip the assignment check', async () => {
    const result = await authorizeInspectorPropertyRate({
      user: { id: 'pa-1' },
      assignmentId: null,
      property,
      inspectorService: { getAssignmentById: async () => { throw new Error('should not load') } },
      areaService: { getById: async () => { throw new Error('should not load') } },
      isPlatformAdmin: true,
    })
    expect(result).toEqual({ ok: true, assignment: null, area: null })
  })
})
