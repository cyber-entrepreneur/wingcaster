/**
 * PA-PKG-002 — Package DRAFT version editor. Edit price + coverage + schedule,
 * see a live diff vs the active version, and submit for one/two-person approval.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { AlertTriangle, Loader2, Save, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Numeric } from '@/components/ui/numeric'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/components/ui/toast'
import { PackageConsoleFrame, PackageStatusBadge } from './packageShared'
import { formatMoneyMinor } from './packageFormat'
import { usePackagesCopy } from './packagesCopy'
import { packagesApi } from './api'
import type { PackageVersionDetail } from './types'

interface DraftForm {
  monthly_price_minor: string
  properties_covered: string
  effective_from: string
}

function toForm(v: PackageVersionDetail): DraftForm {
  return {
    monthly_price_minor: v.monthly_price_minor == null ? '' : String(v.monthly_price_minor),
    properties_covered: v.properties_covered == null ? '' : String(v.properties_covered),
    effective_from: v.effective_from ? v.effective_from.slice(0, 10) : '',
  }
}

export function PackageEditPage() {
  const navigate = useNavigate()
  const { packageId = '', versionId = '' } = useParams()
  const [searchParams] = useSearchParams()
  const returnTo = searchParams.get('return_to')
  const { addToast } = useToast()
  const { t } = usePackagesCopy()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [detail, setDetail] = useState<PackageVersionDetail | null>(null)
  const [form, setForm] = useState<DraftForm>({
    monthly_price_minor: '',
    properties_covered: '',
    effective_from: '',
  })
  const [saving, setSaving] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const v = await packagesApi.getVersion(packageId, versionId)
      setDetail(v)
      setForm(toForm(v))
    } catch {
      setError(true)
      setDetail(null)
    } finally {
      setLoading(false)
    }
  }, [packageId, versionId])

  useEffect(() => {
    void load()
  }, [load])

  const isDraft = detail?.state === 'DRAFT'
  const currency = detail?.currency || 'USD'

  const priceNum = form.monthly_price_minor === '' ? null : Number(form.monthly_price_minor)
  const propsNum = form.properties_covered === '' ? null : Number(form.properties_covered)

  const dirty = useMemo(() => {
    if (!detail) return false
    return (
      form.monthly_price_minor !== (detail.monthly_price_minor == null ? '' : String(detail.monthly_price_minor)) ||
      form.properties_covered !== (detail.properties_covered == null ? '' : String(detail.properties_covered)) ||
      form.effective_from !== (detail.effective_from ? detail.effective_from.slice(0, 10) : '')
    )
  }, [detail, form])

  const priceChanged = detail != null && priceNum !== detail.monthly_price_minor
  const propsChanged = detail != null && propsNum !== detail.properties_covered
  const requiresTwoPerson = priceChanged || propsChanged

  const handleSave = async () => {
    if (!detail || !isDraft) return
    setSaving(true)
    try {
      const updated = await packagesApi.updateDraft(packageId, versionId, {
        monthly_price_minor: priceNum ?? undefined,
        properties_covered: propsNum ?? undefined,
        effective_from: form.effective_from || null,
      })
      setDetail((prev) => (prev ? { ...prev, ...updated } : updated))
      addToast({ variant: 'success', title: t('edit.toast.saved') })
    } catch {
      addToast({ variant: 'error', title: t('edit.toast.saveFail') })
    } finally {
      setSaving(false)
    }
  }

  const handleSubmit = async () => {
    if (!detail || !isDraft) return
    setSubmitting(true)
    try {
      if (dirty) {
        await packagesApi.updateDraft(packageId, versionId, {
          monthly_price_minor: priceNum ?? undefined,
          properties_covered: propsNum ?? undefined,
          effective_from: form.effective_from || null,
        })
      }
      await packagesApi.submitForApproval(packageId, versionId)
      addToast({ variant: 'success', title: t('edit.toast.submitted', { version: detail.version_number }) })
      navigate('/admin/packages/approvals')
    } catch {
      addToast({ variant: 'error', title: t('edit.toast.submitFail') })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <PackageConsoleFrame>
      <header className="mb-[var(--lc-space-lg)] flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[var(--lc-text-heading)]" style={{ font: 'var(--lc-type-heading-1)' }}>
            {detail ? t('edit.title', { name: detail.package_display_name }) : t('edit.title', { name: '' })}
          </h1>
          {detail ? (
            <p className="mt-1 text-[var(--lc-text-muted)]" style={{ font: 'var(--lc-type-body-sm)' }}>
              {t('edit.subtitle', { version: detail.version_number, base: detail.version_number - 1 })}
            </p>
          ) : null}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => navigate(returnTo || `/admin/packages/${packageId}/history`)}
        >
          {t('edit.back')}
        </Button>
      </header>

      {error ? (
        <div
          role="alert"
          className="rounded-[var(--lc-radius-md)] border border-[var(--lc-border)] bg-[var(--lc-status-unpublished-bg)] px-4 py-3 text-[var(--lc-status-unpublished-fg)]"
        >
          {t('edit.error')}{' '}
          <Button type="button" variant="link" onClick={() => void load()}>
            {t('common.retry')}
          </Button>
        </div>
      ) : loading || !detail ? (
        <div className="h-64 rounded-[var(--lc-radius-lg)] bg-[var(--lc-surface-sunken)]" aria-hidden data-testid="pkg-edit-skeleton" />
      ) : (
        <div className="grid gap-[var(--lc-space-lg)] lg:grid-cols-[1.6fr_1fr]">
          <section className="rounded-[var(--lc-radius-lg)] border border-[var(--lc-border)] bg-[var(--lc-surface-raised)] p-[var(--lc-space-lg)]">
            <div className="mb-4 flex items-center gap-2">
              <PackageStatusBadge state={detail.state} />
              <span className="font-[family-name:var(--lc-font-mono)] text-sm text-[var(--lc-text-muted)]">
                {detail.package_code}
              </span>
            </div>

            {!isDraft ? (
              <div
                role="status"
                className="mb-4 rounded-[var(--lc-radius-md)] border border-[var(--lc-border)] bg-[var(--lc-surface-sunken)] px-4 py-3 text-sm text-[var(--lc-text-secondary)]"
              >
                {t('edit.readonly.notice', { status: detail.state })}
              </div>
            ) : null}

            <h2 className="mb-3 text-[var(--lc-text-heading)]" style={{ font: 'var(--lc-type-heading-3)' }}>
              {t('edit.section.pricing')}
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="edit-price">{t('edit.field.price.label')}</Label>
                <Input
                  id="edit-price"
                  type="number"
                  inputMode="numeric"
                  value={form.monthly_price_minor}
                  disabled={!isDraft}
                  onChange={(e) => setForm((f) => ({ ...f, monthly_price_minor: e.target.value }))}
                />
                <p className="text-[var(--lc-text-muted)]" style={{ font: 'var(--lc-type-caption)' }}>
                  {t('edit.field.price.helper', { dollars: formatMoneyMinor(priceNum, currency) })}
                </p>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="edit-properties">{t('edit.field.properties.label')}</Label>
                <Input
                  id="edit-properties"
                  type="number"
                  inputMode="numeric"
                  value={form.properties_covered}
                  disabled={!isDraft}
                  onChange={(e) => setForm((f) => ({ ...f, properties_covered: e.target.value }))}
                />
              </div>
            </div>

            <h2 className="mb-3 mt-6 text-[var(--lc-text-heading)]" style={{ font: 'var(--lc-type-heading-3)' }}>
              {t('edit.section.schedule')}
            </h2>
            <div className="flex max-w-xs flex-col gap-1.5">
              <Label htmlFor="edit-effective">{t('edit.field.effective.label')}</Label>
              <Input
                id="edit-effective"
                type="date"
                value={form.effective_from}
                disabled={!isDraft}
                onChange={(e) => setForm((f) => ({ ...f, effective_from: e.target.value }))}
              />
              <p className="text-[var(--lc-text-muted)]" style={{ font: 'var(--lc-type-caption)' }}>
                {t('edit.field.effective.helper')}
              </p>
            </div>

            <h2 className="mb-3 mt-6 text-[var(--lc-text-heading)]" style={{ font: 'var(--lc-type-heading-3)' }}>
              {t('edit.section.quotas')}
            </h2>
            {detail.quotas.length === 0 ? (
              <p className="text-sm text-[var(--lc-text-muted)]">{t('edit.quota.empty')}</p>
            ) : (
              <ul className="divide-y divide-[var(--lc-border)]">
                {detail.quotas.map((quota) => (
                  <li key={quota.id} className="flex items-center justify-between py-2 text-sm">
                    <span>
                      <span className="text-[var(--lc-text-primary)]">{quota.display_name}</span>{' '}
                      <span className="font-[family-name:var(--lc-font-mono)] text-xs text-[var(--lc-text-muted)]">
                        {quota.feature_code}
                      </span>
                    </span>
                    <Numeric as="span" className="text-[var(--lc-text-secondary)]">
                      {t('edit.quota.credits', { credits: quota.credits_per_property ?? 0 })}
                    </Numeric>
                  </li>
                ))}
              </ul>
            )}

            <h2 className="mb-3 mt-6 text-[var(--lc-text-heading)]" style={{ font: 'var(--lc-type-heading-3)' }}>
              {t('edit.section.flags')}
            </h2>
            {detail.flags.length === 0 ? (
              <p className="text-sm text-[var(--lc-text-muted)]">{t('edit.flag.empty')}</p>
            ) : (
              <ul className="divide-y divide-[var(--lc-border)]">
                {detail.flags.map((flag) => (
                  <li key={flag.id} className="flex items-center justify-between py-2 text-sm">
                    <span className="font-[family-name:var(--lc-font-mono)] text-xs text-[var(--lc-text-primary)]">
                      {flag.feature_code}
                    </span>
                    <Badge status={flag.enabled ? 'published' : 'archived'}>
                      {flag.enabled ? t('edit.flag.on') : t('edit.flag.off')}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <aside className="flex flex-col gap-[var(--lc-space-md)]">
            <div
              className="rounded-[var(--lc-radius-lg)] border border-[var(--lc-border)] bg-[var(--lc-surface-sunken)] p-[var(--lc-space-md)]"
              role="region"
              aria-label={t('edit.diff.title', { base: detail.version_number - 1 })}
            >
              <h2 className="mb-3 text-[var(--lc-text-heading)]" style={{ font: 'var(--lc-type-heading-3)' }}>
                {detail.version_number <= 1
                  ? t('edit.diff.fresh')
                  : t('edit.diff.title', { base: detail.version_number - 1 })}
              </h2>
              {!priceChanged && !propsChanged ? (
                <p className="text-sm text-[var(--lc-text-muted)]">{t('edit.diff.empty')}</p>
              ) : (
                <dl className="space-y-2 text-sm">
                  {priceChanged ? (
                    <div
                      className="flex items-center justify-between rounded-[var(--lc-radius-md)] bg-[var(--lc-status-underOffer-bg)] px-2 py-1"
                      data-diff-field="price"
                    >
                      <dt className="text-[var(--lc-text-muted)]">{t('edit.diff.price')}</dt>
                      <dd className="text-[var(--lc-status-underOffer-fg)]">
                        <Numeric as="span" className="line-through opacity-70">
                          {formatMoneyMinor(detail.monthly_price_minor, currency)}
                        </Numeric>{' '}
                        → <Numeric as="span">{formatMoneyMinor(priceNum, currency)}</Numeric>
                      </dd>
                    </div>
                  ) : null}
                  {propsChanged ? (
                    <div
                      className="flex items-center justify-between rounded-[var(--lc-radius-md)] bg-[var(--lc-status-underOffer-bg)] px-2 py-1"
                      data-diff-field="properties"
                    >
                      <dt className="text-[var(--lc-text-muted)]">{t('edit.diff.properties')}</dt>
                      <dd className="text-[var(--lc-status-underOffer-fg)]">
                        <Numeric as="span" className="line-through opacity-70">
                          {detail.properties_covered ?? '—'}
                        </Numeric>{' '}
                        → <Numeric as="span">{propsNum ?? '—'}</Numeric>
                      </dd>
                    </div>
                  ) : null}
                </dl>
              )}
            </div>

            {requiresTwoPerson ? (
              <div
                role="status"
                aria-live="polite"
                data-two-person-banner
                className="rounded-[var(--lc-radius-md)] border border-[var(--lc-status-underOffer-fg)] bg-[var(--lc-status-underOffer-bg)] p-[var(--lc-space-md)] text-[var(--lc-status-underOffer-fg)]"
              >
                <div className="flex items-center gap-2 font-semibold">
                  <AlertTriangle className="h-4 w-4" aria-hidden />
                  {t('edit.twoperson.title')}
                </div>
                <p className="mt-1 text-sm">{t('edit.twoperson.body')}</p>
              </div>
            ) : null}

            <div className="sticky bottom-4 rounded-[var(--lc-radius-lg)] border border-[var(--lc-border)] bg-[var(--lc-surface-raised)] p-[var(--lc-space-md)]">
              <div className="mb-3 flex items-center gap-2 text-sm">
                <Badge status={dirty ? 'pending' : 'published'}>
                  {dirty ? t('edit.dirty') : t('edit.clean')}
                </Badge>
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => void handleSave()}
                  disabled={!isDraft || saving || !dirty}
                >
                  {saving ? (
                    <Loader2 className="me-2 h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden />
                  ) : (
                    <Save className="me-2 h-4 w-4" aria-hidden />
                  )}
                  {t('edit.save')}
                </Button>
                <Button
                  type="button"
                  className="flex-1"
                  onClick={() => void handleSubmit()}
                  disabled={!isDraft || submitting}
                >
                  {submitting ? (
                    <Loader2 className="me-2 h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden />
                  ) : (
                    <Send className="me-2 h-4 w-4" aria-hidden />
                  )}
                  {t('edit.submit')}
                </Button>
              </div>
            </div>
          </aside>
        </div>
      )}
    </PackageConsoleFrame>
  )
}
