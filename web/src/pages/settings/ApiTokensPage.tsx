import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, Copy, KeySquare, Loader2, Trash2 } from 'lucide-react'
import { api, type ApiTokenRecord } from '@/api/client'
import { SettingsPaneHeader } from '@/components/settings'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/components/ui/toast'
import { formatRelativeTime, formatShortDate } from '@/lib/relative-time'
import { usePageTitle } from '@/lib/usePageTitle'

/**
 * Personal Access Tokens surface (issue 192a).
 *
 * Enterprise settings pattern: user creates a named + scoped token, sees the
 * raw value exactly once, and never again. List page shows scopes, last-used
 * timestamp, and a revoke action. Revoke is a soft delete (backend flips
 * `revoked_at`).
 *
 * Not admin-gated at the page level — every authenticated user can mint
 * their own tokens. Revoke is server-side ownership-gated (403 if you try
 * to revoke someone else's).
 */

const AVAILABLE_SCOPES = [
  { value: 'listings:read', label: 'Read listings' },
  { value: 'listings:write', label: 'Manage listings' },
  { value: 'inquiries:read', label: 'Read inquiries' },
  { value: 'inquiries:write', label: 'Reply to inquiries' },
  { value: 'contacts:read', label: 'Read contacts' },
  { value: 'contacts:write', label: 'Manage contacts' },
] as const

