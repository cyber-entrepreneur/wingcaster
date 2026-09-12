/** Shared location-state + API error helpers for SHR-MFA screens. */

export interface EnrollLocationState {
  secret?: string
  provisioning_uri?: string
  issuer?: string
  account?: string
}

export interface BackupCodesLocationState {
  backupCodes?: string[]
  accountEmail?: string
}

export interface ChallengeLocationState {
  challenge_id?: string
  returnTo?: string
}

export function apiStatus(err: unknown): number | undefined {
  if (err && typeof err === 'object' && 'status' in err) {
    const status = (err as { status?: unknown }).status
    return typeof status === 'number' ? status : undefined
  }
  return undefined
}

export function apiErrorCode(err: unknown): string {
  if (err && typeof err === 'object' && 'error' in err) {
    return String((err as { error?: unknown }).error ?? '')
  }
  return err instanceof Error ? err.message : ''
}

export function remainingAttemptsOf(err: unknown): number | undefined {
  if (err && typeof err === 'object' && 'remaining_attempts' in err) {
    const n = (err as { remaining_attempts?: unknown }).remaining_attempts
    return typeof n === 'number' ? n : undefined
  }
  return undefined
}

export function formatEnrolledDate(iso: string | null | undefined): string {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}
