import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { api } from '@/api/client'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { useToast } from '@/components/ui/toast'
import { Field, FormSelect, FormTextarea } from '@/components/contacts/form-controls'
import type { Option } from '@/components/contacts/contactForm'

const TASK_TYPE_OPTIONS: Option[] = [
  { value: 'meeting', label: 'Meeting' },
  { value: 'call', label: 'Call' },
  { value: 'follow_up', label: 'Follow-up' },
  { value: 'email', label: 'Email' },
  { value: 'viewing', label: 'Viewing' },
]

const PRIORITY_OPTIONS: Option[] = [
  { value: 'low', label: 'Low' },
  { value: 'normal', label: 'Normal' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
]

export type QuickTaskDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  contact: { id: string; name?: string | null } | null
  /** Preselect the task type — e.g. 'meeting' from the "Schedule meeting" action. */
  defaultType?: string
  onCreated?: () => void
}

function defaultDueDate(): string {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return d.toISOString().slice(0, 10)
}

/**
 * Quick task / meeting capture from a contact row. "Meeting" is a task of
 * type `meeting` (a first-class meeting entity is deferred). POSTs /api/tasks
 * with the contact linked.
 */
export function QuickTaskDialog({ open, onOpenChange, contact, defaultType = 'meeting', onCreated }: QuickTaskDialogProps) {
  const { addToast } = useToast()
  const [type, setType] = useState(defaultType)
  const [title, setTitle] = useState('')
  const [date, setDate] = useState(defaultDueDate())
  const [time, setTime] = useState('09:00')
  const [priority, setPriority] = useState('normal')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setType(defaultType)
      setTitle('')
      setDate(defaultDueDate())
      setTime('09:00')
      setPriority('normal')
      setNotes('')
      setSaving(false)
    }
  }, [open, defaultType])

  async function handleSave() {
    if (!contact || title.trim().length < 2) {
      addToast({ title: 'Add a title', description: 'A task needs a short title.', variant: 'error' })
      return
    }
    if (!date) {
      addToast({ title: 'Pick a date', variant: 'error' })
      return
    }
    setSaving(true)
    try {
      const dueAt = new Date(`${date}T${time || '09:00'}:00`).toISOString()
      await api.createTask({
        contact_id: contact.id,
        type,
        title: title.trim(),
        due_at: dueAt,
        priority,
        notes: notes.trim(),
      })
      addToast({ title: type === 'meeting' ? 'Meeting scheduled' : 'Task created', variant: 'success' })
      onOpenChange(false)
      onCreated?.()
    } catch (e: unknown) {
      addToast({
        title: 'Could not create task',
        description: e instanceof Error ? e.message : 'Try again',
        variant: 'error',
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" data-testid="quick-task-dialog">
        <DialogHeader>
          <DialogTitle>{defaultType === 'meeting' ? 'Schedule meeting' : 'Add task'}</DialogTitle>
          <DialogDescription>
            {contact?.name ? `With ${contact.name}` : 'For this contact'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="qt-type" label="Type">
              <FormSelect id="qt-type" options={TASK_TYPE_OPTIONS} value={type} onChange={(e) => setType(e.target.value)} />
            </Field>
            <Field id="qt-priority" label="Priority">
              <FormSelect id="qt-priority" options={PRIORITY_OPTIONS} value={priority} onChange={(e) => setPriority(e.target.value)} />
            </Field>
          </div>
          <Field id="qt-title" label="Title">
            <Input id="qt-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Property viewing at Marina" autoComplete="off" />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="qt-date" label="Date">
              <Input id="qt-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </Field>
            <Field id="qt-time" label="Time">
              <Input id="qt-time" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
            </Field>
          </div>
          <Field id="qt-notes" label="Notes">
            <FormTextarea id="qt-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional context" />
          </Field>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button type="button" onClick={() => void handleSave()} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
