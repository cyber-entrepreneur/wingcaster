/**
 * AGT-CTC-004 — Merge contacts.
 *
 *   POST /api/contacts/:id/merge   combine duplicate contacts (irreversible)
 */
import { z } from 'zod'
import { mergeContacts } from '../../conversations/orchestrator.js'
import { assertOwnsContact } from '../authz.js'
const fieldPick = z.enum(['source', 'target'])

const mergeSchema = z
  .object({
    target_contact_id: z.string().min(1).max(128),
    field_selections: z
      .object({
        name: fieldPick.optional(),
        email: fieldPick.optional(),
        phone: fieldPick.optional(),
        status: fieldPick.optional(),
        source: fieldPick.optional(),
      })
      .strict()
      .optional(),
  })
  .strict()

function isNotFound(err) {
  return err?.status === 404 || err?.name === 'NotFoundError'
}

export function registerRoutes(app, { authMiddleware, logActivity }) {
  app.post('/api/contacts/:id/merge', authMiddleware, async (req, res) => {
    try {
      const parsed = mergeSchema.safeParse(req.body ?? {})
      if (!parsed.success) {
        return res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() })
      }
      if (parsed.data.target_contact_id === req.params.id) {
        return res.status(400).json({ error: 'Cannot merge a contact into itself', code: 'SAME_CONTACT' })
      }
      const source = await assertOwnsContact(req.user.id, req.params.id)
      const target = await assertOwnsContact(req.user.id, parsed.data.target_contact_id)
      const merged = await mergeContacts(source.id, target.id, parsed.data.field_selections || {})
      if (logActivity) {
        await logActivity({
          type: 'contacts_merged',
          agent_id: req.user.id,
          meta: {
            source_id: source.id,
            target_id: target.id,
            merged_contact_id: merged.id,
            field_selections: parsed.data.field_selections || {},
          },
        })
      }
      res.json(merged)
    } catch (err) {
      if (isNotFound(err)) return res.status(404).json({ error: 'Contact not found' })
      if (err?.message) return res.status(400).json({ error: err.message })
      return res.status(500).json({ error: 'Merge failed' })
    }
  })
}
