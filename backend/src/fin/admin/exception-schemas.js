import { z } from 'zod'

export const exceptionNoteSchema = z.object({
  body: z.string().trim().min(1).max(4000),
}).strict()

export const exceptionWontFixSchema = z.object({
  justification: z.string().trim().min(10).max(4000),
}).strict()
