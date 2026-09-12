/** Read HTTP status off a `fetchJson` error (assigned in `@/api/client`). */
export function httpStatus(err: unknown): number | undefined {
  if (!err || typeof err !== 'object') return undefined
  const status = (err as { status?: unknown }).status
  return typeof status === 'number' ? status : undefined
}

export function isNotFound(err: unknown): boolean {
  return httpStatus(err) === 404
}
