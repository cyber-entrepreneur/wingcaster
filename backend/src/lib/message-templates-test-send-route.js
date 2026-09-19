import { getTemplateById, renderTemplate } from '../message-templates.js'
import { sendEmail } from './notifications/email.js'
import { messageTemplateTestSendSchema } from './validation.js'

/**
 * AGT-TPL-002 — agent-scoped template test send (email only, self-address only).
 */
export function registerMessageTemplateTestSendRoute(app, { authMiddleware, validate, logActivity } = {}) {
  if (!authMiddleware) throw new Error('registerMessageTemplateTestSendRoute requires authMiddleware')
  if (!validate) throw new Error('registerMessageTemplateTestSendRoute requires validate')
  const activity = logActivity || (async () => {})

  app.post('/api/message-templates/:id/test-send', authMiddleware, validate(messageTemplateTestSendSchema), async (req, res) => {
    try {
      const template = await getTemplateById(req.params.id)
      if (!template) return res.status(404).json({ error: 'Template not found', code: 'TEMPLATE_NOT_FOUND' })

      const callerEmail = String(req.user.email || '').toLowerCase().trim()
      const requestedTo = String(req.validated.to).toLowerCase().trim()
      if (!callerEmail || callerEmail !== requestedTo) {
        return res.status(403).json({
          error: 'Test sends may only be delivered to the caller\'s own email address',
          code: 'TEST_SEND_SELF_ONLY',
        })
      }

      if (template.channel !== 'email') {
        return res.status(400).json({
          error: `Test-send is only implemented for email templates (channel=${template.channel})`,
          code: 'TEST_SEND_UNSUPPORTED_CHANNEL',
        })
      }

      const rendered = renderTemplate(template, req.validated.variables || {})
      const result = await sendEmail({
        to: callerEmail,
        subject: `[TEST] ${rendered.subject}`,
        body: rendered.body,
      })

      await activity({
        type: 'message_template_test_sent',
        agent_id: req.user.id,
        meta: { template_id: template.id, provider: result.provider, provider_message_id: result.provider_message_id },
      })

      res.json({ sent: true, provider: result.provider, provider_message_id: result.provider_message_id })
    } catch (err) {
      const status = err.status || 500
      res.status(status).json({ error: err.message || 'Test send failed', code: err.code })
    }
  })
}
