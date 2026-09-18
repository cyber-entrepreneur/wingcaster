export interface AiScoringConfig {
  id: string
  name: string
  description: string
  provider: string
  model: string
  temperature: number
  max_tokens: number
  system_prompt: string
  scoring_prompt_template: string
  output_schema: Record<string, unknown> | string
  is_active: boolean
  version: number
  created_at: string
  updated_at: string
}

export type AiScoringConfigInput = Pick<
  AiScoringConfig,
  | 'name'
  | 'description'
  | 'provider'
  | 'model'
  | 'temperature'
  | 'max_tokens'
  | 'system_prompt'
  | 'scoring_prompt_template'
  | 'is_active'
> & {
  output_schema?: Record<string, unknown>
}

export interface AiScoringConfigVersion {
  id: string
  config_id: string
  version: number
  snapshot: AiScoringConfig | string
  created_by: string | null
  created_at: string
}

export interface AiConfigPreviewResult {
  config_id: string
  config_version: number
  area: { id: string; name: string }
  dimension: { id: string; name: string }
  result: {
    score: number | null
    confidence: number
    rationale: string
    summary?: string | null
    summary_ar?: string | null
  }
}

export interface AdminAreaOption {
  id: string
  name: string
  status?: string
}

export interface AdminDimensionOption {
  id: string
  name: string
  slug: string
  is_active: boolean
}
