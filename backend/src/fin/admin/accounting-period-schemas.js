import { z } from 'zod'

export const accountingPeriodActionBodySchema = z.object({}).strict()

export const accountingPeriodReopenBodySchema = z.object({
  approval_request_id: z.string().uuid().optional(),
  approvalRequestId: z.string().uuid().optional(),
  reconciliation_override_approval_id: z.string().uuid().optional(),
  reconciliationOverrideApprovalId: z.string().uuid().optional(),
  reason_code: z.string().min(1).optional(),
  reasonCode: z.string().min(1).optional(),
}).strict()
