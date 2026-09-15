/**
 * Real-Postgres coverage for two-tier AI cost caps.
 */
import { randomUUID } from 'node:crypto'
import express from 'express'
import request from 'supertest'
import { expect, it } from 'vitest'
import { finPostgresSuite } from '../../fin/testing/suite.js'
import { createAgentAccount } from '../../identity.js'
import { signToken } from '../../auth.js'
import { query } from '../../db.js'
import { addAgencyMembership, createAgencyWithOwner } from '../../tenant-authorization.js'
import { registerAgencyAiCapsRoutes } from './ai-caps-routes.js'
import {
  assertAiSuggestionAllowed,
  DEFAULT_DAILY_CAP,
  recordAiSuggestionUsage,
} from '../ai-caps.js'
import { isKnownCollection, resolveTable } from '../../persistence/table-mapper.js'

function buildApp() {
  const app = express()
  app.use(express.json())
  registerAgencyAiCapsRoutes(app)
  return app
}

async function agentAccount(label = 'Agent') {
  const userId = randomUUID()
  const now = new Date().toISOString()
  const email = `ai-cap-${userId.slice(0, 8)}@x.test`
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
  return { userId, token, email, name: label }
}

async function ownerAgency({ name = 'AI Cap Agency' } = {}) {
  const owner = await agentAccount('Owner')
  const agencyId = randomUUID()
  await createAgencyWithOwner({
    agency: {
      id: agencyId,
      name,
      slug: `agency-${agencyId.slice(0, 8)}`,
    },
    ownerUserId: owner.userId,
  })
  return { ...owner, agencyId }
}

