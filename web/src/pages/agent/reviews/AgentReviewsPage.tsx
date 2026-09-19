import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  Flag,
  Loader2,
  MessageSquareReply,
  ShieldCheck,
  Star,
} from 'lucide-react'
import {
  api,
  type ManagedAgentReview,
  type ManagedAgentReviewsResponse,
  type ReviewFlagReason,
} from '@/api/client'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Numeric } from '@/components/ui/numeric'
import { apiErrorMessage } from '@/lib/http-status'
import { usePageTitle } from '@/lib/usePageTitle'

type ReviewFilter = 'all' | 'unanswered' | 'responded' | 'flagged'

const FLAG_REASONS: Array<{ value: ReviewFlagReason; label: string }> = [
  { value: 'spam', label: 'Spam or unrelated content' },
  { value: 'abusive', label: 'Abusive or threatening language' },
  { value: 'privacy', label: 'Exposes private information' },
  { value: 'conflict', label: 'Reviewer has a conflict of interest' },
  { value: 'false_claim', label: 'Contains a demonstrably false claim' },
  { value: 'other', label: 'Other policy concern' },
]

function Stars({ rating }: { rating: number }) {
  return (
    <span className="inline-flex" aria-label={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          aria-hidden="true"
          className={`h-4 w-4 ${
            star <= rating
              ? 'fill-[var(--lc-status-draft-dot)] text-[var(--lc-status-draft-dot)]'
              : 'text-[var(--lc-border-strong)]'
          }`}
        />
      ))}
    </span>
  )
}

