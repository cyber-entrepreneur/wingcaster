/**
 * AGN-SET-006 — Delete agency (owner-only, 30-day cool-down).
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, ArrowLeft, Loader2, RefreshCw, ShieldCheck } from 'lucide-react'
import { api, type AgencyDeletionStateResponse } from '@/api/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Numeric } from '@/components/ui/numeric'
import { useStepUp } from '@/components/mfa'
import { useAuth } from '@/context/AuthContext'
import { useLocale } from '@/hooks/useLocale'
import { formatLongDate } from '@/lib/relative-time'
import { usePageTitle } from '@/lib/usePageTitle'
import { useToast } from '@/components/ui/toast'

type LoadState = 'loading' | 'ready' | 'error' | 'forbidden' | 'scheduled'

const REASONS = [
  { value: 'business_closed', label: 'Business closed' },
  { value: 'merger', label: 'Merged into another agency' },
  { value: 'switching_platform', label: 'Switching platforms' },
  { value: 'other', label: 'Other' },
]

export function AgencyDeleteAgencyPage() {
  const { agent, loading: authLoading } = useAuth()
  const { addToast } = useToast()
  const { dir } = useLocale()
  const { requireStepUp } = useStepUp({ reason: 'Delete agency' })
  usePageTitle('Delete agency')

  const affiliation = (agent?.affiliation as { agency_id?: string; role?: string } | undefined) || undefined
  const agencyId = affiliation?.agency_id
  const isOwner = affiliation?.role === 'owner'

  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [state, setState] = useState<AgencyDeletionStateResponse | null>(null)
  const [word, setWord] = useState('')
  const [typed, setTyped] = useState('')
  const [typedAgencyName, setTypedAgencyName] = useState('')
  const [reason, setReason] = useState('')
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    if (!agencyId || !isOwner) {
      setLoadState('forbidden')
      return
    }
    setLoadState('loading')
    try {
      const response = await api.getAgencyDeletionState(agencyId)
      setState(response)
      setLoadState(response.deletion ? 'scheduled' : 'ready')
    } catch (err) {
      const status = (err as { status?: number }).status
      if (status === 401 || status === 403) {
        setLoadState('forbidden')
        return
      }
      setLoadState('error')
    }
  }, [agencyId, isOwner])

  useEffect(() => {
    if (authLoading) return
    void load()
  }, [authLoading, load])

  const regenerateWord = useCallback(async () => {
    if (!agencyId) return
    setBusy(true)
    try {
      const res = await api.regenerateAgencyDeletionWord(agencyId)
      setWord(res.word)
      setTyped('')
    } catch (err) {
      addToast({
        title: 'Could not generate confirmation word',
        description: (err as Error).message,
        variant: 'error',
      })
    } finally {
      setBusy(false)
    }
  }, [addToast, agencyId])

  const scheduleDeletion = useCallback(async () => {
    if (!agencyId || !state) return
    setBusy(true)
    try {
      await requireStepUp({ reason: 'Delete agency' })
      const result = await api.initiateAgencyDeletion(agencyId, {
        word: typed,
        typed_agency_name: typedAgencyName,
        reason,
        notes,
      })
      setState({
        ...state,
        deletion: {
          id: result.id,
          status: result.status,
          scheduled_for: result.scheduled_for,
          reason,
        },
        can_schedule: false,
      })
      setLoadState('scheduled')
      addToast({ title: 'Agency deletion scheduled', variant: 'success' })
    } catch (err) {
      addToast({
        title: 'Could not schedule deletion',
        description: (err as Error).message,
        variant: 'error',
      })
    } finally {
      setBusy(false)
    }
  }, [addToast, agencyId, notes, reason, requireStepUp, state, typed, typedAgencyName])

  const cancelDeletion = useCallback(async () => {
    if (!agencyId) return
    setBusy(true)
    try {
      await api.cancelAgencyDeletion(agencyId)
      addToast({ title: 'Agency deletion cancelled', variant: 'success' })
      await load()
    } catch (err) {
      addToast({
        title: 'Could not cancel deletion',
        description: (err as Error).message,
        variant: 'error',
      })
    } finally {
      setBusy(false)
    }
  }, [addToast, agencyId, load])

  const scheduledLabel = useMemo(
    () => (state?.deletion?.scheduled_for ? formatLongDate(state.deletion.scheduled_for) : ''),
    [state?.deletion?.scheduled_for],
  )

  const wordMatches = typed.toLowerCase() === word.toLowerCase()
  const nameMatches = typedAgencyName.trim().toLowerCase() === (state?.agency.name || '').trim().toLowerCase()
  const canSubmit = Boolean(word) && wordMatches && nameMatches && reason.length >= 3

  if (authLoading || loadState === 'loading') {
    return (
      <div className="flex min-h-[50vh] items-center justify-center" data-screen="AGN-SET-006">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" aria-hidden="true" />
        <span className="sr-only">Loading delete agency settings</span>
      </div>
    )
  }

  if (loadState === 'forbidden') {
    return (
      <div className="mx-auto max-w-3xl px-[var(--lc-space-xl)] py-[var(--lc-space-2xl)]" data-screen="AGN-SET-006" dir={dir}>
        <h1 className="text-2xl font-bold">Delete agency</h1>
        <p className="mt-2 text-muted-foreground">Only the agency owner can schedule agency deletion.</p>
        <Button asChild className="mt-4">
          <Link to="/agency">Back to agency dashboard</Link>
        </Button>
      </div>
    )
  }

  if (loadState === 'error' || !state) {
    return (
      <div className="mx-auto max-w-3xl px-[var(--lc-space-xl)] py-[var(--lc-space-2xl)]" data-screen="AGN-SET-006" dir={dir}>
        <h1 className="text-2xl font-bold">Delete agency</h1>
        <p className="mt-2 text-muted-foreground">Deletion settings could not be loaded.</p>
        <Button className="mt-4" onClick={() => void load()}>Try again</Button>
      </div>
    )
  }

  return (
    <div className="min-h-full bg-[var(--lc-bg-page)]" data-screen="AGN-SET-006" dir={dir}>
      <div className="mx-auto max-w-3xl px-[var(--lc-space-2xl)] py-[var(--lc-space-xl)]">
        <Button asChild variant="ghost" size="sm" className="mb-4 -ms-2 gap-2">
          <Link to="/agency/settings/security">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Back to security settings
          </Link>
        </Button>

        <header className="mb-[var(--lc-space-lg)]">
          <h1 style={{ font: 'var(--lc-type-heading-1)' }} className="text-[var(--lc-text-heading)]">
            Delete agency
          </h1>
          <p style={{ font: 'var(--lc-type-body-sm)' }} className="mt-1 text-[var(--lc-text-muted)]">
            Schedule permanent deletion for {state.agency.name} after a 30-day cool-down.
          </p>
        </header>

        {(state.blocks.active_members || state.blocks.past_due) && (
          <Card className="mb-[var(--lc-space-lg)] border-amber-200 bg-amber-50">
            <CardContent className="flex gap-3 py-6 text-amber-900">
              <AlertTriangle className="h-5 w-5 shrink-0" aria-hidden="true" />
              <div>
                {state.blocks.active_members && (
                  <p>Offboard all members before scheduling deletion.</p>
                )}
                {state.blocks.past_due && (
                  <p>Settle outstanding invoices before scheduling deletion.</p>
                )}
                <Button asChild variant="outline" size="sm" className="mt-3">
                  <Link to="/agency">Review members</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="mb-[var(--lc-space-lg)]">
          <CardHeader>
            <CardTitle>Impact summary</CardTitle>
            <CardDescription>What happens when the cool-down ends.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <p><Numeric>{state.impact.active_members}</Numeric> active members will be unassigned</p>
            <p><Numeric>{state.impact.listings_count}</Numeric> listings will be archived</p>
            <p><Numeric>{state.impact.credits_balance_usd}</Numeric> USD in credits will be forfeited</p>
            <p>Invoices and audit records are retained for compliance</p>
          </CardContent>
        </Card>

        {loadState === 'scheduled' && state.deletion ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-[var(--lc-status-success-fg)]" aria-hidden="true" />
                Deletion scheduled
              </CardTitle>
              <CardDescription>
                This agency will be deleted on {scheduledLabel}. You can cancel any time before then.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" onClick={() => void cancelDeletion()} disabled={busy}>
                Cancel scheduled deletion
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Confirm deletion</CardTitle>
              <CardDescription>Three-factor confirmation: liveness word, typed agency name, and step-up.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="outline" className="gap-2" onClick={() => void regenerateWord()} disabled={busy || !state.can_schedule}>
                  <RefreshCw className="h-4 w-4" aria-hidden="true" />
                  {word ? 'New confirmation word' : 'Generate confirmation word'}
                </Button>
                {word ? <code className="rounded bg-[var(--lc-surface-sunken)] px-2 py-1 text-sm">{word}</code> : null}
              </div>

              <div>
                <Label htmlFor="delete-word">Type the confirmation word</Label>
                <Input id="delete-word" value={typed} onChange={(e) => setTyped(e.target.value)} disabled={!word} />
              </div>

              <div>
                <Label htmlFor="delete-agency-name">Type the agency name exactly</Label>
                <Input
                  id="delete-agency-name"
                  value={typedAgencyName}
                  onChange={(e) => setTypedAgencyName(e.target.value)}
                  placeholder={state.agency.name}
                />
              </div>

              <div>
                <Label htmlFor="delete-reason">Reason</Label>
                <select
                  id="delete-reason"
                  className="mt-1 w-full rounded-md border border-[var(--lc-border)] bg-[var(--lc-surface)] px-3 py-2 text-sm"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                >
                  <option value="">Select a reason</option>
                  {REASONS.map((item) => (
                    <option key={item.value} value={item.value}>{item.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <Label htmlFor="delete-notes">Notes (optional)</Label>
                <Input id="delete-notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
              </div>

              <Button
                variant="destructive"
                disabled={!canSubmit || busy || !state.can_schedule}
                onClick={() => void scheduleDeletion()}
              >
                Schedule agency deletion
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
