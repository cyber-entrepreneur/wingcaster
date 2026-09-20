/**
 * Evaluate audience rules against CRM contacts.
 * Vocabulary mirrors campaign-builder-shared.ts AudienceRule.
 */

import { RULE_FIELDS, RULE_OPERATORS } from './constants.js'

function normalizeTags(tags) {
  if (!Array.isArray(tags)) return []
  return tags.map((t) => String(t).toLowerCase())
}

function contactFieldValue(contact, field) {
  switch (field) {
    case 'status':
      return String(contact.status || '').toLowerCase()
    case 'source':
      return String(contact.source || '').toLowerCase()
    case 'tags':
      return normalizeTags(contact.tags)
    case 'territory':
      return String(contact.territory || contact.data?.territory || '').toLowerCase()
    default:
      return ''
  }
}

function evaluateRule(contact, rule) {
  if (!rule?.field || !RULE_FIELDS.has(rule.field)) return true
  if (!rule.operator || !RULE_OPERATORS.has(rule.operator)) return true

  const expected = String(rule.value || '').toLowerCase()
  const actual = contactFieldValue(contact, rule.field)

  if (rule.field === 'tags') {
    const tagSet = new Set(actual)
    if (rule.operator === 'is') return tagSet.has(expected)
    if (rule.operator === 'is_not') return !tagSet.has(expected)
    if (rule.operator === 'contains') {
      return actual.some((tag) => tag.includes(expected))
    }
    return false
  }

  if (rule.operator === 'is') return actual === expected
  if (rule.operator === 'is_not') return actual !== expected
  if (rule.operator === 'contains') return actual.includes(expected)
  return false
}

export function parseAudienceRules(rules = {}) {
  if (Array.isArray(rules)) {
    return { audience_rules: rules, tags_filter: [] }
  }
  return {
    audience_rules: Array.isArray(rules.audience_rules) ? rules.audience_rules : [],
    tags_filter: Array.isArray(rules.tags_filter) ? rules.tags_filter : [],
    static_contact_ids: Array.isArray(rules.static_contact_ids) ? rules.static_contact_ids : [],
  }
}

export function contactMatchesAudienceRules(contact, rulesInput = {}) {
  const { audience_rules, tags_filter } = parseAudienceRules(rulesInput)

  if (tags_filter.length > 0) {
    const contactTags = new Set(normalizeTags(contact.tags))
    const hasTag = tags_filter.some((t) => contactTags.has(String(t).toLowerCase()))
    if (!hasTag) return false
  }

  if (audience_rules.length === 0) {
    return tags_filter.length > 0 || Object.keys(rulesInput || {}).length === 0
  }

  return audience_rules.every((rule) => evaluateRule(contact, rule))
}

export function filterContactsByRules(contacts, rulesInput = {}) {
  return contacts.filter((contact) => contactMatchesAudienceRules(contact, rulesInput))
}
