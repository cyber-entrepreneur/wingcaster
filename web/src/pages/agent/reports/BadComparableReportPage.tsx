import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  AlertCircle,
  Ban,
  Building2,
  Check,
  DollarSign,
  Loader2,
  Ruler,
  XCircle,
} from 'lucide-react'
import { api } from '@/api/client'
import { ContextEchoCard, EvidenceUploader } from '@/components/forms'
import { StatusHero } from '@/components/recipient'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useLocale } from '@/hooks/useLocale'
import { usePageTitle } from '@/lib/usePageTitle'
import { useToast } from '@/components/ui/toast'
import { cn } from '@/lib/utils'
import {
  BAD_COMPARABLE_ACCEPTED_TYPES,
  BAD_COMPARABLE_EVIDENCE_MAX,
  BAD_COMPARABLE_NOTES_MAX,
  BAD_COMPARABLE_NOTES_MIN,
  BAD_COMPARABLE_REASONS,
  COMPARABLE_TYPES,
  EVIDENCE_MAX_BYTES,
  type BadComparableReason,
  type ComparableType,
} from './constants'
import { badComparableT, reasonCopy } from './copy'
import { CharacterCounter } from './FormBits'
import type { BadComparableEcho } from './types'
import { useEvidenceFiles } from './useEvidenceFiles'

const REASON_ICONS = {
  DollarSign,
  Ruler,
  XCircle,
  Ban,
  AlertCircle,
} as const

type Phase = 'form' | 'success'

function parseEcho(params: URLSearchParams): BadComparableEcho | null {
  const title = params.get('title') || params.get('address')
  if (!title) return null
  return {
    title,
    subtitle: params.get('subtitle') || params.get('area_label') || undefined,
    price: params.get('price') || undefined,
    area: params.get('sqft') || params.get('area') || undefined,
    bedrooms: params.get('bedrooms') || undefined,
    source: params.get('source') || undefined,
    channel: params.get('channel') || undefined,
  }
}

/**
 * AGT-APR-004 — Submit bad-comparable report (WF-05 initiator).
 * Direct-entry page at `/reports/comparables/new` (+ optional `:comparableId` route).
 * Posts to `POST /api/pricing/report-comparable`.
 */
