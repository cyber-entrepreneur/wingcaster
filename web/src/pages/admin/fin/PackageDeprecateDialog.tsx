import { useState } from 'react'
import { api } from '@/api/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Numeric } from '@/components/ui/numeric'
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'

type VersionRow = Record<string, unknown>

export function PackageDeprecateDialog({
  open,
  packageId,
  version,
  onOpenChange,
  onDeprecated,
}: {
  open: boolean
  packageId: string
  version: VersionRow | null
  onOpenChange: (open: boolean) => void
  onDeprecated: () => void
}) {
  const [reason, setReason] = useState('')
  const [graceNote, setGraceNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const subscribers = Number(version?.subscribers_count ?? 0)
  const versionNo = String(version?.version_number ?? '')

  function reset() {
    setReason('')
    setGraceNote('')
    setError(null)
  }

  async function submit() {
    if (!version?.id || !reason.trim()) {
      setError('A deprecation reason is required.')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const body: Record<string, unknown> = { reason: reason.trim() }
      if (graceNote.trim()) body.grace_period_note = graceNote.trim()
      await api.finPost(`/packages/${packageId}/versions/${String(version.id)}/deprecate`, body)
      reset()
      onOpenChange(false)
      onDeprecated()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Deprecate failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => {
      if (!next) reset()
      onOpenChange(next)
    }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Deprecate package version {versionNo}</DialogTitle>
        </DialogHeader>
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          <p>
            <Numeric>{subscribers}</Numeric>
            {' '}
            active subscription(s) on this version will continue their current billing cycle.
            At renewal they move to the next-highest published version unless pinned to this version.
          </p>
        </div>
        <div className="grid gap-3 text-sm">
          <label className="grid gap-1">
            <span className="text-muted-foreground">Reason (required)</span>
            <Input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Why retire this version?"
            />
          </label>
          <label className="grid gap-1">
            <span className="text-muted-foreground">Grace-period note (optional)</span>
            <Input
              value={graceNote}
              onChange={(e) => setGraceNote(e.target.value)}
              placeholder="Document any customer comms or cutover plan"
            />
          </label>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="destructive" disabled={submitting} onClick={() => { void submit() }}>
            {submitting ? 'Deprecating…' : 'Deprecate version'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
