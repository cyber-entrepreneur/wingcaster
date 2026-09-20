/**
 * Wave 2A — Paid ad account connection panel (honest pending-approval state).
 */
import { useCallback, useEffect, useState } from 'react'
import { Loader2, Megaphone, Plug } from 'lucide-react'
import { api } from '@/api/client'
import { useToast } from '@/components/ui/toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { lcStatusClasses } from '@/theme/status'

type PaidChannel = {
  platform: string
  kind: string
  approval: { approved: boolean; state: string; message: string }
  connection: { id: string; health: string; provider_account_id?: string | null } | null
  health: string
  honest_state: string
  message: string
}

const PLATFORM_LABELS: Record<string, { name: string; blurb: string }> = {
  meta_ads: {
    name: 'Meta Ads',
    blurb: 'Facebook / Instagram ad account via Meta Marketing API. Live delivery waits on Meta app review.',
  },
  google_ads: {
    name: 'Google Ads',
    blurb: 'Search, Display, Demand Gen (incl. Gmail placement). Gmail is Demand Gen — not an owned-email blast.',
  },
}

function honestBadge(state: string) {
  if (state === 'ready') return { label: 'Ready', className: lcStatusClasses('published') }
  if (state === 'connect_pending_approval') {
    return { label: 'Connect + pending approval', className: lcStatusClasses('underOffer') }
  }
  if (state === 'not_connected') {
    return { label: 'Not connected', className: lcStatusClasses('draft') }
  }
  return { label: state, className: lcStatusClasses('draft') }
}

export function PaidChannelsPanel() {
  const { addToast } = useToast()
  const [channels, setChannels] = useState<PaidChannel[]>([])
  const [loading, setLoading] = useState(true)
  const [accountIds, setAccountIds] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.getPaidAdsChannels()
      setChannels(res.channels || [])
    } catch (err: any) {
      addToast({ title: 'Failed to load paid channels', description: err?.message, variant: 'error' })
    } finally {
      setLoading(false)
    }
  }, [addToast])

  useEffect(() => {
    load()
  }, [load])

  async function connect(platform: string) {
    const accountId = (accountIds[platform] || '').trim()
    if (!accountId) {
      addToast({ title: 'Ad account id required', variant: 'error' })
      return
    }
    setBusy(platform)
    try {
      await api.connectPaidAdsChannel(platform, {
        credentials_ref: `secret:paid:${platform}:${accountId}`,
        provider_account_id: accountId,
        integration_model: 'tenant_oauth',
        data: { platform, note: 'OAuth token exchange lands after provider approval' },
      })
      addToast({
        title: `${PLATFORM_LABELS[platform]?.name || platform} connected`,
        description: 'Live delivery remains pending Meta/Google approval — no fake publish.',
        variant: 'success',
      })
      await load()
    } catch (err: any) {
      addToast({ title: 'Connect failed', description: err?.message, variant: 'error' })
    } finally {
      setBusy(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-6 text-sm text-[var(--lc-text-muted)]">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading paid channels…
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-[var(--lc-text-primary)]">Paid ad accounts</h2>
        <p className="mt-1 text-sm text-[var(--lc-text-muted)]">
          Connect Meta and Google ad accounts. Until business verification and app review complete,
          status stays <span className="font-medium">connect + pending approval</span> — we never fake a publish.
        </p>
      </div>

      {channels.map((ch) => {
        const meta = PLATFORM_LABELS[ch.platform] || { name: ch.platform, blurb: '' }
        const badge = honestBadge(ch.honest_state)
        return (
          <section
            key={ch.platform}
            className="rounded-[var(--lc-radius-md)] border border-[var(--lc-border)] bg-[var(--lc-surface)] p-4"
            aria-label={meta.name}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 rounded-[var(--lc-radius-sm)] bg-[var(--lc-surface-sunken)] p-2">
                  <Megaphone className="h-4 w-4 text-[var(--lc-text-primary)]" aria-hidden />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-medium text-[var(--lc-text-primary)]">{meta.name}</h3>
                    <Badge className={badge.className}>{badge.label}</Badge>
                  </div>
                  <p className="mt-1 max-w-xl text-sm text-[var(--lc-text-muted)]">{meta.blurb}</p>
                  <p className="mt-1 text-xs text-[var(--lc-text-muted)]">{ch.message}</p>
                  {ch.connection?.provider_account_id ? (
                    <p className="mt-1 text-xs text-[var(--lc-text-muted)]">
                      Account: {ch.connection.provider_account_id}
                    </p>
                  ) : null}
                </div>
              </div>
            </div>

            {!ch.connection ? (
              <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
                <div className="flex-1 space-y-1.5">
                  <Label htmlFor={`paid-acct-${ch.platform}`}>
                    {ch.platform === 'meta_ads' ? 'Ad account ID' : 'Customer ID'}
                  </Label>
                  <Input
                    id={`paid-acct-${ch.platform}`}
                    value={accountIds[ch.platform] || ''}
                    onChange={(e) =>
                      setAccountIds((prev) => ({ ...prev, [ch.platform]: e.target.value }))
                    }
                    placeholder={ch.platform === 'meta_ads' ? 'act_123…' : '123-456-7890'}
                    className="bg-[var(--lc-surface-sunken)]"
                  />
                </div>
                <Button
                  type="button"
                  onClick={() => connect(ch.platform)}
                  disabled={busy === ch.platform}
                  className="shrink-0"
                >
                  {busy === ch.platform ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Plug className="mr-2 h-4 w-4" />
                  )}
                  Connect
                </Button>
              </div>
            ) : (
              <p className="mt-3 text-sm text-[var(--lc-text-muted)]">
                Connected · health {ch.health}. Launch stays blocked with{' '}
                <code className="text-xs">PROVIDER_NOT_APPROVED</code> until review lands.
              </p>
            )}
          </section>
        )
      })}
    </div>
  )
}
