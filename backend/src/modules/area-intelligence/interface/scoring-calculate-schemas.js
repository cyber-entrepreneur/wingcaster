import { z } from 'zod'

export const scoringCalculateBodySchema = z.object({
  scope: z.enum(['all_areas', 'one_area', 'one_dimension']).optional(),
  area_id: z.string().uuid().optional(),
  dimension_id: z.string().uuid().optional(),
}).strict().superRefine((data, ctx) => {
  const scope = data.scope || (data.area_id ? 'one_area' : undefined)
  if (!scope && !data.area_id) {
    ctx.addIssue({
      code: 'custom',
      message: 'scope or area_id required',
      path: ['scope'],
    })
    return
  }
  if (scope === 'one_area' && !data.area_id) {
    ctx.addIssue({
      code: 'custom',
      message: 'area_id required for one_area scope',
      path: ['area_id'],
    })
  }
  if (scope === 'one_dimension' && (!data.area_id || !data.dimension_id)) {
    ctx.addIssue({
      code: 'custom',
      message: 'area_id and dimension_id required for one_dimension scope',
      path: ['dimension_id'],
    })
  }
})
