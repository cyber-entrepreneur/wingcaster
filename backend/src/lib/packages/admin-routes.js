/**
 * Platform-admin package + subscription routes.
 * Consumes authoring / reads / preview / lifecycle. Does not change PR A/B internals.
 */
import { randomUUID } from 'node:crypto'
import { requireElevated } from '../../auth.js'
import { transaction } from '../../db.js'
import { requireIfMatch } from '../../fin/middleware/if-match.js'
import { adminMutationLimiter } from '../admin-limiter.js'
import { PACKAGE_ERROR, PACKAGE_HTTP_STATUS, PackageError } from './errors.js'
import {
  addFlag, addQuota, approvePublish, asUuid, createDraftVersion, createPackageDraft,
  deprecateVersion, publishVersion, rejectPublish, removeFlag, removeQuota,
  submitForApproval, updateDraft, updateMeteredFeature, updatePackage, writeAudit,
  PUBLISH_ACTION_KIND,
} from './authoring.js'
import { PACKAGES_ENVIRONMENT } from './helpers.js'
import { previewCycleGrant } from './preview.js'
import {
  getMeteredFeature, getPackage, getSubscriptionDetail, getVersionDetail,
  listMeteredFeaturesAdmin, listPackages, listPendingApprovals, listSubscriptions,
} from './reads.js'
import {
  cancelAtPeriodEnd, cancelImmediate, changePlan, pauseSubscription, resumeSubscription,
  startSubscription,
} from './lifecycle.js'

function requireExplicitPlatformAdmin(req, res, next) {
  if (req.user?.platform_role !== 'platform_admin') {
    return res.status(403).json({ error: 'Forbidden: platform admin required' })
  }
  next()
}

function actorOf(req) {
  return {
    actorId: asUuid(req.user?.id) || req.user?.id,
    actorEmail: req.user?.email || 'packages@admin',
  }
}

function sendPackageError(res, error) {
  if (error instanceof PackageError) {
    const status = error.code === PACKAGE_ERROR.CANCEL_IMMEDIATE_APPROVAL_REQUIRED
      ? 202
      : (PACKAGE_HTTP_STATUS[error.code] || error.extra?.httpStatus || 400)
    return res.status(status).json({ error: error.message, code: error.code, ...error.extra })
  }
  if (String(error.message || '').includes('PACKAGE_VERSION_IMMUTABLE') || error.code === 'P0001') {
    return res.status(409).json({
      error: error.message,
      code: PACKAGE_ERROR.PACKAGE_VERSION_IMMUTABLE,
    })
  }
  if (String(error.message || '').includes('self-approval')) {
    return res.status(403).json({
      error: 'APPROVAL_SELF_APPROVAL_FORBIDDEN',
      code: PACKAGE_ERROR.APPROVAL_SELF_APPROVAL_FORBIDDEN,
    })
  }
  throw error
}

function wrap(handler) {
  return async (req, res, next) => {
    try {
      await handler(req, res)
    } catch (error) {
      try {
        return sendPackageError(res, error)
      } catch (err) {
        next(err)
      }
    }
  }
}

function run(fn) {
  return transaction((client) => fn(client))
}

