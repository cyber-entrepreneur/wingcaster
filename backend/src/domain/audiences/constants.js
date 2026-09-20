export const AUDIENCE_TYPES = new Set(['static', 'dynamic'])
export const MEMBER_SOURCES = new Set(['crm', 'followers', 'lookalike', 'uploaded'])
export const MEMBERSHIP_STATES = new Set([
  'matched',
  'contactable',
  'frequency_capped',
  'opted_out',
  'conflicting',
])
export const INCLUSION_VALUES = new Set(['include', 'exclude'])

export const RULE_FIELDS = new Set(['status', 'source', 'tags', 'territory'])
export const RULE_OPERATORS = new Set(['is', 'is_not', 'contains'])
