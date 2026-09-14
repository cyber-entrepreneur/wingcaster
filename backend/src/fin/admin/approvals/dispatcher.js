/** BE-APR-EXEC-05 — per-workflow executor dispatcher (same-client for atomicity). */

import { CATEGORY, finError } from '../../errors.js'
import { lockAccounts, lockBooks } from '../../ledger/locks.js'
import {
  insertAudit, insertLedgerTx, insertLot, insertOutbox, insertPostingPair,
  loadAccounts, loadBook,
} from '../../ledger/write.js'

const NOT_READY = new Set([
  'WF-04', 'WF-05', 'WF-06', 'WF-09', 'WF-14', 'WF-15', 'WF-20',
])

async function grantCreditsOnClient(client, {
  approval, units, bookId, holderId, actor, now, environment, idempotencyKeyId, sourceKind,
}) {
  const book = await loadBook(client, bookId)
  if (!book) {
    throw finError('BOOK_NOT_FOUND', { category: CATEGORY.PRECONDITION, httpStatus: 404 })
  }
  const accounts = await loadAccounts(client, book.id)
  await lockBooks(client, [book.id])
  await lockAccounts(client, Object.values(accounts))
  const txId = await insertLedgerTx(client, {
    environment, bookId: book.id, shape: 'GRANT',
    economicSourceType: 'APPROVAL_REQUEST', economicSourceId: approval.id,
    actorType: actor.actorType, actorId: actor.actorId, reasonCode: actor.reasonCode,
    idempotencyKeyId: idempotencyKeyId || null, now,
  })
  const lotId = await insertLot(client, {
    environment, tenantId: book.tenant_id, bookId: book.id,
    billingAccountId: book.billing_account_id, holderId,
    sourceKind: sourceKind || 'PROMOTIONAL_GRANT',
    grantedUnits: units, remainingUnits: units, considerationMinor: 0,
    currency: book.currency, now,
  })
  await insertPostingPair(client, {
    environment, transactionId: txId, bookId: book.id, accounts,
    debitType: 'ISSUANCE', creditType: 'AVAILABLE', units, creditLotId: lotId, now,
  })
  await insertAudit(client, {
    environment, actorType: actor.actorType, actorId: actor.actorId,
    actorEmail: actor.actorEmail, action: 'CREDITS_GRANTED', targetType: 'LOT',
    targetId: lotId, afterState: { txId, units }, reasonCode: actor.reasonCode,
    approvalRequestId: approval.id, now,
  })
  await insertOutbox(client, {
    environment, topic: 'fin.ledger.posted', dedupeKey: `tx:${txId}`,
    payload: { txId }, now,
  })
  await insertOutbox(client, {
    environment, topic: 'fin.lot.issued', dedupeKey: `lot:${lotId}`,
    payload: { lotId }, now,
  })
  return { txId, lotId, units }
}

export async function dispatchWorkflowExecute(client, ctx) {
  const { workflowCode, approval, actor, now, environment, idempotencyKeyId } = ctx
  const payload = approval.payload || {}
  const inner = payload.payload || payload

  if (workflowCode === 'WF-08' || approval.action_kind === 'LARGE_GRANT') {
    const units = Number(
      inner.units ?? inner.grant_units ?? inner.grantUnits
      ?? payload.units ?? payload.amount_minor ?? 0,
    )
    const bookId = inner.book_id || inner.bookId || payload.book_id || payload.bookId
    const holderId = inner.holder_id || inner.holderId || payload.holder_id || payload.holderId
    if (!bookId || !holderId || !Number.isFinite(units) || units <= 0) {
      throw finError('EXECUTE_PAYLOAD_INCOMPLETE', {
        category: CATEGORY.VALIDATION,
        httpStatus: 400,
        details: {
          error: 'EXECUTE_PAYLOAD_INCOMPLETE',
          message: 'Credit grant execute requires book_id, holder_id, and units in approval payload.',
        },
      })
    }
    const result = await grantCreditsOnClient(client, {
      approval, units, bookId, holderId, actor, now, environment, idempotencyKeyId,
      sourceKind: inner.source_kind || inner.sourceKind || 'PROMOTIONAL_GRANT',
    })
    return {
      executor: 'grantCredits',
      ledger_journal_id: result.txId,
      lot_id: result.lotId,
      units: result.units,
      short_action_summary: `Granted ${units} credits`,
      outcome_url: outcomeUrlFor(workflowCode, approval, { lotId: result.lotId }),
    }
  }

  if (workflowCode === 'WF-07' || approval.action_kind === 'PACKAGE_PUBLISH') {
    throw finError('EXECUTOR_NOT_READY', {
      category: CATEGORY.PRECONDITION,
      httpStatus: 501,
      details: {
        error: 'EXECUTOR_NOT_READY',
        workflow_code: 'WF-07',
        message: 'Executor for WF-07 is not implemented yet.',
      },
    })
  }

  if (NOT_READY.has(workflowCode)) {
    throw finError('EXECUTOR_NOT_READY', {
      category: CATEGORY.PRECONDITION,
      httpStatus: 501,
      details: {
        error: 'EXECUTOR_NOT_READY',
        workflow_code: workflowCode,
        message: `Executor for ${workflowCode} is not implemented yet.`,
      },
    })
  }

  throw finError('UNKNOWN_WORKFLOW_CODE', {
    category: CATEGORY.VALIDATION,
    httpStatus: 400,
    details: { error: 'UNKNOWN_WORKFLOW_CODE', workflow_code: workflowCode },
  })
}

