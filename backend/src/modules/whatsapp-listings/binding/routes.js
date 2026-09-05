import { authMiddleware } from '../../../auth.js'
import {
  deactivateBinding,
  generateActivationCode,
  getBindingStatus,
  listActiveBindingsForUser,
} from './service.js'

function rowDate(value) {
  if (!value) return null
  if (value instanceof Date) return value.toISOString()
  return value
}

export function registerBindingRoutes(app, { auth = authMiddleware } = {}) {
  app.post('/api/auth/whatsapp/activation-code', auth, async (req, res) => {
    try {
      const result = await generateActivationCode(req.user.id, { firstName: req.user.name })
      res.json({
        display_code: result.display_code,
        shared_number_e164: result.shared_number_e164,
        expires_at: result.expires_at,
      })
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  app.get('/api/auth/whatsapp/binding-status', auth, async (req, res) => {
    try {
      res.json(await getBindingStatus(req.user.id))
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  app.get('/api/auth/whatsapp/bindings', auth, async (req, res) => {
    try {
      const rows = await listActiveBindingsForUser(req.user.id)
      res.json(rows.map((row) => ({
        id: row.id,
        phone_e164: row.phone_e164,
        active_from: rowDate(row.active_from),
        last_used_at: rowDate(row.last_used_at),
      })))
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  app.delete('/api/auth/whatsapp/bindings/:id', auth, async (req, res) => {
    try {
      const row = await deactivateBinding({ bindingId: req.params.id, userId: req.user.id })
      if (!row) return res.status(404).json({ error: 'Binding not found' })
      res.json({ success: true, id: row.id })
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })
}
