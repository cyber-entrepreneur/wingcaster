/**
 * Fast gates only. Real-Postgres coverage is in routes-vendors.postgres.test.js.
 */
import { describe, expect, it } from 'vitest'
import { registerFinVendorAdminRoutes } from './vendors/routes.js'

describe('admin/routes-vendors', () => {
  it('registerFinVendorAdminRoutes is wired (Stage-11 stub removed)', () => {
    expect(typeof registerFinVendorAdminRoutes).toBe('function')
  })
})
