/**
 * Wave 1 Agent 6 — WF-02 cross-loop Real-Postgres e2e (slim after Phase A).
 *
 * Proves the join-agency deadlock is resolved end-to-end against current main:
 *   path (b) register stand-in → AGN-MEM-005 apply (slug or invite)
 *   → agency review (approve/reject/expire) → agency_application.resolved notify (#86)
 *
 * Slim after Phase A cascade: ONLY this e2e surface on top of main.
 * Now on main: #86 notify, #133 typecheck, #90 outcome GET, #91 RegisterPage.
 * Still pending sibling merges for full green / richer coverage:
 *   - #89 guest_signup atomic apply/accept
 *   - #108 queue filters / CSV / reveal-contact
 *
 * Outcome assertions use GET /api/users/me/agency-applications/:id (#90).
 */
import { randomUUID } from 'node:crypto'
import express from 'express'
import request from 'supertest'
import { expect, it } from 'vitest'
import { finPostgresSuite } from './fin/testing/suite.js'
import { createAgentAccount } from './identity.js'
import { signToken } from './auth.js'
import { findAll, findOne, query, update } from './db.js'
import { createAgencyWithOwner } from './tenant-authorization.js'
import {
  findAgencyBySlugOrId,
  registerAgencyApplicationRoutes,
} from './lib/agencies/applications-routes.js'
import { registerAgencyInvitationRoutes } from './lib/agencies/invitation-routes.js'
import { runAgencyApplicationExpiryTick } from './workers/agency-application-expiry.js'

const APPLY_BODY = {
  message: 'I would like to join your team via Wave 1 path (b).',
  current_listings_count: 4,
  portfolio_url: 'https://example.com/portfolio/wf02',
  availability: 'within_2_weeks',
  referral_source: 'agency_profile',
  consents: { terms: true, profile_share: true },
}

function buildApp() {
  const app = express()
  app.use(express.json())

  // Minimal AGN-MEM-005 discovery surfaces (mirrored from server.js) so the
  // slug-search / public-apply path is exercised without booting the full server.
  app.get('/api/agencies/search', async (req, res) => {
    const { q } = req.query
    let agencies = await findAll('agencies')
    if (q) {
      const s = String(q).toLowerCase()
      agencies = agencies.filter(
        (a) =>
          a.name?.toLowerCase().includes(s)
          || a.slug?.toLowerCase().includes(s)
          || a.email?.toLowerCase().includes(s),
      )
    }
    res.json(
      agencies.map((a) => ({
        id: a.id,
        name: a.name,
        slug: a.slug,
        logo: a.logo,
        accepting_applications: a.accepting_applications !== false,
      })),
    )
  })

  app.get('/api/agencies/:idOrSlug/public', async (req, res) => {
    const agency = await findAgencyBySlugOrId(req.params.idOrSlug)
    if (!agency) return res.status(404).json({ error: 'Not found' })
    return res.json({
      id: agency.id,
      name: agency.name,
      slug: agency.slug,
      logo: agency.logo || null,
      description: agency.description || null,
      accepting_applications: agency.accepting_applications !== false,
      member_count: 1,
      listings_count: 0,
    })
  })

  registerAgencyApplicationRoutes(app)
  registerAgencyInvitationRoutes(app)
  return app
}

/** Path (b) join-agency registration stand-in: verified agent account + JWT. */
async function registerJoinAgencyApplicant(label = 'PathBApplicant') {
  const userId = randomUUID()
  const now = new Date().toISOString()
  const email = `${label.toLowerCase().replace(/\s+/g, '-')}-${userId.slice(0, 8)}@x.test`
  await createAgentAccount({
    user: {
      id: userId,
      email,
      name: label,
      password_hash: 'x',
      role: 'agent',
      verified: true,
      verified_at: now,
    },
    agent: { id: userId, email, name: label, slug: `u-${userId.slice(0, 8)}` },
  })
  const token = signToken({
    id: userId,
    email,
    name: label,
    token_version: 0,
    verified_at: now,
  })
  return { userId, token, email, name: label, registration_path: 'join' }
}

