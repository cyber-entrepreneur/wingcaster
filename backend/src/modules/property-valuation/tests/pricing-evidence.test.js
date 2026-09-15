import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  sanitizeFilename,
  scanEvidenceBuffer,
  uploadPricingEvidenceFile,
  PricingEvidenceError,
  PRICING_EVIDENCE_MAX_BYTES,
} from '../application/pricing-evidence.js'
import { setPricingEvidenceStorageForTests } from '../infrastructure/pricing-evidence-storage.js'

vi.mock('../../../db.js', () => ({
  findOne: vi.fn(),
  findAll: vi.fn(),
  insert: vi.fn(async (_c, row) => row),
  remove: vi.fn(async () => 1),
  query: vi.fn(),
}))

vi.mock('../../../lib/logger.js', () => ({
  default: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}))

const { insert } = await import('../../../db.js')

describe('pricing-evidence', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    const blobs = new Map()
    setPricingEvidenceStorageForTests({
      kind: 'memory',
      async put(key, buffer) {
        blobs.set(key, buffer)
        return { storageKey: key, size: buffer.length }
      },
      async getStream() {
        throw new Error('unused')
      },
      async remove(key) {
        return blobs.delete(key)
      },
      async exists(key) {
        return blobs.has(key)
      },
    })
  })

  it('sanitizes PII-risky filenames', () => {
    expect(sanitizeFilename('../../etc/passwd')).toBe('.._.._etc_passwd')
    expect(sanitizeFilename('invoice 2024.pdf')).toBe('invoice_2024.pdf')
  })

  it('queues pending_scan when clamav is absent', async () => {
    const status = await scanEvidenceBuffer(Buffer.from('hello'))
    expect(status).toBe('pending_scan')
  })

  it('uploads happy-path evidence and returns signed url + sha256', async () => {
    const result = await uploadPricingEvidenceFile({
      agentId: 'agent-1',
      file: {
        buffer: Buffer.from('%PDF-1.4 fake'),
        mimetype: 'application/pdf',
        originalname: 'sale proof.pdf',
        size: 14,
      },
    })
    expect(result.id).toBeTruthy()
    expect(result.url).toContain(`/api/pricing/evidence-uploads/${result.id}`)
    expect(result.url).toContain('token=')
    expect(result.sha256).toMatch(/^[a-f0-9]{64}$/)
    expect(result.content_type).toBe('application/pdf')
    expect(result.scan_status).toBe('pending_scan')
    expect(insert).toHaveBeenCalledWith(
      'pricing_evidence_files',
      expect.objectContaining({ agent_id: 'agent-1', filename: 'sale_proof.pdf' }),
    )
  })

  it('rejects oversized files', async () => {
    const big = Buffer.alloc(PRICING_EVIDENCE_MAX_BYTES + 1, 1)
    await expect(
      uploadPricingEvidenceFile({
        agentId: 'agent-1',
        file: { buffer: big, mimetype: 'image/png', originalname: 'big.png', size: big.length },
      }),
    ).rejects.toBeInstanceOf(PricingEvidenceError)
  })

  it('rejects unsupported content types', async () => {
    await expect(
      uploadPricingEvidenceFile({
        agentId: 'agent-1',
        file: {
          buffer: Buffer.from('x'),
          mimetype: 'text/csv',
          originalname: 'x.csv',
          size: 1,
        },
      }),
    ).rejects.toMatchObject({ code: 'INVALID_TYPE', httpStatus: 415 })
  })
})
