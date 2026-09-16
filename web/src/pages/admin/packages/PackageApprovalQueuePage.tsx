/**
 * PA-PKG-003 (queue) — Package approval queue. Lists PENDING_APPROVAL versions
 * awaiting review; opening a row goes to the detail decision surface.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Numeric } from '@/components/ui/numeric'
import { PIIMask } from '@/components/security/PIIMask'
import { cn } from '@/lib/utils'
import { PackageConsoleFrame, PackageStatusBadge } from './packageShared'
import { formatRelative } from './packageFormat'
import { usePackagesCopy } from './packagesCopy'
import { packagesApi } from './api'
import { diffRequiresTwoPerson, type PendingApprovalRow } from './types'

function ChangeChips({ row }: { row: PendingApprovalRow }) {
  const { t } = usePackagesCopy()
  const chips: string[] = []
  if (row.diff.monthly_price_minor_delta !== 0) chips.push(t('appr.chip.price'))
  if (row.diff.properties_covered_delta !== 0) chips.push(t('appr.chip.coverage'))
  const quotaTotal = row.diff.quotas_added + row.diff.quotas_removed + row.diff.quotas_changed
  if (quotaTotal > 0) chips.push(t('appr.chip.quotas', { count: quotaTotal }))
  if (row.diff.flags_changed > 0) chips.push(t('appr.chip.flags', { count: row.diff.flags_changed }))
  return (
    <div className="flex flex-wrap gap-1">
      {chips.map((c) => (
        <Badge key={c} variant="outline">
          {c}
        </Badge>
      ))}
    </div>
  )
}

export function PackageApprovalQueuePage() {
  const navigate = useNavigate()
  const { t } = usePackagesCopy()
  const [searchParams, setSearchParams] = useSearchParams()
  const view = (searchParams.get('view') as 'mine' | 'all') || 'mine'

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [rows, setRows] = useState<PendingApprovalRow[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const data = await packagesApi.pendingApprovals()
      setRows(data.approvals || [])
    } catch {
      setError(true)
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const setView = (next: 'mine' | 'all') => {
    const params = new URLSearchParams(searchParams)
    params.set('view', next)
    setSearchParams(params)
  }

  const twoPersonCount = useMemo(
    () => rows.filter((r) => diffRequiresTwoPerson(r.diff)).length,
    [rows],
  )
  const mineCount = useMemo(() => rows.filter((r) => !r.is_own_submission).length, [rows])
  const visibleRows = useMemo(
    () => (view === 'mine' ? rows.filter((r) => !r.is_own_submission) : rows),
    [rows, view],
  )

  return (
    <PackageConsoleFrame>
      <header className="mb-[var(--lc-space-lg)] flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[var(--lc-text-heading)]" style={{ font: 'var(--lc-type-heading-1)' }}>
            {t('appr.title')}
          </h1>
          <p className="mt-1 text-[var(--lc-text-muted)]" style={{ font: 'var(--lc-type-body-sm)' }}>
            {t('appr.subtitle', { pending: rows.length, twoPerson: twoPersonCount, mine: mineCount })}
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => void load()}>
          <RefreshCw className="me-1 h-4 w-4" aria-hidden />
          {t('common.refresh')}
        </Button>
      </header>

      <div role="tablist" aria-label={t('appr.title')} className="mb-[var(--lc-space-md)] flex gap-1">
        {(['mine', 'all'] as const).map((value) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={view === value}
            onClick={() => setView(value)}
            className={cn(
              'min-h-tap rounded-[var(--lc-radius-md)] px-3 text-sm',
              view === value
                ? 'bg-[var(--lc-action-primary)] text-[var(--lc-action-primary-text)]'
                : 'text-[var(--lc-text-secondary)] hover:bg-[var(--lc-surface-sunken)]',
            )}
          >
            {value === 'mine' ? t('appr.tab.mine') : t('appr.tab.all')}
          </button>
        ))}
      </div>

      {error ? (
        <div
          role="alert"
          className="rounded-[var(--lc-radius-md)] border border-[var(--lc-border)] bg-[var(--lc-status-unpublished-bg)] px-4 py-3 text-[var(--lc-status-unpublished-fg)]"
        >
          {t('appr.error')}{' '}
          <Button type="button" variant="link" onClick={() => void load()}>
            {t('common.retry')}
          </Button>
        </div>
      ) : loading ? (
        <div className="space-y-2" aria-hidden data-testid="pkg-appr-skeleton">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-14 rounded-[var(--lc-radius-md)] bg-[var(--lc-surface-sunken)]" />
          ))}
        </div>
      ) : visibleRows.length === 0 ? (
        <div className="mx-auto max-w-md py-12 text-center">
          <div
            className="mx-auto mb-4 h-[160px] w-full rounded-[var(--lc-radius-lg)] border border-dashed border-[var(--lc-border-strong)] bg-[var(--lc-surface-sunken)]"
            aria-hidden
          />
          <h2 className="text-[var(--lc-text-heading)]" style={{ font: 'var(--lc-type-heading-3)' }}>
            {t('appr.empty.title')}
          </h2>
          <p className="mt-2 text-[var(--lc-text-muted)]" style={{ font: 'var(--lc-type-body)' }}>
            {t('appr.empty.body')}
          </p>
          <Button
            type="button"
            variant="link"
            className="mt-3"
            onClick={() => navigate('/admin/packages')}
          >
            {t('appr.empty.cta')}
          </Button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-[var(--lc-radius-lg)] border border-[var(--lc-border)]">
          <table className="w-full border-collapse text-start text-sm">
            <thead>
              <tr className="bg-[var(--lc-surface-sunken)] text-[var(--lc-text-muted)]">
                <th scope="col" className="px-4 py-2 text-start font-semibold">{t('appr.col.submitted')}</th>
                <th scope="col" className="px-4 py-2 text-start font-semibold">{t('appr.col.package')}</th>
                <th scope="col" className="px-4 py-2 text-start font-semibold">{t('appr.col.version')}</th>
                <th scope="col" className="px-4 py-2 text-start font-semibold">{t('appr.col.submitter')}</th>
                <th scope="col" className="px-4 py-2 text-start font-semibold">{t('appr.col.summary')}</th>
                <th scope="col" className="px-4 py-2 text-start font-semibold">{t('appr.col.type')}</th>
                <th scope="col" className="px-4 py-2 text-start font-semibold">{t('appr.col.status')}</th>
                <th scope="col" className="px-4 py-2 text-end font-semibold">{t('list.col.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((row) => {
                const twoPerson = diffRequiresTwoPerson(row.diff)
                return (
                  <tr
                    key={row.id}
                    className="border-t border-[var(--lc-border)] bg-[var(--lc-surface-raised)] hover:bg-[var(--lc-surface-sunken)]"
                    data-appr-row={row.id}
                  >
                    <td className="px-4 py-3 text-[var(--lc-text-muted)]">
                      <Numeric as="span" title={row.submitted_at || undefined}>
                        {formatRelative(row.submitted_at)}
                      </Numeric>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-[var(--lc-text-heading)]">{row.package_display_name}</div>
                      <div className="font-[family-name:var(--lc-font-mono)] text-xs text-[var(--lc-text-muted)]">
                        {row.package_code}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Numeric as="span">
                        {t('appr.version.transition', {
                          version: row.version_number,
                          base: row.diff.versus_version_number ?? row.version_number - 1,
                        })}
                      </Numeric>
                    </td>
                    <td className="px-4 py-3">
                      <PIIMask
                        kind="name"
                        value={row.requester_actor_id || '—'}
                        auditContext={{ caseId: row.id, field: 'requester' }}
                        revealDurationMs={30_000}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <ChangeChips row={row} />
                    </td>
                    <td className="px-4 py-3">
                      <Badge status={twoPerson ? 'pending' : 'draft'}>
                        {twoPerson ? t('appr.badge.twoPerson') : t('appr.badge.single')}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <PackageStatusBadge state="PENDING_APPROVAL" />
                    </td>
                    <td className="px-4 py-3 text-end">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          navigate(
                            `/admin/packages/approvals/${row.id}?return_to=${encodeURIComponent(
                              `${window.location.pathname}${window.location.search}`,
                            )}`,
                          )
                        }
                      >
                        {t('common.open')}
                      </Button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </PackageConsoleFrame>
  )
}
