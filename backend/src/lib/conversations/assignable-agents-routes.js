/**
 * AGT-INB-004 — Assign conversation → assignable-agents picker source.
 *
 *   GET /api/conversations/:id/assignable-agents
 *
 * Ownership-gated (assertOwnsConversation, leak-safe 404). Returns the
 * teammates the caller may assign this conversation to; the actual assignment
 * still goes through POST /api/conversations/:id/assign, which re-checks
 * assertAssignableConversationAgent.
 */
import { assertOwnsConversation } from '../authz.js'
import { getAssignableAgents } from './assignable-agents.js'

function isNotFound(err) {
  return err?.status === 404 || err?.name === 'NotFoundError'
}

export function registerRoutes(app, { authMiddleware } = {}) {
  if (!authMiddleware) throw new Error('assignable-agents-routes requires authMiddleware')

  app.get('/api/conversations/:id/assignable-agents', authMiddleware, async (req, res) => {
    let conversation
    try {
      conversation = await assertOwnsConversation(req.user.id, req.params.id)
    } catch (err) {
      if (isNotFound(err)) return res.status(404).json({ error: 'Conversation not found' })
      throw err
    }
    const agents = await getAssignableAgents(req.user.id, conversation)
    res.json({ agents })
  })
}
