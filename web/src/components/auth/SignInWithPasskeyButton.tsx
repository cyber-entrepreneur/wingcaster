import { useState, type ComponentPropsWithoutRef } from 'react'
import { KeyRound, Loader2 } from 'lucide-react'
import { api, setAuthToken, clearElevatedToken } from '@/api/client'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/components/ui/toast'

/**
 * "Sign in with a passkey" button (issue 189).
 *
 * Passes the identifier the user typed (email) to
 * `/api/auth/webauthn/authenticate/begin` so the server can narrow the
 * credential list, then hands off to the browser's WebAuthn API via
 * `@simplewebauthn/browser`. On success, adopts the returned session
 * token and navigates via the caller-supplied `onSignedIn`.
 *
 * The identifier is optional — if the user has a resident credential
 * (usernameless / passkey) their browser can proceed without an email.
 */

type StartAuthentication = (opts: unknown) => Promise<unknown>

async function loadStartAuthentication(): Promise<StartAuthentication> {
  const mod = (await import('@simplewebauthn/browser')) as {
    startAuthentication: StartAuthentication
  }
  return mod.startAuthentication
}

export interface SignInWithPasskeyButtonProps
  extends Omit<ComponentPropsWithoutRef<typeof Button>, 'onClick'> {
  identifier?: string
  onSignedIn: () => void | Promise<void>
}

export function SignInWithPasskeyButton({
  identifier,
  onSignedIn,
  disabled,
  ...rest
}: SignInWithPasskeyButtonProps) {
  const { refreshAgent } = useAuth()
  const { addToast } = useToast()
  const [busy, setBusy] = useState(false)

  const supported = typeof window !== 'undefined' && !!window.PublicKeyCredential

  async function trigger() {
    setBusy(true)
    try {
      const startAuthentication = await loadStartAuthentication()
      const { options, session_key: sessionKey } = await api.webauthnAuthenticateBegin(identifier)
      const assertion = await startAuthentication(options)
      const optsAsRecord = options as { challenge?: string }
      const result = await api.webauthnAuthenticateComplete({
        response: assertion,
        challenge: sessionKey ? optsAsRecord.challenge : undefined,
      })
      setAuthToken(result.token)
      clearElevatedToken()
      await refreshAgent()
      await onSignedIn()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not sign in with passkey.'
      addToast({ variant: 'error', title: 'Passkey sign-in failed', description: message })
    } finally {
      setBusy(false)
    }
  }

  if (!supported) return null

  return (
    <Button
      type="button"
      variant="outline"
      disabled={busy || disabled}
      onClick={() => void trigger()}
      {...rest}
    >
      {busy ? (
        <>
          <Loader2 className="me-2 h-4 w-4 animate-spin" aria-hidden />
          Waiting for device…
        </>
      ) : (
        <>
          <KeyRound className="me-2 h-4 w-4" aria-hidden />
          Sign in with a passkey
        </>
      )}
    </Button>
  )
}
