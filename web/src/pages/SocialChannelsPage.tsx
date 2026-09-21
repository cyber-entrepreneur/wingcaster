import { useCallback, useEffect, useId, useMemo, useState, type Dispatch, type ReactNode, type SetStateAction } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  ArrowLeft, Check, ChevronDown, ChevronUp, ExternalLink, Facebook, Instagram, Linkedin, Loader2, Lock,
  MessageCircle, Plug, Twitter, Unplug, Video,
} from 'lucide-react'
import { api } from '@/api/client'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/components/ui/toast'
import { usePageTitle } from '@/lib/usePageTitle'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PersonalConnectionsPanel } from '@/components/social-channels/PersonalConnectionsPanel'
import { PaidChannelsPanel } from '@/components/paid-ads/PaidChannelsPanel'
import { useUiMode } from '@/hooks/useUiMode'
import { cn } from '@/lib/utils'

type FieldSpec = { key: string; label: string; required: boolean; secret: boolean }
type ConnectMethod = 'oauth' | 'manual'
type PlatformSpec = {
  model: 'enterprise' | 'oauth'
  supported_methods: ConnectMethod[]
  primary_method: ConnectMethod
  oauth_configured: boolean
  target_fields: FieldSpec[]
}
type TokenStatus = {
  connected: boolean
  method?: ConnectMethod | null
  scope?: string | null
  expires_at?: string | null
  health?: string | null
}
type Connection = {
  id: string
  platform: string
  account_name: string
  status: string
  health: string
  connect_method: ConnectMethod | null
  handle: string | null
  enterprise_targets: Record<string, string>
  token_status: TokenStatus
  updated_at: string | null
}

import { lcChannelTextClass } from '@/theme/channel'

const PLATFORM_META: Record<string, { name: string; icon: any; color: string; description: string; oauthLabel: string }> = {
  facebook: { name: 'Facebook Page', icon: Facebook, color: lcChannelTextClass('facebook'), description: 'Publish page posts + reply to comments and Messenger DMs via Meta Graph.', oauthLabel: 'Facebook' },
  instagram: { name: 'Instagram', icon: Instagram, color: lcChannelTextClass('instagram'), description: 'Publish feed / carousel / reels / stories + reply to DMs and comments.', oauthLabel: 'Instagram' },
  linkedin: { name: 'LinkedIn', icon: Linkedin, color: lcChannelTextClass('linkedin'), description: 'Publish text, image, and article posts to a page or personal profile.', oauthLabel: 'LinkedIn' },
  whatsapp: { name: 'WhatsApp Business', icon: MessageCircle, color: lcChannelTextClass('whatsapp'), description: 'Send template messages and Status broadcasts via WhatsApp Cloud API.', oauthLabel: 'WhatsApp' },
  x: { name: 'X (Twitter)', icon: Twitter, color: lcChannelTextClass('x'), description: 'Publish tweets, reply to mentions, and DM leads.', oauthLabel: 'X' },
  tiktok: { name: 'TikTok', icon: Video, color: lcChannelTextClass('tiktok'), description: 'Publish photo carousels and vertical video via the Content Posting API.', oauthLabel: 'TikTok' },
}

const PLATFORM_ORDER = ['facebook', 'instagram', 'linkedin', 'whatsapp', 'x', 'tiktok']

