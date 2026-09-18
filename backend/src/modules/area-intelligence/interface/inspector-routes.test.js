/**
 * PA-INS-002 — Inspection submit route tests.
 *
 * Boots only the inspector routes against a bare Express app with a mocked
 * inspector service and an injected auth middleware. Covers: create validates
 * the body (zod .strict()), rejects unknown keys, persists the signature,
 * flips the assignment to completed, and returns a leak-safe 404 when the
 * assignment is missing OR owned by another inspector (never 403).
 */
import express from 'express'
import request from 'supertest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../../auth.js', () => ({
  authMiddleware: (req, _res, next) => {
    req.user = { id: req.headers['x-test-user'] || 'agent-1', role: req.headers['x-test-role'] || 'agent' }
    next()
  },
}))

let registerInspectorRoutes

const inspectorService = {
  getAssignmentById: vi.fn(),
  createSubmission: vi.fn(),
  updateAssignmentStatus: vi.fn(),
  listAssignments: vi.fn(),
  listSubmissions: vi.fn(),
}
const areaService = { getById: vi.fn() }
const dimensionService = { list: vi.fn() }
const logger = { error: vi.fn(), info: vi.fn() }

async function createApp() {
  const app = express()
  app.use(express.json({ limit: '2mb' }))
  registerInspectorRoutes(app, { inspectorService, areaService, dimensionService, config: {}, logger })
  return app
}

const validBody = {
  assignment_id: 'as-1',
  area_id: 'area-1',
  gps_latitude: 25.2,
  gps_longitude: 55.3,
  dimension_scores: { safety_security: 7 },
  photo_urls: ['https://cdn.example/a.jpg'],
  notes: 'All clear',
  signature: 'data:image/png;base64,AAAA',
}

beforeEach(async () => {
  vi.resetModules()
  for (const fn of Object.values(inspectorService)) fn.mockReset()
  areaService.getById.mockReset()
  dimensionService.list.mockReset()
  logger.error.mockReset()
  ;({ registerInspectorRoutes } = await import('./inspector-routes.js'))
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('POST /api/inspector/submissions', () => {
  it('creates a submission, completes the assignment, and returns 201 with a clean shape', async () => {
    inspectorService.getAssignmentById.mockResolvedValue({ id: 'as-1', agent_id: 'agent-1', area_id: 'area-1' })
    inspectorService.createSubmission.mockResolvedValue({
      id: 'sub-1',
      assignment_id: 'as-1',
      agent_id: 'agent-1',
      area_id: 'area-1',
      gps_latitude: '25.20000000',
      gps_longitude: '55.30000000',
      photo_urls: JSON.stringify(['https://cdn.example/a.jpg']),
      dimension_scores: JSON.stringify({ safety_security: 7 }),
      notes: 'All clear',
      signature: 'data:image/png;base64,AAAA',
      status: 'pending_review',
      submitted_at: '2026-01-01T00:00:00Z',
    })
    const app = await createApp()
    const res = await request(app).post('/api/inspector/submissions').send(validBody)
    expect(res.status).toBe(201)
    expect(res.body.gps_latitude).toBe(25.2) // numeric, not string
    expect(res.body.photo_urls).toEqual(['https://cdn.example/a.jpg']) // parsed JSON
    expect(res.body.dimension_scores).toEqual({ safety_security: 7 })
    expect(res.body.signature).toBe('data:image/png;base64,AAAA')
    expect(inspectorService.createSubmission).toHaveBeenCalledWith(
      expect.objectContaining({ agent_id: 'agent-1', signature: 'data:image/png;base64,AAAA' }),
    )
    expect(inspectorService.updateAssignmentStatus).toHaveBeenCalledWith('as-1', 'completed')
  })

  it('rejects a body with an unknown key (strict)', async () => {
    const app = await createApp()
    const res = await request(app)
      .post('/api/inspector/submissions')
      .send({ ...validBody, sneaky: true })
    expect(res.status).toBe(400)
    expect(inspectorService.createSubmission).not.toHaveBeenCalled()
  })

  it('rejects a missing required field', async () => {
    const app = await createApp()
    const { gps_latitude, ...rest } = validBody
    const res = await request(app).post('/api/inspector/submissions').send(rest)
    expect(res.status).toBe(400)
    expect(inspectorService.getAssignmentById).not.toHaveBeenCalled()
  })

  it('returns 404 (not 403) when the assignment is owned by another inspector', async () => {
    inspectorService.getAssignmentById.mockResolvedValue({ id: 'as-1', agent_id: 'someone-else', area_id: 'area-1' })
    const app = await createApp()
    const res = await request(app).post('/api/inspector/submissions').send(validBody)
    expect(res.status).toBe(404)
    expect(inspectorService.createSubmission).not.toHaveBeenCalled()
  })

  it('returns 404 when the assignment does not exist', async () => {
    inspectorService.getAssignmentById.mockResolvedValue(null)
    const app = await createApp()
    const res = await request(app).post('/api/inspector/submissions').send(validBody)
    expect(res.status).toBe(404)
    expect(inspectorService.createSubmission).not.toHaveBeenCalled()
  })

  it('rejects when area_id does not match the assignment', async () => {
    inspectorService.getAssignmentById.mockResolvedValue({ id: 'as-1', agent_id: 'agent-1', area_id: 'other-area' })
    const app = await createApp()
    const res = await request(app).post('/api/inspector/submissions').send(validBody)
    expect(res.status).toBe(400)
    expect(inspectorService.createSubmission).not.toHaveBeenCalled()
  })

  it('forbids non-agent callers', async () => {
    inspectorService.getAssignmentById.mockResolvedValue({ id: 'as-1', agent_id: 'agent-1', area_id: 'area-1' })
    const app = await createApp()
    const res = await request(app)
      .post('/api/inspector/submissions')
      .set('x-test-role', 'buyer')
      .send(validBody)
    expect(res.status).toBe(403)
  })
})

describe('GET /api/inspector/assignments/:id', () => {
  it('returns the assignment with area + dimensions for the owner', async () => {
    inspectorService.getAssignmentById.mockResolvedValue({ id: 'as-1', agent_id: 'agent-1', area_id: 'area-1' })
    areaService.getById.mockResolvedValue({ id: 'area-1', name: 'Downtown' })
    dimensionService.list.mockResolvedValue([{ id: 'd1', slug: 'safety_security', name: 'Safety' }])
    const app = await createApp()
    const res = await request(app).get('/api/inspector/assignments/as-1')
    expect(res.status).toBe(200)
    expect(res.body.assignment.id).toBe('as-1')
    expect(res.body.area.name).toBe('Downtown')
    expect(res.body.dimensions).toHaveLength(1)
  })

  it('returns 404 when the assignment belongs to another inspector', async () => {
    inspectorService.getAssignmentById.mockResolvedValue({ id: 'as-1', agent_id: 'someone-else', area_id: 'area-1' })
    const app = await createApp()
    const res = await request(app).get('/api/inspector/assignments/as-1')
    expect(res.status).toBe(404)
    expect(areaService.getById).not.toHaveBeenCalled()
  })
})
