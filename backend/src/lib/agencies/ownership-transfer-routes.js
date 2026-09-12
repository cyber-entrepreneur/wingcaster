/**
 * WF-31 / BE-BLOCKER-31 — ownership transfer HTTP routes.
 *
 * GET  /api/agencies/:id/ownership-transfer/state
 * POST /api/agencies/:id/ownership-transfer/otp/send
 * POST /api/agencies/:id/ownership-transfer/initiate
 * POST /api/agencies/:id/ownership-transfer/:transferId/accept
 * POST /api/agencies/:id/ownership-transfer/:transferId/decline
 * POST /api/agencies/:id/ownership-transfer/:transferId/cancel
 * POST /api/agencies/:id/ownership-transfer/:transferId/acknowledge
 * POST /api/agencies/:id/ownership-transfer/:transferId/reverse
 */

import { authMiddleware, requireElevated } from '../../auth.js'
import {
  OwnershipTransferError,
  acknowledgeOwnershipTransfer,
  acceptOwnershipTransfer,
  cancelOwnershipTransfer,
  declineOwnershipTransfer,
  getOwnershipTransferState,
  initiateOwnershipTransfer,
  reverseOwnershipTransfer,
  sendOwnershipTransferOtp,
} from './ownership-transfer.js'

function handleError(res, err) {
  if (err instanceof OwnershipTransferError) {
    const body = { error: err.message, code: err.code }
    if (err.retry_after_seconds != null) body.retry_after_seconds = err.retry_after_seconds
    if (err.block_reason != null) body.block_reason = err.block_reason
    return res.status(err.status).json(body)
  }
  throw err
}

/**
 * @param {import('express').Express} app
 * @param {{ auth?: Function, logActivity?: Function }} [deps]
 */
export function registerOwnershipTransferRoutes(app, {
  auth = authMiddleware,
  logActivity = async () => {},
} = {}) {
  const elevated = requireElevated()

  app.get('/api/agencies/:id/ownership-transfer/state', auth, async (req, res, next) => {
    try {
      const state = await getOwnershipTransferState({
        agencyId: req.params.id,
        callerUserId: req.user.id,
      })
      res.json(state)
    } catch (err) {
      try { handleError(res, err) } catch (e) { next(e) }
    }
  })

  app.post('/api/agencies/:id/ownership-transfer/otp/send', auth, async (req, res, next) => {
    try {
      const result = await sendOwnershipTransferOtp({
        agencyId: req.params.id,
        callerUserId: req.user.id,
        ip: req.ip || null,
      })
      res.json(result)
    } catch (err) {
      try { handleError(res, err) } catch (e) { next(e) }
    }
  })

  app.post('/api/agencies/:id/ownership-transfer/initiate', auth, elevated, async (req, res, next) => {
    try {
      const body = req.body || {}
      const result = await initiateOwnershipTransfer({
        agencyId: req.params.id,
        callerUserId: req.user.id,
        targetUserId: body.target_user_id,
        rationale: body.rationale,
        otpCode: body.otp_code,
        typedAgencyName: body.typed_agency_name,
        logActivity,
      })
      res.status(201).json(result)
    } catch (err) {
      try { handleError(res, err) } catch (e) { next(e) }
    }
  })

  app.post('/api/agencies/:id/ownership-transfer/:transferId/accept', auth, elevated, async (req, res, next) => {
    try {
      const body = req.body || {}
      const result = await acceptOwnershipTransfer({
        agencyId: req.params.id,
        transferId: req.params.transferId,
        callerUserId: req.user.id,
        otpCode: body.otp_code,
        typedAgencyName: body.typed_agency_name,
        logActivity,
      })
      res.status(201).json(result)
    } catch (err) {
      try { handleError(res, err) } catch (e) { next(e) }
    }
  })

  app.post('/api/agencies/:id/ownership-transfer/:transferId/decline', auth, async (req, res, next) => {
    try {
      const body = req.body || {}
      const result = await declineOwnershipTransfer({
        agencyId: req.params.id,
        transferId: req.params.transferId,
        callerUserId: req.user.id,
        declineReason: body.reason || body.decline_reason,
        logActivity,
      })
      res.json(result)
    } catch (err) {
      try { handleError(res, err) } catch (e) { next(e) }
    }
  })

  app.post('/api/agencies/:id/ownership-transfer/:transferId/cancel', auth, async (req, res, next) => {
    try {
      const result = await cancelOwnershipTransfer({
        agencyId: req.params.id,
        transferId: req.params.transferId,
        callerUserId: req.user.id,
        logActivity,
      })
      res.json(result)
    } catch (err) {
      try { handleError(res, err) } catch (e) { next(e) }
    }
  })

  app.post('/api/agencies/:id/ownership-transfer/:transferId/acknowledge', auth, async (req, res, next) => {
    try {
      const result = await acknowledgeOwnershipTransfer({
        agencyId: req.params.id,
        transferId: req.params.transferId,
        callerUserId: req.user.id,
      })
      res.json(result)
    } catch (err) {
      try { handleError(res, err) } catch (e) { next(e) }
    }
  })

  app.post('/api/agencies/:id/ownership-transfer/:transferId/reverse', auth, elevated, async (req, res, next) => {
    try {
      const body = req.body || {}
      const result = await reverseOwnershipTransfer({
        agencyId: req.params.id,
        transferId: req.params.transferId,
        callerUserId: req.user.id,
        otpCode: body.otp_code,
        typedAgencyName: body.typed_agency_name,
        logActivity,
      })
      res.status(201).json(result)
    } catch (err) {
      try { handleError(res, err) } catch (e) { next(e) }
    }
  })
}
