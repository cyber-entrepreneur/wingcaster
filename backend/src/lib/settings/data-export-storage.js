/**
 * Storage adapter for data-export files (H3 — #196 v2).
 *
 * Two backends, picked at request time by env:
 *
 *   1. **Local disk** (default) — where #196 shipped. Files land under
 *      `DATA_EXPORT_DIR`; download reads the file back and streams.
 *   2. **S3 with server-side encryption** — activated when
 *      `WINGCASTER_S3_BUCKET` is set. Upload uses `ServerSideEncryption:
 *      aws:kms` when `WINGCASTER_S3_KMS_KEY_ID` is set too (KMS is the
 *      enterprise-audit answer to "prove nobody at Amazon read our export");
 *      falls back to AES256 SSE otherwise. Download returns a signed URL
 *      via GetObject presign (7-day max, matches export TTL).
 *
 * The adapter interface is intentionally small so a future GCS / Azure Blob
 * backend adds one file, not a rewrite of the routes.
 */

import { createReadStream, statSync } from 'node:fs'
import { mkdir, unlink, writeFile } from 'node:fs/promises'
import path from 'node:path'
import logger from '../logger.js'

export const S3_ENABLED = Boolean(process.env.WINGCASTER_S3_BUCKET)
export const S3_BUCKET = process.env.WINGCASTER_S3_BUCKET || null
export const S3_REGION = process.env.WINGCASTER_S3_REGION || 'us-east-1'
export const S3_KMS_KEY_ID = process.env.WINGCASTER_S3_KMS_KEY_ID || null
export const S3_KEY_PREFIX = process.env.WINGCASTER_S3_KEY_PREFIX || 'data-exports/'

/**
 * Signed-URL TTL. Must be <= the 7-day expiry on the export row itself.
 * S3 presign caps at 7 days for signature-v4.
 */
export const SIGNED_URL_TTL_SECONDS = 7 * 24 * 3600

/** Lazy-load the AWS SDK so environments that never enable S3 don't pay import cost. */
async function loadS3() {
  const s3 = await import('@aws-sdk/client-s3')
  const presign = await import('@aws-sdk/s3-request-presigner')
  return { ...s3, ...presign }
}

/**
 * Persist an export payload. Returns a descriptor:
 *   { location: 'disk', file_path } — local disk
 *   { location: 's3',   bucket, key } — S3
 */
export async function persistExportPayload({ exportId, body, localDir, extension = 'json' }) {
  if (!S3_ENABLED) {
    await mkdir(localDir, { recursive: true })
    const filePath = path.join(localDir, `${exportId}.${extension}`)
    // T7 — accept both Buffer and string bodies; ZIP is binary.
    await writeFile(filePath, body)
    return { location: 'disk', file_path: filePath }
  }
  const { S3Client, PutObjectCommand } = await loadS3()
  const client = new S3Client({ region: S3_REGION })
  const key = `${S3_KEY_PREFIX}${exportId}.${extension}`
  const contentType = extension === 'zip' ? 'application/zip' : 'application/json'
  const command = new PutObjectCommand({
    Bucket: S3_BUCKET,
    Key: key,
    Body: body,
    ContentType: contentType,
    ...(S3_KMS_KEY_ID
      ? {
          ServerSideEncryption: 'aws:kms',
          SSEKMSKeyId: S3_KMS_KEY_ID,
        }
      : { ServerSideEncryption: 'AES256' }),
  })
  await client.send(command)
  return { location: 's3', bucket: S3_BUCKET, key }
}

/**
 * Emit a download response for a completed export.
 * Local: writes the file bytes to `res`. S3: 307-redirects to a signed URL.
 */
export async function serveExportDownload({ res, row }) {
  if (row.file_path && row.file_path.startsWith('s3://')) {
    return _serveS3(res, row)
  }
  if (row.file_path) {
    return _serveDisk(res, row)
  }
  return res.status(500).json({ error: 'missing_file' })
}

async function _serveDisk(res, row) {
  let stat
  try {
    stat = statSync(row.file_path)
  } catch {
    return res.status(410).json({ error: 'file_missing', message: 'Export file has been cleaned up. Request a new one.' })
  }
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Content-Disposition', `attachment; filename="wingcaster-export-${row.id}.json"`)
  res.setHeader('Content-Length', String(stat.size))
  if (row.sha256) res.setHeader('X-WingCaster-Export-Sha256', row.sha256)
  const stream = createReadStream(row.file_path)
  stream.on('error', () => {
    try { res.end() } catch { /* swallow */ }
  })
  return stream.pipe(res)
}

async function _serveS3(res, row) {
  const [, bucketAndKey] = row.file_path.split('s3://')
  const [bucket, ...keyParts] = bucketAndKey.split('/')
  const key = keyParts.join('/')
  try {
    const { S3Client, GetObjectCommand, getSignedUrl } = await loadS3()
    const client = new S3Client({ region: S3_REGION })
    const command = new GetObjectCommand({ Bucket: bucket, Key: key })
    const url = await getSignedUrl(client, command, { expiresIn: SIGNED_URL_TTL_SECONDS })
    // 307 keeps the method (GET), and the client follows automatically.
    return res.redirect(307, url)
  } catch (err) {
    logger.error({ err, exportId: row.id }, 'S3 presign failed')
    return res.status(503).json({ error: 'download_temporarily_unavailable' })
  }
}

/**
 * Encode a persistence descriptor into the `file_path` column so the row is
 * self-describing (a later download can pick the right backend without
 * consulting env vars, which may have changed).
 */
export function encodeStoragePath(descriptor) {
  if (descriptor.location === 's3') {
    return `s3://${descriptor.bucket}/${descriptor.key}`
  }
  return descriptor.file_path
}

/**
 * Delete the underlying storage. Called by the cleanup worker for expired
 * rows. Fail-safe: returns even if the delete errored (worker logs).
 */
export async function deleteStoredExport(filePath) {
  if (!filePath) return
  if (filePath.startsWith('s3://')) {
    try {
      const [, bucketAndKey] = filePath.split('s3://')
      const [bucket, ...keyParts] = bucketAndKey.split('/')
      const key = keyParts.join('/')
      const { S3Client, DeleteObjectCommand } = await loadS3()
      const client = new S3Client({ region: S3_REGION })
      await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }))
    } catch (err) {
      logger.error({ err, filePath }, 'S3 delete failed')
    }
    return
  }
  try {
    await unlink(filePath)
  } catch (err) {
    // ENOENT is fine — someone else already cleaned it up.
    if (err?.code !== 'ENOENT') {
      logger.error({ err, filePath }, 'local disk delete failed')
    }
  }
}

// Exported for tests.
export const __testables = { encodeStoragePath, loadS3 }
