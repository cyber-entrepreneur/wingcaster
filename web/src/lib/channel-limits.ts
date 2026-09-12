/**
 * Per-channel compose max lengths (AGT-INB-002). Client-side only.
 * SMS segmentation: 160 GSM-7 / 70 UCS-2 (non-GSM).
 */

export const CHANNEL_MAX_LENGTH: Record<string, number> = {
  sms: 160,
  whatsapp: 4096,
  email: 200_000,
  instagram_dm: 1000,
  facebook_messenger: 2000,
  x_dm: 10_000,
  linkedin: 8000,
  telegram: 4096,
  tiktok: 6000,
  direct: 4096,
}

/** GSM-7 basic set — characters outside this force UCS-2 (70 chars/segment). */
const GSM7_RE =
  /^[\n\r @£$¥èéùìòÇØøÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ!"#¤%&'()*+,\-./0-9:;<=>?¡A-ZÄÖÑÜ§¿a-zäöñüà]*$/

export function channelMaxLength(channel: string | null | undefined): number {
  const key = String(channel || 'direct').toLowerCase()
  return CHANNEL_MAX_LENGTH[key] ?? CHANNEL_MAX_LENGTH.direct
}

export function isGsm7(text: string): boolean {
  return GSM7_RE.test(text)
}

export function smsSegmentInfo(text: string): { segmentSize: number; segments: number; usedInSegment: number } {
  const segmentSize = isGsm7(text) ? 160 : 70
  const len = text.length
  const segments = len === 0 ? 0 : Math.ceil(len / segmentSize)
  const usedInSegment = len === 0 ? 0 : ((len - 1) % segmentSize) + 1
  return { segmentSize, segments, usedInSegment }
}

export type CounterThreshold = 'hidden' | 'muted' | 'warning' | 'danger'

export function counterThreshold(used: number, max: number): CounterThreshold {
  if (max <= 0) return 'hidden'
  const ratio = used / max
  if (ratio < 0.8) return 'hidden'
  if (ratio < 0.9) return 'muted'
  if (ratio < 1) return 'warning'
  return 'danger'
}
