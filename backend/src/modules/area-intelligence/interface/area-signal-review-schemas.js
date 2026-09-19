import { z } from 'zod'

export const areaSignalVerifyBodySchema = z
  .object({
    notes: z.string().trim().max(500).optional(),
  })
  .strict()

export const areaSignalRejectBodySchema = z
  .object({
    reason: z.string().trim().min(1).max(500),
  })
  .strict()
