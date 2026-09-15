/** Read HTTP status off a `fetchJson` error (assigned in `@/api/client`). */
export function httpStatus(err: unknown): number | undefined {
  if (!err || typeof err !== 'object') return undefined
  const status = (err as { status?: unknown }).status
  return typeof status === 'number' ? status : undefined
}

export function isNotFound(err: unknown): boolean {
  return httpStatus(err) === 404
}

/** Safe message extraction for toast/error UI from `unknown` catch values. */
export function apiErrorMessage(err: unknown, fallback = 'Something went wrong'): string {
  if (err instanceof Error && err.message) return err.message
  if (typeof err === 'object' && err && 'message' in err) {
    const message = (err as { message: unknown }).message
    if (typeof message === 'string' && message) return message
  }
  return fallback
}
