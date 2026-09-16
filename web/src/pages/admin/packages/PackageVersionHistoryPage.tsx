/**
 * PA-PKG-004 (timeline) — Package version history. Immutable newest-first
 * timeline of every version with status marker + change actions.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Numeric } from '@/components/ui/numeric'
import { cn } from '@/lib/utils'
import { PackageConsoleFrame, PackageStatusBadge } from './packageShared'
import { formatDate, formatMoneyMinor, formatRelative } from './packageFormat'
import { usePackagesCopy } from './packagesCopy'
import { packagesApi } from './api'
import type { PackageDetailResponse, PackageVersionState } from './types'

type StatusFilter = 'all' | 'draft' | 'pending' | 'active' | 'deprecated'

const FILTER_STATE: Record<Exclude<StatusFilter, 'all'>, PackageVersionState> = {
  draft: 'DRAFT',
  pending: 'PENDING_APPROVAL',
  active: 'PUBLISHED',
  deprecated: 'DEPRECATED',
}

export function PackageVersionHistoryPage() {
  const navigate = useNavigate()
  const { packageId = '' } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const status = (searchParams.get('status') as StatusFilter) || 'all'
  const { t } = usePackagesCopy()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [pkg, setPkg] = useState<PackageDetailResponse | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const data = await packagesApi.get(packageId)
      setPkg(data)
    } catch {
      setError(true)
      setPkg(null)
    } finally {
      setLoading(false)
    }
  }, [packageId])

  useEffect(() => {
    void load()
  }, [load])

  const versions = useMemo(() => {
    const list = [...(pkg?.versions || [])]
    list.sort((a, b) => b.version_number - a.version_number)
    return list
  }, [pkg])

  const counts = useMemo(() => {
    const c = { total: versions.length, active: 0, deprecated: 0 }
    for (const v of versions) {
      if (v.state === 'PUBLISHED') c.active += 1
      if (v.state === 'DEPRECATED') c.deprecated += 1
    }
    return c
  }, [versions])

  const visible = useMemo(
    () => (status === 'all' ? versions : versions.filter((v) => v.state === FILTER_STATE[status])),
    [versions, status],
  )

  const setStatus = (next: StatusFilter) => {
    const params = new URLSearchParams(searchParams)
    if (next === 'all') params.delete('status')
    else params.set('status', next)
    setSearchParams(params)
  }

  const packageName = pkg?.display_name || ''

  return (
    <PackageConsoleFrame>
      <header className="mb-[var(--lc-space-lg)] flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[var(--lc-text-heading)]" style={{ font: 'var(--lc-type-heading-1)' }}>
            {t('hist.title', { name: packageName })}
          </h1>
          <p className="mt-1 text-[var(--lc-text-muted)]" style={{ font: 'var(--lc-type-body-sm)' }}>
            {t('hist.subtitle', { total: counts.total, active: counts.active, deprecated: counts.deprecated })}
          </p>
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={() => navigate('/admin/packages')}>
          {t('hist.back')}
        </Button>
      </header>

      <div role="tablist" aria-label={t('hist.title', { name: packageName })} className="mb-[var(--lc-space-md)] flex flex-wrap gap-1">
        {(['all', 'draft', 'pending', 'active', 'deprecated'] as const).map((value) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={status === value}
            onClick={() => setStatus(value)}
            className={cn(
              'min-h-tap rounded-[var(--lc-radius-md)] px-3 text-sm',
              status === value
                ? 'bg-[var(--lc-action-primary)] text-[var(--lc-action-primary-text)]'
                : 'text-[var(--lc-text-secondary)] hover:bg-[var(--lc-surface-sunken)]',
            )}
          >
            {t(`hist.tab.${value}` as const)}
          </button>
        ))}
      </div>

      {error ? (
        <div
          role="alert"
          className="rounded-[var(--lc-radius-md)] border border-[var(--lc-border)] bg-[var(--lc-status-unpublished-bg)] px-4 py-3 text-[var(--lc-status-unpublished-fg)]"
        >
          {t('hist.error')}{' '}
          <Button type="button" variant="link" onClick={() => void load()}>
            {t('common.retry')}
          </Button>
        </div>
      ) : loading ? (
        <div className="space-y-3" aria-hidden data-testid="pkg-hist-skeleton">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-28 rounded-[var(--lc-radius-lg)] bg-[var(--lc-surface-sunken)]" />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <p className="py-12 text-center text-[var(--lc-text-muted)]">{t('hist.empty.title')}</p>
      ) : (
        <ol className="relative ms-3 border-s-2 border-[var(--lc-border-strong)] ps-6">
          {visible.map((v) => (
            <li key={v.id} className="relative mb-4">
              <span
                aria-hidden
                className="absolute -start-[calc(1.5rem+5px)] top-4 h-3 w-3 rounded-full ring-2 ring-[var(--lc-surface-raised)]"
                style={{ background: `var(--lc-status-${pkgMarkerStatus(v.state)}-dot)` }}
              />
              <article
                tabIndex={0}
                data-version-id={v.id}
                className="rounded-[var(--lc-radius-lg)] border border-[var(--lc-border)] bg-[var(--lc-surface-raised)] p-[var(--lc-space-md)]"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <span className="font-[family-name:var(--lc-font-mono)] text-[var(--lc-text-heading)]" style={{ font: 'var(--lc-type-heading-3)' }}>
                      {t('hist.card.version', { version: v.version_number })}
                    </span>
                    <PackageStatusBadge state={v.state} />
                  </div>
                  <span className="text-sm text-[var(--lc-text-muted)]">
                    {v.effective_from ? (
                      v.effective_to
                        ? t('hist.card.effectiveRange', { from: formatDate(v.effective_from), to: formatDate(v.effective_to) })
                        : t('hist.card.effectiveFrom', { date: formatDate(v.effective_from) })
                    ) : (
                      <Numeric as="span">{t('hist.card.created', { rel: formatRelative(v.created_at) })}</Numeric>
                    )}
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-[var(--lc-text-secondary)]">
                  <Numeric as="span">{formatMoneyMinor(v.monthly_price_minor, pkg?.currency || 'USD')}</Numeric>
                  <Numeric as="span">
                    {v.properties_covered == null ? t('common.unlimited') : v.properties_covered}
                  </Numeric>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => navigate(`/admin/packages/${packageId}/versions/${v.id}`)}
                  >
                    {t('common.open')}
                  </Button>
                  {v.state === 'DRAFT' ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => navigate(`/admin/packages/${packageId}/versions/${v.id}/edit`)}
                    >
                      {t('hist.card.editDraft')}
                    </Button>
                  ) : null}
                  {v.state === 'PENDING_APPROVAL' ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => navigate(`/admin/packages/approvals/${v.id}`)}
                    >
                      {t('hist.card.review')}
                    </Button>
                  ) : null}
                </div>
              </article>
            </li>
          ))}
        </ol>
      )}
    </PackageConsoleFrame>
  )
}

function pkgMarkerStatus(state: PackageVersionState): string {
  switch (state) {
    case 'DRAFT':
      return 'draft'
    case 'PENDING_APPROVAL':
      return 'underOffer'
    case 'PUBLISHED':
      return 'published'
    default:
      return 'archived'
  }
}
