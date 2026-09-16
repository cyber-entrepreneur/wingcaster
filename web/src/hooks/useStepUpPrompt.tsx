import { useCallback, useRef, useState } from 'react'
import { StepUpModal } from '@/components/auth/StepUpModal'

/**
 * Promise-based bridge to the SHR-MFA-007 `StepUpModal`.
 *
 * `requestElevation()` opens the modal and resolves `true` once a short-lived
 * elevation token has been obtained (stored by the API client and attached to
 * subsequent requests), or `false` if the user cancels. Consumers render the
 * returned `modal` element once.
 */
export function useStepUpPrompt(actionLabel?: string) {
  const [open, setOpen] = useState(false)
  const resolverRef = useRef<((ok: boolean) => void) | null>(null)

  const settle = useCallback((ok: boolean) => {
    setOpen(false)
    const resolve = resolverRef.current
    resolverRef.current = null
    resolve?.(ok)
  }, [])

  const requestElevation = useCallback(() => {
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve
      setOpen(true)
    })
  }, [])

  const modal = (
    <StepUpModal
      open={open}
      actionLabel={actionLabel}
      onCancel={() => settle(false)}
      onElevated={() => settle(true)}
    />
  )

  return { modal, requestElevation }
}