export function ApiTokensPage() {
  const { addToast } = useToast()
  usePageTitle('API tokens')

  const [tokens, setTokens] = useState<ApiTokenRecord[]>([])
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [creating, setCreating] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [name, setName] = useState('')
  const [scopes, setScopes] = useState<string[]>([])
  const [expiresAt, setExpiresAt] = useState('')
  const [rawToken, setRawToken] = useState<string | null>(null)
  const [rawCopied, setRawCopied] = useState(false)
  const [revokeId, setRevokeId] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoadState('loading')
    try {
      const { tokens: rows } = await api.listApiTokens()
      setTokens(rows)
      setLoadState('ready')
    } catch (err) {
      addToast({
        variant: 'error',
        title: 'Could not load API tokens',
        description: err instanceof Error ? err.message : undefined,
      })
      setLoadState('error')
    }
  }, [addToast])

  useEffect(() => {
    void load()
  }, [load])

  function toggleScope(value: string) {
    setScopes((prev) => (prev.includes(value) ? prev.filter((s) => s !== value) : [...prev, value]))
  }

  async function submitCreate() {
    if (!name.trim()) return
    setCreating(true)
    try {
      const res = await api.createApiToken({
        name: name.trim(),
        scopes,
        expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
      })
      setRawToken(res.token)
      setTokens((prev) => [res.record, ...prev])
      setName('')
      setScopes([])
      setExpiresAt('')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not create token.'
      addToast({ variant: 'error', title: 'Could not create token', description: message })
    } finally {
      setCreating(false)
    }
  }

  async function copyRaw() {
    if (!rawToken) return
    try {
      await navigator.clipboard.writeText(rawToken)
      setRawCopied(true)
      window.setTimeout(() => setRawCopied(false), 1800)
    } catch {
      addToast({ variant: 'error', title: 'Could not copy. Select and copy manually.' })
    }
  }

  async function confirmRevoke(id: string) {
    setBusyId(id)
    try {
      await api.revokeApiToken(id)
      setTokens((prev) =>
        prev.map((t) => (t.id === id ? { ...t, revoked_at: new Date().toISOString() } : t)),
      )
      addToast({ variant: 'success', title: 'Token revoked.' })
    } catch (err) {
      addToast({
        variant: 'error',
        title: 'Could not revoke token',
        description: err instanceof Error ? err.message : undefined,
      })
    } finally {
      setBusyId(null)
      setRevokeId(null)
    }
  }

  return (
    <div>
      <SettingsPaneHeader
        title="API tokens"
        sub="Machine-to-machine access for your CRM, BI dashboards, and automation. Tokens carry your permissions — revoke any you don't recognise."
      />

      <div className="mb-[var(--lc-space-lg)] flex justify-end">
        <Button type="button" onClick={() => setCreateOpen(true)}>
          <KeySquare className="me-2 h-4 w-4" aria-hidden />
          New token
        </Button>
      </div>

      {loadState === 'loading' ? (
        <div aria-busy="true" className="space-y-[var(--lc-space-sm)]">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-20 rounded-[var(--lc-radius-md)] bg-[var(--lc-surface-sunken)]" />
          ))}
        </div>
      ) : null}

      {loadState === 'ready' && tokens.length === 0 ? (
        <div className="rounded-[var(--lc-radius-md)] bg-[var(--lc-surface-sunken)] p-[var(--lc-space-lg)] text-center">
          <p style={{ font: 'var(--lc-type-heading-3)' }}>No tokens yet.</p>
          <p className="mt-[var(--lc-space-xs)] text-[var(--lc-text-muted)]">
            Create a token to connect WingCaster to another system.
          </p>
        </div>
      ) : null}

      {loadState === 'ready' && tokens.length > 0 ? (
        <ul aria-label="API tokens" className="divide-y divide-[var(--lc-border)]">
          {tokens.map((token) => {
            const isRevoked = Boolean(token.revoked_at)
            const isExpired = Boolean(
              token.expires_at && new Date(token.expires_at).getTime() <= Date.now(),
            )
            return (
              <li
                key={token.id}
                className="flex flex-col gap-[var(--lc-space-sm)] py-[var(--lc-space-md)] sm:flex-row sm:items-center"
              >
                <div className="min-w-0 flex-1">
                  <p style={{ font: 'var(--lc-type-body)' }}>{token.name}</p>
                  <p
                    className="text-[var(--lc-text-muted)]"
                    style={{ font: 'var(--lc-type-body-sm)' }}
                  >
                    {token.scopes.length === 0
                      ? 'Full access (no scope limit)'
                      : token.scopes.join(', ')}
                  </p>
                  <p className="text-[var(--lc-text-muted)]" style={{ font: 'var(--lc-type-caption)' }}>
                    Created {formatShortDate(token.created_at)} ·{' '}
                    {token.last_used_at
                      ? `last used ${formatRelativeTime(token.last_used_at)}`
                      : 'never used'}
                    {token.expires_at
                      ? ` · expires ${formatShortDate(token.expires_at)}`
                      : ' · no expiry'}
                  </p>
                </div>
                <div className="flex items-center gap-[var(--lc-space-sm)]">
                  {isRevoked ? (
                    <span
                      className="rounded-[var(--lc-radius-pill)] bg-[var(--lc-status-unpublished-bg)] px-2 py-0.5 text-[var(--lc-status-unpublished-fg)]"
                      style={{ font: 'var(--lc-type-caption)' }}
                    >
                      Revoked
                    </span>
                  ) : isExpired ? (
                    <span
                      className="rounded-[var(--lc-radius-pill)] bg-[var(--lc-status-warning-bg)] px-2 py-0.5 text-[var(--lc-status-warning-fg)]"
                      style={{ font: 'var(--lc-type-caption)' }}
                    >
                      Expired
                    </span>
                  ) : (
                    <Button
                      variant="outline"
                      type="button"
                      className="text-[var(--lc-status-unpublished-fg)]"
                      aria-label={`Revoke token ${token.name}`}
                      onClick={() => setRevokeId(token.id)}
                      disabled={busyId === token.id}
                    >
                      <Trash2 className="me-2 h-4 w-4" aria-hidden />
                      Revoke
                    </Button>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      ) : null}

      {/* Create dialog */}
      <Dialog
        open={createOpen}
        onOpenChange={(open) => {
          setCreateOpen(open)
          if (!open) {
            setName('')
            setScopes([])
            setExpiresAt('')
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create API token</DialogTitle>
            <DialogDescription>
              Name it after where you'll use it (e.g. "Zapier — inquiries"). You'll see the token
              exactly once.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-[var(--lc-space-md)]">
            <div>
              <Label htmlFor="api-token-name">Name</Label>
              <Input
                id="api-token-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Zapier — inquiries"
                maxLength={120}
              />
            </div>
            <div>
              <p className="mb-[var(--lc-space-xs)]" style={{ font: 'var(--lc-type-body-sm)' }}>
                Scopes (leave empty for full access)
              </p>
              <div className="grid grid-cols-1 gap-[var(--lc-space-xs)]">
                {AVAILABLE_SCOPES.map((scope) => (
                  <label
                    key={scope.value}
                    className="flex items-center gap-[var(--lc-space-sm)] rounded-[var(--lc-radius-sm)] border border-[var(--lc-border)] px-[var(--lc-space-sm)] py-[var(--lc-space-2xs)]"
                  >
                    <input
                      type="checkbox"
                      checked={scopes.includes(scope.value)}
                      onChange={() => toggleScope(scope.value)}
                      className="h-4 w-4 accent-[var(--lc-action-primary)]"
                    />
                    <span>{scope.label}</span>
                  </label>
                ))}
              </div>
            </div>
            <div>
              <Label htmlFor="api-token-expires">Expires (optional)</Label>
              <Input
                id="api-token-expires"
                type="date"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
              />
            </div>
          </div>
          <div className="flex justify-end gap-[var(--lc-space-sm)]">
            <Button type="button" variant="ghost" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button type="button" disabled={!name.trim() || creating} onClick={() => void submitCreate()}>
              {creating ? (
                <>
                  <Loader2 className="me-2 h-4 w-4 animate-spin" aria-hidden />
                  Creating…
                </>
              ) : (
                'Create token'
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* One-time raw display */}
      <Dialog
        open={Boolean(rawToken)}
        onOpenChange={(open) => {
          if (!open) {
            setRawToken(null)
            setRawCopied(false)
            setCreateOpen(false)
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Copy your token now</DialogTitle>
            <DialogDescription>
              This is the only time WingCaster will show you this token. If you lose it, revoke it
              and create a new one.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-[var(--lc-space-md)]">
            <div
              role="alert"
              className="flex items-start gap-[var(--lc-space-sm)] rounded-[var(--lc-radius-md)] bg-[var(--lc-status-warning-bg)] px-[var(--lc-space-md)] py-[var(--lc-space-sm)] text-[var(--lc-status-warning-fg)]"
            >
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <p>Store this token somewhere secure now. Treat it like a password.</p>
            </div>
            <div className="rounded-[var(--lc-radius-md)] border border-[var(--lc-border-strong)] bg-[var(--lc-surface-sunken)] p-[var(--lc-space-md)] font-[family-name:var(--lc-font-mono)] break-all">
              {rawToken}
            </div>
            <Button type="button" onClick={() => void copyRaw()}>
              <Copy className="me-2 h-4 w-4" aria-hidden />
              {rawCopied ? 'Copied ✓' : 'Copy to clipboard'}
            </Button>
          </div>
          <div className="flex justify-end">
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setRawToken(null)
                setCreateOpen(false)
              }}
            >
              I've saved it
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Revoke confirm */}
      <Dialog open={Boolean(revokeId)} onOpenChange={(open) => !open && setRevokeId(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Revoke this token?</DialogTitle>
            <DialogDescription>
              Any integration using it will start failing immediately. You cannot un-revoke — create
              a new token and rotate.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-[var(--lc-space-sm)]">
            <Button type="button" variant="ghost" onClick={() => setRevokeId(null)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => revokeId && void confirmRevoke(revokeId)}
            >
              Revoke token
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
