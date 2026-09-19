import { z } from 'zod'

export const whatsAppCreditGrantBodySchema = z
  .object({
    scope: z.enum(['agent', 'agency']),
    scope_id: z.string().trim().min(1).max(128),
    amount_usd: z.coerce.number().positive().max(100_000),
    reason: z.string().trim().min(1).max(500),
  })
  .strict()
