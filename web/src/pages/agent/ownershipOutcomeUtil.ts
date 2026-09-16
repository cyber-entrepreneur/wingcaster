/**
 * Days/hours left until an ISO reversal deadline, or null when past/missing.
 * `now` is injected so clock-dependent rendering stays deterministic in tests.
 */
export function reversalRemaining(
  deadlineIso: string | null,
  now: number,
): { days: number; hours: number } | null {
  if (!deadlineIso) return null
  const ms = new Date(deadlineIso).getTime() - now
  if (!Number.isFinite(ms) || ms <= 0) return null
  return { days: Math.floor(ms / 86_400_000), hours: Math.floor((ms % 86_400_000) / 3_600_000) }
}
