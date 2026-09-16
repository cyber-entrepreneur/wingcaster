import { useCallback, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { api } from '@/api/client'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { useToast } from '@/components/ui/toast'
import { useTwoPersonCopy } from './twoPersonCopy'

const FIELD_CLASS =
  'min-h-tap w-full rounded-[var(--lc-radius-md)] border border-[var(--lc-border-strong)] bg-[var(--lc-surface)] px-3 py-2 text-sm text-[var(--lc-text-primary)] focus-visible:outline-none disabled:opacity-50'

export interface RecallModalProps {
  requestId: string | null
  version: number | null
  open: boolean
  onClose: () => void
  onRecalled?: () => void
}

/** PA-APR-006 — submitter-only recall (withdraw) of a pending approval request. */
export function RecallModal({ requestId, version, open, onClose, onRecalled }: RecallModalProps) {
  const { t } = useTwoPersonCopy()
  const { addToast } = useToast()

  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const reasonOk = reason.trim().length >= 10 && reason.trim().length <= 1000
  const canSubmit = reasonOk && !submitting

  const handleSubmit = useCallback(async () => {
    if (!requestId || version == null || !canSubmit) return
    setSubmitting(true)
    try {
      await api.withdrawFinApproval(requestId, { reason: reason.trim(), version })
      addToast({ variant: 'success', title: t('recall.success') })
      onRecalled?.()
      onClose()
    } catch {
      addToast({ variant: 'error', title: t('toast.fail.title') })
    } finally {
      setSubmitting(false)
    }
  }, [requestId, version, canSubmit, reason, addToast, t, onRecalled, onClose])

  return (
    <Dialog open={open} onOpenChange={(next) => (!next && !submitting ? onClose() : undefined)}>
      <DialogContent className="max-w-[520px]">
        <DialogHeader>
          <DialogTitle>{t('recall.title')}</DialogTitle>
          <DialogDescription>{t('recall.subtitle')}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="recall-reason">{t('recall.reason.label')}</Label>
          <textarea
            id="recall-reason"
            className={`${FIELD_CLASS} min-h-[88px] resize-y`}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={t('recall.reason.placeholder')}
            maxLength={1000}
            disabled={submitting}
            aria-describedby="recall-reason-help"
          />
          <p id="recall-reason-help" className="text-[var(--lc-text-muted)]" style={{ font: 'var(--lc-type-caption)' }}>
            {t('esc.notes.min', { min: 10 })}
          </p>
        </div>

        <div className="mt-2 flex justify-end gap-[var(--lc-space-md)]">
          <Button type="button" variant="ghost" onClick={onClose} disabled={submitting}>
            {t('btn.cancel')}
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={() => void handleSubmit()}
            disabled={!canSubmit}
            aria-disabled={!canSubmit}
          >
            {submitting ? (
              <>
                <Loader2 className="me-2 h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden />
                {t('recall.submitting')}
              </>
            ) : (
              t('recall.submit')
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
