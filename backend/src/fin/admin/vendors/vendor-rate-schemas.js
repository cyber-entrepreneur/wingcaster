import { z } from 'zod'

const minorUnits = z.union([
  z.number().int().nonnegative(),
  z.string().regex(/^\d+$/).transform((value) => Number(value)),
])

const currency = z.string().length(3).regex(/^[A-Z]{3}$/)

export const applyVendorRateBodySchema = z.object({
  rate_key: z.string().min(1).max(128).optional(),
  product_code: z.string().min(1).max(128).optional(),
  unit_cost_minor: minorUnits,
  currency: currency.optional(),
  effective_from: z.string().datetime().optional(),
  effective_to: z.string().datetime().optional(),
  product_class: z.string().min(1).max(64).optional(),
  reason_code: z.string().min(1).max(64).optional(),
}).strict().superRefine((data, ctx) => {
  if (!data.rate_key && !data.product_code) {
    ctx.addIssue({
      code: 'custom',
      message: 'rate_key or product_code required',
      path: ['product_code'],
    })
  }
})
