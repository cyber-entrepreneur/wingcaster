/**
 * Contact relationships CRUD (BE-BLOCKER-36).
 *
 * Auth: session on /api/contacts/... ; publicNoAuth + signed purpose token on
 * /public/relationships/consent*.
 *
 * Consent tokens use signed-token.js purpose=`relationship_consent` (same HMAC
 * family as webhook-verify.js; dispatch docs' type='relationship_consent'
 * maps here — do not invent a parallel crypto stack).
 */

import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { authMiddleware } from '../../auth.js'
import { query as defaultQuery, transaction as defaultTransaction } from '../../db.js'
import { assertOwnsContact, NotFoundError } from '../authz.js'
import { personalTenantId, agencyTenantId } from '../../tenant-authorization.js'
import { publicNoAuth } from '../public-no-auth.js'
import {
  RELATIONSHIP_CONSENT_PURPOSE,
  RELATIONSHIP_CONSENT_TTL_SECONDS,
  signRelationshipConsentToken,
  verifyRelationshipConsentToken,
} from '../signed-token.js'
import { sendEmail as defaultSendEmail } from '../notifications/email.js'
import { validate } from '../validation.js'
import logger from '../logger.js'

export const PARTY_TYPES = Object.freeze(['buyer', 'seller', 'landlord', 'tenant'])
export const RELATIONSHIP_TYPES = Object.freeze(['representation', 'mandate', 'affinity'])
export const EXCLUSIVITY = Object.freeze(['exclusive', 'non_exclusive'])
export const RELATIONSHIP_STATUSES = Object.freeze([
  'pending',
  'confirmed',
  'active',
  'suspended',
  'ended',
  'expired',
  'rejected',
])

const PENDING_EDITABLE = new Set(['pending'])
const ADMIN_ROLES = new Set(['owner', 'admin'])

const scopeSchema = z.record(z.unknown()).optional().default({})

export const createRelationshipSchema = z.object({
  party_type: z.enum(PARTY_TYPES),
  relationship_type: z.enum(RELATIONSHIP_TYPES),
  exclusivity: z.enum(EXCLUSIVITY).optional().default('non_exclusive'),
  scope: scopeSchema,
  starts_at: z.string().datetime({ offset: true }).nullable().optional(),
  ends_at: z.string().datetime({ offset: true }).nullable().optional(),
}).strict().superRefine((body, ctx) => {
  if (body.starts_at && body.ends_at) {
    if (new Date(body.ends_at).getTime() <= new Date(body.starts_at).getTime()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['ends_at'],
        message: 'must_be_after_starts_at',
      })
    }
  }
})

export const patchRelationshipSchema = z.object({
  scope: scopeSchema.optional(),
  starts_at: z.string().datetime({ offset: true }).nullable().optional(),
  ends_at: z.string().datetime({ offset: true }).nullable().optional(),
}).strict().refine(
  (body) => body.scope !== undefined || body.starts_at !== undefined || body.ends_at !== undefined,
  { message: 'At least one of scope, starts_at, ends_at is required' },
)

export const consentDecisionSchema = z.object({
  token: z.string().min(10).max(4000),
}).strict()

function iso(value) {
  if (value == null) return null
  if (value instanceof Date) return value.toISOString()
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

function monthStamp(value) {
  const d = iso(value)
  return d ? d.slice(0, 7) : null
}

function asObject(value) {
  if (!value) return {}
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
    } catch {
      return {}
    }
  }
  return typeof value === 'object' && !Array.isArray(value) ? value : {}
}

/**
 * Lazy status transitions (server-enforced state machine helpers):
 * confirmed → active when starts_at reached; active → ended/expired when ends_at passed.
 */
export function effectiveRelationshipStatus(row, now = new Date()) {
  const status = row?.status
  const nowMs = now instanceof Date ? now.getTime() : new Date(now).getTime()
  const starts = row?.starts_at ? new Date(row.starts_at).getTime() : null
  const ends = row?.ends_at ? new Date(row.ends_at).getTime() : null

  if (status === 'confirmed') {
    if (starts == null || starts <= nowMs) {
      if (ends != null && ends <= nowMs) return 'expired'
      return 'active'
    }
    return 'confirmed'
  }
  if (status === 'active') {
    if (ends != null && ends <= nowMs) return 'expired'
    return 'active'
  }
  return status
}

