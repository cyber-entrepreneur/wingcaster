export interface VendorProduct {
  id: string
  product_code: string
  product_class: string | null
}

export interface VendorRateVersion {
  id: string
  rate_card_id: string
  rate_card_name: string
  version_n: number
  effective_from: string
  effective_to: string | null
  status: 'DRAFT' | 'ACTIVE' | 'DEPRECATED'
  rates: Record<string, { unit_cost_minor?: number; currency?: string }> | string
}

export interface VendorStatement {
  id: string
  statement_period_key: string
  currency: string
  subtotal_minor: number
  tax_minor: number
  total_minor: number
  status: 'DRAFT' | 'RECEIVED' | 'RECONCILED' | 'FINALIZED'
  unresolved_variance_count: number
}

export interface VendorDetail {
  id: string
  environment: 'LIVE' | 'TEST'
  name: string
  currency: string
  active: boolean
  mtd_units: number
  mtd_cost_micro_usd: number
  active_rate_versions: number
  products: VendorProduct[]
  rateCards: Array<{ id: string; name: string }>
  rate_schedule: VendorRateVersion[]
  mtd_statement: VendorStatement | null
}

export interface VendorRatesResponse {
  rates: VendorRateVersion[]
  next_cursor: string | null
  total_estimate: number
}

export interface VendorStatementsResponse {
  statements: VendorStatement[]
  next_cursor: string | null
  total_estimate: number
}

export interface VendorMarginFeature {
  feature: string
  units: number
  selling_micro_usd: number
  cost_micro_usd: number
  selling_unit_rate_minor: number
  margin_pct: number | null
}

export interface VendorMarginResponse {
  vendor_id: string
  month: string
  features: VendorMarginFeature[]
}
