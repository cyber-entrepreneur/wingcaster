import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useUiMode } from '@/hooks/useUiMode'
import { api } from '@/api/client'
import { useEffect, useState } from 'react'
import { useToast } from '@/components/ui/toast'

export interface TryProNudgeBannerProps {
  /** Override eligibility (tests). */
  forceEligible?: boolean
  className?: string
}

/**
 * AGT-SET-002 P0 — Try-Pro nudge on Guided dashboard.
 * Fires when ≥14 days Guided + ≥20 listings + dismiss cooldown ≥90 days + viewport ≥768px.
 */
export function TryProNudgeBanner({ forceEligible, className }: TryProNudgeBannerProps) {
  const { mode, effectiveMode, isProCapable, setMode } = useUiMode()
  const { addToast } = useToast()
  const [eligible, setEligible] = useState(false)
  const [listingCount, setListingCount] = useState(0)
  const [hidden, setHidden] = useState(false)

  useEffect(() => {
    if (forceEligible !== undefined) {
      setEligible(forceEligible)
      return
    }
    if (mode === 'pro' || !isProCapable) {
      setEligible(false)
      return
    }
    let cancelled = false
    api
      .getProNudge()
      .then((res) => {
        if (cancelled) return
        setEligible(res.eligible)
        setListingCount(res.listing_count)
      })
      .catch(() => {
        if (!cancelled) setEligible(false)
      })
    return () => {
      cancelled = true
    }
  }, [forceEligible, isProCapable, mode])

  if (hidden || effectiveMode === 'pro' || !isProCapable || !eligible) return null

  return (
    <div
      role="region"
      aria-label="Try Pro mode"
      data-testid="try-pro-nudge"
      className={
        className ||
        'mb-[var(--lc-space-md)] flex flex-wrap items-center gap-3 rounded-[var(--lc-radius-md)] bg-[var(--lc-action-primary)] px-[var(--lc-space-md)] py-[var(--lc-space-sm)] text-[var(--lc-action-primary-text)]'
      }
    >
      <p className="min-w-0 flex-1" style={{ font: 'var(--lc-type-body)' }}>
        You&apos;ve got {listingCount || '20+'} listings — try Pro mode for faster browsing?
      </p>
      <Button
        type="button"
        variant="secondary"
        onClick={async () => {
          const result = await setMode('pro')
          if (!result.ok) {
            addToast({ title: "Couldn't switch modes. Try again?", variant: 'error' })
            return
          }
          addToast({ title: 'Switched to Pro mode.', variant: 'default' })
        }}
      >
        Try Pro →
      </Button>
      <button
        type="button"
        className="inline-flex min-h-tap min-w-tap items-center justify-center rounded-md opacity-70 hover:opacity-100"
        aria-label="Dismiss Pro suggestion"
        onClick={async () => {
          setHidden(true)
          try {
            await api.dismissProNudge()
          } catch {
            /* local dismiss still applies */
          }
        }}
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  )
}
