import { z } from 'zod'

export const scoringOverrideBodySchema = z.object({
  area_id: z.string().uuid(),
  dimension_id: z.string().uuid(),
  score: z.union([
    z.number().min(0).max(100),
    z.string().regex(/^\d+(\.\d+)?$/).transform((value) => Number(value)),
  ]),
  rationale: z.string().trim().min(1).max(2000).optional(),
  reason: z.string().trim().min(1).max(500),
  evidence: z.record(z.unknown()).optional(),
}).strict()
