import { z } from 'zod'

const componentSchema = z.object({
  component_type: z.enum([
    'SUBSCRIPTION',
    'PREPAID_COMMITMENT',
    'INCLUDED_ALLOWANCE',
    'METER_PRICE',
    'OVERAGE_PRICE',
    'MINIMUM_SPEND',
    'PROMOTIONAL_GRANT',
    'ENTITLEMENT',
    'CREDIT_FACILITY',
    'ROLLOVER',
    'USAGE_LIMIT',
    'BILLING_RULE',
  ]),
  price_id: z.string().uuid().optional().nullable(),
  meter_id: z.string().uuid().optional().nullable(),
  facility_id: z.string().uuid().optional().nullable(),
  config: z.record(z.unknown()).optional(),
}).strict()

export const draftContractVersionBodySchema = z.object({
  effective_from: z.string().min(1),
  effective_to: z.string().optional().nullable(),
  amendment_reason: z.string().max(2000).optional().nullable(),
  components: z.array(componentSchema).default([]),
}).strict()
