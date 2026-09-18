/**
 * AGT-LST-013 — two-party property disposition case.
 *
 * Both the departing agent and an owner/admin of the custody agency may read
 * the case and record an independent recommendation. Matching recommendations
 * become resolvable; disagreement remains visible as a disputed case.
 */
import { z } from 'zod'
import { findAll, findOne, update } from '../../db.js'

const dispositionSchema = z.enum(['agency_retains', 'agent_retains', 'archive'])
const decisionSchema = z.object({
  disposition: dispositionSchema,
  notes: z.string().trim().max(2000).nullable().optional(),
}).strict()
const resolveSchema = z.object({}).strict()

function legacyProposal(row, party) {
  if (row[`${party}_proposed_disposition`]) return row[`${party}_proposed_disposition`]
  return row[`${party}_decision`] === 'approved' ? row.proposed_disposition : null
}

async function loadContext(propertyId, userId) {
  const cases = await findAll(
    'property_disposition_cases',
    (row) => row.property_id === propertyId,
  )
  const openStatuses = new Set(['pending', 'agreed', 'disputed'])
  cases.sort((a, b) => {
    const openDelta = Number(openStatuses.has(b.status)) - Number(openStatuses.has(a.status))
    return openDelta || String(b.created_at).localeCompare(String(a.created_at))
  })
  const dispositionCase = cases[0] ?? null
  if (!dispositionCase) return null

  const property = await findOne('properties', (row) => row.id === propertyId)
  if (!property) return null

  const sourceMembership = await findOne(
    'tenant_memberships',
    (row) => row.id === dispositionCase.membership_id,
  )
  const personalTenant = await findOne(
    'tenants',
    (row) => row.id === dispositionCase.personal_tenant_id,
  )

  const isAgent = property.source_user_id === userId
    || sourceMembership?.user_id === userId
    || personalTenant?.personal_owner_user_id === userId
  if (isAgent) {
    return { dispositionCase, property, viewerRole: 'agent' }
  }

  const agencyTenant = await findOne(
    'tenants',
    (row) => row.id === dispositionCase.agency_tenant_id,
  )
  const tenantMembership = await findOne(
    'tenant_memberships',
    (row) => row.tenant_id === dispositionCase.agency_tenant_id
      && row.user_id === userId
      && row.status === 'active'
      && ['owner', 'admin'].includes(row.role),
  )
  const agencyMembership = agencyTenant?.agency_id
    ? await findOne(
      'agency_members',
      (row) => row.agency_id === agencyTenant.agency_id
        && row.user_id === userId
        && row.status === 'active'
        && ['owner', 'admin'].includes(row.role),
    )
    : null

  if (!tenantMembership && !agencyMembership) return null
  return { dispositionCase, property, viewerRole: 'agency' }
}

async function partyNames(dispositionCase, property) {
  const agencyTenant = await findOne('tenants', (row) => row.id === dispositionCase.agency_tenant_id)
  const sourceMembership = await findOne(
    'tenant_memberships',
    (row) => row.id === dispositionCase.membership_id,
  )
  const agent = await findOne(
    'agents',
    (row) => row.id === property.agent_id
      || row.user_id === property.source_user_id
      || row.user_id === sourceMembership?.user_id,
  )
  return {
    agency: agencyTenant?.name || property.agency_name || 'Agency',
    agent: agent?.name || property.agent_name || 'Agent',
  }
}

async function serialize(context) {
  const { dispositionCase: row, property, viewerRole } = context
  const names = await partyNames(row, property)
  const agencyProposal = legacyProposal(row, 'agency')
  const agentProposal = legacyProposal(row, 'agent')
  return {
    case: {
      id: row.id,
      property_id: row.property_id,
      proposed_disposition: row.proposed_disposition,
      agency_proposed_disposition: agencyProposal,
      agent_proposed_disposition: agentProposal,
      agency_notes: row.agency_notes ?? null,
      agent_notes: row.agent_notes ?? null,
      status: row.status,
      initiated_by: row.initiated_by,
      resolved_by: row.resolved_by ?? null,
      resolution_notes: row.resolution_notes ?? null,
      created_at: row.created_at,
      updated_at: row.updated_at,
      resolved_at: row.resolved_at ?? null,
    },
    property: {
      id: property.id,
      title: property.title,
      reference: property.reference ?? null,
      status: property.status,
      price: property.price ?? null,
      price_unit: property.price_unit ?? null,
      city: property.city ?? null,
      neighborhood: property.neighborhood ?? null,
      photo: Array.isArray(property.photos) ? property.photos[0] ?? null : null,
    },
    parties: names,
    viewer_role: viewerRole,
    can_resolve: row.status === 'agreed'
      && Boolean(agencyProposal && agentProposal && agencyProposal === agentProposal),
  }
}

