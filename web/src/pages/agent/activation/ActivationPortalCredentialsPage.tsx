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
import { useLocale } from '@/hooks/useLocale'
import { usePageTitle } from '@/lib/usePageTitle'
import { fetchConnectedPortals, savePortalCredentials } from './api'
import { ActivationChrome } from './components/ActivationChrome'
import { act, at, countryDisplayName, PORTAL_LOCKED_HELPER, type ActivationLocale } from './copy'
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

function friendlyError(errorClass: string | undefined, portalName: string, locale: ActivationLocale): string {
  switch (errorClass) {
    case 'invalid_credentials':
      return act('portal.error.invalid', locale)
    case 'portal_down':
      return act('portal.error.down', locale, { portal: portalName })
    case 'quota_exceeded':
      return act('portal.error.quota', locale, { portal: portalName })
    default:
      return act('portal.error.generic', locale, { portal: portalName })
  }
}

export function ActivationPortalCredentialsPage() {
  const { locale: rawLocale } = useLocale()
  const locale = (rawLocale === 'ar' ? 'ar' : 'en') as ActivationLocale
  usePageTitle(act('portal.pageTitle', locale))
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
  const countryName = countryDisplayName(state?.country_code, locale)

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
        breadcrumb={{ step: 3, title: act('portal.breadcrumb', locale) }}
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
      breadcrumb={{ step: 3, title: act('portal.breadcrumb', locale) }}
      completed={completedCount}
      total={totalCount}
      progressSize="sm"
      maxWidthClass="max-w-[720px]"
    >
      <h1
        className="mb-[var(--lc-space-sm)] text-[var(--lc-text-heading)]"
        style={{ font: 'var(--lc-type-heading-1)' }}
      >
        {act('portal.h1', locale)}
      </h1>
      <p className="mb-[var(--lc-space-md)] text-[var(--lc-text-muted)]" style={{ font: 'var(--lc-type-body-lg)' }}>
        {act('portal.sub', locale)}
      </p>
      <p className="mb-[var(--lc-space-lg)] text-[var(--lc-text-muted)]" style={{ font: 'var(--lc-type-caption)' }}>
        {act('portal.countryPill', locale, { country: countryName })}{' '}
        <button
          type="button"
          className="min-h-tap text-[var(--lc-text-brand)] hover:underline"
          onClick={() => setCountryOpen(true)}
        >
          {act('portal.wrongCountry', locale)}
        </button>
      </p>

      {alreadyComplete ? (
        <p className="mb-[var(--lc-space-lg)] text-[var(--lc-text-muted)]" style={{ font: 'var(--lc-type-caption)' }}>
          <Numeric>{completedCaption(step?.completed_via, step?.completed_at, locale)}</Numeric>.{' '}
          {act('common.nothingTodo', locale)}
        </p>
      ) : null}

      {empty ? (
        <div
          data-portal-locked="true"
          className="mb-[var(--lc-space-lg)] rounded-[var(--lc-radius-lg)] border border-dashed border-[var(--lc-border)] bg-[var(--lc-surface-raised)] p-[var(--lc-space-xl)] opacity-60"
        >
          <p className="mb-[var(--lc-space-sm)] text-[var(--lc-text-muted)]">
            {act('portal.empty', locale, { country: countryName })}
          </p>
          <p className="mb-[var(--lc-space-md)] text-[var(--lc-text-muted)]" style={{ font: 'var(--lc-type-caption)' }}>
            {at(PORTAL_LOCKED_HELPER, locale)}
          </p>
          <Button type="button" variant="ghost" disabled>
            {act('portal.notify', locale)}
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
                    {portal.publisher_config?.description || act('portal.defaultDesc', locale)}
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
                    ? act('portal.state.connected', locale, { masked: masked || 'saved' })
                    : rowState === 'connecting'
                      ? act('portal.state.connecting', locale)
                      : rowState === 'failed'
                        ? act('portal.state.failed', locale)
                        : act('portal.state.not_connected', locale)}
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
                    act('portal.cta.manage', locale)
                  ) : rowState === 'failed' ? (
                    act('portal.cta.retry', locale)
                  ) : (
                    act('portal.cta.connect', locale)
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
            {act('common.returnWizard', locale)}
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
              {act('common.markComplete', locale)}
            </Button>
            {empty ? (
              <p className="text-[var(--lc-text-muted)]" style={{ font: 'var(--lc-type-caption)' }}>
                {act('portal.noPortals', locale)}
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
              {act('common.later', locale)}
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
              {act('portal.tertiary', locale)}
            </Button>
          </>
        )}
      </div>

      <Dialog open={Boolean(drawer)} onOpenChange={(open) => !open && setDrawer(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{act('portal.drawerTitle', locale, { portal: drawer?.display_name || '' })}</DialogTitle>
            <DialogDescription>{act('portal.drawerTrust', locale)}</DialogDescription>
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
                  setFormError(friendlyError(result.error_class, drawer.display_name, locale))
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
                  description: act('portal.success', locale, { portal: drawer.display_name }),
                })
                setDrawer(null)
              } catch (err) {
                addToast({
                  variant: 'error',
                  description: err instanceof Error ? err.message : act('portal.saveError', locale),
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
                {act('common.cancel', locale)}
              </Button>
              <Button type="submit" disabled={rowBusy === drawer?.code}>
                {rowBusy === drawer?.code ? act('portal.drawerTesting', locale) : act('portal.drawerSave', locale)}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={countryOpen} onOpenChange={setCountryOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{act('portal.countryTitle', locale)}</DialogTitle>
            <DialogDescription>{act('portal.countryBody', locale)}</DialogDescription>
          </DialogHeader>
          <div className="mt-[var(--lc-space-lg)] flex justify-end">
            <Button type="button" onClick={() => navigate('/settings/account')}>
              {act('portal.countryCta', locale)}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </ActivationChrome>
  )
}
