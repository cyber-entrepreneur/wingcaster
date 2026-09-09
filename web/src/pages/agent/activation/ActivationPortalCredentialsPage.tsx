import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Building, Circle, CircleDot, CheckCircle2, Loader2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Numeric } from '@/components/ui/numeric'
import { useToast } from '@/components/ui/toast'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { usePageTitle } from '@/lib/usePageTitle'
import { fetchConnectedPortals, savePortalCredentials } from './api'
import { ActivationChrome } from './components/ActivationChrome'
import { countryDisplayName, PORTAL_LOCKED_HELPER } from './copy'
import { completedCaption } from './format'
import type { ConnectedPortal, PortalRegistryEntry } from './types'
import { useActivationState } from './useActivationState'

type RowState = 'not_connected' | 'connecting' | 'connected' | 'failed'

function schemaFields(schema: Record<string, unknown> | undefined): Array<{ name: string; type: string }> {
  if (!schema) {
    return [
      { name: 'username', type: 'text' },
      { name: 'password', type: 'password' },
    ]
  }
  const properties = (schema.properties || schema) as Record<string, { type?: string }>
  if (properties && typeof properties === 'object' && !Array.isArray(properties)) {
    const keys = Object.keys(properties).filter((k) => k !== 'type' && k !== 'description')
    if (keys.length) {
      return keys.map((name) => ({
        name,
        type: name.toLowerCase().includes('password') || name.toLowerCase().includes('secret')
          ? 'password'
          : 'text',
      }))
    }
  }
  return [
    { name: 'username', type: 'text' },
    { name: 'password', type: 'password' },
  ]
}

function friendlyError(errorClass: string | undefined, portalName: string): string {
  switch (errorClass) {
    case 'invalid_credentials':
      return "Those credentials didn't sign in. Check the username/password and retry."
    case 'portal_down':
      return `${portalName} is temporarily unreachable. Try again in a few minutes.`
    case 'quota_exceeded':
      return `Your ${portalName} account is over quota. Increase your plan on their side and retry.`
    default:
      return `We couldn't sign in to ${portalName} with those credentials. Double-check and try again.`
  }
}

