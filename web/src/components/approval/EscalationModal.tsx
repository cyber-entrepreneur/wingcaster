import { useCallback, useEffect, useMemo, useState } from 'react'
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
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { useToast } from '@/components/ui/toast'
import { useTwoPersonCopy, type TwoPersonCopyKey } from './twoPersonCopy'
import {
  ESCALATION_REASONS,
  type EscalationReason,
  type EligibleEscalationTarget,
  type NotifyChannel,
} from './approvalTypes'

const REASON_COPY: Record<EscalationReason, TwoPersonCopyKey> = {
  out_of_scope_authority: 'esc.reason.out_of_scope_authority',
  conflict_of_interest: 'esc.reason.conflict_of_interest',
  requires_domain_expertise: 'esc.reason.requires_domain_expertise',
  contentious: 'esc.reason.contentious',
  compliance_concern: 'esc.reason.compliance_concern',
  other: 'esc.reason.other',
}

const FIELD_CLASS =
  'min-h-tap w-full rounded-[var(--lc-radius-md)] border border-[var(--lc-border-strong)] bg-[var(--lc-surface)] px-3 py-2 text-sm text-[var(--lc-text-primary)] focus-visible:outline-none disabled:opacity-50'

export interface EscalationModalProps {
  requestId: string | null
  version: number | null
  open: boolean
  onClose: () => void
  onEscalated?: () => void
}

/** PA-APR-005 — escalate an approval request to another Platform Admin. */
export function EscalationModal({
  requestId,
  version,
  open,
  onClose,
  onEscalated,
}: EscalationModalProps) {
  const { t } = useTwoPersonCopy()
  const { addToast } = useToast()

  const [targets, setTargets] = useState<EligibleEscalationTarget[]>([])
  const [hop, setHop] = useState<{ hop: number; max: number } | null>(null)
  const [targetId, setTargetId] = useState('')
  const [reason, setReason] = useState<EscalationReason>('out_of_scope_authority')
  const [notes, setNotes] = useState('')
  const [channels, setChannels] = useState<Record<NotifyChannel, boolean>>({
    email: true,
    slack: false,
    teams: false,
  })
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!open || !requestId) return
    setTargetId('')
    setReason('out_of_scope_authority')
    setNotes('')
    setChannels({ email: true, slack: false, teams: false })
    void api
      .getEligibleEscalationTargets(requestId)
      .then((res) => {
        setTargets(res.targets)
        setHop({ hop: res.hop, max: res.max_hops })
      })
      .catch(() => {
        setTargets([])
        setHop(null)
      })
  }, [open, requestId])

  const minNotes = reason === 'other' ? 30 : 10
  const notesOk = notes.trim().length >= minNotes && notes.trim().length <= 1000
  const canSubmit = Boolean(targetId) && notesOk && !submitting

  const selectedChannels = useMemo(
    () => (Object.keys(channels) as NotifyChannel[]).filter((c) => channels[c]),
    [channels],
  )

  const handleSubmit = useCallback(async () => {
    if (!requestId || version == null || !canSubmit) return
    setSubmitting(true)
    try {
      await api.escalateApproval(requestId, {
        targetApproverId: targetId,
        reasonVocab: reason,
        notes: notes.trim(),
        notifyChannels: selectedChannels,
        version,
      })
      addToast({ variant: 'success', title: t('esc.success') })
      onEscalated?.()
      onClose()
    } catch {
      addToast({ variant: 'error', title: t('toast.fail.title') })
    } finally {
      setSubmitting(false)
    }
  }, [requestId, version, canSubmit, targetId, reason, notes, selectedChannels, addToast, t, onEscalated, onClose])

  return (
    <Dialog open={open} onOpenChange={(next) => (!next && !submitting ? onClose() : undefined)}>
      <DialogContent className="max-w-[560px]">
        <DialogHeader>
          <DialogTitle>{t('esc.title')}</DialogTitle>
          <DialogDescription>{t('esc.subtitle')}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-[var(--lc-space-md)]">
          {hop ? (
            <p className="text-[var(--lc-text-muted)]" style={{ font: 'var(--lc-type-caption)' }}>
              {t('esc.hop', { hop: hop.hop, max: hop.max })}
            </p>
          ) : null}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="esc-target">{t('esc.target.label')}</Label>
            <select
              id="esc-target"
              className={FIELD_CLASS}
              value={targetId}
              onChange={(e) => setTargetId(e.target.value)}
              disabled={submitting}
            >
              <option value="" disabled>
                {t('esc.target.placeholder')}
              </option>
              {targets.map((target) => (
                <option key={target.id} value={target.id}>
                  {target.display_name}
                  {target.out_of_office ? ` — ${t('esc.target.ooo')}` : ''}
                </option>
              ))}
            </select>
            {targets.length === 0 ? (
              <p className="text-[var(--lc-text-muted)]" style={{ font: 'var(--lc-type-caption)' }}>
                {t('esc.target.empty')}
              </p>
            ) : null}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="esc-reason">{t('esc.reason.label')}</Label>
            <select
              id="esc-reason"
              className={FIELD_CLASS}
              value={reason}
              onChange={(e) => setReason(e.target.value as EscalationReason)}
              disabled={submitting}
            >
              {ESCALATION_REASONS.map((r) => (
                <option key={r} value={r}>
                  {t(REASON_COPY[r])}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="esc-notes">{t('esc.notes.label')}</Label>
            <textarea
              id="esc-notes"
              className={`${FIELD_CLASS} min-h-[88px] resize-y`}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t('esc.notes.placeholder')}
              maxLength={1000}
              disabled={submitting}
              aria-describedby="esc-notes-help"
            />
            <p id="esc-notes-help" className="text-[var(--lc-text-muted)]" style={{ font: 'var(--lc-type-caption)' }}>
              {t('esc.notes.min', { min: minNotes })}
            </p>
          </div>

          <fieldset className="flex flex-col gap-2">
            <legend className="text-sm font-medium text-[var(--lc-text-primary)]">{t('esc.notify.label')}</legend>
            <div className="flex flex-wrap gap-4">
              {(['email', 'slack', 'teams'] as NotifyChannel[]).map((channel) => (
                <label key={channel} className="flex items-center gap-2 text-sm text-[var(--lc-text-secondary)]">
                  <Checkbox
                    checked={channels[channel]}
                    disabled={channel === 'email' || submitting}
                    onCheckedChange={(v) =>
                      setChannels((prev) => ({ ...prev, [channel]: v === true }))
                    }
                  />
                  {t(`esc.notify.${channel}` as TwoPersonCopyKey)}
                </label>
              ))}
            </div>
          </fieldset>
        </div>

        <div className="mt-2 flex justify-end gap-[var(--lc-space-md)]">
          <Button type="button" variant="ghost" onClick={onClose} disabled={submitting}>
            {t('btn.cancel')}
          </Button>
          <Button type="button" variant="default" onClick={() => void handleSubmit()} disabled={!canSubmit} aria-disabled={!canSubmit}>
            {submitting ? (
              <>
                <Loader2 className="me-2 h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden />
                {t('esc.submitting')}
              </>
            ) : (
              t('esc.submit')
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
