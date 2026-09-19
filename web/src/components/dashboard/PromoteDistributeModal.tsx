import { useEffect, useMemo, useState } from 'react'
import {
  CalendarClock, Check, Coins, Globe, Loader2, Megaphone, Send, Settings, Share2, X,
  Instagram, MessageCircle, Video, Twitter, Facebook, Linkedin,
} from 'lucide-react'
import { SchedulePublishDialog } from '@/components/publishing/SchedulePublishDialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Numeric } from '@/components/ui/numeric'
import { api, type FeatureQuota } from '@/api/client'
import { lcChannelTextClass } from '@/theme/channel'
import { cn } from '@/lib/utils'
import {
  creditCostForPlatform,
  defaultListingCaption,
  totalPublishCredits,
} from '@/lib/publishing/channelPublishHelpers'

export const SOCIAL_PROMOTE_PLATFORMS: string[] = ['instagram', 'facebook', 'linkedin', 'x', 'tiktok', 'telegram']

export const PLATFORM_META: Record<string, { name: string; color: string; icon: typeof Globe; handleHint: string }> = {
  whatsapp: { name: 'WhatsApp Business', color: lcChannelTextClass('whatsapp'), icon: MessageCircle, handleHint: '' },
  instagram: { name: 'Instagram', color: lcChannelTextClass('instagram'), icon: Instagram, handleHint: '@youragency' },
  facebook: { name: 'Facebook Page', color: lcChannelTextClass('facebook'), icon: Facebook, handleHint: 'Page name or numeric page ID' },
  linkedin: { name: 'LinkedIn', color: lcChannelTextClass('linkedin'), icon: Linkedin, handleHint: 'Company page URL or personal profile URL' },
  telegram: { name: 'Telegram', color: lcChannelTextClass('messenger'), icon: Send, handleHint: '@your_channel or channel link' },
  tiktok: { name: 'TikTok', color: lcChannelTextClass('tiktok'), icon: Video, handleHint: '@yourhandle' },
  x: { name: 'X (Twitter)', color: lcChannelTextClass('x'), icon: Twitter, handleHint: '@yourhandle' },
}

type Mode = 'promote' | 'distribute'

/**
 * AGT-PUB-002 — Publish per-channel (Pro or Guided-expanded).
 * Modal / drawer from listing publish flows.
 */
