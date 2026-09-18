/**
 * AGT-TSK-003 reminder policy route tests.
 */
import express from 'express'
import request from 'supertest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const reminders = vi.hoisted(() => ({
  createReminderPolicy: vi.fn(),
  getReminderPolicies: vi.fn(),
  getReminderPolicyById: vi.fn(),
  updateReminderPolicy: vi.fn(),
  deleteReminderPolicy: vi.fn(),
}))
const db = vi.hoisted(() => ({ findOne: vi.fn() }))
const activity = vi.hoisted(() => ({ logActivity: vi.fn() }))

vi.mock('../../reminders.js', () => reminders)
vi.mock('../../db.js', () => db)

let registerRoutes

async function createApp() {
  const app = express()
  app.use(express.json())
  app.use((req, _res, next) => {
    req.user = { id: 'agent-1' }
    next()
  })
  registerRoutes(app, {
    authMiddleware: (_req, _res, next) => next(),
    logActivity: activity.logActivity,
  })
  return app
}

const samplePolicy = {
  id: 'pol-1',
  name: 'Viewing reminders',
  owner_type: 'agent',
  owner_id: 'agent-1',
  appointment_type: 'viewing',
  rules: [{ offset_minutes: 60, channels: ['inapp'], message_template: 'Hi', active: true }],
  is_default: false,
}

beforeEach(async () => {
  vi.resetModules()
  for (const fn of Object.values(reminders)) fn.mockReset?.()
  db.findOne.mockReset()
  activity.logActivity.mockReset()
  reminders.getReminderPolicies.mockResolvedValue([samplePolicy])
  reminders.getReminderPolicyById.mockResolvedValue(samplePolicy)
  reminders.createReminderPolicy.mockResolvedValue(samplePolicy)
  reminders.updateReminderPolicy.mockResolvedValue({ ...samplePolicy, name: 'Updated' })
  reminders.deleteReminderPolicy.mockResolvedValue(true)
  ;({ registerRoutes } = await import('./reminder-policy-routes.js'))
})

afterEach(() => vi.restoreAllMocks())

describe('GET /api/reminder-policies', () => {
  it('lists agent-scoped policies', async () => {
    const app = await createApp()
    const res = await request(app).get('/api/reminder-policies')
    expect(res.status).toBe(200)
    expect(reminders.getReminderPolicies).toHaveBeenCalledWith({
      ownerType: 'agent',
      ownerId: 'agent-1',
      appointmentType: undefined,
    })
  })
})

describe('POST /api/reminder-policies', () => {
  it('creates a policy with strict validation', async () => {
    const app = await createApp()
    const res = await request(app)
      .post('/api/reminder-policies')
      .send({
        name: 'Viewing reminders',
        appointment_type: 'viewing',
        rules: [{ offset_minutes: 30, channels: ['email'], active: true }],
      })
    expect(res.status).toBe(201)
    expect(reminders.createReminderPolicy).toHaveBeenCalled()
  })

  it('rejects unknown fields', async () => {
    const app = await createApp()
    const res = await request(app)
      .post('/api/reminder-policies')
      .send({ name: 'X', appointment_type: 'viewing', rules: [], extra: true })
    expect(res.status).toBe(400)
  })
})

describe('ownership gating', () => {
  it('returns 404 for another agent policy', async () => {
    reminders.getReminderPolicyById.mockResolvedValue({
      ...samplePolicy,
      owner_id: 'other-agent',
    })
    const app = await createApp()
    const res = await request(app).get('/api/reminder-policies/pol-1')
    expect(res.status).toBe(404)
  })
})
