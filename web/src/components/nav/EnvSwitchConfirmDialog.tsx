import { useEffect, useId, useState } from 'react'
import { AlertTriangle, Loader2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { envCopy, ENV_SWITCHER_COPY } from '@/components/nav/EnvBadge'
import { LIVE_SWITCH_CONFIRM_TOKEN } from '@/hooks/useEnv'
import type { AppLocale } from '@/hooks/useLocale'
import { cn } from '@/lib/utils'

export interface EnvSwitchConfirmDialogProps {
  open: boolean
  locale?: AppLocale
  switching?: boolean
  error?: string | null
  sessionChangedElsewhere?: boolean
  onOpenChange: (open: boolean) => void
  /**
   * Called only when both checkboxes are checked AND type-to-confirm
   * matches `SWITCH TO LIVE` exactly (case-sensitive). Parent must pass
   * `{ confirmed: true }` into useEnv().confirmSwitchToLive.
   */
  onConfirm: () => void | Promise<void>
}

/**
 * PA-NAV-001 — LIVE-bound switch confirmation.
 * CTA stays disabled until both checklist items AND exact type-to-confirm pass.
 * Escape / backdrop close without switching (blocked while mid-switch).
 */
export function EnvSwitchConfirmDialog({
  open,
  locale = 'en',
  switching = false,
  error = null,
  sessionChangedElsewhere = false,
  onOpenChange,
  onConfirm,
}: EnvSwitchConfirmDialogProps) {
  const titleId = useId()
  const descId = useId()
  const typeId = useId()
  const check1Id = useId()
  const check2Id = useId()

  const [check1, setCheck1] = useState(false)
  const [check2, setCheck2] = useState(false)
  const [typed, setTyped] = useState('')

  useEffect(() => {
    if (!open) {
      setCheck1(false)
      setCheck2(false)
      setTyped('')
    }
  }, [open])

  const tokenMatches = typed === LIVE_SWITCH_CONFIRM_TOKEN
  const canSubmit = check1 && check2 && tokenMatches && !switching && !sessionChangedElsewhere

  const handleOpenChange = (next: boolean) => {
    if (!next && switching) return
    onOpenChange(next)
  }

  const handleConfirm = async () => {
    if (!canSubmit) return
    await onConfirm()
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        role="alertdialog"
        aria-labelledby={titleId}
        aria-describedby={descId}
        aria-modal="true"
        className={cn(
          'max-w-[480px] rounded-[var(--lc-radius-md)]',
          'border border-[var(--lc-border)] bg-[var(--lc-surface-raised)]',
          'p-[var(--lc-space-lg)] shadow-[var(--lc-elevation-lg)]',
          'text-[var(--lc-text-primary)]',
        )}
        onEscapeKeyDown={(event) => {
          if (switching) event.preventDefault()
        }}
        onPointerDownOutside={(event) => {
          if (switching) event.preventDefault()
        }}
      >
        <DialogHeader className="pr-10">
          <DialogTitle id={titleId} className="flex items-center gap-[var(--lc-space-xs)]">
            <AlertTriangle
              className="h-5 w-5 shrink-0 text-[var(--lc-status-underOffer-dot)]"
              aria-hidden="true"
            />
            {envCopy('confirm.title', locale)}
          </DialogTitle>
          <DialogDescription id={descId} className="sr-only">
            {envCopy('confirm.body', locale)}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-[var(--lc-space-md)]">
          <div
            className={cn(
              'flex gap-[var(--lc-space-sm)] rounded-[var(--lc-radius-sm)]',
              'bg-[var(--lc-status-underOffer-bg)] px-[var(--lc-space-sm)] py-[var(--lc-space-xs)]',
              'text-[var(--lc-status-underOffer-fg)]',
            )}
          >
            <AlertTriangle
              className="mt-0.5 h-4 w-4 shrink-0 text-[var(--lc-status-underOffer-dot)]"
              aria-hidden="true"
            />
            <p className="font-[var(--lc-type-body-sm)] tracking-[var(--lc-tracking-body-sm)]">
              {envCopy('confirm.body', locale)}
            </p>
          </div>

          {sessionChangedElsewhere ? (
            <div
              role="alert"
              className={cn(
                'rounded-[var(--lc-radius-sm)] border border-[var(--lc-border-strong)]',
                'bg-[var(--lc-surface-sunken)] px-[var(--lc-space-sm)] py-[var(--lc-space-xs)]',
                'text-[var(--lc-text-primary)] font-[var(--lc-type-body-sm)]',
              )}
            >
              {envCopy('confirm.sessionChanged', locale)}
            </div>
          ) : null}

          <div className="space-y-[var(--lc-space-sm)]">
            <label
              htmlFor={check1Id}
              className="flex cursor-pointer items-start gap-[var(--lc-space-xs)]"
            >
              <input
                id={check1Id}
                type="checkbox"
                checked={check1}
                onChange={(e) => setCheck1(e.target.checked)}
                disabled={switching || sessionChangedElsewhere}
                className="mt-1 h-4 w-4 accent-[var(--lc-action-primary)]"
              />
              <span className="font-[var(--lc-type-body-sm)] tracking-[var(--lc-tracking-body-sm)]">
                {envCopy('confirm.check1', locale)}
              </span>
            </label>
            <label
              htmlFor={check2Id}
              className="flex cursor-pointer items-start gap-[var(--lc-space-xs)]"
            >
              <input
                id={check2Id}
                type="checkbox"
                checked={check2}
                onChange={(e) => setCheck2(e.target.checked)}
                disabled={switching || sessionChangedElsewhere}
                className="mt-1 h-4 w-4 accent-[var(--lc-action-primary)]"
              />
              <span className="font-[var(--lc-type-body-sm)] tracking-[var(--lc-tracking-body-sm)]">
                {envCopy('confirm.check2', locale)}
              </span>
            </label>
          </div>

          <div className="space-y-[var(--lc-space-2xs)]">
            <Label htmlFor={typeId}>{envCopy('confirm.type.label', locale)}</Label>
            <Input
              id={typeId}
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoComplete="off"
              spellCheck={false}
              disabled={switching || sessionChangedElsewhere}
              aria-invalid={typed.length > 0 && !tokenMatches}
              placeholder={ENV_SWITCHER_COPY['confirm.type.value'].en}
            />
          </div>

          {error ? (
            <div
              role="alert"
              className={cn(
                'rounded-[var(--lc-radius-sm)]',
                'bg-[var(--lc-status-unpublished-bg)] px-[var(--lc-space-sm)] py-[var(--lc-space-xs)]',
                'text-[var(--lc-status-unpublished-fg)] font-[var(--lc-type-body-sm)]',
              )}
            >
              {error}
            </div>
          ) : null}

          <div className="flex flex-wrap justify-end gap-[var(--lc-space-xs)]">
            <Button
              type="button"
              variant="secondary"
              disabled={switching}
              onClick={() => handleOpenChange(false)}
            >
              {envCopy('confirm.cancel', locale)}
            </Button>
            <Button
              type="button"
              disabled={!canSubmit}
              onClick={() => void handleConfirm()}
            >
              {switching ? (
                <>
                  <Loader2 className="me-2 h-4 w-4 animate-spin" aria-hidden="true" />
                  {envCopy('switching.label', locale)}
                </>
              ) : (
                envCopy('confirm.cta', locale)
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

/** Pure helper for tests — CTA enablement contract. */
export function isLiveSwitchConfirmReady(input: {
  check1: boolean
  check2: boolean
  typed: string
}): boolean {
  return input.check1 && input.check2 && input.typed === LIVE_SWITCH_CONFIRM_TOKEN
}
