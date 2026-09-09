/**
 * Real-Postgres coverage for BE-ACR-04 / BE-ACR-05:
 * account_value_tier derivation + X-Wingcaster-Env case scoping.
 */
import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import request from 'supertest'
import { beforeAll, describe, expect, it } from 'vitest'
import { finPostgresSuite } from './fin/testing/suite.js'
import { createAgentAccount, updatePlatformRole, updateUser } from './identity.js'
import { signToken } from './auth.js'
import { createAgencyWithOwner } from './tenant-authorization.js'
import { findOne, insert, query } from './db.js'
import {
  ACCOUNT_VALUE_TIERS,
  classifyAccountValueTier,
  classifyPlanTier,
  deriveAccountValueTier,
  requiresTwoPersonForTier,
} from './account-recovery/account-value-tier.js'
import { seedPublishedPackage } from './lib/packages/test-support.js'

const migrationsDir = join(dirname(fileURLToPath(import.meta.url)), 'persistence/migrations')

async function agentAccount(label = 'Agent', { platformAdmin = false, paDesignate = false } = {}) {
  const userId = randomUUID()
  const now = new Date().toISOString()
  const email = `${label.toLowerCase().replace(/\s+/g, '-')}-${userId}@x.test`
  await createAgentAccount({
    user: {
      id: userId,
      email,
      name: label,
      password_hash: 'x',
      role: 'agent',
      verified: true,
      verified_at: now,
      ...(paDesignate ? { pa_designate: true } : {}),
    },
    agent: { id: userId, email, name: label },
  })
  let tokenVersion = 0
  if (platformAdmin) {
    await updatePlatformRole(userId, 'platform_admin')
    tokenVersion = 1
  }
  if (paDesignate) {
    await updateUser(userId, { pa_designate: true })
  }
  const token = signToken({
    id: userId,
    email,
    name: label,
    token_version: tokenVersion,
    verified_at: now,
  })
  return { userId, token, email }
}

async function openRecoveryCase({
  userId,
  email,
  status = 'pending_review',
  environment = 'LIVE',
} = {}) {
  const id = randomUUID()
  await insert('account_recovery_cases', {
    id,
    user_id: userId,
    email,
    status,
    environment,
    reason: 'lost access to email inbox permanently',
    preferred_channel: 'email',
    contact: email,
    created_at: new Date().toISOString(),
  })
  return id
}

async function setAgencyPlanTier(pool, agencyId, { tier, displayName }) {
  const client = await pool.connect()
  try {
    const seeded = await seedPublishedPackage(client, {
      code: `${tier}-${randomUUID().slice(0, 8)}`,
      displayName,
      tier,
      audience: 'agency',
      monthlyPriceMinor: tier === 'enterprise' ? 99_000 : 29_000,
    })
    const wallet = await client.query(
      `SELECT tenant_id FROM public.credit_wallets
        WHERE scope = 'agency' AND scope_id = $1
        LIMIT 1`,
      [agencyId],
    )
    const tenantId = wallet.rows[0]?.tenant_id
    expect(tenantId).toBeTruthy()
    await client.query(
      `UPDATE public.tenant_subscriptions
          SET package_version_id = $2,
              updated_at = NOW()
        WHERE tenant_id = $1
          AND status = ANY($3::text[])`,
      [tenantId, seeded.versionId, ['PENDING_START', 'ACTIVE', 'PAUSED', 'CANCELED_AT_PERIOD_END']],
    )
    return seeded
  } finally {
    client.release()
  }
}

