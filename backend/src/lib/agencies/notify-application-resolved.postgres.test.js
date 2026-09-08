/**
 * Real-Postgres coverage for Wave 1 WF-02 migration 335:
 * three agency_application.resolved.* seed codes exist after migrate,
 * and emitAgencyApplicationResolved resolves + dispatches.
 */
import { expect, it, vi } from 'vitest'
import { finPostgresSuite } from '../../fin/testing/suite.js'
import {
  emitAgencyApplicationResolved,
  RESOLVED_TEMPLATE_CODES,
} from './notify-application-resolved.js'
import { renderText } from '../../notifications/platform-templates/variables.js'

const RESOLVED_CODES = Object.values(RESOLVED_TEMPLATE_CODES)

finPostgresSuite('335 agency_application.resolved templates', { seed: false }, ({ pool }) => {
  it('seeds three en/is_seed/push rows with AGT-REC-004 copy', async () => {
    const rows = await pool().query(
      `SELECT code, channel, language, is_seed, is_active, subject, text_body, data
         FROM platform_message_templates
        WHERE code = ANY($1::text[])
        ORDER BY code`,
      [RESOLVED_CODES],
    )
    expect(rows.rows.map((r) => r.code)).toEqual([...RESOLVED_CODES].sort())
    for (const row of rows.rows) {
      expect(row.channel).toBe('push')
      expect(row.language).toBe('en')
      expect(row.is_seed).toBe(true)
      expect(row.is_active).toBe(true)
      expect(row.subject).toBeTruthy()
      expect(row.text_body).toBeTruthy()
      expect(String(row.data?.deep_link || '')).toContain('wingcaster://applications/')
      expect(String(row.data?.web_path || '')).toContain('/applications/')
    }
  })

  it('seed copy substitutes agency_name', async () => {
    const { rows } = await pool().query(
      `SELECT code, subject, text_body
         FROM platform_message_templates
        WHERE code = 'agency_application.resolved.approved'
          AND language = 'en'
          AND territory_id IS NULL`,
    )
    const ctx = { agency_name: 'Palm Realty' }
    expect(renderText(rows[0].subject, ctx)).toBe('Palm Realty accepted your application')
    expect(renderText(rows[0].text_body, ctx)).toBe(
      'Welcome. Tap to switch to your new workspace.',
    )
  })

  it('emitAgencyApplicationResolved resolves seeded template and dispatches', async () => {
    const dispatch = vi.fn(async ({ channel }) => ({
      ok: true,
      status: channel === 'in_app' ? 'delivered' : 'sent',
      channel,
    }))
    const result = await emitAgencyApplicationResolved(
      {
        userId: 'usr_pg_test',
        agencyName: 'Palm Realty',
        applicationId: 'app_pg_test',
        newStatus: 'expired',
      },
      { dispatch },
    )
    expect(result.ok).toBe(true)
    expect(result.used_fallback).toBe(false)
    expect(result.template_code).toBe(RESOLVED_TEMPLATE_CODES.expired)
    expect(result.used_template_id).toBeTruthy()
    expect(result.deep_link_url).toBe('wingcaster://applications/app_pg_test')
    expect(dispatch).toHaveBeenCalledTimes(2)
    expect(dispatch.mock.calls[0][0].subject).toBe(
      'Your application to Palm Realty timed out',
    )
  })
})
