import { useMemo, useState } from 'react'
import { CalendarClock, Loader2, X } from 'lucide-react'
import { api, type ScheduledPublication } from '@/api/client'
import { useToast } from '@/components/ui/toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface SchedulePublishDialogProps {
  propertyId: string
  /** Portal payload the agent selected on the publish step. */
  portals: Array<string | { code: string; country_code?: string }>
  message?: string
  onClose: () => void
  onScheduled: (row: ScheduledPublication) => void
}

/**
 * AGT-PUB-007 — Schedule publish (later).
 *
 * A sub-step of the publish flow: instead of submitting now, the agent picks
 * a future date + time (in their own timezone) and optionally a weekly
 * repeat. The worker fires it via the same publishing engine when due.
 */
export function SchedulePublishDialog({
  propertyId,
  portals,
  message,
  onClose,
  onScheduled,
}: SchedulePublishDialogProps) {
  const { addToast } = useToast()
  const tz = useMemo(() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone
    } catch {
      return 'UTC'
    }
  }, [])
  // Default to one hour from now, rounded, in local wall-clock for the input.
  const defaultLocal = useMemo(() => {
    const d = new Date(Date.now() + 60 * 60 * 1000)
    d.setSeconds(0, 0)
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  }, [])

  const [when, setWhen] = useState(defaultLocal)
  const [recurrence, setRecurrence] = useState<'none' | 'weekly'>('none')
  const [busy, setBusy] = useState(false)

  const parsed = when ? new Date(when) : null
  const isFuture = parsed != null && !Number.isNaN(parsed.getTime()) && parsed.getTime() > Date.now()

  const submit = async () => {
    if (!isFuture || busy) return
    setBusy(true)
    try {
      const row = await api.createScheduledPublication(propertyId, {
        portals,
        message: message?.trim() || null,
        scheduled_at: parsed!.toISOString(),
        timezone: tz,
        recurrence,
      })
      addToast({
        title: 'Publish scheduled',
        description: `${portals.length} channel${portals.length === 1 ? '' : 's'} · ${parsed!.toLocaleString()}`,
        variant: 'success',
      })
      onScheduled(row)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not schedule'
      addToast({ title: 'Could not schedule', description: msg, variant: 'error' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-overlay flex items-center justify-center lc-overlay p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Schedule publish"
        data-screen="AGT-PUB-007"
        className="flex w-full max-w-md flex-col rounded-lg bg-[var(--lc-surface)] shadow-xl"
      >
        <div className="flex items-start justify-between border-b p-4">
          <div className="flex items-center gap-2">
            <CalendarClock className="h-5 w-5 text-[var(--lc-action-primary)]" />
            <h2 className="text-lg font-semibold">Schedule for later</h2>
          </div>
          <button type="button" onClick={onClose} className="rounded-full p-1 hover:bg-muted" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3 p-4">
          <label className="block">
            <Label className="text-xs">Date &amp; time</Label>
            <Input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
            <p className="mt-1 text-xs text-[var(--lc-text-muted)]">Your timezone: {tz}</p>
          </label>
          {!isFuture && when ? (
            <p className="rounded-md border border-[var(--lc-border)] bg-[var(--lc-surface-sunken)] px-3 py-2 text-xs text-[var(--lc-status-danger-fg)]">
              Pick a time in the future.
            </p>
          ) : null}
          <label className="block">
            <Label className="text-xs">Repeat</Label>
            <select
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={recurrence}
              onChange={(e) => setRecurrence(e.target.value as 'none' | 'weekly')}
            >
              <option value="none">Once</option>
              <option value="weekly">Weekly (re-post to keep it fresh)</option>
            </select>
          </label>
          <p className="text-xs text-[var(--lc-text-muted)]">
            Publishing to {portals.length} channel{portals.length === 1 ? '' : 's'}. It appears as “Scheduled”
            until it fires.
          </p>
        </div>

        <div className="flex justify-end gap-2 border-t p-4">
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={() => void submit()} disabled={!isFuture || busy}>
            {busy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
            Schedule
          </Button>
        </div>
      </div>
    </div>
  )
}
