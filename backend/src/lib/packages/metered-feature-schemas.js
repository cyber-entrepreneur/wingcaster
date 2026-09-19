import { z } from 'zod'

export const meteredFeaturePatchBodySchema = z
  .object({
    display_name: z.string().trim().min(1).max(200).optional(),
    active: z.boolean().optional(),
    data: z.record(z.unknown()).optional(),
    reason: z.string().trim().min(1).max(500),
  })
  .strict()
  .refine(
    (body) => body.display_name !== undefined || body.active !== undefined || body.data !== undefined,
    { message: 'At least one of display_name, active, or data is required' },
  )

export const meteredFeatureListQuerySchema = z
  .object({
    category: z.string().trim().min(1).max(80).optional(),
    active: z.enum(['true', 'false']).optional(),
  })
  .strict()
