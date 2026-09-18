/**
 * AGT-CMP-004 — Campaign detail + performance.
 *
 * One campaign's live status + analytics: header (name, status, channel,
 * trigger, target size), KPI strip (enrolled / sent / replied / converted /
 * completed), delivery + per-channel + per-step breakdowns, and the enrollment
 * table (rows link to the contact 360). Actions: Pause / Resume / Duplicate /
 * Cancel. Entry from AGT-CMP-001; exit back to it.
 */
import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowLeft,
  Ban,
  CheckCircle2,
  Copy,
  Loader2,
  Mail,
  Megaphone,
  MessageSquare,
  Pause,
  Phone,
  Play,
  Reply,
  Send,
  SkipForward,
  TrendingUp,
  Users,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Numeric } from '@/components/ui/numeric'
import { useToast } from '@/components/ui/toast'
import { useAuth } from '@/context/AuthContext'
import { api, type CampaignStats } from '@/api/client'
import { usePageTitle } from '@/lib/usePageTitle'
import { cn } from '@/lib/utils'
import { CrmShell } from '@/components/layout/CrmShell'
import { CmdKpiStrip } from '@/components/layout/CmdKpiStrip'
import { CmdEmptyState } from '@/components/layout/CmdEmptyState'

interface Campaign {
  id: string
  name: string
  description: string
  status: 'draft' | 'active' | 'paused' | 'archived'
  trigger: string
  target_channel: string
  steps: CampaignStep[]
  tags_filter: string[]
  created_at: string
  updated_at: string
}

interface CampaignStep {
  step_index: number
  delay_hours: number
  channel: string
  template_id: string | null
  subject: string
  body: string
}

const STATUS_STYLE: Record<string, string> = {
  draft: 'border-slate-200 bg-slate-50 text-slate-600',
  active: 'border-green-200 bg-green-50 text-green-700',
  paused: 'border-amber-200 bg-amber-50 text-amber-700',
  archived: 'border-slate-200 bg-slate-50 text-slate-400',
}

const ENROLLMENT_STATUS_STYLE: Record<string, string> = {
  active: 'border-green-200 bg-green-50 text-green-700',
  completed: 'border-blue-200 bg-blue-50 text-blue-700',
  paused: 'border-amber-200 bg-amber-50 text-amber-700',
  cancelled: 'border-slate-200 bg-slate-50 text-slate-400',
}

const CHANNEL_ICON: Record<string, React.ReactNode> = {
  email: <Mail className="h-3.5 w-3.5" />,
  whatsapp: <MessageSquare className="h-3.5 w-3.5" />,
  sms: <Phone className="h-3.5 w-3.5" />,
}

