import { z } from 'zod'

export const reconcileVendorStatementBodySchema = z.object({
  evidence: z.record(z.unknown()).optional(),
  signed_evidence: z.record(z.unknown()).optional(),
  signedEvidence: z.record(z.unknown()).optional(),
  reason_code: z.string().min(1).max(64).optional(),
}).strict()
