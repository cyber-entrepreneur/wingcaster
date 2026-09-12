import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Building2, Check, Crown, Loader2, MapPin, Sparkles } from 'lucide-react'
import { api } from '@/api/client'
import { ContextEchoCard, EvidenceUploader } from '@/components/forms'
import { StatusHero } from '@/components/recipient'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useLocale } from '@/hooks/useLocale'
import { usePageTitle } from '@/lib/usePageTitle'
import { useToast } from '@/components/ui/toast'
import { cn } from '@/lib/utils'
import {
  EVIDENCE_MAX_BYTES,
  PRICE_REPORT_ACCEPTED_TYPES,
  PRICE_REPORT_CURRENCIES,
  PRICE_REPORT_EVIDENCE_MAX,
  PRICE_REPORT_NOTES_MAX,
  PRICE_REPORT_NOTES_MIN,
} from './constants'
import { priceReportT } from './copy'
import { CharacterCounter, SectionCard } from './FormBits'
import type { PackageFeatureFlags, PriceReportEcho, PriceReportSubjectKind } from './types'
import { useEvidenceFiles } from './useEvidenceFiles'
import { usePackageFeatureFlags } from './usePackageFeatureFlags'

type Phase = 'form' | 'success' | 'upsell'

function UpsellCard({ t }: { t: (key: Parameters<typeof priceReportT>[0]) => string }) {
  return (
    <div className="mx-auto max-w-[560px] rounded-[var(--lc-radius-lg)] border border-[var(--lc-border)] bg-[var(--lc-surface-raised)] p-[var(--lc-space-2xl)] text-center shadow-[var(--lc-elevation-md)]">
      <Crown
        className="mx-auto h-10 w-10 text-[var(--lc-action-primary)]"
        aria-hidden
      />
      <h1 className="mt-[var(--lc-space-md)] text-[length:var(--lc-type-heading-1)] text-[var(--lc-text-heading)]">
        {t('upsellHeading')}
      </h1>
      <p className="mt-[var(--lc-space-sm)] text-[length:var(--lc-type-body)] text-[var(--lc-text-primary)]">
        {t('upsellBody')}
      </p>
      <ul className="mt-[var(--lc-space-lg)] space-y-[var(--lc-space-sm)] text-start">
        {[t('upsellBullet1'), t('upsellBullet2'), t('upsellBullet3')].map((item) => (
          <li key={item} className="flex items-start gap-2 text-sm text-[var(--lc-text-primary)]">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-[var(--lc-accent-bold-edge)]" aria-hidden />
            <span>{item}</span>
          </li>
        ))}
      </ul>
      <div className="mt-[var(--lc-space-xl)] flex flex-col gap-[var(--lc-space-sm)] sm:flex-row sm:justify-center">
        <Button asChild size="lg">
          <Link to="/plans?highlight=wf06">{t('upsellPrimary')}</Link>
        </Button>
        <Button asChild variant="ghost">
          <Link to="/plans">{t('upsellSecondary')}</Link>
        </Button>
      </div>
    </div>
  )
}

function parseEcho(params: URLSearchParams): PriceReportEcho | null {
  const title = params.get('title') || params.get('listing_title')
  if (!title) return null
  return {
    title,
    subtitle: params.get('subtitle') || params.get('location') || undefined,
    price: params.get('price') || undefined,
    area: params.get('area') || undefined,
    beds: params.get('bedrooms') || undefined,
  }
}

export type PriceReportPageProps = {
  /** Inject feature flags in tests — skips subscription fetch when set. */
  featureFlagsOverride?: PackageFeatureFlags | null
}

/**
 * AGT-APR-005 — Submit price report (WF-06 initiator).
 * Route: `/reports/prices/new`. Pro-gated via `valuation.price_reports.submit`.
 * Posts to `POST /api/pricing/agent-price-reports`.
 */
