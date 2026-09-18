import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowLeft,
  Building2,
  Check,
  CheckCircle2,
  Clock3,
  Loader2,
  UserRound,
} from 'lucide-react'
import {
  api,
  type PropertyDisposition,
  type PropertyDispositionResponse,
} from '@/api/client'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Numeric } from '@/components/ui/numeric'
import { Textarea } from '@/components/ui/textarea'
import { apiErrorMessage, isNotFound } from '@/lib/http-status'
import { usePageTitle } from '@/lib/usePageTitle'

const DISPOSITIONS: Array<{
  value: PropertyDisposition
  title: string
  description: string
}> = [
  {
    value: 'agency_retains',
    title: 'Agency retains',
    description: 'The listing and its custody remain with the agency.',
  },
  {
    value: 'agent_retains',
    title: 'Agent retains',
    description: 'The listing moves to the agent’s personal workspace.',
  },
  {
    value: 'archive',
    title: 'Archive listing',
    description: 'Close the listing while preserving its history and audit trail.',
  },
]

const STATUS_COPY = {
  pending: { label: 'Awaiting decisions', variant: 'draft' as const },
  agreed: { label: 'Agreement reached', variant: 'published' as const },
  disputed: { label: 'Needs alignment', variant: 'destructive' as const },
  completed: { label: 'Resolved', variant: 'closed' as const },
  cancelled: { label: 'Cancelled', variant: 'archived' as const },
}

function dispositionLabel(value: PropertyDisposition | null): string {
  return DISPOSITIONS.find((option) => option.value === value)?.title ?? 'Not decided'
}

function formatMoney(value: number | null, currency: string | null): string {
  if (value == null) return '—'
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: currency || 'USD',
      maximumFractionDigits: 0,
    }).format(value)
  } catch {
    return new Intl.NumberFormat().format(value)
  }
}