function leakSafeNotFound(res) {
  return res.status(404).json({ error: 'Disposition case not found' })
}

export function registerRoutes(app, { authMiddleware }) {
  if (!authMiddleware) throw new Error('registerRoutes requires authMiddleware')

  app.get('/api/properties/:id/disposition-case', authMiddleware, async (req, res, next) => {
    try {
      const context = await loadContext(req.params.id, req.user.id)
      if (!context) return leakSafeNotFound(res)
      return res.json(await serialize(context))
    } catch (error) {
      return next(error)
    }
  })

  app.patch('/api/properties/:id/disposition-case/decision', authMiddleware, async (req, res, next) => {
    try {
      const parsed = decisionSchema.safeParse(req.body)
      if (!parsed.success) {
        return res.status(400).json({ error: 'Invalid disposition decision', details: parsed.error.flatten() })
      }
      const context = await loadContext(req.params.id, req.user.id)
      if (!context) return leakSafeNotFound(res)
      if (['completed', 'cancelled'].includes(context.dispositionCase.status)) {
        return res.status(409).json({ error: 'This disposition case is closed', code: 'CASE_CLOSED' })
      }

      const proposalField = `${context.viewerRole}_proposed_disposition`
      const notesField = `${context.viewerRole}_notes`
      const updatedAt = new Date().toISOString()
      const nextRow = {
        ...context.dispositionCase,
        [proposalField]: parsed.data.disposition,
        [notesField]: parsed.data.notes ?? null,
        updated_at: updatedAt,
      }
      const agencyProposal = legacyProposal(nextRow, 'agency')
      const agentProposal = legacyProposal(nextRow, 'agent')
      nextRow.status = agencyProposal && agentProposal
        ? (agencyProposal === agentProposal ? 'agreed' : 'disputed')
        : 'pending'

      await update(
        'property_disposition_cases',
        (row) => row.id === context.dispositionCase.id,
        () => nextRow,
      )
      context.dispositionCase = nextRow
      return res.json(await serialize(context))
    } catch (error) {
      return next(error)
    }
  })

  app.post('/api/properties/:id/disposition-case/resolve', authMiddleware, async (req, res, next) => {
    try {
      const parsed = resolveSchema.safeParse(req.body ?? {})
      if (!parsed.success) {
        return res.status(400).json({ error: 'Invalid resolve request', details: parsed.error.flatten() })
      }
      const context = await loadContext(req.params.id, req.user.id)
      if (!context) return leakSafeNotFound(res)

      const agencyProposal = legacyProposal(context.dispositionCase, 'agency')
      const agentProposal = legacyProposal(context.dispositionCase, 'agent')
      if (
        context.dispositionCase.status !== 'agreed'
        || !agencyProposal
        || agencyProposal !== agentProposal
      ) {
        return res.status(409).json({ error: 'Both parties must agree before resolution', code: 'NOT_AGREED' })
      }

      const propertyPatch = agencyProposal === 'agency_retains'
        ? {
          tenant_id: context.dispositionCase.agency_tenant_id,
          custody_tenant_id: context.dispositionCase.agency_tenant_id,
          ownership_type: 'agency',
          exit_disposition: 'agency_retains',
        }
        : agencyProposal === 'agent_retains'
          ? {
            tenant_id: context.dispositionCase.personal_tenant_id,
            custody_tenant_id: context.dispositionCase.personal_tenant_id,
            ownership_type: 'personal',
            agency_id: null,
            exit_disposition: 'agent_retains',
          }
          : { status: 'archived', exit_disposition: 'case_review' }

      const now = new Date().toISOString()
      const nextProperty = { ...context.property, ...propertyPatch, updated_at: now }
      const nextCase = {
        ...context.dispositionCase,
        status: 'completed',
        proposed_disposition: agencyProposal,
        resolved_by: req.user.id,
        resolved_at: now,
        updated_at: now,
      }
      await update('properties', (row) => row.id === context.property.id, () => nextProperty)
      await update(
        'property_disposition_cases',
        (row) => row.id === context.dispositionCase.id,
        () => nextCase,
      )
      context.property = nextProperty
      context.dispositionCase = nextCase
      return res.json(await serialize(context))
    } catch (error) {
      return next(error)
    }
  })
}
