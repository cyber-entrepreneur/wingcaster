import { authMiddleware } from '../../../auth.js'
import {
  deactivateBinding,
  generateActivationCode,
  getBindingStatus,
<<<<<<< HEAD
  getInboundStatus,
=======
  getOrCreateActivationCode,
>>>>>>> origin/main
  listActiveBindingsForUser,
} from './service.js'

function rowDate(value) {
  if (!value) return null
  if (value instanceof Date) return value.toISOString()
  return value
}

function activationCodeResponse(result) {
  return {
    display_code: result.display_code,
    parseable_code: result.parseable_code || result.code,
    shared_number_e164: result.shared_number_e164,
    expires_at: result.expires_at,
  }
}

export function registerBindingRoutes(app, { auth = authMiddleware } = {}) {
  // Idempotent: return active code if present, else mint one.
  async function handleGetActivationCode(req, res) {
    try {
      const result = await getOrCreateActivationCode(req.user.id, { firstName: req.user.name })
      res.json(activationCodeResponse(result))
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  }

  app.get('/api/auth/whatsapp/activation-code', auth, handleGetActivationCode)
  app.get('/api/auth/whatsapp/activation-code/current', auth, handleGetActivationCode)

  // Explicit regenerate: invalidate prior codes, then mint a new one.
  app.post('/api/auth/whatsapp/activation-code', auth, async (req, res) => {
    try {
      const result = await generateActivationCode(req.user.id, { firstName: req.user.name })
      res.json(activationCodeResponse(result))
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

  // BE-BLOCKER-14 / AGT-WLB-003 — ~3s client poll for first inbound content.
  app.get('/api/intake/inbound-status/:bindingId', auth, async (req, res) => {
    try {
      const status = await getInboundStatus({
        bindingId: req.params.bindingId,
        userId: req.user.id,
      })
      if (!status) return res.status(404).json({ error: 'Binding not found' })
      res.json(status)
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
