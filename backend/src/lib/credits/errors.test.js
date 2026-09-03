import { describe, expect, it } from 'vitest'
import { CREDIT_ERROR, CreditEngineError, creditErrorHttpStatus, sendCreditError } from './errors.js'

describe('credit errors', () => {
  it('creditErrorHttpStatus returns 409 for CREDIT_GRANT_APPROVAL_REQUIRED', () => {
    const err = new CreditEngineError(CREDIT_ERROR.CREDIT_GRANT_APPROVAL_REQUIRED, 'Approval required')
    expect(creditErrorHttpStatus(err)).toBe(409)
  })

  it('sendCreditError maps CreditEngineError and hides internal error text', () => {
    const res = {
      statusCode: null,
      body: null,
      status(code) {
        this.statusCode = code
        return this
      },
      json(payload) {
        this.body = payload
        return this
      },
    }

    sendCreditError(res, new CreditEngineError(CREDIT_ERROR.INSUFFICIENT_CREDITS, 'Not enough credits'))
    expect(res.statusCode).toBe(402)
    expect(res.body).toMatchObject({ code: CREDIT_ERROR.INSUFFICIENT_CREDITS })

    sendCreditError(res, Object.assign(new Error('relation "secret_table" does not exist'), { code: '42P01' }))
    expect(res.statusCode).toBe(500)
    expect(res.body).toEqual({ error: 'Internal server error', code: 'INTERNAL_ERROR' })
    expect(JSON.stringify(res.body)).not.toContain('secret_table')
  })

  it('routes.js and admin-routes.js catch blocks delegate to sendCreditError', async () => {
    const fs = await import('node:fs/promises')
    for (const file of ['./routes.js', './admin-routes.js']) {
      const src = await fs.readFile(new URL(file, import.meta.url), 'utf8')
      expect(src, file).toContain('sendCreditError')
      expect(src, file).not.toMatch(/res\.status\(500\)\.json\(\{ error: err\.message \}\)/)
    }
  })
})