export function ActivationPortalCredentialsPage() {
  usePageTitle('Portal credentials')
  const navigate = useNavigate()
  const { addToast } = useToast()
  const { state, isLoading, complete, defer, portals, portalRegistryEmpty, completedCount, totalCount } =
    useActivationState()
  const [connected, setConnected] = useState<ConnectedPortal[]>([])
  const [rowBusy, setRowBusy] = useState<string | null>(null)
  const [drawer, setDrawer] = useState<PortalRegistryEntry | null>(null)
  const [form, setForm] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [countryOpen, setCountryOpen] = useState(false)
  const [failed, setFailed] = useState<Record<string, string>>({})

  const step = state?.steps.find((s) => s.id === 'portal_credentials')
  const alreadyComplete = step?.state === 'complete'
  const countryName = countryDisplayName(state?.country_code)

  useEffect(() => {
    void fetchConnectedPortals().then(setConnected)
  }, [])

  const rows = useMemo(() => {
    return portals.map((portal) => {
      const match = connected.find((c) => c.portal_code === portal.code)
      let rowState: RowState = 'not_connected'
      if (rowBusy === portal.code) rowState = 'connecting'
      else if (failed[portal.code]) rowState = 'failed'
      else if (match?.status === 'connected') rowState = 'connected'
      else if (match?.status === 'failed') rowState = 'failed'
      return { portal, rowState, masked: match?.masked_identifier || null }
    })
  }, [connected, failed, portals, rowBusy])

  const connectedCount = rows.filter((r) => r.rowState === 'connected').length

  const goBack = (nextCompleted?: number) => {
    const total = totalCount
    const prev = completedCount
    const done = nextCompleted ?? completedCount
    const celebrate = total > 0 && prev === total - 1 && done === total
    navigate(celebrate ? '/activate?celebrate=1' : '/activate')
  }

  if (isLoading || !state) {
    return (
      <ActivationChrome
        breadcrumb={{ step: 3, title: 'Add your portal credentials' }}
        completed={0}
        total={0}
        progressSize="sm"
        maxWidthClass="max-w-[720px]"
      >
        <div className="h-40 animate-pulse rounded-[var(--lc-radius-lg)] bg-[var(--lc-surface-sunken)]" />
      </ActivationChrome>
    )
  }

  const empty = portalRegistryEmpty || portals.length === 0

  return (
    <ActivationChrome
      breadcrumb={{ step: 3, title: 'Add your portal credentials' }}
      completed={completedCount}
      total={totalCount}
      progressSize="sm"
      maxWidthClass="max-w-[720px]"
    >
      <h1
        className="mb-[var(--lc-space-sm)] text-[var(--lc-text-heading)]"
        style={{ font: 'var(--lc-type-heading-1)' }}
      >
        Add your portal credentials
      </h1>
      <p className="mb-[var(--lc-space-md)] text-[var(--lc-text-muted)]" style={{ font: 'var(--lc-type-body-lg)' }}>
        Connect the portals you already list on. WingCaster will publish, refresh, and unpublish for you — no more
        copy-paste.
      </p>
      <p className="mb-[var(--lc-space-lg)] text-[var(--lc-text-muted)]" style={{ font: 'var(--lc-type-caption)' }}>
        Portals available in <strong>{countryName}</strong>{' '}
        <button
          type="button"
          className="min-h-tap text-[var(--lc-text-brand)] hover:underline"
          onClick={() => setCountryOpen(true)}
        >
          Wrong country?
        </button>
      </p>

      {alreadyComplete ? (
        <p className="mb-[var(--lc-space-lg)] text-[var(--lc-text-muted)]" style={{ font: 'var(--lc-type-caption)' }}>
          <Numeric>{completedCaption(step?.completed_via, step?.completed_at)}</Numeric>. Nothing to do here.
        </p>
      ) : null}

      {empty ? (
        <div
          data-portal-locked="true"
          className="mb-[var(--lc-space-lg)] rounded-[var(--lc-radius-lg)] border border-dashed border-[var(--lc-border)] bg-[var(--lc-surface-raised)] p-[var(--lc-space-xl)] opacity-60"
        >
          <p className="mb-[var(--lc-space-sm)] text-[var(--lc-text-muted)]">
            We&apos;re still setting up the portal list for <strong>{countryName}</strong>. This step will unlock as soon
            as it&apos;s live — usually within a week.
          </p>
          <p className="mb-[var(--lc-space-md)] text-[var(--lc-text-muted)]" style={{ font: 'var(--lc-type-caption)' }}>
            {PORTAL_LOCKED_HELPER}
          </p>
          <Button type="button" variant="ghost" disabled>
            Notify me when portals are ready
          </Button>
        </div>
      ) : (
        <ul className="space-y-[var(--lc-space-sm)]">
          {rows.map(({ portal, rowState, masked }) => (
            <li
              key={portal.code}
              className="flex flex-col gap-[var(--lc-space-sm)] rounded-[var(--lc-radius-lg)] border border-[var(--lc-border)] bg-[var(--lc-surface-raised)] p-[var(--lc-space-lg)] shadow-[var(--lc-elevation-sm)] sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex items-start gap-[var(--lc-space-md)]">
                <Building className="h-6 w-6 text-[var(--lc-text-heading)]" aria-hidden="true" />
                <div>
                  <h2 style={{ font: 'var(--lc-type-heading-3)' }}>{portal.display_name}</h2>
                  <p className="text-[var(--lc-text-muted)]" style={{ font: 'var(--lc-type-body-sm)' }}>
                    {portal.publisher_config?.description || 'Connect this portal to publish listings.'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-[var(--lc-space-sm)]">
                <span
                  className={
                    rowState === 'connected'
                      ? 'inline-flex items-center gap-1 rounded-[var(--lc-radius-pill)] bg-[var(--lc-status-published-bg)] px-2.5 py-0.5 text-[var(--lc-status-published-fg)]'
                      : rowState === 'failed'
                        ? 'inline-flex items-center gap-1 rounded-[var(--lc-radius-pill)] bg-[var(--lc-status-unpublished-bg)] px-2.5 py-0.5 text-[var(--lc-status-unpublished-fg)]'
                        : rowState === 'connecting'
                          ? 'inline-flex items-center gap-1 rounded-[var(--lc-radius-pill)] bg-[var(--lc-status-underOffer-bg)] px-2.5 py-0.5 text-[var(--lc-status-underOffer-fg)]'
                          : 'inline-flex items-center gap-1 rounded-[var(--lc-radius-pill)] bg-[var(--lc-status-draft-bg)] px-2.5 py-0.5 text-[var(--lc-status-draft-fg)]'
                  }
                  style={{ font: 'var(--lc-type-caption)' }}
                >
                  {rowState === 'connected' ? (
                    <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                  ) : rowState === 'connecting' ? (
                    <CircleDot className="h-3.5 w-3.5" aria-hidden="true" />
                  ) : rowState === 'failed' ? (
                    <X className="h-3.5 w-3.5" aria-hidden="true" />
                  ) : (
                    <Circle className="h-3.5 w-3.5" aria-hidden="true" />
                  )}
                  {rowState === 'connected'
                    ? `Connected · ${masked || 'saved'}`
                    : rowState === 'connecting'
                      ? 'Connecting…'
                      : rowState === 'failed'
                        ? 'Connection failed — retry'
                        : 'Not connected'}
                </span>
                <Button
                  type="button"
                  variant={rowState === 'connected' ? 'outline' : 'default'}
                  disabled={rowState === 'connecting' || alreadyComplete}
                  onClick={() => {
                    setDrawer(portal)
                    setForm({})
                    setFormError(null)
                  }}
                >
                  {rowState === 'connecting' ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  ) : rowState === 'connected' ? (
                    'Manage'
                  ) : rowState === 'failed' ? (
                    'Retry'
                  ) : (
                    'Connect →'
                  )}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-[var(--lc-space-xl)] flex flex-col gap-[var(--lc-space-sm)]">
        {alreadyComplete ? (
          <Button type="button" onClick={() => goBack()}>
            Return to activation wizard →
          </Button>
        ) : (
          <>
            <Button
              type="button"
              disabled={empty || connectedCount < 1}
              onClick={async () => {
                const next = await complete('portal_credentials', 'dashboard_action', {
                  connected_count: connectedCount,
                  portal_codes: rows.filter((r) => r.rowState === 'connected').map((r) => r.portal.code),
                })
                goBack(next.steps.filter((s) => s.state === 'complete').length)
              }}
            >
              Mark step complete →
            </Button>
            {empty ? (
              <p className="text-[var(--lc-text-muted)]" style={{ font: 'var(--lc-type-caption)' }}>
                No portals to connect yet.
              </p>
            ) : null}
            <Button
              type="button"
              variant="ghost"
              onClick={async () => {
                await defer('portal_credentials')
                navigate('/activate')
              }}
            >
              I&apos;ll do this later
            </Button>
            <Button
              type="button"
              variant="link"
              className="text-[var(--lc-text-muted)]"
              onClick={async () => {
                await defer('portal_credentials')
                navigate('/activate')
              }}
            >
              None of these portals are relevant to me
            </Button>
          </>
        )}
      </div>

      <Dialog open={Boolean(drawer)} onOpenChange={(open) => !open && setDrawer(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Connect to {drawer?.display_name}</DialogTitle>
            <DialogDescription>
              Your credentials are encrypted at rest and used only to publish your listings.
            </DialogDescription>
          </DialogHeader>
          <form
            className="mt-[var(--lc-space-md)] space-y-[var(--lc-space-md)]"
            onSubmit={async (event) => {
              event.preventDefault()
              if (!drawer) return
              setRowBusy(drawer.code)
              setFormError(null)
              try {
                const result = await savePortalCredentials(drawer.code, form)
                if (result.error_class || result.status === 'failed') {
                  setFormError(friendlyError(result.error_class, drawer.display_name))
                  setFailed((prev) => ({ ...prev, [drawer.code]: result.error_class || 'failed' }))
                  setRowBusy(null)
                  return
                }
                setConnected((prev) => [
                  ...prev.filter((c) => c.portal_code !== drawer.code),
                  {
                    portal_code: drawer.code,
                    status: 'connected',
                    masked_identifier: result.masked_identifier || form.username || form.email || null,
                  },
                ])
                setFailed((prev) => {
                  const next = { ...prev }
                  delete next[drawer.code]
                  return next
                })
                addToast({
                  variant: 'success',
                  description: `Connected — your ${drawer.display_name} credentials work.`,
                })
                setDrawer(null)
              } catch (err) {
                addToast({
                  variant: 'error',
                  description: err instanceof Error ? err.message : 'Could not save credentials.',
                })
              } finally {
                setRowBusy(null)
              }
            }}
          >
            {schemaFields(drawer?.publisher_config?.credentials_schema).map((field) => (
              <div key={field.name} className="space-y-1">
                <Label htmlFor={`portal-${field.name}`}>{field.name}</Label>
                <Input
                  id={`portal-${field.name}`}
                  type={field.type}
                  value={form[field.name] || ''}
                  onChange={(e) => setForm((prev) => ({ ...prev, [field.name]: e.target.value }))}
                  autoComplete={field.type === 'password' ? 'current-password' : 'username'}
                />
              </div>
            ))}
            {formError ? (
              <p role="alert" className="text-[var(--lc-status-unpublished-fg)]" style={{ font: 'var(--lc-type-body-sm)' }}>
                {formError}
              </p>
            ) : null}
            <div className="flex flex-col-reverse gap-[var(--lc-space-sm)] sm:flex-row sm:justify-end">
              <Button type="button" variant="ghost" onClick={() => setDrawer(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={rowBusy === drawer?.code}>
                {rowBusy === drawer?.code ? 'Testing connection…' : 'Save & test connection →'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={countryOpen} onOpenChange={setCountryOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change your country?</DialogTitle>
            <DialogDescription>
              Your portal list is set from your profile country. Update it in Settings → Account → Region.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-[var(--lc-space-lg)] flex justify-end">
            <Button type="button" onClick={() => navigate('/settings/account')}>
              Open Settings
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </ActivationChrome>
  )
}
