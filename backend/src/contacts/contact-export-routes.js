/**
 * AGT-CTC-005 — Contact export (bulk).
 *
 *   GET /api/contacts/export?format=csv|vcard&fields=name,email,...
 *
 * Streams the caller's own contacts (assigned_agent_id === req.user.id) as a
 * downloadable CSV or vCard file. Owner-scoped by the query itself, so there is
 * nothing to leak — a caller can only ever export their own book of business.
 */
import { findAll } from '../db.js'
import { buildContactExport } from './contact-export.js'

const VALID_FORMATS = new Set(['csv', 'vcard'])

export function registerRoutes(app, { authMiddleware }) {
  app.get('/api/contacts/export', authMiddleware, async (req, res) => {
    const format = String(req.query.format || 'csv').toLowerCase()
    if (!VALID_FORMATS.has(format)) {
      return res.status(400).json({ error: 'Unsupported format', code: 'INVALID_FORMAT' })
    }

    const contacts = await findAll('contacts', (c) => c.assigned_agent_id === req.user.id)
    contacts.sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')))

    const built = buildContactExport({ contacts, format, fields: req.query.fields })

    res.setHeader('Content-Type', built.contentType)
    res.setHeader('Content-Disposition', `attachment; filename="${built.filename}"`)
    res.setHeader('X-Contact-Export-Rows', String(built.rows))
    res.setHeader('X-Contact-Export-At', new Date().toISOString())
    return res.status(200).send(built.body)
  })
}