async function ownerAgency({ name = 'WF02 Agency', slug } = {}) {
  const ownerId = randomUUID()
  const now = new Date().toISOString()
  const email = `owner-${ownerId.slice(0, 8)}@x.test`
  await createAgentAccount({
    user: {
      id: ownerId,
      email,
      name: 'Owner',
      password_hash: 'x',
      role: 'agent',
      verified: true,
      verified_at: now,
    },
    agent: { id: ownerId, email, name: 'Owner', slug: `o-${ownerId.slice(0, 8)}` },
  })
  const agencyId = randomUUID()
  const agencySlug = slug || `wf02-${agencyId.slice(0, 8)}`
  await createAgencyWithOwner({
    agency: {
      id: agencyId,
      name,
      slug: agencySlug,
      logo: 'https://cdn.example.test/wf02.png',
      description: 'Wave 1 cross-loop agency',
      accepting_applications: true,
    },
    ownerUserId: ownerId,
  })
  const token = signToken({
    id: ownerId,
    email,
    name: 'Owner',
    token_version: 0,
    verified_at: now,
  })
  return { userId: ownerId, token, email, agencyId, slug: agencySlug, name }
}

async function resolvedNotificationsFor(userId, applicationId) {
  const rows = await query(
    `SELECT id, user_id, type, title, body, metadata, created_at
       FROM public.notifications
      WHERE user_id = $1
        AND type = 'consumer'
        AND (
          metadata->>'application_id' = $2
          OR metadata->>'web_path' = $3
          OR metadata->>'deep_link_url' = $4
        )
      ORDER BY created_at ASC`,
    [
      userId,
      applicationId,
      `/applications/${applicationId}`,
      `wingcaster://applications/${applicationId}`,
    ],
  )
  return rows
}

/** AGT-REC-004 outcome deep-link GET (#90 on main). */
async function fetchApplicationOutcome(app, { applicationId, token }) {
  return request(app)
    .get(`/api/users/me/agency-applications/${applicationId}`)
    .set('Authorization', `Bearer ${token}`)
}