describe('account-value-tier pure helpers (BE-ACR-04)', () => {
  it('maps plan names to classification buckets', () => {
    expect(classifyPlanTier('enterprise')).toBe('enterprise')
    expect(classifyPlanTier('WingCaster Enterprise+')).toBe('enterprise')
    expect(classifyPlanTier('pro')).toBe('broker')
    expect(classifyPlanTier('Broker')).toBe('broker')
    expect(classifyPlanTier('growth')).toBe('broker')
    expect(classifyPlanTier('free')).toBe('standard')
    expect(classifyPlanTier('Semsar')).toBe('standard')
  })

  it('classifies PA / enterprise / outstanding as high_value with two-person', () => {
    expect(classifyAccountValueTier({ is_platform_admin: true })).toEqual({
      tier: ACCOUNT_VALUE_TIERS.HIGH_VALUE,
      requires_two_person: true,
    })
    expect(classifyAccountValueTier({
      is_agency_owner: true,
      agency_plan_classes: ['enterprise'],
    })).toEqual({
      tier: ACCOUNT_VALUE_TIERS.HIGH_VALUE,
      requires_two_person: true,
    })
    expect(classifyAccountValueTier({
      is_agency_owner: true,
      agency_plan_classes: ['broker'],
      credit_outstanding_minor: 500_000,
      credit_outstanding_threshold_minor: 500_000,
    })).toEqual({
      tier: ACCOUNT_VALUE_TIERS.HIGH_VALUE,
      requires_two_person: true,
    })
    expect(requiresTwoPersonForTier(ACCOUNT_VALUE_TIERS.HIGH_VALUE)).toBe(true)
  })

  it('classifies broker owner and PA-designate as elevated', () => {
    expect(classifyAccountValueTier({
      is_agency_owner: true,
      agency_plan_classes: ['broker'],
    })).toEqual({
      tier: ACCOUNT_VALUE_TIERS.ELEVATED,
      requires_two_person: false,
    })
    expect(classifyAccountValueTier({ is_pa_designate: true })).toEqual({
      tier: ACCOUNT_VALUE_TIERS.ELEVATED,
      requires_two_person: false,
    })
  })

  it('defaults to standard otherwise', () => {
    expect(classifyAccountValueTier({})).toEqual({
      tier: ACCOUNT_VALUE_TIERS.STANDARD,
      requires_two_person: false,
    })
    expect(classifyAccountValueTier({
      is_agency_owner: true,
      agency_plan_classes: ['standard'],
    })).toEqual({
      tier: ACCOUNT_VALUE_TIERS.STANDARD,
      requires_two_person: false,
    })
  })

  it('fails closed to high_value for uncertain agency owners', () => {
    expect(classifyAccountValueTier({
      is_agency_owner: true,
      uncertain_agency_owner: true,
      agency_plan_classes: [],
    })).toEqual({
      tier: ACCOUNT_VALUE_TIERS.HIGH_VALUE,
      requires_two_person: true,
    })
  })
})