function formatTokenExpiry(expiresAt: string | null | undefined) {
  if (!expiresAt) return null
  const date = new Date(expiresAt)
  if (Number.isNaN(date.getTime())) return null
  return date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

export function SocialChannelsPage() {
  const { agent, loading: authLoading } = useAuth()
  const { addToast } = useToast()
  const { shouldRenderPro } = useUiMode()
  const [searchParams, setSearchParams] = useSearchParams()
  usePageTitle('Social Channels')

  const [config, setConfig] = useState<Record<string, PlatformSpec> | null>(null)
  const [connections, setConnections] = useState<Connection[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [cfg, conns] = await Promise.all([
        api.getSocialChannelsConfig(),
        api.getSocialChannels(),
      ])
      setConfig(cfg.connection_fields as Record<string, PlatformSpec>)
      setConnections(conns as Connection[])
    } catch (err: any) {
      addToast({ title: 'Failed to load channels', description: err?.message, variant: 'error' })
    } finally {
      setLoading(false)
    }
  }, [addToast])

  useEffect(() => {
    if (!authLoading && agent) load()
  }, [authLoading, agent, load])

  useEffect(() => {
    function onMessage(evt: MessageEvent) {
      if (evt.data?.type === 'wingcaster:oauth:done') {
        addToast({ title: `Connected to ${evt.data.platform}`, variant: 'success' })
        load()
      }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [addToast, load])

  const connectionByPlatform = useMemo(() => {
    const map: Record<string, Connection> = {}
    for (const c of connections) map[c.platform] = c
    return map
  }, [connections])
  const activeTab =
    searchParams.get('tab') === 'paid'
      ? 'paid'
      : shouldRenderPro && searchParams.get('tab') === 'accounts'
        ? 'accounts'
        : 'channels'

  if (authLoading || loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[var(--lc-text-muted)]" />
      </div>
    )
  }

  if (!agent) {
    return (
      <div className="mx-auto max-w-lg py-16 text-center">
        <h1 className="text-2xl font-semibold">Sign in to manage channels</h1>
        <Link to="/login" className="mt-3 inline-block"><Button>Sign in</Button></Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-4 flex items-center gap-2 text-sm text-[var(--lc-text-muted)]">
        <Link to="/dashboard" className="inline-flex items-center gap-1 hover:text-[var(--lc-text-primary)]">
          <ArrowLeft className="h-4 w-4" /> Dashboard
        </Link>
        <span>·</span>
        <span>Settings</span>
      </div>

      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Social channels</h1>
        <p className="mt-1 text-sm text-[var(--lc-text-muted)]">
          Connect each channel to publish under your identity. OAuth is the recommended path where available;
          manual credentials remain available as a fallback.
        </p>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(value) => {
          const next = new URLSearchParams(searchParams)
          if (value === 'accounts') next.set('tab', 'accounts')
          else if (value === 'paid') next.set('tab', 'paid')
          else next.delete('tab')
          setSearchParams(next, { replace: true })
        }}
      >
        <TabsList className={`grid w-full sm:w-auto ${shouldRenderPro ? 'grid-cols-3' : 'grid-cols-2'}`}>
          <TabsTrigger value="channels">Channel setup</TabsTrigger>
          <TabsTrigger value="paid">Paid ads</TabsTrigger>
          {shouldRenderPro ? <TabsTrigger value="accounts">My accounts</TabsTrigger> : null}
        </TabsList>
        <TabsContent value="channels" className="mt-4">
          <div className="space-y-4">
            {PLATFORM_ORDER.map((platform) => {
              const spec = config?.[platform]
              if (!spec) return null
              return (
                <PlatformCard
                  key={platform}
                  platform={platform}
                  spec={spec}
                  connection={connectionByPlatform[platform] || null}
                  onChanged={load}
                />
              )
            })}
          </div>
        </TabsContent>
        <TabsContent value="paid" className="mt-4">
          <PaidChannelsPanel />
        </TabsContent>
        {shouldRenderPro ? (
          <TabsContent value="accounts" className="mt-4">
            <PersonalConnectionsPanel />
          </TabsContent>
        ) : null}
      </Tabs>
    </div>
  )
}

function ManualConnectionForm({
  spec,
  connection,
  values,
  setValues,
  busy,
  onSave,
}: {
  spec: PlatformSpec
  connection: Connection | null
  values: Record<string, string>
  setValues: Dispatch<SetStateAction<Record<string, string>>>
  busy: boolean
  onSave: () => void
}) {
  return (
    <div className="space-y-3">
      {spec.target_fields.map((f) => {
        const fieldId = `manual-${f.key}`
        return (
        <div key={f.key}>
          <Label htmlFor={fieldId} className="flex items-center gap-1 text-xs">
            {f.label}
            {f.required && <span className="text-[var(--lc-status-danger-fg)]">*</span>}
            {f.secret && (
              <span title="Encrypted at rest" className="inline-flex">
                <Lock className="h-3 w-3 text-[var(--lc-text-muted)]" />
              </span>
            )}
          </Label>
          <Input
            id={fieldId}
            type={f.secret ? 'password' : 'text'}
            value={values[f.key] || ''}
            onChange={(e) => setValues((prev) => ({ ...prev, [f.key]: e.target.value }))}
            placeholder={f.secret ? (connection?.enterprise_targets?.[f.key] ? '(unchanged)' : '') : ''}
            className="mt-1"
          />
        </div>
        )
      })}
      <div className="flex justify-end pt-1">
        <Button size="sm" onClick={onSave} disabled={busy} className="gap-1.5">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          Save
        </Button>
      </div>
    </div>
  )
}