finPostgresSuite('WF-02 cross-loop deadlock resolution (Wave 1 Agent 6)', { seed: false }, ({ pool }) => {
  it('approval path: path(b) register → slug apply → review → outcome + notify', async () => {
    const agency = await ownerAgency({ name: 'Approve Loop Co', slug: 'approve-loop-co' })
    const applicant = await registerJoinAgencyApplicant('ApproveApplicant')
    const app = buildApp()

    // AGN-MEM-005 slug-search / public card discovery
    const search = await request(app).get('/api/agencies/search?q=Approve%20Loop')
    expect(search.status).toBe(200)
    expect(search.body.some((row) => row.slug === agency.slug)).toBe(true)

    const pub = await request(app).get(`/api/agencies/${agency.slug}/public`)
    expect(pub.status).toBe(200)
    expect(pub.body).toMatchObject({
      id: agency.agencyId,
      slug: agency.slug,
      accepting_applications: true,
    })

    // Apply (authenticated slug path — guest_signup arrives with #89)
    const applied = await request(app)
      .post(`/api/agencies/${agency.slug}/applications`)
      .set('Authorization', `Bearer ${applicant.token}`)
      .send(APPLY_BODY)
    expect(applied.status).toBe(201)
    const applicationId = applied.body.application.id
    expect(applied.body.redirect_to).toBe(`/applications/${applicationId}`)
    expect(applied.body.application.status).toBe('pending')

    // Agency queue visibility (basic list on main; #108 adds filters/CSV)
    const queue = await request(app)
      .get(`/api/agencies/${agency.agencyId}/applications`)
      .set('Authorization', `Bearer ${agency.token}`)
    expect(queue.status).toBe(200)
    expect(queue.body.some((row) => row.id === applicationId && row.status === 'pending')).toBe(true)

    // Pending outcome via AGT-REC-004 deep-link GET (#90)
    const pendingRes = await fetchApplicationOutcome(app, {
      applicationId,
      token: applicant.token,
    })
    expect(pendingRes.status).toBe(200)
    expect(pendingRes.body.application).toMatchObject({
      id: applicationId,
      status: 'pending',
    })
    expect(pendingRes.body.agency.slug).toBe(agency.slug)

    // Approve
    const approved = await request(app)
      .post(`/api/agencies/${agency.agencyId}/applications/${applicationId}/approve`)
      .set('Authorization', `Bearer ${agency.token}`)
      .send({ role: 'member', affiliation_mode: 'non_exclusive' })
    expect(approved.status).toBe(200)
    expect(approved.body.success).toBe(true)

    // Outcome after approve
    const outcomeRes = await fetchApplicationOutcome(app, {
      applicationId,
      token: applicant.token,
    })
    expect(outcomeRes.status).toBe(200)
    expect(outcomeRes.body.application).toMatchObject({
      id: applicationId,
      status: 'approved',
    })
    expect(outcomeRes.body.decision.role_offered).toBe('member')
    expect(outcomeRes.body.decision.affiliation_mode).toBe('non_exclusive')
    expect(outcomeRes.body.agency.display_name).toBe(agency.name)

    // Cross-user isolation: stranger gets 404 (not 403) on another user's application
    const stranger = await registerJoinAgencyApplicant('Stranger')
    const strangerRes = await fetchApplicationOutcome(app, {
      applicationId,
      token: stranger.token,
    })
    expect(strangerRes.status).toBe(404)

    // Notification hook (#86) — in-app row with AGT-REC-004 deep-link
    const notes = await resolvedNotificationsFor(applicant.userId, applicationId)
    expect(notes.length).toBeGreaterThanOrEqual(1)
    expect(notes[0].title).toMatch(/accepted your application/i)
    expect(notes[0].metadata).toMatchObject({
      event: 'agency_application.resolved',
      variant: 'approved',
      alert_type: 'agency_application.resolved.approved',
      web_path: `/applications/${applicationId}`,
      deep_link_url: `wingcaster://applications/${applicationId}`,
      application_id: applicationId,
    })
  })

  it('rejection path: apply → reject → outcome REJECTED + notify', async () => {
    const agency = await ownerAgency({ name: 'Reject Loop Co', slug: 'reject-loop-co' })
    const applicant = await registerJoinAgencyApplicant('RejectApplicant')
    const app = buildApp()

    const applied = await request(app)
      .post(`/api/agencies/${agency.slug}/applications`)
      .set('Authorization', `Bearer ${applicant.token}`)
      .send({ ...APPLY_BODY, message: 'Please consider my rejection-path application.' })
    expect(applied.status).toBe(201)
    const applicationId = applied.body.application.id

    const rejected = await request(app)
      .post(`/api/agencies/${agency.agencyId}/applications/${applicationId}/reject`)
      .set('Authorization', `Bearer ${agency.token}`)
    expect(rejected.status).toBe(200)

    const outcomeRes = await fetchApplicationOutcome(app, {
      applicationId,
      token: applicant.token,
    })
    expect(outcomeRes.status).toBe(200)
    expect(outcomeRes.body.application.status).toBe('rejected')
    expect(outcomeRes.body.application.rejected_by).toBe('agency')

    const notes = await resolvedNotificationsFor(applicant.userId, applicationId)
    expect(notes.length).toBeGreaterThanOrEqual(1)
    expect(notes[0].title).toMatch(/responded to your application/i)
    expect(notes[0].metadata).toMatchObject({
      event: 'agency_application.resolved',
      variant: 'rejected',
      web_path: `/applications/${applicationId}`,
    })
  })

  it('EXPIRED state via clock-mock (BE-BLOCKER-09) + notify', async () => {
    const agency = await ownerAgency({ name: 'Expire Loop Co', slug: 'expire-loop-co' })
    const applicant = await registerJoinAgencyApplicant('ExpireApplicant')
    const app = buildApp()

    const applied = await request(app)
      .post(`/api/agencies/${agency.slug}/applications`)
      .set('Authorization', `Bearer ${applicant.token}`)
      .send({ ...APPLY_BODY, message: 'Will expire via clock-mock.' })
    expect(applied.status).toBe(201)
    const applicationId = applied.body.application.id

    // Clock-mock: force expires_at into the past, then run the expiry tick.
    const now = new Date('2026-09-09T12:00:00.000Z')
    await pool().query(
      `UPDATE public.agency_applications
          SET expires_at = $2::timestamptz,
              updated_at = $2::timestamptz
        WHERE id = $1`,
      [applicationId, '2026-08-01T00:00:00.000Z'],
    )

    const tick = await runAgencyApplicationExpiryTick({ now })
    expect(tick.expired).toBeGreaterThanOrEqual(1)

    const row = await pool().query(
      `SELECT status FROM public.agency_applications WHERE id = $1`,
      [applicationId],
    )
    expect(row.rows[0].status).toBe('expired')

    const outcomeRes = await fetchApplicationOutcome(app, {
      applicationId,
      token: applicant.token,
    })
    expect(outcomeRes.status).toBe(200)
    expect(outcomeRes.body.application.status).toBe('expired')

    const notes = await resolvedNotificationsFor(applicant.userId, applicationId)
    expect(notes.length).toBeGreaterThanOrEqual(1)
    expect(notes[0].title).toMatch(/timed out/i)
    expect(notes[0].metadata).toMatchObject({
      event: 'agency_application.resolved',
      variant: 'expired',
      alert_type: 'agency_application.resolved.expired',
      web_path: `/applications/${applicationId}`,
    })
  })

  it('invitation-code path (/join/:code): resolve → accept → approve → outcome', async () => {
    const agency = await ownerAgency({ name: 'Invite Loop Co', slug: 'invite-loop-co' })
    const app = buildApp()

    const created = await request(app)
      .post(`/api/agencies/${agency.agencyId}/invitations`)
      .set('Authorization', `Bearer ${agency.token}`)
      .send({ expires_in_days: 7, single_use: true })
    expect(created.status).toBe(201)
    const code = created.body.code
    expect(code).toBeTruthy()

    // Public resolve (AGN-MEM-005 /join/:code)
    const resolved = await request(app).get(`/api/invitations/${code}`)
    expect(resolved.status).toBe(200)
    expect(resolved.body.status).toBe('valid')
    expect(resolved.body.agency).toMatchObject({
      id: agency.agencyId,
      slug: agency.slug,
      name: agency.name,
    })

    const applicant = await registerJoinAgencyApplicant('InviteApplicant')
    const accept = await request(app)
      .post(`/api/invitations/${code}/accept`)
      .set('Authorization', `Bearer ${applicant.token}`)
      .send({
        message: 'Joining via invitation code path.',
        current_listings_count: 2,
        portfolio_url: 'https://example.com/invite-portfolio',
        availability: 'full-time',
      })
    expect(accept.status).toBe(201)
    const applicationId = accept.body.application.id
    expect(accept.body.application).toMatchObject({
      agency_id: agency.agencyId,
      applicant_user_id: applicant.userId,
      invitation_code: code,
      referral_source: 'direct_invitation',
      status: 'pending',
    })

    const approved = await request(app)
      .post(`/api/agencies/${agency.agencyId}/applications/${applicationId}/approve`)
      .set('Authorization', `Bearer ${agency.token}`)
      .send({ role: 'member', affiliation_mode: 'non_exclusive' })
    expect(approved.status).toBe(200)

    const outcomeRes = await fetchApplicationOutcome(app, {
      applicationId,
      token: applicant.token,
    })
    expect(outcomeRes.status).toBe(200)
    expect(outcomeRes.body.application.status).toBe('approved')
    expect(outcomeRes.body.agency.slug).toBe(agency.slug)

    const notes = await resolvedNotificationsFor(applicant.userId, applicationId)
    expect(notes.some((n) => n.metadata?.variant === 'approved')).toBe(true)
  })

  it('slug-search public apply path discovers agency then completes loop', async () => {
    const agency = await ownerAgency({
      name: 'Palm Search Realty WF02',
      slug: 'palm-search-realty-wf02',
    })
    // Ensure accepting flag is on (BE-08)
    await update(
      'agencies',
      (a) => a.id === agency.agencyId,
      (a) => ({ ...a, accepting_applications: true }),
    )

    const applicant = await registerJoinAgencyApplicant('SearchApplicant')
    const app = buildApp()

    const search = await request(app).get('/api/agencies/search?q=Palm%20Search')
    expect(search.status).toBe(200)
    const hit = search.body.find((row) => row.id === agency.agencyId)
    expect(hit).toBeTruthy()
    expect(hit.slug).toBe(agency.slug)
    expect(hit.accepting_applications).toBe(true)

    const bySlug = await findAgencyBySlugOrId(hit.slug)
    expect(bySlug?.id).toBe(agency.agencyId)

    const applied = await request(app)
      .post(`/api/agencies/${hit.slug}/applications`)
      .set('Authorization', `Bearer ${applicant.token}`)
      .send({
        ...APPLY_BODY,
        message: 'Found you via slug search / public apply.',
        referral_source: 'agency_directory',
      })
    expect(applied.status).toBe(201)
    expect(applied.body.redirect_to).toMatch(/^\/applications\//)

    const applicationId = applied.body.application.id
    const stored = await findOne('agency_applications', (row) => row.id === applicationId)
    expect(stored.referral_source).toBe('agency_directory')
    expect(stored.agency_id).toBe(agency.agencyId)

    // Close the loop quickly — approve and assert outcome fields
    await request(app)
      .post(`/api/agencies/${agency.agencyId}/applications/${applicationId}/approve`)
      .set('Authorization', `Bearer ${agency.token}`)
      .send({ role: 'member', affiliation_mode: 'exclusive' })

    const outcomeRes = await fetchApplicationOutcome(app, {
      applicationId,
      token: applicant.token,
    })
    expect(outcomeRes.status).toBe(200)
    expect(outcomeRes.body.application.status).toBe('approved')
    expect(outcomeRes.body.decision.affiliation_mode).toBe('exclusive')
    expect(applied.body.redirect_to).toBe(`/applications/${applicationId}`)
  })
})
