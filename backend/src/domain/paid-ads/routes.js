/**
 * Wave 2A — Paid ads HTTP routes.
 *
 *   GET  /api/paid-ads/channels
 *   POST /api/paid-ads/channels/:platform/connect
 *   GET  /api/paid-ads/executions
 *   POST /api/paid-ads/executions
 *   GET  /api/paid-ads/executions/:id
 *   POST /api/paid-ads/executions/:id/launch
 */

import { z } from 'zod'
import { listUserAgencyMemberships } from '../../tenant-authorization.js'
import { PAID_PLATFORMS, PROVIDER_NOT_APPROVED } from './constants.js'
import {
  connectPaidChannel,
  ensurePaidChannelDefinitions,
  listPaidChannelStatus,
} from './channels.js'
import {
  createPaidAdExecution,
  getPaidAdExecution,
  launchPaidAdExecution,
  listPaidAdExecutions,
} from './service.js'

const connectSchema = z.object({
  credentials_ref: z.string().min(1),
  provider_account_id: z.string().min(1).optional().nullable(),
  integration_model: z.enum(['tenant_oauth', 'enterprise_env']).optional(),
  data: z.record(z.unknown()).optional(),
}).strict()

const targetingSchema = z.object({
  geography: z.record(z.unknown()).optional(),
  demographics: z.record(z.unknown()).optional(),
  audience_ref: z.string().optional().nullable(),
  format: z.string().optional().nullable(),
}).passthrough()

const createExecutionSchema = z.object({
  channel_connection_id: z.string().min(1),
  campaign_id: z.string().optional().nullable(),
  creative_id: z.string().optional().nullable(),
  audience_id: z.string().optional().nullable(),
    objective: z.enum(['awareness', 'traffic', 'engagement', 'leads', 'conversions']),
  budget_micros: z.number().int().positive(),
  currency: z.string().length(3).default('USD'),
  targeting: targetingSchema.optional(),
  schedule: z.record(z.unknown()).optional().nullable(),
  format: z.string().optional().nullable(),
  name: z.string().optional().nullable(),
  subject_type: z.string().optional().nullable(),
  subject_id: z.string().optional().nullable(),
  scheduled_at: z.string().optional().nullable(),
  data: z.record(z.unknown()).optional(),
}).strict()

async function resolveTenant(req) {
  const agentId = req.user?.id || null
  let agencyId = req.agencyId || req.body?.agency_id || req.query?.agency_id || null
  if (!agencyId && agentId) {
    const memberships = await listUserAgencyMemberships(agentId)
    const exclusive = memberships.find((row) => row.affiliation_mode === 'exclusive')
    agencyId = exclusive?.agency_id || memberships[0]?.agency_id || null
  }
  return { agencyId, agentId }
}

function mapError(res, err) {
  const code = err?.code || 'INTERNAL_ERROR'
  if (code === PROVIDER_NOT_APPROVED) {
    return res.status(503).json({
      error: err.message,
      code: PROVIDER_NOT_APPROVED,
      honest_state: 'connect_pending_approval',
    })
  }
  if (code === 'EXECUTION_NOT_FOUND' || code === 'CHANNEL_CONNECTION_NOT_FOUND') {
    return res.status(404).json({ error: err.message, code })
  }
  if (
    code === 'INVALID_PAID_AD_OBJECTIVE'
    || code === 'INVALID_BUDGET'
    || code === 'INVALID_CURRENCY'
    || code === 'INVALID_GMAIL_FORMAT'
    || code === 'INVALID_DEMAND_GEN_FORMAT'
    || code === 'RAW_CREDENTIALS_FORBIDDEN'
    || code === 'MISSING_CREDENTIALS_REF'
    || code === 'UNSUPPORTED_PAID_PLATFORM'
    || code === 'NOT_PAID_CHANNEL'
    || code === 'NOT_PAID_AD_EXECUTION'
    || code === 'MISSING_CHANNEL_CONNECTION'
  ) {
    return res.status(400).json({ error: err.message, code })
  }
  if (code === 'META_ADS_API_ERROR' || code === 'GOOGLE_ADS_API_ERROR') {
    return res.status(502).json({ error: err.message, code, details: err.details || null })
  }
  return res.status(500).json({ error: err.message || 'Internal error', code })
}

