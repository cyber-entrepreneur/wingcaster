import { z } from 'zod'

export const deprecatePackageVersionBodySchema = z.object({
  reason: z.string().min(1).max(2000),
  grace_period_note: z.string().max(500).optional(),
}).strict()
