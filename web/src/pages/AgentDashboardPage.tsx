import { useEffect, useState, useCallback, type ComponentProps } from 'react'
import { Link } from 'react-router-dom'
import {
  Building2, TrendingUp, Eye, MessageSquare, Plus, Edit, Trash2, Star, Phone, Mail, Loader2,
  Share2, ExternalLink, Check, X, Globe, Send, BarChart3, Plug, PauseCircle, PlayCircle,
  AlertTriangle, Layers, Filter, DollarSign, Users, Settings, CheckCircle2, Clock, XCircle,
  ChevronDown, ChevronUp, Inbox, RefreshCw, Bell
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { useAuth, type Agent } from '@/context/AuthContext'
import { useLocale } from '@/hooks/useLocale'
import { useOnboardingState } from '@/hooks/useOnboardingState'
import {
  OnboardingChecklistWidget,
  shouldRenderOnboardingChecklist,
} from '@/pages/agent/onboarding'
import {
  ONB_DISCARD_TOAST_KEY,
  ONB_SKIP_TOAST_KEY,
  readSessionFlag,
  writeSessionFlag,
} from '@/pages/agent/onboarding/helpers'
import { t as onbT } from '@/pages/agent/onboarding/copy'
import { api, type InboxConversation } from '@/api/client'
import { useToast } from '@/components/ui/toast'
import { usePageTitle } from '@/lib/usePageTitle'
import { apiErrorMessage } from '@/lib/http-status'
import type { Property } from '@/types'
import type {
  DashboardStats,
  DashboardAnalytics,
  DashboardOperations,
  NotificationPrefs,
  DistributionPlatform,
  AgentConnection,
  FiAccount,
  DistributionPerformance,
  DistributionSubmission,
  WhatsAppStatus,
  AgentEngagement,
  InquiryListItem,
  InquiryListResponse,
  ViewingRow,
  InquiryTimeline,
} from '@/types/dashboard'
import { ListingFormModal } from '@/components/ListingFormModal'
import { KpiAnalyticsPanel } from '@/components/dashboard/KpiAnalyticsPanel'
import { ListingRow } from '@/components/dashboard/ListingRow'
import { PromoteDistributeModal, PLATFORM_META, SOCIAL_PROMOTE_PLATFORMS } from '@/components/dashboard/PromoteDistributeModal'
import { useUiMode } from '@/hooks/useUiMode'
import { TryProNudgeBanner } from '@/components/dashboard/TryProNudgeBanner'
import { ProDashboard } from '@/pages/agent/dashboard/ProDashboard'

// Wave-8 Pro dashboard (AGT-DSH-002)
export { ProDashboard } from '@/pages/agent/dashboard/ProDashboard'

type DistT = Awaited<ReturnType<typeof api.getDistributions>>[number]
type DistQueueRow = DistT & {
  owner_type?: string
  created_at?: string
  error?: string
  meta?: { retry_attempts?: number; next_retry_at?: string }
}
type TimelineFollowUp = { id: string; label?: string; due_at?: string; status?: string }
type TimelineActivity = { id: string; type?: string; created_at?: string; actor_name?: string }
type ClientNotifiedInfo = { channel?: string; sent_at?: string }

function asClientNotified(value: unknown): ClientNotifiedInfo | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const rec = value as Record<string, unknown>
  return {
    channel: typeof rec.channel === 'string' ? rec.channel : undefined,
    sent_at: typeof rec.sent_at === 'string' ? rec.sent_at : undefined,
  }
}
type AgentOnboardingFields = {
  onboarding_status?: string
  onboarding_stage?: string
  onboarding_steps?: Record<string, boolean>
}
type PropertyWithClicks = Property & { clicks?: number }

function agentUiMode(agent: Agent | null | undefined): string {
  const raw = agent?.ui_mode ?? agent?.uiMode
  return typeof raw === 'string' && raw.trim() ? raw.trim() : 'guided'
}

type Zone3Urgent = { label: string; title: string; sub?: string; to?: string }

function dashboardZone3Urgent(input: {
  inquiries: InquiryListItem[]
  operations: DashboardOperations | null
  queuedDistributions: DistQueueRow[]
}): Zone3Urgent | null {
  const lead = input.inquiries.find((i) => i.status === 'new' || Boolean((i as InquiryListItem & { sla_overdue?: boolean }).sla_overdue))
  if (lead) {
    const overdue = Boolean((lead as InquiryListItem & { sla_overdue?: boolean }).sla_overdue)
    return {
      label: overdue ? 'SLA OVERDUE' : 'NEW LEAD',
      title: `${lead.name || 'A client'} asked about ${lead.property_title || 'a listing'}`,
      sub: lead.message ? String(lead.message) : undefined,
      to: '/dashboard/inbox',
    }
  }
  const sla = Number(input.operations?.sla_breached_count || 0)
  if (sla > 0) {
    return {
      label: 'SLA BREACHED',
      title: `${sla} conversation${sla === 1 ? '' : 's'} need a reply`,
      to: '/dashboard/inbox',
    }
  }
  const overdue = Number(input.operations?.tasks?.overdue_count ?? input.operations?.overdue_follow_ups ?? 0)
  if (overdue > 0) {
    return {
      label: 'OVERDUE TASKS',
      title: `${overdue} task${overdue === 1 ? '' : 's'} overdue`,
      to: '/tasks',
    }
  }
  const failed = input.queuedDistributions.find((d) => d.status === 'failed')
  if (failed) {
    return {
      label: 'PUBLISH FAILED',
      title: `We couldn't post to ${failed.platform || 'a channel'}`,
    }
  }
  return null
}

export function AgentDashboardPage() {
  const { agent, loading: authLoading } = useAuth()
  const { effectiveMode, mode, isProCapable } = useUiMode()
  usePageTitle('Dashboard')

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!agent) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold">Please sign in</h2>
          <p className="text-muted-foreground">You need to be logged in to view your dashboard</p>
          <Link to="/login"><Button className="mt-4">Sign In</Button></Link>
        </div>
      </div>
    )
  }

  // AGT-DSH-002 — Pro shell at ≥768px + ui_mode=pro (D-S-06).
  if (effectiveMode === 'pro') {
    return <ProDashboard />
  }

  return (
    <GuidedAgentDashboard
      showMobileProChip={mode === 'pro' && !isProCapable}
    />
  )
}