export function serializeRelationship(row, { now = new Date() } = {}) {
  const status = effectiveRelationshipStatus(row, now)
  return {
    id: row.id,
    tenant_id: row.tenant_id,
    contact_id: row.contact_id,
    agent_user_id: row.agent_user_id,
    party_type: row.party_type,
    relationship_type: row.relationship_type,
    exclusivity: row.exclusivity,
    scope: asObject(row.scope),
    status,
    consent_record: asObject(row.consent_record),
    starts_at: iso(row.starts_at),
    ends_at: iso(row.ends_at),
    created_at: iso(row.created_at),
    updated_at: iso(row.updated_at),
  }
}

/**
 * PII-masked cross-agent/other-tenant summary. Never include agent name,
 * agency name, email, phone, consent evidence, or other PII.
 */
export function redactRelationship(row) {
  const scope = asObject(row.scope)
  const areas = Array.isArray(scope.areas) ? scope.areas : []
  const propertyTypes = Array.isArray(scope.property_types) ? scope.property_types : []
  const areasRegion = areas.length
    ? String(areas[0]).split(/[-_]/)[0] || null
    : (typeof scope.region === 'string' ? scope.region : null)

  return {
    id: 'redacted',
    relationship_type: row.relationship_type,
    party_type: row.party_type,
    exclusivity: row.exclusivity,
    status: effectiveRelationshipStatus(row),
    starts_month: monthStamp(row.starts_at) || monthStamp(row.created_at),
    ends_month: monthStamp(row.ends_at),
    scope_summary: {
      ...(areasRegion ? { areas_region: areasRegion } : {}),
      ...(propertyTypes.length ? { property_types: propertyTypes.slice(0, 5) } : {}),
      // Price ranges intentionally omitted (PII / commercial sensitivity).
    },
  }
}

export function resolveRelationshipTenant(req) {
  const userId = req.user?.id || null
  const headerTenant = (
    req.get?.('x-active-tenant-id')
    || req.get?.('x-tenant-id')
    || req.headers?.['x-active-tenant-id']
    || req.headers?.['x-tenant-id']
    || ''
  ).toString().trim() || null

  const active = headerTenant || req.user?.active_tenant_id || null
  if (active) {
    if (active.startsWith('agency:')) {
      return {
        tenantId: active,
        mode: 'agency',
        agencyId: active.slice('agency:'.length),
        userId,
      }
    }
    if (active.startsWith('personal:')) {
      return { tenantId: active, mode: 'personal', agencyId: null, userId }
    }
    // Bare agency UUID
    return {
      tenantId: agencyTenantId(active),
      mode: 'agency',
      agencyId: active,
      userId,
    }
  }

  const agencyId = req.agent?.agency_id || null
  if (agencyId) {
    return {
      tenantId: agencyTenantId(agencyId),
      mode: 'agency',
      agencyId: String(agencyId),
      userId,
    }
  }
  if (!userId) return null
  return {
    tenantId: personalTenantId(userId),
    mode: 'personal',
    agencyId: null,
    userId,
  }
}

async function isAgencyAdmin(runQuery, { tenantId, userId }) {
  if (!tenantId || !userId || !String(tenantId).startsWith('agency:')) return false
  const rows = await runQuery(
    `SELECT role FROM public.tenant_memberships
      WHERE tenant_id = $1
        AND user_id = $2
        AND status = 'active'
      LIMIT 1`,
    [tenantId, userId],
  )
  return ADMIN_ROLES.has(rows?.[0]?.role)
}

async function getPublicAppBase() {
  return (
    process.env.PUBLIC_APP_URL
    || process.env.APP_URL
    || process.env.PUBLIC_API_URL
    || 'http://localhost:5173'
  ).replace(/\/$/, '')
}

export async function buildConsentUrl(token) {
  const base = await getPublicAppBase()
  return `${base}/public/relationships/consent?token=${encodeURIComponent(token)}`
}

export function issueConsentToken({ relationshipId, contactId, jti = randomUUID() }) {
  const token = signRelationshipConsentToken({
    relationshipId,
    contactId,
    jti,
  })
  const expiresAt = new Date(Date.now() + RELATIONSHIP_CONSENT_TTL_SECONDS * 1000).toISOString()
  return { token, jti, expiresAt, purpose: RELATIONSHIP_CONSENT_PURPOSE }
}

