import { randomUUID } from 'node:crypto'
import { expect, it, vi } from 'vitest'
import { finPostgresSuite } from '../../fin/testing/suite.js'
import { createAgentAccount } from '../../identity.js'
import { query, transaction } from '../../db.js'
import { hashIdentity, normalizeEmail, normalizePhone, normalizeUsername } from './identity-normalize.js'
import {
  assertFreeTierListingAllowed,
} from './free-trial-claims.js'
import { provisionFreeTier } from '../packages/onboarding.js'
import { FREE_VERSION_ID } from '../packages/test-support.js'

async function signup({ email, phone, username, name } = {}) {
  const id = randomUUID()
  const now = new Date().toISOString()
  const handle = username || `u-${id.slice(0, 8)}`
  await createAgentAccount({
    user: {
      id,
      email,
      phone: phone || null,
      username: handle,
      name: name || handle,
      password_hash: 'x',
      role: 'agent',
      verified: true,
      verified_at: now,
    },
    agent: {
      id,
      email,
      phone: phone || null,
      name: name || handle,
      slug: handle,
    },
  })
  return id
}

finPostgresSuite('free-trial claims', { seed: false }, ({ pool }) => {
  it('creates table and three partial unique indexes', async () => {
    const table = await pool().query(`SELECT to_regclass('public.free_trial_claims') AS t`)
    expect(table.rows[0].t).toBeTruthy()
    const indexes = await pool().query(
      `SELECT indexname FROM pg_indexes WHERE tablename = 'free_trial_claims' ORDER BY indexname`,
    )
    const names = indexes.rows.map((r) => r.indexname)
    expect(names).toEqual(expect.arrayContaining([
      'uq_ftc_email_hash',
      'uq_ftc_phone_hash',
      'uq_ftc_username_hash',
      'idx_ftc_original_user',
    ]))
  })

  it('fresh identity records a claim; same email is blocked', async () => {
    const email = `first-${randomUUID()}@x.test`
    const userId = await signup({
      email,
      phone: `+96171${Math.floor(100000 + Math.random() * 899999)}`,
      username: `user-${randomUUID().slice(0, 8)}`,
    })
    const rows = await query('SELECT original_user_id FROM public.free_trial_claims WHERE original_user_id = $1', [userId])
    expect(rows[0].original_user_id).toBe(userId)

    await expect(signup({
      email,
      phone: `+96170${Math.floor(100000 + Math.random() * 899999)}`,
      username: `other-${randomUUID().slice(0, 8)}`,
    })).rejects.toMatchObject({
      code: 'FREE_TRIAL_ALREADY_CLAIMED',
      blockingDimensions: expect.arrayContaining(['email']),
    })
  })

  it('same email different phone/username is blocked on email', async () => {
    const email = `em-${randomUUID()}@x.test`
    await signup({ email, phone: '+96171111111', username: `a-${randomUUID().slice(0, 8)}` })
    await expect(signup({
      email,
      phone: '+96172222222',
      username: `b-${randomUUID().slice(0, 8)}`,
    })).rejects.toMatchObject({
      code: 'FREE_TRIAL_ALREADY_CLAIMED',
      blockingDimensions: ['email'],
    })
  })

  it('different email same phone is blocked on phone', async () => {
    const phone = `+96181${Math.floor(100000 + Math.random() * 899999)}`
    await signup({ email: `p1-${randomUUID()}@x.test`, phone, username: `p1-${randomUUID().slice(0, 8)}` })
    await expect(signup({
      email: `p2-${randomUUID()}@x.test`,
      phone,
      username: `p2-${randomUUID().slice(0, 8)}`,
    })).rejects.toMatchObject({
      code: 'FREE_TRIAL_ALREADY_CLAIMED',
      blockingDimensions: expect.arrayContaining(['phone']),
    })
  })

  it('different email and username, same phone still blocked', async () => {
    const phone = `+96182${Math.floor(100000 + Math.random() * 899999)}`
    await signup({ email: `q1-${randomUUID()}@x.test`, phone, username: `q1-${randomUUID().slice(0, 8)}` })
    await expect(signup({
      email: `q2-${randomUUID()}@x.test`,
      phone,
      username: `q2-${randomUUID().slice(0, 8)}`,
    })).rejects.toMatchObject({ blockingDimensions: expect.arrayContaining(['phone']) })
  })

  it('all three different identities are allowed', async () => {
    await signup({
      email: `ok1-${randomUUID()}@x.test`,
      phone: `+96183${Math.floor(100000 + Math.random() * 899999)}`,
      username: `ok1-${randomUUID().slice(0, 8)}`,
    })
    await expect(signup({
      email: `ok2-${randomUUID()}@x.test`,
      phone: `+96184${Math.floor(100000 + Math.random() * 899999)}`,
      username: `ok2-${randomUUID().slice(0, 8)}`,
    })).resolves.toBeTruthy()
  })

  it('case variance on email is blocked', async () => {
    const local = `case-${randomUUID().slice(0, 8)}`
    await signup({
      email: `${local}@x.test`,
      phone: `+96185${Math.floor(100000 + Math.random() * 899999)}`,
      username: `c1-${randomUUID().slice(0, 8)}`,
    })
    await expect(signup({
      email: `${local.toUpperCase()}@X.TEST`,
      phone: `+96186${Math.floor(100000 + Math.random() * 899999)}`,
      username: `c2-${randomUUID().slice(0, 8)}`,
    })).rejects.toMatchObject({ blockingDimensions: expect.arrayContaining(['email']) })
  })

  it('case variance on username is blocked', async () => {
    const username = `CaseUser-${randomUUID().slice(0, 6)}`
    await signup({
      email: `u1-${randomUUID()}@x.test`,
      phone: `+96187${Math.floor(100000 + Math.random() * 899999)}`,
      username,
    })
    await expect(signup({
      email: `u2-${randomUUID()}@x.test`,
      phone: `+96188${Math.floor(100000 + Math.random() * 899999)}`,
      username: username.toUpperCase(),
    })).rejects.toMatchObject({ blockingDimensions: expect.arrayContaining(['username']) })
  })

  it('Arabic username fold is blocked', async () => {
    const username = `وكيل-${randomUUID().slice(0, 6)}`
    await signup({
      email: `ar1-${randomUUID()}@x.test`,
      phone: `+96189${Math.floor(100000 + Math.random() * 899999)}`,
      username: `  ${username}  `,
    })
    await expect(signup({
      email: `ar2-${randomUUID()}@x.test`,
      phone: `+96190${Math.floor(100000 + Math.random() * 899999)}`,
      username,
    })).rejects.toMatchObject({ blockingDimensions: expect.arrayContaining(['username']) })
  })

  it('hard-deleted user still blocks the same identity', async () => {
    const email = `del-${randomUUID()}@x.test`
    const phone = `+96191${Math.floor(100000 + Math.random() * 899999)}`
    const username = `del-${randomUUID().slice(0, 8)}`
    const userId = await signup({ email, phone, username })
    await pool().query('DELETE FROM public.users WHERE id = $1', [userId])
    const leftover = await pool().query(
      'SELECT id FROM public.free_trial_claims WHERE original_user_id = $1',
      [userId],
    )
    expect(leftover.rows).toHaveLength(1)
    await expect(signup({ email, phone, username })).rejects.toMatchObject({
      code: 'FREE_TRIAL_ALREADY_CLAIMED',
    })
  })

  it('waived claim allows a new signup', async () => {
    const email = `wave-${randomUUID()}@x.test`
    const phone = `+96192${Math.floor(100000 + Math.random() * 899999)}`
    const username = `wave-${randomUUID().slice(0, 8)}`
    const userId = await signup({ email, phone, username })
    await pool().query(
      `UPDATE public.free_trial_claims
          SET waived_at = NOW(), waived_reason = 'Support ticket #12345: test'
        WHERE original_user_id = $1`,
      [userId],
    )
    await expect(signup({
      email,
      phone,
      username: `${username}-2`,
    })).resolves.toBeTruthy()
  })

  it('concurrent signup race: exactly one succeeds', async () => {
    const phone = `+96193${Math.floor(100000 + Math.random() * 899999)}`
    const results = await Promise.allSettled([
      signup({
        email: `race-a-${randomUUID()}@x.test`,
        phone,
        username: `race-a-${randomUUID().slice(0, 8)}`,
      }),
      signup({
        email: `race-b-${randomUUID()}@x.test`,
        phone,
        username: `race-b-${randomUUID().slice(0, 8)}`,
      }),
    ])
    const ok = results.filter((r) => r.status === 'fulfilled')
    const failed = results.filter((r) => r.status === 'rejected')
    expect(ok).toHaveLength(1)
    expect(failed).toHaveLength(1)
    expect(failed[0].reason).toMatchObject({ code: 'FREE_TRIAL_ALREADY_CLAIMED' })
  })

  it('records a claim row for a fresh identity', async () => {
    const email = `vis-${randomUUID()}@x.test`
    const userId = await signup({
      email,
      phone: `+96171${Math.floor(100000 + Math.random() * 899999)}`,
      username: `vis-${randomUUID().slice(0, 8)}`,
    })
    const rows = await query(
      `SELECT original_email FROM public.free_trial_claims WHERE original_user_id = $1`,
      [userId],
    )
    expect(rows[0].original_email).toBe(email)
  })

  it('first-listing safety net rejects a bypassed signup and logs at error', async () => {
    const { logger } = await import('../logger.js')
    const errorSpy = vi.spyOn(logger, 'error')
    const phone = `+96194${Math.floor(100000 + Math.random() * 899999)}`
    await signup({
      email: `own-${randomUUID()}@x.test`,
      phone,
      username: `own-${randomUUID().slice(0, 8)}`,
    })
    const bypassId = randomUUID()
    const now = new Date().toISOString()
    const bypassEmail = `bypass-${randomUUID()}@x.test`
    const bypassUser = `bypass-${randomUUID().slice(0, 8)}`
    await pool().query(
      `INSERT INTO users (id, email, phone, name, password_hash, role, verified, created_at, updated_at, data)
       VALUES ($1,$2,$3,$4,'x','agent',true,$5::timestamptz,$5::timestamptz,'{}'::jsonb)`,
      [bypassId, bypassEmail, phone, bypassUser, now],
    )
    await transaction(async (client) => {
      await provisionFreeTier(client, { scope: 'personal', scopeId: bypassId, actorId: bypassId, now })
    })
    await expect(assertFreeTierListingAllowed({
      userId: bypassId,
      email: bypassEmail,
      phone,
      username: bypassUser,
    })).rejects.toMatchObject({ code: 'FREE_TRIAL_ALREADY_CLAIMED' })
    expect(errorSpy).toHaveBeenCalled()
    errorSpy.mockRestore()
  })

  it('backfill SQL seeds claims for existing free-tier users without a row', async () => {
    const id = randomUUID()
    const now = new Date().toISOString()
    const email = `bf-${id}@x.test`
    const phone = `+96195${Math.floor(100000 + Math.random() * 899999)}`
    const username = `bf-${id.slice(0, 8)}`
    await pool().query(
      `INSERT INTO users (id, email, phone, name, password_hash, role, verified, created_at, updated_at, data)
       VALUES ($1,$2,$3,$4,'x','agent',true,$5::timestamptz,$5::timestamptz,'{}'::jsonb)`,
      [id, email, phone, username, now],
    )
    await pool().query(
      `INSERT INTO agents (id, user_id, email, phone, name, slug, role, verified, created_at, updated_at, data)
       VALUES ($1,$1,$2,$3,$4,$4,'agent',true,$5::timestamptz,$5::timestamptz,'{}'::jsonb)`,
      [id, email, phone, username, now],
    )
    const tenantId = `personal:${id}`
    await pool().query(
      `INSERT INTO tenants (id, tenant_type, personal_owner_user_id, name, status, settings, created_at, updated_at, data)
       VALUES ($1,'personal',$2,$3,'active','{}'::jsonb,$4::timestamptz,$4::timestamptz,'{}'::jsonb)`,
      [tenantId, id, username, now],
    )
    const { provisionFreeTier } = await import('../packages/onboarding.js')
    await transaction(async (client) => {
      await provisionFreeTier(client, { scope: 'personal', scopeId: id, actorId: id, now })
    })
    const before = await pool().query(
      'SELECT id FROM public.free_trial_claims WHERE original_user_id = $1',
      [id],
    )
    expect(before.rows).toHaveLength(0)

    await pool().query(`
      INSERT INTO public.free_trial_claims (
        id, claimed_at, email_hash, phone_hash, username_hash,
        original_user_id, original_email, original_phone, original_username
      )
      SELECT
        gen_random_uuid()::text,
        NOW(),
        encode(digest(lower(trim(u.email)), 'sha256'), 'hex'),
        encode(digest('+' || regexp_replace(u.phone, '\\D', '', 'g'), 'sha256'), 'hex'),
        encode(digest(lower(btrim(normalize(a.slug, NFKC))), 'sha256'), 'hex'),
        u.id, u.email, u.phone, a.slug
      FROM public.users u
      JOIN public.agents a ON a.user_id = u.id
      JOIN public.credit_wallets w ON w.scope = 'personal' AND w.scope_id = u.id
      JOIN public.tenant_subscriptions s ON s.tenant_id = w.tenant_id
      JOIN public.product_package_versions v ON v.id = s.package_version_id
      JOIN public.product_packages p ON p.id = v.package_id AND p.tier = 'free'
      WHERE u.id = $1
    `, [id])

    const after = await pool().query(
      'SELECT email_hash, phone_hash, username_hash FROM public.free_trial_claims WHERE original_user_id = $1',
      [id],
    )
    expect(after.rows).toHaveLength(1)
    expect(after.rows[0].email_hash).toBe(hashIdentity(normalizeEmail(email)))
    expect(after.rows[0].phone_hash).toBe(hashIdentity(normalizePhone(phone)))
    expect(after.rows[0].username_hash).toBe(hashIdentity(normalizeUsername(username)))
    expect(FREE_VERSION_ID).toBeTruthy()
  })
})
