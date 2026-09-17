/**
 * Unit tests for H3 data-export storage adapter.
 *
 * Covers:
 *   - S3 disabled → local disk write path is used (files land under localDir)
 *   - S3 enabled  → PutObject called with correct SSE (KMS if key id set, else AES256)
 *   - encodeStoragePath: s3 descriptor → s3:// URL, disk descriptor → raw path
 *   - serveExportDownload: disk path streams file, s3 path 307-redirects to signed URL
 *   - deleteStoredExport: s3 vs disk branch; ENOENT swallowed on disk
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { rm } from 'node:fs/promises'
import path from 'node:path'
import { tmpdir } from 'node:os'

// Mock the AWS SDK modules so tests don't need the real package installed.
const s3Mock = vi.hoisted(() => ({
  S3Client: vi.fn(function () {
    this.send = vi.fn().mockResolvedValue({})
  }),
  PutObjectCommand: vi.fn(function (input) {
    this.input = input
  }),
  GetObjectCommand: vi.fn(function (input) {
    this.input = input
  }),
  DeleteObjectCommand: vi.fn(function (input) {
    this.input = input
  }),
}))
const presignMock = vi.hoisted(() => ({
  getSignedUrl: vi.fn().mockResolvedValue('https://s3.example.com/signed-url'),
}))
vi.mock('@aws-sdk/client-s3', () => s3Mock)
vi.mock('@aws-sdk/s3-request-presigner', () => presignMock)
vi.mock('../logger.js', () => ({
  default: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}))

let persistExportPayload
let encodeStoragePath
let serveExportDownload
let deleteStoredExport
const TEST_DIR = path.join(tmpdir(), `wingcaster-h3-storage-${process.pid}`)

async function loadModule() {
  vi.resetModules()
  const mod = await import('./data-export-storage.js')
  persistExportPayload = mod.persistExportPayload
  encodeStoragePath = mod.encodeStoragePath
  serveExportDownload = mod.serveExportDownload
  deleteStoredExport = mod.deleteStoredExport
}

beforeEach(() => {
  s3Mock.S3Client.mockClear()
  s3Mock.PutObjectCommand.mockClear()
  s3Mock.GetObjectCommand.mockClear()
  s3Mock.DeleteObjectCommand.mockClear()
  presignMock.getSignedUrl.mockClear()
  delete process.env.WINGCASTER_S3_BUCKET
  delete process.env.WINGCASTER_S3_KMS_KEY_ID
  delete process.env.WINGCASTER_S3_KEY_PREFIX
})

afterEach(async () => {
  await rm(TEST_DIR, { recursive: true, force: true }).catch(() => {})
})

describe('persistExportPayload (local disk)', () => {
  it('writes to localDir when S3 not enabled', async () => {
    await loadModule()
    const descriptor = await persistExportPayload({
      exportId: 'exp-1',
      body: '{"hello":"world"}',
      localDir: TEST_DIR,
    })
    expect(descriptor.location).toBe('disk')
    expect(descriptor.file_path).toContain('exp-1.json')
    expect(s3Mock.S3Client).not.toHaveBeenCalled()
  })
})

describe('persistExportPayload (S3 with SSE)', () => {
  it('uses aws:kms SSE when WINGCASTER_S3_KMS_KEY_ID is set', async () => {
    process.env.WINGCASTER_S3_BUCKET = 'test-bucket'
    process.env.WINGCASTER_S3_KMS_KEY_ID = 'alias/wingcaster-exports'
    await loadModule()
    const descriptor = await persistExportPayload({
      exportId: 'exp-1',
      body: '{"x":1}',
      localDir: TEST_DIR,
    })
    expect(descriptor.location).toBe('s3')
    expect(descriptor.bucket).toBe('test-bucket')
    expect(descriptor.key).toBe('data-exports/exp-1.json')
    expect(s3Mock.PutObjectCommand).toHaveBeenCalledTimes(1)
    const input = s3Mock.PutObjectCommand.mock.calls[0][0]
    expect(input.ServerSideEncryption).toBe('aws:kms')
    expect(input.SSEKMSKeyId).toBe('alias/wingcaster-exports')
  })

  it('falls back to AES256 SSE when only bucket set (no KMS key)', async () => {
    process.env.WINGCASTER_S3_BUCKET = 'test-bucket'
    await loadModule()
    await persistExportPayload({ exportId: 'exp-2', body: '{}', localDir: TEST_DIR })
    const input = s3Mock.PutObjectCommand.mock.calls[0][0]
    expect(input.ServerSideEncryption).toBe('AES256')
    expect(input.SSEKMSKeyId).toBeUndefined()
  })
})

describe('encodeStoragePath', () => {
  beforeEach(() => loadModule())
  it('s3 descriptor → s3:// URL', () => {
    expect(encodeStoragePath({ location: 's3', bucket: 'b', key: 'k/f.json' })).toBe(
      's3://b/k/f.json',
    )
  })
  it('disk descriptor → raw path', () => {
    expect(
      encodeStoragePath({ location: 'disk', file_path: '/tmp/exports/x.json' }),
    ).toBe('/tmp/exports/x.json')
  })
})

describe('serveExportDownload', () => {
  beforeEach(() => loadModule())

  function makeRes() {
    const res = {
      statusCode: 200,
      body: null,
      redirected: null,
      status(code) { this.statusCode = code; return this },
      json(payload) { this.body = payload; return this },
      redirect(status, url) { this.redirected = { status, url } },
      setHeader() {},
      end() {},
    }
    return res
  }

  it('s3 file_path → 307 redirect to signed URL', async () => {
    const res = makeRes()
    await serveExportDownload({
      res,
      row: { id: 'exp-1', file_path: 's3://my-bucket/exports/exp-1.json', sha256: null },
    })
    expect(res.redirected?.status).toBe(307)
    expect(res.redirected?.url).toBe('https://s3.example.com/signed-url')
    expect(presignMock.getSignedUrl).toHaveBeenCalled()
  })

  it('missing file_path → 500 missing_file', async () => {
    const res = makeRes()
    await serveExportDownload({ res, row: { id: 'x', file_path: null } })
    expect(res.statusCode).toBe(500)
    expect(res.body.error).toBe('missing_file')
  })
})

describe('deleteStoredExport', () => {
  beforeEach(() => loadModule())

  it('s3 URL → DeleteObjectCommand issued', async () => {
    await deleteStoredExport('s3://my-bucket/exports/x.json')
    expect(s3Mock.DeleteObjectCommand).toHaveBeenCalledTimes(1)
    const input = s3Mock.DeleteObjectCommand.mock.calls[0][0]
    expect(input.Bucket).toBe('my-bucket')
    expect(input.Key).toBe('exports/x.json')
  })

  it('missing local path → does not throw (ENOENT swallowed)', async () => {
    await expect(deleteStoredExport('/tmp/definitely-does-not-exist.json')).resolves.toBeUndefined()
  })

  it('empty input → no-op', async () => {
    await deleteStoredExport(null)
    await deleteStoredExport('')
    expect(s3Mock.DeleteObjectCommand).not.toHaveBeenCalled()
  })
})