function isUniqueViolation(err) {
  return err?.code === '23505' || /uq_active_exclusive_buyer_rep/i.test(String(err?.message || ''))
}

async function loadContact(runQuery, contactId) {
  const rows = await runQuery(
    `SELECT id, email, phone, name, agency_id, assigned_agent_id,
            COALESCE(cross_tenant_visibility, true) AS cross_tenant_visibility,
            data
       FROM public.contacts
      WHERE id = $1`,
    [contactId],
  )
  return rows?.[0] || null
}

async function loadRelationship(runQuery, { id, contactId, tenantId = null }) {
  const rows = await runQuery(
    `SELECT *
       FROM public.contact_relationships
      WHERE id = $1
        AND contact_id = $2
        ${tenantId ? 'AND tenant_id = $3' : ''}`,
    tenantId ? [id, contactId, tenantId] : [id, contactId],
  )
  return rows?.[0] || null
}

async function findExclusiveConflict(runQuery, { contactId, partyType, excludeId = null }) {
  const rows = await runQuery(
    `SELECT id, party_type, status, ends_at, exclusivity, tenant_id
       FROM public.contact_relationships
      WHERE contact_id = $1
        AND party_type = $2
        AND exclusivity = 'exclusive'
        AND status IN ('confirmed', 'active')
        AND ($3::text IS NULL OR id <> $3)
      LIMIT 1`,
    [contactId, partyType, excludeId],
  )
  return rows?.[0] || null
}

function exclusiveConflictBody(conflict) {
  return {
    error: 'EXCLUSIVE_CONFLICT',
    message: 'Another agency holds an active exclusive of this type.',
    conflicting_relationship_summary: conflict
      ? {
          party_type: conflict.party_type,
          status: effectiveRelationshipStatus(conflict),
          ends_at_month: monthStamp(conflict.ends_at),
        }
      : null,
  }
}

async function sendConsentEmail({
  sendEmail,
  contact,
  relationship,
  token,
  expiresAt,
}) {
  const email = String(contact.email || '').trim()
  if (!email) {
    const err = new Error('Contact has no email address for consent delivery')
    err.code = 'CONTACT_EMAIL_MISSING'
    err.status = 422
    throw err
  }
  const url = await buildConsentUrl(token)
  const subject = 'Confirm your representation relationship'
  const body = [
    `Hello${contact.name ? ` ${contact.name}` : ''},`,
    '',
    'An agent has requested to formalize a relationship with you on WingCaster.',
    `Type: ${relationship.relationship_type} · Party: ${relationship.party_type} · ${relationship.exclusivity}`,
    '',
    `Please review and accept or reject here:`,
    url,
    '',
    `This link expires at ${expiresAt}.`,
  ].join('\n')

  await sendEmail({ to: email, subject, body })
  return { sent_at: new Date().toISOString(), expires_at: expiresAt, url }
}

/**
 * @param {import('express').Application} app
 * @param {{
 *   auth?: Function,
 *   query?: Function,
 *   transaction?: Function,
 *   sendEmail?: Function,
 *   assertOwns?: Function,
 * }} [deps]
 */
