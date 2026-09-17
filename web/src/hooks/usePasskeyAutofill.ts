import { useEffect, useRef } from 'react'
import { api, setAuthToken, clearElevatedToken } from '@/api/client'

/**
 * T2 — Passkey autofill / conditional UI (H4 v2).
 *
 * Wires the WebAuthn conditional-mediation flow to a username `<input>`.
 * When the browser + platform support it (Chrome/Edge/Safari with a
 * platform authenticator), typing or focusing the input causes the OS to
 * offer the user's saved passkeys inline — exactly like a password
 * manager offers to autofill a password. GitHub, Google, and 1Password
 * default to this pattern in 2024+.
 *
 * ---------------------------------------------------------------------------
 * How it works
 * ---------------------------------------------------------------------------
 *
 * 1. Feature detect `PublicKeyCredential.isConditionalMediationAvailable()`.
 *    Chrome/Safari 108+ return true; older browsers return false (or the
 *    method doesn't exist at all) and we bail cleanly.
 * 2. Call `/api/auth/webauthn/authenticate/begin` (no identifier — the
 *    browser drives credential selection).
 * 3. Start authentication with `mediation: 'conditional'`. This DOES NOT
 *    show any modal; the browser attaches the WebAuthn ceremony to the
 *    input marked `autocomplete="username webauthn"`.
 * 4. When the user picks a passkey from the autofill dropdown, the promise
 *    resolves; we finish the sign-in via
 *    `/api/auth/webauthn/authenticate/complete` and adopt the session.
 *
 * The hook returns `{ inputProps }` — spread on the input to attach the
 * `autocomplete="username webauthn"` attribute. Nothing else in the login
 * form needs to change; the conditional ceremony is invisible until the
 * user picks a credential from the autofill offer.
 */

// @simplewebauthn/browser v10 takes positional args:
//   startAuthentication(optionsJSON, useBrowserAutofill?)
// (v11 switched to a single object param — keep this aligned with the
// version pinned in package.json).
type StartAuthentication = (
  optionsJSON: unknown,
  useBrowserAutofill?: boolean,
) => Promise<unknown>

export interface UsePasskeyAutofillOptions {
  onSignedIn: () => void | Promise<void>
  /** When true, the ceremony is not started (e.g. user already authed). */
  disabled?: boolean
}

export interface UsePasskeyAutofillResult {
  inputProps: {
    autoComplete: string
  }
}

async function isSupported(): Promise<boolean> {
  if (typeof window === 'undefined' || !window.PublicKeyCredential) return false
  // The static method was added in the WebAuthn L3 draft; older browsers
  // don't have it and return `undefined` when we call it — treat as false.
  const check = (window.PublicKeyCredential as unknown as {
    isConditionalMediationAvailable?: () => Promise<boolean>
  }).isConditionalMediationAvailable
  if (typeof check !== 'function') return false
  try {
    return Boolean(await check.call(window.PublicKeyCredential))
  } catch {
    return false
  }
}

async function loadStartAuthentication(): Promise<StartAuthentication> {
  const mod = (await import('@simplewebauthn/browser')) as unknown as {
    startAuthentication: StartAuthentication
  }
  return mod.startAuthentication
}

export function usePasskeyAutofill({
  onSignedIn,
  disabled = false,
}: UsePasskeyAutofillOptions): UsePasskeyAutofillResult {
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    if (disabled) return
    let cancelled = false

    ;(async () => {
      if (!(await isSupported())) return
      // Abort controller so a re-render while the ceremony is in flight
      // aborts the previous one rather than leaving a dangling promise.
      // The WebAuthn spec accepts `signal` on the auth options; we pass it
      // through to `startAuthentication`.
      const controller = new AbortController()
      abortRef.current = controller
      try {
        const startAuthentication = await loadStartAuthentication()
        const { options } = await api.webauthnAuthenticateBegin(undefined)
        if (cancelled) return
        // useBrowserAutofill=true is the @simplewebauthn/browser flag that
        // sets mediation:'conditional' on the underlying navigator call.
        const assertion = await startAuthentication(options, true)
        if (cancelled) return
        const result = await api.webauthnAuthenticateComplete({
          response: assertion,
        })
        setAuthToken(result.token)
        clearElevatedToken()
        await onSignedIn()
      } catch (err) {
        // AbortError is expected on unmount / manual submit — swallow.
        // Every other error just means "no passkey was picked" — that's
        // the common path; no need to toast.
        if (err instanceof Error && err.name !== 'AbortError') {
          // eslint-disable-next-line no-console
          console.debug('[passkey-autofill] ceremony did not complete', err)
        }
      }
    })()

    return () => {
      cancelled = true
      abortRef.current?.abort()
    }
  }, [disabled, onSignedIn])

  return {
    inputProps: {
      // The `webauthn` token in autocomplete is what tells the browser to
      // attach the WebAuthn autofill offer to this specific input.
      autoComplete: 'username webauthn',
    },
  }
}