finPostgresSuite('agency AI cost caps', { seed: false }, ({ pool }) => {
  it('migration 361 registers ai_usage_daily + agency_ai_settings in table-mapper', async () => {
    expect(isKnownCollection('ai_usage_daily')).toBe(true)
    expect(isKnownCollection('agency_ai_settings')).toBe(true)
    expect(resolveTable('ai_usage_daily').conflictColumns).toEqual(['user_id', 'usage_date'])

    const tables = await pool().query(
      `SELECT table_name
         FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name IN ('ai_usage_daily', 'agency_ai_settings')
        ORDER BY table_name`,
    )
    expect(tables.rows.map((r) => r.table_name)).toEqual([
      'agency_ai_settings',
      'ai_usage_daily',
    ])
  })

  it('GET /api/users/me/ai-usage/today returns default cap for individual agent', async () => {
    const agent = await agentAccount('Solo')
    const res = await request(buildApp())
      .get('/api/users/me/ai-usage/today')
      .set('Authorization', `Bearer ${agent.token}`)

    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({
      used: 0,
      cap: DEFAULT_DAILY_CAP,
    })
    expect(res.body.resets_at).toMatch(/T00:00:00\.000Z$/)
  })

  it('assertAiSuggestionAllowed enforces daily and monthly caps; recordAiSuggestionUsage UPSERTs', async () => {
    const { userId, agencyId } = await ownerAgency({ name: 'Cap Enforce Agency' })
    const member = await agentAccount('Capped Member')
    await addAgencyMembership({
      agencyId,
      userId: member.userId,
      role: 'member',
      affiliationMode: 'exclusive',
      invitedBy: userId,
    })

    await query(
      `INSERT INTO public.agency_ai_settings (agency_id, user_id, daily_cap, monthly_cap, set_by)
       VALUES ($1, $2, 2, 3, $3)`,
      [agencyId, member.userId, userId],
    )

    await recordAiSuggestionUsage({
      userId: member.userId,
      tenantId: `agency:${agencyId}`,
      inputTokens: 10,
      outputTokens: 5,
    })
    await recordAiSuggestionUsage({
      userId: member.userId,
      tenantId: `agency:${agencyId}`,
      inputTokens: 4,
      outputTokens: 2,
    })

    const rows = await query(
      `SELECT suggestions_used, input_tokens, output_tokens
         FROM public.ai_usage_daily
        WHERE user_id = $1`,
      [member.userId],
    )
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      suggestions_used: 2,
      input_tokens: 14,
      output_tokens: 7,
    })

    await expect(
      assertAiSuggestionAllowed(member.userId, { agencyId }),
    ).rejects.toMatchObject({ status: 429, code: 'AI_DAILY_CAP', cap: 2, used: 2 })

    await query(
      `UPDATE public.agency_ai_settings SET daily_cap = 50, monthly_cap = 3 WHERE agency_id = $1 AND user_id = $2`,
      [agencyId, member.userId],
    )
    await recordAiSuggestionUsage({
      userId: member.userId,
      tenantId: `agency:${agencyId}`,
      inputTokens: 1,
      outputTokens: 1,
    })
    await expect(
      assertAiSuggestionAllowed(member.userId, { agencyId }),
    ).rejects.toMatchObject({ status: 429, code: 'AI_MONTHLY_CAP', cap: 3, used: 3 })
  })

  it('GET /api/agency/ai-usage is agency-admin only and returns masked members', async () => {
    const owner = await ownerAgency({ name: 'Usage Dashboard Agency' })
    const member = await agentAccount('Ali Achkar')
    const outsider = await agentAccount('Outsider')
    await addAgencyMembership({
      agencyId: owner.agencyId,
      userId: member.userId,
      role: 'member',
      affiliationMode: 'exclusive',
      invitedBy: owner.userId,
    })

    await query(
      `INSERT INTO public.agency_ai_settings (agency_id, user_id, daily_cap, monthly_cap, set_by)
       VALUES ($1, $2, 120, 1000, $3)`,
      [owner.agencyId, member.userId, owner.userId],
    )
    await recordAiSuggestionUsage({
      userId: member.userId,
      tenantId: `agency:${owner.agencyId}`,
      inputTokens: 3,
      outputTokens: 1,
    })

    const denied = await request(buildApp())
      .get('/api/agency/ai-usage')
      .set('Authorization', `Bearer ${outsider.token}`)
    expect(denied.status).toBe(403)

    const memberDenied = await request(buildApp())
      .get('/api/agency/ai-usage')
      .set('Authorization', `Bearer ${member.token}`)
    expect(memberDenied.status).toBe(403)

    const res = await request(buildApp())
      .get('/api/agency/ai-usage')
      .set('Authorization', `Bearer ${owner.token}`)
    expect(res.status).toBe(200)
    expect(res.body.agency_month_total).toBeGreaterThanOrEqual(1)
    expect(Array.isArray(res.body.top_days)).toBe(true)
    const row = res.body.members.find((m) => m.user_id === member.userId)
    expect(row).toMatchObject({
      user_id: member.userId,
      daily_cap: 120,
      today_used: 1,
      month_used: 1,
      month_cap: 1000,
    })
    expect(row.name_masked).toContain('*')
    expect(row.name_masked).not.toBe('Ali Achkar')
  })

  it('PATCH /api/agency/ai-caps/:userId updates caps and writes ai_cap_change audit', async () => {
    const owner = await ownerAgency({ name: 'Patch Caps Agency' })
    const member = await agentAccount('Patch Target')
    await addAgencyMembership({
      agencyId: owner.agencyId,
      userId: member.userId,
      role: 'member',
      affiliationMode: 'exclusive',
      invitedBy: owner.userId,
    })

    const bad = await request(buildApp())
      .patch(`/api/agency/ai-caps/${member.userId}`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ daily_cap: 5 })
    expect(bad.status).toBe(400)

    const res = await request(buildApp())
      .patch(`/api/agency/ai-caps/${member.userId}`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ daily_cap: 350, monthly_cap: 4000 })
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({
      user_id: member.userId,
      daily_cap: 350,
      monthly_cap: 4000,
    })

    const settings = await query(
      `SELECT daily_cap, monthly_cap, set_by
         FROM public.agency_ai_settings
        WHERE agency_id = $1 AND user_id = $2`,
      [owner.agencyId, member.userId],
    )
    expect(settings[0]).toMatchObject({
      daily_cap: 350,
      monthly_cap: 4000,
      set_by: owner.userId,
    })

    const audits = await query(
      `SELECT type, action, metadata
         FROM public.audit_log
        WHERE type = 'ai_cap_change'
          AND entity_id = $1
        ORDER BY created_at DESC
        LIMIT 1`,
      [`${owner.agencyId}:${member.userId}`],
    )
    expect(audits[0]?.type).toBe('ai_cap_change')
    expect(audits[0]?.action).toBe('update')
    const meta = typeof audits[0].metadata === 'string'
      ? JSON.parse(audits[0].metadata)
      : audits[0].metadata
    expect(meta).toMatchObject({
      target_user_id: member.userId,
      daily_cap: 350,
      monthly_cap: 4000,
    })

    const clearMonthly = await request(buildApp())
      .patch(`/api/agency/ai-caps/${member.userId}`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ daily_cap: 200, monthly_cap: null })
    expect(clearMonthly.status).toBe(200)
    expect(clearMonthly.body.monthly_cap).toBeNull()
  })
})
