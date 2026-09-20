/**
 * PA-INS-002 — Inspection submit form.
 *
 * A field inspector opens one assignment from the queue (PA-INS-001) and files
 * their findings: GPS fix, per-dimension scores, site photos, notes, and a
 * signature. Submit flips the assignment to `completed` and returns to the
 * queue.
 *
 * Field reality: inspectors work in low-signal areas. When the device is
 * offline the submission is saved locally and auto-flushed when connectivity
 * returns — nothing is lost, and the inspector sees exactly what is pending.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  Camera,
  Check,
  CloudOff,
  Eraser,
  Loader2,
  MapPin,
  Send,
  Trash2,
} from 'lucide-react'
import { api } from '@/api/client'
import type {
  InspectionSubmissionInput,
  InspectorAssignmentDetail,
  InspectorDimension,
} from '@/api/client'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Numeric } from '@/components/ui/numeric'
import { useToast } from '@/components/ui/toast'
import { usePageTitle } from '@/lib/usePageTitle'

const QUEUE_KEY = 'wc_inspection_queue'

interface QueuedSubmission {
  assignment_id: string
  payload: InspectionSubmissionInput
  queued_at: string
}

export function readInspectionQueue(): QueuedSubmission[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeInspectionQueue(items: QueuedSubmission[]) {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(items))
  } catch {
    /* storage unavailable — surfaced to the inspector via toast on submit */
  }
}

function upsertQueued(item: QueuedSubmission) {
  const next = readInspectionQueue().filter((q) => q.assignment_id !== item.assignment_id)
  next.push(item)
  writeInspectionQueue(next)
}

function removeQueued(assignmentId: string) {
  writeInspectionQueue(readInspectionQueue().filter((q) => q.assignment_id !== assignmentId))
}

const SCORE_MIN = 0
const SCORE_MAX = 10

