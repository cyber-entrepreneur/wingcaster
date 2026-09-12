import { useCallback, useEffect, useState } from 'react'
import { ExternalLink, Globe, Loader2, Monitor, Smartphone, Tablet } from 'lucide-react'
import { api, type AuthSessionRow, type PushTokenRow } from '@/api/client'
import { SettingsPaneHeader } from '@/components/settings'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Numeric } from '@/components/ui/numeric'
import { useToast } from '@/components/ui/toast'
import { useStepUp } from '@/components/mfa'
import { isNotFound } from '@/lib/http-status'
import { formatRelativeTime, formatShortDate } from '@/lib/relative-time'
import { usePageTitle } from '@/lib/usePageTitle'
import { cn } from '@/lib/utils'

function deviceIcon(kind: string | undefined) {
  if (kind === 'mobile') return Smartphone
  if (kind === 'tablet') return Tablet
  if (kind === 'desktop') return Monitor
  return Globe
}

function locationLine(row: AuthSessionRow): string {
  const city = row.ip_city
  const country = row.ip_country
  const loc = [city, country].filter(Boolean).join(', ')
  if (row.ip && loc) return `${row.ip} · ${loc}`
  if (row.ip) return row.ip
  return loc || 'Unknown location'
}

export function SessionsPage() {
  const { addToast } = useToast()
  const { requireStepUp } = useStepUp({ reason: 'Sign out of every other device' })
  usePageTitle('Sessions & devices')

  const [sessions, setSessions] = useState<AuthSessionRow[]>([])
  const [tokens, setTokens] = useState<PushTokenRow[]>([])
  const [sessionsUnavailable, setSessionsUnavailable] = useState(false)
  const [sessionsError, setSessionsError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [removeId, setRemoveId] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [bulkOpen, setBulkOpen] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setSessionsError(null)
    try {
      try {
        const res = await api.getAuthSessions()
        setSessions(res.sessions || [])
        setSessionsUnavailable(false)
      } catch (err) {
        setSessions([])
        if (isNotFound(err)) {
          setSessionsUnavailable(true)
        } else {
          setSessionsError(err instanceof Error ? err.message : 'Could not load sessions.')
        }
      }
      try {
        const res = await api.getPushTokens()
        setTokens(res.tokens || [])
      } catch {
        setTokens([])
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const current = sessions.find((s) => s.is_current)
  const foreignCountry = sessions.find(
    (s) => !s.is_current && current?.ip_country && s.ip_country && s.ip_country !== current.ip_country,
  )?.ip_country
  const foreign = Boolean(foreignCountry)

  async function signOutOne(id: string) {
    setBusyId(id)
    try {
      await api.deleteAuthSession(id)
      setSessions((rows) => rows.filter((r) => r.id !== id))
      addToast({ title: 'Session signed out.', variant: 'success' })
    } catch (err) {
      addToast({
        title: "Couldn't sign the session out. Try again.",
        description: err instanceof Error ? err.message : undefined,
        variant: 'error',
      })
    } finally {
      setBusyId(null)
      setConfirmId(null)
    }
  }

  async function signOutEverywhere() {
    try {
      await requireStepUp({ reason: 'Sign out of every other device' })
    } catch {
      return
    }
    setBusyId('bulk')
    try {
      const res = await api.deleteAuthSessionsExceptCurrent()
      const n = res?.revoked ?? sessions.filter((s) => !s.is_current).length
      setSessions((rows) => rows.filter((r) => r.is_current))
      addToast({ title: `Signed out of ${n} sessions.`, variant: 'success' })
      setBulkOpen(false)
    } catch (err) {
      if (isNotFound(err)) {
        addToast({ title: 'Sign out everywhere is available soon.', variant: 'warning' })
      } else {
        addToast({
          title: "Couldn't sign other sessions out.",
          description: err instanceof Error ? err.message : undefined,
          variant: 'error',
        })
      }
    } finally {
      setBusyId(null)
    }
  }

  async function removeDevice(id: string) {
    setBusyId(id)
    try {
      await api.deletePushToken(id)
      setTokens((rows) => rows.filter((r) => r.id !== id))
      addToast({ title: 'Device removed.', variant: 'success' })
    } catch (err) {
      addToast({
        title: 'Could not remove device.',
        description: err instanceof Error ? err.message : undefined,
        variant: 'error',
      })
    } finally {
      setBusyId(null)
      setRemoveId(null)
    }
  }

  const confirmSession = sessions.find((s) => s.id === confirmId)
  const removeToken = tokens.find((t) => t.id === removeId)

  if (loading) {
    return (
      <div className="space-y-[var(--lc-space-md)]" aria-busy="true">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-20 rounded-[var(--lc-radius-md)] bg-[var(--lc-surface-sunken)]" />
        ))}
      </div>
    )
  }

  return (
    <div>
      <SettingsPaneHeader
        title="Sessions & devices"
        sub="Review where you're signed in and revoke any session you don't recognize."
      />

      {sessions.length > 1 || foreign ? (
        <div
          role="status"
          className="mb-[var(--lc-space-lg)] rounded-[var(--lc-radius-md)] bg-[var(--lc-status-underOffer-bg)] px-[var(--lc-space-md)] py-[var(--lc-space-sm)] text-[var(--lc-status-underOffer-fg)]"
        >
          {foreign && foreignCountry
            ? `A session is signed in from ${foreignCountry} — different from this device. Review it below.`
            : `You have ${sessions.length} active sessions. Review anything you don't recognize.`}
        </div>
      ) : null}

      <section>
        <div className="mb-[var(--lc-space-md)] flex flex-col gap-[var(--lc-space-sm)] sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-[var(--lc-text-heading)]" style={{ font: 'var(--lc-type-heading-2)' }}>
            Active sessions
          </h2>
          {!sessionsUnavailable && sessions.filter((s) => !s.is_current).length > 0 ? (
            <Button
              variant="outline"
              type="button"
              className="text-[var(--lc-status-unpublished-fg)]"
              onClick={() => setBulkOpen(true)}
            >
              Sign out everywhere except this device
            </Button>
          ) : null}
        </div>

        {sessionsUnavailable ? (
          <div className="rounded-[var(--lc-radius-md)] border border-[var(--lc-border)] bg-[var(--lc-surface-sunken)] p-[var(--lc-space-lg)]">
            <p className="text-[var(--lc-text-heading)]" style={{ font: 'var(--lc-type-heading-3)' }}>
              Available soon
            </p>
            <p className="mt-[var(--lc-space-2xs)] text-[var(--lc-text-muted)]">
              Session history is not on this environment yet. You can still manage registered mobile devices below.
            </p>
          </div>
        ) : sessionsError ? (
          <div role="alert" className="rounded-[var(--lc-radius-md)] bg-[var(--lc-status-unpublished-bg)] p-[var(--lc-space-md)] text-[var(--lc-status-unpublished-fg)]">
            {sessionsError}
          </div>
        ) : (
          <ul aria-label="Active sessions" className="divide-y divide-[var(--lc-border)]">
            {sessions.map((row) => {
              const Icon = deviceIcon(row.device_kind)
              const isForeign = Boolean(
                current?.ip_country && row.ip_country && !row.is_current && row.ip_country !== current.ip_country,
              )
              return (
                <li
                  key={row.id}
                  className={cn(
                    'flex flex-col gap-[var(--lc-space-sm)] py-[var(--lc-space-lg)] sm:flex-row sm:items-center',
                    isForeign && 'border-s-2 border-[var(--lc-status-underOffer-fg)] ps-[var(--lc-space-sm)]',
                  )}
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-[var(--lc-radius-md)] bg-[var(--lc-surface-sunken)]">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p style={{ font: 'var(--lc-type-body)' }}>{row.device_summary || 'Unknown device'}</p>
                    <p className="text-[var(--lc-text-muted)]" style={{ font: 'var(--lc-type-body-sm)' }} dir="ltr">
                      <Numeric>{locationLine(row)}</Numeric>
                    </p>
                    <p className="text-[var(--lc-text-muted)]" style={{ font: 'var(--lc-type-caption)' }} title={row.last_active_at}>
                      Last active <Numeric>{formatRelativeTime(row.last_active_at)}</Numeric>
                    </p>
                  </div>
                  {row.is_current ? (
                    <Badge variant="published" status="published">
                      This device
                      <span className="sr-only">This is the device you're currently using</span>
                    </Badge>
                  ) : (
                    <Button
                      variant="outline"
                      type="button"
                      aria-label={`Sign out session on ${row.device_summary || 'device'}`}
                      onClick={() => setConfirmId(row.id)}
                      disabled={busyId === row.id}
                    >
                      {busyId === row.id ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : null}
                      Sign out
                    </Button>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <section className="mt-[var(--lc-space-2xl)] border-t border-[var(--lc-border)] pt-[var(--lc-space-xl)]">
        <h2 className="text-[var(--lc-text-heading)]" style={{ font: 'var(--lc-type-heading-2)' }}>
          Registered mobile devices
        </h2>
        <p className="mb-[var(--lc-space-md)] text-[var(--lc-text-muted)]" style={{ font: 'var(--lc-type-body-sm)' }}>
          Devices where you've installed the WingCaster mobile app. These receive push notifications.
        </p>
        {tokens.length === 0 ? (
          <div className="rounded-[var(--lc-radius-md)] bg-[var(--lc-surface-sunken)] p-[var(--lc-space-lg)]">
            <p className="text-[var(--lc-text-heading)]" style={{ font: 'var(--lc-type-heading-3)' }}>
              No mobile devices registered.
            </p>
            <p className="mb-[var(--lc-space-md)] text-[var(--lc-text-muted)]">
              Install the WingCaster app to receive push notifications on the go.
            </p>
            <div className="flex flex-col gap-[var(--lc-space-sm)] sm:flex-row">
              <Button variant="outline" asChild>
                <a href="https://apps.apple.com" target="_blank" rel="noreferrer">
                  Get it on the App Store ↗ <ExternalLink className="ms-1 h-4 w-4" />
                </a>
              </Button>
              <Button variant="outline" asChild>
                <a href="https://play.google.com" target="_blank" rel="noreferrer">
                  Get it on Google Play ↗ <ExternalLink className="ms-1 h-4 w-4" />
                </a>
              </Button>
            </div>
          </div>
        ) : (
          <ul aria-label="Registered mobile devices" className="divide-y divide-[var(--lc-border)]">
            {tokens.map((token) => {
              const Icon = token.platform === 'web' ? Globe : Smartphone
              const label =
                token.device_id ||
                (token.platform === 'ios' ? 'iPhone / iPad' : token.platform === 'android' ? 'Android' : 'Web push')
              return (
                <li key={token.id} className="flex flex-col gap-[var(--lc-space-sm)] py-[var(--lc-space-lg)] sm:flex-row sm:items-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-[var(--lc-radius-md)] bg-[var(--lc-surface-sunken)]">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p style={{ font: 'var(--lc-type-body)' }}>{label}</p>
                    <p className="text-[var(--lc-text-muted)]" style={{ font: 'var(--lc-type-body-sm)' }}>
                      Registered on {token.created_at ? formatShortDate(token.created_at) : '—'}
                    </p>
                    <p className="text-[var(--lc-text-muted)]" style={{ font: 'var(--lc-type-caption)' }}>
                      Last used {token.last_used_at ? formatRelativeTime(token.last_used_at) : '—'}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    type="button"
                    className="text-[var(--lc-status-unpublished-fg)]"
                    onClick={() => setRemoveId(token.id)}
                    disabled={busyId === token.id}
                  >
                    Remove
                  </Button>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <Dialog open={Boolean(confirmId)} onOpenChange={(o) => !o && setConfirmId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sign out this session?</DialogTitle>
            <DialogDescription>
              You'll need to sign in again on <strong>{confirmSession?.device_summary || 'that device'}</strong> to
              use WingCaster there.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-[var(--lc-space-sm)]">
            <Button variant="outline" type="button" onClick={() => setConfirmId(null)}>
              Keep signed in
            </Button>
            <Button type="button" onClick={() => confirmId && void signOutOne(confirmId)}>
              Sign out session
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sign out of every other device?</DialogTitle>
            <DialogDescription>
              You'll stay signed in here. Every other browser and mobile app will need to sign in again. Confirm with
              your 2-step verification to continue.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-[var(--lc-space-sm)]">
            <Button variant="outline" type="button" onClick={() => setBulkOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={() => void signOutEverywhere()} disabled={busyId === 'bulk'}>
              {busyId === 'bulk' ? 'Signing out other devices…' : 'Sign out other devices'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(removeId)} onOpenChange={(o) => !o && setRemoveId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove this device?</DialogTitle>
            <DialogDescription>
              You'll stop receiving push notifications on{' '}
              <strong>{removeToken?.device_id || removeToken?.platform || 'this device'}</strong>. Sign-in on the
              device is unaffected — sign out separately if you want that too.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-[var(--lc-space-sm)]">
            <Button variant="outline" type="button" onClick={() => setRemoveId(null)}>
              Cancel
            </Button>
            <Button type="button" onClick={() => removeId && void removeDevice(removeId)}>
              Remove device
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
