// @vitest-environment jsdom
/**
 * Unit tests for T2 usePasskeyAutofill.
 *
 * Covers:
 *   - Unsupported browser (no PublicKeyCredential): hook does not call API,
 *     inputProps still exposes autoComplete
 *   - `isConditionalMediationAvailable === false`: no ceremony started
 *   - Supported + not disabled: begin → startAuthentication(mediation:cond)
 *     → complete → onSignedIn callback fires
 *   - `disabled=true`: no ceremony started
 *   - AbortError from cancelled ceremony is swallowed silently
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook, waitFor, cleanup } from '@testing-library/react'

const apiMock = vi.hoisted(() => ({
  webauthnAuthenticateBegin: vi.fn(),
  webauthnAuthenticateComplete: vi.fn(),
}))
vi.mock('@/api/client', () => ({
  api: apiMock,
  setAuthToken: vi.fn(),
  clearElevatedToken: vi.fn(),
}))

const startAuthenticationMock = vi.hoisted(() => vi.fn())
vi.mock('@simplewebauthn/browser', () => ({
  startAuthentication: startAuthenticationMock,
}))

import { usePasskeyAutofill } from './usePasskeyAutofill'

let conditionalAvailable = true

function stubPublicKeyCredential() {
  const stub = class {}
  ;(stub as unknown as {
    isConditionalMediationAvailable: () => Promise<boolean>
  }).isConditionalMediationAvailable = () => Promise.resolve(conditionalAvailable)
  Object.defineProperty(window, 'PublicKeyCredential', {
    configurable: true,
    value: stub,
    writable: true,
  })
}

function removePublicKeyCredential() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delete (window as any).PublicKeyCredential
}

beforeEach(() => {
  vi.clearAllMocks()
  conditionalAvailable = true
  stubPublicKeyCredential()
  apiMock.webauthnAuthenticateBegin.mockResolvedValue({
    options: { challenge: 'chal' },
    session_key: null,
  })
  apiMock.webauthnAuthenticateComplete.mockResolvedValue({
    token: 'session-jwt',
    factor_used: 'passkey',
  })
  startAuthenticationMock.mockResolvedValue({ id: 'cred-1' })
})

afterEach(() => {
  cleanup()
  removePublicKeyCredential()
})

describe('usePasskeyAutofill', () => {
  it('returns inputProps.autoComplete = "username webauthn"', () => {
    const { result } = renderHook(() =>
      usePasskeyAutofill({ onSignedIn: vi.fn(), disabled: true }),
    )
    expect(result.current.inputProps.autoComplete).toBe('username webauthn')
  })

  it('does nothing when PublicKeyCredential is missing', async () => {
    removePublicKeyCredential()
    const onSignedIn = vi.fn()
    renderHook(() => usePasskeyAutofill({ onSignedIn }))
    // Give any pending promise a tick.
    await new Promise((r) => setTimeout(r, 20))
    expect(apiMock.webauthnAuthenticateBegin).not.toHaveBeenCalled()
    expect(onSignedIn).not.toHaveBeenCalled()
  })

  it('does nothing when isConditionalMediationAvailable returns false', async () => {
    conditionalAvailable = false
    stubPublicKeyCredential()
    const onSignedIn = vi.fn()
    renderHook(() => usePasskeyAutofill({ onSignedIn }))
    await new Promise((r) => setTimeout(r, 20))
    expect(apiMock.webauthnAuthenticateBegin).not.toHaveBeenCalled()
  })

  it('does nothing when disabled=true', async () => {
    const onSignedIn = vi.fn()
    renderHook(() => usePasskeyAutofill({ onSignedIn, disabled: true }))
    await new Promise((r) => setTimeout(r, 20))
    expect(apiMock.webauthnAuthenticateBegin).not.toHaveBeenCalled()
  })

  it('runs the conditional ceremony end-to-end when supported', async () => {
    const onSignedIn = vi.fn()
    renderHook(() => usePasskeyAutofill({ onSignedIn }))
    await waitFor(() => expect(apiMock.webauthnAuthenticateBegin).toHaveBeenCalled())
    await waitFor(() => expect(startAuthenticationMock).toHaveBeenCalled())
    // Confirm the flag is set — @simplewebauthn/browser's startAuthentication
    // interprets useBrowserAutofill:true as WebAuthn's mediation:'conditional'.
    const call = startAuthenticationMock.mock.calls[0][0]
    expect(call.useBrowserAutofill).toBe(true)
    await waitFor(() => expect(apiMock.webauthnAuthenticateComplete).toHaveBeenCalled())
    await waitFor(() => expect(onSignedIn).toHaveBeenCalled())
  })

  it('swallows a AbortError from a cancelled ceremony', async () => {
    startAuthenticationMock.mockRejectedValueOnce(
      Object.assign(new Error('cancelled'), { name: 'AbortError' }),
    )
    const onSignedIn = vi.fn()
    renderHook(() => usePasskeyAutofill({ onSignedIn }))
    await new Promise((r) => setTimeout(r, 30))
    expect(onSignedIn).not.toHaveBeenCalled()
    // No unhandled rejection: the test would fail with an "unhandled" error
    // if the hook re-threw. Passing this test proves the swallow works.
  })
})
