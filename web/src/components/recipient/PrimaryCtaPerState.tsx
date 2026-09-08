import { useState } from 'react'
import type { LucideIcon } from 'lucide-react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

/**
 * One CTA slot in the REC-family primary-action stack.
 *
 * Used by: AGT-REC-002, AGT-REC-003, AGT-REC-004, AGT-REC-005, AGT-REC-006,
 * AGT-PUB-003.
 *
 * Doctrine: no `variant="destructive"` red on any REC screen — withdrawal /
 * decline use `ghost` with muted label.
 */
export type CtaAction = {
  key: string
  label: string
  variant: 'default' | 'outline' | 'ghost'
  /** Client-side route. */
  href?: string
  /** For tenant-switch / withdraw / etc. */
  onClick?: () => void
  icon?: LucideIcon
  /** In-flight action. */
  loading?: boolean
  disabled?: boolean
  /** Opens Dialog before firing. */
  confirm?: {
    title: string
    body: string
    confirm_label: string
    cancel_label: string
  }
}

/**
 * Exactly-one-primary action stack for REC outcome screens.
 *
 * Used by: AGT-REC-002, AGT-REC-003, AGT-REC-004, AGT-REC-005, AGT-REC-006,
 * AGT-PUB-003.
 *
 * Rules:
 * - Exactly ONE primary (`primary` prop).
 * - Secondary uses `outline`; tertiary uses `ghost` only.
 * - No destructive red on REC.
 * - `layout="stacked"` = mobile sticky / desktop sidebar; `inline` = desktop bottom row.
 */
export type PrimaryCtaPerStateProps = {
  /** Required — exactly one. */
  primary: CtaAction
  /** Optional — max one. */
  secondary?: CtaAction
  /** Optional — max one, ghost variant only. */
  tertiary?: CtaAction
  /** stacked = mobile / sidebar; inline = desktop bottom. */
  layout: 'stacked' | 'inline'
}

type PendingConfirm = {
  action: CtaAction
  onConfirm: () => void
}

function ActionButton({
  action,
  size = 'lg',
  className,
  forceVariant,
  onRequestConfirm,
}: {
  action: CtaAction
  size?: 'default' | 'lg'
  className?: string
  forceVariant?: CtaAction['variant']
  onRequestConfirm: (action: CtaAction, run: () => void) => void
}) {
  const Icon = action.icon
  const variant = forceVariant ?? action.variant

  const run = () => {
    action.onClick?.()
  }

  const handleClick = () => {
    if (action.disabled || action.loading) return
    if (action.confirm) {
      onRequestConfirm(action, run)
      return
    }
    run()
  }

  const content = (
    <>
      {action.loading ? (
        <Loader2 className="me-2 h-4 w-4 animate-spin" aria-hidden="true" />
      ) : Icon ? (
        <Icon className="me-2 h-4 w-4" aria-hidden="true" />
      ) : null}
      {action.label}
    </>
  )

  const buttonClassName = cn(
    'min-h-tap',
    variant === 'ghost' && 'text-[var(--lc-text-muted)]',
    className,
  )

  if (action.href && !action.confirm && !action.onClick) {
    return (
      <Button
        asChild
        size={size}
        variant={variant}
        className={buttonClassName}
        aria-busy={action.loading || undefined}
        aria-disabled={action.disabled || undefined}
      >
        <a href={action.href}>{content}</a>
      </Button>
    )
  }

  return (
    <Button
      type="button"
      size={size}
      variant={variant}
      className={buttonClassName}
      disabled={action.disabled}
      aria-busy={action.loading || undefined}
      onClick={handleClick}
    >
      {content}
    </Button>
  )
}

export function PrimaryCtaPerState({
  primary,
  secondary,
  tertiary,
  layout,
}: PrimaryCtaPerStateProps) {
  const [pending, setPending] = useState<PendingConfirm | null>(null)

  const onRequestConfirm = (action: CtaAction, onConfirm: () => void) => {
    setPending({ action, onConfirm })
  }

  const closeConfirm = () => setPending(null)

  const handleConfirm = () => {
    pending?.onConfirm()
    closeConfirm()
  }

  const tertiaryAction: CtaAction | undefined = tertiary
    ? { ...tertiary, variant: 'ghost' }
    : undefined

  return (
    <div
      className={cn(
        layout === 'stacked' &&
          'flex w-full max-w-[320px] flex-col gap-[var(--lc-space-sm)]',
        layout === 'inline' &&
          'flex w-full flex-row flex-wrap items-center justify-end gap-[var(--lc-space-sm)]',
      )}
      data-rec-cta-layout={layout}
    >
      {/* Stacked mobile sticky bar: tertiary → secondary → primary (top → bottom). */}
      {layout === 'stacked' && tertiaryAction ? (
        <ActionButton
          action={tertiaryAction}
          forceVariant="ghost"
          size="default"
          className="w-full justify-center"
          onRequestConfirm={onRequestConfirm}
        />
      ) : null}
      {layout === 'stacked' && secondary ? (
        <ActionButton
          action={secondary}
          forceVariant="outline"
          size="default"
          className="w-full justify-center"
          onRequestConfirm={onRequestConfirm}
        />
      ) : null}
      <ActionButton
        action={{ ...primary, variant: 'default' }}
        forceVariant="default"
        size="lg"
        className={cn(layout === 'stacked' && 'w-full justify-center')}
        onRequestConfirm={onRequestConfirm}
      />
      {layout === 'inline' && secondary ? (
        <ActionButton
          action={secondary}
          forceVariant="outline"
          size="default"
          onRequestConfirm={onRequestConfirm}
        />
      ) : null}
      {layout === 'inline' && tertiaryAction ? (
        <ActionButton
          action={tertiaryAction}
          forceVariant="ghost"
          size="default"
          onRequestConfirm={onRequestConfirm}
        />
      ) : null}

      <Dialog open={pending != null} onOpenChange={(open) => !open && closeConfirm()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{pending?.action.confirm?.title}</DialogTitle>
            <DialogDescription>{pending?.action.confirm?.body}</DialogDescription>
          </DialogHeader>
          <div className="mt-[var(--lc-space-md)] flex flex-col-reverse gap-[var(--lc-space-sm)] sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={closeConfirm}>
              {pending?.action.confirm?.cancel_label}
            </Button>
            <Button type="button" variant="default" onClick={handleConfirm}>
              {pending?.action.confirm?.confirm_label}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
