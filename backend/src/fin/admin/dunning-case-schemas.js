import { z } from 'zod'

export const dunningCaseActionBodySchema = z.object({
  reason_code: z.string().min(1).optional(),
  reasonCode: z.string().min(1).optional(),
}).strict()