export function PropertyDispositionPage() {
  const { id } = useParams<{ id: string }>()
  const [data, setData] = useState<PropertyDispositionResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [error, setError] = useState('')
  const [choice, setChoice] = useState<PropertyDisposition | null>(null)
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [resolving, setResolving] = useState(false)

  usePageTitle(data ? `Disposition · ${data.property.title}` : 'Property disposition')

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    setError('')
    setNotFound(false)
    try {
      const response = await api.getPropertyDispositionCase(id)
      setData(response)
      const ownChoice = response.viewer_role === 'agent'
        ? response.case.agent_proposed_disposition
        : response.case.agency_proposed_disposition
      const ownNotes = response.viewer_role === 'agent'
        ? response.case.agent_notes
        : response.case.agency_notes
      setChoice(ownChoice)
      setNotes(ownNotes || '')
    } catch (loadError) {
      if (isNotFound(loadError)) setNotFound(true)
      else setError(apiErrorMessage(loadError, 'Could not load the disposition case.'))
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { void load() }, [load])

  const otherRole = data?.viewer_role === 'agent' ? 'agency' : 'agent'
  const otherChoice = data
    ? (otherRole === 'agent'
      ? data.case.agent_proposed_disposition
      : data.case.agency_proposed_disposition)
    : null
  const otherNotes = data
    ? (otherRole === 'agent' ? data.case.agent_notes : data.case.agency_notes)
    : null
  const closed = data ? ['completed', 'cancelled'].includes(data.case.status) : false
  const timeline = useMemo(() => {
    if (!data) return []
    return [
      { label: 'Case initiated', done: true },
      { label: `${data.parties.agent} decided`, done: Boolean(data.case.agent_proposed_disposition) },
      { label: `${data.parties.agency} decided`, done: Boolean(data.case.agency_proposed_disposition) },
      { label: 'Custody resolved', done: data.case.status === 'completed' },
    ]
  }, [data])

  async function saveDecision() {
    if (!id || !choice || saving) return
    setSaving(true)
    setError('')
    try {
      setData(await api.updatePropertyDispositionDecision(id, {
        disposition: choice,
        notes: notes.trim() || null,
      }))
    } catch (saveError) {
      setError(apiErrorMessage(saveError, 'Could not save your decision.'))
    } finally {
      setSaving(false)
    }
  }

  async function resolveCase() {
    if (!id || resolving) return
    setResolving(true)
    setError('')
    try {
      setData(await api.resolvePropertyDispositionCase(id))
    } catch (resolveError) {
      setError(apiErrorMessage(resolveError, 'Could not resolve the case.'))
    } finally {
      setResolving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center" role="status">
        <Loader2 className="h-8 w-8 animate-spin text-[var(--lc-action-primary)]" />
        <span className="sr-only">Loading disposition case</span>
      </div>
    )
  }

  if (notFound || !data) {
    return (
      <main className="mx-auto max-w-xl px-4 py-16 text-center">
        <Building2 className="mx-auto h-10 w-10 text-[var(--lc-text-muted)]" />
        <h1 className="mt-4 text-2xl font-semibold text-[var(--lc-text-primary)]">
          No active disposition case
        </h1>
        <p className="mt-2 text-sm text-[var(--lc-text-muted)]">
          This listing has no case you can review, or the case is no longer available.
        </p>
        <Button asChild variant="outline" className="mt-6">
          <Link to={id ? `/listings/${id}` : '/listings'}>
            <ArrowLeft className="me-2 h-4 w-4 rtl:rotate-180" />
            Back to listing
          </Link>
        </Button>
      </main>
    )
  }

  const statusMeta = STATUS_COPY[data.case.status]

  return (
    <main className="mx-auto max-w-6xl px-4 py-5 sm:px-6 sm:py-8">
      <Link
        to={`/listings/${data.property.id}`}
        className="inline-flex items-center text-sm font-medium text-[var(--lc-text-muted)] hover:text-[var(--lc-text-primary)]"
      >
        <ArrowLeft className="me-2 h-4 w-4 rtl:rotate-180" />
        Back to listing
      </Link>

      <header className="mt-5 rounded-[var(--lc-radius-lg)] bg-[var(--lc-surface-inverse)] p-5 text-[var(--lc-text-inverse)] sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide opacity-75">AGT-LST-013</p>
            <h1 className="mt-2 text-2xl font-semibold sm:text-3xl">Property disposition case</h1>
            <p className="mt-2 max-w-2xl text-sm opacity-80">
              {data.parties.agency} and {data.parties.agent} must agree on who retains this listing.
              You are responding as the {data.viewer_role}.
            </p>
          </div>
          <Badge variant={statusMeta.variant}>{statusMeta.label}</Badge>
        </div>
      </header>

      {error && (
        <div
          role="alert"
          className="mt-4 rounded-[var(--lc-radius-md)] border border-[var(--lc-status-unpublished-fg)] bg-[var(--lc-status-unpublished-bg)] px-4 py-3 text-sm text-[var(--lc-status-unpublished-fg)]"
        >
          {error}
        </div>
      )}

      {data.case.status === 'disputed' && (
        <div
          role="alert"
          className="mt-4 flex gap-3 rounded-[var(--lc-radius-md)] border border-[var(--lc-status-draft-fg)] bg-[var(--lc-status-draft-bg)] px-4 py-3 text-sm text-[var(--lc-status-draft-fg)]"
        >
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <p className="font-semibold">The recommendations do not match</p>
            <p className="mt-1">
              Review the other party’s position and update yours after discussing the custody outcome.
              The case remains flagged until both choices align.
            </p>
          </div>
        </div>
      )}

      {data.case.status === 'completed' && (
        <div className="mt-4 flex gap-3 rounded-[var(--lc-radius-md)] border border-[var(--lc-status-published-fg)] bg-[var(--lc-status-published-bg)] px-4 py-3 text-sm text-[var(--lc-status-published-fg)]">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
          <p>
            Resolved as <strong>{dispositionLabel(data.case.proposed_disposition)}</strong>.
            Listing custody and history have been updated.
          </p>
        </div>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Listing under review</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4 sm:flex-row">
              {data.property.photo ? (
                <img
                  src={data.property.photo}
                  alt=""
                  className="h-28 w-full rounded-[var(--lc-radius-md)] object-cover sm:w-40"
                />
              ) : (
                <div className="flex h-28 w-full items-center justify-center rounded-[var(--lc-radius-md)] bg-[var(--lc-surface-sunken)] sm:w-40">
                  <Building2 className="h-8 w-8 text-[var(--lc-text-muted)]" />
                </div>
              )}
              <div className="min-w-0">
                <h2 className="text-lg font-semibold text-[var(--lc-text-primary)]">{data.property.title}</h2>
                <p className="mt-1 text-sm text-[var(--lc-text-muted)]">
                  {[data.property.neighborhood, data.property.city].filter(Boolean).join(' · ')}
                </p>
                <dl className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm">
                  <div>
                    <dt className="text-[var(--lc-text-muted)]">Reference</dt>
                    <Numeric as="dd" className="font-semibold">{data.property.reference || '—'}</Numeric>
                  </div>
                  <div>
                    <dt className="text-[var(--lc-text-muted)]">List price</dt>
                    <Numeric as="dd" className="font-semibold">
                      {formatMoney(data.property.price, data.property.price_unit)}
                    </Numeric>
                  </div>
                </dl>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Set my decision</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <fieldset disabled={closed || saving}>
                <legend className="sr-only">Choose a property disposition</legend>
                <div className="grid gap-3">
                  {DISPOSITIONS.map((option) => {
                    const selected = choice === option.value
                    return (
                      <Label
                        key={option.value}
                        className={`flex cursor-pointer items-start gap-3 rounded-[var(--lc-radius-md)] border p-4 ${
                          selected
                            ? 'border-[var(--lc-action-primary)] bg-[var(--lc-action-secondary)]'
                            : 'border-[var(--lc-border)] bg-[var(--lc-surface)]'
                        } ${closed ? 'cursor-default opacity-70' : ''}`}
                      >
                        <input
                          type="radio"
                          name="disposition"
                          value={option.value}
                          checked={selected}
                          onChange={() => setChoice(option.value)}
                          className="mt-1 h-4 w-4 accent-[var(--lc-action-primary)]"
                        />
                        <span>
                          <span className="block font-semibold text-[var(--lc-text-primary)]">{option.title}</span>
                          <span className="mt-1 block text-sm font-normal text-[var(--lc-text-muted)]">
                            {option.description}
                          </span>
                        </span>
                      </Label>
                    )
                  })}
                </div>
                <div className="mt-5">
                  <Label htmlFor="disposition-notes">Notes for the other party</Label>
                  <Textarea
                    id="disposition-notes"
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                    maxLength={2000}
                    rows={4}
                    className="mt-2"
                    placeholder="Explain the mandate, client relationship, or reason for this recommendation."
                  />
                  <p className="mt-1 text-end text-xs text-[var(--lc-text-muted)]">
                    <Numeric>{notes.length}</Numeric> / <Numeric>2000</Numeric>
                  </p>
                </div>
              </fieldset>
              {!closed && (
                <Button onClick={saveDecision} disabled={!choice || saving} className="w-full sm:w-auto">
                  {saving && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
                  Save my decision
                </Button>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Other party’s decision</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-start gap-3">
                {otherRole === 'agency'
                  ? <Building2 className="h-5 w-5 text-[var(--lc-text-muted)]" />
                  : <UserRound className="h-5 w-5 text-[var(--lc-text-muted)]" />}
                <div>
                  <p className="font-semibold text-[var(--lc-text-primary)]">
                    {otherRole === 'agency' ? data.parties.agency : data.parties.agent}
                  </p>
                  <p className="mt-1 text-sm text-[var(--lc-text-muted)]">
                    {otherChoice ? dispositionLabel(otherChoice) : 'Waiting for their decision'}
                  </p>
                  {otherNotes && (
                    <blockquote className="mt-3 border-s-2 border-[var(--lc-border-strong)] ps-3 text-sm text-[var(--lc-text-primary)]">
                      {otherNotes}
                    </blockquote>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <aside className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Case timeline</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="space-y-4">
                {timeline.map((item) => (
                  <li key={item.label} className="flex gap-3 text-sm">
                    <span
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
                        item.done
                          ? 'bg-[var(--lc-status-published-bg)] text-[var(--lc-status-published-fg)]'
                          : 'bg-[var(--lc-surface-sunken)] text-[var(--lc-text-muted)]'
                      }`}
                    >
                      {item.done ? <Check className="h-4 w-4" /> : <Clock3 className="h-4 w-4" />}
                    </span>
                    <span className={item.done ? 'text-[var(--lc-text-primary)]' : 'text-[var(--lc-text-muted)]'}>
                      {item.label}
                    </span>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>

          {data.can_resolve && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Ready to resolve</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-[var(--lc-text-muted)]">
                  Both parties chose <strong className="text-[var(--lc-text-primary)]">
                    {dispositionLabel(data.case.agent_proposed_disposition)}
                  </strong>. Resolving updates custody immediately.
                </p>
                <Button onClick={resolveCase} disabled={resolving} className="w-full">
                  {resolving && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
                  Resolve case
                </Button>
              </CardContent>
            </Card>
          )}
        </aside>
      </div>
    </main>
  )
}
