/** Feature code seeded by BE-BLOCKER-27 onto Pro-tier package versions. */
export const PRICE_REPORTS_SUBMIT_FEATURE = 'valuation.price_reports.submit'

/** Backend `comparable_type` allow-list for POST /api/pricing/report-comparable. */
export const COMPARABLE_TYPES = ['internal', 'external', 'agent_report'] as const
export type ComparableType = (typeof COMPARABLE_TYPES)[number]

/**
 * Backend reason allow-list for comparable reports.
 * UI labels follow AGT-APR-004 brief copy; values match the Week 5 API.
 */
export const BAD_COMPARABLE_REASONS = [
  {
    value: 'incorrect_price',
    label: 'Wrong price',
    helper: "The listed price doesn't match reality.",
    glyph: 'DollarSign',
  },
  {
    value: 'wrong_details',
    label: 'Wrong area',
    helper: 'Size, bedrooms, or bathrooms are wrong.',
    glyph: 'Ruler',
  },
  {
    value: 'already_sold',
    label: 'Already sold',
    helper: 'This property is off the market.',
    glyph: 'XCircle',
  },
  {
    value: 'fake_listing',
    label: 'Spam or fake',
    helper: 'Not a real listing.',
    glyph: 'Ban',
  },
  {
    value: 'other',
    label: 'Something else',
    helper: 'Tell PA what you saw.',
    glyph: 'AlertCircle',
  },
] as const

export type BadComparableReason = (typeof BAD_COMPARABLE_REASONS)[number]['value']

export const BAD_COMPARABLE_NOTES_MIN = 20
export const BAD_COMPARABLE_NOTES_MAX = 1000
export const BAD_COMPARABLE_EVIDENCE_MAX = 3
export const PRICE_REPORT_EVIDENCE_MAX = 5
export const EVIDENCE_MAX_BYTES = 10_485_760

export const BAD_COMPARABLE_ACCEPTED_TYPES = [
  'image/jpeg',
  'image/png',
  'image/heic',
  'application/pdf',
  'text/csv',
]

export const PRICE_REPORT_ACCEPTED_TYPES = [
  ...BAD_COMPARABLE_ACCEPTED_TYPES,
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]

export const PRICE_REPORT_CURRENCIES = [
  'AED',
  'USD',
  'SAR',
  'EGP',
  'LBP',
  'JOD',
  'OMR',
  'BHD',
  'KWD',
] as const

export const PRICE_REPORT_NOTES_MIN = 20
export const PRICE_REPORT_NOTES_MAX = 3000
