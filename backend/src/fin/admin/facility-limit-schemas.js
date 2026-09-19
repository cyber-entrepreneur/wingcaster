import { z } from 'zod'

const uuid = z.string().uuid()

export const amendFacilityLimitBodySchema = z.object({
  limit_minor: z.union([
    z.number().int().positive(),
    z.string().regex(/^\d+$/).transform((value) => Number(value)),
  ]),
  reason_code: z.string().min(1).max(64),
  approval_request_id: uuid,
}).strict()
