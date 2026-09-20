import { useCallback, useEffect, useState } from 'react'
import { Loader2, Save } from 'lucide-react'
import { api, type ContactPolicy } from '@/api/client'
import { useAuth } from '@/context/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/components/ui/toast'
import { usePageTitle } from '@/lib/usePageTitle'

const DEFAULT_RULES = {
  frequency_caps: [
    { channel: 'whatsapp' as const, purpose: 'marketing' as const, max_sends: 2, window_hours: 24 },
  ],
  quiet_hours: {
    timezone: 'Asia/Dubai',
    windows: [{ days: [0, 1, 2, 3, 4, 5, 6], start: '22:00', end: '08:00' }],
  },
  do_not_contact_windows: [] as Array<{
    start?: string
    end?: string
    channels?: string[]
    reason?: string
  }>,
}

/**
 * Agency ContactPolicy admin — frequency caps, quiet hours, do-not-contact windows.
 */
export function AgencyContactPolicyPage() {
  const { agent } = useAuth()
  const { addToast } = useToast()
  usePageTitle('Contact policy')

  const affiliation =
    (agent?.affiliation as { agency_id?: string; role?: string } | undefined) || undefined
  const agencyId = affiliation?.agency_id || null
  const role = affiliation?.role || null
  const isAdmin = role === 'owner' || role === 'admin'

  const [policy, setPolicy] = useState<ContactPolicy | null>(null)
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error' | 'forbidden'>(
    isAdmin ? 'loading' : 'forbidden',
  )
  const [maxSends, setMaxSends] = useState(2)
  const [windowHours, setWindowHours] = useState(24)
  const [quietStart, setQuietStart] = useState('22:00')
  const [quietEnd, setQuietEnd] = useState('08:00')
  const [timezone, setTimezone] = useState('Asia/Dubai')
  const [dncStart, setDncStart] = useState('')
  const [dncEnd, setDncEnd] = useState('')
  const [dncChannels, setDncChannels] = useState('whatsapp,email')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    if (!agencyId || !isAdmin) {
      setLoadState('forbidden')
      return
    }
    setLoadState('loading')
    try {
      const policies = await api.getContactPolicies({ scope: 'agency' })
      const current = policies.find((p: ContactPolicy) => p.scope === 'agency') || policies[0] || null
      setPolicy(current)
      const rules = current?.rules || DEFAULT_RULES
      const cap = rules.frequency_caps?.[0]
      if (cap) {
        setMaxSends(cap.max_sends)
        setWindowHours(cap.window_hours)
      }
      if (rules.quiet_hours?.windows?.[0]) {
        setQuietStart(rules.quiet_hours.windows[0].start)
        setQuietEnd(rules.quiet_hours.windows[0].end)
        setTimezone(rules.quiet_hours.timezone || 'Asia/Dubai')
      }
      const dnc = rules.do_not_contact_windows?.[0]
      if (dnc) {
        setDncStart(dnc.start || '')
        setDncEnd(dnc.end || '')
        setDncChannels((dnc.channels || []).join(',') || 'whatsapp,email')
      }
      setLoadState('ready')
    } catch (err) {
      const status = (err as { status?: number }).status
      if (status === 401 || status === 403) setLoadState('forbidden')
      else setLoadState('error')
    }
  }, [agencyId, isAdmin])

  useEffect(() => {
    if (isAdmin) void load()
  }, [isAdmin, load])

  async function save() {
    setSaving(true)
    try {
      const rules = {
        frequency_caps: [
          {
            channel: 'whatsapp' as const,
            purpose: 'marketing' as const,
            max_sends: maxSends,
            window_hours: windowHours,
          },
          {
            channel: 'email' as const,
            purpose: 'marketing' as const,
            max_sends: maxSends,
            window_hours: windowHours,
          },
        ],
        quiet_hours: {
          timezone,
          windows: [{ days: [0, 1, 2, 3, 4, 5, 6], start: quietStart, end: quietEnd }],
        },
        do_not_contact_windows: dncStart || dncEnd
          ? [{
              start: dncStart || undefined,
              end: dncEnd || undefined,
              channels: dncChannels.split(',').map((c) => c.trim()).filter(Boolean),
            }]
          : [],
      }
      const saved = await api.upsertContactPolicy({
        id: policy?.id,
        scope: 'agency',
        name: policy?.name || 'Agency contact policy',
        rules,
      })
      setPolicy(saved)
      addToast({ title: 'Contact policy saved', variant: 'success' })
    } catch (err) {
      addToast({
        title: 'Could not save policy',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'error',
      })
    } finally {
      setSaving(false)
    }
  }

  if (loadState === 'forbidden') {
    return (
      <div className="mx-auto max-w-2xl p-[var(--lc-space-lg)]">
        <h1 style={{ font: 'var(--lc-type-heading-2)' }} className="text-[var(--lc-text-primary)]">
          Contact policy
        </h1>
        <p className="mt-2 text-[var(--lc-text-muted)]">Agency admin access is required.</p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl space-y-[var(--lc-space-lg)] p-[var(--lc-space-lg)]">
      <header>
        <h1 style={{ font: 'var(--lc-type-heading-2)' }} className="text-[var(--lc-text-primary)]">
          Contact policy
        </h1>
        <p className="mt-1 text-[var(--lc-text-muted)]" style={{ font: 'var(--lc-type-body)' }}>
          Frequency caps, quiet hours, and do-not-contact windows applied to every eligible send.
        </p>
      </header>

      {loadState === 'loading' && (
        <div className="flex items-center gap-2 text-[var(--lc-text-muted)]">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      )}

      {loadState === 'error' && (
        <p className="text-[var(--lc-status-danger)]">Could not load contact policy.</p>
      )}

      {loadState === 'ready' && (
        <div className="space-y-[var(--lc-space-lg)]">
          <section className="space-y-[var(--lc-space-sm)]">
            <h2 style={{ font: 'var(--lc-type-heading-3)' }}>Frequency caps</h2>
            <div className="grid gap-[var(--lc-space-sm)] sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="max-sends">Max marketing sends</Label>
                <Input
                  id="max-sends"
                  type="number"
                  min={0}
                  value={maxSends}
                  onChange={(e) => setMaxSends(Number(e.target.value) || 0)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="window-hours">Window (hours)</Label>
                <Input
                  id="window-hours"
                  type="number"
                  min={1}
                  value={windowHours}
                  onChange={(e) => setWindowHours(Number(e.target.value) || 1)}
                />
              </div>
            </div>
          </section>

          <section className="space-y-[var(--lc-space-sm)]">
            <h2 style={{ font: 'var(--lc-type-heading-3)' }}>Quiet hours</h2>
            <div className="grid gap-[var(--lc-space-sm)] sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="tz">Timezone</Label>
                <Input id="tz" value={timezone} onChange={(e) => setTimezone(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="q-start">Start</Label>
                <Input id="q-start" value={quietStart} onChange={(e) => setQuietStart(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="q-end">End</Label>
                <Input id="q-end" value={quietEnd} onChange={(e) => setQuietEnd(e.target.value)} />
              </div>
            </div>
          </section>

          <section className="space-y-[var(--lc-space-sm)]">
            <h2 style={{ font: 'var(--lc-type-heading-3)' }}>Do-not-contact window</h2>
            <div className="grid gap-[var(--lc-space-sm)] sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="dnc-start">Start (ISO)</Label>
                <Input id="dnc-start" value={dncStart} onChange={(e) => setDncStart(e.target.value)} placeholder="2026-09-20T00:00:00Z" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="dnc-end">End (ISO)</Label>
                <Input id="dnc-end" value={dncEnd} onChange={(e) => setDncEnd(e.target.value)} placeholder="2026-09-22T00:00:00Z" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dnc-channels">Channels (comma-separated)</Label>
              <Input id="dnc-channels" value={dncChannels} onChange={(e) => setDncChannels(e.target.value)} />
            </div>
          </section>

          <Button
            type="button"
            onClick={() => void save()}
            disabled={saving}
            className="min-h-[var(--lc-tap-target-min)]"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save policy
          </Button>
        </div>
      )}
    </div>
  )
}