export function registerRoutes(app, {
  auth = authMiddleware,
  query: queryFn = defaultQuery,
  transaction: txFn = defaultTransaction,
  sendEmail = defaultSendEmail,
  assertOwns = assertOwnsContact,
} = {}) {
  const runQuery = queryFn

  async function requireOwnedContact(req, res) {
    try {
      return await assertOwns(req.user.id, req.params.contactId)
    } catch (err) {
      if (err instanceof NotFoundError || err?.status === 404) {
        res.status(404).json({ error: 'Contact not found' })
        return null
      }
      throw err
    }
  }

  // ─── 1. GET mine ─────────────────────────────────────────────────────────
  app.get(
    '/api/contacts/:contactId/relationships/mine',
    auth,
    async (req, res) => {
      try {
        if (!req.user?.id) return res.status(401).json({ error: 'Unauthorized' })
        const contact = await requireOwnedContact(req, res)
        if (!contact) return
        const tenant = resolveRelationshipTenant(req)
        if (!tenant?.tenantId) return res.status(401).json({ error: 'Unauthorized' })

        const admin = await isAgencyAdmin(runQuery, {
          tenantId: tenant.tenantId,
          userId: req.user.id,
        })

        const rows = await runQuery(
          admin
            ? `SELECT * FROM public.contact_relationships
                WHERE contact_id = $1 AND tenant_id = $2
                ORDER BY created_at DESC`
            : `SELECT * FROM public.contact_relationships
                WHERE contact_id = $1 AND tenant_id = $2 AND agent_user_id = $3
                ORDER BY created_at DESC`,
          admin
            ? [req.params.contactId, tenant.tenantId]
            : [req.params.contactId, tenant.tenantId, req.user.id],
        )

        return res.json({ relationships: rows.map((row) => serializeRelationship(row)) })
      } catch (err) {
        logger.error({ err: err.message, contact_id: req.params.contactId }, 'list mine relationships failed')
        return res.status(500).json({ error: 'Failed to list relationships' })
      }
    },
  )

  // ─── 2. GET other (PII-masked) ───────────────────────────────────────────
  app.get(
    '/api/contacts/:contactId/relationships/other',
    auth,
    async (req, res) => {
      try {
        if (!req.user?.id) return res.status(401).json({ error: 'Unauthorized' })
        const owned = await requireOwnedContact(req, res)
        if (!owned) return
        const tenant = resolveRelationshipTenant(req)
        if (!tenant?.tenantId) return res.status(401).json({ error: 'Unauthorized' })

        const contact = await loadContact(runQuery, req.params.contactId)
        if (!contact) return res.status(404).json({ error: 'Contact not found' })

        const visibility = contact.cross_tenant_visibility !== false
          && asObject(contact.data).cross_tenant_visibility !== false
        if (!visibility) {
          return res.status(403).json({
            error: 'CROSS_TENANT_VISIBILITY_DISABLED',
            message: 'This contact has disabled cross-agency awareness.',
            relationships: [],
            disabled: true,
          })
        }

        // Same contact_id owned by other tenants, plus email/phone-matched
        // contacts (multi-tenant CRM reality without a persons table yet).
        const rows = await runQuery(
          `SELECT cr.*
             FROM public.contact_relationships cr
             JOIN public.contacts c ON c.id = cr.contact_id
            WHERE cr.tenant_id <> $1
              AND cr.status NOT IN ('rejected', 'ended', 'expired')
              AND (
                cr.contact_id = $2
                OR (
                  NULLIF(TRIM(COALESCE(c.email, '')), '') IS NOT NULL
                  AND LOWER(TRIM(c.email)) = LOWER(TRIM($3))
                )
                OR (
                  NULLIF(TRIM(COALESCE(c.phone, '')), '') IS NOT NULL
                  AND TRIM(c.phone) = TRIM($4)
                )
              )
            ORDER BY cr.created_at DESC
            LIMIT 100`,
          [
            tenant.tenantId,
            req.params.contactId,
            contact.email || '',
            contact.phone || '',
          ],
        )

        return res.json({
          relationships: rows.map((row) => redactRelationship(row)),
          disabled: false,
        })
      } catch (err) {
        logger.error({ err: err.message, contact_id: req.params.contactId }, 'list other relationships failed')
        return res.status(500).json({ error: 'Failed to list relationships' })
      }
    },
  )

  // ─── 3. POST create (pending + consent email) ────────────────────────────
  app.post(
    '/api/contacts/:contactId/relationships',
    auth,
    validate(createRelationshipSchema),
    async (req, res) => {
      try {
        if (!req.user?.id) return res.status(401).json({ error: 'Unauthorized' })
        const owned = await requireOwnedContact(req, res)
        if (!owned) return
        const tenant = resolveRelationshipTenant(req)
        if (!tenant?.tenantId) return res.status(401).json({ error: 'Unauthorized' })

        const contact = await loadContact(runQuery, req.params.contactId)
        if (!contact) return res.status(404).json({ error: 'Contact not found' })
        if (!String(contact.email || '').trim()) {
          return res.status(422).json({
            error: 'CONTACT_EMAIL_MISSING',
            message: 'Contact has no email address; cannot send consent link.',
          })
        }

        const body = req.validated
        const id = randomUUID()
        const now = new Date().toISOString()
        const { token, jti, expiresAt } = issueConsentToken({
          relationshipId: id,
          contactId: contact.id,
        })

        let row
        try {
          const inserted = await runQuery(
            `INSERT INTO public.contact_relationships (
               id, tenant_id, contact_id, agent_user_id,
               party_type, relationship_type, exclusivity, scope,
               status, consent_record, starts_at, ends_at,
               created_at, updated_at, data
             ) VALUES (
               $1, $2, $3, $4,
               $5, $6, $7, $8::jsonb,
               'pending', '{}'::jsonb, $9::timestamptz, $10::timestamptz,
               $11::timestamptz, $11::timestamptz,
               $12::jsonb
             )
             RETURNING *`,
            [
              id,
              tenant.tenantId,
              contact.id,
              req.user.id,
              body.party_type,
              body.relationship_type,
              body.exclusivity,
              JSON.stringify(body.scope || {}),
              body.starts_at || null,
              body.ends_at || null,
              now,
              JSON.stringify({
                consent_token_jti: jti,
                consent_token_issued_at: now,
                consent_resend_count: 0,
              }),
            ],
          )
          row = inserted[0]
        } catch (err) {
          if (isUniqueViolation(err)) {
            const conflict = await findExclusiveConflict(runQuery, {
              contactId: contact.id,
              partyType: body.party_type,
            })
            return res.status(409).json(exclusiveConflictBody(conflict))
          }
          throw err
        }

        try {
          await sendConsentEmail({
            sendEmail,
            contact,
            relationship: row,
            token,
            expiresAt,
          })
        } catch (mailErr) {
          // Roll back the pending row if we cannot deliver the consent link.
          await runQuery(`DELETE FROM public.contact_relationships WHERE id = $1 AND status = 'pending'`, [id])
          if (mailErr.code === 'CONTACT_EMAIL_MISSING') {
            return res.status(422).json({
              error: 'CONTACT_EMAIL_MISSING',
              message: mailErr.message,
            })
          }
          logger.error({ err: mailErr.message, relationship_id: id }, 'consent email send failed')
          return res.status(502).json({
            error: 'CONSENT_EMAIL_FAILED',
            message: 'Failed to send consent email. Relationship was not created.',
          })
        }

        return res.status(201).json(serializeRelationship(row))
      } catch (err) {
        if (err?.name === 'ZodError') {
          return res.status(400).json({ error: 'VALIDATION_FAILED', issues: err.issues })
        }
        logger.error({ err: err.message, contact_id: req.params.contactId }, 'create relationship failed')
        return res.status(500).json({ error: 'Failed to create relationship' })
      }
    },
  )

  // ─── 4. PATCH pending only ───────────────────────────────────────────────
  app.patch(
    '/api/contacts/:contactId/relationships/:id',
    auth,
    validate(patchRelationshipSchema),
    async (req, res) => {
      try {
        if (!req.user?.id) return res.status(401).json({ error: 'Unauthorized' })
        const contact = await requireOwnedContact(req, res)
        if (!contact) return
        const tenant = resolveRelationshipTenant(req)
        if (!tenant?.tenantId) return res.status(401).json({ error: 'Unauthorized' })

        const admin = await isAgencyAdmin(runQuery, {
          tenantId: tenant.tenantId,
          userId: req.user.id,
        })
        const row = await loadRelationship(runQuery, {
          id: req.params.id,
          contactId: req.params.contactId,
          tenantId: tenant.tenantId,
        })
        if (!row) return res.status(404).json({ error: 'Relationship not found' })
        if (!admin && row.agent_user_id !== req.user.id) {
          return res.status(403).json({ error: 'Forbidden' })
        }
        if (!PENDING_EDITABLE.has(row.status)) {
          return res.status(409).json({
            error: 'NOT_EDITABLE',
            message: 'Only pending relationships can be updated.',
            status: row.status,
          })
        }

        const body = req.validated
        const nextStarts = body.starts_at !== undefined ? body.starts_at : row.starts_at
        const nextEnds = body.ends_at !== undefined ? body.ends_at : row.ends_at
        if (nextStarts && nextEnds && new Date(nextEnds).getTime() <= new Date(nextStarts).getTime()) {
          return res.status(400).json({
            error: 'VALIDATION_FAILED',
            field_errors: { ends_at: 'must_be_after_starts_at' },
          })
        }

        const updated = await runQuery(
          `UPDATE public.contact_relationships
              SET scope = COALESCE($2::jsonb, scope),
                  starts_at = CASE WHEN $3::boolean THEN $4::timestamptz ELSE starts_at END,
                  ends_at = CASE WHEN $5::boolean THEN $6::timestamptz ELSE ends_at END,
                  updated_at = CURRENT_TIMESTAMP
            WHERE id = $1 AND status = 'pending'
            RETURNING *`,
          [
            row.id,
            body.scope !== undefined ? JSON.stringify(body.scope) : null,
            body.starts_at !== undefined,
            body.starts_at ?? null,
            body.ends_at !== undefined,
            body.ends_at ?? null,
          ],
        )
        if (!updated[0]) {
          return res.status(409).json({
            error: 'NOT_EDITABLE',
            message: 'Only pending relationships can be updated.',
          })
        }
        return res.json(serializeRelationship(updated[0]))
      } catch (err) {
        logger.error({ err: err.message, id: req.params.id }, 'patch relationship failed')
        return res.status(500).json({ error: 'Failed to update relationship' })
      }
    },
  )

  // ─── 5. DELETE pending only ──────────────────────────────────────────────
  app.delete(
    '/api/contacts/:contactId/relationships/:id',
    auth,
    async (req, res) => {
      try {
        if (!req.user?.id) return res.status(401).json({ error: 'Unauthorized' })
        const contact = await requireOwnedContact(req, res)
        if (!contact) return
        const tenant = resolveRelationshipTenant(req)
        if (!tenant?.tenantId) return res.status(401).json({ error: 'Unauthorized' })

        const admin = await isAgencyAdmin(runQuery, {
          tenantId: tenant.tenantId,
          userId: req.user.id,
        })
        const row = await loadRelationship(runQuery, {
          id: req.params.id,
          contactId: req.params.contactId,
          tenantId: tenant.tenantId,
        })
        if (!row) return res.status(404).json({ error: 'Relationship not found' })
        if (!admin && row.agent_user_id !== req.user.id) {
          return res.status(403).json({ error: 'Forbidden' })
        }
        if (row.status !== 'pending') {
          return res.status(409).json({
            error: 'NOT_DELETABLE',
            message: 'Only pending relationships can be deleted.',
            status: row.status,
          })
        }

        // Clear token jti then delete — outstanding consent links become invalid.
        const deleted = await runQuery(
          `DELETE FROM public.contact_relationships
            WHERE id = $1 AND status = 'pending'
            RETURNING id`,
          [row.id],
        )
        if (!deleted[0]) {
          return res.status(409).json({
            error: 'NOT_DELETABLE',
            message: 'Only pending relationships can be deleted.',
          })
        }
        return res.status(204).send()
      } catch (err) {
        logger.error({ err: err.message, id: req.params.id }, 'delete relationship failed')
        return res.status(500).json({ error: 'Failed to delete relationship' })
      }
    },
  )

  // ─── 6. Resend consent link ──────────────────────────────────────────────
  app.post(
    '/api/contacts/:contactId/relationships/:id/resend-consent-link',
    auth,
    async (req, res) => {
      try {
        if (!req.user?.id) return res.status(401).json({ error: 'Unauthorized' })
        const owned = await requireOwnedContact(req, res)
        if (!owned) return
        const tenant = resolveRelationshipTenant(req)
        if (!tenant?.tenantId) return res.status(401).json({ error: 'Unauthorized' })

        const admin = await isAgencyAdmin(runQuery, {
          tenantId: tenant.tenantId,
          userId: req.user.id,
        })
        const row = await loadRelationship(runQuery, {
          id: req.params.id,
          contactId: req.params.contactId,
          tenantId: tenant.tenantId,
        })
        if (!row) return res.status(404).json({ error: 'Relationship not found' })
        if (!admin && row.agent_user_id !== req.user.id) {
          return res.status(403).json({ error: 'Forbidden' })
        }
        if (row.status !== 'pending') {
          return res.status(409).json({
            error: 'NOT_PENDING',
            message: 'Consent links can only be resent for pending relationships.',
            status: row.status,
          })
        }

        const contact = await loadContact(runQuery, req.params.contactId)
        if (!contact) return res.status(404).json({ error: 'Contact not found' })
        if (!String(contact.email || '').trim()) {
          return res.status(422).json({
            error: 'CONTACT_EMAIL_MISSING',
            message: 'Contact has no email address; cannot send consent link.',
          })
        }

        const data = asObject(row.data)
        const resendCount = Number(data.consent_resend_count || 0)
        const issuedAt = data.consent_token_issued_at ? new Date(data.consent_token_issued_at).getTime() : 0
        const dayAgo = Date.now() - 24 * 60 * 60 * 1000
        if (resendCount >= 3 && issuedAt >= dayAgo) {
          return res.status(429).json({
            error: 'RESEND_RATE_LIMITED',
            message: 'Consent link resend limit reached (3 per 24h).',
          })
        }

        const { token, jti, expiresAt } = issueConsentToken({
          relationshipId: row.id,
          contactId: contact.id,
        })

        await runQuery(
          `UPDATE public.contact_relationships
              SET data = COALESCE(data, '{}'::jsonb)
                    || jsonb_build_object(
                         'consent_token_jti', to_jsonb($2::text),
                         'consent_token_issued_at', to_jsonb(CURRENT_TIMESTAMP::text),
                         'consent_resend_count', to_jsonb(($3::int))
                       ),
                  updated_at = CURRENT_TIMESTAMP
            WHERE id = $1 AND status = 'pending'`,
          [row.id, jti, resendCount + 1],
        )

        const sent = await sendConsentEmail({
          sendEmail,
          contact,
          relationship: row,
          token,
          expiresAt,
        })

        return res.json({
          sent_at: sent.sent_at,
          expires_at: sent.expires_at,
        })
      } catch (err) {
        if (err.code === 'CONTACT_EMAIL_MISSING') {
          return res.status(422).json({ error: err.code, message: err.message })
        }
        logger.error({ err: err.message, id: req.params.id }, 'resend consent link failed')
        return res.status(500).json({ error: 'Failed to resend consent link' })
      }
    },
  )

  // ─── 7. Public consent surface ───────────────────────────────────────────
  // PUBLIC_NO_AUTH — token-signed only; do not attach authMiddleware.

  async function resolveConsentToken(token) {
    const verified = verifyRelationshipConsentToken(token)
    if (!verified.ok) {
      return {
        ok: false,
        status: verified.code === 'expired' ? 410 : 401,
        error: verified.error,
        code: verified.code,
      }
    }
    const { relationship_id: relationshipId, contact_id: contactId, jti } = verified.payload || {}
    if (!relationshipId || !contactId || !jti) {
      return { ok: false, status: 401, error: 'Token missing claims', code: 'invalid_token' }
    }

    const rows = await runQuery(
      `SELECT cr.*, c.name AS contact_name, c.email AS contact_email
         FROM public.contact_relationships cr
         JOIN public.contacts c ON c.id = cr.contact_id
        WHERE cr.id = $1 AND cr.contact_id = $2`,
      [relationshipId, contactId],
    )
    const row = rows?.[0]
    if (!row) {
      return { ok: false, status: 404, error: 'Relationship not found', code: 'not_found' }
    }

    const storedJti = asObject(row.data).consent_token_jti
    if (!storedJti || storedJti !== jti) {
      return {
        ok: false,
        status: 401,
        error: 'Consent link is no longer valid',
        code: 'token_consumed',
      }
    }

    if (row.status !== 'pending') {
      return {
        ok: false,
        status: 409,
        error: 'Relationship is no longer awaiting consent',
        code: 'not_pending',
        status_value: row.status,
      }
    }

    return { ok: true, row, payload: verified.payload }
  }

  function publicConsentTerms(row) {
    return {
      purpose: RELATIONSHIP_CONSENT_PURPOSE,
      relationship_id: row.id,
      contact_id: row.contact_id,
      party_type: row.party_type,
      relationship_type: row.relationship_type,
      exclusivity: row.exclusivity,
      scope: asObject(row.scope),
      starts_at: iso(row.starts_at),
      ends_at: iso(row.ends_at),
      status: row.status,
      // No agent/agency/email/phone PII on the public landing payload beyond
      // what the contact already knows about themselves.
    }
  }

  app.get(
    '/public/relationships/consent',
    publicNoAuth,
    async (req, res) => {
      try {
        const token = String(req.query.token || '')
        if (!token) {
          return res.status(400).json({ error: 'token query parameter is required' })
        }
        const resolved = await resolveConsentToken(token)
        if (!resolved.ok) {
          return res.status(resolved.status).json({
            error: resolved.error,
            code: resolved.code,
          })
        }
        return res.json(publicConsentTerms(resolved.row))
      } catch (err) {
        logger.error({ err: err.message }, 'public consent GET failed')
        return res.status(500).json({ error: 'Internal server error' })
      }
    },
  )

  app.post(
    '/public/relationships/consent/accept',
    publicNoAuth,
    validate(consentDecisionSchema),
    async (req, res) => {
      try {
        const resolved = await resolveConsentToken(req.validated.token)
        if (!resolved.ok) {
          return res.status(resolved.status).json({
            error: resolved.error,
            code: resolved.code,
          })
        }

        const conflict = await findExclusiveConflict(runQuery, {
          contactId: resolved.row.contact_id,
          partyType: resolved.row.party_type,
          excludeId: resolved.row.id,
        })
        if (resolved.row.exclusivity === 'exclusive' && conflict) {
          return res.status(409).json(exclusiveConflictBody(conflict))
        }

        const now = new Date()
        const consentRecord = {
          method: 'email_reply',
          summary: 'Contact confirmed via signed consent link',
          confirmed_at: now.toISOString(),
          confirmation_method: 'consent_link',
          decision: 'accepted',
        }

        // Atomic: status flip + consent_record + invalidate token jti.
        let updated
        try {
          updated = await txFn(async () => {
            const rows = await runQuery(
              `UPDATE public.contact_relationships
                  SET status = 'confirmed',
                      consent_record = $2::jsonb,
                      data = (COALESCE(data, '{}'::jsonb) - 'consent_token_jti')
                             || jsonb_build_object(
                                  'consent_token_consumed_at', to_jsonb(CURRENT_TIMESTAMP::text),
                                  'consent_decision', 'accepted'
                                ),
                      updated_at = CURRENT_TIMESTAMP
                WHERE id = $1
                  AND status = 'pending'
                  AND COALESCE(data->>'consent_token_jti', '') = $3
                RETURNING *`,
              [resolved.row.id, JSON.stringify(consentRecord), resolved.payload.jti],
            )
            return rows?.[0] || null
          })
        } catch (err) {
          if (isUniqueViolation(err)) {
            const c = await findExclusiveConflict(runQuery, {
              contactId: resolved.row.contact_id,
              partyType: resolved.row.party_type,
              excludeId: resolved.row.id,
            })
            return res.status(409).json(exclusiveConflictBody(c))
          }
          throw err
        }

        if (!updated) {
          return res.status(409).json({
            error: 'Consent link is no longer valid',
            code: 'token_consumed',
          })
        }

        return res.json({
          success: true,
          relationship: serializeRelationship(updated, { now }),
        })
      } catch (err) {
        logger.error({ err: err.message }, 'public consent accept failed')
        return res.status(500).json({ error: 'Internal server error' })
      }
    },
  )

  app.post(
    '/public/relationships/consent/reject',
    publicNoAuth,
    validate(consentDecisionSchema),
    async (req, res) => {
      try {
        const resolved = await resolveConsentToken(req.validated.token)
        if (!resolved.ok) {
          return res.status(resolved.status).json({
            error: resolved.error,
            code: resolved.code,
          })
        }

        const now = new Date()
        const consentRecord = {
          method: 'email_reply',
          summary: 'Contact rejected via signed consent link',
          confirmed_at: now.toISOString(),
          confirmation_method: 'consent_link',
          decision: 'rejected',
        }

        const updated = await txFn(async () => {
          const rows = await runQuery(
            `UPDATE public.contact_relationships
                SET status = 'rejected',
                    consent_record = $2::jsonb,
                    data = (COALESCE(data, '{}'::jsonb) - 'consent_token_jti')
                           || jsonb_build_object(
                                'consent_token_consumed_at', to_jsonb(CURRENT_TIMESTAMP::text),
                                'consent_decision', 'rejected',
                                'end_reason', 'contact_declined_confirmation'
                              ),
                    updated_at = CURRENT_TIMESTAMP
              WHERE id = $1
                AND status = 'pending'
                AND COALESCE(data->>'consent_token_jti', '') = $3
              RETURNING *`,
            [resolved.row.id, JSON.stringify(consentRecord), resolved.payload.jti],
          )
          return rows?.[0] || null
        })

        if (!updated) {
          return res.status(409).json({
            error: 'Consent link is no longer valid',
            code: 'token_consumed',
          })
        }

        return res.json({
          success: true,
          relationship: serializeRelationship(updated, { now }),
        })
      } catch (err) {
        logger.error({ err: err.message }, 'public consent reject failed')
        return res.status(500).json({ error: 'Internal server error' })
      }
    },
  )
}

export { publicNoAuth, RELATIONSHIP_CONSENT_PURPOSE }
