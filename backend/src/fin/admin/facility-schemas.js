import { z } from 'zod'

const uuid = z.string().uuid()
const currency = z.string().length(3).regex(/^[A-Z]{3}$/)

export const createFacilityBodySchema = z.object({
  tenant_id: uuid,
  billing_account_id: uuid,
  currency,
  limit_minor: z.union([
    z.number().int().positive(),
    z.string().regex(/^\d+$/).transform((value) => Number(value)),
  ]),
  net_terms_days: z.union([
    z.literal(7),
    z.literal(14),
    z.literal(30),
    z.number().int().refine((n) => [7, 14, 30].includes(n)),
  ]),
  reason_code: z.string().min(1).max(64),
  valid_from: z.string().datetime().optional(),
  evidence_url: z.string().url().max(2000).optional(),
  notes: z.string().max(2000).optional(),
}).strict()
