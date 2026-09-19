import { beforeEach, describe, expect, it, vi } from 'vitest'

const db = vi.hoisted(() => ({
  findOne: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
}))

vi.mock('../../db.js', () => db)

let ensureAgencySiteConfig
let updateAgencySiteCopyFields
let publishAgencySiteConfig

beforeEach(async () => {
  vi.resetModules()
  db.findOne.mockReset()
  db.insert.mockReset()
  db.update.mockReset()

  db.findOne.mockResolvedValue(null)
  db.insert.mockResolvedValue(undefined)
  db.update.mockResolvedValue(undefined)

  ;({
    ensureAgencySiteConfig,
    updateAgencySiteCopyFields,
    publishAgencySiteConfig,
  } = await import('./agency-site-config.js'))
})

describe('agency site config', () => {
  it('creates a default config when missing', async () => {
    db.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce({
      id: 'cfg_1',
      agency_id: 'agc_1',
      copy_fields: { header: { tagline: '' } },
      ssl_status: 'none',
      created_at: '2026-09-01T00:00:00Z',
      updated_at: '2026-09-01T00:00:00Z',
    })

    const config = await ensureAgencySiteConfig('agc_1')
    expect(db.insert).toHaveBeenCalled()
    expect(config.agency_id).toBe('agc_1')
  })

  it('updates copy fields', async () => {
    db.findOne
      .mockResolvedValueOnce({
        id: 'cfg_1',
        agency_id: 'agc_1',
        copy_fields: {},
        ssl_status: 'none',
        created_at: '2026-09-01T00:00:00Z',
        updated_at: '2026-09-01T00:00:00Z',
      })
      .mockResolvedValueOnce({
        id: 'cfg_1',
        agency_id: 'agc_1',
        copy_fields: { about: { paragraph: 'We help buyers find homes.' } },
        ssl_status: 'none',
        created_at: '2026-09-01T00:00:00Z',
        updated_at: '2026-09-02T00:00:00Z',
      })

    const config = await updateAgencySiteCopyFields('agc_1', {
      about: { paragraph: 'We help buyers find homes.' },
    })
    expect(db.update).toHaveBeenCalled()
    expect(config.copy_fields.about.paragraph).toBe('We help buyers find homes.')
  })

  it('publishes site config', async () => {
    db.findOne
      .mockResolvedValueOnce({
        id: 'cfg_1',
        agency_id: 'agc_1',
        copy_fields: {},
        ssl_status: 'none',
        created_at: '2026-09-01T00:00:00Z',
        updated_at: '2026-09-01T00:00:00Z',
      })
      .mockResolvedValueOnce({
        id: 'cfg_1',
        agency_id: 'agc_1',
        copy_fields: {},
        ssl_status: 'none',
        published_at: '2026-09-03T00:00:00Z',
        created_at: '2026-09-01T00:00:00Z',
        updated_at: '2026-09-03T00:00:00Z',
      })

    const config = await publishAgencySiteConfig('agc_1')
    expect(config.published_at).toBeTruthy()
  })
})
