/**
 * AGT-TSK-002 — Task detail / edit.
 *
 * A modal opened from the tasks list (AGT-TSK-001) to view and edit one task:
 * title, description, due date + time, priority, type, status, and the linked
 * contact; related opportunity / conversation are surfaced as deep links.
 * Primary actions: Save, Complete, Delete. Loading / error / saving states are
 * all handled. Backed by the ownership-gated /api/tasks/:id endpoints.
 */
import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, CheckCircle2, Loader2, MessageSquare, Target, Trash2, User } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/components/ui/toast'
import { api, type TaskPriority, type TaskRecord, type TaskStatus, type TaskType } from '@/api/client'
import { cn } from '@/lib/utils'

interface ContactOption {
  id: string
  name?: string
  email?: string
}

interface TaskDetailDrawerProps {
  taskId: string | null
  onClose: () => void
  /** Called after a successful save / complete / delete so the list can refresh. */
  onChanged: () => void
}

const TYPES: { value: TaskType; label: string }[] = [
  { value: 'follow_up', label: 'Follow-up' },
  { value: 'call', label: 'Call' },
  { value: 'email', label: 'Email' },
  { value: 'viewing', label: 'Viewing' },
  { value: 'meeting', label: 'Meeting' },
]

const PRIORITIES: { value: TaskPriority; label: string }[] = [
  { value: 'low', label: 'Low' },
  { value: 'normal', label: 'Normal' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
]

const STATUSES: { value: TaskStatus; label: string }[] = [
  { value: 'pending', label: 'Pending' },
  { value: 'snoozed', label: 'Snoozed' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
]

const SELECT_CLASS =
  'h-10 w-full rounded-md border border-[var(--lc-border-strong)] bg-[var(--lc-surface)] px-3 text-sm text-[var(--lc-text-primary)]'

/** ISO → value for <input type="datetime-local"> in the viewer's local zone. */
function isoToLocalInput(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function localInputToIso(local: string): string {
  const d = new Date(local)
  return Number.isNaN(d.getTime()) ? '' : d.toISOString()
}

interface DraftForm {
  title: string
  notes: string
  due_at: string
  priority: TaskPriority
  type: TaskType
  status: TaskStatus
  contact_id: string
}

function toDraft(task: TaskRecord): DraftForm {
  return {
    title: task.title,
    notes: task.notes || '',
    due_at: isoToLocalInput(task.due_at),
    priority: task.priority,
    type: task.type,
    status: task.status,
    contact_id: task.contact_id || '',
  }
}

export function TaskDetailDrawer({ taskId, onClose, onChanged }: TaskDetailDrawerProps) {
  const { addToast } = useToast()
  const [task, setTask] = useState<TaskRecord | null>(null)
  const [draft, setDraft] = useState<DraftForm | null>(null)
  const [contacts, setContacts] = useState<ContactOption[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async (id: string) => {
    setLoading(true)
    setError(null)
    try {
      const [t, list] = await Promise.all([api.getTask(id), api.getContacts().catch(() => [])])
      setTask(t)
      setDraft(toDraft(t))
      setContacts(Array.isArray(list) ? (list as ContactOption[]) : [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load task')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (taskId) void load(taskId)
    else {
      setTask(null)
      setDraft(null)
      setError(null)
    }
  }, [taskId, load])

  const update = <K extends keyof DraftForm>(key: K, value: DraftForm[K]) =>
    setDraft((d) => (d ? { ...d, [key]: value } : d))

  const handleSave = async () => {
    if (!task || !draft) return
    if (draft.title.trim().length < 2) {
      addToast({ title: 'Title is too short', variant: 'error' })
      return
    }
    if (!draft.due_at) {
      addToast({ title: 'A due date is required', variant: 'error' })
      return
    }
    setBusy(true)
    try {
      await api.updateTask(task.id, {
        title: draft.title.trim(),
        notes: draft.notes,
        due_at: localInputToIso(draft.due_at),
        priority: draft.priority,
        type: draft.type,
        status: draft.status,
        contact_id: draft.contact_id || null,
      })
      addToast({ title: 'Task saved', variant: 'success' })
      onChanged()
      onClose()
    } catch (e) {
      addToast({ title: 'Save failed', description: e instanceof Error ? e.message : undefined, variant: 'error' })
    } finally {
      setBusy(false)
    }
  }

  const handleComplete = async () => {
    if (!task) return
    setBusy(true)
    try {
      await api.completeTask(task.id)
      addToast({ title: 'Task completed', variant: 'success' })
      onChanged()
      onClose()
    } catch (e) {
      addToast({ title: 'Failed to complete task', description: e instanceof Error ? e.message : undefined, variant: 'error' })
    } finally {
      setBusy(false)
    }
  }

  const handleDelete = async () => {
    if (!task) return
    if (!confirm('Delete this task? This cannot be undone.')) return
    setBusy(true)
    try {
      await api.deleteTask(task.id)
      addToast({ title: 'Task deleted', variant: 'success' })
      onChanged()
      onClose()
    } catch (e) {
      addToast({ title: 'Failed to delete task', description: e instanceof Error ? e.message : undefined, variant: 'error' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={!!taskId} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Task details</DialogTitle>
          <DialogDescription>View and edit this task, then save your changes.</DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center gap-3 py-12 text-center">
            <span className="rounded-xl bg-red-50 p-3 text-red-600">
              <AlertTriangle className="h-6 w-6" />
            </span>
            <p className="text-sm text-muted-foreground">{error}</p>
            {taskId && (
              <Button size="sm" onClick={() => void load(taskId)}>Try again</Button>
            )}
          </div>
        ) : draft && task ? (
          <div className="space-y-4">
            <div>
              <Label htmlFor="task-title">Title</Label>
              <Input id="task-title" value={draft.title} onChange={(e) => update('title', e.target.value)} />
            </div>

            <div>
              <Label htmlFor="task-notes">Description</Label>
              <textarea
                id="task-notes"
                rows={3}
                className={cn(SELECT_CLASS, 'h-auto py-2')}
                value={draft.notes}
                onChange={(e) => update('notes', e.target.value)}
                placeholder="Add context, next steps, or references"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="task-due">Due date &amp; time</Label>
                <Input id="task-due" type="datetime-local" value={draft.due_at} onChange={(e) => update('due_at', e.target.value)} />
              </div>
              <div>
                <Label htmlFor="task-type">Type</Label>
                <select id="task-type" className={SELECT_CLASS} value={draft.type} onChange={(e) => update('type', e.target.value as TaskType)}>
                  {TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="task-priority">Priority</Label>
                <select id="task-priority" className={SELECT_CLASS} value={draft.priority} onChange={(e) => update('priority', e.target.value as TaskPriority)}>
                  {PRIORITIES.map((p) => (
                    <option key={p.value} value={p.value}>{p.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="task-status">Status</Label>
                <select id="task-status" className={SELECT_CLASS} value={draft.status} onChange={(e) => update('status', e.target.value as TaskStatus)}>
                  {STATUSES.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <Label htmlFor="task-contact">Linked contact</Label>
              <select id="task-contact" className={SELECT_CLASS} value={draft.contact_id} onChange={(e) => update('contact_id', e.target.value)}>
                <option value="">No linked contact</option>
                {contacts.map((c) => (
                  <option key={c.id} value={c.id}>{c.name || c.email || c.id}</option>
                ))}
              </select>
              {draft.contact_id && (
                <Link to={`/contacts/${draft.contact_id}`} className="mt-1.5 inline-flex items-center gap-1 text-xs text-[var(--lc-text-brand)] hover:underline">
                  <User className="h-3 w-3" /> Open contact 360
                </Link>
              )}
            </div>

            {/* Read-only related links */}
            {(task.opportunity_id || task.conversation_id) && (
              <div className="flex flex-wrap gap-2 border-t border-[var(--lc-border)] pt-3">
                {task.opportunity_id && (
                  <Link to="/opportunities" className="inline-flex items-center gap-1.5 rounded-md border border-[var(--lc-border)] px-2.5 py-1 text-xs text-muted-foreground hover:bg-[var(--lc-action-secondary)]">
                    <Target className="h-3.5 w-3.5" /> Linked deal
                  </Link>
                )}
                {task.conversation_id && (
                  <Link to={`/dashboard/inbox/${task.conversation_id}`} className="inline-flex items-center gap-1.5 rounded-md border border-[var(--lc-border)] px-2.5 py-1 text-xs text-muted-foreground hover:bg-[var(--lc-action-secondary)]">
                    <MessageSquare className="h-3.5 w-3.5" /> Open conversation
                  </Link>
                )}
              </div>
            )}

            <DialogFooter className="sm:justify-between">
              <Button variant="ghost" onClick={handleDelete} disabled={busy} className="gap-1.5 text-[var(--lc-status-unpublished-fg)] hover:text-[var(--lc-status-unpublished-dot)]">
                <Trash2 className="h-4 w-4" /> Delete
              </Button>
              <div className="flex gap-2">
                {task.status !== 'completed' && (
                  <Button variant="outline" onClick={handleComplete} disabled={busy} className="gap-1.5">
                    <CheckCircle2 className="h-4 w-4" /> Complete
                  </Button>
                )}
                <Button onClick={handleSave} disabled={busy} className="gap-1.5">
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Save
                </Button>
              </div>
            </DialogFooter>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
