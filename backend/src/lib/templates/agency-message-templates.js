import {
  createTemplate,
  deleteTemplate,
  getTemplateById,
  getTemplates,
  renderTemplate,
  updateTemplate,
} from '../../message-templates.js'

function serializeTemplate(row) {
  const variables = Array.isArray(row.variables)
    ? row.variables
    : (typeof row.variables === 'string' ? JSON.parse(row.variables || '[]') : [])

  return {
    id: row.id,
    agency_id: row.owner_id,
    name: row.name,
    channel: row.channel,
    category: row.category,
    subject: row.subject,
    body: row.body,
    variables,
    language: row.language || 'en',
    approval_status: row.approval_status || 'draft',
    usage_count: Number(row.usage_count) || 0,
    agents_using_count: Number(row.usage_count) || 0,
    is_default: row.is_default === true,
    created_by: row.created_by || null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

export async function listAgencyMessageTemplates(agencyId, filters = {}) {
  const rows = await getTemplates({
    ownerType: 'agency',
    ownerId: agencyId,
    channel: filters.channel,
    category: filters.category,
  })

  let templates = rows.map(serializeTemplate)
  if (filters.status) {
    templates = templates.filter((row) => row.approval_status === filters.status)
  }
  return templates
}

export async function getAgencyMessageTemplate(agencyId, templateId) {
  const row = await getTemplateById(templateId)
  if (!row || row.owner_type !== 'agency' || row.owner_id !== agencyId) return null
  return serializeTemplate(row)
}

export async function createAgencyMessageTemplate(agencyId, userId, payload) {
  const row = await createTemplate({
    name: payload.name,
    channel: payload.channel,
    category: payload.category,
    subject: payload.subject,
    body: payload.body,
    language: payload.language,
    approvalStatus: payload.approval_status || 'draft',
    ownerType: 'agency',
    ownerId: agencyId,
    createdBy: userId,
  })
  return serializeTemplate(row)
}

export async function updateAgencyMessageTemplate(agencyId, templateId, payload) {
  const existing = await getAgencyMessageTemplate(agencyId, templateId)
  if (!existing) return null
  const row = await updateTemplate(templateId, payload)
  return row ? serializeTemplate(row) : null
}

export async function deleteAgencyMessageTemplate(agencyId, templateId) {
  const existing = await getAgencyMessageTemplate(agencyId, templateId)
  if (!existing) return false
  await deleteTemplate(templateId)
  return true
}

export async function publishAgencyMessageTemplate(agencyId, templateId) {
  const existing = await getAgencyMessageTemplate(agencyId, templateId)
  if (!existing) return null
  const row = await updateTemplate(templateId, { approval_status: 'approved' })
  return row ? serializeTemplate(row) : null
}

export async function renderAgencyMessageTemplate(agencyId, templateId, variables = {}) {
  const row = await getTemplateById(templateId)
  if (!row || row.owner_type !== 'agency' || row.owner_id !== agencyId) return null
  return renderTemplate(row, variables)
}

export default {
  listAgencyMessageTemplates,
  getAgencyMessageTemplate,
  createAgencyMessageTemplate,
  updateAgencyMessageTemplate,
  deleteAgencyMessageTemplate,
  publishAgencyMessageTemplate,
  renderAgencyMessageTemplate,
}