export function outcomeUrlFor(workflowCode, approval, extra = {}) {
  const tenant = approval.tenant_id || 'unknown'
  if (workflowCode === 'WF-08') {
    return `/admin/credits/tenants/${tenant}?highlight=grant_${String(approval.id).replace(/-/g, '').slice(-6)}`
  }
  if (workflowCode === 'WF-07') {
    const pkg = extra.packageVersionId || approval.subject_id || approval.id
    return `/admin/packages/${pkg}`
  }
  if (workflowCode === 'WF-14') {
    return `/admin/invoices?highlight=${approval.subject_id || approval.id}`
  }
  return `/admin/fin/approvals?highlight=${approval.id}`
}

export function buildDiff(approval, workflowCode) {
  const payload = approval.payload || {}
  const impact = payload.impact_summary || {}
  const inner = payload.payload || payload

  if (workflowCode === 'WF-08' || approval.action_kind === 'LARGE_GRANT') {
    const units = Number(inner.units || payload.units || payload.amount_minor || 0)
    const before = Number(inner.balance_before_minor ?? inner.balance_before ?? 0)
    const currency = inner.currency || payload.currency || 'AED'
    const fmt = (n) => `${currency} ${Number(n).toLocaleString('en-US', {
      minimumFractionDigits: 2, maximumFractionDigits: 2,
    })}`
    return [
      { field: 'Available credit balance', before: fmt(before), after: fmt(before + units), kind: 'money' },
      { field: 'Grant units', before: null, after: String(units), kind: 'number' },
    ]
  }

  if (workflowCode === 'WF-07' || approval.action_kind === 'PACKAGE_PUBLISH') {
    return [
      { field: 'State', before: inner.from_status || 'Draft', after: inner.to_status || 'Published', kind: 'string' },
      ...(inner.package_code ? [{
        field: 'Package', before: inner.package_code, after: inner.package_code, kind: 'string',
      }] : []),
    ]
  }

  if (impact.change) {
    return [{
      field: impact.rate_key || 'Rate',
      before: impact.change?.from?.price ?? null,
      after: impact.change?.to?.price ?? null,
      kind: 'money',
    }]
  }

  return [{ field: 'State', before: approval.status, after: 'EXECUTED', kind: 'string' }]
}

export function actionSummary(approval, workflowCode) {
  const payload = approval.payload || {}
  const inner = payload.payload || payload
  if (payload.impact_summary?.vendor_name && workflowCode === 'WF-09') {
    return `Change rate ${payload.impact_summary.rate_key} for ${payload.impact_summary.vendor_name}`
  }
  if (workflowCode === 'WF-08' || approval.action_kind === 'LARGE_GRANT') {
    const units = inner.units || payload.units || payload.amount_minor || '?'
    const tenant = inner.tenant_name || inner.tenantName || approval.tenant_id || 'tenant'
    return `Grant ${Number(units).toLocaleString('en-US')} credits to ${tenant}`
  }
  if (workflowCode === 'WF-07') {
    return `Publish package: ${inner.package_code || inner.package_version_id || approval.subject_id || 'package'}`
  }
  return `${approval.action_kind} · ${workflowCode}`
}
