import { z } from 'zod'

export const invoiceDebitNoteBodySchema = z
  .object({
    amount_minor: z.coerce.number().int().positive().max(Number.MAX_SAFE_INTEGER),
    reason_code: z.string().trim().min(1).max(64).optional(),
  })
  .strict()
