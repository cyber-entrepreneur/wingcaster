import { useEffect, useMemo, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { api } from '@/api/client'
import { Button } from '@/components/ui/button'
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

type Scope = 'all_areas' | 'one_area' | 'one_dimension'

type AreaRow = { id: string; name: string; status?: string }
type DimensionRow = {
  id: string
  name: string
  slug: string
  is_active?: boolean
  scoring_logic_config?: { logic?: string } | string
}

function aiDimensionCount(dimensions: DimensionRow[]) {
  return dimensions.filter((row) => {
    const cfg = typeof row.scoring_logic_config === 'string'
      ? JSON.parse(row.scoring_logic_config || '{}')
      : row.scoring_logic_config || {}
    return cfg.logic === 'ai_synthesis'
  }).length
}

export function RecalculateScoresDialog({
  open,
  onOpenChange,
  areas,
  dimensions,
  onStarted,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  areas: AreaRow[]
  dimensions: DimensionRow[]
  onStarted?: () => void
}) {
  const { runElevated } = useStepUp()
  const { addToast } = useToast()
  const [scope, setScope] = useState<Scope>('one_area')
  const [areaId, setAreaId] = useState('')
  const [dimensionId, setDimensionId] = useState('')
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
    setScope('one_area')
    setAreaId(scoringAreas[0]?.id || '')
    setDimensionId(activeDimensions[0]?.id || '')
  }, [open, scoringAreas, activeDimensions])

  const costPreview = useMemo(() => {
    const aiUnits = aiDimensionCount(activeDimensions)
    const areaCount = scope === 'all_areas'
      ? scoringAreas.length
      : 1
    const dimensionCount = scope === 'one_dimension' ? 1 : activeDimensions.length
    return {
      areaCount,
      dimensionCount,
      aiUnits: aiUnits * areaCount * (scope === 'one_dimension' ? 1 : 1),
    }
  }, [scope, scoringAreas.length, activeDimensions, activeDimensions.length])

  async function submit() {
    setSubmitting(true)
    setError(null)
    try {
      const body: Record<string, string> = { scope }
      if (scope !== 'all_areas') {
        if (!areaId) {
          setError('Select an area.')
          return
        }
        body.area_id = areaId
      }
      if (scope === 'one_dimension') {
        if (!dimensionId) {
          setError('Select a dimension.')
          return
        }
        body.dimension_id = dimensionId
      }

      const result = await runElevated(
        () => api.recalculateAdminScores(body),
        'recalculate area scores',
      )
      if (!result) return

      addToast({
        title: 'Score recalculation started',
        description: `Calculated ${String((result as Record<string, unknown>).calculated ?? 0)} dimension scores.`,
      })
      onStarted?.()
      onOpenChange(false)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not start recalculation.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg" data-screen="PA-SCR-003">
        <DialogHeader>
          <DialogTitle>Recalculate scores</DialogTitle>
        </DialogHeader>

        <fieldset className="space-y-3">
          <legend className="text-sm font-medium">Scope</legend>
          {([
            ['all_areas', 'All scoring-enabled areas'],
            ['one_area', 'One area'],
            ['one_dimension', 'One area × one dimension'],
          ] as const).map(([value, label]) => (
            <label key={value} className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="recalc-scope"
                value={value}
                checked={scope === value}
                onChange={() => setScope(value)}
              />
              {label}
            </label>
          ))}
        </fieldset>

        {scope !== 'all_areas' ? (
          <div className="space-y-2">
            <Label htmlFor="recalc-area">Area</Label>
            <select
              id="recalc-area"
              className="w-full rounded-md border px-3 py-2 text-sm"
              value={areaId}
              onChange={(event) => setAreaId(event.target.value)}
            >
              {scoringAreas.map((row) => (
                <option key={row.id} value={row.id}>{row.name}</option>
              ))}
            </select>
          </div>
        ) : null}

        {scope === 'one_dimension' ? (
          <div className="space-y-2">
            <Label htmlFor="recalc-dimension">Dimension</Label>
            <select
              id="recalc-dimension"
              className="w-full rounded-md border px-3 py-2 text-sm"
              value={dimensionId}
              onChange={(event) => setDimensionId(event.target.value)}
            >
              {activeDimensions.map((row) => (
                <option key={row.id} value={row.id}>{row.name}</option>
              ))}
            </select>
          </div>
        ) : null}

        <p className="rounded-[var(--lc-radius-md)] bg-[var(--lc-surface-sunken)] px-3 py-2 text-sm text-muted-foreground">
          Cost preview: <Numeric>{costPreview.areaCount}</Numeric> area
          {costPreview.areaCount === 1 ? '' : 's'} ×{' '}
          <Numeric>{costPreview.dimensionCount}</Numeric> dimension
          {costPreview.dimensionCount === 1 ? '' : 's'}
          {costPreview.aiUnits > 0 ? (
            <> · est. <Numeric>{costPreview.aiUnits}</Numeric> AI synthesis calls</>
          ) : null}
        </p>

        {error ? <p className="text-sm text-red-600" role="alert">{error}</p> : null}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={submitting || (scope !== 'all_areas' && !scoringAreas.length)}
            onClick={() => { void submit() }}
          >
            {submitting ? (
              <>
                <Loader2 className="me-2 h-4 w-4 animate-spin" aria-hidden />
                Starting…
              </>
            ) : (
              'Start recalculation'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
