import type { ReactNode } from 'react'
import { AlertTriangle, RefreshCw, Users } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

type BlockTone = 'danger' | 'warning' | 'info'

const TONE_CLASS: Record<BlockTone, string> = {
  danger: 'text-[var(--lc-status-unpublished-fg)]',
  warning: 'text-[var(--lc-status-underOffer-fg)]',
  info: 'text-[var(--lc-status-underOffer-fg)]',
}

interface BodySwapBlockProps {
  tone: BlockTone
  icon: ReactNode
  title: string
  body: string
  primaryLabel: string
  onPrimary: () => void
  secondaryLabel?: string
  onSecondary?: () => void
}

/** Shared body-swap block used by the self-approval / stale / vote-mismatch states. */
function BodySwapBlock({
  tone,
  icon,
  title,
  body,
  primaryLabel,
  onPrimary,
  secondaryLabel,
  onSecondary,
}: BodySwapBlockProps) {
  return (
    <div role="alert" aria-live="polite" className="flex flex-col items-start gap-3 py-2">
      <span aria-hidden className={cn('flex h-10 w-10 items-center justify-center', TONE_CLASS[tone])}>
        {icon}
      </span>
      <h3 className="text-[var(--lc-text-heading)]" style={{ font: 'var(--lc-type-heading-3)' }}>
        {title}
      </h3>
      <p className="text-[var(--lc-text-secondary)]" style={{ font: 'var(--lc-type-body)' }}>
        {body}
      </p>
      <div className="mt-2 flex flex-wrap gap-[var(--lc-space-md)]">
        <Button type="button" variant="default" onClick={onPrimary}>
          {primaryLabel}
        </Button>
        {secondaryLabel && onSecondary ? (
          <Button type="button" variant="ghost" onClick={onSecondary}>
            {secondaryLabel}
          </Button>
        ) : null}
      </div>
    </div>
  )
}

export function SelfApprovalRejectBlock(props: {
  title: string
  body: string
  ctaLabel: string
  onEscalate: () => void
  closeLabel: string
  onClose: () => void
}) {
  return (
    <BodySwapBlock
      tone="danger"
      icon={<AlertTriangle className="h-8 w-8" />}
      title={props.title}
      body={props.body}
      primaryLabel={props.ctaLabel}
      onPrimary={props.onEscalate}
      secondaryLabel={props.closeLabel}
      onSecondary={props.onClose}
    />
  )
}

export function StaleRequestBlock(props: {
  title: string
  body: string
  ctaLabel: string
  onReload: () => void
  closeLabel: string
  onClose: () => void
}) {
  return (
    <BodySwapBlock
      tone="warning"
      icon={<RefreshCw className="h-8 w-8" />}
      title={props.title}
      body={props.body}
      primaryLabel={props.ctaLabel}
      onPrimary={props.onReload}
      secondaryLabel={props.closeLabel}
      onSecondary={props.onClose}
    />
  )
}

export function VoteMismatchBlock(props: {
  title: string
  body: string
  ctaLabel: string
  onEscalate: () => void
  closeLabel: string
  onClose: () => void
}) {
  return (
    <BodySwapBlock
      tone="info"
      icon={<Users className="h-8 w-8" />}
      title={props.title}
      body={props.body}
      primaryLabel={props.ctaLabel}
      onPrimary={props.onEscalate}
      secondaryLabel={props.closeLabel}
      onSecondary={props.onClose}
    />
  )
}
