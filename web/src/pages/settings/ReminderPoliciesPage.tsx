/**
 * AGT-TSK-003 — Reminder policies.
 * Route: /settings/reminders
 */
import { useCallback, useEffect, useState } from 'react'
import { Bell, Loader2, Pencil, Plus, Trash2 } from 'lucide-react'
import { api } from '@/api/client'
import { SettingsPaneHeader } from '@/components/settings'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/components/ui/toast'
import { usePageTitle } from '@/lib/usePageTitle'
export type ReminderPolicyRule = {
  offset_minutes: number
  channels: Array<'email' | 'whatsapp' | 'inapp'>
  message_template?: string
  active?: boolean
}

export type ReminderPolicy = {
  id: string
  name: string
  owner_type: 'agent' | 'agency'
  owner_id: string
  appointment_type: 'viewing' | 'call' | 'booking' | 'meeting'
  rules: ReminderPolicyRule[]
  is_default?: boolean
  created_at?: string
  updated_at?: string
}

const APPOINTMENT_TYPES: Array<{ value: ReminderPolicy['appointment_type']; label: string }> = [
  { value: 'viewing', label: 'Viewing' },
  { value: 'call', label: 'Call' },
  { value: 'booking', label: 'Booking' },
  { value: 'meeting', label: 'Meeting' },
]

const CHANNELS: Array<{ value: ReminderPolicyRule['channels'][number]; label: string }> = [
  { value: 'inapp', label: 'In-app' },
  { value: 'email', label: 'Email' },
  { value: 'whatsapp', label: 'WhatsApp' },
]

function formatOffset(minutes: number): string {
  if (minutes === 0) return 'At event time'
  if (minutes % 1440 === 0) return `${minutes / 1440} day(s) before`
  if (minutes % 60 === 0) return `${minutes / 60} hour(s) before`
  return `${minutes} min before`
}

function emptyRule(): ReminderPolicyRule {
  return { offset_minutes: 60, channels: ['inapp'], message_template: '', active: true }
}

