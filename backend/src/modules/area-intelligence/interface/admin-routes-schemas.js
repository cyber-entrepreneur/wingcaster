import { z } from 'zod'

const geoJsonSchema = z.union([
  z.string().max(500_000),
  z.record(z.unknown()),
  z.null(),
])

export const updateAreaBodySchema = z
  .object({
    name: z.string().min(1).max(200).optional(),
    name_ar: z.string().max(200).optional(),
    slug: z.string().min(1).max(120).regex(/^[a-z0-9-]+$/).optional(),
    level: z.enum(['city', 'village', 'neighborhood', 'territory']).optional(),
    parent_id: z.string().uuid().nullable().optional(),
    center_latitude: z.coerce.number().min(-90).max(90).optional(),
    center_longitude: z.coerce.number().min(-180).max(180).optional(),
    boundary_geojson: geoJsonSchema.optional(),
    proximity_radii_json: z.union([z.string(), z.record(z.unknown())]).optional(),
    summary: z.string().max(10_000).optional(),
    summary_ar: z.string().max(10_000).optional(),
    lifestyle_profile: z.string().max(10_000).optional(),
    investment_outlook: z.string().max(10_000).optional(),
    activity_score: z.coerce.number().min(0).max(100).nullable().optional(),
    activity_trend: z.enum(['rising', 'stable', 'falling']).nullable().optional(),
    family_profile_skew: z.enum(['families', 'singles', 'mixed']).nullable().optional(),
    estimated_population_density: z.enum(['low', 'medium', 'high']).nullable().optional(),
    status: z.enum(['draft', 'under_review', 'scoring_enabled', 'archived']).optional(),
  })
  .strict()

export const createAreaSourceBodySchema = z
  .object({
    source_type_id: z.string().uuid(),
    name: z.string().max(200).optional().nullable(),
    handle: z.string().max(200).optional().nullable(),
    url: z.string().url().max(2000).optional().nullable(),
    api_endpoint: z.string().url().max(2000).optional().nullable(),
    feed_url: z.string().url().max(2000).optional().nullable(),
    reliability_override: z.coerce.number().min(0).max(1).nullable().optional(),
    decay_days_override: z.coerce.number().int().min(1).max(3650).nullable().optional(),
    is_monitored: z.boolean().optional(),
    auth_config: z.record(z.unknown()).optional().nullable(),
  })
  .strict()

export const updateAreaSourceBodySchema = createAreaSourceBodySchema.partial().strict()
