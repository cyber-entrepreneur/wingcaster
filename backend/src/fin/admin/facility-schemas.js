import { z } from 'zod'

const uuid = z.string().uuid()

export const facilityActionSchema = z.object({
  approval_request_id: uuid.optional(),
}).strict()

export const facilityLimitSchema = z.object({
  limit_minor: z.coerce.number().int().positive(),
  approval_request_id: uuid,
}).strict()