export function PromoteDistributeModal({
  open,
  mode,
  property,
  platforms,
  myConnections,
  fiAccounts,
  whatsappRecipient,
  onClose,
  onDone,
}: {
  open: boolean
  mode: Mode
  property: any
  platforms: any[]
  myConnections: any[]
  fiAccounts: any[]
  whatsappRecipient: string
  onClose: () => void
  onDone: () => void
}) {
  const [selectedOwn, setSelectedOwn] = useState<string[]>([])
  const [selectedFi, setSelectedFi] = useState<string[]>([])
  const [captions, setCaptions] = useState<Record<string, string>>({})
  const [activeCaptionTab, setActiveCaptionTab] = useState<string | null>(null)
  const [fiMessage, setFiMessage] = useState('')
  const [recipient, setRecipient] = useState(whatsappRecipient || '')
  const [loading, setLoading] = useState(false)
  const [quotasLoading, setQuotasLoading] = useState(false)
  const [quotas, setQuotas] = useState<FeatureQuota[]>([])
  const [error, setError] = useState('')
  const [scheduleOpen, setScheduleOpen] = useState(false)

  const baseCaption = useMemo(() => defaultListingCaption(property), [property])

  useEffect(() => {
    if (!open) return
    setSelectedOwn([])
    setSelectedFi([])
    setCaptions({})
    setActiveCaptionTab(null)
    setFiMessage(mode === 'promote' ? 'Please promote this listing on REB pages' : '')
    setRecipient(whatsappRecipient || '')
    setError('')
    setScheduleOpen(false)
    setQuotasLoading(true)
    void api
      .getTenantCreditsBalance()
      .then((bal) => setQuotas(bal.quotas || []))
      .catch(() => setQuotas([]))
      .finally(() => setQuotasLoading(false))
  }, [open, mode, property?.id, whatsappRecipient])

  const connected = useMemo(
    () => myConnections.filter((c) => c.status === 'connected').map((c) => c.platform),
    [myConnections],
  )

  const ownOptions = useMemo(() => {
    if (mode === 'promote') {
      return platforms.filter((p) => SOCIAL_PROMOTE_PLATFORMS.includes(p.id))
    }
    return platforms
  }, [platforms, mode])

  const fiOptions = useMemo(() => {
    if (mode === 'promote') {
      return fiAccounts.filter((a) => SOCIAL_PROMOTE_PLATFORMS.includes(a.platform))
    }
    return fiAccounts
  }, [fiAccounts, mode])

  const totalCredits = useMemo(
    () => totalPublishCredits(selectedOwn, quotas),
    [selectedOwn, quotas],
  )

  const ensureCaption = (platformId: string) => {
    setCaptions((prev) => (prev[platformId] !== undefined ? prev : { ...prev, [platformId]: baseCaption }))
  }

  const toggleOwn = (id: string) => {
    setSelectedOwn((list) => {
      const next = list.includes(id) ? list.filter((x) => x !== id) : [...list, id]
      if (!list.includes(id)) {
        ensureCaption(id)
        setActiveCaptionTab(id)
      } else if (activeCaptionTab === id) {
        setActiveCaptionTab(next[0] || null)
      }
      return next
    })
  }

  const activeCaption = activeCaptionTab || selectedOwn[0] || null
  const activeCaptionValue = activeCaption ? (captions[activeCaption] ?? baseCaption) : baseCaption

  if (!open || !property) return null

  const toggleFi = (id: string) => {
    setSelectedFi((list) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]))
  }

  const handleSubmit = async () => {
    setError('')
    if (selectedOwn.length === 0 && selectedFi.length === 0) {
      setError('Select at least one of your platforms or a REB page.')
      return
    }
    const missing = selectedOwn.filter((p) => !connected.includes(p))
    if (missing.length) {
      setError(`Connect these accounts in Channel Settings first: ${missing.join(', ')}`)
      return
    }
    setLoading(true)
    try {
      if (selectedOwn.length > 0) {
        const captionPayload: Record<string, string> = {}
        for (const p of selectedOwn) {
          captionPayload[p] = (captions[p] || baseCaption).trim() || baseCaption
        }
        const fallbackCaption = selectedOwn.length === 1 ? captionPayload[selectedOwn[0]] : baseCaption
        const rows = await api.distributeOwn(property.id, selectedOwn, {
          mode: 'publish',
          recipient: recipient || undefined,
          caption: fallbackCaption,
          captions: captionPayload,
          intent: mode,
        })
        const failed = (rows || []).filter((r: { status: string }) => r.status === 'failed')
        if (failed.length) {
          setError(failed.map((f: { platform: string; error: string }) => `${f.platform}: ${f.error}`).join('\n'))
          setLoading(false)
          return
        }
      }
      if (selectedFi.length > 0) {
        const fiCaption = selectedOwn.length === 1 ? (captions[selectedOwn[0]] || baseCaption) : baseCaption
        await api.submitToFi(property.id, selectedFi, fiMessage || fiCaption.trim() || baseCaption)
      }
      onDone()
      onClose()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to publish')
    } finally {
      setLoading(false)
    }
  }

  const title = mode === 'promote' ? 'Promote listing' : 'Distribute listing'
  const subtitle =
    mode === 'promote'
      ? 'Choose channels, tailor captions, and review credit cost before publishing.'
      : 'Publish to your channels or submit to REB for review'

  return (
    <div className="fixed inset-0 z-overlay flex items-center justify-center lc-overlay p-4">
      <div
        data-screen="AGT-PUB-002"
        data-testid="publish-per-channel-modal"
        className="flex w-full max-w-xl max-h-[90vh] flex-col rounded-xl bg-[var(--lc-surface)] shadow-xl"
      >
        <div className="flex items-start justify-between gap-3 border-b border-[var(--lc-border)] p-5">
          <div>
            <h3 className="flex items-center gap-2 text-lg font-bold text-[var(--lc-text-primary)]">
              {mode === 'promote' ? <Megaphone className="h-5 w-5" aria-hidden="true" /> : <Share2 className="h-5 w-5" aria-hidden="true" />}
              {title}
            </h3>
            <p className="truncate text-sm text-[var(--lc-text-muted)]">{property.title}</p>
            <p className="mt-1 text-xs text-[var(--lc-text-muted)]">{subtitle}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-full p-1 hover:bg-muted" aria-label="Close">
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto p-5">
          <section>
            <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold text-[var(--lc-text-primary)]">
              <Settings className="h-4 w-4" aria-hidden="true" />
              Your social platforms
            </h4>
            <div className="space-y-2">
              {ownOptions.map((p) => {
                const isConnected = connected.includes(p.id)
                const isSel = selectedOwn.includes(p.id)
                const conn = myConnections.find((c) => c.platform === p.id && c.status === 'connected')
                const Icon = PLATFORM_META[p.id]?.icon || Globe
                const cost = creditCostForPlatform(p.id, quotas)
                return (
                  <button
                    key={p.id}
                    type="button"
                    disabled={!isConnected}
                    onClick={() => isConnected && toggleOwn(p.id)}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-lg border p-3 text-start transition-colors',
                      !isConnected
                        ? 'cursor-not-allowed bg-[var(--lc-surface-sunken)] opacity-60'
                        : isSel
                          ? 'border-[var(--lc-action-primary)] bg-primary-faint'
                          : 'hover:bg-[var(--lc-surface-sunken)]',
                    )}
                  >
                    <div className={cn('rounded-lg p-2', isSel ? 'bg-[var(--lc-action-primary)] text-[var(--lc-action-primary-text)]' : 'bg-muted')}>
                      <Icon className="h-4 w-4" aria-hidden="true" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 text-sm font-medium">
                        <span>{p.name}</span>
                        {isConnected ? (
                          <Badge variant="outline" className="text-[10px] text-emerald-700">Connected</Badge>
                        ) : (
                          <Badge variant="secondary" className="text-[10px]">Not connected</Badge>
                        )}
                        <Badge variant="outline" className="text-[10px]">
                          <Numeric>{cost}</Numeric> cr
                        </Badge>
                      </div>
                      <p className="truncate text-xs text-[var(--lc-text-muted)]">
                        {isConnected
                          ? `Post to ${conn?.account_name || conn?.settings?.handle || 'your account'}`
                          : 'Connect this account under Channel Settings'}
                      </p>
                    </div>
                    {isSel ? <Check className="h-5 w-5 shrink-0" aria-hidden="true" /> : null}
                  </button>
                )
              })}
            </div>
          </section>

          {selectedOwn.includes('whatsapp') && mode === 'distribute' ? (
            <div>
              <Label className="text-sm font-semibold">WhatsApp recipient</Label>
              <Input className="mt-2" placeholder="9617XXXXXXX" value={recipient} onChange={(e) => setRecipient(e.target.value)} />
            </div>
          ) : null}

          {selectedOwn.length > 0 ? (
            <section>
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <Label className="text-sm font-semibold">Caption per channel</Label>
                {selectedOwn.length > 1 ? (
                  <div className="flex flex-wrap gap-1" role="tablist" aria-label="Channel captions">
                    {selectedOwn.map((pid) => {
                      const meta = PLATFORM_META[pid]
                      return (
                        <button
                          key={pid}
                          type="button"
                          role="tab"
                          aria-selected={activeCaption === pid}
                          className={cn(
                            'rounded-pill border px-2.5 py-1 text-xs',
                            activeCaption === pid
                              ? 'border-[var(--lc-action-primary)] bg-[var(--lc-action-primary)] text-[var(--lc-action-primary-text)]'
                              : 'border-[var(--lc-border)] text-[var(--lc-text-muted)]',
                          )}
                          onClick={() => setActiveCaptionTab(pid)}
                        >
                          {meta?.name || pid}
                        </button>
                      )
                    })}
                  </div>
                ) : null}
              </div>
              <textarea
                className="min-h-[88px] w-full rounded-md border border-[var(--lc-border)] bg-[var(--lc-surface)] px-3 py-2 text-sm"
                placeholder={baseCaption}
                value={activeCaptionValue}
                onChange={(e) => {
                  if (!activeCaption) return
                  setCaptions((prev) => ({ ...prev, [activeCaption]: e.target.value }))
                }}
                dir="auto"
              />
              <p className="mt-1 text-xs text-[var(--lc-text-muted)]">
                {activeCaptionValue.length} characters — customize copy per channel when posting to multiple networks.
              </p>
            </section>
          ) : null}

          <div className="relative my-2">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-[var(--lc-border)]" /></div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-[var(--lc-surface)] px-2 text-[var(--lc-text-muted)]">and / or</span>
            </div>
          </div>

          <section>
            <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold">
              <Globe className="h-4 w-4" aria-hidden="true" />
              REB pages
              <span className="text-xs font-normal text-[var(--lc-text-muted)]">(goes to admin review)</span>
            </h4>
            <div className="space-y-2">
              {fiOptions.map((acc) => {
                const isSel = selectedFi.includes(acc.platform)
                const Icon = PLATFORM_META[acc.platform]?.icon || Globe
                return (
                  <button
                    key={acc.id}
                    type="button"
                    onClick={() => toggleFi(acc.platform)}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-lg border p-3 text-start transition-colors',
                      isSel ? 'border-[var(--lc-action-primary)] bg-primary-faint' : 'hover:bg-[var(--lc-surface-sunken)]',
                    )}
                  >
                    <div className={cn('rounded-lg p-2', isSel ? 'bg-[var(--lc-action-primary)] text-[var(--lc-action-primary-text)]' : 'bg-muted')}>
                      <Icon className="h-4 w-4" aria-hidden="true" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium">{acc.account_name}</p>
                      <p className="text-xs text-[var(--lc-text-muted)]">{acc.description}</p>
                    </div>
                    {isSel ? <Check className="h-5 w-5" aria-hidden="true" /> : null}
                  </button>
                )
              })}
            </div>
            {selectedFi.length > 0 ? (
              <div className="mt-3">
                <Label className="text-xs">Note for REB review team</Label>
                <Input className="mt-1" value={fiMessage} onChange={(e) => setFiMessage(e.target.value)} placeholder="e.g. Feature on Instagram this weekend" />
              </div>
            ) : null}
          </section>

          {error ? (
            <div className="whitespace-pre-wrap rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--lc-border)] p-5">
          <div className="flex items-center gap-2 text-sm text-[var(--lc-text-muted)]">
            <Coins className="h-4 w-4" aria-hidden="true" />
            {quotasLoading ? (
              <span>Estimating credits…</span>
            ) : selectedOwn.length > 0 ? (
              <span>
                Total: <Numeric>{totalCredits}</Numeric> credit{totalCredits === 1 ? '' : 's'}
              </span>
            ) : (
              <span>Select channels to see credit cost</span>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} className="min-h-tap">Cancel</Button>
            {selectedOwn.length > 0 ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => setScheduleOpen(true)}
                disabled={loading}
                className="min-h-tap gap-2"
                data-testid="promote-schedule-cta"
              >
                <CalendarClock className="h-4 w-4" aria-hidden="true" />
                Schedule for later
              </Button>
            ) : null}
            <Button
              onClick={() => void handleSubmit()}
              disabled={loading || (selectedOwn.length === 0 && selectedFi.length === 0)}
              className="min-h-tap gap-2 bg-[var(--lc-action-primary)] text-[var(--lc-action-primary-text)] hover:bg-[var(--lc-action-primary-hover)]"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : mode === 'promote' ? <Megaphone className="h-4 w-4" aria-hidden="true" /> : <Send className="h-4 w-4" aria-hidden="true" />}
              {mode === 'promote' ? 'Promote now' : 'Publish'}
            </Button>
          </div>
        </div>
      </div>

      {scheduleOpen && selectedOwn.length > 0 && (
        <SchedulePublishDialog
          propertyId={property.id}
          portals={selectedOwn}
          message={activeCaptionValue.trim() || baseCaption}
          onClose={() => setScheduleOpen(false)}
          onScheduled={() => {
            setScheduleOpen(false)
            onDone()
            onClose()
          }}
        />
      )}
    </div>
  )
}
