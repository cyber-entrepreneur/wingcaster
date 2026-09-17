/**
 * Test-only stub for `@simplewebauthn/browser`.
 *
 * The real package is a browser-only WebAuthn wrapper; adding it as a runtime
 * dependency means it must be `npm install`ed for the build to work, but the
 * tests never touch the real navigator.credentials API. This stub is aliased
 * in vitest.config.ts so tests can `vi.mock('@simplewebauthn/browser')` and
 * override the exports on a per-test basis without a `Failed to resolve
 * import` from vite's static analyser.
 */
export const startRegistration = async (_options: unknown): Promise<unknown> => {
  throw new Error('startRegistration stub — override via vi.mock in a test.')
}

export const startAuthentication = async (_options: unknown): Promise<unknown> => {
  throw new Error('startAuthentication stub — override via vi.mock in a test.')
}

export const browserSupportsWebAuthn = (): boolean => true
