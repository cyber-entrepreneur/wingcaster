import { useCallback, useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { api } from '@/api/client'
import { cn } from '@/lib/utils'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Numeric } from '@/components/ui/numeric'
import { TypeToConfirmInput, phraseMatches } from '@/components/ui/type-to-confirm-input'
import { useToast } from '@/components/ui/toast'
import { useTwoPersonCopy } from './twoPersonCopy'
import {
  ExecuteRequestSummary,
  ExecuteDiffPanel,
  ExecuteRiskSignals,
  ExecuteLedgerPreview,
} from './ExecutePanels'
import {
  SelfApprovalRejectBlock,
  StaleRequestBlock,
  VoteMismatchBlock,
} from './StateBlocks'
import type { ExecutePreview, ExecuteResult } from './approvalTypes'

type Phase =
  | 'loading'
  | 'load_error'
  | 'ready'
  | 'in_flight'
  | 'self_approval'
  | 'stale'
  | 'vote_mismatch'

export interface TwoPersonExecuteModalProps {
  /** Approval request id to execute. When null the modal is closed. */
  requestId: string | null
  open: boolean
  onClose: () => void
  /** Fired after a successful execute with the server outcome payload. */
  onExecuted?: (result: ExecuteResult) => void
  /** Opens the escalation flow for this request (self-approval / vote-mismatch). */
  onEscalate?: (requestId: string) => void
  /** Reloads the parent detail screen after a stale (409) response. */
  onReloadRequest?: (requestId: string) => void
}

interface ApiError extends Error {
  error?: string
  status?: number
  current_version?: number
  delta?: string
}

function relativeTime(iso: string): string {
  const then = Date.parse(iso)
  if (Number.isNaN(then)) return iso
  const deltaSec = Math.round((Date.now() - then) / 1000)
  if (deltaSec < 60) return 'just now'
  const mins = Math.round(deltaSec / 60)
  if (mins < 60) return `${mins}m ago`
  const hours = Math.round(mins / 60)
  if (hours < 48) return `${hours}h ago`
  return `${Math.round(hours / 24)}d ago`
}

/**
 * PA-APR-003 — WF-20 two-person action confirmation modal.
 *
 * The terminal commit surface for every `fin.approval_requests` two-person
 * execute. Opened from a workflow approval-detail screen; consumes the
 * unified `/api/admin/fin/approvals/:id/execute` backend.
 */
