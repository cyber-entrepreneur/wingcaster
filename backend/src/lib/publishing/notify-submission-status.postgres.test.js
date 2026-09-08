/**
 * Real-Postgres coverage for BE-BLOCKER-12 migration 327:
 * channel CHECK includes push, five seed codes exist after migrate.
 */
import { expect, it } from 'vitest'
import { finPostgresSuite } from '../../fin/testing/suite.js'
import { STATUS_TEMPLATE_CODES } from './notify-submission-status.js'
import { renderText } from '../../notifications/platform-templates/variables.js'

const STATUS_CHANGED_CODES = Object.values(STATUS_TEMPLATE_CODES)

finPostgresSuite('327 portal_submission.status_changed templates', { seed: false }, ({ pool }) => {
  it('channel CHECK allows push and seeds five en/is_seed rows', async () => {
    const constraint = await pool().query(
      `SELECT pg_get_constraintdef(c.oid) AS def
         FROM pg_constraint c
        WHERE c.conname = 'platform_msg_templates_channel_check'
          AND c.conrelid = 'public.platform_message_templates'::regclass`,
    )
    expect(constraint.rows[0]?.def || '').toMatch(/push/)

    const rows = await pool().query(
      `SELECT code, channel, language, is_seed, is_active, subject, text_body
         FROM platform_message_templates
        WHERE code = ANY($1::text[])
        ORDER BY code`,
      [STATUS_CHANGED_CODES],
    )
    expect(rows.rows.map((r) => r.code)).toEqual([...STATUS_CHANGED_CODES].sort())
    for (const row of rows.rows) {
      expect(row.channel).toBe('push')
      expect(row.language).toBe('en')
      expect(row.is_seed).toBe(true)
      expect(row.is_active).toBe(true)
      expect(row.subject).toBeTruthy()
      expect(row.text_body).toBeTruthy()
    }
  })

  it('seed copy substitutes AGT-PUB-006 variables', async () => {
    const { rows } = await pool().query(
      `SELECT code, subject, text_body
         FROM platform_message_templates
        WHERE code = 'portal_submission.status_changed.live'
          AND language = 'en'
          AND territory_id IS NULL`,
    )
    const ctx = { portal_name: 'Bayut', listing_address: 'Marina Gate' }
    expect(renderText(rows[0].subject, ctx)).toBe('Bayut accepted your listing')
    expect(renderText(rows[0].text_body, ctx)).toBe('Marina Gate is now live on Bayut.')
  })
})