function ManualFallbackCollapsible({
  open,
  onOpenChange,
  disabled,
  children,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  disabled?: boolean
  children: ReactNode
}) {
  const panelId = useId()
  return (
    <div className="rounded-[var(--lc-radius-md)] border border-[var(--lc-border)] bg-[var(--lc-surface-raised)]">
      <button
        type="button"
        className={cn(
          'flex w-full min-h-[var(--lc-tap-target-min)] items-center justify-between gap-2',
          'px-[var(--lc-space-md)] py-[var(--lc-space-sm)] text-start',
          'text-[var(--lc-text-primary)]',
        )}
        aria-expanded={open}
        aria-controls={panelId}
        disabled={disabled}
        onClick={() => onOpenChange(!open)}
      >
        <span className="text-sm">Connect manually instead</span>
        {open ? (
          <ChevronUp className="h-4 w-4 shrink-0" aria-hidden />
        ) : (
          <ChevronDown className="h-4 w-4 shrink-0" aria-hidden />
        )}
      </button>
      <div
        id={panelId}
        hidden={!open}
        className="border-t border-[var(--lc-border)] px-[var(--lc-space-md)] py-[var(--lc-space-md)]"
      >
        {open ? children : null}
      </div>
    </div>
  )
}

function PlatformCard({
  platform, spec, connection, onChanged,
}: {
  platform: string
  spec: PlatformSpec
  connection: Connection | null
  onChanged: () => void
}) {
  const { addToast } = useToast()
  const meta = PLATFORM_META[platform] || {
    name: platform,
    icon: Plug,
    color: 'text-[var(--lc-text-muted)]',
    description: '',
    oauthLabel: platform,
  }
  const Icon = meta.icon
  const [manualOpen, setManualOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [values, setValues] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {}
    for (const f of spec.target_fields) {
      initial[f.key] = connection?.enterprise_targets?.[f.key] || ''
    }
    return initial
  })

  useEffect(() => {
    const next: Record<string, string> = {}
    for (const f of spec.target_fields) {
      next[f.key] = connection?.enterprise_targets?.[f.key] || ''
    }
    setValues(next)
  }, [connection, spec.target_fields])

  const isConnected = connection?.status === 'connected'
  const tokenStatus = connection?.token_status
  const needsReauth = isConnected && (connection?.health === 'reauth_required' || tokenStatus?.health === 'reauth_required')
  const oauthAvailable = spec.supported_methods.includes('oauth') && spec.oauth_configured
  const oauthPrimary = oauthAvailable && spec.primary_method === 'oauth'
  const manualPrimary = !oauthPrimary
  const expiryLabel = formatTokenExpiry(tokenStatus?.expires_at)
  const connectMethodLabel = connection?.connect_method || tokenStatus?.method

  async function saveEnterprise() {
    if (busy) return
    for (const f of spec.target_fields) {
      if (f.required && !f.secret && !values[f.key]?.trim()) {
        addToast({ title: `${f.label} is required`, variant: 'error' })
        return
      }
    }
    setBusy(true)
    try {
      await api.upsertSocialChannel(platform, { enterprise_targets: values })
      addToast({ title: `${meta.name} saved`, variant: 'success' })
      onChanged()
      setManualOpen(false)
    } catch (err: any) {
      addToast({ title: 'Save failed', description: err?.message, variant: 'error' })
    } finally {
      setBusy(false)
    }
  }

  async function startOAuth() {
    if (busy) return
    setBusy(true)
    try {
      const r = await api.startSocialOAuth(platform)
      const popup = window.open(r.auth_url, `oauth_${platform}`, 'width=600,height=750')
      if (!popup) {
        addToast({
          title: 'Popup blocked',
          description: `Open the connect URL manually: ${r.auth_url}`,
          variant: 'warning',
        })
      } else if (r.dev) {
        setTimeout(onChanged, 1500)
      }
    } catch (err: any) {
      addToast({ title: 'Could not start OAuth', description: err?.message, variant: 'error' })
    } finally {
      setBusy(false)
    }
  }

  async function disconnect() {
    if (busy || !isConnected) return
    if (!window.confirm(`Disconnect ${meta.name}? You'll need to re-enter details / re-authorise to reconnect.`)) return
    setBusy(true)
    try {
      await api.disconnectSocialChannel(platform)
      addToast({ title: `${meta.name} disconnected`, variant: 'success' })
      onChanged()
    } catch (err: any) {
      addToast({ title: 'Disconnect failed', description: err?.message, variant: 'error' })
    } finally {
      setBusy(false)
    }
  }

  const showOAuthButton = oauthAvailable && (!isConnected || connectMethodLabel === 'oauth' || needsReauth)
  const oauthButtonLabel = needsReauth || (isConnected && connectMethodLabel === 'oauth')
    ? 'Re-authorise'
    : `Connect with ${meta.oauthLabel}`

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
        <div className="flex items-start gap-3">
          <Icon className={`h-6 w-6 ${meta.color}`} />
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle className="text-base">{meta.name}</CardTitle>
              {isConnected ? (
                <Badge
                  className="gap-1 border-[var(--lc-status-success-fg)] bg-[var(--lc-status-success-bg)] text-[var(--lc-status-success-fg)]"
                  variant="outline"
                >
                  <Check className="h-3 w-3" /> Connected
                </Badge>
              ) : (
                <Badge variant="outline">Not connected</Badge>
              )}
              {manualPrimary ? (
                <Badge variant="outline" className="text-[10px]">manual connection</Badge>
              ) : (
                <Badge variant="outline" className="text-[10px]">OAuth recommended</Badge>
              )}
            </div>
            <p className="mt-1 text-xs text-[var(--lc-text-muted)]">{meta.description}</p>
            {isConnected && connection?.handle && (
              <p className="mt-1 text-xs text-[var(--lc-text-primary)]">
                Connected as <span className="font-medium">{connection.handle}</span>
              </p>
            )}
            {isConnected && tokenStatus?.scope && (
              <p className="mt-1 text-xs text-[var(--lc-text-muted)]">
                Scope: <span className="font-[family-name:var(--lc-font-mono)]">{tokenStatus.scope}</span>
              </p>
            )}
            {isConnected && expiryLabel && (
              <p className="mt-1 text-xs text-[var(--lc-text-muted)]">
                Token expires: {expiryLabel}
              </p>
            )}
            {needsReauth && (
              <p
                role="alert"
                className="mt-2 rounded-[var(--lc-radius-sm)] bg-[var(--lc-status-warning-bg)] px-2 py-1 text-xs text-[var(--lc-status-warning-fg)]"
              >
                Re-authorisation required — your token expired or was revoked.
              </p>
            )}
          </div>
        </div>
        <div className="flex flex-shrink-0 flex-wrap items-center justify-end gap-2">
          {showOAuthButton && (
            <Button
              size="sm"
              variant={needsReauth ? 'default' : (isConnected ? 'outline' : 'default')}
              className="gap-1.5"
              onClick={startOAuth}
              disabled={busy}
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />}
              {oauthButtonLabel}
            </Button>
          )}
          {manualPrimary && (
            <Button
              size="sm"
              variant={isConnected ? 'outline' : 'default'}
              className="gap-1.5"
              onClick={() => setManualOpen((open) => !open)}
              disabled={busy}
            >
              <Plug className="h-4 w-4" />
              {manualOpen ? 'Cancel' : (isConnected ? 'Edit' : 'Set up')}
            </Button>
          )}
          {isConnected && (
            <Button
              size="sm"
              variant="ghost"
              className="gap-1.5 text-[var(--lc-status-danger-fg)]"
              onClick={disconnect}
              disabled={busy}
            >
              <Unplug className="h-4 w-4" />
              Disconnect
            </Button>
          )}
        </div>
      </CardHeader>

      {oauthPrimary && (
        <CardContent className="space-y-3 pt-0">
          <ManualFallbackCollapsible open={manualOpen} onOpenChange={setManualOpen} disabled={busy}>
            <ManualConnectionForm
              spec={spec}
              connection={connection}
              values={values}
              setValues={setValues}
              busy={busy}
              onSave={saveEnterprise}
            />
          </ManualFallbackCollapsible>
        </CardContent>
      )}

      {manualPrimary && manualOpen && (
        <CardContent className="space-y-3 pt-0">
          <ManualConnectionForm
            spec={spec}
            connection={connection}
            values={values}
            setValues={setValues}
            busy={busy}
            onSave={saveEnterprise}
          />
        </CardContent>
      )}

      {manualPrimary && !isConnected && !manualOpen && spec.target_fields.length > 0 && (
        <CardContent className="pt-0">
          <p className="text-xs text-[var(--lc-text-muted)]">
            Enter your platform credentials to connect manually.
          </p>
        </CardContent>
      )}
    </Card>
  )
}