function formatDateTime(value: string | null): string {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export function CampaignDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { agent } = useAuth()
  const agentId = agent?.id
  const { addToast } = useToast()
  const navigate = useNavigate()
  usePageTitle('Campaign detail')

  const [campaign, setCampaign] = useState<Campaign | null>(null)
  const [stats, setStats] = useState<CampaignStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    setError(null)
    try {
      const [c, s] = await Promise.all([api.getCampaign(id), api.getCampaignStats(id)])
      setCampaign(c as Campaign)
      setStats(s)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load campaign')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    if (agentId) void load()
  }, [agentId, load])

  const setStatus = async (next: Campaign['status'], successMsg: string) => {
    if (!campaign) return
    setBusy(true)
    try {
      await api.updateCampaign(campaign.id, { status: next })
      setCampaign({ ...campaign, status: next })
      addToast({ title: successMsg, variant: 'success' })
    } catch (e) {
      addToast({ title: 'Update failed', description: e instanceof Error ? e.message : undefined, variant: 'error' })
    } finally {
      setBusy(false)
    }
  }

  const handleToggle = () => {
    if (!campaign) return
    if (campaign.status === 'active') void setStatus('paused', 'Campaign paused')
    else void setStatus('active', 'Campaign activated')
  }

  const handleDuplicate = async () => {
    if (!campaign) return
    setBusy(true)
    try {
      const copy = (await api.createCampaign({
        name: `${campaign.name} (copy)`,
        description: campaign.description,
        status: 'draft',
        trigger: campaign.trigger,
        tags_filter: campaign.tags_filter,
        target_channel: campaign.target_channel,
        steps: campaign.steps,
      })) as Campaign
      addToast({ title: 'Campaign duplicated', description: 'A draft copy was created.', variant: 'success' })
      navigate(`/campaigns/${copy.id}`)
    } catch (e) {
      addToast({ title: 'Duplicate failed', description: e instanceof Error ? e.message : undefined, variant: 'error' })
    } finally {
      setBusy(false)
    }
  }

  const handleCancel = async () => {
    if (!campaign) return
    if (!confirm(`Cancel "${campaign.name}"? Active enrollments will stop advancing.`)) return
    await setStatus('archived', 'Campaign cancelled')
  }

  const totals = stats?.totals
  const targetChannel = campaign?.target_channel ?? 'email'

  return (
    <CrmShell>
      {/* Header */}
      <div className="flex min-h-14 shrink-0 flex-wrap items-center gap-3 border-b border-[var(--lc-border)] bg-[var(--lc-surface)] px-4 py-3 sm:px-6">
        <Link to="/campaigns" aria-label="Back to campaigns">
          <Button variant="outline" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--lc-surface-sunken)] text-muted-foreground">
          {CHANNEL_ICON[targetChannel] ?? <Megaphone className="h-4 w-4" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h1
              className="truncate leading-none"
              style={{ font: 'var(--lc-type-heading-3)', letterSpacing: 'var(--lc-tracking-heading-3)', color: 'var(--lc-text-heading)' }}
            >
              {campaign?.name ?? (loading ? 'Loading…' : 'Campaign')}
            </h1>
            {campaign && (
              <Badge variant="outline" className={cn('text-[10px] capitalize', STATUS_STYLE[campaign.status])}>
                {campaign.status}
              </Badge>
            )}
          </div>
          {campaign && (
            <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
              <span className="capitalize">{targetChannel}</span>
              <span aria-hidden>·</span>
              <span className="capitalize">{campaign.trigger.replace(/_/g, ' ')}</span>
              <span aria-hidden>·</span>
              <span>
                <Numeric>{totals?.enrolled ?? 0}</Numeric> enrolled
              </span>
            </div>
          )}
        </div>
        {campaign && campaign.status !== 'archived' && (
          <div className="flex shrink-0 items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleToggle} disabled={busy} className="gap-1.5">
              {campaign.status === 'active' ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
              {campaign.status === 'active' ? 'Pause' : 'Resume'}
            </Button>
            <Button variant="outline" size="sm" onClick={handleDuplicate} disabled={busy} className="gap-1.5">
              <Copy className="h-3.5 w-3.5" /> Duplicate
            </Button>
            <Button variant="destructive" size="sm" onClick={handleCancel} disabled={busy} className="gap-1.5">
              <Ban className="h-3.5 w-3.5" /> Cancel
            </Button>
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex flex-1 items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <CmdEmptyState
          icon={<AlertTriangle className="h-8 w-8" />}
          title="Couldn't load this campaign"
          description={error}
          action={
            <Button size="sm" onClick={() => void load()}>
              Try again
            </Button>
          }
        />
      ) : !campaign || !stats || !totals ? (
        <CmdEmptyState
          icon={<Megaphone className="h-8 w-8" />}
          title="Campaign not found"
          description="This campaign may have been deleted."
          action={
            <Link to="/campaigns">
              <Button size="sm">Back to campaigns</Button>
            </Link>
          }
        />
      ) : (
        <>
          <CmdKpiStrip
            items={[
              { label: 'Enrolled', value: totals.enrolled, icon: <Users className="h-4 w-4 text-muted-foreground" /> },
              { label: 'Messages sent', value: totals.sent, icon: <Send className="h-4 w-4 text-muted-foreground" /> },
              {
                label: 'Replied',
                value: totals.replied,
                valueClass: totals.replied > 0 ? 'text-green-700' : undefined,
                icon: <Reply className="h-4 w-4 text-muted-foreground" />,
              },
              {
                label: 'Converted',
                value: totals.converted,
                valueClass: totals.converted > 0 ? 'text-green-700' : undefined,
                icon: <TrendingUp className="h-4 w-4 text-muted-foreground" />,
              },
              { label: 'Completed', value: totals.completed, icon: <CheckCircle2 className="h-4 w-4 text-muted-foreground" /> },
            ]}
          />

          <div className="flex-1 space-y-6 overflow-y-auto p-4 sm:p-6">
            {/* Delivery + lifecycle breakdown */}
            <section className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-[var(--lc-border)] bg-[var(--lc-surface)] p-4">
                <h2 className="mb-3 text-sm font-semibold">Delivery</h2>
                <dl className="grid grid-cols-2 gap-3">
                  <Stat label="Sent" value={totals.sent} icon={<Send className="h-3.5 w-3.5" />} />
                  <Stat label="Delivered" value={totals.delivered} icon={<CheckCircle2 className="h-3.5 w-3.5" />} />
                  <Stat
                    label="Failed"
                    value={totals.failed}
                    valueClass={totals.failed > 0 ? 'text-[var(--lc-status-unpublished-fg)]' : undefined}
                    icon={<AlertTriangle className="h-3.5 w-3.5" />}
                  />
                  <Stat label="Skipped" value={totals.skipped} icon={<SkipForward className="h-3.5 w-3.5" />} />
                </dl>
              </div>
              <div className="rounded-xl border border-[var(--lc-border)] bg-[var(--lc-surface)] p-4">
                <h2 className="mb-3 text-sm font-semibold">Enrollment lifecycle</h2>
                <dl className="grid grid-cols-2 gap-3">
                  <Stat label="Active" value={totals.active} />
                  <Stat label="Completed" value={totals.completed} />
                  <Stat label="Paused" value={totals.paused} />
                  <Stat label="Cancelled" value={totals.cancelled} />
                </dl>
              </div>
            </section>

            {/* Per-channel breakdown */}
            {stats.channels.length > 0 && (
              <section>
                <h2 className="mb-2 text-sm font-semibold">By channel</h2>
                <div className="overflow-hidden rounded-xl border border-[var(--lc-border)]">
                  <BreakdownHeader />
                  {stats.channels.map((ch) => (
                    <div
                      key={ch.channel}
                      className="grid grid-cols-[1.5fr_1fr_1fr_1fr_1fr] items-center gap-2 border-t border-[var(--lc-border)] bg-[var(--lc-surface)] px-4 py-2.5 text-sm"
                    >
                      <span className="flex items-center gap-2 capitalize">
                        <span className="text-muted-foreground">{CHANNEL_ICON[ch.channel] ?? <Megaphone className="h-3.5 w-3.5" />}</span>
                        {ch.channel}
                      </span>
                      <Numeric className="text-end">{ch.sent}</Numeric>
                      <Numeric className="text-end">{ch.delivered}</Numeric>
                      <Numeric className={cn('text-end', ch.failed > 0 && 'text-[var(--lc-status-unpublished-fg)]')}>{ch.failed}</Numeric>
                      <Numeric className="text-end">{ch.skipped}</Numeric>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Per-step breakdown */}
            {stats.steps.length > 0 && (
              <section>
                <h2 className="mb-2 text-sm font-semibold">By step</h2>
                <div className="space-y-2">
                  {stats.steps.map((s) => (
                    <div
                      key={s.step_index}
                      className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border border-[var(--lc-border)] bg-[var(--lc-surface)] px-4 py-2.5 text-sm"
                    >
                      <span className="flex items-center gap-2 font-medium">
                        <span className="text-muted-foreground">{CHANNEL_ICON[s.channel] ?? <Megaphone className="h-3.5 w-3.5" />}</span>
                        Step <Numeric>{s.step_index + 1}</Numeric>
                      </span>
                      {s.delay_hours != null && (
                        <span className="text-[11px] text-muted-foreground">
                          +<Numeric>{s.delay_hours}</Numeric>h delay
                        </span>
                      )}
                      <span className="flex-1" />
                      <span className="text-[11px] text-muted-foreground">
                        <Numeric>{s.sent}</Numeric> sent
                      </span>
                      {s.failed > 0 && (
                        <span className="text-[11px] text-[var(--lc-status-unpublished-fg)]">
                          <Numeric>{s.failed}</Numeric> failed
                        </span>
                      )}
                      {s.skipped > 0 && (
                        <span className="text-[11px] text-muted-foreground">
                          <Numeric>{s.skipped}</Numeric> skipped
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Enrollment table */}
            <section>
              <h2 className="mb-2 text-sm font-semibold">
                Enrollments <span className="text-muted-foreground">(<Numeric>{stats.enrollments.length}</Numeric>)</span>
              </h2>
              {stats.enrollments.length === 0 ? (
                <div className="rounded-xl border border-dashed border-[var(--lc-border)] bg-[var(--lc-surface)] px-4 py-10 text-center text-sm text-muted-foreground">
                  No contacts are enrolled in this campaign yet.
                </div>
              ) : (
                <div className="overflow-hidden rounded-xl border border-[var(--lc-border)]">
                  {stats.enrollments.map((e) => (
                    <div
                      key={e.id}
                      className="grid grid-cols-[1.5fr_0.8fr_0.7fr_1fr] items-center gap-2 border-t border-[var(--lc-border)] bg-[var(--lc-surface)] px-4 py-3 text-sm first:border-t-0"
                    >
                      <div className="min-w-0">
                        {e.contact_id ? (
                          <Link to={`/contacts/${e.contact_id}`} className="truncate font-medium text-[var(--lc-text-brand)] hover:underline">
                            {e.contact_name}
                          </Link>
                        ) : (
                          <span className="truncate font-medium">{e.contact_name}</span>
                        )}
                      </div>
                      <Badge variant="outline" className={cn('w-fit text-[10px] capitalize', ENROLLMENT_STATUS_STYLE[e.status])}>
                        {e.status}
                      </Badge>
                      <span className="text-[11px] text-muted-foreground">
                        Step <Numeric>{e.current_step_index + 1}</Numeric>
                        {stats.step_count > 0 && (
                          <>
                            {' / '}
                            <Numeric>{stats.step_count}</Numeric>
                          </>
                        )}
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        {e.status === 'active' && e.next_run_at
                          ? `Next: ${formatDateTime(e.next_run_at)}`
                          : e.last_sent_at
                            ? `Last: ${formatDateTime(e.last_sent_at)}`
                            : `Started: ${formatDateTime(e.started_at)}`}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        </>
      )}
    </CrmShell>
  )
}

function Stat({
  label,
  value,
  valueClass,
  icon,
}: {
  label: string
  value: number
  valueClass?: string
  icon?: React.ReactNode
}) {
  return (
    <div className="flex items-center gap-2">
      {icon && <span className="text-muted-foreground">{icon}</span>}
      <div>
        <Numeric as="p" className={cn('text-lg font-bold leading-none', valueClass)}>
          {value}
        </Numeric>
        <p className="mt-0.5 text-[11px] text-muted-foreground">{label}</p>
      </div>
    </div>
  )
}

function BreakdownHeader() {
  return (
    <div className="grid grid-cols-[1.5fr_1fr_1fr_1fr_1fr] gap-2 bg-[var(--lc-surface-sunken)] px-4 py-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
      <span>Channel</span>
      <span className="text-end">Sent</span>
      <span className="text-end">Delivered</span>
      <span className="text-end">Failed</span>
      <span className="text-end">Skipped</span>
    </div>
  )
}