finPostgresSuite('account-recovery tier + env (BE-ACR-04/05)', { seed: false }, ({ pool }) => {
  let app

  beforeAll(async () => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'be-acr-tier-env-test-secret'
    process.env.NODE_ENV = 'test'
    ;({ app } = await import('./server.js'))
  })

  it('migration 332 is idempotent and adds environment column', async () => {
    const sql = await readFile(join(migrationsDir, '332_account_recovery_environment.sql'), 'utf8')
    await pool().query(sql)
    await pool().query(sql)
    const cols = await pool().query(
      `SELECT column_name, column_default, is_nullable
         FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'account_recovery_cases'
          AND column_name = 'environment'`,
    )
    expect(cols.rows).toHaveLength(1)
    expect(cols.rows[0].is_nullable).toBe('NO')
    expect(String(cols.rows[0].column_default || '')).toMatch(/LIVE/)
  })

  it('deriveAccountValueTier: standard agent is standard', async () => {
    const target = await agentAccount('Standard Tier Applicant')
    const info = await deriveAccountValueTier(target.userId)
    expect(info.tier).toBe('standard')
    expect(info.requires_two_person).toBe(false)
  })

  it('deriveAccountValueTier: platform admin is high_value', async () => {
    const target = await agentAccount('PA Tier Applicant', { platformAdmin: true })
    const info = await deriveAccountValueTier(target.userId)
    expect(info.tier).toBe('high_value')
    expect(info.requires_two_person).toBe(true)
    expect(info.signals.is_platform_admin).toBe(true)
  })

  it('deriveAccountValueTier: PA-designate is elevated', async () => {
    const target = await agentAccount('Designate Tier Applicant', { paDesignate: true })
    const info = await deriveAccountValueTier(target.userId)
    expect(info.tier).toBe('elevated')
    expect(info.requires_two_person).toBe(false)
    expect(info.signals.is_pa_designate).toBe(true)
  })

  it('deriveAccountValueTier: enterprise agency owner is high_value', async () => {
    const owner = await agentAccount('Enterprise Owner')
    const agencyId = randomUUID()
    await createAgencyWithOwner({
      agency: { id: agencyId, name: 'Ent Co', slug: `ent-${agencyId.slice(0, 8)}` },
      ownerUserId: owner.userId,
    })
    await setAgencyPlanTier(pool(), agencyId, {
      tier: 'enterprise',
      displayName: 'Enterprise',
    })
    const info = await deriveAccountValueTier(owner.userId)
    expect(info.tier).toBe('high_value')
    expect(info.requires_two_person).toBe(true)
    expect(info.signals.is_agency_owner).toBe(true)
    expect(info.signals.agency_plan_classes).toContain('enterprise')
  })

  it('deriveAccountValueTier: broker/pro agency owner is elevated', async () => {
    const owner = await agentAccount('Broker Owner')
    const agencyId = randomUUID()
    await createAgencyWithOwner({
      agency: { id: agencyId, name: 'Broker Co', slug: `brk-${agencyId.slice(0, 8)}` },
      ownerUserId: owner.userId,
    })
    await setAgencyPlanTier(pool(), agencyId, {
      tier: 'pro',
      displayName: 'Broker',
    })
    const info = await deriveAccountValueTier(owner.userId)
    expect(info.tier).toBe('elevated')
    expect(info.requires_two_person).toBe(false)
    expect(info.signals.agency_plan_classes).toContain('broker')
  })

  it('cast-vote still requires two-person for high_value applicants', async () => {
    const pa1 = await agentAccount('PA Tier Vote1', { platformAdmin: true })
    const pa2 = await agentAccount('PA Tier Vote2', { platformAdmin: true })
    const target = await agentAccount('High Value Vote Target', { platformAdmin: true })
    const caseId = await openRecoveryCase(target)

    const first = await request(app)
      .post(`/api/admin/account-recovery/${caseId}/cast-vote`)
      .set('Authorization', `Bearer ${pa1.token}`)
      .set('X-Wingcaster-Env', 'live')
      .send({ vote: 'approve' })

    expect(first.status, JSON.stringify(first.body)).toBe(200)
    expect(first.body.requires_two_person).toBe(true)
    expect(first.body.awaiting_second_vote).toBe(true)
    expect(first.body.account_value_tier).toBe('high_value')

    const second = await request(app)
      .post(`/api/admin/account-recovery/${caseId}/cast-vote`)
      .set('Authorization', `Bearer ${pa2.token}`)
      .set('X-Wingcaster-Env', 'LIVE')
      .send({ vote: 'approve' })

    expect(second.status, JSON.stringify(second.body)).toBe(200)
    expect(second.body.status).toBe('approved')
  })

  it('env filter isolates LIVE vs TEST on list and cast-vote', async () => {
    const paLive = await agentAccount('PA Live Env', { platformAdmin: true })
    const paTest = await agentAccount('PA Test Env', { platformAdmin: true })
    // Attach session env via signToken payload isn't enough — auth loads user from DB.
    // Routes resolve header when session env absent, so set header only is fine.
    // For session-authoritative mismatch coverage we set fin_environment on the user record.
    await updateUser(paLive.userId, { fin_environment: 'LIVE' })
    await updateUser(paTest.userId, { fin_environment: 'TEST' })

    const liveTarget = await agentAccount('Live Case Target')
    const testTarget = await agentAccount('Test Case Target')
    const liveCaseId = await openRecoveryCase({ ...liveTarget, environment: 'LIVE' })
    const testCaseId = await openRecoveryCase({ ...testTarget, environment: 'TEST' })

    const liveList = await request(app)
      .get('/api/admin/account-recovery')
      .set('Authorization', `Bearer ${paLive.token}`)
      .set('X-Wingcaster-Env', 'live')
    expect(liveList.status).toBe(200)
    const liveIds = liveList.body.map((c) => c.id)
    expect(liveIds).toContain(liveCaseId)
    expect(liveIds).not.toContain(testCaseId)

    const testList = await request(app)
      .get('/api/admin/account-recovery')
      .set('Authorization', `Bearer ${paTest.token}`)
      .set('X-Wingcaster-Env', 'test')
    expect(testList.status).toBe(200)
    const testIds = testList.body.map((c) => c.id)
    expect(testIds).toContain(testCaseId)
    expect(testIds).not.toContain(liveCaseId)

    // Cross-env cast-vote → 404 (existence leak prevention).
    const cross = await request(app)
      .post(`/api/admin/account-recovery/${testCaseId}/cast-vote`)
      .set('Authorization', `Bearer ${paLive.token}`)
      .set('X-Wingcaster-Env', 'live')
      .send({ vote: 'approve' })
    expect(cross.status).toBe(404)
    expect(cross.body.code).toBe('NOT_FOUND')

    const sameEnv = await request(app)
      .post(`/api/admin/account-recovery/${testCaseId}/cast-vote`)
      .set('Authorization', `Bearer ${paTest.token}`)
      .set('X-Wingcaster-Env', 'test')
      .send({ vote: 'approve' })
    expect(sameEnv.status, JSON.stringify(sameEnv.body)).toBe(200)
    expect(sameEnv.body.status).toBe('approved')
  })

  it('POST /api/auth/recovery/request persists environment from header', async () => {
    const target = await agentAccount('Intake Env Target')
    const res = await request(app)
      .post('/api/auth/recovery/request')
      .set('X-Wingcaster-Env', 'TEST')
      .send({
        email: target.email,
        reason: 'lost phone permanently and cannot receive OTP codes anymore',
        preferred_channel: 'email',
        contact: target.email,
      })
    expect(res.status).toBe(200)
    expect(res.body._dev_case_id).toBeTruthy()
    expect(res.body._dev_environment).toBe('TEST')

    const row = await findOne('account_recovery_cases', (c) => c.id === res.body._dev_case_id)
    expect(row.environment).toBe('TEST')
    expect(row.account_value_tier).toBeTruthy()
    expect(typeof row.requires_two_person).toBe('boolean')
  })

  it('header/session mismatch uses session env for list filtering', async () => {
    const pa = await agentAccount('PA Mismatch Env', { platformAdmin: true })
    await updateUser(pa.userId, { fin_environment: 'LIVE' })
    const liveTarget = await agentAccount('Mismatch Live Target')
    const testTarget = await agentAccount('Mismatch Test Target')
    const liveCaseId = await openRecoveryCase({ ...liveTarget, environment: 'LIVE' })
    const testCaseId = await openRecoveryCase({ ...testTarget, environment: 'TEST' })

    const res = await request(app)
      .get('/api/admin/account-recovery')
      .set('Authorization', `Bearer ${pa.token}`)
      .set('X-Wingcaster-Env', 'test') // spoofed — session LIVE wins
    expect(res.status).toBe(200)
    const ids = res.body.map((c) => c.id)
    expect(ids).toContain(liveCaseId)
    expect(ids).not.toContain(testCaseId)
  })
})
