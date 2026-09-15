/** Format remaining milliseconds as `mm:ss` with leading zeros (mono / tabular-nums). */
export function formatCountdown(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return '00:00'
  const totalSec = Math.floor(ms / 1000)
  const mm = String(Math.floor(totalSec / 60)).padStart(2, '0')
  const ss = String(totalSec % 60).padStart(2, '0')
  return `${mm}:${ss}`
}

export function remainingMs(expiresAt: string, now = Date.now()): number {
  const target = Date.parse(expiresAt)
  if (!Number.isFinite(target)) return 0
  return target - now
}

export function isExpired(expiresAt: string, now = Date.now()): boolean {
  return remainingMs(expiresAt, now) <= 0
}