export function registerFinPackagesAdminRoutes(app, { authMiddleware, requirePlatformAdmin } = {}) {
  if (!authMiddleware) throw new Error('registerFinPackagesAdminRoutes requires authMiddleware')
  if (!requirePlatformAdmin) throw new Error('registerFinPackagesAdminRoutes requires requirePlatformAdmin')

  const readGuards = [authMiddleware, requirePlatformAdmin]
  const writeGuards = [
    authMiddleware,
    requirePlatformAdmin,
    requireExplicitPlatformAdmin,
    requireElevated(),
    adminMutationLimiter,
    requireIfMatch,
  ]

  app.get('/api/admin/fin/packages/pending-approvals', readGuards, wrap(async (req, res) => {
    const rows = await run((client) => listPendingApprovals(client))
    return res.status(200).json({ approvals: rows })
  }))

  app.get('/api/admin/fin/packages', readGuards, wrap(async (req, res) => {
    const packages = await run((client) => listPackages(client, req.query))
    return res.status(200).json({ packages })
  }))

  app.post('/api/admin/fin/packages', writeGuards, wrap(async (req, res) => {
    const row = await run((client) => createPackageDraft(client, { ...actorOf(req), ...req.body }))
    return res.status(200).json(row)
  }))

  app.get('/api/admin/fin/packages/:id', readGuards, wrap(async (req, res) => {
    const row = await run((client) => getPackage(client, req.params.id))
    return res.status(200).json(row)
  }))

  app.patch('/api/admin/fin/packages/:id', writeGuards, wrap(async (req, res) => {
    const row = await run((client) => updatePackage(client, {
      packageId: req.params.id, ...actorOf(req), ...req.body,
    }))
    return res.status(200).json(row)
  }))

  app.post('/api/admin/fin/packages/:id/versions', writeGuards, wrap(async (req, res) => {
    const row = await run((client) => createDraftVersion(client, {
      packageId: req.params.id, ...actorOf(req), ...req.body,
    }))
    return res.status(200).json(row)
  }))

  app.get('/api/admin/fin/packages/:id/versions/:vid/preview', readGuards, wrap(async (req, res) => {
    const properties = Number(req.query.properties)
    const preview = await run((client) => previewCycleGrant(client, req.params.vid, properties))
    return res.status(200).json(preview)
  }))

  app.get('/api/admin/fin/packages/:id/versions/:vid', readGuards, wrap(async (req, res) => {
    const row = await run((client) => getVersionDetail(client, req.params.id, req.params.vid))
    return res.status(200).json(row)
  }))

  app.patch('/api/admin/fin/packages/:id/versions/:vid', writeGuards, wrap(async (req, res) => {
    const row = await run((client) => updateDraft(client, {
      packageId: req.params.id, versionId: req.params.vid, ...actorOf(req), ...req.body,
    }))
    return res.status(200).json(row)
  }))

  app.post('/api/admin/fin/packages/:id/versions/:vid/quotas', writeGuards, wrap(async (req, res) => {
    const row = await run((client) => addQuota(client, {
      packageId: req.params.id, versionId: req.params.vid, ...actorOf(req), ...req.body,
    }))
    return res.status(200).json(row)
  }))

  app.delete('/api/admin/fin/packages/:id/versions/:vid/quotas/:featureId', writeGuards, wrap(async (req, res) => {
    const row = await run((client) => removeQuota(client, {
      packageId: req.params.id, versionId: req.params.vid, featureId: req.params.featureId, ...actorOf(req),
    }))
    return res.status(200).json(row)
  }))

  app.post('/api/admin/fin/packages/:id/versions/:vid/flags', writeGuards, wrap(async (req, res) => {
    const row = await run((client) => addFlag(client, {
      packageId: req.params.id, versionId: req.params.vid, ...actorOf(req), ...req.body,
    }))
    return res.status(200).json(row)
  }))

  app.delete('/api/admin/fin/packages/:id/versions/:vid/flags/:featureCode', writeGuards, wrap(async (req, res) => {
    const row = await run((client) => removeFlag(client, {
      packageId: req.params.id, versionId: req.params.vid, featureCode: req.params.featureCode, ...actorOf(req),
    }))
    return res.status(200).json(row)
  }))

  app.post('/api/admin/fin/packages/:id/versions/:vid/submit-for-approval', writeGuards, wrap(async (req, res) => {
    const result = await run((client) => submitForApproval(client, {
      packageId: req.params.id, versionId: req.params.vid, ...actorOf(req),
    }))
    return res.status(200).json(result)
  }))

  app.post('/api/admin/fin/packages/:id/versions/:vid/approve', writeGuards, wrap(async (req, res) => {
    const result = await run((client) => approvePublish(client, {
      packageId: req.params.id, versionId: req.params.vid, ...actorOf(req),
    }))
    return res.status(200).json(result)
  }))

  app.post('/api/admin/fin/packages/:id/versions/:vid/reject', writeGuards, wrap(async (req, res) => {
    const result = await run((client) => rejectPublish(client, {
      packageId: req.params.id, versionId: req.params.vid, ...actorOf(req),
      reason: req.body?.reason,
    }))
    return res.status(200).json(result)
  }))

  app.post('/api/admin/fin/packages/:id/versions/:vid/publish', writeGuards, wrap(async (req, res) => {
    const row = await run((client) => publishVersion(client, {
      packageId: req.params.id, versionId: req.params.vid, ...actorOf(req), ...req.body,
    }))
    return res.status(200).json(row)
  }))

  app.post('/api/admin/fin/packages/:id/versions/:vid/deprecate', writeGuards, wrap(async (req, res) => {
    const row = await run((client) => deprecateVersion(client, {
      packageId: req.params.id, versionId: req.params.vid, ...actorOf(req),
      reason: req.body?.reason,
    }))
    return res.status(200).json(row)
  }))

  app.get('/api/admin/fin/metered-features', readGuards, wrap(async (req, res) => {
    const features = await run((client) => listMeteredFeaturesAdmin(client, req.query))
    return res.status(200).json({ features })
  }))

  app.get('/api/admin/fin/metered-features/:id', readGuards, wrap(async (req, res) => {
    const feature = await run((client) => getMeteredFeature(client, req.params.id))
    return res.status(200).json(feature)
  }))

  app.patch('/api/admin/fin/metered-features/:id', writeGuards, wrap(async (req, res) => {
    if (req.body?.credits_per_unit != null || req.body?.cost_per_unit_micro_usd != null) {
      throw new PackageError(
        PACKAGE_ERROR.ECONOMICS_PATCH_FORBIDDEN,
        'credits_per_unit and cost_per_unit_micro_usd cannot be patched inline',
      )
    }
    const row = await run((client) => updateMeteredFeature(client, {
      featureId: req.params.id, ...actorOf(req), ...req.body,
      reason: req.body?.reason,
    }))
    return res.status(200).json(row)
  }))

  app.get('/api/admin/fin/subscriptions', readGuards, wrap(async (req, res) => {
    const subscriptions = await run((client) => listSubscriptions(client, req.query))
    return res.status(200).json({ subscriptions })
  }))

  app.get('/api/admin/fin/subscriptions/:id', readGuards, wrap(async (req, res) => {
    const row = await run((client) => getSubscriptionDetail(client, req.params.id))
    return res.status(200).json(row)
  }))

  app.post('/api/admin/fin/subscriptions', writeGuards, wrap(async (req, res) => {
    const row = await run((client) => startSubscription(client, {
      tenantId: req.body.tenant_id || req.body.tenantId,
      packageVersionId: req.body.package_version_id || req.body.packageVersionId,
      propertiesCommitted: Number(req.body.properties_committed ?? req.body.propertiesCommitted ?? 0),
      billingCycleStart: req.body.billing_cycle_start || req.body.billingCycleStart,
      autoRenew: req.body.auto_renew !== false,
      actorId: asUuid(req.user?.id),
      now: req.body.now,
    }))
    return res.status(200).json(row)
  }))

  app.post('/api/admin/fin/subscriptions/:id/pause', writeGuards, wrap(async (req, res) => {
    const row = await run((client) => pauseSubscription(client, {
      subscriptionId: req.params.id,
      actorId: asUuid(req.user?.id),
      reason: req.body?.reason,
      now: req.body?.now,
    }))
    return res.status(200).json(row)
  }))

  app.post('/api/admin/fin/subscriptions/:id/resume', writeGuards, wrap(async (req, res) => {
    const row = await run((client) => resumeSubscription(client, {
      subscriptionId: req.params.id,
      actorId: asUuid(req.user?.id),
      now: req.body?.now,
    }))
    return res.status(200).json(row)
  }))

  app.post('/api/admin/fin/subscriptions/:id/cancel-at-period-end', writeGuards, wrap(async (req, res) => {
    const row = await run((client) => cancelAtPeriodEnd(client, {
      subscriptionId: req.params.id,
      actorId: asUuid(req.user?.id),
      reason: req.body?.reason,
      now: req.body?.now,
    }))
    return res.status(200).json(row)
  }))

  app.post('/api/admin/fin/subscriptions/:id/cancel-immediate', writeGuards, wrap(async (req, res) => {
    const reason = String(req.body?.reason || '').trim()
    if (!reason) {
      throw new PackageError(PACKAGE_ERROR.REASON_REQUIRED, 'cancel-immediate requires a reason')
    }
    const actor = asUuid(req.user?.id)
    const result = await run(async (client) => {
      const detail = await getSubscriptionDetail(client, req.params.id)
      const wallet = await client.query(
        `SELECT credits_remaining FROM public.credit_wallets WHERE tenant_id = $1`,
        [detail.tenant_id],
      )
      const remaining = Number(wallet.rows[0]?.credits_remaining || 0)
      if (remaining > 0) {
        const existingId = req.body.approval_request_id
        if (!existingId) {
          const approvalId = randomUUID()
          const ts = req.body.now || new Date().toISOString()
          await client.query(
            `INSERT INTO fin.approval_requests (
               id, environment, tenant_id, action_kind, status, subject_type, subject_id,
               payload_hash, min_distinct_approvers, created_at, created_by_actor_type,
               created_by_actor_id, updated_at
             ) VALUES (
               $1, 'LIVE', NULL, $2, 'REQUESTED', 'tenant_subscriptions', $3,
               $4, 1, $5::timestamptz, 'USER', $6, $5::timestamptz
             )`,
            [approvalId, PUBLISH_ACTION_KIND, req.params.id, `cancel-immediate:${req.params.id}:${remaining}`, ts, actor],
          )
          await writeAudit(client, {
            actorId: actor, actorEmail: actorOf(req).actorEmail,
            action: 'SUBSCRIPTION_CANCEL_IMMEDIATE_SUBMITTED',
            targetType: 'tenant_subscriptions', targetId: req.params.id,
            afterState: { approval_request_id: approvalId, credits_remaining: remaining },
            approvalRequestId: approvalId, now: ts,
          })
          return {
            pending_approval: true,
            code: PACKAGE_ERROR.CANCEL_IMMEDIATE_APPROVAL_REQUIRED,
            approval_request_id: approvalId,
            credits_remaining: remaining,
          }
        }
        const locked = await client.query(
          `SELECT * FROM fin.approval_requests WHERE id = $1 FOR UPDATE`,
          [existingId],
        )
        const approval = locked.rows[0]
        if (!approval) throw new PackageError(PACKAGE_ERROR.APPROVAL_NOT_FOUND, 'Approval not found')
        if (approval.created_by_actor_id && String(approval.created_by_actor_id) === String(actor)) {
          throw new PackageError(PACKAGE_ERROR.APPROVAL_SELF_APPROVAL_FORBIDDEN, 'APPROVAL_SELF_APPROVAL_FORBIDDEN')
        }
        if (approval.status === 'REQUESTED') {
          await client.query(
            `INSERT INTO fin.approval_actions (id, request_id, actor_id, decision, created_at)
             VALUES ($1,$2,$3,'APPROVED',NOW())`,
            [randomUUID(), approval.id, actor],
          )
          await client.query(
            `UPDATE fin.approval_requests SET status = 'APPROVED', updated_at = NOW(), updated_by_actor_id = $2 WHERE id = $1`,
            [approval.id, actor],
          )
        } else if (approval.status !== 'APPROVED') {
          throw new PackageError(PACKAGE_ERROR.APPROVAL_ALREADY_RESOLVED, `Approval is ${approval.status}`)
        }
        const ended = await cancelImmediate(client, {
          subscriptionId: req.params.id, actorId: actor, reason, now: req.body.now,
        })
        await client.query(
          `UPDATE fin.approval_requests SET status = 'EXECUTED', updated_at = NOW() WHERE id = $1`,
          [approval.id],
        )
        return ended
      }
      return cancelImmediate(client, {
        subscriptionId: req.params.id, actorId: actor, reason, now: req.body.now,
      })
    })
    if (result?.pending_approval) {
      return res.status(202).json(result)
    }
    return res.status(200).json(result)
  }))

  app.post('/api/admin/fin/subscriptions/:id/change-plan', writeGuards, wrap(async (req, res) => {
    const row = await run((client) => changePlan(client, {
      subscriptionId: req.params.id,
      newPackageVersionId: req.body.package_version_id || req.body.newPackageVersionId,
      prorate: Boolean(req.body.prorate),
      actorId: asUuid(req.user?.id),
      now: req.body.now,
    }))
    return res.status(200).json(row)
  }))
}
