import { useEffect, useMemo, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { api } from '@/api/client'
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
import { useStepUp } from '@/context/StepUpContext'
import { useToast } from '@/components/ui/toast'

type AreaRow = { id: string; name: string; status?: string; slug?: string }
type DimensionRow = { id: string; name: string; slug: string; is_active?: boolean }
type ScoreRow = {
  dimension_id: string
  score_value?: number | string | null
  is_manual_override?: boolean
}

export function ManualScoreOverrideDialog({
  open,
  onOpenChange,
  areas,
  dimensions,
  initialAreaId,
  initialDimensionId,
  onSubmitted,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  areas: AreaRow[]
  dimensions: DimensionRow[]
  initialAreaId?: string
  initialDimensionId?: string
  onSubmitted?: () => void
}) {
  const { runElevated } = useStepUp()
  const { addToast } = useToast()
  const [areaId, setAreaId] = useState('')
  const [dimensionId, setDimensionId] = useState('')
  const [newScore, setNewScore] = useState('')
  const [reason, setReason] = useState('')
  const [evidence, setEvidence] = useState('')
  const [currentScore, setCurrentScore] = useState<number | null>(null)
  const [loadingScores, setLoadingScores] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const scoringAreas = useMemo(
    () => areas.filter((row) => row.status === 'scoring_enabled'),
    [areas],
  )
  const activeDimensions = useMemo(
    () => dimensions.filter((row) => row.is_active !== false),
    [dimensions],
  )

  useEffect(() => {
    if (!open) return
    setError(null)
    setSubmitting(false)
    setNewScore('')
    setReason('')
    setEvidence('')
    const preferredArea = initialAreaId && scoringAreas.some((row) => row.id === initialAreaId)
      ? initialAreaId
      : scoringAreas[0]?.id || ''
    setAreaId(preferredArea)
    const preferredDimension = initialDimensionId && activeDimensions.some((row) => row.id === initialDimensionId)
      ? initialDimensionId
      : activeDimensions[0]?.id || ''
    setDimensionId(preferredDimension)
  }, [open, scoringAreas, activeDimensions, initialAreaId, initialDimensionId])

  useEffect(() => {
    if (!open || !areaId || !dimensionId) {
      setCurrentScore(null)
      return
    }
    setLoadingScores(true)
    void api.getAdminAreaCurrentScores(areaId)
      .then((body) => {
        const scores = (body.scores || []) as ScoreRow[]
        const match = scores.find((row) => row.dimension_id === dimensionId)
        const value = match?.score_value
        setCurrentScore(value == null || value === '' ? null : Number(value))
      })
      .catch(() => setCurrentScore(null))
      .finally(() => setLoadingScores(false))
  }, [open, areaId, dimensionId])

  async function submit() {
    if (!areaId || !dimensionId || !reason.trim() || newScore.trim() === '') {
      setError('Area, dimension, new score, and reason are required.')
      return
    }
    const score = Number(newScore)
    if (!Number.isFinite(score) || score < 0 || score > 100) {
      setError('Score must be between 0 and 100.')
      return
    }

    setSubmitting(true)
    setError(null)
    try {
      const payload: Record<string, unknown> = {
        area_id: areaId,
        dimension_id: dimensionId,
        score,
        reason: reason.trim(),
      }
      if (evidence.trim()) {
        payload.evidence = { note: evidence.trim() }
        payload.rationale = evidence.trim()
      }

      const result = await runElevated(
        () => api.overrideAdminScore(payload),
        'override area score',
      )
      if (!result) return

      addToast({
        title: 'Score override recorded',
        description: 'Manual override is audited and visible on the public area profile.',
      })
      onSubmitted?.()
      onOpenChange(false)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not record override.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg" data-screen="PA-SCR-004">
        <DialogHeader>
          <DialogTitle>Manual score override</DialogTitle>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="override-area">Area</Label>
          <select
            id="override-area"
            className="w-full rounded-md border px-3 py-2 text-sm"
            value={areaId}
            onChange={(event) => setAreaId(event.target.value)}
          >
            {scoringAreas.map((row) => (
              <option key={row.id} value={row.id}>{row.name}</option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="override-dimension">Dimension</Label>
          <select
            id="override-dimension"
            className="w-full rounded-md border px-3 py-2 text-sm"
            value={dimensionId}
            onChange={(event) => setDimensionId(event.target.value)}
          >
            {activeDimensions.map((row) => (
              <option key={row.id} value={row.id}>{row.name}</option>
            ))}
          </select>
        </div>

        <div className="rounded-[var(--lc-radius-md)] bg-[var(--lc-surface-sunken)] px-3 py-2 text-sm">
          <span className="text-muted-foreground">Current score:</span>{' '}
          {loadingScores ? (
            'Loading…'
          ) : currentScore == null ? (
            '—'
          ) : (
            <Numeric>{currentScore}</Numeric>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="override-score">New score (0–100)</Label>
          <Input
            id="override-score"
            inputMode="decimal"
            value={newScore}
            onChange={(event) => setNewScore(event.target.value)}
            placeholder="72.5"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="override-reason">Reason</Label>
          <Input
            id="override-reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Why this override is warranted"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="override-evidence">Evidence notes</Label>
          <Input
            id="override-evidence"
            value={evidence}
            onChange={(event) => setEvidence(event.target.value)}
            placeholder="Inspection reference or supporting notes"
          />
        </div>

        {error ? <p className="text-sm text-red-600" role="alert">{error}</p> : null}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={submitting || !scoringAreas.length || !activeDimensions.length}
            onClick={() => { void submit() }}
          >
            {submitting ? (
              <>
                <Loader2 className="me-2 h-4 w-4 animate-spin" aria-hidden />
                Submitting…
              </>
            ) : (
              'Submit override'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
