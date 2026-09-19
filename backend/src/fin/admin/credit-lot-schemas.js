import { z } from 'zod'

export const retireLotBodySchema = z.object({
  reason_code: z.string().min(1).max(64).optional(),
  notes: z.string().max(2000).optional(),
}).strict()
