/**
 * AGT-CTC-007b — Public relationship consent landing.
 * Authorization is token-only (HMAC purpose=relationship_consent).
 * Never trust other URL query params for auth. Session-free.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { AlertTriangle, CheckCircle2, Handshake, Loader2, XCircle } from 'lucide-react'
import { api } from '@/api/client'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Numeric } from '@/components/ui/numeric'
import { useLocale } from '@/hooks/useLocale'
import { usePageTitle } from '@/lib/usePageTitle'
import { cn } from '@/lib/utils'
import { t, type ConsentCopyKey, type ConsentLocale } from '@/pages/public/consentCopy'
import type {
  ExclusiveConflictError,
  PartyType,
  PublicConsentTerms,
  RelationshipType,
} from '@/pages/agent/contacts/relationshipTypes'

type ViewState =
  | { kind: 'loading' }
  | { kind: 'missing_token' }
  | { kind: 'error'; titleKey?: ConsentCopyKey; title?: string; detailKey?: ConsentCopyKey; detail?: string }
  | { kind: 'ready'; terms: PublicConsentTerms }
  | { kind: 'accepted'; terms: PublicConsentTerms }
  | { kind: 'rejected'; terms: PublicConsentTerms }
  | { kind: 'conflict'; terms: PublicConsentTerms; detail?: string }

const TYPE_LABEL_KEY: Record<RelationshipType, ConsentCopyKey> = {
  representation: 'type.representation',
  mandate: 'type.mandate',
  affinity: 'type.affinity',
}

const PARTY_LABEL_KEY: Record<PartyType, ConsentCopyKey> = {
  buyer: 'party.buyer',
  seller: 'party.seller',
  landlord: 'party.landlord',
  tenant: 'party.tenant',
}

function formatDay(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

export function RelationshipConsentPage() {
  usePageTitle('Relationship consent')
  const { isArabic } = useLocale()
  const locale: ConsentLocale = isArabic ? 'ar' : 'en'
  const [params] = useSearchParams()
  // Token is the sole authorization input — ignore contactId / relationshipId / etc.
  const token = useMemo(() => String(params.get('token') || '').trim(), [params])
  const [state, setState] = useState<ViewState>({ kind: 'loading' })
  const [submitting, setSubmitting] = useState<'accept' | 'reject' | null>(null)

  const load = useCallback(async () => {
    if (!token) {
      setState({ kind: 'missing_token' })
      return
    }
    setState({ kind: 'loading' })
    try {
      const terms = (await api.getPublicRelationshipConsent(token)) as PublicConsentTerms
      setState({ kind: 'ready', terms })
    } catch (e: unknown) {
      const err = e as Error & { code?: string; status?: number; error?: string }
      const code = err.code || err.error
      if (err.status === 410 || code === 'expired') {
        setState({
          kind: 'error',
          titleKey: 'error.expired.title',
          detailKey: 'error.expired.detail',
        })
        return
      }
      if (code === 'token_consumed' || code === 'not_pending') {
        setState({
          kind: 'error',
          titleKey: 'error.consumed.title',
          detailKey: 'error.consumed.detail',
        })
        return
      }
      setState({
        kind: 'error',
        titleKey: 'error.generic.title',
        detail: err.message || undefined,
        detailKey: err.message ? undefined : 'error.generic.detail',
      })
    }
  }, [token])

  useEffect(() => {
    void load()
  }, [load])

  const accept = async () => {
    if (!token || state.kind !== 'ready') return
    setSubmitting('accept')
    try {
      await api.acceptPublicRelationshipConsent(token)
      setState({ kind: 'accepted', terms: state.terms })
    } catch (e: unknown) {
      const err = e as Error & ExclusiveConflictError & { status?: number }
      if (err.error === 'EXCLUSIVE_CONFLICT' || err.status === 409) {
        setState({
          kind: 'conflict',
          terms: state.terms,
          detail: err.message,
        })
        return
      }
      setState({
        kind: 'error',
        titleKey: 'error.acceptFail.title',
        detail: err.message,
      })
    } finally {
      setSubmitting(null)
    }
  }

  const reject = async () => {
    if (!token || state.kind !== 'ready') return
    setSubmitting('reject')
    try {
      await api.rejectPublicRelationshipConsent(token)
      setState({ kind: 'rejected', terms: state.terms })
    } catch (e: unknown) {
      const err = e as Error
      setState({
        kind: 'error',
        titleKey: 'error.rejectFail.title',
        detail: err.message,
      })
    } finally {
      setSubmitting(null)
    }
  }

  return (
    <div className="min-h-screen bg-[var(--lc-bg-page)] px-4 py-10">
      <div className="mx-auto w-full max-w-lg">
        <div className="mb-6 flex items-center gap-2 text-[var(--lc-text-muted)]">
          <Handshake className="h-5 w-5" aria-hidden />
          <span className="text-sm font-medium tracking-wide">{t('brand', locale)}</span>
        </div>

        {state.kind === 'loading' ? (
          <div className="flex min-h-[40vh] items-center justify-center">
            <Loader2
              className="h-8 w-8 animate-spin text-[var(--lc-action-primary)]"
              aria-label={t('loading', locale)}
            />
          </div>
        ) : null}

        {state.kind === 'missing_token' ? (
          <ErrorPanel
            title={t('missingToken.title', locale)}
            detail={t('missingToken.detail', locale)}
          />
        ) : null}

        {state.kind === 'error' ? (
          <ErrorPanel
            title={state.titleKey ? t(state.titleKey, locale) : state.title || ''}
            detail={state.detailKey ? t(state.detailKey, locale) : state.detail}
          />
        ) : null}

        {state.kind === 'accepted' ? (
          <ResultPanel
            tone="success"
            title={t('accepted.title', locale)}
            detail={t('accepted.detail', locale)}
            terms={state.terms}
            locale={locale}
          />
        ) : null}

        {state.kind === 'rejected' ? (
          <ResultPanel
            tone="neutral"
            title={t('rejected.title', locale)}
            detail={t('rejected.detail', locale)}
            terms={state.terms}
            locale={locale}
          />
        ) : null}

        {state.kind === 'conflict' ? (
          <ErrorPanel
            title={t('conflict.title', locale)}
            detail={state.detail || t('conflict.detail', locale)}
          />
        ) : null}

        {state.kind === 'ready' ? (
          <section
            className={cn(
              'rounded-[var(--lc-radius-lg)] border border-[var(--lc-border)]',
              'bg-[var(--lc-surface-raised)] p-[var(--lc-space-lg)]',
              'shadow-[var(--lc-elevation-sm)]',
            )}
            aria-labelledby="consent-title"
          >
            <h1
              id="consent-title"
              className="mb-2 font-semibold text-[var(--lc-text-primary)]"
              style={{ font: 'var(--lc-type-heading-1)' }}
            >
              {t('consent.title', locale)}
            </h1>
            <p className="mb-6 text-[length:var(--lc-type-body-lg)] text-[var(--lc-text-muted)]">
              {t('consent.intro', locale)}
            </p>

            <TermsSummary terms={state.terms} locale={locale} />

            <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-end">
              <Button
                variant="outline"
                disabled={Boolean(submitting)}
                onClick={() => void reject()}
                className="min-h-tap"
              >
                {submitting === 'reject' ? (
                  <Loader2 className="me-2 h-4 w-4 animate-spin" />
                ) : (
                  <XCircle className="me-2 h-4 w-4" aria-hidden />
                )}
                {t('consent.decline', locale)}
              </Button>
              <Button
                disabled={Boolean(submitting)}
                onClick={() => void accept()}
                className="min-h-tap"
              >
                {submitting === 'accept' ? (
                  <Loader2 className="me-2 h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="me-2 h-4 w-4" aria-hidden />
                )}
                {t('consent.accept', locale)}
              </Button>
            </div>
          </section>
        ) : null}
      </div>
    </div>
  )
}

function TermsSummary({ terms, locale }: { terms: PublicConsentTerms; locale: ConsentLocale }) {
  const areas = Array.isArray(terms.scope?.areas) ? terms.scope.areas : []
  const types = Array.isArray(terms.scope?.property_types) ? terms.scope.property_types : []
  const partyKey = PARTY_LABEL_KEY[terms.party_type as PartyType]
  return (
    <div
      className={cn(
        'space-y-3 rounded-[var(--lc-radius-md)] bg-[var(--lc-surface-sunken)]',
        'p-[var(--lc-space-md)]',
      )}
    >
      <div className="flex flex-wrap gap-2">
        <Badge variant="secondary">{t(TYPE_LABEL_KEY[terms.relationship_type], locale)}</Badge>
        <Badge variant="outline" className="capitalize">
          {partyKey ? t(partyKey, locale) : terms.party_type}
        </Badge>
        {terms.exclusivity === 'exclusive' ? <Badge>{t('terms.exclusive', locale)}</Badge> : null}
      </div>
      <dl className="grid gap-2 text-[length:var(--lc-type-body-sm)] text-[var(--lc-text-muted)]">
        <div className="flex gap-2">
          <dt className="w-24 shrink-0">{t('terms.starts', locale)}</dt>
          <dd className="text-[var(--lc-text-primary)]">
            <Numeric>{formatDay(terms.starts_at)}</Numeric>
          </dd>
        </div>
        <div className="flex gap-2">
          <dt className="w-24 shrink-0">{t('terms.ends', locale)}</dt>
          <dd className="text-[var(--lc-text-primary)]">
            <Numeric>{formatDay(terms.ends_at)}</Numeric>
          </dd>
        </div>
        <div className="flex gap-2">
          <dt className="w-24 shrink-0">{t('terms.areas', locale)}</dt>
          <dd className="text-[var(--lc-text-primary)]">{areas.length ? areas.join(' · ') : '—'}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="w-24 shrink-0">{t('terms.types', locale)}</dt>
          <dd className="text-[var(--lc-text-primary)] capitalize">
            {types.length ? types.join(' · ') : '—'}
          </dd>
        </div>
      </dl>
    </div>
  )
}

function ErrorPanel({ title, detail }: { title: string; detail?: string }) {
  return (
    <section
      role="alert"
      className={cn(
        'rounded-[var(--lc-radius-lg)] border border-[var(--lc-border)]',
        'bg-[var(--lc-status-unpublished-bg)] p-[var(--lc-space-lg)]',
        'text-[var(--lc-status-unpublished-fg)]',
      )}
    >
      <div className="flex gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
        <div>
          <h1 className="font-semibold" style={{ font: 'var(--lc-type-heading-2)' }}>
            {title}
          </h1>
          {detail ? (
            <p className="mt-2 text-[length:var(--lc-type-body-sm)] opacity-90">{detail}</p>
          ) : null}
        </div>
      </div>
    </section>
  )
}

function ResultPanel({
  tone,
  title,
  detail,
  terms,
  locale,
}: {
  tone: 'success' | 'neutral'
  title: string
  detail: string
  terms: PublicConsentTerms
  locale: ConsentLocale
}) {
  return (
    <section
      className={cn(
        'rounded-[var(--lc-radius-lg)] border border-[var(--lc-border)] p-[var(--lc-space-lg)]',
        tone === 'success'
          ? 'bg-[var(--lc-status-published-bg)] text-[var(--lc-status-published-fg)]'
          : 'bg-[var(--lc-surface-raised)] text-[var(--lc-text-primary)]',
      )}
    >
      <div className="mb-4 flex gap-3">
        {tone === 'success' ? (
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
        ) : (
          <XCircle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
        )}
        <div>
          <h1 className="font-semibold" style={{ font: 'var(--lc-type-heading-2)' }}>
            {title}
          </h1>
          <p className="mt-2 text-[length:var(--lc-type-body-sm)] opacity-90">{detail}</p>
        </div>
      </div>
      <TermsSummary terms={terms} locale={locale} />
    </section>
  )
}

export default RelationshipConsentPage
