/**
 * PA-PKG-001 — Package list. Browse the pricing-tier catalog for the current
 * env, seed new packages, and launch into the version editor / history.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Plus, RefreshCw, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Numeric } from '@/components/ui/numeric'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useToast } from '@/components/ui/toast'
import { cn } from '@/lib/utils'
import { PackageConsoleFrame, PackageStatusBadge } from './packageShared'
import { formatMoneyMinor } from './packageFormat'
import { usePackagesCopy } from './packagesCopy'
import { packagesApi } from './api'
import type { PackageRow, PackageVersionState } from './types'

type SortKey = 'default' | 'price_asc' | 'price_desc' | 'recent'

const FIELD_CLASS =
  'min-h-tap rounded-[var(--lc-radius-md)] border border-[var(--lc-border-strong)] bg-[var(--lc-surface)] px-3 text-sm text-[var(--lc-text-primary)]'

function packageState(pkg: PackageRow): PackageVersionState {
  if (pkg.active_version) return 'PUBLISHED'
  return 'DEPRECATED'
}

export function PackageListPage() {
  const navigate = useNavigate()
  const { addToast } = useToast()
  const { t } = usePackagesCopy()
  const [searchParams, setSearchParams] = useSearchParams()

  const filter = (searchParams.get('filter') as 'active' | 'all') || 'active'
  const sort = (searchParams.get('sort') as SortKey) || 'default'
  const q = searchParams.get('q') || ''

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [rows, setRows] = useState<PackageRow[]>([])
  const [pendingCount, setPendingCount] = useState(0)
  const [modalOpen, setModalOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({
    code: '',
    display_name: '',
    tier: 'starter',
    target_audience: 'agent',
    billing_cadence: 'monthly',
  })

  const patchParams = useCallback(
    (patch: Record<string, string | null>) => {
      const next = new URLSearchParams(searchParams)
      for (const [key, value] of Object.entries(patch)) {
        if (!value) next.delete(key)
        else next.set(key, value)
      }
      setSearchParams(next)
    },
    [searchParams, setSearchParams],
  )

  const load = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const [list, pending] = await Promise.all([
        packagesApi.list({ active: filter === 'active' ? 'active' : 'all' }),
        packagesApi.pendingApprovals().catch(() => ({ approvals: [], env: 'live' as const })),
      ])
      setRows(list.packages || [])
      setPendingCount((pending.approvals || []).length)
    } catch {
      setError(true)
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [filter])

  useEffect(() => {
    void load()
  }, [load])

  const visibleRows = useMemo(() => {
    let out = [...rows]
    const term = q.trim().toLowerCase()
    if (term) {
      out = out.filter(
        (r) =>
          r.display_name.toLowerCase().includes(term) || r.code.toLowerCase().includes(term),
      )
    }
    if (sort === 'price_asc') {
      out.sort(
        (a, b) => (a.active_version?.monthly_price_minor ?? 0) - (b.active_version?.monthly_price_minor ?? 0),
      )
    } else if (sort === 'price_desc') {
      out.sort(
        (a, b) => (b.active_version?.monthly_price_minor ?? 0) - (a.active_version?.monthly_price_minor ?? 0),
      )
    } else if (sort === 'recent') {
      out.sort((a, b) => Date.parse(b.updated_at || '') - Date.parse(a.updated_at || ''))
    }
    return out
  }, [rows, q, sort])

  const activeCount = useMemo(() => rows.filter((r) => Boolean(r.active_version)).length, [rows])

  const codeValid = /^[a-z0-9-]+$/.test(form.code)
  const canCreate = codeValid && form.code.length > 0 && form.display_name.trim().length > 0

  const handleCreate = async () => {
    if (!canCreate) return
    setCreating(true)
    try {
      const created = await packagesApi.createPackage({
        code: form.code,
        display_name: form.display_name.trim(),
        tier: form.tier,
        target_audience: form.target_audience,
        billing_cadence: form.billing_cadence,
      })
      setModalOpen(false)
      navigate(`/admin/packages/${String(created.id)}/history`)
    } catch {
      addToast({ variant: 'error', title: t('newpkg.error') })
    } finally {
      setCreating(false)
    }
  }

  const openNewDraft = async (pkg: PackageRow) => {
    try {
      const draft = await packagesApi.createDraftVersion(pkg.id, {
        copy_from_version_id: pkg.active_version?.id,
      })
      navigate(`/admin/packages/${pkg.id}/versions/${draft.id}/edit`)
    } catch {
      addToast({ variant: 'error', title: t('newpkg.error') })
    }
  }

  return (
    <PackageConsoleFrame>
      <header className="mb-[var(--lc-space-lg)] flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[var(--lc-text-heading)]" style={{ font: 'var(--lc-type-heading-1)' }}>
            {t('list.title')}
          </h1>
          <p className="mt-1 text-[var(--lc-text-muted)]" style={{ font: 'var(--lc-type-body-sm)' }}>
            {t('list.subtitle', { active: activeCount, pending: pendingCount })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => void load()}>
            <RefreshCw className="me-1 h-4 w-4" aria-hidden />
            {t('common.refresh')}
          </Button>
          <Button type="button" size="sm" onClick={() => setModalOpen(true)}>
            <Plus className="me-1 h-4 w-4" aria-hidden />
            {t('list.cta.new')}
          </Button>
        </div>
      </header>

      <div
        className="mb-[var(--lc-space-md)] flex flex-wrap items-end gap-3 rounded-[var(--lc-radius-md)] border-b border-[var(--lc-border)] bg-[var(--lc-surface-raised)] p-[var(--lc-space-md)]"
        aria-label="Filter packages"
      >
        <div role="tablist" aria-label={t('list.title')} className="flex gap-1">
          {(['active', 'all'] as const).map((value) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={filter === value}
              onClick={() => patchParams({ filter: value })}
              className={cn(
                'min-h-tap rounded-[var(--lc-radius-md)] px-3 text-sm',
                filter === value
                  ? 'bg-[var(--lc-action-primary)] text-[var(--lc-action-primary-text)]'
                  : 'text-[var(--lc-text-secondary)] hover:bg-[var(--lc-surface-sunken)]',
              )}
            >
              {value === 'active' ? t('list.tab.active') : t('list.tab.all')}
            </button>
          ))}
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="pkg-sort">{t('list.sort.label')}</Label>
          <select
            id="pkg-sort"
            className={FIELD_CLASS}
            value={sort}
            onChange={(e) => patchParams({ sort: e.target.value === 'default' ? null : e.target.value })}
          >
            <option value="default">{t('list.sort.default')}</option>
            <option value="price_asc">{t('list.sort.price_asc')}</option>
            <option value="price_desc">{t('list.sort.price_desc')}</option>
            <option value="recent">{t('list.sort.recent')}</option>
          </select>
        </div>
        <div className="flex flex-1 flex-col gap-1">
          <Label htmlFor="pkg-search">{t('list.search.placeholder')}</Label>
          <div className="relative">
            <Search
              className="pointer-events-none absolute inset-y-0 start-3 my-auto h-4 w-4 text-[var(--lc-text-muted)]"
              aria-hidden
            />
            <Input
              id="pkg-search"
              value={q}
              placeholder={t('list.search.placeholder')}
              className="ps-9"
              onChange={(e) => patchParams({ q: e.target.value || null })}
            />
          </div>
        </div>
      </div>

      {error ? (
        <div
          role="alert"
          className="rounded-[var(--lc-radius-md)] border border-[var(--lc-border)] bg-[var(--lc-status-unpublished-bg)] px-4 py-3 text-[var(--lc-status-unpublished-fg)]"
        >
          {t('list.error')}{' '}
          <Button type="button" variant="link" onClick={() => void load()}>
            {t('common.retry')}
          </Button>
        </div>
      ) : loading ? (
        <div className="space-y-2" data-testid="pkg-list-skeleton" aria-hidden>
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-16 rounded-[var(--lc-radius-md)] bg-[var(--lc-surface-sunken)]"
            />
          ))}
        </div>
      ) : visibleRows.length === 0 ? (
        <div className="mx-auto max-w-md py-12 text-center">
          <div
            className="mx-auto mb-4 h-[160px] w-full rounded-[var(--lc-radius-lg)] border border-dashed border-[var(--lc-border-strong)] bg-[var(--lc-surface-sunken)]"
            aria-hidden
          />
          <h2 className="text-[var(--lc-text-heading)]" style={{ font: 'var(--lc-type-heading-3)' }}>
            {q ? t('list.noresults.title') : t('list.empty.title')}
          </h2>
          {!q ? (
            <p className="mt-2 text-[var(--lc-text-muted)]" style={{ font: 'var(--lc-type-body)' }}>
              {t('list.empty.body')}
            </p>
          ) : null}
          <Button type="button" className="mt-4" onClick={() => setModalOpen(true)}>
            {t('list.cta.new')}
          </Button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-[var(--lc-radius-lg)] border border-[var(--lc-border)]">
          <table className="w-full border-collapse text-start text-sm">
            <thead>
              <tr className="bg-[var(--lc-surface-sunken)] text-[var(--lc-text-muted)]">
                <th scope="col" className="px-4 py-2 text-start font-semibold">{t('list.col.package')}</th>
                <th scope="col" className="px-4 py-2 text-start font-semibold">{t('list.col.version')}</th>
                <th scope="col" className="px-4 py-2 text-start font-semibold">{t('list.col.price')}</th>
                <th scope="col" className="px-4 py-2 text-start font-semibold">{t('list.col.properties')}</th>
                <th scope="col" className="px-4 py-2 text-start font-semibold">{t('list.col.status')}</th>
                <th scope="col" className="px-4 py-2 text-end font-semibold">{t('list.col.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((pkg) => {
                const av = pkg.active_version
                return (
                  <tr
                    key={pkg.id}
                    className="border-t border-[var(--lc-border)] bg-[var(--lc-surface-raised)] hover:bg-[var(--lc-surface-sunken)]"
                    data-pkg-row={pkg.id}
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium text-[var(--lc-text-heading)]">{pkg.display_name}</div>
                      <div className="font-[family-name:var(--lc-font-mono)] text-xs text-[var(--lc-text-muted)]">
                        {pkg.code}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {av ? (
                        <Numeric as="span">v{av.version_number}</Numeric>
                      ) : (
                        <span className="text-[var(--lc-text-muted)]">{t('list.version.none')}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Numeric as="span">
                        {formatMoneyMinor(av?.monthly_price_minor, pkg.currency || 'USD')}
                      </Numeric>
                    </td>
                    <td className="px-4 py-3">
                      {av?.properties_covered == null ? (
                        <span className="text-[var(--lc-text-muted)]">{t('common.unlimited')}</span>
                      ) : (
                        <Numeric as="span">{av.properties_covered}</Numeric>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <PackageStatusBadge state={packageState(pkg)} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => navigate(`/admin/packages/${pkg.id}/history`)}
                        >
                          {t('list.action.history')}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => void openNewDraft(pkg)}
                        >
                          {t('list.action.newDraft')}
                        </Button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={modalOpen} onOpenChange={(next) => (!next && !creating ? setModalOpen(false) : undefined)}>
        <DialogContent className="max-w-[560px]">
          <DialogHeader>
            <DialogTitle>{t('newpkg.title')}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="newpkg-code">{t('newpkg.code.label')}</Label>
              <Input
                id="newpkg-code"
                value={form.code}
                onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
                aria-describedby="newpkg-code-help"
              />
              <p id="newpkg-code-help" className="text-[var(--lc-text-muted)]" style={{ font: 'var(--lc-type-caption)' }}>
                {form.code && !codeValid ? t('newpkg.code.error') : t('newpkg.code.helper')}
              </p>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="newpkg-name">{t('newpkg.name.label')}</Label>
              <Input
                id="newpkg-name"
                value={form.display_name}
                onChange={(e) => setForm((f) => ({ ...f, display_name: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="newpkg-audience">{t('newpkg.audience.label')}</Label>
                <select
                  id="newpkg-audience"
                  className={FIELD_CLASS}
                  value={form.target_audience}
                  onChange={(e) => setForm((f) => ({ ...f, target_audience: e.target.value }))}
                >
                  <option value="agent">{t('newpkg.audience.agent')}</option>
                  <option value="agency">{t('newpkg.audience.agency')}</option>
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="newpkg-cadence">{t('newpkg.cadence.label')}</Label>
                <select
                  id="newpkg-cadence"
                  className={FIELD_CLASS}
                  value={form.billing_cadence}
                  onChange={(e) => setForm((f) => ({ ...f, billing_cadence: e.target.value }))}
                >
                  <option value="monthly">{t('newpkg.cadence.monthly')}</option>
                  <option value="annual">{t('newpkg.cadence.annual')}</option>
                </select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setModalOpen(false)} disabled={creating}>
              {t('common.cancel')}
            </Button>
            <Button type="button" onClick={() => void handleCreate()} disabled={!canCreate || creating}>
              {t('newpkg.submit')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PackageConsoleFrame>
  )
}