function ReviewCard({
  review,
  onChanged,
}: {
  review: ManagedAgentReview
  onChanged: (review: ManagedAgentReview, change: 'response' | 'flag') => void
}) {
  const [responseOpen, setResponseOpen] = useState(false)
  const [response, setResponse] = useState(review.response || '')
  const [flagOpen, setFlagOpen] = useState(false)
  const [flagReason, setFlagReason] = useState<ReviewFlagReason>('false_claim')
  const [flagDetails, setFlagDetails] = useState('')
  const [busy, setBusy] = useState<'response' | 'flag' | null>(null)
  const [error, setError] = useState('')

  async function saveResponse() {
    if (!response.trim() || busy) return
    setBusy('response')
    setError('')
    try {
      const updated = await api.respondToAgentReview(review.id, response.trim())
      onChanged(updated, 'response')
      setResponse(updated.response || '')
      setResponseOpen(false)
    } catch (saveError) {
      setError(apiErrorMessage(saveError, 'Could not save your response.'))
    } finally {
      setBusy(null)
    }
  }

  async function submitFlag() {
    if (busy) return
    setBusy('flag')
    setError('')
    try {
      const updated = await api.flagAgentReview(review.id, {
        reason: flagReason,
        details: flagDetails.trim() || null,
      })
      onChanged(updated, 'flag')
      setFlagOpen(false)
    } catch (flagError) {
      setError(apiErrorMessage(flagError, 'Could not submit this flag.'))
    } finally {
      setBusy(null)
    }
  }

  return (
    <Card>
      <CardContent className="p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-semibold text-[var(--lc-text-primary)]">{review.reviewer.name}</p>
              {review.verified_transaction && (
                <Badge variant="published">
                  <ShieldCheck className="me-1 h-3 w-3" />
                  Verified transaction
                </Badge>
              )}
              {review.flag.status === 'pending' && (
                <Badge variant="draft">Flag under review</Badge>
              )}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Stars rating={Math.round(review.rating)} />
              <span className="text-xs text-[var(--lc-text-muted)]">
                {new Date(review.created_at).toLocaleDateString()}
              </span>
            </div>
          </div>
        </div>

        {review.title && <h2 className="mt-4 font-semibold text-[var(--lc-text-primary)]">{review.title}</h2>}
        <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[var(--lc-text-primary)]">
          {review.comment}
        </p>

        {review.response && !responseOpen && (
          <div className="mt-4 rounded-[var(--lc-radius-md)] border-s-4 border-[var(--lc-action-primary)] bg-[var(--lc-surface-sunken)] px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--lc-text-muted)]">Your response</p>
            <p className="mt-1 whitespace-pre-wrap text-sm text-[var(--lc-text-primary)]">{review.response}</p>
          </div>
        )}

        {error && (
          <div
            role="alert"
            className="mt-4 rounded-[var(--lc-radius-md)] bg-[var(--lc-status-unpublished-bg)] px-3 py-2 text-sm text-[var(--lc-status-unpublished-fg)]"
          >
            {error}
          </div>
        )}

        {responseOpen && (
          <div className="mt-4 space-y-3">
            <Label htmlFor={`response-${review.id}`}>Public response</Label>
            <textarea
              id={`response-${review.id}`}
              value={response}
              onChange={(event) => setResponse(event.target.value)}
              rows={4}
              maxLength={2000}
              className="w-full resize-y rounded-[var(--lc-radius-md)] border border-[var(--lc-border-strong)] bg-[var(--lc-surface)] px-3 py-2 text-sm text-[var(--lc-text-primary)] placeholder:text-[var(--lc-text-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lc-focus-ring)]"
              placeholder="Thank the client, acknowledge specifics, and keep private details out."
            />
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-[var(--lc-text-muted)]">
                <Numeric>{response.length}</Numeric> / <Numeric>2000</Numeric>
              </p>
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => setResponseOpen(false)}>Cancel</Button>
                <Button type="button" onClick={saveResponse} disabled={!response.trim() || Boolean(busy)}>
                  {busy === 'response' && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
                  Publish response
                </Button>
              </div>
            </div>
          </div>
        )}

        {flagOpen && (
          <div className="mt-4 space-y-3 rounded-[var(--lc-radius-md)] border border-[var(--lc-border)] bg-[var(--lc-surface-sunken)] p-4">
            <div>
              <Label htmlFor={`flag-reason-${review.id}`}>Why should this review be checked?</Label>
              <select
                id={`flag-reason-${review.id}`}
                value={flagReason}
                onChange={(event) => setFlagReason(event.target.value as ReviewFlagReason)}
                className="mt-2 min-h-tap w-full rounded-[var(--lc-radius-md)] border border-[var(--lc-border-strong)] bg-[var(--lc-surface)] px-3 text-sm text-[var(--lc-text-primary)]"
              >
                {FLAG_REASONS.map((reason) => (
                  <option key={reason.value} value={reason.value}>{reason.label}</option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor={`flag-details-${review.id}`}>Supporting details (optional)</Label>
              <textarea
                id={`flag-details-${review.id}`}
                value={flagDetails}
                onChange={(event) => setFlagDetails(event.target.value)}
                rows={3}
                maxLength={1000}
                className="mt-2 w-full resize-y rounded-[var(--lc-radius-md)] border border-[var(--lc-border-strong)] bg-[var(--lc-surface)] px-3 py-2 text-sm text-[var(--lc-text-primary)]"
              />
            </div>
            <p className="text-xs text-[var(--lc-text-muted)]">
              The review stays visible while the moderation team checks your report.
            </p>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setFlagOpen(false)}>Cancel</Button>
              <Button type="button" onClick={submitFlag} disabled={Boolean(busy)}>
                {busy === 'flag' && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
                Submit flag
              </Button>
            </div>
          </div>
        )}

        {!responseOpen && !flagOpen && (
          <div className="mt-4 flex flex-wrap gap-2 border-t border-[var(--lc-border)] pt-4">
            <Button type="button" size="sm" variant="outline" onClick={() => setResponseOpen(true)}>
              <MessageSquareReply className="me-2 h-4 w-4" />
              {review.response ? 'Edit response' : 'Respond'}
            </Button>
            {review.flag.status !== 'pending' && (
              <Button type="button" size="sm" variant="ghost" onClick={() => setFlagOpen(true)}>
                <Flag className="me-2 h-4 w-4" />
                Flag inappropriate
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export function AgentReviewsPage() {
  const [data, setData] = useState<ManagedAgentReviewsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState<ReviewFilter>('all')
  const [rating, setRating] = useState<'all' | '1' | '2' | '3' | '4' | '5'>('all')

  usePageTitle('Reviews received')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      setData(await api.getMyAgentReviews())
    } catch (loadError) {
      setError(apiErrorMessage(loadError, 'Could not load your reviews.'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const visible = useMemo(() => {
    const reviews = data?.reviews || []
    return reviews.filter((review) => {
      if (rating !== 'all' && Math.round(review.rating) !== Number(rating)) return false
      if (filter === 'unanswered') return !review.response
      if (filter === 'responded') return Boolean(review.response)
      if (filter === 'flagged') return review.flag.status === 'pending'
      return true
    })
  }, [data, filter, rating])

  function handleChanged(updated: ManagedAgentReview, change: 'response' | 'flag') {
    setData((current) => {
      if (!current) return current
      const previous = current.reviews.find((review) => review.id === updated.id)
      return {
        summary: {
          ...current.summary,
          awaiting_response: change === 'response' && previous && !previous.response && updated.response
            ? Math.max(0, current.summary.awaiting_response - 1)
            : current.summary.awaiting_response,
          flagged: change === 'flag' && previous?.flag.status !== 'pending' && updated.flag.status === 'pending'
            ? current.summary.flagged + 1
            : current.summary.flagged,
        },
        reviews: current.reviews.map((review) => review.id === updated.id ? updated : review),
      }
    })
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center" role="status">
        <Loader2 className="h-8 w-8 animate-spin text-[var(--lc-action-primary)]" />
        <span className="sr-only">Loading reviews</span>
      </div>
    )
  }

  if (error && !data) {
    return (
      <main className="mx-auto max-w-xl px-4 py-16 text-center">
        <AlertTriangle className="mx-auto h-10 w-10 text-[var(--lc-status-unpublished-fg)]" />
        <h1 className="mt-4 text-2xl font-semibold text-[var(--lc-text-primary)]">Reviews unavailable</h1>
        <p role="alert" className="mt-2 text-sm text-[var(--lc-text-muted)]">{error}</p>
        <Button onClick={load} className="mt-6">Try again</Button>
      </main>
    )
  }

  if (!data) return null

  return (
    <main className="mx-auto max-w-6xl px-4 py-5 sm:px-6 sm:py-8">
      <header>
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--lc-text-brand)]">AGT-REV-001</p>
        <h1 className="mt-1 text-2xl font-semibold text-[var(--lc-text-primary)] sm:text-3xl">Reviews received</h1>
        <p className="mt-2 max-w-2xl text-sm text-[var(--lc-text-muted)]">
          Respond publicly to client feedback and flag content that may violate review policy.
        </p>
      </header>

      {data.summary.total === 0 ? (
        <Card className="mt-8">
          <CardContent className="px-6 py-14 text-center">
            <Star className="mx-auto h-10 w-10 text-[var(--lc-text-muted)]" />
            <h2 className="mt-4 text-xl font-semibold text-[var(--lc-text-primary)]">No reviews yet</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-[var(--lc-text-muted)]">
              Reviews from clients will appear here after they are published to your public profile.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-label="Review summary">
            <Card>
              <CardContent className="p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--lc-text-muted)]">Average rating</p>
                <div className="mt-2 flex items-baseline gap-2">
                  <Numeric className="text-3xl font-semibold">{data.summary.average.toFixed(1)}</Numeric>
                  <span className="text-sm text-[var(--lc-text-muted)]">/ 5</span>
                </div>
                <Stars rating={Math.round(data.summary.average)} />
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--lc-text-muted)]">Total reviews</p>
                <Numeric className="mt-2 block text-3xl font-semibold">{data.summary.total}</Numeric>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--lc-text-muted)]">Awaiting response</p>
                <Numeric className="mt-2 block text-3xl font-semibold">{data.summary.awaiting_response}</Numeric>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--lc-text-muted)]">Flags pending</p>
                <Numeric className="mt-2 block text-3xl font-semibold">{data.summary.flagged}</Numeric>
              </CardContent>
            </Card>
          </section>

          <div className="mt-6 grid gap-6 lg:grid-cols-[16rem_minmax(0,1fr)]">
            <aside>
              <Card>
                <CardHeader><CardTitle className="text-base">Rating breakdown</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  {[5, 4, 3, 2, 1].map((value) => {
                    const count = data.summary.distribution[value as 1 | 2 | 3 | 4 | 5] || 0
                    const percent = data.summary.total ? (count / data.summary.total) * 100 : 0
                    return (
                      <div key={value} className="grid grid-cols-[2.5rem_1fr_2rem] items-center gap-2 text-sm">
                        <span><Numeric>{value}</Numeric> ★</span>
                        <span className="h-2 overflow-hidden rounded-full bg-[var(--lc-surface-sunken)]">
                          <span
                            className="block h-full rounded-full bg-[var(--lc-status-draft-dot)]"
                            style={{ width: `${percent}%` }}
                          />
                        </span>
                        <Numeric className="text-end text-[var(--lc-text-muted)]">{count}</Numeric>
                      </div>
                    )
                  })}
                </CardContent>
              </Card>
            </aside>

            <section aria-label="Reviews">
              <div className="flex flex-col gap-3 rounded-[var(--lc-radius-md)] border border-[var(--lc-border)] bg-[var(--lc-surface-raised)] p-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-wrap gap-2" role="group" aria-label="Response filter">
                  {([
                    ['all', 'All'],
                    ['unanswered', 'Needs response'],
                    ['responded', 'Responded'],
                    ['flagged', 'Flagged'],
                  ] as const).map(([value, label]) => (
                    <Button
                      key={value}
                      type="button"
                      size="sm"
                      variant={filter === value ? 'default' : 'outline'}
                      onClick={() => setFilter(value)}
                    >
                      {label}
                    </Button>
                  ))}
                </div>
                <Label className="flex items-center gap-2 text-sm">
                  Rating
                  <select
                    value={rating}
                    onChange={(event) => setRating(event.target.value as typeof rating)}
                    className="min-h-tap rounded-[var(--lc-radius-md)] border border-[var(--lc-border-strong)] bg-[var(--lc-surface)] px-3 text-sm"
                  >
                    <option value="all">All</option>
                    {[5, 4, 3, 2, 1].map((value) => (
                      <option key={value} value={value}>{value} stars</option>
                    ))}
                  </select>
                </Label>
              </div>

              {visible.length === 0 ? (
                <div className="mt-4 rounded-[var(--lc-radius-lg)] border border-dashed border-[var(--lc-border-strong)] px-6 py-12 text-center">
                  <CheckCircle2 className="mx-auto h-8 w-8 text-[var(--lc-status-published-fg)]" />
                  <p className="mt-3 font-semibold text-[var(--lc-text-primary)]">No reviews match these filters</p>
                  <p className="mt-1 text-sm text-[var(--lc-text-muted)]">Choose another rating or response status.</p>
                </div>
              ) : (
                <div className="mt-4 space-y-4">
                  {visible.map((review) => (
                    <ReviewCard key={review.id} review={review} onChanged={handleChanged} />
                  ))}
                </div>
              )}
            </section>
          </div>
        </>
      )}
    </main>
  )
}
