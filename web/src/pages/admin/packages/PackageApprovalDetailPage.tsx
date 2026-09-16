/**
 * PA-PKG-003 (detail) — Package approval decision surface. Consumes the shared
 * WF-20 two-person primitives (TwoPersonExecuteModal / EscalationModal /
 * RecallModal via useTwoPersonExecuteModal) for the approve/escalate/recall path.
 * The version-specific reject flow uses the package reject endpoint.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Numeric } from '@/components/ui/numeric'
import { Label } from '@/components/ui/label'
import { PIIMask } from '@/components/security/PIIMask'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useToast } from '@/components/ui/toast'
import {
  TwoPersonExecuteModal,
  EscalationModal,
  RecallModal,
  useTwoPersonExecuteModal,
} from '@/components/approval'
import { PackageConsoleFrame, PackageStatusBadge } from './packageShared'
import { formatMoneyMinor, formatRelative } from './packageFormat'
import { usePackagesCopy } from './packagesCopy'
import { packagesApi } from './api'
import { diffRequiresTwoPerson, type PendingApprovalRow } from './types'

export function PackageApprovalDetailPage() {
  const navigate = useNavigate()
  const { versionId = '' } = useParams()
  const [searchParams] = useSearchParams()
  const returnTo = searchParams.get('return_to') || '/admin/packages/approvals'
  const { addToast } = useToast()
  const { t } = usePackagesCopy()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [row, setRow] = useState<PendingApprovalRow | null>(null)
  const [rejectOpen, setRejectOpen] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [rejecting, setRejecting] = useState(false)
  const [escalateOpen, setEscalateOpen] = useState(false)
  const [recallOpen, setRecallOpen] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const data = await packagesApi.pendingApprovals()
      const found = (data.approvals || []).find((r) => r.id === versionId) || null
      setRow(found)
    } catch {
      setError(true)
      setRow(null)
    } finally {
      setLoading(false)
    }
  }, [versionId])

  useEffect(() => {
    void load()
  }, [load])

  const { openExecuteModal, executeModalProps } = useTwoPersonExecuteModal({
    onExecuted: () => {
      addToast({
        variant: 'success',
        title: t('appr.toast.approved', { version: row?.version_number ?? '' }),
      })
      navigate(returnTo)
    },
    onEscalate: () => setEscalateOpen(true),
    onReloadRequest: () => void load(),
  })

  const twoPerson = row ? diffRequiresTwoPerson(row.diff) : false
  const baseVersion = row?.diff.versus_version_number ?? (row ? row.version_number - 1 : 0)

  const priceBefore = row ? (row.monthly_price_minor ?? 0) - row.diff.monthly_price_minor_delta : 0
  const propsBefore = row ? (row.properties_covered ?? 0) - row.diff.properties_covered_delta : 0

  const changes = useMemo(() => {
    if (!row) return []
    const out: Array<{ key: string; label: string; before: string; after: string; warn: boolean }> = []
    if (row.diff.monthly_price_minor_delta !== 0) {
      out.push({
        key: 'price',
        label: t('edit.diff.price'),
        before: formatMoneyMinor(priceBefore),
        after: formatMoneyMinor(row.monthly_price_minor),
        warn: true,
      })
    }
    if (row.diff.properties_covered_delta !== 0) {
      out.push({
        key: 'properties',
        label: t('edit.diff.properties'),
        before: String(propsBefore),
        after: String(row.properties_covered ?? '—'),
        warn: true,
      })
    }
    return out
  }, [row, t, priceBefore, propsBefore])

  const handleReject = async () => {
    if (!row || rejectReason.trim().length < 5) return
    setRejecting(true)
    try {
      await packagesApi.reject(row.package_id, row.id, { reason: rejectReason.trim() })
      addToast({ variant: 'success', title: t('reject.toast.success', { version: row.version_number }) })
      setRejectOpen(false)
      navigate(returnTo)
    } catch {
      addToast({ variant: 'error', title: t('reject.toast.fail') })
    } finally {
      setRejecting(false)
    }
  }

  return (
    <PackageConsoleFrame>
      <header className="mb-[var(--lc-space-lg)] flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[var(--lc-text-heading)]" style={{ font: 'var(--lc-type-heading-1)' }}>
            {row
              ? t('apprd.title', { version: row.version_number, name: row.package_display_name })
              : t('appr.title')}
          </h1>
          {row ? (
            <p className="mt-1 text-[var(--lc-text-muted)]" style={{ font: 'var(--lc-type-body-sm)' }}>
              {t('apprd.subtitle', { rel: formatRelative(row.submitted_at) })}
            </p>
          ) : null}
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={() => navigate(returnTo)}>
          {t('apprd.back')}
        </Button>
      </header>

      {error ? (
        <div
          role="alert"
          className="rounded-[var(--lc-radius-md)] border border-[var(--lc-border)] bg-[var(--lc-status-unpublished-bg)] px-4 py-3 text-[var(--lc-status-unpublished-fg)]"
        >
          {t('apprd.error')}{' '}
          <Button type="button" variant="link" onClick={() => void load()}>
            {t('common.retry')}
          </Button>
        </div>
      ) : loading ? (
        <div className="h-64 rounded-[var(--lc-radius-lg)] bg-[var(--lc-surface-sunken)]" aria-hidden data-testid="pkg-apprd-skeleton" />
      ) : !row ? (
        <div
          role="status"
          className="rounded-[var(--lc-radius-md)] border border-[var(--lc-border)] bg-[var(--lc-surface-sunken)] px-4 py-6 text-center text-[var(--lc-text-secondary)]"
        >
          {t('apprd.notfound')}
        </div>
      ) : (
        <div className="grid gap-[var(--lc-space-lg)] lg:grid-cols-[1.6fr_1fr]">
          <section
            className="rounded-[var(--lc-radius-lg)] border border-[var(--lc-border)] bg-[var(--lc-surface-raised)] p-[var(--lc-space-lg)]"
            aria-label={t('apprd.diff.title', { version: row.version_number, base: baseVersion })}
          >
            <h2 className="mb-4 text-[var(--lc-text-heading)]" style={{ font: 'var(--lc-type-heading-2)' }}>
              {t('apprd.diff.title', { version: row.version_number, base: baseVersion })}
            </h2>
            {changes.length === 0 ? (
              <p className="text-sm text-[var(--lc-text-muted)]">{t('apprd.diff.none')}</p>
            ) : (
              <dl className="space-y-2">
                {changes.map((c) => (
                  <div
                    key={c.key}
                    data-diff-field={c.key}
                    className="flex items-center justify-between rounded-[var(--lc-radius-md)] bg-[var(--lc-status-underOffer-bg)] px-3 py-2 text-sm"
                  >
                    <dt className="text-[var(--lc-text-muted)]">{c.label}</dt>
                    <dd className="text-[var(--lc-status-underOffer-fg)]">
                      <Numeric as="span" className="line-through opacity-70">{c.before}</Numeric>{' '}
                      → <Numeric as="span">{c.after}</Numeric>
                    </dd>
                  </div>
                ))}
              </dl>
            )}
          </section>

          <aside className="flex flex-col gap-[var(--lc-space-md)]">
            <div className="rounded-[var(--lc-radius-lg)] border border-[var(--lc-border)] bg-[var(--lc-surface-raised)] p-[var(--lc-space-md)]">
              <h2 className="mb-3 text-[var(--lc-text-heading)]" style={{ font: 'var(--lc-type-heading-3)' }}>
                {t('apprd.meta.title')}
              </h2>
              <dl className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <dt className="text-[var(--lc-text-muted)]">{t('appr.col.submitter')}</dt>
                  <dd>
                    <PIIMask
                      kind="name"
                      value={row.requester_actor_id || '—'}
                      auditContext={{ caseId: row.id, field: 'requester' }}
                      revealDurationMs={30_000}
                    />
                  </dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-[var(--lc-text-muted)]">{t('apprd.meta.transition', { base: baseVersion, version: row.version_number })}</dt>
                  <dd><PackageStatusBadge state="PENDING_APPROVAL" /></dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-[var(--lc-text-muted)]">{t('apprd.meta.type')}</dt>
                  <dd>
                    <Badge status={twoPerson ? 'pending' : 'draft'}>
                      {twoPerson ? t('appr.badge.twoPerson') : t('appr.badge.single')}
                    </Badge>
                  </dd>
                </div>
              </dl>
            </div>

            <div className="rounded-[var(--lc-radius-lg)] border border-[var(--lc-border)] bg-[var(--lc-surface-raised)] p-[var(--lc-space-md)]">
              <h2 className="mb-3 text-[var(--lc-text-heading)]" style={{ font: 'var(--lc-type-heading-3)' }}>
                {t('apprd.actions.title')}
              </h2>
              {row.is_own_submission ? (
                <p className="mb-3 text-sm italic text-[var(--lc-text-muted)]">{t('apprd.self.note')}</p>
              ) : null}
              <div className="flex flex-col gap-2">
                <Button
                  type="button"
                  onClick={() => row.approval_id && openExecuteModal({ requestId: row.approval_id })}
                  disabled={row.is_own_submission || !row.approval_id}
                  aria-disabled={row.is_own_submission || !row.approval_id}
                  title={row.is_own_submission ? t('apprd.self.note') : undefined}
                >
                  {t('apprd.actions.approve')}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setRejectOpen(true)}
                  disabled={row.is_own_submission}
                >
                  {t('apprd.actions.reject')}
                </Button>
                {row.is_own_submission ? (
                  <Button type="button" variant="ghost" onClick={() => setRecallOpen(true)}>
                    {t('apprd.actions.recall')}
                  </Button>
                ) : null}
              </div>
              <p className="mt-3 text-[var(--lc-text-muted)]" style={{ font: 'var(--lc-type-caption)' }}>
                {t('apprd.actions.footer')}
              </p>
            </div>
          </aside>
        </div>
      )}

      <TwoPersonExecuteModal {...executeModalProps} />

      <EscalationModal
        requestId={row?.approval_id ?? null}
        version={row?.version_number ?? null}
        open={escalateOpen}
        onClose={() => setEscalateOpen(false)}
        onEscalated={() => {
          setEscalateOpen(false)
          navigate(returnTo)
        }}
      />

      <RecallModal
        requestId={row?.approval_id ?? null}
        version={row?.version_number ?? null}
        open={recallOpen}
        onClose={() => setRecallOpen(false)}
        onRecalled={() => {
          setRecallOpen(false)
          navigate(returnTo)
        }}
      />

      <Dialog open={rejectOpen} onOpenChange={(next) => (!next && !rejecting ? setRejectOpen(false) : undefined)}>
        <DialogContent className="max-w-[520px]">
          <DialogHeader>
            <DialogTitle>
              {row ? t('reject.title', { version: row.version_number, name: row.package_display_name }) : ''}
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="reject-reason">{t('reject.reason.label')}</Label>
            <textarea
              id="reject-reason"
              className="min-h-[96px] w-full rounded-[var(--lc-radius-md)] border border-[var(--lc-border-strong)] bg-[var(--lc-surface)] px-3 py-2 text-sm text-[var(--lc-text-primary)]"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder={t('reject.reason.placeholder')}
              aria-describedby="reject-reason-help"
            />
            <p id="reject-reason-help" className="text-[var(--lc-text-muted)]" style={{ font: 'var(--lc-type-caption)' }}>
              {t('reject.reason.helper')}
            </p>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setRejectOpen(false)} disabled={rejecting}>
              {t('common.cancel')}
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => void handleReject()}
              disabled={rejectReason.trim().length < 5 || rejecting}
            >
              {rejecting ? (
                <Loader2 className="me-2 h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden />
              ) : null}
              {t('reject.submit')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PackageConsoleFrame>
  )
}
