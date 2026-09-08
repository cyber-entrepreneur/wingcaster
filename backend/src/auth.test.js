import { randomUUID } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import request from 'supertest'
import { closeDb, configure, findOne, query } from './db.js'
import { skipIfNoPostgres, withTestDb } from './testing/postgres.js'
import { creditTenantIdForScope } from './lib/credits/tenant-context.js'
import { FREE_AGENCY_VERSION_ID } from './lib/packages/test-support.js'

const otpTransport = vi.hoisted(() => ({ sendOtp: vi.fn() }))
vi.mock('./lib/otp.js', () => otpTransport)

describe('auth bootstrap', () => {
  const originalSecret = process.env.JWT_SECRET

  beforeEach(() => {
    delete process.env.JWT_SECRET
    vi.resetModules()
  })

  afterEach(() => {
    if (originalSecret === undefined) {
      delete process.env.JWT_SECRET
    } else {
      process.env.JWT_SECRET = originalSecret
    }
    vi.resetModules()
  })

  it('uses a development fallback secret when JWT_SECRET is missing', async () => {
    const { signToken, verifyToken } = await import('./auth.js')
    const token = signToken({ id: 'agent-1' })
    const payload = verifyToken(token)

    expect(payload).toMatchObject({ id: 'agent-1' })
  })
})

skipIfNoPostgres()('registration verification boundary', () => {
  it('prevents registration takeover and enforces the OTP lifecycle', async () => {
    await withTestDb(async (databaseUrl) => {
      configure({ databaseUrl, force: true })
      otpTransport.sendOtp.mockReset()
      otpTransport.sendOtp.mockResolvedValue({ delivered: true, simulated: false })
      process.env.ADMIN_EMAIL = 'target-admin@example.test'
      process.env.SMOKE_ADMIN_EMAIL = 'seeded-admin@example.test'

      try {
        // Importing the server runs seedData() → ensureMigrations() →
        // ensureSeedAdmins(), so ADMIN_EMAIL already exists as a platform
        // admin by the time the first request is made.
        const { app } = await import('./server.js')

      // Registration must not be able to claim an existing platform admin's
      // address — that would be the takeover this test is named for.
      const takeover = await request(app).post('/api/auth/register').send({
        name: 'Takeover Attempt',
        email: process.env.ADMIN_EMAIL,
        password: 'secret123',
        otp_verified: true,
      })
      expect(takeover.status).toBe(409)

      // An ordinary registration must not be able to grant itself
      // platform_role or mark itself verified.
      const attackerEmail = `takeover-${randomUUID()}@example.test`
      const registration = await request(app).post('/api/auth/register').send({
        name: 'Takeover Attempt',
        email: attackerEmail,
        password: 'secret123',
        otp_verified: true,
      })

      expect(registration.status).toBe(202)
      expect(registration.body).toMatchObject({ status: 'otp_sent' })
      expect(registration.body.token).toBeUndefined()

      const claimedAgain = await request(app).post('/api/auth/register').send({
        name: 'Takeover Attempt',
        email: attackerEmail,
        password: 'secret123',
      })
      expect(claimedAgain.status).toBe(409)
      expect(claimedAgain.body).toMatchObject({
        error: 'This identity has already claimed the WingCaster free trial',
        code: 'FREE_TRIAL_ALREADY_CLAIMED',
        blocking_dimensions: ['email'],
      })
      const registeredUser = await findOne('users', (user) => user.email === attackerEmail)
      expect(registeredUser).toMatchObject({ verified: false, platform_role: null })

      const unverifiedLogin = await request(app).post('/api/auth/login').send({
        email: attackerEmail,
        password: 'secret123',
      })
      expect(unverifiedLogin.status).toBe(401)
      expect(unverifiedLogin.body).toEqual({ error: 'email_not_verified', otp_id: registration.body.otp_id })

      // The most recent send is the one belonging to registration.body.otp_id.
      const firstCode = otpTransport.sendOtp.mock.calls.at(-1)[0].code
      const wrongOtp = await request(app).post('/api/auth/verify-otp').send({
        otp_id: registration.body.otp_id,
        code: '000000',
      })
      expect(wrongOtp.status).toBe(401)

      const verified = await request(app).post('/api/auth/verify-otp').send({
        otp_id: registration.body.otp_id,
        code: firstCode,
      })
      expect(verified.status).toBe(200)
      const { verifyToken } = await import('./auth.js')
      expect(verifyToken(verified.body.token).verified_at).toBeTruthy()
      expect(await findOne('users', (user) => user.id === registeredUser.id)).toMatchObject({ verified: true })

      const lockedRegistration = await request(app).post('/api/auth/register').send({
        name: 'Locked User',
        email: 'locked@example.test',
        password: 'secret123',
      })
      for (let attempt = 1; attempt <= 5; attempt += 1) {
        const response = await request(app).post('/api/auth/verify-otp').send({
          otp_id: lockedRegistration.body.otp_id,
          code: '000000',
        })
        expect(response.status).toBe(attempt === 5 ? 429 : 401)
      }

      const { ensureSeedAdmins } = await import('./seed.js')
      await ensureSeedAdmins()
      const seededUser = await findOne('users', (user) => user.email === process.env.SMOKE_ADMIN_EMAIL)
        const seededAgent = await findOne('agents', (agent) => agent.user_id === seededUser.id)
        expect(seededUser).toMatchObject({ platform_role: 'platform_admin', verified: true })
        expect(seededAgent).toMatchObject({ platform_role: 'platform_admin', verified: true })

      const agencyEmail = `agency-owner-${randomUUID()}@example.test`
      const agencyName = `Acme Realty ${randomUUID().slice(0, 8)}`
      const agencyRegistration = await request(app).post('/api/auth/register').send({
        name: 'Agency Owner',
        email: agencyEmail,
        password: 'secret123',
        agency_mode: 'new',
        agency_name: agencyName,
        agency_license: 'LIC-319',
      })
      expect(agencyRegistration.status).toBe(202)
      expect(agencyRegistration.body).toMatchObject({ status: 'otp_sent' })

      const agencyOwner = await findOne('users', (row) => row.email === agencyEmail)
      expect(agencyOwner).toBeTruthy()
      const agency = await findOne('agencies', (row) => row.owner_id === agencyOwner.id)
      expect(agency).toMatchObject({ name: agencyName })

      const tenantId = creditTenantIdForScope('agency', agency.id)
      const sub = await query(
        `SELECT s.package_version_id, p.code, p.target_audience
           FROM public.tenant_subscriptions s
           JOIN public.product_package_versions v ON v.id = s.package_version_id
           JOIN public.product_packages p ON p.id = v.package_id
          WHERE s.tenant_id = $1`,
        [tenantId],
      )
      expect(sub[0].package_version_id).toBe(FREE_AGENCY_VERSION_ID)
      expect(sub[0].code).toBe('free-agency')
      expect(sub[0].target_audience).toBe('agency')
      } finally {
        await closeDb()
        delete process.env.ADMIN_EMAIL
        delete process.env.SMOKE_ADMIN_EMAIL
      }
    })
  }, 180_000)
})
