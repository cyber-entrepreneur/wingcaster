import { useContext } from 'react'
import {
  StepUpContext,
  type StepUpContextValue,
  type StepUpRequestOptions,
  type StepUpResult,
} from '@/components/mfa/StepUpProvider'

export type { StepUpContextValue, StepUpRequestOptions, StepUpResult }

export interface UseStepUpOptions {
  /**
   * Default reason applied when `requireStepUp()` is called without options.
   * Matches SHR-MFA-007 precondition shape:
   * `useStepUp({ reason: "Disable two-factor authentication" })`.
   */
  reason?: string
}

export interface UseStepUpReturn {
  /**
   * Opens the step-up modal. Resolves `{ elevatedToken }` on success;
   * rejects `{ reason: 'user_cancelled' }` on dismiss.
   * MUST NOT cache the elevated token beyond the immediate action.
   */
  requireStepUp: (options?: StepUpRequestOptions) => Promise<StepUpResult>
}

/**
 * Hook for sensitive-action gates (SHR-MFA-007 contract).
 *
 * Used by: SHR-MFA-001→006 chain, SHR-MFA-005 regenerate, SHR-SET-004/005,
 * PA credit surfaces, AGN ownership transfer.
 *
 * **Coexistence note:** Legacy `useStepUp` is exported from
 * `web/src/context/StepUpContext.tsx` with a different API
 * (`requireElevation` / `runElevated`). Import from `@/components/mfa` for the
 * brief-aligned contract. Do **not** modify the legacy hook from this package.
 *
 * @example
 * ```tsx
 * const { requireStepUp } = useStepUp({ reason: 'Regenerate backup codes' })
 * const { elevatedToken } = await requireStepUp()
 * ```
 */
export function useStepUp(options?: UseStepUpOptions): UseStepUpReturn {
  const ctx = useContext(StepUpContext)
  if (!ctx) {
    throw new Error(
      'useStepUp (mfa) must be used within <StepUpProvider> from @/components/mfa. ' +
        'Legacy StepUpContext is a separate provider — do not mix them.',
    )
  }

  return {
    requireStepUp: (override) =>
      ctx.requireStepUp({
        reason: override?.reason ?? options?.reason,
      }),
  }
}