function GuidedAgentDashboard({ showMobileProChip }: { showMobileProChip: boolean }) {
  const { agent, isAdmin, updateProfile, loading: authLoading } = useAuth()
  const { addToast } = useToast()
  const { isArabic } = useLocale()
  const onboarding = useOnboardingState()

  useEffect(() => {
    const locale = isArabic ? 'ar' : 'en'
    if (readSessionFlag(ONB_SKIP_TOAST_KEY) === '1') {
      writeSessionFlag(ONB_SKIP_TOAST_KEY, '')
      try {
        sessionStorage.removeItem(ONB_SKIP_TOAST_KEY)
      } catch {
        /* private mode */
      }
      addToast({ description: onbT('welcome.toast.skip', locale) })
    }
    if (readSessionFlag(ONB_DISCARD_TOAST_KEY) === '1') {
      writeSessionFlag(ONB_DISCARD_TOAST_KEY, '')
      try {
        sessionStorage.removeItem(ONB_DISCARD_TOAST_KEY)
      } catch {
        /* private mode */
      }
      addToast({ description: onbT('review.toast.discard', locale) })
    }
  }, [addToast, isArabic])

  const [activeTab, setActiveTab] = useState('listings')
  const [myListings, setMyListings] = useState<Property[]>([])
  const [inquiries, setInquiries] = useState<InquiryListItem[]>([])
  const [inquiriesCursor, setInquiriesCursor] = useState<string | null>(null)
  const [hasMoreInquiries, setHasMoreInquiries] = useState(false)
  const [inquiriesLoadingMore, setInquiriesLoadingMore] = useState(false)
  const [inquiriesFilter, setInquiriesFilter] = useState({ status: '', stage: '', priority: '' })
  const [viewings, setViewings] = useState<ViewingRow[]>([])
  const [stats, setStats] = useState({ listings: 0, totalViews: 0, inquiries: 0 })
  const [operations, setOperations] = useState<DashboardOperations | null>(null)
  const [notificationPrefs, setNotificationPrefs] = useState<NotificationPrefs | null>(null)
  const [prefsSaving, setPrefsSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  // Distribution hub state
  const [platforms, setPlatforms] = useState<DistributionPlatform[]>([])
  const [myConnections, setMyConnections] = useState<AgentConnection[]>([])
  const [fiAccounts, setFiAccounts] = useState<FiAccount[]>([])
  const [distributions, setDistributions] = useState<Record<string, DistT[]>>({})
  const [mySubmissions, setMySubmissions] = useState<DistributionSubmission[]>([])
  const [performance, setPerformance] = useState<DistributionPerformance | null>(null)
  const [adminSubmissions, setAdminSubmissions] = useState<DistributionSubmission[]>([])

  // Modal state
  const [distModal, setDistModal] = useState<{ open: boolean; property: Property | null; mode: 'promote' | 'distribute' }>({
    open: false,
    property: null,
    mode: 'distribute',
  })
  const [listingModal, setListingModal] = useState<{ open: boolean; property: Property | null }>({ open: false, property: null })

  // Settings state
  const [connecting, setConnecting] = useState<string | null>(null)
  const [connectHandles, setConnectHandles] = useState<Record<string, string>>({})
  const [whatsappRecipient, setWhatsappRecipient] = useState('')
  const [whatsappStatus, setWhatsappStatus] = useState<WhatsAppStatus | null>(null)

  // Profile form
  const [profileForm, setProfileForm] = useState({ name: '', email: '', phone: '', bio: '' })
  const [profileSaving, setProfileSaving] = useState(false)
  const [profileMsg, setProfileMsg] = useState('')
  const [engagement, setEngagement] = useState<AgentEngagement | null>(null)
  const [analytics, setAnalytics] = useState<DashboardAnalytics | null>(null)
  const [selectedMetric, setSelectedMetric] = useState<'listings' | 'views' | 'avg' | 'inquiries' | null>(null)
  const [inboxUnread, setInboxUnread] = useState(0)
  const [retryingDistributionId, setRetryingDistributionId] = useState<string | null>(null)
  const [bulkRetrying, setBulkRetrying] = useState(false)
  const [schedulingInquiryId, setSchedulingInquiryId] = useState<string | null>(null)
  const [scheduleForm, setScheduleForm] = useState<Record<string, { scheduled_at: string; mode: 'in_person' | 'virtual'; location: string; notes: string }>>({})

  const [viewingAction, setViewingAction] = useState<{
    viewingId: string | null
    mode: 'reschedule' | 'complete' | 'cancel' | null
    scheduled_at: string
    notify_client: boolean
    notify_channel: 'email' | 'whatsapp' | 'sms'
    outcome: string
    outcome_notes: string
  }>({
    viewingId: null,
    mode: null,
    scheduled_at: '',
    notify_client: false,
    notify_channel: 'email',
    outcome: 'interested',
    outcome_notes: '',
  })
  const [timelineInquiryId, setTimelineInquiryId] = useState<string | null>(null)
  const [timeline, setTimeline] = useState<InquiryTimeline | null>(null)
  const [timelineLoading, setTimelineLoading] = useState(false)

  const refreshAll = useCallback(() => {
    setLoading(true)
    Promise.all([
      api.getProperties({}),
      api.getInquiries({ limit: '50' }).catch((err: unknown) => { addToast({ title: 'Inquiries unavailable', description: apiErrorMessage(err), variant: 'error' }); return { items: [] } }),
      api.getViewings().catch((err: unknown) => { addToast({ title: 'Viewings unavailable', description: apiErrorMessage(err), variant: 'error' }); return [] }),
      api.getDashboardStats().catch((err: unknown) => { addToast({ title: 'Stats unavailable', description: apiErrorMessage(err), variant: 'error' }); return { listings: 0, totalViews: 0, inquiries: 0 } }),
      api.getDashboardOperations().catch((err: unknown) => { addToast({ title: 'Operations summary unavailable', description: apiErrorMessage(err), variant: 'error' }); return null }),
      api.getNotificationPrefs().catch((err: unknown) => { addToast({ title: 'Notification preferences unavailable', description: apiErrorMessage(err), variant: 'error' }); return null }),
      api.getPlatforms().catch((err: unknown) => { addToast({ title: 'Platforms unavailable', description: apiErrorMessage(err), variant: 'error' }); return [] }),
      api.getMyConnections().catch((err: unknown) => { addToast({ title: 'Connections unavailable', description: apiErrorMessage(err), variant: 'error' }); return [] }),
      api.getFiAccounts().catch((err: unknown) => { addToast({ title: 'REB channels unavailable', description: apiErrorMessage(err), variant: 'error' }); return [] }),
      api.getDistributionPerformance().catch((err: unknown) => { addToast({ title: 'Performance unavailable', description: apiErrorMessage(err), variant: 'error' }); return null }),
      api.getMySubmissions().catch((err: unknown) => { addToast({ title: 'Submissions unavailable', description: apiErrorMessage(err), variant: 'error' }); return [] }),
      isAdmin ? api.getAdminSubmissions().catch((err: unknown) => { addToast({ title: 'Admin queue unavailable', description: apiErrorMessage(err), variant: 'error' }); return [] }) : Promise.resolve([]),
      api.getWhatsAppStatus().catch((err: unknown) => { addToast({ title: 'WhatsApp status unavailable', description: apiErrorMessage(err), variant: 'error' }); return null }),
      api.getAgentEngagement(agent!.id).catch((err: unknown) => { addToast({ title: 'Engagement unavailable', description: apiErrorMessage(err), variant: 'error' }); return null }),
      api.getDashboardAnalytics().catch((err: unknown) => { addToast({ title: 'Analytics unavailable', description: apiErrorMessage(err), variant: 'error' }); return null }),
      api.getConversations().catch((err: unknown) => { addToast({ title: 'Inbox unavailable', description: apiErrorMessage(err), variant: 'error' }); return [] }),
    ]).then(([allProps, inqs, viewingsRows, dashboardStats, ops, prefs, pls, conns, fiAccs, perf, subs, adminSubs, waStatus, eng, dashAnalytics, conversations]) => {
      // fetch/JSON boundary — client methods are untyped
      const allPropsList = (Array.isArray(allProps) ? allProps : []) as Property[]
      const mine = allPropsList.filter((p: Property) => p.agent_id === agent!.id)
      const inquiryItems = (inqs as InquiryListResponse)?.items ?? (Array.isArray(inqs) ? inqs as InquiryListItem[] : [])
      const inqsResp = inqs as InquiryListResponse
      setMyListings(mine)
      setInquiries(inquiryItems)
      setInquiriesCursor(inqsResp?.next_cursor || null)
      setHasMoreInquiries(Boolean(inqsResp?.has_more))
      setViewings(Array.isArray(viewingsRows) ? viewingsRows as ViewingRow[] : [])
      const statsPayload = dashboardStats as DashboardStats
      setStats({
        listings: statsPayload.listings ?? statsPayload.totalListings ?? mine.length,
        totalViews: statsPayload.totalViews ?? 0,
        inquiries: statsPayload.inquiries ?? statsPayload.totalInquiries ?? inquiryItems.length,
      })
      setOperations(ops as DashboardOperations | null)
      setNotificationPrefs(prefs as NotificationPrefs | null)
      setPlatforms((Array.isArray(pls) ? pls : []) as DistributionPlatform[])
      const connsList = (Array.isArray(conns) ? conns : []) as AgentConnection[]
      setMyConnections(connsList)
      setFiAccounts((Array.isArray(fiAccs) ? fiAccs : []) as FiAccount[])
      setPerformance(perf as DistributionPerformance | null)
      setMySubmissions(Array.isArray(subs) ? subs as DistributionSubmission[] : [])
      setAdminSubmissions((Array.isArray(adminSubs) ? adminSubs : []) as DistributionSubmission[])
      setWhatsappStatus(waStatus as WhatsAppStatus | null)
      setEngagement(eng as AgentEngagement | null)
      setAnalytics(dashAnalytics as DashboardAnalytics | null)
      const conversationList = (Array.isArray(conversations) ? conversations : []) as InboxConversation[]
      setInboxUnread(conversationList.reduce((sum: number, c: InboxConversation) => sum + (c.unread_count || 0), 0))
      const waConn = connsList.find((c: AgentConnection) => c.platform === 'whatsapp')
      if (waConn?.settings?.notify_number) setWhatsappRecipient(waConn.settings.notify_number)

      mine.forEach((p: Property) => {
        api.getDistributions(p.id).then((rows: DistT[]) => {
          setDistributions(prev => ({ ...prev, [p.id]: rows }))
        }).catch((err: unknown) => {
          addToast({ title: `Distributions unavailable for ${p.title || p.id}`, description: apiErrorMessage(err), variant: 'error' })
        })
      })
      setLoading(false)
    }).catch((err: unknown) => {
      setLoading(false)
      addToast({ title: 'Failed to load dashboard', description: apiErrorMessage(err, 'Could not load dashboard data'), variant: 'error' })
    })
  }, [agent, isAdmin, addToast])

  useEffect(() => {
    if (!agent) return
    setProfileForm({
      name: agent.name || '',
      email: agent.email || '',
      phone: agent.phone || '',
      bio: String(agent.bio || ''),
    })
    refreshAll()
  }, [agent, refreshAll])

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!agent) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold">Please sign in</h2>
          <p className="text-muted-foreground">You need to be logged in to view your dashboard</p>
          <Link to="/login"><Button className="mt-4">Sign In</Button></Link>
        </div>
      </div>
    )
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this listing?')) return
    try {
      await api.deleteProperty(id)
      setMyListings(prev => prev.filter(p => p.id !== id))
      addToast({ title: 'Listing deleted', variant: 'success' })
    } catch (e: unknown) {
      addToast({ title: 'Failed to delete listing', description: apiErrorMessage(e, 'Could not delete listing'), variant: 'error' })
    }
  }

  const handleConnect = async (platform: string) => {
    const handle = (connectHandles[platform] || '').trim()
    if (platform !== 'whatsapp' && !handle) return
    setConnecting(platform)
    try {
      const settings = platform === 'whatsapp'
        ? { notify_number: whatsappRecipient.replace(/\D/g, ''), approval_required: false }
        : { handle }
      await api.connectMyPlatform({
        platform,
        account_name: platform === 'whatsapp' ? 'WhatsApp Business' : handle,
        handle,
        settings,
      })
      const conns = await api.getMyConnections()
      setMyConnections(conns as AgentConnection[])
      setConnectHandles((prev) => ({ ...prev, [platform]: '' }))
      if (platform === 'whatsapp') {
        const status = await api.getWhatsAppStatus().catch((err: unknown) => {
          addToast({ title: 'WhatsApp status unavailable', description: apiErrorMessage(err), variant: 'error' })
          return null
        })
        setWhatsappStatus(status as WhatsAppStatus | null)
      }
      addToast({ title: 'Connected', description: `${platform} connected successfully.`, variant: 'success' })
    } catch (e: unknown) {
      addToast({ title: 'Connection failed', description: apiErrorMessage(e, 'Could not connect platform'), variant: 'error' })
    } finally {
      setConnecting(null)
    }
  }

  const handleSaveWhatsAppRecipient = async (connectionId: string) => {
    try {
      await api.updateMyConnection(connectionId, {
        settings: { notify_number: whatsappRecipient.replace(/\D/g, '') },
      })
      const conns = await api.getMyConnections()
      setMyConnections(conns as AgentConnection[])
      addToast({ title: 'WhatsApp recipient saved', variant: 'success' })
    } catch (e: unknown) {
      addToast({ title: 'Failed to save recipient', description: apiErrorMessage(e, 'Could not save recipient'), variant: 'error' })
    }
  }

  const handleDisconnect = async (id: string) => {
    if (!confirm('Disconnect this account?')) return
    try {
      await api.disconnectMyPlatform(id)
      setMyConnections(prev => prev.filter(c => c.id !== id))
      addToast({ title: 'Disconnected', variant: 'success' })
    } catch (e: unknown) {
      addToast({ title: 'Failed to disconnect', description: apiErrorMessage(e, 'Could not disconnect platform'), variant: 'error' })
    }
  }

  const openPromoteModal = (property: Property, mode: 'promote' | 'distribute' = 'promote') => {
    setDistModal({ open: true, property, mode })
  }

  const handleApprove = async (id: string) => {
    try {
      await api.approveSubmission(id, 'Approved by admin')
      refreshAll()
      addToast({ title: 'Submission approved', variant: 'success' })
    } catch (e: unknown) {
      addToast({ title: 'Failed to approve', description: apiErrorMessage(e, 'Could not approve submission'), variant: 'error' })
    }
  }

  const handleReject = async (id: string) => {
    try {
      await api.rejectSubmission(id, 'Not suitable for REB channels')
      refreshAll()
      addToast({ title: 'Submission rejected', variant: 'success' })
    } catch (e: unknown) {
      addToast({ title: 'Failed to reject', description: apiErrorMessage(e, 'Could not reject submission'), variant: 'error' })
    }
  }

  const handleSaveProfile = async () => {
    setProfileSaving(true)
    setProfileMsg('')
    try {
      await updateProfile({
        name: profileForm.name,
        phone: profileForm.phone,
        bio: profileForm.bio,
      })
      setProfileMsg('Profile saved.')
      addToast({ title: 'Profile saved', variant: 'success' })
    } catch (e: unknown) {
      setProfileMsg(apiErrorMessage(e, 'Failed to save profile'))
      addToast({ title: 'Failed to save profile', description: apiErrorMessage(e, 'Could not save profile'), variant: 'error' })
    } finally {
      setProfileSaving(false)
    }
  }

  const handleStatusChange = async (id: string, status: string) => {
    try {
      const updated = await api.updateProperty(id, { status })
      setMyListings((prev) => prev.map((p) => (p.id === id ? { ...p, ...(updated as Property), status } : p)))
      const dashAnalytics = await api.getDashboardAnalytics().catch((err: unknown) => {
        addToast({ title: 'Analytics refresh failed', description: apiErrorMessage(err), variant: 'error' })
        return null
      })
      setAnalytics(dashAnalytics as DashboardAnalytics | null)
      addToast({ title: 'Status updated', variant: 'success' })
    } catch (e: unknown) {
      addToast({ title: 'Failed to update status', description: apiErrorMessage(e, 'Could not update status'), variant: 'error' })
    }
  }

  const handleInquiryPatch = async (inquiryId: string, patch: Record<string, unknown>) => {
    try {
      const updated = await api.updateInquiry(inquiryId, patch)
      setInquiries((prev) => prev.map((i) => (i.id === inquiryId ? { ...i, ...(updated as InquiryListItem) } : i)))
      addToast({ title: 'Inquiry updated', variant: 'success' })
    } catch (e: unknown) {
      addToast({ title: 'Failed to update inquiry', description: apiErrorMessage(e, 'Could not update inquiry'), variant: 'error' })
    }
  }

  const handleScheduleViewing = async (inq: InquiryListItem) => {
    const current = scheduleForm[inq.id]
    if (!current?.scheduled_at) {
      addToast({ title: 'Schedule required', description: 'Please select viewing date and time.', variant: 'error' })
      return
    }
    try {
      const created = await api.createViewing({
        inquiry_id: inq.id,
        property_id: inq.property_id,
        scheduled_at: new Date(current.scheduled_at).toISOString(),
        mode: current.mode || 'in_person',
        location: current.location || '',
        notes: current.notes || '',
      }) as ViewingRow
      setViewings((prev) => [created, ...prev])
      setInquiries((prev) => prev.map((i) => i.id === inq.id ? {
        ...i,
        status: 'scheduled_viewing',
        stage: 'viewing',
        next_viewing_at: created.scheduled_at,
        viewings_count: Number(i.viewings_count || 0) + 1,
      } : i))
      setSchedulingInquiryId(null)
      addToast({ title: 'Viewing scheduled', variant: 'success' })
    } catch (e: unknown) {
      addToast({ title: 'Failed to schedule viewing', description: apiErrorMessage(e, 'Could not schedule viewing'), variant: 'error' })
    }
  }

  const handleUpdateViewing = async (viewingId: string, patch: Record<string, unknown>) => {
    try {
      await api.updateViewing(viewingId, patch)
      await refreshAll()
      setViewingAction({
        viewingId: null,
        mode: null,
        scheduled_at: '',
        notify_client: false,
        notify_channel: 'email',
        outcome: 'interested',
        outcome_notes: '',
      })
      addToast({ title: 'Viewing updated', variant: 'success' })
    } catch (e: unknown) {
      addToast({ title: 'Failed to update viewing', description: apiErrorMessage(e, 'Could not update viewing'), variant: 'error' })
    }
  }

  const loadTimeline = async (inquiryId: string | null) => {
    setTimelineInquiryId(inquiryId)
    if (!inquiryId) {
      setTimeline(null)
      return
    }
    setTimelineLoading(true)
    try {
      // fetch/JSON boundary — client methods are untyped
      const data = await api.getInquiryTimeline(inquiryId) as InquiryTimeline
      setTimeline(data)
    } catch (e: unknown) {
      addToast({ title: 'Failed to load timeline', description: apiErrorMessage(e, 'Could not load timeline'), variant: 'error' })
      setTimeline(null)
    } finally {
      setTimelineLoading(false)
    }
  }

  const handleRetryDistribution = async (distributionId: string) => {
    setRetryingDistributionId(distributionId)
    try {
      // fetch/JSON boundary — client methods are untyped
      const updated = await api.retryDistribution(distributionId) as DistT
      setDistributions((prev) => {
        const next = { ...prev }
        Object.keys(next).forEach((propertyId) => {
          next[propertyId] = (next[propertyId] || []).map((d: DistT) => (d.id === distributionId ? updated : d))
        })
        return next
      })
      addToast({
        title: updated.status === 'published' ? 'Distribution retried successfully' : 'Retry attempted',
        description: `${updated.platform} is now ${updated.status}.`,
        variant: updated.status === 'published' ? 'success' : 'error',
      })
    } catch (e: unknown) {
      addToast({ title: 'Retry failed', description: apiErrorMessage(e, 'Could not retry distribution'), variant: 'error' })
    } finally {
      setRetryingDistributionId(null)
    }
  }

  const handleRetryPendingBatch = async () => {
    setBulkRetrying(true)
    try {
      const result = await api.retryPendingDistributions(25) as { processed?: number }
      const processed = Number(result?.processed || 0)
      if (processed > 0) {
        await refreshAll()
      }
      addToast({
        title: 'Retry queue processed',
        description: processed > 0 ? `${processed} queued deliveries were retried.` : 'No queued deliveries were ready to retry.',
        variant: 'success',
      })
    } catch (e: unknown) {
      addToast({ title: 'Bulk retry failed', description: apiErrorMessage(e, 'Could not process retry queue'), variant: 'error' })
    } finally {
      setBulkRetrying(false)
    }
  }

  const loadMoreInquiries = async () => {
    if (!hasMoreInquiries || !inquiriesCursor || inquiriesLoadingMore) return
    setInquiriesLoadingMore(true)
    try {
      const params: Record<string, string> = { limit: '50', cursor: inquiriesCursor }
      if (inquiriesFilter.status) params.status = inquiriesFilter.status
      if (inquiriesFilter.stage) params.stage = inquiriesFilter.stage
      if (inquiriesFilter.priority) params.priority = inquiriesFilter.priority
      const data = await api.getInquiries(params) as InquiryListResponse
      const items = data?.items || []
      setInquiries((prev) => [...prev, ...items])
      setInquiriesCursor(data?.next_cursor || null)
      setHasMoreInquiries(Boolean(data?.has_more))
    } catch (e: unknown) {
      addToast({ title: 'Failed to load more inquiries', description: apiErrorMessage(e, 'Could not load inquiries'), variant: 'error' })
    } finally {
      setInquiriesLoadingMore(false)
    }
  }

  const applyInquiryFilters = async () => {
    try {
      const params: Record<string, string> = { limit: '50' }
      if (inquiriesFilter.status) params.status = inquiriesFilter.status
      if (inquiriesFilter.stage) params.stage = inquiriesFilter.stage
      if (inquiriesFilter.priority) params.priority = inquiriesFilter.priority
      const data = await api.getInquiries(params) as InquiryListResponse
      setInquiries(data?.items || [])
      setInquiriesCursor(data?.next_cursor || null)
      setHasMoreInquiries(Boolean(data?.has_more))
    } catch (e: unknown) {
      addToast({ title: 'Failed to filter inquiries', description: apiErrorMessage(e, 'Could not filter inquiries'), variant: 'error' })
    }
  }

  const handleSaveNotificationPrefs = async (next: Partial<NotificationPrefs>) => {
    setPrefsSaving(true)
    try {
      // fetch/JSON boundary — client methods are untyped
      const saved = await api.updateNotificationPrefs(next as Record<string, unknown>) as NotificationPrefs
      setNotificationPrefs(saved)
      addToast({ title: 'Notification preferences saved', variant: 'success' })
    } catch (e: unknown) {
      addToast({ title: 'Failed to save preferences', description: apiErrorMessage(e, 'Could not save preferences'), variant: 'error' })
    } finally {
      setPrefsSaving(false)
    }
  }

  const analyticsForPanel = analytics || {
    overview: {
      listings: stats.listings,
      active_listings: stats.listings,
      total_views: stats.totalViews,
      total_clicks: 0,
      total_inquiries: stats.inquiries,
      avg_views: stats.listings > 0 ? Math.round(stats.totalViews / stats.listings) : 0,
    },
    by_property: myListings.map((p) => {
      const listing = p as PropertyWithClicks
      return {
        id: listing.id,
        title: listing.title,
        city: listing.city || '',
        views: listing.views || 0,
        clicks: listing.clicks || 0,
        inquiries: inquiries.filter((i) => i.property_id === listing.id).length,
        engagement: (listing.views || 0) + inquiries.filter((i) => i.property_id === listing.id).length,
      }
    }),
    by_device: [],
    by_geography: [],
    by_channel: [],
    by_referrer: [],
    inquiries_by_status: [],
    ga_note: 'First-party marketplace analytics. Google Analytics 4 (free) can be connected later via a Measurement ID.',
  }

  const onboardingStatus = String(agent?.onboarding_status || 'active')
  const onboardingStage = String(agent?.onboarding_stage || 'active')
  const showOnboardingBanner = onboardingStatus !== 'active'
  const onboardingSteps = (agent?.onboarding_steps || {}) as Record<string, boolean>

  const stepLabelMap: Record<string, string> = {
    contact_verified: 'Contact verified',
    profile_completed: 'Profile completed',
    agency_affiliation_started: 'Agency affiliation started',
    terms_accepted: 'Terms accepted',
    activation_reviewed: 'Activation reviewed',
    account_active: 'Account active',
  }

  const queuedDistributions = (Object.values(distributions).flat() as DistQueueRow[])
    .filter((d) => d?.owner_type === 'agent' && (d?.status === 'pending_retry' || d?.status === 'failed'))
    .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())

  const isProUi = agentUiMode(agent) === 'pro'
  const showOnboardingChecklist =
    !onboarding.isError &&
    (onboarding.isLoading || shouldRenderOnboardingChecklist(onboarding.state))
  const zone3Urgent = dashboardZone3Urgent({ inquiries, operations, queuedDistributions })
  const showZone3 = Boolean(zone3Urgent) || (!isProUi && showOnboardingChecklist)

  return (
    <div className="min-h-screen bg-[var(--lc-bg-page)]">
      {/* Header */}
      <div className="border-b bg-[var(--lc-surface)] px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16 border-2 border-primary">
                <AvatarImage src={agent.photo} alt={agent.name} />
                <AvatarFallback>{agent.name?.split(' ').map((n: string) => n[0]).join('')}</AvatarFallback>
              </Avatar>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm text-muted-foreground">
                    {new Date().getHours() < 12
                      ? 'Good morning'
                      : new Date().getHours() < 17
                        ? 'Good afternoon'
                        : 'Good evening'}
                  </p>
                  {showMobileProChip ? (
                    <Badge
                      variant="outline"
                      className="rounded-pill border-[var(--lc-accent-bold-edge)] text-[var(--lc-accent-bold-edge)]"
                      title="Pro mode is available on tablet or larger screens"
                      data-testid="mobile-pro-chip"
                    >
                      ◆ Pro
                    </Badge>
                  ) : null}
                </div>
                <h1 className="text-2xl font-bold">{agent.name}</h1>
                <p className="text-sm text-muted-foreground">{agent.agency_name} &bull; License {agent.license_number}</p>
                <div className="mt-1 flex items-center gap-2">
                  <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                  <span className="text-sm font-medium">{agent.rating}</span>
                  <span className="text-sm text-muted-foreground">({agent.review_count} reviews)</span>
                  <Badge variant="outline" className="text-xs">Verified</Badge>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {isProUi && showOnboardingChecklist ? (
                <OnboardingChecklistWidget
                  variant="pill"
                  state={onboarding.state}
                  patch={onboarding.patch}
                  isLoading={onboarding.isLoading}
                  isError={onboarding.isError}
                />
              ) : null}
              <Link to="/dashboard/inbox">
                <Button variant="outline" className="gap-2">
                  <Inbox className="h-4 w-4" />
                  Inbox
                  {inboxUnread > 0 && (
                    <Badge variant="default" className="ms-1 h-5 min-w-[1.25rem] px-1 text-[10px]">{inboxUnread}</Badge>
                  )}
                </Button>
              </Link>
              <Link to="/tasks"><Button variant="outline" className="gap-2"><CheckCircle2 className="h-4 w-4" />Tasks</Button></Link>
              <Link to="/contacts"><Button variant="outline" className="gap-2"><Users className="h-4 w-4" />Contacts</Button></Link>
              <Link to="/opportunities"><Button variant="outline" className="gap-2"><DollarSign className="h-4 w-4" />Deals</Button></Link>
              <Link to="/analytics/crm"><Button variant="outline" className="gap-2"><BarChart3 className="h-4 w-4" />Analytics</Button></Link>
              <Link to="/agent/pricing"><Button variant="outline" className="gap-2"><TrendingUp className="h-4 w-4" />Price Health</Button></Link>
              <Button variant="outline" className="gap-2"><Phone className="h-4 w-4" />{agent.phone}</Button>
              <Button className="gap-2" onClick={() => setListingModal({ open: true, property: null })}>
                <Plus className="h-4 w-4" />Add Listing
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <TryProNudgeBanner />
        {showZone3 ? (
          <div data-dashboard-zone="3" className="mb-6 space-y-4">
            {zone3Urgent ? (
              <Card
                data-dashboard-urgent-card
                className="border-[var(--lc-border)] bg-[var(--lc-surface-raised)] shadow-[var(--lc-elevation-sm)]"
              >
                <CardHeader className="pb-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {zone3Urgent.label}
                  </p>
                  <CardTitle as="h2" className="text-base">{zone3Urgent.title}</CardTitle>
                  {zone3Urgent.sub ? <CardDescription>{zone3Urgent.sub}</CardDescription> : null}
                </CardHeader>
                {zone3Urgent.to ? (
                  <CardContent>
                    <Button asChild>
                      <Link to={zone3Urgent.to}>
                        {zone3Urgent.label === 'NEW LEAD' || zone3Urgent.label === 'SLA OVERDUE' || zone3Urgent.label === 'SLA BREACHED'
                          ? 'Reply now'
                          : 'Open'}
                      </Link>
                    </Button>
                  </CardContent>
                ) : null}
              </Card>
            ) : null}
            {!isProUi && showOnboardingChecklist ? (
              <OnboardingChecklistWidget
                variant="card"
                state={onboarding.state}
                patch={onboarding.patch}
                isLoading={onboarding.isLoading}
                isError={onboarding.isError}
              />
            ) : null}
          </div>
        ) : null}
        {showOnboardingBanner && (
          <Card className="mb-6 border-amber-200 bg-amber-50/60">
            <CardHeader className="pb-3">
              <CardTitle as="h2" className="text-base">Account activation in progress</CardTitle>
              <CardDescription>
                Current stage: <span className="font-medium">{onboardingStage.replace(/_/g, ' ')}</span> · Status: <span className="font-medium">{onboardingStatus.replace(/_/g, ' ')}</span>
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {Object.entries(stepLabelMap).map(([key, label]) => {
                  const done = Boolean(onboardingSteps[key])
                  return (
                    <div key={key} className="flex items-center gap-2 rounded-md border bg-[var(--lc-surface)] px-3 py-2 text-sm">
                      {done ? <CheckCircle2 className="h-4 w-4 text-green-600" /> : <Clock className="h-4 w-4 text-amber-600" />}
                      <span>{label}</span>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        )}

        <KpiAnalyticsPanel
          // structural cast — DashboardAnalytics matches panel Analytics shape
          analytics={analyticsForPanel as ComponentProps<typeof KpiAnalyticsPanel>['analytics']}
          selectedMetric={selectedMetric}
          onSelectMetric={setSelectedMetric}
        />

        {operations && (
          <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: 'SLA breached', value: operations.sla_breached_count || 0, color: 'text-red-600', bg: 'bg-red-50' },
              { label: 'Overdue tasks', value: operations.tasks?.overdue_count ?? operations.overdue_follow_ups ?? 0, color: 'text-amber-600', bg: 'bg-amber-50' },
              { label: 'Tasks due today', value: operations.tasks?.due_today_count || 0, color: 'text-blue-600', bg: 'bg-blue-50' },
              { label: 'Pending viewings', value: operations.pending_viewings || 0, color: 'text-purple-600', bg: 'bg-purple-50' },
              { label: 'Open deals', value: operations.pipeline?.open_opportunities || 0, color: 'text-emerald-600', bg: 'bg-emerald-50' },
              { label: 'Pipeline value', value: `$${(operations.pipeline?.total_value || 0).toLocaleString()}`, color: 'text-green-600', bg: 'bg-green-50' },
              { label: "Today's viewings", value: operations.todays_viewings?.length || 0, color: 'text-blue-600', bg: 'bg-blue-50' },
              { label: 'Follow-ups due', value: operations.tasks?.due_soon_count ?? operations.follow_ups_due ?? 0, color: 'text-orange-600', bg: 'bg-orange-50' },
            ].map((stat) => (
              <Card key={stat.label}>
                <CardContent className="flex items-center gap-4 p-5">
                  <div className={`rounded-lg p-3 ${stat.bg}`}>
                    <span className={`text-xl font-bold ${stat.color}`}>{stat.value}</span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">{stat.label}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {operations && operations.todays_viewings && operations.todays_viewings.length > 0 && (
          <Card className="mb-6">
            <CardHeader className="pb-3">
              <CardTitle as="h2" className="text-base">Today&apos;s viewings</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {operations.todays_viewings.map((v) => (
                  <div key={v.id} className="flex items-center justify-between rounded border bg-[var(--lc-surface)] px-3 py-2 text-sm">
                    <div>
                      <span className="font-medium">{v.client_name}</span>
                      <span className="text-muted-foreground"> · {new Date(v.scheduled_at || 0).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      {v.property_title && <span className="text-muted-foreground"> · {v.property_title}</span>}
                    </div>
                    <Badge variant="outline">{v.mode}</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6 flex-wrap">
            <TabsTrigger value="listings">My Listings</TabsTrigger>
            <TabsTrigger value="inquiries">Inquiries</TabsTrigger>
            <TabsTrigger value="settings">Channel Settings</TabsTrigger>
            <TabsTrigger value="notifications">Notifications</TabsTrigger>
            <TabsTrigger value="submissions">My Submissions</TabsTrigger>
            <TabsTrigger value="performance">Performance</TabsTrigger>
            {isAdmin && <TabsTrigger value="admin">Admin Review ({adminSubmissions.length})</TabsTrigger>}
            <TabsTrigger value="profile">Profile</TabsTrigger>
          </TabsList>

          {/* ====== LISTINGS ====== */}
          <TabsContent value="listings">
            <Card>
              <CardHeader>
                <CardTitle as="h2">My Property Listings</CardTitle>
                <CardDescription>Picture, city, engagement, and a full Actions menu per listing</CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
                ) : (
                  <div className="space-y-4">
                    {myListings.map(listing => {
                      const listingDists = distributions[listing.id] || []
                      const listingSubs = mySubmissions.filter(s => s.property_id === listing.id)
                      const inquiryCount = inquiries.filter((i) => i.property_id === listing.id).length
                      return (
                        <ListingRow
                          key={listing.id}
                          listing={listing}
                          inquiryCount={inquiryCount}
                          distributionsCount={listingDists.length}
                          pendingSubs={listingSubs.filter((s) => s.status === 'pending').length}
                          onDistribute={() => openPromoteModal(listing, 'distribute')}
                          onPromote={() => openPromoteModal(listing, 'promote')}
                          onEdit={() => setListingModal({ open: true, property: listing })}
                          onDelete={() => handleDelete(listing.id)}
                          onStatusChange={(status) => handleStatusChange(listing.id, status)}
                          onInquiriesChanged={refreshAll}
                        />
                      )
                    })}
                    {myListings.length === 0 && <p className="text-center text-muted-foreground py-8">No listings yet.</p>}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ====== INQUIRIES ====== */}
          <TabsContent value="inquiries">
            <Card>
              <CardHeader><CardTitle as="h2">Recent Inquiries</CardTitle><CardDescription>Messages from potential buyers and renters</CardDescription></CardHeader>
              <CardContent>
                <div className="mb-4 flex flex-wrap items-end gap-3">
                  <div>
                    <label className="mb-1 block text-xs font-medium">Status</label>
                    <select
                      className="h-9 rounded-md border bg-background px-2 text-xs"
                      value={inquiriesFilter.status}
                      onChange={(e) => setInquiriesFilter((prev) => ({ ...prev, status: e.target.value }))}
                    >
                      <option value="">All statuses</option>
                      {['new', 'contacted', 'qualified', 'scheduled_viewing', 'negotiating', 'closed_won', 'closed_lost'].map((s) => (
                        <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium">Stage</label>
                    <select
                      className="h-9 rounded-md border bg-background px-2 text-xs"
                      value={inquiriesFilter.stage}
                      onChange={(e) => setInquiriesFilter((prev) => ({ ...prev, stage: e.target.value }))}
                    >
                      <option value="">All stages</option>
                      {['new', 'first_response', 'qualification', 'viewing', 'offer', 'closed'].map((s) => (
                        <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium">Priority</label>
                    <select
                      className="h-9 rounded-md border bg-background px-2 text-xs"
                      value={inquiriesFilter.priority}
                      onChange={(e) => setInquiriesFilter((prev) => ({ ...prev, priority: e.target.value }))}
                    >
                      <option value="">All priorities</option>
                      {['low', 'normal', 'high', 'urgent'].map((p) => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={applyInquiryFilters}>Apply filters</Button>
                    <Button size="sm" variant="ghost" onClick={() => { setInquiriesFilter({ status: '', stage: '', priority: '' }); applyInquiryFilters() }}>Clear</Button>
                  </div>
                </div>

                {inquiries.length === 0 ? <p className="text-center text-muted-foreground py-8">No inquiries yet.</p> : (
                  <div className="space-y-4">
                    {inquiries.map((inq) => (
                      <div key={inq.id} className="rounded-lg border p-4">
                        <div className="flex items-start justify-between">
                          <div>
                            <h4 className="font-semibold">{inq.name}</h4>
                            <p className="text-xs text-muted-foreground">
                              {new Date(inq.created_at).toLocaleString()} &bull; Re: {inq.property_title || 'Property'}
                              {inq.status && <> &bull; {inq.status}</>}
                            </p>
                            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                              <Badge variant={inq.sla_overdue ? 'destructive' : 'outline'}>
                                {inq.sla_overdue ? 'SLA overdue' : 'SLA on track'}
                              </Badge>
                              <Badge variant="outline">Priority: {inq.priority || 'normal'}</Badge>
                              <Badge variant="outline">Stage: {inq.stage || 'new'}</Badge>
                              {inq.next_viewing_at && <Badge variant="secondary">Viewing: {new Date(inq.next_viewing_at).toLocaleString()}</Badge>}
                            </div>
                          </div>
                          <div className="flex gap-2">
                            {inq.phone && (
                              <Button variant="outline" size="sm" className="gap-1" asChild>
                                <a href={`tel:${String(inq.phone).replace(/\s/g, '')}`}><Phone className="h-3.5 w-3.5" />Call</a>
                              </Button>
                            )}
                            <Button variant="outline" size="sm" className="gap-1" asChild>
                              <a href={`mailto:${inq.email}?subject=Re: ${encodeURIComponent(inq.property_title || 'Your inquiry')}`}><Mail className="h-3.5 w-3.5" />Reply</a>
                            </Button>
                            {inq.status === 'new' && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleInquiryPatch(inq.id, { status: 'contacted', stage: 'first_response' })}
                              >
                                Mark contacted
                              </Button>
                            )}
                            <Button variant="ghost" size="sm" onClick={() => setSchedulingInquiryId((prev) => prev === inq.id ? null : inq.id)}>
                              Schedule viewing
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="gap-1"
                              onClick={() => loadTimeline(timelineInquiryId === inq.id ? null : inq.id)}
                            >
                              <Clock className="h-3.5 w-3.5" />
                              {timelineInquiryId === inq.id ? 'Hide timeline' : 'Timeline'}
                            </Button>
                          </div>
                        </div>
                        <p className="mt-2 text-sm text-muted-foreground">&ldquo;{inq.message}&rdquo;</p>
                        <div className="mt-3 grid gap-2 sm:grid-cols-3">
                          <select
                            className="h-9 rounded-md border bg-background px-2 text-xs"
                            value={inq.priority || 'normal'}
                            onChange={(e) => handleInquiryPatch(inq.id, { priority: e.target.value })}
                          >
                            <option value="low">Priority: low</option>
                            <option value="normal">Priority: normal</option>
                            <option value="high">Priority: high</option>
                            <option value="urgent">Priority: urgent</option>
                          </select>
                          <select
                            className="h-9 rounded-md border bg-background px-2 text-xs"
                            value={inq.stage || 'new'}
                            onChange={(e) => handleInquiryPatch(inq.id, { stage: e.target.value })}
                          >
                            <option value="new">Stage: new</option>
                            <option value="first_response">Stage: first response</option>
                            <option value="qualification">Stage: qualification</option>
                            <option value="viewing">Stage: viewing</option>
                            <option value="offer">Stage: offer</option>
                            <option value="closed">Stage: closed</option>
                          </select>
                          <select
                            className="h-9 rounded-md border bg-background px-2 text-xs"
                            value={inq.status || 'new'}
                            onChange={(e) => handleInquiryPatch(inq.id, { status: e.target.value })}
                          >
                            <option value="new">Status: new</option>
                            <option value="contacted">Status: contacted</option>
                            <option value="qualified">Status: qualified</option>
                            <option value="scheduled_viewing">Status: scheduled viewing</option>
                            <option value="negotiating">Status: negotiating</option>
                            <option value="closed_won">Status: closed won</option>
                            <option value="closed_lost">Status: closed lost</option>
                          </select>
                        </div>

                        {timelineInquiryId === inq.id && (
                          <div className="mt-3 space-y-3 rounded-md border bg-[var(--lc-bg-page)] p-3">
                            <div className="flex items-center justify-between">
                              <h5 className="text-sm font-semibold">Inquiry timeline</h5>
                              <Button variant="ghost" size="sm" onClick={() => loadTimeline(null)}>Close</Button>
                            </div>
                            {timelineLoading ? (
                              <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
                            ) : !timeline ? (
                              <p className="text-sm text-muted-foreground">No timeline data.</p>
                            ) : (
                              <div className="space-y-4">
                                {Array.isArray(timeline.viewings) && timeline.viewings.length > 0 && (
                                  <div>
                                    <h6 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Viewings</h6>
                                    <div className="space-y-2">
                                      {timeline.viewings.map((v) => (
                                        <div key={v.id} className="rounded border bg-[var(--lc-surface)] p-2 text-xs">
                                          <div className="flex items-center justify-between">
                                            <span className="font-medium">{new Date(v.scheduled_at).toLocaleString()}</span>
                                            <Badge variant="outline" className="text-[10px]">{v.status}</Badge>
                                          </div>
                                          {v.mode && <p className="text-muted-foreground mt-1">{v.mode.replace('_', ' ')} · {v.location || 'No location'}</p>}
                                          {v.outcome && <p className="mt-1">Outcome: <span className="font-medium">{v.outcome.replace(/_/g, ' ')}</span></p>}
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                                {Array.isArray(timeline.follow_ups) && timeline.follow_ups.length > 0 && (
                                  <div>
                                    <h6 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Follow-ups</h6>
                                    <div className="space-y-2">
                                      {(timeline.follow_ups as TimelineFollowUp[]).map((f) => (
                                        <div key={f.id} className="flex items-center justify-between rounded border bg-[var(--lc-surface)] p-2 text-xs">
                                          <span>{f.label}</span>
                                          <div className="flex items-center gap-2">
                                            <span className="text-muted-foreground">{new Date(f.due_at || 0).toLocaleString()}</span>
                                            <Badge variant={f.status === 'overdue' ? 'destructive' : 'secondary'} className="text-[10px]">{f.status}</Badge>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                                {Array.isArray(timeline.activities) && timeline.activities.length > 0 && (
                                  <div>
                                    <h6 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Activity log</h6>
                                    <div className="space-y-2">
                                      {(timeline.activities as TimelineActivity[]).slice(0, 20).map((a) => (
                                        <div key={a.id} className="rounded border bg-[var(--lc-surface)] p-2 text-xs">
                                          <div className="flex items-center justify-between">
                                            <span className="font-medium">{a.type?.replace(/_/g, ' ') || 'Activity'}</span>
                                            <span className="text-muted-foreground">{new Date(a.created_at || 0).toLocaleString()}</span>
                                          </div>
                                          <p className="text-muted-foreground mt-1">{a.actor_name || 'System'}</p>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                                {(!timeline.viewings?.length && !timeline.activities?.length && !timeline.follow_ups?.length) && (
                                  <p className="text-sm text-muted-foreground">No activity recorded yet.</p>
                                )}
                              </div>
                            )}
                          </div>
                        )}

                        {schedulingInquiryId === inq.id && (
                          <div className="mt-3 space-y-2 rounded-md border bg-[var(--lc-bg-page)] p-3">
                            <div className="grid gap-2 sm:grid-cols-3">
                              <Input
                                type="datetime-local"
                                value={scheduleForm[inq.id]?.scheduled_at || ''}
                                onChange={(e) => setScheduleForm((prev) => ({
                                  ...prev,
                                  [inq.id]: {
                                    scheduled_at: e.target.value,
                                    mode: prev[inq.id]?.mode || 'in_person',
                                    location: prev[inq.id]?.location || '',
                                    notes: prev[inq.id]?.notes || '',
                                  },
                                }))}
                              />
                              <select
                                className="h-10 rounded-md border bg-background px-2 text-sm"
                                value={scheduleForm[inq.id]?.mode || 'in_person'}
                                onChange={(e) => setScheduleForm((prev) => ({
                                  ...prev,
                                  [inq.id]: {
                                    scheduled_at: prev[inq.id]?.scheduled_at || '',
                                    mode: e.target.value as 'in_person' | 'virtual',
                                    location: prev[inq.id]?.location || '',
                                    notes: prev[inq.id]?.notes || '',
                                  },
                                }))}
                              >
                                <option value="in_person">In person</option>
                                <option value="virtual">Virtual</option>
                              </select>
                              <Input
                                placeholder="Location / meeting link"
                                value={scheduleForm[inq.id]?.location || ''}
                                onChange={(e) => setScheduleForm((prev) => ({
                                  ...prev,
                                  [inq.id]: {
                                    scheduled_at: prev[inq.id]?.scheduled_at || '',
                                    mode: prev[inq.id]?.mode || 'in_person',
                                    location: e.target.value,
                                    notes: prev[inq.id]?.notes || '',
                                  },
                                }))}
                              />
                            </div>
                            <div className="flex justify-end gap-2">
                              <Button variant="ghost" size="sm" onClick={() => setSchedulingInquiryId(null)}>Cancel</Button>
                              <Button size="sm" onClick={() => handleScheduleViewing(inq)}>Confirm schedule</Button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                    {hasMoreInquiries && (
                      <div className="flex justify-center pt-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={loadMoreInquiries}
                          disabled={inquiriesLoadingMore}
                        >
                          {inquiriesLoadingMore && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
                          Load more
                        </Button>
                      </div>
                    )}
                  </div>
                )}
                {viewings.length > 0 && (
                  <div className="mt-6 rounded-lg border bg-[var(--lc-bg-page)] p-4">
                    <h4 className="mb-3 text-sm font-semibold">Viewings</h4>
                    <div className="space-y-3">
                      {viewings
                        .sort((a, b) => new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime())
                        .map((v) => (
                          <div key={v.id} className="rounded border bg-[var(--lc-surface)] p-3 text-xs">
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-medium">{v.client_name || 'Client'}</span>
                                  <Badge variant="outline">{v.status}</Badge>
                                  <Badge variant="secondary">{v.mode?.replace('_', ' ')}</Badge>
                                </div>
                                <p className="text-muted-foreground mt-1">{new Date(v.scheduled_at).toLocaleString()} · {v.location || 'No location'}</p>
                                {v.outcome && <p className="mt-1">Outcome: <span className="font-medium">{v.outcome.replace(/_/g, ' ')}</span></p>}
                                {(() => {
                                  const notified = asClientNotified(v.client_notified)
                                  if (!notified) return null
                                  return (
                                    <p className="mt-1 text-green-700">
                                      Client notified via {notified.channel} at{' '}
                                      {new Date(notified.sent_at || 0).toLocaleString()}
                                    </p>
                                  )
                                })()}
                              </div>
                              <div className="flex flex-wrap gap-2">
                                {['scheduled', 'confirmed'].includes(v.status) && (
                                  <>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => setViewingAction({
                                        viewingId: v.id,
                                        mode: 'reschedule',
                                        scheduled_at: new Date(new Date(v.scheduled_at).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16),
                                        notify_client: false,
                                        notify_channel: 'email',
                                        outcome: 'interested',
                                        outcome_notes: '',
                                      })}
                                    >
                                      Reschedule
                                    </Button>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => setViewingAction({
                                        viewingId: v.id,
                                        mode: 'complete',
                                        scheduled_at: '',
                                        notify_client: false,
                                        notify_channel: 'email',
                                        outcome: 'interested',
                                        outcome_notes: '',
                                      })}
                                    >
                                      Complete
                                    </Button>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => setViewingAction({
                                        viewingId: v.id,
                                        mode: 'cancel',
                                        scheduled_at: '',
                                        notify_client: false,
                                        notify_channel: 'email',
                                        outcome: 'cancelled',
                                        outcome_notes: '',
                                      })}
                                    >
                                      Cancel
                                    </Button>
                                  </>
                                )}
                                {['scheduled', 'confirmed'].includes(v.status) && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-destructive"
                                    onClick={() => handleUpdateViewing(v.id, { status: 'no_show' })}
                                  >
                                    No-show
                                  </Button>
                                )}
                              </div>
                            </div>

                            {viewingAction.viewingId === v.id && viewingAction.mode === 'reschedule' && (
                              <div className="mt-3 space-y-2 rounded-md border bg-[var(--lc-bg-page)] p-3">
                                <Input
                                  type="datetime-local"
                                  value={viewingAction.scheduled_at}
                                  onChange={(e) => setViewingAction((prev) => ({ ...prev, scheduled_at: e.target.value }))}
                                />
                                <div className="flex flex-wrap items-center gap-4">
                                  <label className="flex items-center gap-2">
                                    <input
                                      type="checkbox"
                                      className="h-4 w-4 rounded border-gray-300"
                                      checked={viewingAction.notify_client}
                                      onChange={(e) => setViewingAction((prev) => ({ ...prev, notify_client: e.target.checked }))}
                                    />
                                    <span>Notify client</span>
                                  </label>
                                  <select
                                    className="h-9 rounded-md border bg-background px-2 text-xs"
                                    value={viewingAction.notify_channel}
                                    onChange={(e) => setViewingAction((prev) => ({ ...prev, notify_channel: e.target.value as 'email' | 'whatsapp' | 'sms' }))}
                                  >
                                    <option value="email">Email</option>
                                    <option value="whatsapp">WhatsApp</option>
                                    <option value="sms">SMS</option>
                                  </select>
                                </div>
                                <div className="flex justify-end gap-2">
                                  <Button variant="ghost" size="sm" onClick={() => setViewingAction((prev) => ({ ...prev, viewingId: null, mode: null }))}>Cancel</Button>
                                  <Button
                                    size="sm"
                                    onClick={() => handleUpdateViewing(v.id, {
                                      scheduled_at: new Date(viewingAction.scheduled_at).toISOString(),
                                      notify_client: viewingAction.notify_client,
                                      notify_channel: viewingAction.notify_channel,
                                    })}
                                  >
                                    Confirm reschedule
                                  </Button>
                                </div>
                              </div>
                            )}

                            {viewingAction.viewingId === v.id && viewingAction.mode === 'complete' && (
                              <div className="mt-3 space-y-2 rounded-md border bg-[var(--lc-bg-page)] p-3">
                                <select
                                  className="h-9 w-full rounded-md border bg-background px-2 text-xs"
                                  value={viewingAction.outcome}
                                  onChange={(e) => setViewingAction((prev) => ({ ...prev, outcome: e.target.value }))}
                                >
                                  <option value="interested">Interested</option>
                                  <option value="not_interested">Not interested</option>
                                </select>
                                <textarea
                                  rows={2}
                                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs"
                                  placeholder="Outcome notes"
                                  value={viewingAction.outcome_notes}
                                  onChange={(e) => setViewingAction((prev) => ({ ...prev, outcome_notes: e.target.value }))}
                                />
                                <div className="flex justify-end gap-2">
                                  <Button variant="ghost" size="sm" onClick={() => setViewingAction((prev) => ({ ...prev, viewingId: null, mode: null }))}>Cancel</Button>
                                  <Button
                                    size="sm"
                                    onClick={() => handleUpdateViewing(v.id, {
                                      status: 'completed',
                                      outcome: viewingAction.outcome,
                                      outcome_notes: viewingAction.outcome_notes,
                                    })}
                                  >
                                    Confirm completion
                                  </Button>
                                </div>
                              </div>
                            )}

                            {viewingAction.viewingId === v.id && viewingAction.mode === 'cancel' && (
                              <div className="mt-3 space-y-2 rounded-md border bg-[var(--lc-bg-page)] p-3">
                                <textarea
                                  rows={2}
                                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs"
                                  placeholder="Cancellation notes"
                                  value={viewingAction.outcome_notes}
                                  onChange={(e) => setViewingAction((prev) => ({ ...prev, outcome_notes: e.target.value }))}
                                />
                                <div className="flex flex-wrap items-center gap-4">
                                  <label className="flex items-center gap-2">
                                    <input
                                      type="checkbox"
                                      className="h-4 w-4 rounded border-gray-300"
                                      checked={viewingAction.notify_client}
                                      onChange={(e) => setViewingAction((prev) => ({ ...prev, notify_client: e.target.checked }))}
                                    />
                                    <span>Notify client</span>
                                  </label>
                                  <select
                                    className="h-9 rounded-md border bg-background px-2 text-xs"
                                    value={viewingAction.notify_channel}
                                    onChange={(e) => setViewingAction((prev) => ({ ...prev, notify_channel: e.target.value as 'email' | 'whatsapp' | 'sms' }))}
                                  >
                                    <option value="email">Email</option>
                                    <option value="whatsapp">WhatsApp</option>
                                    <option value="sms">SMS</option>
                                  </select>
                                </div>
                                <div className="flex justify-end gap-2">
                                  <Button variant="ghost" size="sm" onClick={() => setViewingAction((prev) => ({ ...prev, viewingId: null, mode: null }))}>Cancel</Button>
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    onClick={() => handleUpdateViewing(v.id, {
                                      status: 'cancelled',
                                      outcome_notes: viewingAction.outcome_notes,
                                      notify_client: viewingAction.notify_client,
                                      notify_channel: viewingAction.notify_channel,
                                    })}
                                  >
                                    Confirm cancellation
                                  </Button>
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ====== CHANNEL SETTINGS ====== */}
          <TabsContent value="settings">
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle as="h2" className="flex items-center gap-2"><Settings className="h-5 w-5" />Your social platforms</CardTitle>
                  <CardDescription>
                    Connect your Instagram, Telegram, TikTok, and X accounts. When you Promote a listing you can post to these and/or REB pages.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {platforms
                      .filter((p) => SOCIAL_PROMOTE_PLATFORMS.includes(p.id) || p.id === 'whatsapp')
                      .map((p) => {
                      const conn = myConnections.find(c => c.platform === p.id)
                      const Icon = PLATFORM_META[p.id]?.icon || Globe
                      const isConnected = !!conn && conn.status === 'connected'
                      const isWhatsApp = p.id === 'whatsapp'
                      const isSocial = SOCIAL_PROMOTE_PLATFORMS.includes(p.id)
                      return (
                        <div key={p.id} className="rounded-lg border p-4">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div className="flex items-center gap-4">
                              <div className={`rounded-lg p-3 ${isConnected ? 'bg-green-50' : 'bg-muted'}`}>
                                <Icon className={`h-6 w-6 ${isConnected ? PLATFORM_META[p.id]?.color || 'text-green-600' : 'text-muted-foreground'}`} />
                              </div>
                              <div>
                                <h4 className="font-semibold flex items-center gap-2">
                                  {p.name}
                                  {isSocial && <Badge variant="outline" className="text-[10px]">Promote</Badge>}
                                  {isWhatsApp && whatsappStatus?.healthy && (
                                    <Badge variant="outline" className="text-xs text-green-700">API healthy</Badge>
                                  )}
                                  {isWhatsApp && whatsappStatus && !whatsappStatus.healthy && (
                                    <Badge variant="destructive" className="text-xs">API issue</Badge>
                                  )}
                                </h4>
                                <p className="text-sm text-muted-foreground">{p.description}</p>
                                {isConnected && conn && (
                                  <p className="text-xs text-green-600 mt-1">
                                    Connected as {conn.account_name || String(conn.settings?.handle ?? '')}
                                  </p>
                                )}
                              </div>
                            </div>
                            <div className="flex gap-2">
                              {isConnected && conn ? (
                                <Button variant="outline" size="sm" className="gap-1 text-destructive" onClick={() => handleDisconnect(conn.id)}>
                                  <Plug className="h-4 w-4" />Disconnect
                                </Button>
                              ) : isWhatsApp ? (
                                <Button
                                  size="sm"
                                  className="gap-1"
                                  onClick={() => handleConnect('whatsapp')}
                                  disabled={connecting === 'whatsapp' || whatsappStatus?.configured === false}
                                >
                                  {connecting === 'whatsapp' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plug className="h-4 w-4" />}
                                  Connect WhatsApp
                                </Button>
                              ) : (
                                <div className="flex gap-2">
                                  <Input
                                    placeholder={PLATFORM_META[p.id]?.handleHint || `Your ${p.name} handle`}
                                    value={connectHandles[p.id] || ''}
                                    onChange={e => setConnectHandles((prev) => ({ ...prev, [p.id]: e.target.value }))}
                                    className="w-52 h-9"
                                  />
                                  <Button
                                    size="sm"
                                    className="gap-1"
                                    onClick={() => handleConnect(p.id)}
                                    disabled={connecting === p.id || !(connectHandles[p.id] || '').trim()}
                                  >
                                    {connecting === p.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plug className="h-4 w-4" />}
                                    Connect
                                  </Button>
                                </div>
                              )}
                            </div>
                          </div>
                          {isWhatsApp && (
                            <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto] items-end border-t pt-4">
                              <div>
                                <Label className="text-xs">Default recipient (international, e.g. 96170123456)</Label>
                                <Input
                                  className="mt-1"
                                  placeholder="9617XXXXXXX"
                                  value={whatsappRecipient}
                                  onChange={(e) => setWhatsappRecipient(e.target.value)}
                                />
                              </div>
                              {isConnected && conn && (
                                <Button variant="outline" onClick={() => handleSaveWhatsAppRecipient(conn.id)}>
                                  Save recipient
                                </Button>
                              )}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>

                  <div className="mt-6 rounded-lg border border-dashed bg-[var(--lc-surface-sunken)] p-4">
                    <p className="text-sm text-muted-foreground">
                      <strong className="text-foreground">Your accounts stay yours.</strong> REB never posts to your Instagram, Telegram, TikTok, or X without you choosing them in Promote / Distribute.
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle as="h2" className="flex items-center gap-2"><Globe className="h-5 w-5" />REB pages</CardTitle>
                  <CardDescription>Official REB channels you can request promotion on (admin review)</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {fiAccounts
                      .filter((acc) => SOCIAL_PROMOTE_PLATFORMS.includes(acc.platform) || acc.platform === 'whatsapp')
                      .map((acc) => {
                      const Icon = PLATFORM_META[acc.platform]?.icon || Globe
                      return (
                        <div key={acc.id} className="flex items-center gap-4 rounded-lg border p-3">
                          <div className="rounded-lg bg-primary-faint p-2">
                            <Icon className="h-5 w-5 text-primary" />
                          </div>
                          <div className="flex-1">
                            <p className="font-medium">{acc.account_name}</p>
                            <p className="text-xs text-muted-foreground">{acc.description}</p>
                          </div>
                          <Badge variant="outline" className="text-xs">{acc.status}</Badge>
                        </div>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* ====== NOTIFICATIONS ====== */}
          <TabsContent value="notifications">
            <Card>
              <CardHeader>
                <CardTitle as="h2" className="flex items-center gap-2"><Bell className="h-5 w-5" />Notification Preferences</CardTitle>
                <CardDescription>Choose which notifications you receive and how they are delivered</CardDescription>
              </CardHeader>
              <CardContent>
                {notificationPrefs ? (
                  <div className="space-y-6">
                    <div>
                      <h4 className="mb-3 text-sm font-semibold">Channels</h4>
                      <div className="space-y-2">
                        {[
                          { key: 'inapp' as const, label: 'In-app notifications' },
                          { key: 'email' as const, label: 'Email notifications' },
                          { key: 'whatsapp' as const, label: 'WhatsApp notifications' },
                        ].map((ch) => (
                          <label key={ch.key} className="flex items-center gap-3">
                            <input
                              type="checkbox"
                              className="h-4 w-4 rounded border-gray-300"
                              checked={!!notificationPrefs.channels?.[ch.key]}
                              onChange={(e) => {
                                const next = {
                                  ...notificationPrefs,
                                  channels: { ...notificationPrefs.channels, [ch.key]: e.target.checked },
                                }
                                setNotificationPrefs(next)
                                handleSaveNotificationPrefs({ channels: next.channels })
                              }}
                            />
                            <span className="text-sm">{ch.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    <div>
                      <h4 className="mb-3 text-sm font-semibold">Event types</h4>
                      <div className="space-y-2">
                        {[
                          { key: 'saved_search_match' as const, label: 'Saved search matches' },
                          { key: 'inquiry_sla_overdue' as const, label: 'Inquiry SLA overdue' },
                          { key: 'viewing_reminder' as const, label: 'Viewing reminders' },
                          { key: 'viewing_no_show' as const, label: 'Viewing no-show alerts' },
                        ].map((ev) => (
                          <label key={ev.key} className="flex items-center gap-3">
                            <input
                              type="checkbox"
                              className="h-4 w-4 rounded border-gray-300"
                              checked={!!notificationPrefs.events?.[ev.key]}
                              onChange={(e) => {
                                const next = {
                                  ...notificationPrefs,
                                  events: { ...notificationPrefs.events, [ev.key]: e.target.checked },
                                }
                                setNotificationPrefs(next)
                                handleSaveNotificationPrefs({ events: next.events })
                              }}
                            />
                            <span className="text-sm">{ev.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-lg border bg-[var(--lc-bg-page)] p-4">
                      <h4 className="mb-3 text-sm font-semibold">Quiet hours</h4>
                      <div className="flex flex-wrap items-center gap-4">
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            className="h-4 w-4 rounded border-gray-300"
                            checked={!!notificationPrefs.quiet_hours?.enabled}
                            onChange={(e) => {
                              const next = {
                                ...notificationPrefs,
                                quiet_hours: { ...notificationPrefs.quiet_hours, enabled: e.target.checked },
                              }
                              setNotificationPrefs(next)
                              handleSaveNotificationPrefs({ quiet_hours: next.quiet_hours })
                            }}
                          />
                          <span className="text-sm">Enable quiet hours</span>
                        </label>
                        <div className="flex items-center gap-2">
                          <Input
                            type="time"
                            className="w-28"
                            value={notificationPrefs.quiet_hours?.start || '22:00'}
                            onChange={(e) => {
                              const next = {
                                ...notificationPrefs,
                                quiet_hours: { ...notificationPrefs.quiet_hours, start: e.target.value },
                              }
                              setNotificationPrefs(next)
                            }}
                            onBlur={() => handleSaveNotificationPrefs({ quiet_hours: notificationPrefs.quiet_hours })}
                          />
                          <span className="text-sm text-muted-foreground">to</span>
                          <Input
                            type="time"
                            className="w-28"
                            value={notificationPrefs.quiet_hours?.end || '08:00'}
                            onChange={(e) => {
                              const next = {
                                ...notificationPrefs,
                                quiet_hours: { ...notificationPrefs.quiet_hours, end: e.target.value },
                              }
                              setNotificationPrefs(next)
                            }}
                            onBlur={() => handleSaveNotificationPrefs({ quiet_hours: notificationPrefs.quiet_hours })}
                          />
                        </div>
                      </div>
                    </div>

                    {prefsSaving && <p className="text-sm text-muted-foreground">Saving...</p>}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Loading preferences...</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ====== MY SUBMISSIONS ====== */}
          <TabsContent value="submissions">
            <Card>
              <CardHeader>
                <CardTitle as="h2" className="flex items-center gap-2"><Inbox className="h-5 w-5" />Submissions to REB</CardTitle>
                <CardDescription>Track your listings submitted to REB's official channels</CardDescription>
              </CardHeader>
              <CardContent>
                {mySubmissions.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">No submissions yet. Distribute a listing and select "REB Channels".</p>
                ) : (
                  <div className="space-y-3">
                    {mySubmissions.map((sub) => (
                      <div key={sub.id} className="flex items-center gap-4 rounded-lg border p-4">
                        <div className={`rounded-lg p-2 ${
                          sub.status === 'approved' ? 'bg-green-50' : sub.status === 'rejected' ? 'bg-red-50' : 'bg-yellow-50'
                        }`}>
                          {sub.status === 'approved' ? <CheckCircle2 className="h-5 w-5 text-green-600" /> :
                           sub.status === 'rejected' ? <XCircle className="h-5 w-5 text-red-600" /> :
                           <Clock className="h-5 w-5 text-yellow-600" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{sub.property?.title || 'Unknown Property'}</p>
                          <p className="text-xs text-muted-foreground">{sub.platform_name} &bull; Submitted {new Date(sub.created_at || 0).toLocaleDateString()}</p>
                          {sub.review_notes && <p className="text-xs text-muted-foreground mt-1">Note: {sub.review_notes}</p>}
                        </div>
                        <Badge variant={sub.status === 'approved' ? 'default' : sub.status === 'rejected' ? 'destructive' : 'secondary'}>
                          {sub.status === 'approved' ? 'Approved' : sub.status === 'rejected' ? 'Rejected' : 'Pending Review'}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ====== PERFORMANCE ====== */}
          <TabsContent value="performance">
            <div className="space-y-6">
              {performance && (
                <>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    {[
                      { icon: Layers, label: 'Listings Published', value: performance.overview?.totalListingsPublished, color: 'text-blue-500' },
                      { icon: Globe, label: 'Platforms Active', value: performance.overview?.totalPlatforms, color: 'text-green-500' },
                      { icon: Eye, label: 'Cross-Market Views', value: (performance.overview?.totalViews ?? 0).toLocaleString(), color: 'text-purple-500' },
                      { icon: Users, label: 'Leads Generated', value: performance.overview?.totalLeads, color: 'text-orange-500' },
                    ].map(stat => {
                      const Icon = stat.icon
                      return (
                        <Card key={stat.label}>
                          <CardContent className="flex items-center gap-4 p-6">
                            <div className={`rounded-lg bg-muted p-3 ${stat.color}`}><Icon className="h-6 w-6" /></div>
                            <div><p className="text-2xl font-bold">{stat.value}</p><p className="text-sm text-muted-foreground">{stat.label}</p></div>
                          </CardContent>
                        </Card>
                      )
                    })}
                  </div>

                  {/* FI Submissions Summary */}
                  {performance.overview?.fiSubmissions && (
                    <Card>
                      <CardHeader><CardTitle as="h2">REB Submission Status</CardTitle></CardHeader>
                      <CardContent>
                        <div className="flex gap-6">
                          <div className="text-center"><p className="text-2xl font-bold text-yellow-600">{performance.overview?.fiSubmissions?.pending}</p><p className="text-xs text-muted-foreground">Pending</p></div>
                          <div className="text-center"><p className="text-2xl font-bold text-green-600">{performance.overview?.fiSubmissions?.approved}</p><p className="text-xs text-muted-foreground">Approved</p></div>
                          <div className="text-center"><p className="text-2xl font-bold text-red-600">{performance.overview?.fiSubmissions?.rejected}</p><p className="text-xs text-muted-foreground">Rejected</p></div>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  <Card>
                    <CardHeader><CardTitle as="h2" className="flex items-center gap-2"><BarChart3 className="h-5 w-5" />Performance by Channel</CardTitle></CardHeader>
                    <CardContent>
                      {!(performance.byPlatform?.length) ? (
                        <p className="text-center text-muted-foreground py-8">No distributions yet.</p>
                      ) : (
                        <div className="space-y-4">
                          {performance.byPlatform.map((p) => (
                            <div key={`${p.platform}-${p.owner_type}`} className="rounded-lg border p-4">
                              <div className="flex items-center justify-between mb-3">
                                <h4 className="font-semibold flex items-center gap-2">
                                  {PLATFORM_META[p.platform]?.name || p.platform}
                                  <Badge variant="outline" className="text-xs">
                                    {p.owner_type === 'agency' ? 'Your Account' : 'REB'}
                                  </Badge>
                                </h4>
                                <Badge variant="outline">{p.listings} listing{(p.listings ?? 0) > 1 ? 's' : ''}</Badge>
                              </div>
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                                <div><p className="text-muted-foreground">Views</p><p className="font-bold text-lg">{p.views}</p></div>
                                <div><p className="text-muted-foreground">Leads</p><p className="font-bold text-lg">{p.leads}</p></div>
                                <div><p className="text-muted-foreground">Cost</p><p className="font-bold text-lg">${p.cost}</p></div>
                                <div><p className="text-muted-foreground">Cost/Lead</p><p className="font-bold text-lg">{(p.leads ?? 0) > 0 ? `$${((p.cost ?? 0) / (p.leads ?? 1)).toFixed(2)}` : '—'}</p></div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="flex flex-row items-start justify-between gap-3">
                      <div>
                        <CardTitle as="h2" className="flex items-center gap-2"><RefreshCw className="h-5 w-5" />Delivery retry queue</CardTitle>
                        <CardDescription>Retry queued and failed channel deliveries</CardDescription>
                      </div>
                      <Button variant="outline" size="sm" onClick={handleRetryPendingBatch} disabled={bulkRetrying}>
                        {bulkRetrying ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : <RefreshCw className="me-2 h-4 w-4" />}
                        Retry queued batch
                      </Button>
                    </CardHeader>
                    <CardContent>
                      {queuedDistributions.length === 0 ? (
                        <p className="text-center text-muted-foreground py-6">No queued or failed deliveries right now.</p>
                      ) : (
                        <div className="space-y-3">
                          {queuedDistributions.slice(0, 25).map((d) => (
                            <div key={d.id} className="flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between">
                              <div className="min-w-0">
                                <p className="font-medium">
                                  {PLATFORM_META[d.platform]?.name || d.platform}
                                  <Badge className="ms-2" variant={d.status === 'failed' ? 'destructive' : 'secondary'}>
                                    {d.status}
                                  </Badge>
                                </p>
                                <p className="truncate text-xs text-muted-foreground">
                                  Property {d.property_id} · attempts {Number(d?.meta?.retry_attempts || 0)}
                                  {d?.meta?.next_retry_at ? ` · next ${new Date(d.meta.next_retry_at).toLocaleTimeString()}` : ''}
                                </p>
                                {d.error && <p className="text-xs text-red-600">{d.error}</p>}
                              </div>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleRetryDistribution(d.id)}
                                disabled={retryingDistributionId === d.id}
                              >
                                {retryingDistributionId === d.id ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : <RefreshCw className="me-2 h-4 w-4" />}
                                Retry now
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </>
              )}
            </div>
          </TabsContent>

          {/* ====== ADMIN REVIEW ====== */}
          <TabsContent value="admin">
            <Card>
              <CardHeader>
                <CardTitle as="h2" className="flex items-center gap-2"><Inbox className="h-5 w-5" />Pending Review Queue</CardTitle>
                <CardDescription>Review and approve agency submissions for REB channels</CardDescription>
              </CardHeader>
              <CardContent>
                {adminSubmissions.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">No pending submissions.</p>
                ) : (
                  <div className="space-y-4">
                    {adminSubmissions.map((sub) => (
                      <div key={sub.id} className="rounded-lg border p-4">
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <Badge variant="secondary">{sub.platform_name}</Badge>
                              <span className="text-xs text-muted-foreground">from {sub.agent?.name || 'Unknown Agent'}</span>
                            </div>
                            <h4 className="font-semibold">{sub.property?.title || 'Unknown Property'}</h4>
                            <p className="text-sm text-muted-foreground">{sub.property?.location}</p>
                            {sub.message && <p className="text-sm mt-2 italic">&ldquo;{sub.message}&rdquo;</p>}
                          </div>
                          <div className="flex gap-2">
                            <Button variant="outline" size="sm" className="gap-1 text-green-600" onClick={() => handleApprove(sub.id)}>
                              <Check className="h-4 w-4" />Approve
                            </Button>
                            <Button variant="outline" size="sm" className="gap-1 text-destructive" onClick={() => handleReject(sub.id)}>
                              <X className="h-4 w-4" />Reject
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="profile">
            <Card>
              <CardHeader><CardTitle>Profile Settings</CardTitle><CardDescription>Update your agent profile</CardDescription></CardHeader>
              <CardContent className="space-y-4">
                {engagement && (
                  <div className="rounded-lg border p-4">
                    <p className="text-sm font-semibold mb-2">Platform engagement (agent-only breakdown)</p>
                    <div className="grid gap-3 sm:grid-cols-3 text-sm">
                      <div><p className="text-muted-foreground">Profile views</p><p className="text-xl font-bold">{engagement.views_total || 0}</p></div>
                      <div><p className="text-muted-foreground">Followers</p><p className="text-xl font-bold">{engagement.followers_total || 0}</p></div>
                      <div>
                        <p className="text-muted-foreground">By channel</p>
                        <ul className="mt-1 space-y-0.5 text-xs">
                          {Object.entries(engagement.by_channel || {}).map(([ch, n]) => (
                            <li key={ch}>{ch}: {String(n)}</li>
                          ))}
                          {Object.keys(engagement.by_channel || {}).length === 0 && <li className="text-muted-foreground">No views yet</li>}
                        </ul>
                      </div>
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">
                      Channel breakdown is agent-only until Principal Authority confirms agency visibility.
                    </p>
                    {typeof agent.slug === 'string' && agent.slug ? (
                      <p className="mt-2 text-xs">Public URL: <Link className="text-primary underline" to={`/agent/${agent.slug}`}>/agent/{agent.slug}</Link></p>
                    ) : null}
                  </div>
                )}
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label className="text-sm font-medium">Full Name</Label>
                    <Input className="mt-1" value={profileForm.name} onChange={(e) => setProfileForm((p) => ({ ...p, name: e.target.value }))} />
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Email</Label>
                    <Input className="mt-1" value={profileForm.email} disabled />
                  </div>
                </div>
                <div>
                  <Label className="text-sm font-medium">Phone</Label>
                  <Input className="mt-1" value={profileForm.phone} onChange={(e) => setProfileForm((p) => ({ ...p, phone: e.target.value }))} />
                </div>
                <div>
                  <Label className="text-sm font-medium">Bio</Label>
                  <textarea
                    rows={4}
                    className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={profileForm.bio}
                    onChange={(e) => setProfileForm((p) => ({ ...p, bio: e.target.value }))}
                  />
                </div>
                {profileMsg && <p className="text-sm text-muted-foreground">{profileMsg}</p>}
                <Button onClick={handleSaveProfile} disabled={profileSaving} className="gap-2">
                  {profileSaving && <Loader2 className="h-4 w-4 animate-spin" />}
                  Save Changes
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <ListingFormModal
        open={listingModal.open}
        property={listingModal.property}
        onClose={() => setListingModal({ open: false, property: null })}
        onSaved={() => refreshAll()}
      />

      <PromoteDistributeModal
        open={distModal.open}
        mode={distModal.mode}
        property={distModal.property}
        platforms={platforms}
        myConnections={myConnections}
        fiAccounts={fiAccounts}
        whatsappRecipient={whatsappRecipient}
        onClose={() => setDistModal({ open: false, property: null, mode: 'distribute' })}
        onDone={() => refreshAll()}
      />
    </div>
  )
}
