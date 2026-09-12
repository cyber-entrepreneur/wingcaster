import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { rt, type RegisterLocale } from './registerCopy'

export type DupIdentityModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  locale?: RegisterLocale
  supportHref?: string
  signInHref?: string
}

/**
 * FREE_TRIAL_ALREADY_CLAIMED modal — identifier-agnostic copy (PR #49).
 * Radix Dialog provides focus trap + Escape + outside-click.
 */
export function DupIdentityModal({
  open,
  onOpenChange,
  locale = 'en',
  supportHref = 'mailto:support@wingcaster.com',
  signInHref = '/login?from=register',
}: DupIdentityModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="dup-identity-modal">
        <DialogHeader>
          <DialogTitle>{rt('dup.title', locale)}</DialogTitle>
          <DialogDescription>{rt('dup.body', locale)}</DialogDescription>
        </DialogHeader>
        <div className="mt-[var(--lc-space-md)] flex flex-col gap-[var(--lc-space-sm)] sm:flex-row">
          <Button asChild variant="default" className="w-full sm:w-auto">
            <Link to={signInHref}>{rt('dup.signin', locale)}</Link>
          </Button>
          <Button asChild variant="outline" className="w-full sm:w-auto">
            <a href={supportHref}>{rt('dup.support', locale)}</a>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
