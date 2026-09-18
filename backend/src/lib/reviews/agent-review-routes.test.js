import express from 'express'
import request from 'supertest'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const store = vi.hoisted(() => ({
  agents: [],
  reviews: [],
  users: [],
}))

vi.mock('../../db.js', () => ({
  findAll: vi.fn(async (collection, predicate) => store[collection].filter(predicate)),
  findOne: vi.fn(async (collection, predicate) => store[collection].find(predicate) ?? null),
  update: vi.fn(async (collection, predicate, updater) => {
    store[collection] = store[collection].map((row) => (predicate(row) ? updater(row) : row))
    return true
  }),
}))

import { registerRoutes, serializePublicReview } from './agent-review-routes.js'

function authMiddleware(req, res, next) {
  const userId = req.get('x-user-id')
  if (!userId) return res.status(401).json({ error: 'Unauthorized' })
  req.user = { id: userId }
  return next()
}

function app() {
  const instance = express()
  instance.use(express.json())
  registerRoutes(instance, { authMiddleware })
  instance.use((error, _req, res, _next) => res.status(500).json({ error: error.message }))
  return instance
}

function seed() {
  store.agents = [
    { id: 'agent-1', user_id: 'user-agent', name: 'Maya Agent' },
    { id: 'agent-2', user_id: 'other-agent', name: 'Other Agent' },
  ]
  store.users = [
    { id: 'client-1', name: 'Samira Client' },
    { id: 'client-2', name: 'Omar Client' },
  ]
  store.reviews = [
    {
      id: 'review-1',
      agent_id: 'agent-1',
      author_id: 'client-1',
      rating: 5,
      comment: 'Clear communication throughout.',
      status: 'published',
      verified_transaction: true,
      agent_response: null,
      flag_status: 'none',
      created_at: '2026-09-18T12:00:00.000Z',
      updated_at: '2026-09-18T12:00:00.000Z',
    },
    {
      id: 'review-2',
      agent_id: 'agent-1',
      author_id: 'client-2',
      rating: 3,
      comment: 'The follow-up was slower than expected.',
      status: 'published',
      agent_response: 'Thank you for the feedback.',
      responded_at: '2026-09-18T13:00:00.000Z',
      flag_status: 'pending',
      flag_reason: 'false_claim',
      created_at: '2026-09-17T12:00:00.000Z',
      updated_at: '2026-09-18T13:00:00.000Z',
    },
    {
      id: 'review-other',
      agent_id: 'agent-2',
      author_id: 'client-1',
      rating: 1,
      comment: 'Not mine.',
      status: 'published',
      flag_status: 'none',
      created_at: '2026-09-16T12:00:00.000Z',
    },
  ]
}

describe('agent review management routes', () => {
  beforeEach(seed)

  it('lists only the signed-in agent reviews with summary metrics', async () => {
    const response = await request(app())
      .get('/api/agent/reviews')
      .set('x-user-id', 'user-agent')

    expect(response.status).toBe(200)
    expect(response.body.summary).toEqual({
      total: 2,
      average: 4,
      distribution: { 1: 0, 2: 0, 3: 1, 4: 0, 5: 1 },
      awaiting_response: 1,
      flagged: 1,
    })
    expect(response.body.reviews.map((review) => review.reviewer.name)).toEqual([
      'Samira Client',
      'Omar Client',
    ])
    expect(response.body.reviews).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ id: 'review-other' })]),
    )
  })

  it('strictly validates response input', async () => {
    const response = await request(app())
      .patch('/api/agent/reviews/review-1/response')
      .set('x-user-id', 'user-agent')
      .send({ body: 'Thanks', unexpected: true })

    expect(response.status).toBe(400)
    expect(store.reviews[0].agent_response).toBeNull()
  })

  it('adds a sanitized response', async () => {
    const response = await request(app())
      .patch('/api/agent/reviews/review-1/response')
      .set('x-user-id', 'user-agent')
      .send({ body: '<b>Thank you</b> for trusting me.' })

    expect(response.status).toBe(200)
    expect(response.body.response).toBe('Thank you for trusting me.')
    expect(store.reviews[0].responded_at).toBeTruthy()
  })

  it('returns a leak-safe 404 when responding to another agent review', async () => {
    const response = await request(app())
      .patch('/api/agent/reviews/review-other/response')
      .set('x-user-id', 'user-agent')
      .send({ body: 'This must not be accepted.' })

    expect(response.status).toBe(404)
    expect(response.body).toEqual({ error: 'Review not found' })
  })

  it('submits a moderation flag without hiding the public review', async () => {
    const response = await request(app())
      .post('/api/agent/reviews/review-1/flag')
      .set('x-user-id', 'user-agent')
      .send({ reason: 'privacy', details: '<i>Contains a private address.</i>' })

    expect(response.status).toBe(200)
    expect(response.body.flag).toMatchObject({
      status: 'pending',
      reason: 'privacy',
      details: 'Contains a private address.',
    })
    expect(store.reviews[0].status).toBe('published')
    expect(store.reviews[0].flagged_by).toBe('user-agent')
  })

  it('strictly validates the moderation reason', async () => {
    const response = await request(app())
      .post('/api/agent/reviews/review-1/flag')
      .set('x-user-id', 'user-agent')
      .send({ reason: 'dislike' })

    expect(response.status).toBe(400)
    expect(store.reviews[0].flag_status).toBe('none')
  })

  it('keeps moderation metadata out of the public review shape', async () => {
    const publicReview = await serializePublicReview(store.reviews[1])

    expect(publicReview).toMatchObject({
      id: 'review-2',
      reviewer_name: 'Omar Client',
      agent_response: 'Thank you for the feedback.',
    })
    expect(publicReview).not.toHaveProperty('flag_reason')
    expect(publicReview).not.toHaveProperty('flag_details')
    expect(publicReview).not.toHaveProperty('flagged_by')
  })
})