export function ReminderPoliciesPage() {
  const { addToast } = useToast()
  usePageTitle('Reminder policies')

  const [policies, setPolicies] = useState<ReminderPolicy[]>([])
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [editorOpen, setEditorOpen] = useState(false)
  const [editing, setEditing] = useState<ReminderPolicy | null>(null)
  const [name, setName] = useState('')
  const [appointmentType, setAppointmentType] = useState<ReminderPolicy['appointment_type']>('viewing')
  const [rules, setRules] = useState<ReminderPolicyRule[]>([emptyRule()])
  const [saving, setSaving] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoadState('loading')
    try {
      const rows = await api.getReminderPolicies({ owner_type: 'agent' }) as ReminderPolicy[]
      setPolicies(Array.isArray(rows) ? rows : [])
      setLoadState('ready')
    } catch (err) {
      addToast({
        variant: 'error',
        title: 'Could not load reminder policies',
        description: err instanceof Error ? err.message : undefined,
      })
      setLoadState('error')
    }
  }, [addToast])

  useEffect(() => {
    void load()
  }, [load])

  function openCreate() {
    setEditing(null)
    setName('')
    setAppointmentType('viewing')
    setRules([emptyRule()])
    setEditorOpen(true)
  }

  function openEdit(policy: ReminderPolicy) {
    setEditing(policy)
    setName(policy.name)
    setAppointmentType(policy.appointment_type)
    setRules(policy.rules.length ? policy.rules.map((r) => ({ ...r })) : [emptyRule()])
    setEditorOpen(true)
  }

  function updateRule(index: number, patch: Partial<ReminderPolicyRule>) {
    setRules((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)))
  }

  function toggleChannel(index: number, channel: ReminderPolicyRule['channels'][number]) {
    setRules((prev) => prev.map((r, i) => {
      if (i !== index) return r
      const has = r.channels.includes(channel)
      const channels = has ? r.channels.filter((c) => c !== channel) : [...r.channels, channel]
      return { ...r, channels }
    }))
  }

  async function savePolicy() {
    if (!name.trim() || saving) return
    if (rules.some((r) => !r.channels.length)) {
      addToast({ variant: 'error', title: 'Each rule needs at least one channel' })
      return
    }
    setSaving(true)
    try {
      const payload = {
        name: name.trim(),
        owner_type: 'agent' as const,
        appointment_type: appointmentType,
        rules: rules.map((r) => ({
          offset_minutes: Number(r.offset_minutes) || 0,
          channels: r.channels,
          message_template: r.message_template?.trim() || '',
          active: r.active !== false,
        })),
      }
      if (editing) {
        await api.updateReminderPolicy(editing.id, payload)
        addToast({ title: 'Policy updated', variant: 'success' })
      } else {
        await api.createReminderPolicy(payload)
        addToast({ title: 'Policy created', variant: 'success' })
      }
      setEditorOpen(false)
      await load()
    } catch (err) {
      addToast({
        variant: 'error',
        title: 'Could not save policy',
        description: err instanceof Error ? err.message : undefined,
      })
    } finally {
      setSaving(false)
    }
  }

  async function removePolicy(id: string) {
    setBusyId(id)
    try {
      await api.deleteReminderPolicy(id)
      addToast({ title: 'Policy deleted', variant: 'success' })
      await load()
    } catch (err) {
      addToast({
        variant: 'error',
        title: 'Could not delete policy',
        description: err instanceof Error ? err.message : undefined,
      })
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <SettingsPaneHeader
        title="Reminder policies"
        sub="Automated follow-ups before viewings, calls, and meetings. Pro agents can customize timing and channels."
      />

      <div className="mb-4 flex justify-end">
        <Button type="button" onClick={openCreate} className="inline-flex items-center gap-2">
          <Plus className="h-4 w-4" aria-hidden="true" />
          Add policy
        </Button>
      </div>

      {loadState === 'loading' && (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-[var(--lc-text-muted)]" aria-label="Loading policies" />
        </div>
      )}

      {loadState === 'error' && (
        <Card className="border-[var(--lc-border)] bg-[var(--lc-surface)]">
          <CardContent className="space-y-3 pt-6">
            <p className="text-[var(--lc-text-primary)]">Could not load your reminder policies.</p>
            <Button type="button" onClick={() => void load()}>Try again</Button>
          </CardContent>
        </Card>
      )}

      {loadState === 'ready' && policies.length === 0 && (
        <Card className="border-[var(--lc-border)] bg-[var(--lc-surface)]">
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <Bell className="h-10 w-10 text-[var(--lc-text-muted)]" aria-hidden="true" />
            <p className="text-[var(--lc-text-primary)]">No reminder policies yet</p>
            <p className="max-w-md text-sm text-[var(--lc-text-muted)]">
              Create a policy to send automatic reminders before scheduled viewings or calls.
            </p>
            <Button type="button" onClick={openCreate}>Create your first policy</Button>
          </CardContent>
        </Card>
      )}

      {loadState === 'ready' && policies.length > 0 && (
        <ul className="space-y-3">
          {policies.map((policy) => (
            <li key={policy.id}>
              <Card className="border-[var(--lc-border)] bg-[var(--lc-surface)]">
                <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="font-medium text-[var(--lc-text-heading)]">{policy.name}</p>
                    <p className="mt-1 text-sm capitalize text-[var(--lc-text-muted)]">{policy.appointment_type}</p>
                    <ul className="mt-2 space-y-1 text-sm text-[var(--lc-text-secondary)]">
                      {policy.rules.map((rule, idx) => (
                        <li key={`${policy.id}-${idx}`}>
                          {formatOffset(rule.offset_minutes)} · {rule.channels.join(', ')}
                          {rule.active === false ? ' · paused' : ''}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Button type="button" size="sm" variant="outline" onClick={() => openEdit(policy)}>
                      <Pencil className="h-4 w-4" aria-hidden="true" />
                      <span className="ms-1">Edit</span>
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={busyId === policy.id}
                      onClick={() => void removePolicy(policy.id)}
                    >
                      {busyId === policy.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                      <span className="ms-1">Delete</span>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit reminder policy' : 'New reminder policy'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="policy-name">Name</Label>
              <Input id="policy-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Viewing follow-up" />
            </div>
            <div>
              <Label htmlFor="policy-type">Appointment type</Label>
              <select
                id="policy-type"
                value={appointmentType}
                onChange={(e) => setAppointmentType(e.target.value as ReminderPolicy['appointment_type'])}
                className="mt-1 w-full rounded-md border border-[var(--lc-border)] bg-[var(--lc-surface)] px-3 py-2 text-sm"
              >
                {APPOINTMENT_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div className="space-y-3">
              <Label>Reminder rules</Label>
              {rules.map((rule, index) => (
                <div key={index} className="rounded-[var(--lc-radius-md)] border border-[var(--lc-border)] p-3 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Label className="text-xs" htmlFor={`offset-${index}`}>Minutes before</Label>
                    <Input
                      id={`offset-${index}`}
                      type="number"
                      min={0}
                      className="h-8 w-28"
                      value={rule.offset_minutes}
                      onChange={(e) => updateRule(index, { offset_minutes: Number(e.target.value) })}
                    />
                    <label className="inline-flex items-center gap-1 text-xs">
                      <input
                        type="checkbox"
                        checked={rule.active !== false}
                        onChange={(e) => updateRule(index, { active: e.target.checked })}
                      />
                      Active
                    </label>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {CHANNELS.map((ch) => (
                      <label key={ch.value} className="inline-flex items-center gap-1 text-xs">
                        <input
                          type="checkbox"
                          checked={rule.channels.includes(ch.value)}
                          onChange={() => toggleChannel(index, ch.value)}
                        />
                        {ch.label}
                      </label>
                    ))}
                  </div>
                  <Input
                    placeholder="Message template (optional)"
                    value={rule.message_template || ''}
                    onChange={(e) => updateRule(index, { message_template: e.target.value })}
                  />
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setEditorOpen(false)} disabled={saving}>
                Cancel
              </Button>
              <Button type="button" onClick={() => void savePolicy()} disabled={saving || !name.trim()}>
                {saving ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : null}
                Save policy
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
