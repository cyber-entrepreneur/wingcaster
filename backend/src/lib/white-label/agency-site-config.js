import { v4 as uuidv4 } from 'uuid'
import { findOne, insert, update } from '../../db.js'

export const FEATURED_FILTERS = ['all', 'by_area', 'by_property_type', 'by_price_range']
export const FEATURED_SORTS = ['newest', 'most_viewed', 'manual']

export function defaultCopyFields() {
  return {
    header: { tagline: '' },
    about: { paragraph: '', mission: '' },
    featured_listings: {
      filter: 'all',
      area: '',
      property_type: '',
      price_min: null,
      price_max: null,
      sort: 'newest',
    },
    team: { intro: '' },
    contact: { phone: '', email: '', address: '', hours: '' },
    footer: { disclaimer: '' },
  }
}

function normalizeCopyFields(raw) {
  const defaults = defaultCopyFields()
  const source = raw && typeof raw === 'object' ? raw : {}
  return {
    header: { ...defaults.header, ...(source.header || {}) },
    about: { ...defaults.about, ...(source.about || {}) },
    featured_listings: {
      ...defaults.featured_listings,
      ...(source.featured_listings || {}),
      filter: FEATURED_FILTERS.includes(source.featured_listings?.filter)
        ? source.featured_listings.filter
        : defaults.featured_listings.filter,
      sort: FEATURED_SORTS.includes(source.featured_listings?.sort)
        ? source.featured_listings.sort
        : defaults.featured_listings.sort,
    },
    team: { ...defaults.team, ...(source.team || {}) },
    contact: { ...defaults.contact, ...(source.contact || {}) },
    footer: { ...defaults.footer, ...(source.footer || {}) },
  }
}

function serializeRow(row) {
  const copyFields = typeof row.copy_fields === 'string'
    ? JSON.parse(row.copy_fields || '{}')
    : (row.copy_fields || {})

  return {
    id: row.id,
    agency_id: row.agency_id,
    template_id: row.template_id || null,
    logo_url: row.logo_url || null,
    favicon_url: row.favicon_url || null,
    primary_color: row.primary_color || null,
    accent_color: row.accent_color || null,
    font_pair: row.font_pair || null,
    copy_fields: normalizeCopyFields(copyFields),
    custom_domain: row.custom_domain || null,
    ssl_status: row.ssl_status || 'none',
    published_at: row.published_at || null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

export async function getAgencySiteConfig(agencyId) {
  const row = await findOne('agency_site_config', (item) => item.agency_id === agencyId)
  return row ? serializeRow(row) : null
}

export async function ensureAgencySiteConfig(agencyId) {
  const existing = await getAgencySiteConfig(agencyId)
  if (existing) return existing

  const now = new Date().toISOString()
  const row = {
    id: uuidv4(),
    agency_id: agencyId,
    template_id: null,
    logo_url: null,
    favicon_url: null,
    primary_color: null,
    accent_color: null,
    font_pair: null,
    copy_fields: defaultCopyFields(),
    custom_domain: null,
    ssl_status: 'none',
    published_at: null,
    created_at: now,
    updated_at: now,
  }
  await insert('agency_site_config', row)
  return serializeRow(row)
}

export async function updateAgencySiteCopyFields(agencyId, copyFields) {
  const config = await ensureAgencySiteConfig(agencyId)
  const next = normalizeCopyFields({
    ...config.copy_fields,
    ...copyFields,
    header: { ...config.copy_fields.header, ...(copyFields.header || {}) },
    about: { ...config.copy_fields.about, ...(copyFields.about || {}) },
    featured_listings: { ...config.copy_fields.featured_listings, ...(copyFields.featured_listings || {}) },
    team: { ...config.copy_fields.team, ...(copyFields.team || {}) },
    contact: { ...config.copy_fields.contact, ...(copyFields.contact || {}) },
    footer: { ...config.copy_fields.footer, ...(copyFields.footer || {}) },
  })
  await update(
    'agency_site_config',
    (row) => row.agency_id === agencyId,
    (row) => ({ ...row, copy_fields: next, updated_at: new Date().toISOString() }),
  )
  return getAgencySiteConfig(agencyId)
}

export async function publishAgencySiteConfig(agencyId) {
  const config = await ensureAgencySiteConfig(agencyId)
  const now = new Date().toISOString()
  await update(
    'agency_site_config',
    (row) => row.agency_id === agencyId,
    (row) => ({ ...row, published_at: now, updated_at: now }),
  )
  return getAgencySiteConfig(agencyId)
}

export default {
  getAgencySiteConfig,
  ensureAgencySiteConfig,
  updateAgencySiteCopyFields,
  publishAgencySiteConfig,
  defaultCopyFields,
}