export function BadComparableReportPage() {
  const navigate = useNavigate()
  const { comparableId: routeComparableId } = useParams<{ comparableId?: string }>()
  const [searchParams] = useSearchParams()
  const { addToast } = useToast()
  const { locale, isArabic } = useLocale()
  const t = (key: Parameters<typeof badComparableT>[0]) => badComparableT(key, locale)
  usePageTitle(t('pageTitle'))

  const initialId = routeComparableId || searchParams.get('comparable_id') || ''
  const initialType = (searchParams.get('comparable_type') || 'external') as ComparableType
  const echo = useMemo(() => parseEcho(searchParams), [searchParams])

  const [phase, setPhase] = useState<Phase>('form')
  const [comparableId, setComparableId] = useState(initialId)
  const [comparableType, setComparableType] = useState<ComparableType>(
    COMPARABLE_TYPES.includes(initialType) ? initialType : 'external',
  )
  const [reason, setReason] = useState<BadComparableReason | ''>('')
  const [notes, setNotes] = useState('')
  const [confidence, setConfidence] = useState<'self_witnessed' | 'hearsay' | 'hard_evidence'>(
    'self_witnessed',
  )
  const [submitting, setSubmitting] = useState(false)
  const [fieldError, setFieldError] = useState<string | null>(null)

  const evidence = useEvidenceFiles(BAD_COMPARABLE_EVIDENCE_MAX)

  const notesLen = notes.trim().length
  const canSubmit =
    Boolean(comparableId.trim()) &&
    Boolean(reason) &&
    notesLen >= BAD_COMPARABLE_NOTES_MIN &&
    notesLen <= BAD_COMPARABLE_NOTES_MAX &&
    !evidence.uploading &&
    !submitting

  const disabledReason = !comparableId.trim()
    ? t('comparableRequired')
    : !reason
      ? t('reasonRequired')
      : notesLen < BAD_COMPARABLE_NOTES_MIN
        ? t('notesTooShort')
        : notesLen > BAD_COMPARABLE_NOTES_MAX
          ? t('notesTooLong')
          : evidence.uploading
            ? t('waitingUploads')
            : undefined

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!canSubmit || !reason) {
      setFieldError(disabledReason || t('reasonRequired'))
      return
    }
    setSubmitting(true)
    setFieldError(null)
    try {
      const evidenceNote =
        evidence.files.length > 0
          ? `\n\nEvidence: ${evidence.files.map((f) => f.name).join(', ')}`
          : ''
      const confidenceNote = `\n\nConfidence: ${confidence}`
      await api.reportComparable({
        comparable_id: comparableId.trim(),
        comparable_type: comparableType,
        reason,
        notes: `${notes.trim()}${confidenceNote}${evidenceNote}`,
      })
      setPhase('success')
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : t('networkError')
      addToast({ title: t('networkError'), description: message, variant: 'error' })
    } finally {
      setSubmitting(false)
    }
  }

  if (phase === 'success') {
    return (
      <div
        className="min-h-screen bg-[var(--lc-bg-page)] px-4 py-8 sm:px-6"
        data-testid="bad-comparable-success"
        dir={isArabic ? 'rtl' : 'ltr'}
      >
        <div className="mx-auto max-w-[680px] space-y-[var(--lc-space-lg)]">
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
            <Button variant="ghost" type="button" onClick={() => navigate(-1)}>
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
        echo.bedrooms != null
          ? { key: 'beds', value: `${echo.bedrooms} BR` }
          : null,
        echo.source
          ? {
              key: 'source',
              value: echo.source,
              channel: echo.channel,
            }
          : null,
      ].filter(Boolean) as Array<{
        key: string
        value: string | number
        numeric?: boolean
        channel?: string
      }>
    : []

  return (
    <div
      className="min-h-screen bg-[var(--lc-bg-page)] px-4 py-8 sm:px-6"
      data-testid="bad-comparable-report-page"
      dir={isArabic ? 'rtl' : 'ltr'}
    >
      <div className="mx-auto max-w-[680px]">
        <header className="mb-[var(--lc-space-lg)]">
          <h1 className="text-[length:var(--lc-type-heading-1)] text-[var(--lc-text-heading)]">
            {t('pageTitle')}
          </h1>
        </header>

        <form
          className="space-y-[var(--lc-space-lg)]"
          onSubmit={onSubmit}
          noValidate
          aria-describedby={fieldError ? 'bcr-form-error' : undefined}
        >
          {echo ? (
            <section aria-label={t('echoAria')}>
              <ContextEchoCard
                glyph={Building2}
                title={echo.title}
                subtitle={echo.subtitle}
                meta_row={echoMeta}
              />
            </section>
          ) : null}

          <div className="space-y-[var(--lc-space-sm)]">
            <Label htmlFor="bcr-comparable-id">{t('comparableIdLabel')}</Label>
            <Input
              id="bcr-comparable-id"
              value={comparableId}
              onChange={(e) => setComparableId(e.target.value)}
              placeholder={t('comparableIdPlaceholder')}
              required
              disabled={Boolean(routeComparableId)}
            />
          </div>

          <div className="space-y-[var(--lc-space-sm)]">
            <Label htmlFor="bcr-comparable-type">{t('comparableTypeLabel')}</Label>
            <select
              id="bcr-comparable-type"
              className="min-h-tap w-full rounded-[var(--lc-radius-md)] border border-[var(--lc-border-strong)] bg-[var(--lc-surface-raised)] px-3 text-sm text-[var(--lc-text-primary)]"
              value={comparableType}
              onChange={(e) => setComparableType(e.target.value as ComparableType)}
            >
              {COMPARABLE_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>

          <fieldset className="space-y-[var(--lc-space-sm)]">
            <legend className="text-[length:var(--lc-type-overline)] text-[var(--lc-text-muted)]">
              {t('reasonLabel')}
            </legend>
            <div
              role="radiogroup"
              aria-label={t('reasonLabel')}
              className="grid grid-cols-2 gap-[var(--lc-space-sm)] md:grid-cols-3"
            >
              {BAD_COMPARABLE_REASONS.map((item) => {
                const Icon = REASON_ICONS[item.glyph as keyof typeof REASON_ICONS] ?? AlertCircle
                const selected = reason === item.value
                const labels = reasonCopy(item.value, locale)
                return (
                  <button
                    key={item.value}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    aria-describedby={`bcr-reason-help-${item.value}`}
                    className={cn(
                      'relative flex min-h-[88px] flex-col items-start gap-1 rounded-[var(--lc-radius-md)] p-[var(--lc-space-sm)] text-start transition-[border-color,background-color] duration-fast',
                      selected
                        ? 'border-2 border-[var(--lc-action-primary)] bg-[var(--lc-action-secondary)]'
                        : 'border border-[var(--lc-border)] bg-[var(--lc-surface-raised)]',
                    )}
                    onClick={() => setReason(item.value)}
                  >
                    {selected ? (
                      <Check
                        className="absolute end-2 top-2 h-4 w-4 text-[var(--lc-action-primary)]"
                        aria-hidden
                      />
                    ) : null}
                    <Icon className="h-5 w-5 text-[var(--lc-text-muted)]" aria-hidden />
                    <span className="text-sm font-medium text-[var(--lc-text-primary)]">
                      {labels.label}
                    </span>
                    <span
                      id={`bcr-reason-help-${item.value}`}
                      className="text-xs text-[var(--lc-text-muted)]"
                    >
                      {labels.helper}
                    </span>
                  </button>
                )
              })}
            </div>
          </fieldset>

          <div className="space-y-[var(--lc-space-sm)]">
            <Label htmlFor="bcr-notes">{t('notesLabel')}</Label>
            <textarea
              id="bcr-notes"
              rows={4}
              maxLength={BAD_COMPARABLE_NOTES_MAX + 50}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t('notesPlaceholder')}
              className="w-full rounded-[var(--lc-radius-md)] border border-[var(--lc-border-strong)] bg-[var(--lc-surface-raised)] px-3 py-2 text-sm text-[var(--lc-text-primary)]"
              aria-describedby="bcr-notes-hint"
            />
            <div className="flex items-start justify-between gap-2">
              <p id="bcr-notes-hint" className="text-xs text-[var(--lc-text-muted)]">
                {notesLen > 0 && notesLen < BAD_COMPARABLE_NOTES_MIN ? t('notesTooShort') : null}
              </p>
              <CharacterCounter value={notes.length} max={BAD_COMPARABLE_NOTES_MAX} />
            </div>
          </div>

          <EvidenceUploader
            files={evidence.files}
            max_files={BAD_COMPARABLE_EVIDENCE_MAX}
            max_bytes_per_file={EVIDENCE_MAX_BYTES}
            accepted_types={BAD_COMPARABLE_ACCEPTED_TYPES}
            onAdd={evidence.onAdd}
            onRemove={evidence.onRemove}
            label={t('evidenceLabel')}
            helper_text={t('evidenceHelper')}
            disabled={submitting}
          />

          <fieldset className="space-y-[var(--lc-space-sm)]">
            <legend className="text-[length:var(--lc-type-overline)] text-[var(--lc-text-muted)]">
              {t('confidenceLabel')}
            </legend>
            <div
              role="radiogroup"
              aria-label={t('confidenceLabel')}
              className="flex max-w-[360px] overflow-hidden rounded-[var(--lc-radius-pill)] border border-[var(--lc-border)] bg-[var(--lc-surface-sunken)]"
            >
              {(
                [
                  ['self_witnessed', t('confidenceSelf')],
                  ['hearsay', t('confidenceHearsay')],
                  ['hard_evidence', t('confidenceEvidence')],
                ] as const
              ).map(([value, label]) => {
                const selected = confidence === value
                return (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    className={cn(
                      'min-h-tap flex-1 px-2 text-xs transition-colors duration-fast',
                      selected
                        ? 'bg-[var(--lc-action-primary)] text-[var(--lc-action-primary-text)]'
                        : 'text-[var(--lc-text-primary)]',
                    )}
                    onClick={() => setConfidence(value)}
                  >
                    {label}
                  </button>
                )
              })}
            </div>
          </fieldset>

          {fieldError ? (
            <p id="bcr-form-error" role="alert" className="text-sm text-[var(--lc-status-unpublished-fg)]">
              {fieldError}
            </p>
          ) : null}

          <div className="sticky bottom-0 flex flex-col-reverse gap-[var(--lc-space-sm)] border-t border-[var(--lc-border)] bg-[var(--lc-surface-raised)] py-[var(--lc-space-md)] shadow-[var(--lc-elevation-sm)] sm:flex-row sm:items-center sm:justify-end">
            <Button type="button" variant="ghost" onClick={() => navigate(-1)}>
              {t('cancel')}
            </Button>
            <Button
              type="submit"
              size="lg"
              disabled={!canSubmit}
              aria-describedby={disabledReason ? 'bcr-submit-hint' : undefined}
              className="sm:max-w-[240px] sm:flex-none"
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
            {disabledReason ? (
              <span id="bcr-submit-hint" className="sr-only">
                Submit disabled: {disabledReason}
              </span>
            ) : null}
          </div>
        </form>
      </div>
    </div>
  )
}
