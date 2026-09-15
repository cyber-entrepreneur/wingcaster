import { Link } from 'react-router-dom'
import { AlertOctagon, ArrowLeft, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function OutcomeTopNav({ title, backHref = '/agent/pricing' }: { title: string; backHref?: string }) {
  return (
    <header className="sticky top-0 z-10 flex h-12 items-center gap-[var(--lc-space-sm)] border-b border-[var(--lc-border)] bg-[var(--lc-surface-raised)] px-[var(--lc-space-md)]">
      <Link
        to={backHref}
        aria-label="Back"
        className="inline-flex min-h-tap min-w-tap items-center justify-center text-[var(--lc-text-heading)]"
      >
        <ArrowLeft className="h-5 w-5 rtl:rotate-180" aria-hidden="true" />
      </Link>
      <h1
        className="flex-1 text-center text-[var(--lc-text-heading)]"
        style={{ font: 'var(--lc-type-body)' }}
      >
        {title}
      </h1>
      <span className="min-w-tap" aria-hidden="true" />
    </header>
  )
}

export function OutcomeLoadingSkeleton() {
  return (
    <div className="animate-pulse space-y-[var(--lc-space-md)] p-[var(--lc-space-md)]" aria-busy="true">
      <div className="h-28 rounded-lg bg-[var(--lc-surface-sunken)]" />
      <div className="h-20 rounded-lg bg-[var(--lc-surface-sunken)]" />
      <div className="h-40 rounded-lg bg-[var(--lc-surface-sunken)]" />
      <div className="flex items-center justify-center gap-2 text-[var(--lc-text-muted)]">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        Loading report status…
      </div>
    </div>
  )
}

export function OutcomeNotFound({
  message = "This report doesn't exist or isn't yours.",
  backHref = '/agent/pricing',
  backLabel = 'Back to My Reports',
}: {
  message?: string
  backHref?: string
  backLabel?: string
}) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-[var(--lc-space-md)] px-[var(--lc-space-md)] text-center">
      <AlertOctagon className="h-10 w-10 text-[var(--lc-text-muted)]" aria-hidden="true" />
      <p className="text-[var(--lc-text-primary)]" style={{ font: 'var(--lc-type-body)' }}>
        {message}
      </p>
      <Button asChild variant="outline">
        <Link to={backHref}>{backLabel}</Link>
      </Button>
    </div>
  )
}

export function OutcomeNetworkError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-[var(--lc-space-md)] px-[var(--lc-space-md)] text-center">
      <AlertOctagon className="h-10 w-10 text-[var(--lc-status-warning-fg)]" aria-hidden="true" />
      <p className="text-[var(--lc-text-primary)]" style={{ font: 'var(--lc-type-body)' }}>
        Check your connection and try again.
      </p>
      <Button type="button" onClick={onRetry}>
        Retry
      </Button>
    </div>
  )
}

export function ContactSupportLink({ context }: { context: string }) {
  const href = `/notifications?support=1&context=${encodeURIComponent(context)}`
  return (
    <p className="py-[var(--lc-space-lg)] text-center">
      <Link
        to={href}
        className="text-[var(--lc-text-brand)] underline-offset-2 hover:underline"
        style={{ font: 'var(--lc-type-body-sm)' }}
      >
        Something not right? Contact WingCaster support
      </Link>
    </p>
  )
}
