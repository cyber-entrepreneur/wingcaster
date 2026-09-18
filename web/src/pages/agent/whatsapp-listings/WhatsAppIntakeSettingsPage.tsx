/**
 * AGT-WLA-004 — WhatsApp intake settings.
 * Route: /agent/whatsapp-listings/settings
 */
import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, ArrowLeft, Bell, Loader2, Save, ShieldAlert } from 'lucide-react'
import { api, type WhatsAppIntakeAgentSettings, type WhatsAppIntakeNotificationCadence } from '@/api/client'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/components/ui/toast'
import { usePageTitle } from '@/lib/usePageTitle'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { SettingsPaneHeader } from '@/components/settings/SettingsPaneHeader'

const CADENCE_OPTIONS: Array<{ value: WhatsAppIntakeNotificationCadence; label: string; description: string }> = [
  { value: 'immediately', label: 'Immediately', description: 'Notify as soon as a new draft arrives.' },
  { value: 'hourly', label: 'Batched every hour', description: 'One digest per hour when drafts are waiting.' },
  { value: 'daily', label: 'Daily digest', description: 'A single summary each morning.' },
]

export function WhatsAppIntakeSettingsPage() {
  const { agent, loading: authLoading } = useAuth()
  const { addToast } = useToast()
  usePageTitle('WhatsApp intake settings')

  const [settings, setSettings] = useState<WhatsAppIntakeAgentSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)

  const [intakeEnabled, setIntakeEnabled] = useState(true)
  const [cadence, setCadence] = useState<WhatsAppIntakeNotificationCadence>('immediately')
  const [autoApprove, setAutoApprove] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const row = await api.getWhatsAppListingsAgentSettings()
      setSettings(row)
      setIntakeEnabled(row.intake_enabled)
      setCadence(row.notification_cadence)
      setAutoApprove(row.auto_approve_high_confidence)
      setDirty(false)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Could not load settings'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (agent) void load()
  }, [agent, load])

  async function save() {
    if (saving || !settings) return
    setSaving(true)
    try {
      const next = await api.updateWhatsAppListingsAgentSettings({
        whatsapp_intake_enabled: intakeEnabled,
        whatsapp_intake_notification_cadence: cadence,
        whatsapp_intake_auto_approve_high_confidence: autoApprove,
      })
      setSettings(next)
      setIntakeEnabled(next.intake_enabled)
      setCadence(next.notification_cadence)
      setAutoApprove(next.auto_approve_high_confidence)
      setDirty(false)
      addToast({ title: 'Settings saved', variant: 'success' })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Save failed'
      addToast({ title: 'Could not save', description: msg, variant: 'error' })
    } finally {
      setSaving(false)
    }
  }

  if (authLoading || (loading && !settings)) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" aria-label="Loading settings" />
      </div>
    )
  }

  if (!agent) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <h1 className="text-2xl font-semibold text-[var(--lc-text-heading)]">Sign in</h1>
        <Link to="/login" className="mt-3 inline-block">
          <Button>Sign in</Button>
        </Link>
      </div>
    )
  }

  if (error && !settings) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
        <div className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
          <Link to="/agent/whatsapp-listings" className="inline-flex items-center gap-1 hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> WhatsApp listings
          </Link>
        </div>
        <Card className="border-[var(--lc-border)] bg-[var(--lc-surface)]">
          <CardContent className="space-y-4 pt-6">
            <p className="text-[var(--lc-text-primary)]">{error}</p>
            <Button type="button" onClick={() => void load()}>Try again</Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
        <Link to="/agent/whatsapp-listings" className="inline-flex items-center gap-1 hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> WhatsApp listings
        </Link>
        <span aria-hidden="true">·</span>
        <span>Settings</span>
      </div>

      <SettingsPaneHeader
        title="WhatsApp intake settings"
        sub="Control how incoming property drafts reach you and when they are approved."
      />

      <form
        className="space-y-6"
        onSubmit={(e) => {
          e.preventDefault()
          void save()
        }}
      >
        <Card className="border-[var(--lc-border)] bg-[var(--lc-surface)]">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-lg text-[var(--lc-text-heading)]">
              <Bell className="h-5 w-5 text-[var(--lc-text-brand)]" aria-hidden="true" />
              Intake
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <Label htmlFor="intake-enabled" className="text-[var(--lc-text-primary)]">
                  Enable WhatsApp intake
                </Label>
                <p className="mt-1 text-sm text-[var(--lc-text-muted)]">
                  When off, new drafts are held and you will not receive intake notifications.
                </p>
              </div>
              <input
                id="intake-enabled"
                type="checkbox"
                role="switch"
                aria-checked={intakeEnabled}
                className="mt-1 h-5 w-5 shrink-0 accent-[var(--lc-action-primary)]"
                checked={intakeEnabled}
                onChange={(e) => {
                  setIntakeEnabled(e.target.checked)
                  setDirty(true)
                }}
              />
            </div>
          </CardContent>
        </Card>

        <Card className="border-[var(--lc-border)] bg-[var(--lc-surface)]">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg text-[var(--lc-text-heading)]">Notification cadence</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {CADENCE_OPTIONS.map((opt) => (
              <label
                key={opt.value}
                className={`flex cursor-pointer items-start gap-3 rounded-[var(--lc-radius-md)] border p-3 transition-colors ${
                  cadence === opt.value
                    ? 'border-[var(--lc-action-primary)] bg-[var(--lc-surface-raised)]'
                    : 'border-[var(--lc-border)]'
                } ${!intakeEnabled ? 'opacity-60' : ''}`}
              >
                <input
                  type="radio"
                  name="notification-cadence"
                  value={opt.value}
                  checked={cadence === opt.value}
                  disabled={!intakeEnabled}
                  className="mt-1 accent-[var(--lc-action-primary)]"
                  onChange={() => {
                    setCadence(opt.value)
                    setDirty(true)
                  }}
                />
                <span className="min-w-0">
                  <span className="block font-medium text-[var(--lc-text-primary)]">{opt.label}</span>
                  <span className="mt-0.5 block text-sm text-[var(--lc-text-muted)]">{opt.description}</span>
                </span>
              </label>
            ))}
          </CardContent>
        </Card>

        <Card className="border-[var(--lc-border)] bg-[var(--lc-surface)]">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-lg text-[var(--lc-text-heading)]">
              <ShieldAlert className="h-5 w-5 text-[var(--lc-status-warning-fg)]" aria-hidden="true" />
              Auto-approve high confidence
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <Label htmlFor="auto-approve" className="text-[var(--lc-text-primary)]">
                  Auto-approve when all fields are highly confident
                </Label>
                <p className="mt-1 text-sm text-[var(--lc-text-muted)]">
                  Requires every extracted field to score at least 0.95. Listings publish without your review.
                </p>
              </div>
              <input
                id="auto-approve"
                type="checkbox"
                role="switch"
                aria-checked={autoApprove}
                className="mt-1 h-5 w-5 shrink-0 accent-[var(--lc-action-primary)]"
                checked={autoApprove}
                disabled={!intakeEnabled}
                onChange={(e) => {
                  setAutoApprove(e.target.checked)
                  setDirty(true)
                }}
              />
            </div>
            {autoApprove && intakeEnabled && (
              <div
                role="alert"
                className="flex gap-2 rounded-[var(--lc-radius-md)] border border-[var(--lc-status-warning-border)] bg-[var(--lc-status-warning-bg)] p-3 text-sm text-[var(--lc-status-warning-fg)]"
              >
                <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
                <p>
                  Auto-approve skips your review. Typos, wrong prices, or mismatched photos can reach your
                  listings before you catch them.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-[var(--lc-text-muted)]">
            {dirty ? 'You have unsaved changes.' : 'All changes saved.'}
          </p>
          <Button type="submit" disabled={!dirty || saving} className="w-full sm:w-auto">
            {saving ? <Loader2 className="me-2 h-4 w-4 animate-spin" aria-hidden="true" /> : <Save className="me-2 h-4 w-4" aria-hidden="true" />}
            Save settings
          </Button>
        </div>
      </form>
    </div>
  )
}
