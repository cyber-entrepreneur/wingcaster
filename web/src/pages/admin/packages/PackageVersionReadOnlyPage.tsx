/**
 * PA-PKG-004 (read-only detail) — one historical version rendered read-only,
 * with an arbitrary compare-against selector (client-side diff).
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Numeric } from '@/components/ui/numeric'
import { Label } from '@/components/ui/label'
import { PackageConsoleFrame, PackageStatusBadge } from './packageShared'
import { formatMoneyMinor } from './packageFormat'
import { usePackagesCopy } from './packagesCopy'
import { packagesApi } from './api'
import type { PackageDetailResponse, PackageVersionDetail } from './types'

const FIELD_CLASS =
  'min-h-tap rounded-[var(--lc-radius-md)] border border-[var(--lc-border-strong)] bg-[var(--lc-surface)] px-3 text-sm text-[var(--lc-text-primary)]'

export function PackageVersionReadOnlyPage() {
  const navigate = useNavigate()
  const { packageId = '', version = '' } = useParams()
  const { t } = usePackagesCopy()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [detail, setDetail] = useState<PackageVersionDetail | null>(null)
  const [pkg, setPkg] = useState<PackageDetailResponse | null>(null)
  const [compareTo, setCompareTo] = useState<string>('')

  const load = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const [v, p] = await Promise.all([
        packagesApi.getVersion(packageId, version),
        packagesApi.get(packageId).catch(() => null),
      ])
      setDetail(v)
      setPkg(p)
      const prior = (p?.versions || [])
        .filter((x) => x.version_number < v.version_number)
        .sort((a, b) => b.version_number - a.version_number)[0]
      setCompareTo(prior?.id || '')
    } catch {
      setError(true)
      setDetail(null)
    } finally {
      setLoading(false)
    }
  }, [packageId, version])

  useEffect(() => {
    void load()
  }, [load])

  const compareVersion = useMemo(
    () => (pkg?.versions || []).find((v) => v.id === compareTo) || null,
    [pkg, compareTo],
  )

  const currency = detail?.currency || 'USD'

  const diffRows = useMemo(() => {
    if (!detail || !compareVersion) return []
    const rows: Array<{ key: string; label: string; before: string; after: string }> = []
    if (detail.monthly_price_minor !== compareVersion.monthly_price_minor) {
      rows.push({
        key: 'price',
        label: t('ro.field.price'),
        before: formatMoneyMinor(compareVersion.monthly_price_minor, currency),
        after: formatMoneyMinor(detail.monthly_price_minor, currency),
      })
    }
    if (detail.properties_covered !== compareVersion.properties_covered) {
      rows.push({
        key: 'properties',
        label: t('ro.field.properties'),
        before: String(compareVersion.properties_covered ?? '—'),
        after: String(detail.properties_covered ?? '—'),
      })
    }
    return rows
  }, [detail, compareVersion, t, currency])

  const compareOptions = useMemo(
    () => (pkg?.versions || []).filter((v) => v.id !== detail?.id).sort((a, b) => b.version_number - a.version_number),
    [pkg, detail],
  )

  return (
    <PackageConsoleFrame>
      <header className="mb-[var(--lc-space-lg)] flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[var(--lc-text-heading)]" style={{ font: 'var(--lc-type-heading-1)' }}>
            {detail
              ? t('ro.title', { name: detail.package_display_name, version: detail.version_number })
              : t('ro.summary.title')}
          </h1>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => navigate(`/admin/packages/${packageId}/history`)}
        >
          {t('ro.back')}
        </Button>
      </header>

      {error ? (
        <div
          role="alert"
          className="rounded-[var(--lc-radius-md)] border border-[var(--lc-border)] bg-[var(--lc-status-unpublished-bg)] px-4 py-3 text-[var(--lc-status-unpublished-fg)]"
        >
          {t('ro.error')}{' '}
          <Button type="button" variant="link" onClick={() => void load()}>
            {t('common.retry')}
          </Button>
        </div>
      ) : loading || !detail ? (
        <div className="h-64 rounded-[var(--lc-radius-lg)] bg-[var(--lc-surface-sunken)]" aria-hidden data-testid="pkg-ro-skeleton" />
      ) : (
        <div className="grid gap-[var(--lc-space-lg)] lg:grid-cols-[1.6fr_1fr]">
          <section
            className="rounded-[var(--lc-radius-lg)] border border-[var(--lc-border)] bg-[var(--lc-surface-raised)] p-[var(--lc-space-lg)]"
            aria-label={t('ro.summary.title')}
          >
            <h2 className="mb-4 text-[var(--lc-text-heading)]" style={{ font: 'var(--lc-type-heading-2)' }}>
              {compareVersion
                ? t('ro.diff.title', { version: detail.version_number, base: compareVersion.version_number })
                : t('ro.compare.v1')}
            </h2>
            {compareVersion && diffRows.length === 0 ? (
              <p className="text-sm text-[var(--lc-text-muted)]">
                {t('ro.diff.unchanged', { base: compareVersion.version_number })}
              </p>
            ) : compareVersion ? (
              <dl className="space-y-2">
                {diffRows.map((r) => (
                  <div
                    key={r.key}
                    data-diff-field={r.key}
                    className="flex items-center justify-between rounded-[var(--lc-radius-md)] bg-[var(--lc-surface-sunken)] px-3 py-2 text-sm"
                  >
                    <dt className="text-[var(--lc-text-muted)]">{r.label}</dt>
                    <dd>
                      <Numeric as="span" className="line-through opacity-70">{r.before}</Numeric>{' '}
                      → <Numeric as="span">{r.after}</Numeric>
                    </dd>
                  </div>
                ))}
              </dl>
            ) : (
              <dl className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <dt className="text-[var(--lc-text-muted)]">{t('ro.field.price')}</dt>
                  <dd><Numeric as="span">{formatMoneyMinor(detail.monthly_price_minor, currency)}</Numeric></dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-[var(--lc-text-muted)]">{t('ro.field.properties')}</dt>
                  <dd>
                    <Numeric as="span">
                      {detail.properties_covered == null ? t('common.unlimited') : detail.properties_covered}
                    </Numeric>
                  </dd>
                </div>
              </dl>
            )}
          </section>

          <aside className="flex flex-col gap-[var(--lc-space-md)]">
            <div className="rounded-[var(--lc-radius-lg)] border border-[var(--lc-border)] bg-[var(--lc-surface-raised)] p-[var(--lc-space-md)]">
              <h2 className="mb-3 text-[var(--lc-text-heading)]" style={{ font: 'var(--lc-type-heading-3)' }}>
                {t('ro.summary.title')}
              </h2>
              <dl className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <dt className="text-[var(--lc-text-muted)]">{t('ro.field.state')}</dt>
                  <dd><PackageStatusBadge state={detail.state} /></dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-[var(--lc-text-muted)]">{t('ro.field.price')}</dt>
                  <dd><Numeric as="span">{formatMoneyMinor(detail.monthly_price_minor, currency)}</Numeric></dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-[var(--lc-text-muted)]">{t('ro.field.properties')}</dt>
                  <dd>
                    <Numeric as="span">
                      {detail.properties_covered == null ? t('common.unlimited') : detail.properties_covered}
                    </Numeric>
                  </dd>
                </div>
              </dl>
            </div>

            <div className="rounded-[var(--lc-radius-lg)] border border-[var(--lc-border)] bg-[var(--lc-surface-raised)] p-[var(--lc-space-md)]">
              <Label htmlFor="ro-compare">{t('ro.compare.title')}</Label>
              <select
                id="ro-compare"
                className={`${FIELD_CLASS} mt-1.5 w-full`}
                value={compareTo}
                onChange={(e) => setCompareTo(e.target.value)}
              >
                <option value="">{t('ro.compare.none')}</option>
                {compareOptions.map((v) => (
                  <option key={v.id} value={v.id}>
                    v{v.version_number}
                  </option>
                ))}
              </select>
            </div>
          </aside>
        </div>
      )}
    </PackageConsoleFrame>
  )
}