export function PriceReportPage({ featureFlagsOverride }: PriceReportPageProps = {}) {
  const [searchParams] = useSearchParams()
  const { addToast } = useToast()
  const { locale, isArabic } = useLocale()
  const t = (key: Parameters<typeof priceReportT>[0]) => priceReportT(key, locale)
  usePageTitle(t('heroHeading'))

  const { loading: flagsLoading, hasPriceReportsSubmit } =
    usePackageFeatureFlags(featureFlagsOverride)

  const listingId = searchParams.get('listing_id') || searchParams.get('property_id') || ''
  const echoFromQuery = useMemo(() => parseEcho(searchParams), [searchParams])

  const [phase, setPhase] = useState<Phase>('form')
  const [subjectKind, setSubjectKind] = useState<PriceReportSubjectKind>(
    listingId ? 'property' : 'external',
  )
  const [propertyId, setPropertyId] = useState(listingId)
  const [externalTitle, setExternalTitle] = useState(searchParams.get('title') || '')
  const [externalLocation, setExternalLocation] = useState(
    searchParams.get('location') || searchParams.get('subtitle') || '',
  )
  const [soldPrice, setSoldPrice] = useState('')
  const [currency, setCurrency] = useState('AED')
  const [soldDate, setSoldDate] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  const evidence = useEvidenceFiles(PRICE_REPORT_EVIDENCE_MAX)

  const subjectSelected =
    subjectKind === 'property' ? Boolean(propertyId.trim()) : Boolean(externalTitle.trim())

  const echo: PriceReportEcho | null = useMemo(() => {
    if (echoFromQuery) return echoFromQuery
    if (subjectKind === 'property' && propertyId.trim()) {
      return { title: propertyId.trim(), subtitle: 'Selected listing' }
    }
    if (subjectKind === 'external' && externalTitle.trim()) {
      return {
        title: externalTitle.trim(),
        subtitle: externalLocation.trim() || undefined,
      }
    }
    return null
  }, [echoFromQuery, subjectKind, propertyId, externalTitle, externalLocation])

  const notesLen = notes.trim().length
  const priceNum = Number(soldPrice)
  const canSubmit =
    subjectSelected &&
    Number.isFinite(priceNum) &&
    priceNum > 0 &&
    notesLen >= PRICE_REPORT_NOTES_MIN &&
    notesLen <= PRICE_REPORT_NOTES_MAX &&
    !evidence.uploading &&
    !submitting

  function validate(): Record<string, string> {
    const next: Record<string, string> = {}
    if (!subjectSelected) next.subject = t('subjectRequired')
    if (!Number.isFinite(priceNum) || priceNum <= 0) next.sold_price = t('amountRequired')
    if (notesLen < PRICE_REPORT_NOTES_MIN) next.notes = t('notesTooShort')
    if (notesLen > PRICE_REPORT_NOTES_MAX) next.notes = t('notesTooLong')
    if (evidence.uploading) next.evidence = t('waitingUploads')
    return next
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault()
    const errors = validate()
    setFieldErrors(errors)
    if (Object.keys(errors).length > 0) return

    setSubmitting(true)
    try {
      await api.submitAgentPriceReport({
        property_id: subjectKind === 'property' ? propertyId.trim() : undefined,
        external_property_title:
          subjectKind === 'external' ? externalTitle.trim() : undefined,
        external_property_location:
          subjectKind === 'external' ? externalLocation.trim() || undefined : undefined,
        sold_price: priceNum,
        currency,
        sold_date: soldDate || undefined,
        notes: notes.trim(),
        supporting_document_url: evidence.firstCompleteUrl || undefined,
      })
      setPhase('success')
    } catch (err: unknown) {
      const e = err as { message?: string; error?: string; status?: number }
      const message = e.message || e.error || t('networkError')
      if (
        e.error === 'FEATURE_NOT_ENABLED' ||
        e.status === 403 ||
        /FEATURE_NOT_ENABLED|Pro-tier/i.test(String(message))
      ) {
        setPhase('upsell')
        return
      }
      if (/VALIDATION|required|must be/i.test(message)) {
        setFieldErrors({ form: message })
      }
      addToast({ title: t('networkError'), description: message, variant: 'error' })
    } finally {
      setSubmitting(false)
    }
  }

  if (flagsLoading) {
    return (
      <div className="min-h-screen bg-[var(--lc-bg-page)] px-4 py-8" dir={isArabic ? 'rtl' : 'ltr'}>
        <div
          className="mx-auto max-w-[760px] animate-pulse space-y-4"
          aria-busy="true"
          aria-label={t('loadingAria')}
          data-testid="price-report-loading"
        >
          <div className="h-24 rounded-[var(--lc-radius-lg)] bg-[var(--lc-surface-sunken)]" />
          <div className="h-48 rounded-[var(--lc-radius-lg)] bg-[var(--lc-surface-sunken)]" />
          <div className="h-48 rounded-[var(--lc-radius-lg)] bg-[var(--lc-surface-sunken)]" />
        </div>
      </div>
    )
  }

  if (!hasPriceReportsSubmit || phase === 'upsell') {
    return (
      <div
        className="min-h-screen bg-[var(--lc-bg-page)] px-4 py-[var(--lc-space-2xl)]"
        data-testid="price-report-upsell"
        dir={isArabic ? 'rtl' : 'ltr'}
      >
        <UpsellCard t={t} />
      </div>
    )
  }

  if (phase === 'success') {
    return (
      <div
        className="min-h-screen bg-[var(--lc-bg-page)] px-4 py-8 sm:px-6"
        data-testid="price-report-success"
        dir={isArabic ? 'rtl' : 'ltr'}
      >
        <div className="mx-auto max-w-[760px] space-y-[var(--lc-space-lg)]">
          <PageHero t={t} />
          <StatusHero state="pending" label={t('successLabel')} emphasis="default" />
          <p className="text-[length:var(--lc-type-body)] text-[var(--lc-text-muted)]">
            {t('successSla')}
          </p>
          <p className="text-[length:var(--lc-type-body)] text-[var(--lc-text-primary)]">
            {t('successBody')}
          </p>
          <div className="flex flex-wrap gap-[var(--lc-space-sm)]">
            <Button asChild>
              <Link to="/agent/pricing">{t('successPrimary')}</Link>
            </Button>
            <Button
              variant="outline"
              type="button"
              onClick={() => {
                setPhase('form')
                setSoldPrice('')
                setNotes('')
                setSoldDate('')
                evidence.reset()
                setFieldErrors({})
              }}
            >
              {t('successSecondary')}
            </Button>
          </div>
        </div>
      </div>
    )
  }

  const echoMeta = echo
    ? [
        echo.price != null
          ? { key: 'price', value: echo.price, numeric: true as const }
          : null,
        echo.area != null
          ? { key: 'area', value: echo.area, numeric: true as const }
          : null,
        echo.beds != null ? { key: 'beds', value: `${echo.beds} BR` } : null,
      ].filter(Boolean) as Array<{
        key: string
        value: string | number
        numeric?: boolean
      }>
    : []

  return (
    <div
      className="min-h-screen bg-[var(--lc-bg-page)] px-4 py-[var(--lc-space-2xl)] pb-[var(--lc-space-4xl)] sm:px-6"
      data-testid="price-report-page"
      dir={isArabic ? 'rtl' : 'ltr'}
    >
      <div className="mx-auto max-w-[760px] space-y-[var(--lc-space-lg)]">
        <PageHero t={t} />

        <ol
          className="flex flex-wrap items-center gap-[var(--lc-space-sm)] text-[length:var(--lc-type-caption)] text-[var(--lc-text-muted)]"
          aria-label="Report sections"
        >
          {['Subject', 'Recommendation', 'Rationale', 'Publication'].map((label, index) => (
            <li key={label} className="inline-flex items-center gap-2">
              {index > 0 ? (
                <span className="hidden h-px w-6 bg-[var(--lc-border-strong)] sm:inline-block" aria-hidden />
              ) : null}
              <span
                className={cn(
                  'inline-flex h-6 w-6 items-center justify-center rounded-full border text-xs',
                  index === 0
                    ? 'border-[var(--lc-accent-bold-edge)] text-[var(--lc-accent-bold-edge)]'
                    : 'border-[var(--lc-border-strong)]',
                )}
                aria-current={index === 0 ? 'step' : undefined}
              >
                {index + 1}
              </span>
              <span>{label}</span>
            </li>
          ))}
        </ol>

        <form className="space-y-[var(--lc-space-lg)]" onSubmit={onSubmit} noValidate>
          <SectionCard
            headingId="apr-section-1"
            title={t('sectionSubject')}
            helper={t('sectionSubjectHelper')}
          >
            <div
              role="radiogroup"
              aria-label={t('sectionSubjectHelper')}
              className="flex max-w-md overflow-hidden rounded-[var(--lc-radius-pill)] border border-[var(--lc-border)] bg-[var(--lc-surface-sunken)]"
            >
              {(
                [
                  ['property', t('subjectProperty')],
                  ['external', t('subjectExternal')],
                ] as const
              ).map(([value, label]) => {
                const selected = subjectKind === value
                return (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    className={cn(
                      'min-h-tap flex-1 px-3 text-sm transition-colors duration-fast',
                      selected
                        ? 'bg-[var(--lc-action-primary)] text-[var(--lc-action-primary-text)]'
                        : 'text-[var(--lc-text-primary)]',
                    )}
                    onClick={() => setSubjectKind(value)}
                  >
                    {label}
                  </button>
                )
              })}
            </div>

            {subjectKind === 'property' ? (
              <div className="space-y-[var(--lc-space-sm)]">
                <Label htmlFor="apr-property-id">{t('propertyIdLabel')}</Label>
                <Input
                  id="apr-property-id"
                  value={propertyId}
                  onChange={(e) => setPropertyId(e.target.value)}
                  placeholder={t('propertyIdPlaceholder')}
                />
              </div>
            ) : (
              <div className="grid gap-[var(--lc-space-md)] sm:grid-cols-2">
                <div className="space-y-[var(--lc-space-sm)] sm:col-span-2">
                  <Label htmlFor="apr-ext-title">{t('externalTitleLabel')}</Label>
                  <Input
                    id="apr-ext-title"
                    value={externalTitle}
                    onChange={(e) => setExternalTitle(e.target.value)}
                  />
                </div>
                <div className="space-y-[var(--lc-space-sm)] sm:col-span-2">
                  <Label htmlFor="apr-ext-location">{t('externalLocationLabel')}</Label>
                  <Input
                    id="apr-ext-location"
                    value={externalLocation}
                    onChange={(e) => setExternalLocation(e.target.value)}
                  />
                </div>
              </div>
            )}

            {fieldErrors.subject ? (
              <p role="alert" className="text-sm text-[var(--lc-status-unpublished-fg)]">
                {fieldErrors.subject}
              </p>
            ) : null}

            {echo ? (
              <ContextEchoCard
                glyph={subjectKind === 'property' ? Building2 : MapPin}
                title={echo.title}
                subtitle={echo.subtitle}
                meta_row={echoMeta}
              />
            ) : null}
          </SectionCard>

          <SectionCard
            headingId="apr-section-2"
            title={t('sectionRecommendation')}
            helper={t('sectionRecommendationHelper')}
            muted={!subjectSelected}
          >
            <div className="grid gap-[var(--lc-space-md)] sm:grid-cols-[120px_1fr_160px]">
              <div className="space-y-[var(--lc-space-sm)]">
                <Label htmlFor="apr-currency">{t('currencyLabel')}</Label>
                <select
                  id="apr-currency"
                  className="min-h-tap w-full rounded-[var(--lc-radius-md)] border border-[var(--lc-border-strong)] bg-[var(--lc-surface-raised)] px-3 text-sm"
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  disabled={!subjectSelected}
                >
                  {PRICE_REPORT_CURRENCIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-[var(--lc-space-sm)]">
                <Label htmlFor="apr-amount">{t('amountLabel')}</Label>
                <Input
                  id="apr-amount"
                  type="number"
                  min="1"
                  step="any"
                  inputMode="decimal"
                  value={soldPrice}
                  onChange={(e) => setSoldPrice(e.target.value)}
                  disabled={!subjectSelected}
                  aria-invalid={Boolean(fieldErrors.sold_price)}
                />
                {fieldErrors.sold_price ? (
                  <p role="alert" className="text-xs text-[var(--lc-status-unpublished-fg)]">
                    {fieldErrors.sold_price}
                  </p>
                ) : null}
              </div>
              <div className="space-y-[var(--lc-space-sm)]">
                <Label htmlFor="apr-sold-date">{t('soldDateLabel')}</Label>
                <Input
                  id="apr-sold-date"
                  type="date"
                  max={new Date().toISOString().slice(0, 10)}
                  value={soldDate}
                  onChange={(e) => setSoldDate(e.target.value)}
                  disabled={!subjectSelected}
                />
              </div>
            </div>
          </SectionCard>

          <SectionCard
            headingId="apr-section-3"
            title={t('sectionRationale')}
            helper={t('sectionRationaleHelper')}
            muted={!subjectSelected}
          >
            <div className="space-y-[var(--lc-space-sm)]">
              <Label htmlFor="apr-notes">{t('notesLabel')}</Label>
              <textarea
                id="apr-notes"
                rows={6}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={t('notesPlaceholder')}
                disabled={!subjectSelected}
                className="w-full rounded-[var(--lc-radius-md)] border border-[var(--lc-border-strong)] bg-[var(--lc-surface-raised)] px-3 py-2 text-sm text-[var(--lc-text-primary)] disabled:opacity-60"
                aria-invalid={Boolean(fieldErrors.notes)}
              />
              <div className="flex items-start justify-between gap-2">
                <p className="text-xs text-[var(--lc-text-muted)]">
                  {fieldErrors.notes ||
                    (notesLen > 0 && notesLen < PRICE_REPORT_NOTES_MIN
                      ? t('notesTooShort')
                      : null)}
                </p>
                <CharacterCounter value={notes.length} max={PRICE_REPORT_NOTES_MAX} />
              </div>
            </div>
          </SectionCard>

          <SectionCard
            headingId="apr-section-4"
            title={t('sectionPublication')}
            helper={t('sectionPublicationHelper')}
            muted={!subjectSelected}
          >
            <EvidenceUploader
              files={evidence.files}
              max_files={PRICE_REPORT_EVIDENCE_MAX}
              max_bytes_per_file={EVIDENCE_MAX_BYTES}
              accepted_types={PRICE_REPORT_ACCEPTED_TYPES}
              onAdd={evidence.onAdd}
              onRemove={evidence.onRemove}
              label={t('evidenceLabel')}
              helper_text={t('evidenceHelper')}
              disabled={submitting || !subjectSelected}
            />
            {fieldErrors.evidence ? (
              <p role="alert" className="text-sm text-[var(--lc-status-unpublished-fg)]">
                {fieldErrors.evidence}
              </p>
            ) : null}
          </SectionCard>

          {fieldErrors.form ? (
            <p role="alert" className="text-sm text-[var(--lc-status-unpublished-fg)]">
              {fieldErrors.form}
            </p>
          ) : null}

          <div className="sticky bottom-0 z-10 flex flex-col gap-[var(--lc-space-sm)] border-t border-[var(--lc-border)] bg-[var(--lc-surface-raised)] py-[var(--lc-space-md)] shadow-[var(--lc-elevation-sm)] sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-[var(--lc-text-muted)]">{t('autosaveHelper')}</p>
            <div className="flex flex-col-reverse gap-[var(--lc-space-sm)] sm:flex-row sm:items-center">
              <Button type="button" variant="ghost" disabled>
                {t('saveDraft')}
              </Button>
              <Button
                type="submit"
                size="lg"
                disabled={!canSubmit}
                aria-describedby={!canSubmit ? 'apr-submit-hint' : undefined}
              >
                {submitting ? (
                  <>
                    <Loader2 className="me-2 h-4 w-4 animate-spin" aria-hidden />
                    {t('submitBusy')}
                  </>
                ) : (
                  t('submitIdle')
                )}
              </Button>
              {!canSubmit ? (
                <span id="apr-submit-hint" className="sr-only">
                  Submit disabled:{' '}
                  {Object.values(validate())[0] || t('subjectRequired')}
                </span>
              ) : null}
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}

function PageHero({ t }: { t: (key: Parameters<typeof priceReportT>[0]) => string }) {
  return (
    <header className="flex flex-col gap-[var(--lc-space-md)] rounded-[var(--lc-radius-lg)] bg-[var(--lc-surface-sunken)] p-[var(--lc-space-xl)] sm:flex-row sm:items-start sm:justify-between">
      <div className="flex items-start gap-[var(--lc-space-sm)]">
        <Sparkles
          className="mt-1 h-6 w-6 shrink-0 text-[var(--lc-accent-bold-edge)]"
          aria-hidden
        />
        <div>
          <h1 className="text-[length:var(--lc-type-heading-1)] text-[var(--lc-text-heading)]">
            {t('heroHeading')}
          </h1>
          <p className="mt-1 text-[length:var(--lc-type-body)] text-[var(--lc-text-muted)]">
            {t('heroSubheading')}
          </p>
        </div>
      </div>
      <Badge
        className="inline-flex items-center gap-1 border border-[var(--lc-accent-bold-edge)] bg-[var(--lc-accent-bold)] text-[var(--lc-accent-bold-text)]"
        aria-label="Pro-tier feature"
      >
        <Crown className="h-3.5 w-3.5" aria-hidden />
        {t('proBadge')}
      </Badge>
    </header>
  )
}
