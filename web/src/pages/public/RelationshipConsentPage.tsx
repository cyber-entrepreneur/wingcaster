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
import { usePageTitle } from '@/lib/usePageTitle'
import { cn } from '@/lib/utils'
import type {
  ExclusiveConflictError,
  PublicConsentTerms,
  RelationshipType,
} from '@/pages/agent/contacts/relationshipTypes'

type ViewState =
  | { kind: 'loading' }
  | { kind: 'missing_token' }
  | { kind: 'error'; title: string; detail?: string }
  | { kind: 'ready'; terms: PublicConsentTerms }
  | { kind: 'accepted'; terms: PublicConsentTerms }
  | { kind: 'rejected'; terms: PublicConsentTerms }
  | { kind: 'conflict'; terms: PublicConsentTerms; detail?: string }

const TYPE_LABEL: Record<RelationshipType, string> = {
  representation: 'Representation',
  mandate: 'Mandate',
  affinity: 'Affinity',
}

function formatDay(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

export function RelationshipConsentPage() {
  usePageTitle('Relationship consent')
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
          title: 'This consent link has expired',
          detail: 'Ask your agent to resend a new confirmation link.',
        })
        return
      }
      if (code === 'token_consumed' || code === 'not_pending') {
        setState({
          kind: 'error',
          title: 'This consent link is no longer valid',
          detail: 'It may already have been used, or the request was cancelled.',
        })
        return
      }
      setState({
        kind: 'error',
        title: 'Unable to open consent link',
        detail: err.message || 'The link may be invalid or incomplete.',
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
        title: 'Could not confirm relationship',
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
        title: 'Could not decline relationship',
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
          <span className="text-sm font-medium tracking-wide">WingCaster</span>
        </div>

        {state.kind === 'loading' ? (
          <div className="flex min-h-[40vh] items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-[var(--lc-action-primary)]" aria-label="Loading" />
          </div>
        ) : null}

        {state.kind === 'missing_token' ? (
          <ErrorPanel
            title="Consent link is incomplete"
            detail="Open the link from your email. Authorization requires a signed token — other URL parameters are ignored."
          />
        ) : null}

        {state.kind === 'error' ? (
          <ErrorPanel title={state.title} detail={state.detail} />
        ) : null}

        {state.kind === 'accepted' ? (
          <ResultPanel
            tone="success"
            title="Relationship confirmed"
            detail="Thanks — your agent has been notified. You can close this page."
            terms={state.terms}
          />
        ) : null}

        {state.kind === 'rejected' ? (
          <ResultPanel
            tone="neutral"
            title="Relationship declined"
            detail="No representation was created. You can close this page."
            terms={state.terms}
          />
        ) : null}

        {state.kind === 'conflict' ? (
          <ErrorPanel
            title="Another exclusive already exists"
            detail={
              state.detail ||
              'An exclusive relationship for this party type is already active with another agency. Contact your agent before confirming.'
            }
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
              Confirm this relationship
            </h1>
            <p className="mb-6 text-[length:var(--lc-type-body-lg)] text-[var(--lc-text-muted)]">
              An agent asked you to confirm how they may represent you. Review the terms, then
              accept or decline.
            </p>

            <TermsSummary terms={state.terms} />

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
                Decline
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
                Accept &amp; confirm
              </Button>
            </div>
          </section>
        ) : null}
      </div>
    </div>
  )
}

function TermsSummary({ terms }: { terms: PublicConsentTerms }) {
  const areas = Array.isArray(terms.scope?.areas) ? terms.scope.areas : []
  const types = Array.isArray(terms.scope?.property_types) ? terms.scope.property_types : []
  return (
    <div
      className={cn(
        'space-y-3 rounded-[var(--lc-radius-md)] bg-[var(--lc-surface-sunken)]',
        'p-[var(--lc-space-md)]',
      )}
    >
      <div className="flex flex-wrap gap-2">
        <Badge variant="secondary">{TYPE_LABEL[terms.relationship_type]}</Badge>
        <Badge variant="outline" className="capitalize">
          {terms.party_type}
        </Badge>
        {terms.exclusivity === 'exclusive' ? <Badge>Exclusive</Badge> : null}
      </div>
      <dl className="grid gap-2 text-[length:var(--lc-type-body-sm)] text-[var(--lc-text-muted)]">
        <div className="flex gap-2">
          <dt className="w-24 shrink-0">Starts</dt>
          <dd className="text-[var(--lc-text-primary)]">
            <Numeric>{formatDay(terms.starts_at)}</Numeric>
          </dd>
        </div>
        <div className="flex gap-2">
          <dt className="w-24 shrink-0">Ends</dt>
          <dd className="text-[var(--lc-text-primary)]">
            <Numeric>{formatDay(terms.ends_at)}</Numeric>
          </dd>
        </div>
        <div className="flex gap-2">
          <dt className="w-24 shrink-0">Areas</dt>
          <dd className="text-[var(--lc-text-primary)]">{areas.length ? areas.join(' · ') : '—'}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="w-24 shrink-0">Types</dt>
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
}: {
  tone: 'success' | 'neutral'
  title: string
  detail: string
  terms: PublicConsentTerms
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
      <TermsSummary terms={terms} />
    </section>
  )
}

export default RelationshipConsentPage
