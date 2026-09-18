/**
 * AGT-CTC-004 — Merge contacts modal.
 */
import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, ArrowRight, Loader2, Search } from 'lucide-react'
import { api } from '@/api/client'
import { useToast } from '@/components/ui/toast'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  MERGE_FIELDS,
  buildMergePreview,
  defaultFieldSelections,
  type MergeContactShape,
  type MergeFieldKey,
  type MergeFieldSide,
} from './mergeContacts'

export type MergeContactsDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  sourceContact: MergeContactShape
  /** When set (bulk flow), skip contact search. */
  presetTarget?: MergeContactShape | null
  contacts?: MergeContactShape[]
  onMerged: (merged: MergeContactShape) => void
}

export function MergeContactsDialog({
  open,
  onOpenChange,
  sourceContact,
  presetTarget = null,
  contacts = [],
  onMerged,
}: MergeContactsDialogProps) {
  const { addToast } = useToast()
  const [query, setQuery] = useState('')
  const [target, setTarget] = useState<MergeContactShape | null>(presetTarget)
  const emptyTarget: MergeContactShape = { id: '' }
  const [selections, setSelections] = useState<Record<MergeFieldKey, MergeFieldSide>>(
    defaultFieldSelections(sourceContact, presetTarget || emptyTarget),
  )
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setTarget(presetTarget)
    setQuery('')
    setError(null)
    setSelections(defaultFieldSelections(sourceContact, presetTarget || emptyTarget))
  }, [open, presetTarget, sourceContact])

  useEffect(() => {
    if (target) setSelections(defaultFieldSelections(sourceContact, target))
  }, [target, sourceContact])

  const candidates = useMemo(() => {
    const q = query.trim().toLowerCase()
    return contacts
      .filter((c) => c.id !== sourceContact.id)
      .filter((c) => {
        if (!q) return true
        return (
          (c.name || '').toLowerCase().includes(q) ||
          (c.email || '').toLowerCase().includes(q) ||
          (c.phone || '').toLowerCase().includes(q)
        )
      })
      .slice(0, 8)
  }, [contacts, query, sourceContact.id])

  const preview = target ? buildMergePreview(sourceContact, target, selections) : null

  const setFieldSide = (key: MergeFieldKey, side: MergeFieldSide) => {
    setSelections((prev) => ({ ...prev, [key]: side }))
  }

  const submit = async () => {
    if (!target || busy) return
    setBusy(true)
    setError(null)
    try {
      const merged = await api.mergeContacts(sourceContact.id, {
        target_contact_id: target.id,
        field_selections: selections,
      })
      addToast({ title: 'Contacts merged', description: `${target.name || 'Contact'} merged into ${sourceContact.name || 'contact'}.`, variant: 'success' })
      onMerged(merged as MergeContactShape)
      onOpenChange(false)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Merge failed'
      setError(msg)
      addToast({ title: 'Merge failed', description: msg, variant: 'error' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Merge contacts</DialogTitle>
        </DialogHeader>

        <div
          role="alert"
          className="flex gap-2 rounded-[var(--lc-radius-md)] border border-[var(--lc-status-warning-border)] bg-[var(--lc-status-warning-bg)] p-3 text-sm text-[var(--lc-status-warning-fg)]"
        >
          <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
          <p>Merging is irreversible. The duplicate record will be removed and its activity reassigned.</p>
        </div>

        {!presetTarget && !target && (
          <div className="space-y-3">
            <Label htmlFor="merge-search">Find duplicate to merge into {sourceContact.name || 'this contact'}</Label>
            <div className="relative">
              <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input
                id="merge-search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by name, email, or phone"
                className="ps-9"
              />
            </div>
            <ul className="max-h-48 space-y-1 overflow-y-auto">
              {candidates.length === 0 ? (
                <li className="py-4 text-center text-sm text-[var(--lc-text-muted)]">No matching contacts</li>
              ) : (
                candidates.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      className="flex w-full items-center justify-between rounded-[var(--lc-radius-md)] border border-[var(--lc-border)] px-3 py-2 text-start hover:bg-[var(--lc-surface-raised)]"
                      onClick={() => setTarget(c)}
                    >
                      <span className="font-medium text-[var(--lc-text-primary)]">{c.name || 'Unknown'}</span>
                      <span className="text-xs text-[var(--lc-text-muted)]">{c.email || c.phone || c.id}</span>
                    </button>
                  </li>
                ))
              )}
            </ul>
          </div>
        )}

        {target && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2 text-sm text-[var(--lc-text-muted)]">
              <span className="font-medium text-[var(--lc-text-primary)]">{sourceContact.name || 'Contact A'}</span>
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
              <span>keeps record</span>
              <span className="text-[var(--lc-text-muted)]">·</span>
              <span>{target.name || 'Contact B'} will be removed</span>
              {!presetTarget && (
                <Button type="button" variant="ghost" size="sm" className="ms-auto" onClick={() => setTarget(null)}>
                  Change contact
                </Button>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-[var(--lc-border)] text-[var(--lc-text-muted)]">
                    <th className="py-2 text-start font-medium">Field</th>
                    <th className="py-2 text-start font-medium">Keep from A</th>
                    <th className="py-2 text-start font-medium">Keep from B</th>
                  </tr>
                </thead>
                <tbody>
                  {MERGE_FIELDS.map(({ key, label }) => (
                    <tr key={key} className="border-b border-[var(--lc-border)]">
                      <td className="py-2 pe-2 font-medium text-[var(--lc-text-primary)]">{label}</td>
                      <td className="py-2 pe-2">
                        <label className="flex cursor-pointer items-start gap-2">
                          <input
                            type="radio"
                            name={`merge-${key}`}
                            checked={selections[key] === 'source'}
                            onChange={() => setFieldSide(key, 'source')}
                            className="mt-1 accent-[var(--lc-action-primary)]"
                          />
                          <span className="text-[var(--lc-text-secondary)]">{String(sourceContact[key] || '—')}</span>
                        </label>
                      </td>
                      <td className="py-2">
                        <label className="flex cursor-pointer items-start gap-2">
                          <input
                            type="radio"
                            name={`merge-${key}`}
                            checked={selections[key] === 'target'}
                            onChange={() => setFieldSide(key, 'target')}
                            className="mt-1 accent-[var(--lc-action-primary)]"
                          />
                          <span className="text-[var(--lc-text-secondary)]">{String(target[key] || '—')}</span>
                        </label>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {preview && (
              <div className="rounded-[var(--lc-radius-md)] border border-[var(--lc-border)] bg-[var(--lc-surface-sunken)] p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--lc-text-muted)]">Preview</p>
                <p className="mt-1 font-medium text-[var(--lc-text-primary)]">{preview.name || 'Unknown'}</p>
                <p className="text-sm text-[var(--lc-text-secondary)]">{preview.email || 'No email'} · {preview.phone || 'No phone'}</p>
                <p className="text-sm text-[var(--lc-text-muted)]">Status: {preview.status} · Tags: {(preview.tags || []).join(', ') || 'None'}</p>
              </div>
            )}

            {error && <p className="text-sm text-[var(--lc-status-error-fg)]">{error}</p>}

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
                Cancel
              </Button>
              <Button type="button" onClick={() => void submit()} disabled={busy}>
                {busy ? <Loader2 className="me-2 h-4 w-4 animate-spin" aria-hidden="true" /> : null}
                Merge contacts
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
