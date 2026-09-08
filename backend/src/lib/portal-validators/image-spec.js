/**
 * Shared image-spec helpers for per-portal validators.
 *
 * Reads width/height/mime/size from `listing.images[]` (also photos/media)
 * using fields: width, height, mime/content_type, bytes/size.
 *
 * PORTAL_LIST_RESEARCH_2026-09-04.md §C:
 *   Bayut            Min 800px, JPG/PNG, ≤5MB
 *   Property Finder  Min 1200px, JPG/PNG
 *   Aqarmap          Min 600px
 *   Baseline portals Min 800px JPG/PNG as warn if dimensions missing,
 *                    fail if present and below 600px
 */

import {
  displayActual,
  getListingField,
  isPresent,
  listingBags,
  makeCheck,
} from './fields.js'

export const JPEG_PNG_MIMES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'jpeg',
  'jpg',
  'png',
])

export const FIVE_MB = 5 * 1024 * 1024

const IMAGE_KEYS = ['images', 'photos', 'media', 'photo_urls']

function toPosInt(value) {
  if (value == null || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null
}

function mimeFromUrl(url) {
  if (!url || typeof url !== 'string') return ''
  const path = url.split('?')[0].toLowerCase()
  if (path.endsWith('.png')) return 'image/png'
  if (path.endsWith('.jpg') || path.endsWith('.jpeg')) return 'image/jpeg'
  return ''
}

/**
 * @param {object} image
 * @returns {{ width: number|null, height: number|null, mime: string, bytes: number|null, maxSide: number, hasDimensions: boolean }}
 */
export function readImageMeta(image) {
  if (image == null) {
    return { width: null, height: null, mime: '', bytes: null, maxSide: 0, hasDimensions: false }
  }
  if (typeof image === 'string') {
    const mime = mimeFromUrl(image)
    return { width: null, height: null, mime, bytes: null, maxSide: 0, hasDimensions: false }
  }
  const width = toPosInt(image.width ?? image.pixel_width ?? image.w)
  const height = toPosInt(image.height ?? image.pixel_height ?? image.h)
  const rawMime = String(
    image.mime
    || image.mime_type
    || image.content_type
    || image.mimeType
    || image.contentType
    || '',
  ).toLowerCase().split(';')[0].trim()
  const url = image.url || image.src || image.path || ''
  const mime = rawMime || mimeFromUrl(url)
  const bytes = toPosInt(image.bytes ?? image.size ?? image.file_size ?? image.fileSize)
  const maxSide = Math.max(width || 0, height || 0)
  return {
    width,
    height,
    mime,
    bytes,
    maxSide,
    hasDimensions: width != null || height != null,
  }
}

export function isJpegOrPng(mime) {
  if (!mime) return false
  const normalised = String(mime).toLowerCase().split(';')[0].trim()
  return JPEG_PNG_MIMES.has(normalised)
}

export function getListingImages(listing) {
  for (const bag of listingBags(listing)) {
    for (const key of IMAGE_KEYS) {
      const raw = bag[key]
      if (!isPresent(raw)) continue
      if (Array.isArray(raw)) {
        return raw.filter((item) => item != null && item !== '')
      }
    }
  }
  const single = getListingField(listing, 'image', 'hero_image', 'cover_image')
  if (isPresent(single)) return [single]
  return []
}

function dimLabel(meta) {
  if (!meta.hasDimensions) return null
  if (meta.width != null && meta.height != null) return `${meta.width}x${meta.height}`
  if (meta.width != null) return `${meta.width}w`
  return `${meta.height}h`
}

/**
 * Lint listing images against a portal spec.
 *
 * @param {object} listing
 * @param {object} spec
 * @param {number} spec.minPx             advertised minimum (warn or fail)
 * @param {number} [spec.failBelowPx]     fail threshold (defaults to minPx)
 * @param {number} [spec.maxBytes]
 * @param {boolean} [spec.requireImages=true]
 * @param {'fail'|'warn'} [spec.missingImageSeverity='fail']
 */
export function checkImageSpec(listing, spec = {}) {
  const minPx = Number(spec.minPx) || 0
  const failBelowPx = spec.failBelowPx != null ? Number(spec.failBelowPx) : minPx
  const maxBytes = spec.maxBytes != null ? Number(spec.maxBytes) : null
  const requireImages = spec.requireImages !== false
  const missingImageSeverity = spec.missingImageSeverity || (requireImages ? 'fail' : 'warn')
  const checks = []

  const images = getListingImages(listing)
  if (!images.length) {
    checks.push(makeCheck({
      code: 'required_image',
      severity: requireImages ? missingImageSeverity : 'warn',
      message: requireImages ? 'At least one image is required' : 'No images attached (image spec is TBD / unverified)',
      expected: '>=1 image',
      actual: 0,
    }))
    return checks
  }
  checks.push(makeCheck({
    code: 'required_image',
    severity: 'pass',
    message: 'At least one image is present',
    expected: '>=1 image',
    actual: images.length,
  }))

  const metas = images.map(readImageMeta)

  const undersized = metas.filter((m) => m.hasDimensions && m.maxSide < failBelowPx)
  const belowSpec = metas.filter((m) => m.hasDimensions && m.maxSide < minPx && m.maxSide >= failBelowPx)
  const missingDims = metas.filter((m) => !m.hasDimensions)

  if (undersized.length) {
    const worst = undersized.reduce((a, b) => (a.maxSide < b.maxSide ? a : b))
    checks.push(makeCheck({
      code: 'image_dimensions',
      severity: 'fail',
      message: `Image is below the ${failBelowPx}px minimum`,
      expected: `>=${failBelowPx}px`,
      actual: dimLabel(worst),
    }))
  } else if (belowSpec.length) {
    const worst = belowSpec.reduce((a, b) => (a.maxSide < b.maxSide ? a : b))
    checks.push(makeCheck({
      code: 'image_dimensions',
      severity: 'warn',
      message: `Image is below the ${minPx}px portal spec`,
      expected: `>=${minPx}px`,
      actual: dimLabel(worst),
    }))
  } else if (missingDims.length) {
    checks.push(makeCheck({
      code: 'image_dimensions',
      severity: 'warn',
      message: 'Image dimensions are missing; cannot verify portal pixel spec',
      expected: `>=${minPx}px`,
      actual: null,
    }))
  } else {
    checks.push(makeCheck({
      code: 'image_dimensions',
      severity: 'pass',
      message: `Images meet the ${minPx}px minimum`,
      expected: `>=${minPx}px`,
      actual: dimLabel(metas[0]),
    }))
  }

  const badMime = metas.filter((m) => m.mime && !isJpegOrPng(m.mime))
  const missingMime = metas.filter((m) => !m.mime)
  if (badMime.length) {
    checks.push(makeCheck({
      code: 'image_mime',
      severity: 'fail',
      message: 'Image format must be JPG or PNG',
      expected: 'image/jpeg or image/png',
      actual: badMime[0].mime,
    }))
  } else if (missingMime.length) {
    checks.push(makeCheck({
      code: 'image_mime',
      severity: 'warn',
      message: 'Image MIME type is missing; cannot verify JPG/PNG',
      expected: 'image/jpeg or image/png',
      actual: null,
    }))
  } else {
    checks.push(makeCheck({
      code: 'image_mime',
      severity: 'pass',
      message: 'Images are JPG or PNG',
      expected: 'image/jpeg or image/png',
      actual: metas[0].mime,
    }))
  }

  if (maxBytes != null) {
    const tooBig = metas.filter((m) => m.bytes != null && m.bytes > maxBytes)
    const missingSize = metas.filter((m) => m.bytes == null)
    if (tooBig.length) {
      checks.push(makeCheck({
        code: 'image_size',
        severity: 'fail',
        message: `Image exceeds the ${maxBytes} byte size limit`,
        expected: `<=${maxBytes} bytes`,
        actual: tooBig[0].bytes,
      }))
    } else if (missingSize.length) {
      checks.push(makeCheck({
        code: 'image_size',
        severity: 'warn',
        message: 'Image byte size is missing; cannot verify size limit',
        expected: `<=${maxBytes} bytes`,
        actual: null,
      }))
    } else {
      checks.push(makeCheck({
        code: 'image_size',
        severity: 'pass',
        message: 'Images are within the size limit',
        expected: `<=${maxBytes} bytes`,
        actual: displayActual(metas[0].bytes),
      }))
    }
  }

  return checks
}

export const BAYUT_IMAGE_SPEC = Object.freeze({ minPx: 800, maxBytes: FIVE_MB })
export const PROPERTY_FINDER_IMAGE_SPEC = Object.freeze({ minPx: 1200 })
export const AQARMAP_IMAGE_SPEC = Object.freeze({ minPx: 600 })
export const BASELINE_IMAGE_SPEC = Object.freeze({ minPx: 800, failBelowPx: 600 })
