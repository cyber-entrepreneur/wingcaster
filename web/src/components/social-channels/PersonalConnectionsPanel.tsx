import { useCallback, useEffect, useMemo, useState } from 'react'
import { Loader2, Plus, RefreshCw, Star, Trash2 } from 'lucide-react'
import { api, type PersonalChannelConnection, type PersonalChannelPlatform } from '@/api/client'
import { useStepUp } from '@/components/mfa'
import { Button } from '@/components/ui/button'
import { ChannelMark } from '@/components/ui/channel-mark'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Numeric } from '@/components/ui/numeric'
import { useToast } from '@/components/ui/toast'

const PLATFORM_OPTIONS: Array<{ value: PersonalChannelPlatform; label: string }> = [
  { value: 'facebook', label: 'Facebook' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'tiktok', label: 'TikTok' },
  { value: 'x', label: 'X' },
  { value: 'whatsapp', label: 'WhatsApp' },
]

function platformLabel(platform: PersonalChannelPlatform) {
  return PLATFORM_OPTIONS.find((option) => option.value === platform)?.label || platform
}

function wasCancelled(error: unknown) {
  return Boolean(error && typeof error === 'object' && 'reason' in error && error.reason === 'user_cancelled')
}

export function PersonalConnectionsPanel() {
  const { addToast } = useToast()
  const { requireStepUp } = useStepUp({ reason: 'Manage connected publishing accounts' })
  const [connections, setConnections] = useState<PersonalChannelConnection[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [removeTarget, setRemoveTarget] = useState<PersonalChannelConnection | null>(null)
  const [platform, setPlatform] = useState<PersonalChannelPlatform>('instagram')
  const [accountName, setAccountName] = useState('')
  const [handle, setHandle] = useState('')
  const [formError, setFormError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const result = await api.listPersonalChannelConnections()
      setConnections(result.connections)
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Connected accounts could not be loaded.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const grouped = useMemo(() => {
    return PLATFORM_OPTIONS.map((option) => ({
      ...option,
      connections: connections.filter((connection) => connection.platform === option.value),
    })).filter((group) => group.connections.length > 0)
  }, [connections])

  async function addConnection() {
    const cleanName = accountName.trim()
    const cleanHandle = handle.trim()
    if (!cleanName || !cleanHandle) {
      setFormError('Enter an account name and handle.')
      return
    }
    setFormError(null)
    setBusyId('new')
    try {
      await requireStepUp({ reason: `Connect ${platformLabel(platform)} account` })
      await api.createPersonalChannelConnection({
        platform,
        account_name: cleanName,
        handle: cleanHandle,
      })
      addToast({ title: 'Account connected', description: `${cleanName} is ready to use.` })
      setAddOpen(false)
      setAccountName('')
      setHandle('')
      await load()
    } catch (error) {
      if (!wasCancelled(error)) {
        setFormError(error instanceof Error ? error.message : 'The account could not be connected.')
      }
    } finally {
      setBusyId(null)
    }
  }

  async function setPrimary(connection: PersonalChannelConnection) {
    setBusyId(connection.id)
    try {
      await requireStepUp({
        reason: `Use ${connection.account_name} as the primary ${platformLabel(connection.platform)} account`,
      })
      await api.updatePersonalChannelConnection(connection.id, { is_primary: true })
      setConnections((current) =>
        current.map((item) =>
          item.platform === connection.platform ? { ...item, is_primary: item.id === connection.id } : item,
        ),
      )
      addToast({ title: 'Primary account updated', description: `${connection.account_name} will be used by default.` })
    } catch (error) {
      if (!wasCancelled(error)) {
        addToast({
          title: 'Could not change primary account',
          description: error instanceof Error ? error.message : undefined,
          variant: 'error',
        })
      }
    } finally {
      setBusyId(null)
    }
  }

  async function removeConnection() {
    if (!removeTarget) return
    const target = removeTarget
    setBusyId(target.id)
    try {
      await requireStepUp({ reason: `Remove ${target.account_name}` })
      await api.removePersonalChannelConnection(target.id)
      setRemoveTarget(null)
      addToast({ title: 'Account removed', description: `${target.account_name} is no longer connected.` })
      await load()
    } catch (error) {
      if (!wasCancelled(error)) {
        addToast({
          title: 'Could not remove account',
          description: error instanceof Error ? error.message : undefined,
          variant: 'error',
        })
      }
    } finally {
      setBusyId(null)
    }
  }

  if (loading && connections.length === 0) {
    return (
      <div className="space-y-[var(--lc-space-sm)]" aria-busy="true" aria-label="Loading personal accounts">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="h-24 animate-pulse rounded-[var(--lc-radius-lg)] bg-[var(--lc-surface-sunken)]" />
        ))}
      </div>
    )
  }

  if (loadError && connections.length === 0) {
    return (
      <div
        className="rounded-[var(--lc-radius-lg)] border border-[var(--lc-status-danger-fg)] bg-[var(--lc-status-danger-bg)] p-[var(--lc-space-lg)] text-center"
        role="alert"
      >
        <h2 style={{ font: 'var(--lc-type-heading-3)' }}>Accounts are unavailable</h2>
        <p className="mt-1 text-sm text-[var(--lc-status-danger-fg)]">{loadError}</p>
        <Button className="mt-[var(--lc-space-md)]" onClick={() => void load()}>
          <RefreshCw className="me-2 h-4 w-4" aria-hidden />
          Try again
        </Button>
      </div>
    )
  }

  return (
    <section aria-labelledby="personal-accounts-heading" data-testid="personal-connections-panel">
      <div className="flex flex-col gap-[var(--lc-space-sm)] sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 id="personal-accounts-heading" style={{ font: 'var(--lc-type-heading-2)' }}>
            My accounts
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-[var(--lc-text-secondary)]">
            Keep personal and business identities separate. The primary account is used by default when you publish or
            reply on that channel.
          </p>
          <p className="mt-2 text-xs text-[var(--lc-text-muted)]">
            <Numeric>{connections.length}</Numeric> accounts across <Numeric>{grouped.length}</Numeric> channels
          </p>
        </div>
        <Button className="w-full sm:w-auto" onClick={() => setAddOpen(true)}>
          <Plus className="me-2 h-4 w-4" aria-hidden />
          Add account
        </Button>
      </div>

      {connections.length === 0 ? (
        <div
          className="mt-[var(--lc-space-lg)] rounded-[var(--lc-radius-lg)] border border-dashed border-[var(--lc-border)] bg-[var(--lc-surface-raised)] p-[var(--lc-space-xl)] text-center"
          role="status"
        >
          <h3 style={{ font: 'var(--lc-type-heading-3)' }}>No personal accounts yet</h3>
          <p className="mx-auto mt-1 max-w-lg text-sm text-[var(--lc-text-secondary)]">
            Add a publishing identity to switch between personal and business accounts without changing your
            channel-wide setup.
          </p>
          <Button className="mt-[var(--lc-space-md)]" onClick={() => setAddOpen(true)}>
            <Plus className="me-2 h-4 w-4" aria-hidden />
            Add your first account
          </Button>
        </div>
      ) : (
        <div className="mt-[var(--lc-space-lg)] space-y-[var(--lc-space-lg)]">
          {grouped.map((group) => (
            <section key={group.value} aria-labelledby={`channel-${group.value}`}>
              <div className="mb-[var(--lc-space-sm)] flex items-center gap-2">
                <ChannelMark channel={group.value} />
                <h3 id={`channel-${group.value}`} style={{ font: 'var(--lc-type-heading-3)' }}>
                  {group.label}
                </h3>
                <Numeric className="text-xs text-[var(--lc-text-muted)]">{group.connections.length}</Numeric>
              </div>
              <div className="space-y-[var(--lc-space-sm)]">
                {group.connections.map((connection) => (
                  <article
                    key={connection.id}
                    className="flex flex-col gap-[var(--lc-space-sm)] rounded-[var(--lc-radius-lg)] border border-[var(--lc-border)] bg-[var(--lc-surface-raised)] p-[var(--lc-space-md)] sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate font-semibold text-[var(--lc-text-primary)]">
                          {connection.account_name}
                        </p>
                        {connection.is_primary ? (
                          <span className="inline-flex items-center gap-1 rounded-[var(--lc-radius-pill)] bg-[var(--lc-status-success-bg)] px-2 py-1 text-xs font-medium text-[var(--lc-status-success-fg)]">
                            <Star className="h-3 w-3" aria-hidden />
                            Primary
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-1 truncate text-sm text-[var(--lc-text-secondary)]">
                        {connection.handle || 'Handle unavailable'}
                      </p>
                    </div>
                    <div className="flex w-full flex-wrap gap-2 sm:w-auto sm:justify-end">
                      {!connection.is_primary ? (
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 sm:flex-none"
                          disabled={busyId === connection.id}
                          onClick={() => void setPrimary(connection)}
                        >
                          {busyId === connection.id ? (
                            <Loader2 className="me-2 h-4 w-4 animate-spin" aria-hidden />
                          ) : (
                            <Star className="me-2 h-4 w-4" aria-hidden />
                          )}
                          Set primary
                        </Button>
                      ) : null}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="flex-1 text-[var(--lc-status-danger-fg)] sm:flex-none"
                        disabled={busyId === connection.id}
                        onClick={() => setRemoveTarget(connection)}
                      >
                        <Trash2 className="me-2 h-4 w-4" aria-hidden />
                        Remove
                      </Button>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add account</DialogTitle>
            <DialogDescription>
              Add another identity to a channel. Your first account on each channel becomes primary.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-[var(--lc-space-md)] space-y-[var(--lc-space-md)]">
            <div>
              <Label htmlFor="personal-account-platform">Channel</Label>
              <select
                id="personal-account-platform"
                className="mt-1 w-full rounded-[var(--lc-radius-md)] border border-[var(--lc-border-strong)] bg-[var(--lc-surface)] px-3 text-sm text-[var(--lc-text-primary)]"
                value={platform}
                onChange={(event) => setPlatform(event.target.value as PersonalChannelPlatform)}
              >
                {PLATFORM_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="personal-account-name">Account name</Label>
              <Input
                id="personal-account-name"
                className="mt-1"
                value={accountName}
                onChange={(event) => setAccountName(event.target.value)}
                placeholder="Personal profile"
                maxLength={120}
              />
            </div>
            <div>
              <Label htmlFor="personal-account-handle">Handle or username</Label>
              <Input
                id="personal-account-handle"
                className="mt-1"
                value={handle}
                onChange={(event) => setHandle(event.target.value)}
                placeholder="@yourhandle"
                maxLength={120}
              />
            </div>
            {formError ? (
              <p className="text-sm text-[var(--lc-status-danger-fg)]" role="alert">
                {formError}
              </p>
            ) : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)} disabled={busyId === 'new'}>
              Cancel
            </Button>
            <Button onClick={() => void addConnection()} disabled={busyId === 'new'}>
              {busyId === 'new' ? <Loader2 className="me-2 h-4 w-4 animate-spin" aria-hidden /> : null}
              Add account
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(removeTarget)} onOpenChange={(open) => !open && setRemoveTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove {removeTarget?.account_name}?</DialogTitle>
            <DialogDescription>
              This identity will no longer be available for publishing or replies. If it is primary, the oldest
              remaining account on this channel becomes primary automatically.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRemoveTarget(null)} disabled={Boolean(busyId)}>
              Keep account
            </Button>
            <Button variant="destructive" onClick={() => void removeConnection()} disabled={Boolean(busyId)}>
              {busyId ? <Loader2 className="me-2 h-4 w-4 animate-spin" aria-hidden /> : null}
              Remove account
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  )
}
