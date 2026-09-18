/**
 * AGT-REV-001 — authenticated review management for an agent's own profile.
 */
import { z } from 'zod'
import { findAll, findOne, update } from '../../db.js'

const responseSchema = z.object({
  body: z.string().trim().min(1).max(2000),
}).strict()

const flagSchema = z.object({
  reason: z.enum(['spam', 'abusive', 'privacy', 'conflict', 'false_claim', 'other']),
  details: z.string().trim().max(1000).nullable().optional(),
}).strict()

function cleanText(value) {
  return String(value).replace(/<[^>]*>/g, '').trim()
}

async function ownAgent(userId) {
  return await findOne('agents', (row) => row.id === userId || row.user_id === userId)
}

async function ownReview(reviewId, userId) {
  const agent = await ownAgent(userId)
  if (!agent) return null
  const review = await findOne(
    'reviews',
    (row) => row.id === reviewId && row.agent_id === agent.id,
  )
  return review ? { agent, review } : null
}

async function serialize(review) {
  const author = review.author_id
    ? await findOne('users', (row) => row.id === review.author_id)
    : null
  return {
    id: review.id,
    rating: Number(review.rating) || 0,
    title: review.title || null,
    comment: review.comment || '',
    reviewer: {
      name: review.reviewer_name || author?.name || 'WingCaster client',
    },
    verified_transaction: Boolean(review.verified_transaction),
    status: review.status,
    response: review.agent_response || null,
    responded_at: review.responded_at || null,
    flag: {
      status: review.flag_status || 'none',
      reason: review.flag_reason || null,
      details: review.flag_details || null,
      flagged_at: review.flagged_at || null,
    },
    created_at: review.created_at,
    updated_at: review.updated_at,
  }
}

export async function serializePublicReview(review) {
  const author = review.author_id
    ? await findOne('users', (row) => row.id === review.author_id)
    : null
  return {
    id: review.id,
    rating: Number(review.rating) || 0,
    comment: review.comment || '',
    reviewer_name: review.reviewer_name || author?.name || 'WingCaster client',
    verified_transaction: Boolean(review.verified_transaction),
    agent_response: review.agent_response || null,
    created_at: review.created_at,
  }
}

function summary(rows) {
  const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
  let totalRating = 0
  for (const row of rows) {
    const rating = Math.max(1, Math.min(5, Math.round(Number(row.rating) || 0)))
    distribution[rating] += 1
    totalRating += Number(row.rating) || 0
  }
  return {
    total: rows.length,
    average: rows.length ? Math.round((totalRating / rows.length) * 10) / 10 : 0,
    distribution,
    awaiting_response: rows.filter((row) => !row.agent_response).length,
    flagged: rows.filter((row) => row.flag_status === 'pending').length,
  }
}

function notFound(res) {
  return res.status(404).json({ error: 'Review not found' })
}

export function registerRoutes(app, { authMiddleware }) {
  if (!authMiddleware) throw new Error('registerRoutes requires authMiddleware')

  app.get('/api/agent/reviews', authMiddleware, async (req, res, next) => {
    try {
      const agent = await ownAgent(req.user.id)
      if (!agent) return res.status(404).json({ error: 'Agent profile not found' })
      const rows = await findAll(
        'reviews',
        (row) => row.agent_id === agent.id && !['draft', 'removed'].includes(row.status),
      )
      rows.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
      return res.json({
        summary: summary(rows),
        reviews: await Promise.all(rows.map(serialize)),
      })
    } catch (error) {
      return next(error)
    }
  })

  app.patch('/api/agent/reviews/:id/response', authMiddleware, async (req, res, next) => {
    try {
      const parsed = responseSchema.safeParse(req.body)
      if (!parsed.success) {
        return res.status(400).json({ error: 'Invalid response', details: parsed.error.flatten() })
      }
      const context = await ownReview(req.params.id, req.user.id)
      if (!context) return notFound(res)

      const body = cleanText(parsed.data.body)
      if (!body) return res.status(400).json({ error: 'Response must contain text' })
      const now = new Date().toISOString()
      const nextReview = {
        ...context.review,
        agent_response: body,
        responded_at: now,
        updated_at: now,
      }
      await update('reviews', (row) => row.id === context.review.id, () => nextReview)
      return res.json(await serialize(nextReview))
    } catch (error) {
      return next(error)
    }
  })

  app.post('/api/agent/reviews/:id/flag', authMiddleware, async (req, res, next) => {
    try {
      const parsed = flagSchema.safeParse(req.body)
      if (!parsed.success) {
        return res.status(400).json({ error: 'Invalid flag request', details: parsed.error.flatten() })
      }
      const context = await ownReview(req.params.id, req.user.id)
      if (!context) return notFound(res)

      const now = new Date().toISOString()
      const nextReview = {
        ...context.review,
        flag_status: 'pending',
        flag_reason: parsed.data.reason,
        flag_details: parsed.data.details ? cleanText(parsed.data.details) : null,
        flagged_at: now,
        flagged_by: req.user.id,
        updated_at: now,
      }
      await update('reviews', (row) => row.id === context.review.id, () => nextReview)
      return res.json(await serialize(nextReview))
    } catch (error) {
      return next(error)
    }
  })
}