export function TwoPersonExecuteModal({
  requestId,
  open,
  onClose,
  onExecuted,
  onEscalate,
  onReloadRequest,
}: TwoPersonExecuteModalProps) {
  const { t } = useTwoPersonCopy()
  const { addToast } = useToast()

  const [phase, setPhase] = useState<Phase>('loading')
  const [preview, setPreview] = useState<ExecutePreview | null>(null)
  const [consent, setConsent] = useState(false)
  const [phraseInput, setPhraseInput] = useState('')

  const loadPreview = useCallback(async () => {
    if (!requestId) return
    setPhase('loading')
    setConsent(false)
    setPhraseInput('')
    try {
      const data = await api.getApprovalExecutePreview(requestId)
      setPreview(data)
      if (data.self_approval) {
        setPhase('self_approval')
        return
      }
      setPhase('ready')
    } catch (err) {
      const e = err as ApiError
      if (e.error === 'SELF_APPROVAL_FORBIDDEN' || e.status === 403) {
        setPhase('self_approval')
        return
      }
      setPhase('load_error')
    }
  }, [requestId])

  useEffect(() => {
    if (open && requestId) void loadPreview()
  }, [open, requestId, loadPreview])

  const isHighValue = preview?.request.value_tier === 'high_value'
  const phraseOk =
    !isHighValue ||
    (preview?.confirmation_phrase != null &&
      phraseMatches(phraseInput, preview.confirmation_phrase))
  const ledgerUnbalanced = preview?.ledger_impact != null && !preview.ledger_impact.balanced
  const canConfirm = phase === 'ready' && consent && phraseOk && !ledgerUnbalanced

  const handleConfirm = useCallback(async () => {
    if (!requestId || !preview || !canConfirm) return
    setPhase('in_flight')
    try {
      const result = await api.executeApproval(requestId, {
        workflowCode: preview.request.workflow_code,
        confirmationPhrase: isHighValue ? phraseInput.trim() : undefined,
        version: preview.request.version,
      })
      addToast({
        variant: 'success',
        title: t('toast.success.title'),
        description: result.short_action_summary,
      })
      onExecuted?.(result)
      onClose()
    } catch (err) {
      const e = err as ApiError
      switch (e.error) {
        case 'SELF_APPROVAL_FORBIDDEN':
          setPhase('self_approval')
          return
        case 'PRECONDITION_FAILED':
          setPhase('stale')
          return
        case 'VOTE_MISMATCH':
          setPhase('vote_mismatch')
          return
        case 'LEDGER_PREVIEW_UNBALANCED':
          setPreview((prev) =>
            prev && prev.ledger_impact
              ? { ...prev, ledger_impact: { ...prev.ledger_impact, balanced: false } }
              : prev,
          )
          setPhase('ready')
          return
        default:
          addToast({
            variant: 'error',
            title: t('toast.fail.title'),
            description: t('toast.fail.generic'),
          })
          setPhase('ready')
      }
    }
  }, [requestId, preview, canConfirm, isHighValue, phraseInput, addToast, t, onExecuted, onClose])

  const closeModal = useCallback(() => {
    if (phase === 'in_flight') return
    onClose()
  }, [phase, onClose])

  const envChip = (env: string) => {
    const isTest = env === 'test'
    return (
      <Badge variant={isTest ? 'underOffer' : 'published'} status={isTest ? 'pending' : 'published'}>
        {isTest ? t('chip.test') : t('chip.live')}
      </Badge>
    )
  }

  const renderBody = () => {
    if (phase === 'loading') {
      return (
        <div className="flex items-center gap-2 py-8 text-[var(--lc-text-muted)]" role="status">
          <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden />
          {t('loading.preview')}
        </div>
      )
    }
    if (phase === 'load_error') {
      return (
        <div className="flex flex-col items-start gap-3 py-6" role="alert">
          <p className="text-[var(--lc-text-secondary)]">{t('loading.error')}</p>
          <Button type="button" variant="outline" onClick={() => void loadPreview()}>
            {t('loading.retry')}
          </Button>
        </div>
      )
    }
    if (phase === 'self_approval') {
      return (
        <SelfApprovalRejectBlock
          title={t('self.title')}
          body={t('self.body')}
          ctaLabel={t('self.cta')}
          onEscalate={() => {
            if (requestId) onEscalate?.(requestId)
            onClose()
          }}
          closeLabel={t('self.close')}
          onClose={onClose}
        />
      )
    }
    if (phase === 'stale') {
      return (
        <StaleRequestBlock
          title={t('stale.title')}
          body={t('stale.body')}
          ctaLabel={t('stale.cta')}
          onReload={() => {
            if (requestId) onReloadRequest?.(requestId)
            onClose()
          }}
          closeLabel={t('self.close')}
          onClose={onClose}
        />
      )
    }
    if (phase === 'vote_mismatch') {
      return (
        <VoteMismatchBlock
          title={t('mismatch.title')}
          body={t('mismatch.body')}
          ctaLabel={t('mismatch.cta')}
          onEscalate={() => {
            if (requestId) onEscalate?.(requestId)
            onClose()
          }}
          closeLabel={t('self.close')}
          onClose={onClose}
        />
      )
    }
    if (!preview) return null

    return (
      <div
        className={cn('flex flex-col gap-[var(--lc-space-md)]', phase === 'in_flight' && 'opacity-65')}
        aria-live="polite"
      >
        <ExecuteRequestSummary preview={preview} />
        <ExecuteDiffPanel diff={preview.diff} />
        <ExecuteRiskSignals signals={preview.risk_signals} />
        {preview.ledger_impact ? (
          <>
            {ledgerUnbalanced ? (
              <p
                role="alert"
                className="rounded-[var(--lc-radius-md)] bg-[var(--lc-status-unpublished-bg)] p-3 text-sm text-[var(--lc-status-unpublished-fg)]"
              >
                {t('ledger.unbalanced', { delta: preview.ledger_impact.totals.debit })}
              </p>
            ) : null}
            <ExecuteLedgerPreview ledger={preview.ledger_impact} env={preview.env} />
          </>
        ) : null}

        <div className="flex items-start gap-2">
          <Checkbox
            id="two-person-consent"
            checked={consent}
            onCheckedChange={(v) => setConsent(v === true)}
            disabled={phase === 'in_flight'}
            aria-labelledby="two-person-consent-label"
            className="mt-0.5"
          />
          <Label
            id="two-person-consent-label"
            htmlFor="two-person-consent"
            className="cursor-pointer text-[var(--lc-text-primary)]"
          >
            {t('consent.label')}
          </Label>
        </div>

        {isHighValue && preview.confirmation_phrase ? (
          <TypeToConfirmInput
            phrase={preview.confirmation_phrase}
            value={phraseInput}
            onValueChange={setPhraseInput}
            disabled={phase === 'in_flight'}
            autoFocus
            renderLabel={(phraseNode) => (
              <>
                {t('ttc.label.before')} {phraseNode} {t('ttc.label.after')}
              </>
            )}
            helper={t('ttc.helper')}
            mismatchText={t('ttc.mismatch')}
          />
        ) : null}

        <p className="text-[var(--lc-text-muted)]" style={{ font: 'var(--lc-type-caption)' }}>
          {t('audit.note')}
        </p>
      </div>
    )
  }

  const showFooter = phase === 'ready' || phase === 'in_flight'

  return (
    <Dialog open={open} onOpenChange={(next) => (!next ? closeModal() : undefined)}>
      <DialogContent
        className="max-w-[640px]"
        onEscapeKeyDown={(e) => {
          if (phase === 'in_flight') e.preventDefault()
        }}
        onInteractOutside={(e) => {
          if (phase === 'in_flight') e.preventDefault()
        }}
      >
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2">
            {t('execute.title')}
            {preview ? envChip(preview.env) : null}
            {preview ? (
              <Badge variant="outline" className="font-[family-name:var(--lc-font-mono)]">
                {preview.request.workflow_code}
              </Badge>
            ) : null}
          </DialogTitle>
          {preview ? (
            <DialogDescription>
              <span>{t('execute.subtitle', { last6: preview.request.last6, rel: '' })}</span>
              <Numeric as="span" title={preview.request.submitted_at}>
                {relativeTime(preview.request.submitted_at)}
              </Numeric>
            </DialogDescription>
          ) : null}
        </DialogHeader>

        {renderBody()}

        {showFooter ? (
          <div className="mt-2 flex justify-end gap-[var(--lc-space-md)]">
            <Button type="button" variant="ghost" onClick={closeModal} disabled={phase === 'in_flight'}>
              {t('btn.cancel')}
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => void handleConfirm()}
              disabled={!canConfirm}
              aria-disabled={!canConfirm}
            >
              {phase === 'in_flight' ? (
                <>
                  <Loader2 className="me-2 h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden />
                  {t('btn.confirm.executing')}
                </>
              ) : (
                t('btn.confirm.generic')
              )}
            </Button>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