export function registerPaidAdsRoutes(app, { authMiddleware, logActivity } = {}) {
  if (!authMiddleware) {
    throw new Error('paid-ads routes require authMiddleware')
  }

  app.get('/api/paid-ads/channels', authMiddleware, async (req, res) => {
    try {
      const tenant = await resolveTenant(req)
      await ensurePaidChannelDefinitions()
      const channels = await listPaidChannelStatus(tenant)
      res.json({ channels })
    } catch (err) {
      mapError(res, err)
    }
  })

  app.post('/api/paid-ads/channels/:platform/connect', authMiddleware, async (req, res) => {
    try {
      const platform = String(req.params.platform || '')
      if (!PAID_PLATFORMS.includes(platform)) {
        return res.status(400).json({ error: `Unsupported platform: ${platform}`, code: 'UNSUPPORTED_PAID_PLATFORM' })
      }
      const body = connectSchema.parse(req.body || {})
      const tenant = await resolveTenant(req)
      const connection = await connectPaidChannel({
        platform,
        agencyId: tenant.agencyId,
        agentId: tenant.agentId,
        credentialsRef: body.credentials_ref,
        providerAccountId: body.provider_account_id || null,
        integrationModel: body.integration_model || 'tenant_oauth',
        data: body.data || {},
      })
      await logActivity?.({
        type: 'paid_channel_connected',
        agent_id: tenant.agentId,
        meta: { platform, connection_id: connection.id },
      })
      const channels = await listPaidChannelStatus(tenant)
      const status = channels.find((c) => c.platform === platform)
      res.status(201).json({
        connection,
        approval: status?.approval,
        honest_state: status?.honest_state || 'connect_pending_approval',
        message: status?.message,
      })
    } catch (err) {
      if (err?.name === 'ZodError') {
        return res.status(400).json({ error: err.message, code: 'VALIDATION_ERROR' })
      }
      mapError(res, err)
    }
  })

  app.get('/api/paid-ads/executions', authMiddleware, async (req, res) => {
    try {
      const tenant = await resolveTenant(req)
      const rows = await listPaidAdExecutions({
        ...tenant,
        status: req.query.status || null,
      })
      res.json(rows)
    } catch (err) {
      mapError(res, err)
    }
  })

  app.post('/api/paid-ads/executions', authMiddleware, async (req, res) => {
    try {
      const body = createExecutionSchema.parse(req.body || {})
      const tenant = await resolveTenant(req)
      const execution = await createPaidAdExecution({
        agencyId: tenant.agencyId,
        agentId: tenant.agentId,
        channelConnectionId: body.channel_connection_id,
        campaignId: body.campaign_id || null,
        creativeId: body.creative_id || null,
        audienceId: body.audience_id || null,
        objective: body.objective,
        budgetMicros: body.budget_micros,
        currency: body.currency,
        targeting: body.targeting || {},
        schedule: body.schedule || null,
        format: body.format || null,
        name: body.name || null,
        subjectType: body.subject_type || null,
        subjectId: body.subject_id || null,
        scheduledAt: body.scheduled_at || null,
        data: body.data || {},
      })
      await logActivity?.({
        type: 'paid_ad_execution_created',
        agent_id: tenant.agentId,
        meta: { execution_id: execution.id, objective: body.objective },
      })
      res.status(201).json(execution)
    } catch (err) {
      if (err?.name === 'ZodError') {
        return res.status(400).json({ error: err.message, code: 'VALIDATION_ERROR' })
      }
      mapError(res, err)
    }
  })

  app.get('/api/paid-ads/executions/:id', authMiddleware, async (req, res) => {
    try {
      const tenant = await resolveTenant(req)
      const execution = await getPaidAdExecution(req.params.id, tenant)
      if (!execution) {
        return res.status(404).json({ error: 'Not found', code: 'EXECUTION_NOT_FOUND' })
      }
      res.json(execution)
    } catch (err) {
      mapError(res, err)
    }
  })

  app.post('/api/paid-ads/executions/:id/launch', authMiddleware, async (req, res) => {
    try {
      const tenant = await resolveTenant(req)
      const result = await launchPaidAdExecution(req.params.id, tenant)
      await logActivity?.({
        type: 'paid_ad_execution_launched',
        agent_id: tenant.agentId,
        meta: { execution_id: req.params.id },
      })
      res.json(result)
    } catch (err) {
      mapError(res, err)
    }
  })
}
