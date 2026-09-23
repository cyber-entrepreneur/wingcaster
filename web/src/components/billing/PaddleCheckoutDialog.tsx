import { useEffect, useState } from 'react'
import { api } from '@/api/client'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { closeInlineCheckout, isPaddleConfigured, openInlineCheckout } from '@/lib/billing/paddle'

const FRAME_CLASS = 'paddle-checkout-frame'

export type CheckoutRequest =
  | { kind: 'subscription'; package_version_id: string }
  | { kind: 'topup'; amount_usd: number }

type Status = 'loading' | 'ready' | 'completed' | 'error' | 'unavailable' | 'not_mapped'

/**
 * Inline Paddle checkout body (no dialog chrome), so it can be embedded either in
 * its own dialog or inside another one (e.g. the top-up dialog) without nesting
 * Radix dialogs. Fetches a server-issued CheckoutConfig (tenant-scoped
 * custom_data), embeds Paddle's iframe, and reports completion — provisioning is
 * done by the webhook, so completion just means "refresh".
 */
export function PaddleCheckoutPanel({
  request,
  onCompleted,
  onClose,
}: {
  request: CheckoutRequest | null
  onCompleted?: () => void
  onClose?: () => void
}) {
  const [status, setStatus] = useState<Status>('loading')

  const reqKind = request?.kind
  const reqVersion = request && request.kind === 'subscription' ? request.package_version_id : undefined
  const reqAmount = request && request.kind === 'topup' ? request.amount_usd : undefined

  useEffect(() => {
    if (!request) return
    if (!isPaddleConfigured()) {
      setStatus('unavailable')
      return
    }
    let cancelled = false
    setStatus('loading')
    api
      .getCheckoutConfig(request)
      .then((config) =>
        openInlineCheckout({
          config,
          frameTarget: FRAME_CLASS,
          onEvent: (event) => {
            if (cancelled) return
            if (event.name === 'checkout.loaded') setStatus('ready')
            else if (event.name === 'checkout.completed') {
              setStatus('completed')
              onCompleted?.()
            } else if (event.name === 'checkout.error') setStatus('error')
          },
        }),
      )
      .catch((err: unknown) => {
        if (cancelled) return
        const message = err instanceof Error ? err.message : ''
        const httpStatus = typeof err === 'object' && err && 'status' in err ? (err as { status?: number }).status : undefined
        if (message === 'paddle_unavailable') setStatus('unavailable')
        else if (httpStatus === 409) setStatus('not_mapped')
        else setStatus('error')
      })
    return () => {
      cancelled = true
      closeInlineCheckout()
    }
    // Depend on primitives so a fresh `request` object each render doesn't re-open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reqKind, reqVersion, reqAmount])

  return (
    <div className="space-y-3">
      {status === 'unavailable' && (
        <p className="text-sm text-muted-foreground">
          Online checkout isn’t available yet. Please try again later or contact support.
        </p>
      )}
      {status === 'not_mapped' && (
        <p className="text-sm text-muted-foreground">
          This isn’t connected to the payment provider yet. Please try again shortly.
        </p>
      )}
      {status === 'error' && (
        <p className="text-sm text-destructive">We couldn’t start checkout. Please close and try again.</p>
      )}
      {status === 'completed' && (
        <p className="text-sm">Payment received — updating your account. This can take a few seconds.</p>
      )}
      {(status === 'loading' || status === 'ready') && (
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {status === 'loading' ? 'Loading secure checkout…' : 'Complete your payment below.'}
        </p>
      )}

      {/* Paddle injects its iframe here — kept mounted while a checkout is in
          progress so the frame target exists when Checkout.open runs. */}
      {status !== 'unavailable' && status !== 'completed' && <div className={FRAME_CLASS} />}

      {status === 'completed' && onClose && <Button onClick={onClose}>Done</Button>}
    </div>
  )
}

/** Standalone inline-checkout dialog (used for new subscriptions). */
export function PaddleCheckoutDialog({
  open,
  onOpenChange,
  request,
  title,
  description,
  onCompleted,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  request: CheckoutRequest | null
  title: string
  description?: string
  onCompleted?: () => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>
        {open && request ? (
          <PaddleCheckoutPanel request={request} onCompleted={onCompleted} onClose={() => onOpenChange(false)} />
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
