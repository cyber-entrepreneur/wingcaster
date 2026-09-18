import { z } from 'zod'

const minorUnits = z.union([
  z.number().int().nonnegative(),
  z.string().regex(/^\d+$/).transform((value) => Number(value)),
])

const tierSchema = z.object({
  tier_no: z.number().int().positive().optional(),
  upto_units: minorUnits.nullable().optional(),
  rate_minor: minorUnits,
}).strict()

const dimensionSchema = z.object({
  dimension_kind: z.enum(['TERRITORY', 'CHANNEL', 'SEGMENT', 'WHATSAPP_CATEGORY', 'RESIDENCY_KEY']),
  dimension_value: z.string().min(1).max(128),
  unit_rate_minor: minorUnits,
}).strict()

export const draftPriceVersionBodySchema = z.object({
  model: z.enum([
    'PER_UNIT', 'FLAT', 'PACKAGE', 'GRADUATED_TIER', 'VOLUME_TIER', 'DIMENSIONAL', 'INCLUDED_QUANTITY',
  ]),
  unit_rate_minor: minorUnits.optional(),
  package_size_units: minorUnits.optional(),
  effective_from: z.string().datetime(),
  effective_to: z.string().datetime().optional(),
  reason_code: z.string().min(1).max(64).optional(),
  tiers: z.array(tierSchema).optional(),
  dimensions: z.array(dimensionSchema).optional(),
}).strict()