export function InspectorSubmitPage() {
  const { id = '' } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { addToast } = useToast()
  usePageTitle('Submit inspection')

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notFound, setNotFound] = useState(false)
  const [detail, setDetail] = useState<InspectorAssignmentDetail | null>(null)

  const [scores, setScores] = useState<Record<string, string>>({})
  const [notes, setNotes] = useState('')
  const [photoUrls, setPhotoUrls] = useState<string[]>([])
  const [uploading, setUploading] = useState(false)
  const [gps, setGps] = useState<{ lat: number; lng: number } | null>(null)
  const [gpsBusy, setGpsBusy] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [signature, setSignature] = useState<string | null>(null)
  const [queuedOffline, setQueuedOffline] = useState(false)

  const loadAssignment = useCallback(async () => {
    if (!id) {
      setLoading(false)
      setNotFound(true)
      return
    }
    setLoading(true)
    setError('')
    setNotFound(false)
    try {
      const data = await api.getInspectorAssignment(id)
      setDetail(data)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load assignment'
      if (/not found|404/i.test(msg)) {
        setNotFound(true)
      } else {
        setError(msg)
      }
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    void loadAssignment()
  }, [loadAssignment])

  useEffect(() => {
    setQueuedOffline(readInspectionQueue().some((q) => q.assignment_id === id))
  }, [id])

  function buildPayload(): InspectionSubmissionInput | null {
    if (!detail) return null
    const dimensionScores: Record<string, number> = {}
    for (const [slug, value] of Object.entries(scores)) {
      if (value === '') continue
      const num = Number(value)
      if (Number.isFinite(num)) dimensionScores[slug] = num
    }
    return {
      assignment_id: detail.assignment.id,
      area_id: detail.assignment.area_id,
      gps_latitude: gps?.lat ?? 0,
      gps_longitude: gps?.lng ?? 0,
      dimension_scores: dimensionScores,
      photo_urls: photoUrls.length ? photoUrls : undefined,
      notes: notes.trim() || undefined,
      signature: signature || undefined,
    }
  }

  const flushQueue = useCallback(async () => {
    const queue = readInspectionQueue()
    if (queue.length === 0) return
    let flushedCurrent = false
    for (const item of queue) {
      try {
        await api.createInspectorSubmission(item.payload)
        removeQueued(item.assignment_id)
        if (item.assignment_id === id) flushedCurrent = true
      } catch {
        // Still offline / server rejected — keep it queued for the next attempt.
      }
    }
    if (flushedCurrent) {
      setQueuedOffline(false)
      addToast({ title: 'Offline inspection submitted', variant: 'success' })
      navigate('/inspector')
    } else {
      setQueuedOffline(readInspectionQueue().some((q) => q.assignment_id === id))
    }
  }, [id, addToast, navigate])

  useEffect(() => {
    function onOnline() {
      void flushQueue()
    }
    window.addEventListener('online', onOnline)
    return () => window.removeEventListener('online', onOnline)
  }, [flushQueue])

  function captureGps() {
    if (!navigator.geolocation) {
      addToast({ title: 'GPS unavailable on this device', variant: 'error' })
      return
    }
    setGpsBusy(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGps({ lat: pos.coords.latitude, lng: pos.coords.longitude })
        setGpsBusy(false)
      },
      () => {
        addToast({ title: 'Could not read GPS', variant: 'error' })
        setGpsBusy(false)
      },
      { enableHighAccuracy: true, timeout: 10000 },
    )
  }

  async function handlePhotos(files: FileList | null) {
    if (!files || files.length === 0) return
    setUploading(true)
    try {
      const result = await api.uploadMedia(Array.from(files))
      const urls = (result.items || []).map((it) => it.url).filter(Boolean)
      setPhotoUrls((prev) => [...prev, ...urls])
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Upload failed'
      addToast({ title: 'Photo upload failed', description: msg, variant: 'error' })
    } finally {
      setUploading(false)
    }
  }

  function removePhoto(url: string) {
    setPhotoUrls((prev) => prev.filter((u) => u !== url))
  }

  async function handleSubmit() {
    if (submitting || !detail) return
    const payload = buildPayload()
    if (!payload) return

    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      upsertQueued({ assignment_id: payload.assignment_id, payload, queued_at: new Date().toISOString() })
      setQueuedOffline(true)
      addToast({
        title: 'Saved offline',
        description: 'This inspection will be submitted automatically when you are back online.',
        variant: 'default',
      })
      navigate('/inspector')
      return
    }

    setSubmitting(true)
    setError('')
    try {
      await api.createInspectorSubmission(payload)
      removeQueued(payload.assignment_id)
      addToast({ title: 'Inspection submitted', variant: 'success' })
      navigate('/inspector')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Submit failed'
      setError(msg)
      addToast({ title: 'Submit failed', description: msg, variant: 'error' })
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16" data-testid="inspection-submit-loading">
        <Loader2 className="h-6 w-6 animate-spin text-[var(--lc-text-muted)]" />
      </div>
    )
  }

  if (notFound) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10 text-center" data-testid="inspection-submit-notfound">
        <p className="text-sm text-[var(--lc-text-muted)]">
          This assignment was not found, or it is not assigned to you.
        </p>
        <Button variant="outline" size="sm" className="mt-4" asChild>
          <Link to="/inspector">
            <ArrowLeft className="me-1 h-4 w-4" />
            Back to queue
          </Link>
        </Button>
      </div>
    )
  }

  if (error) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10" data-testid="inspection-submit-error">
        <div
          role="alert"
          className="rounded-md border border-[var(--lc-status-danger-fg)] bg-[var(--lc-status-danger-bg)] px-3 py-2 text-sm text-[var(--lc-status-danger-fg)]"
        >
          {error}
        </div>
        <Button variant="outline" size="sm" className="mt-4" onClick={() => void loadAssignment()}>
          Try again
        </Button>
      </div>
    )
  }

  const assignment = detail!.assignment
  const area = detail!.area
  const dimensions = detail!.dimensions || []
  const alreadyDone = assignment.status === 'completed'

  return (
    <div className="mx-auto max-w-2xl space-y-4 px-4 py-6" data-testid="inspection-submit-page">
      <div className="flex items-start gap-3">
        <Button variant="outline" size="sm" asChild>
          <Link to="/inspector">
            <ArrowLeft className="me-1 h-4 w-4" />
            Back
          </Link>
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-semibold text-[var(--lc-text-primary)]">Submit inspection</h1>
          <p className="mt-0.5 truncate text-sm text-[var(--lc-text-muted)]">
            {area?.name || assignment.area_id}
          </p>
        </div>
        <Badge variant="outline" className="capitalize">
          {assignment.status.replace('_', ' ')}
        </Badge>
      </div>

      {queuedOffline && (
        <div
          role="status"
          data-testid="inspection-offline-banner"
          className="flex items-center gap-2 rounded-md border border-[var(--lc-status-warning-fg)] bg-[var(--lc-status-warning-bg)] px-3 py-2 text-sm text-[var(--lc-status-warning-fg)]"
        >
          <CloudOff className="h-4 w-4 shrink-0" />
          <span className="flex-1">An inspection for this assignment is saved offline and will send when you reconnect.</span>
          <Button type="button" size="sm" variant="outline" onClick={() => void flushQueue()}>
            Retry now
          </Button>
        </div>
      )}

      {alreadyDone && (
        <div
          role="status"
          className="rounded-md border border-[var(--lc-border)] bg-[var(--lc-surface-sunken)] px-3 py-2 text-sm text-[var(--lc-text-muted)]"
        >
          This assignment is already marked complete. Submitting again files an additional report.
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Assignment</CardTitle>
          <CardDescription>Confirm you are on-site before recording findings.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <dl className="grid grid-cols-2 gap-3">
            <div>
              <dt className="text-xs text-[var(--lc-text-muted)]">Area</dt>
              <dd className="text-[var(--lc-text-primary)]">{area?.name || assignment.area_id}</dd>
            </div>
            <div>
              <dt className="text-xs text-[var(--lc-text-muted)]">Assigned</dt>
              <dd className="text-[var(--lc-text-primary)]">
                {new Date(assignment.assigned_at).toLocaleDateString()}
              </dd>
            </div>
            {assignment.due_at && (
              <div>
                <dt className="text-xs text-[var(--lc-text-muted)]">Due</dt>
                <dd className="text-[var(--lc-text-primary)]">
                  {new Date(assignment.due_at).toLocaleDateString()}
                </dd>
              </div>
            )}
          </dl>

          <div>
            <Label className="text-xs">Location fix</Label>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={captureGps}
                disabled={gpsBusy}
                className="gap-1.5"
                data-testid="inspection-gps-cta"
              >
                {gpsBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <MapPin className="h-4 w-4" />}
                Capture GPS
              </Button>
              {gps && (
                <Numeric className="text-xs text-[var(--lc-text-muted)]">
                  {gps.lat.toFixed(5)}, {gps.lng.toFixed(5)}
                </Numeric>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Dimension scores</CardTitle>
          <CardDescription>
            Rate each dimension from <Numeric>{SCORE_MIN}</Numeric>–<Numeric>{SCORE_MAX}</Numeric>. Leave blank to skip.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {dimensions.length === 0 ? (
            <p className="text-sm text-[var(--lc-text-muted)]" data-testid="inspection-dimensions-empty">
              No active scoring dimensions are configured.
            </p>
          ) : (
            <ul className="space-y-2" data-testid="inspection-dimensions">
              {dimensions.map((dim: InspectorDimension) => (
                <li key={dim.id} className="flex items-center justify-between gap-3">
                  <label htmlFor={`dim-${dim.slug}`} className="min-w-0 flex-1 text-sm text-[var(--lc-text-primary)]">
                    {dim.name}
                    <span className="ms-1 text-xs text-[var(--lc-text-muted)]">({dim.slug})</span>
                  </label>
                  <input
                    id={`dim-${dim.slug}`}
                    type="number"
                    inputMode="numeric"
                    min={SCORE_MIN}
                    max={SCORE_MAX}
                    step={1}
                    value={scores[dim.slug] ?? ''}
                    onChange={(e) => setScores((prev) => ({ ...prev, [dim.slug]: e.target.value }))}
                    className="lc-data w-20 rounded-md border border-[var(--lc-border)] bg-[var(--lc-surface)] px-2 py-1.5 text-end text-sm text-[var(--lc-text-primary)]"
                    aria-label={`Score for ${dim.name}`}
                  />
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Photos</CardTitle>
          <CardDescription>Capture site photos as evidence.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <label
              htmlFor="inspection-photos"
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-[var(--lc-border)] bg-[var(--lc-surface)] px-3 py-1.5 text-sm text-[var(--lc-text-primary)] hover:bg-[var(--lc-surface-sunken)]"
            >
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
              Add photos
            </label>
            <input
              id="inspection-photos"
              type="file"
              accept="image/*"
              capture="environment"
              multiple
              className="sr-only"
              onChange={(e) => void handlePhotos(e.target.files)}
              data-testid="inspection-photo-input"
            />
          </div>
          {photoUrls.length > 0 && (
            <ul className="flex flex-wrap gap-2" data-testid="inspection-photo-list">
              {photoUrls.map((url) => (
                <li key={url} className="relative">
                  <img
                    src={url}
                    alt="Site photo"
                    className="h-20 w-20 rounded-md border border-[var(--lc-border)] object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => removePhoto(url)}
                    aria-label="Remove photo"
                    className="absolute -end-1.5 -top-1.5 rounded-full bg-[var(--lc-status-danger-fg)] p-0.5 text-[var(--lc-surface)]"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Notes &amp; signature</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="inspection-notes" className="text-xs">
              Notes
            </Label>
            <textarea
              id="inspection-notes"
              className="mt-1 min-h-[96px] w-full rounded-md border border-[var(--lc-border)] bg-[var(--lc-surface)] px-3 py-2 text-sm text-[var(--lc-text-primary)]"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Observations, access issues, follow-ups…"
            />
          </div>
          <SignaturePad value={signature} onChange={setSignature} />
        </CardContent>
      </Card>

      {error && (
        <div
          role="alert"
          className="rounded-md border border-[var(--lc-status-danger-fg)] bg-[var(--lc-status-danger-bg)] px-3 py-2 text-sm text-[var(--lc-status-danger-fg)]"
        >
          {error}
        </div>
      )}

      <div className="flex justify-end gap-2 pb-8 pt-2">
        <Button
          type="button"
          onClick={() => void handleSubmit()}
          disabled={submitting || uploading}
          className="gap-2 bg-[var(--lc-action-primary)] text-[var(--lc-action-primary-text)] hover:bg-[var(--lc-action-primary-hover)]"
          data-testid="inspection-submit-cta"
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          Submit inspection
        </Button>
      </div>
    </div>
  )
}

function SignaturePad({
  value,
  onChange,
}: {
  value: string | null
  onChange: (dataUrl: string | null) => void
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const drawing = useRef(false)
  const dirty = useRef(false)

  function pointerPos(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    const rect = canvas.getBoundingClientRect()
    return {
      x: ((e.clientX - rect.left) / rect.width) * canvas.width,
      y: ((e.clientY - rect.top) / rect.height) * canvas.height,
    }
  }

  function start(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    drawing.current = true
    canvas.setPointerCapture(e.pointerId)
    // Resolve the ink color from the element's computed `color` (driven by the
    // `--lc-text-primary` token via className) — the canvas API cannot read a
    // CSS custom property directly, and we keep raw hex out of source.
    const ink = getComputedStyle(canvas).color
    if (ink) ctx.strokeStyle = ink
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    const { x, y } = pointerPos(e)
    ctx.beginPath()
    ctx.moveTo(x, y)
  }

  function move(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return
    const { x, y } = pointerPos(e)
    ctx.lineTo(x, y)
    ctx.stroke()
    dirty.current = true
  }

  function end() {
    if (!drawing.current) return
    drawing.current = false
    const canvas = canvasRef.current
    if (canvas && dirty.current) onChange(canvas.toDataURL('image/png'))
  }

  function clear() {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height)
    dirty.current = false
    onChange(null)
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <Label className="text-xs">Inspector signature</Label>
        <Button type="button" size="sm" variant="ghost" onClick={clear} className="h-7 gap-1 text-xs">
          <Eraser className="h-3.5 w-3.5" />
          Clear
        </Button>
      </div>
      <canvas
        ref={canvasRef}
        width={480}
        height={140}
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerLeave={end}
        data-testid="inspection-signature"
        className="mt-1 h-[140px] w-full touch-none rounded-md border border-[var(--lc-border)] bg-[var(--lc-surface)] text-[var(--lc-text-primary)]"
      />
      {value && (
        <p className="mt-1 flex items-center gap-1 text-xs text-[var(--lc-text-muted)]">
          <Check className="h-3.5 w-3.5" />
          Signature captured
        </p>
      )}
    </div>
  )
}

export default InspectorSubmitPage
