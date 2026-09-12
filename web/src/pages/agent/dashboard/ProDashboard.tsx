import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { useTenant } from '@/hooks/useTenant'
import { api } from '@/api/client'
import { Numeric } from '@/components/ui/numeric'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  KpiCard,
  QuickActionsBar,
  WidgetCard,
} from './pro/ProDashboardParts'
import { useDashboardLayout } from '@/hooks/useDashboardLayout'
import { WidgetGrid } from '@/components/dashboard/pro/WidgetGrid'
import {
  WidgetPaletteDrawer,
  WIDGET_CATALOG,
} from '@/components/dashboard/pro/WidgetPaletteDrawer'
import { formatPrice } from '@/lib/format'
import { normalizeStatus } from '@/lib/listingStatus'

export interface ProDashboardProps {
  stats?: {
    listings?: number
    totalViews?: number
    inquiries?: number
    activeListings?: number
  }
  greetingName?: string
  className?: string
}

const SHORTCUTS = [
  { keys: '?', label: 'Open shortcuts' },
  { keys: '⌘K', label: 'Command palette' },
  { keys: '/', label: 'Focus search' },
  { keys: 'G D', label: 'Go to Dashboard' },
  { keys: 'G I', label: 'Go to Inbox' },
  { keys: 'G L', label: 'Go to Listings' },
  { keys: '1–9', label: 'Fullscreen widget N' },
  { keys: 'E', label: 'Toggle edit mode' },
  { keys: 'Esc', label: 'Exit fullscreen / edit' },
] as const

const WIDGET_TITLES: Record<string, string> = Object.fromEntries(
  WIDGET_CATALOG.map((w) => [w.id, w.title.replace(/ KPI$/, '').replace(/ value$/, '')]),
)

function greetingForHour(hour: number): string {
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

type LiveData = {
  stats: { listings: number; totalViews: number; inquiries: number; activeListings: number }
  listings: Array<Record<string, unknown>>
  inquiries: Array<Record<string, unknown>>
  viewings: Array<Record<string, unknown>>
  conversations: Array<Record<string, unknown>>
  operations: Record<string, unknown> | null
  analytics: Record<string, unknown> | null
}

/**
 * AGT-DSH-002 — Pro dashboard (≥768px + ui_mode=pro).
 * Drag-to-arrange via react-grid-layout, layout persist, palette, 1–9 fullscreen,
 * density persistence, live Zone-2/3 data mounts.
 */
export function ProDashboard({ stats: statsProp, greetingName, className }: ProDashboardProps) {
  const { agent } = useAuth()
  const { activeTenant } = useTenant()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const {
    layout,
    density,
    saveState,
    setLayout,
    setDensity,
    resetLayout,
    removeWidget,
    addWidget,
  } = useDashboardLayout(activeTenant?.id)

  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [editMode, setEditMode] = useState(true)
  const [gridWidth, setGridWidth] = useState(1100)
  const gridHostRef = useRef<HTMLDivElement>(null)
  const goChord = useRef(false)

  const fullscreenId = searchParams.get('widget')
  const setFullscreenId = useCallback(
    (id: string | null) => {
      const next = new URLSearchParams(searchParams)
      if (id) next.set('widget', id)
      else next.delete('widget')
      setSearchParams(next, { replace: true })
    },
    [searchParams, setSearchParams],
  )

  const [live, setLive] = useState<LiveData>({
    stats: {
      listings: statsProp?.listings ?? 0,
      totalViews: statsProp?.totalViews ?? 0,
      inquiries: statsProp?.inquiries ?? 0,
      activeListings: statsProp?.activeListings ?? statsProp?.listings ?? 0,
    },
    listings: [],
    inquiries: [],
    viewings: [],
    conversations: [],
    operations: null,
    analytics: null,
  })

  useEffect(() => {
    if (!agent) return
    let cancelled = false
    Promise.all([
      api.getDashboardStats().catch(() => ({ listings: 0, totalViews: 0, inquiries: 0 })),
      api.getProperties({ agent_id: agent.id }).catch(() => []),
      api.getInquiries({ limit: '20' }).catch(() => ({ items: [] })),
      api.getViewings().catch(() => []),
      api.getConversations().catch(() => []),
      api.getDashboardOperations().catch(() => null),
      api.getDashboardAnalytics().catch(() => null),
    ]).then(([dashStats, props, inqs, viewings, conversations, ops, analytics]) => {
      if (cancelled) return
      const allProps = Array.isArray(props) ? props : []
      const mine = allProps.filter((p: { agent_id?: string }) => p.agent_id === agent.id)
      const inquiryItems = (inqs as { items?: unknown[] })?.items || inqs || []
      setLive({
        stats: {
          listings: (dashStats as { listings?: number }).listings ?? mine.length,
          totalViews: (dashStats as { totalViews?: number }).totalViews ?? 0,
          inquiries:
            (dashStats as { inquiries?: number }).inquiries ??
            (Array.isArray(inquiryItems) ? inquiryItems.length : 0),
          activeListings:
            (dashStats as { listings?: number }).listings ??
            mine.filter((p: { status?: string }) => normalizeStatus(p.status) === 'published').length,
        },
        listings: mine as Array<Record<string, unknown>>,
        inquiries: (Array.isArray(inquiryItems) ? inquiryItems : []) as Array<Record<string, unknown>>,
        viewings: (Array.isArray(viewings) ? viewings : []) as Array<Record<string, unknown>>,
        conversations: (Array.isArray(conversations) ? conversations : []) as Array<
          Record<string, unknown>
        >,
        operations: ops as Record<string, unknown> | null,
        analytics: analytics as Record<string, unknown> | null,
      })
    })
    return () => {
      cancelled = true
    }
  }, [agent])

  useEffect(() => {
    const el = gridHostRef.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width
      if (w && w > 0) setGridWidth(Math.floor(w))
    })
    ro.observe(el)
    setGridWidth(Math.floor(el.getBoundingClientRect().width) || 1100)
    return () => ro.disconnect()
  }, [])

  const name = greetingName || agent?.name?.split(' ')[0] || 'there'
  const greeting = useMemo(() => greetingForHour(new Date().getHours()), [])
  const dateLabel = useMemo(
    () =>
      new Intl.DateTimeFormat(undefined, {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
      }).format(new Date()),
    [],
  )

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      const tag = target?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || target?.isContentEditable) return

      if (event.key === '?' && !event.metaKey && !event.ctrlKey) {
        event.preventDefault()
        setShortcutsOpen(true)
        return
      }
      if (event.key === 'Escape') {
        if (fullscreenId) {
          event.preventDefault()
          setFullscreenId(null)
          return
        }
        if (paletteOpen) {
          setPaletteOpen(false)
          return
        }
        if (editMode) setEditMode(false)
        return
      }
      if (event.key === 'e' || event.key === 'E') {
        event.preventDefault()
        setEditMode((v) => !v)
        return
      }
      if (event.key === '/') {
        event.preventDefault()
        document
          .querySelector<HTMLInputElement>('[data-global-search-input], input[type="search"]')
          ?.focus()
        return
      }
      if (event.key === 'g' || event.key === 'G') {
        goChord.current = true
        window.setTimeout(() => {
          goChord.current = false
        }, 800)
        return
      }
      if (goChord.current) {
        const k = event.key.toLowerCase()
        if (k === 'd') navigate('/dashboard')
        if (k === 'i') navigate('/inbox')
        if (k === 'l') navigate('/listings')
        if (k === 'c') navigate('/contacts')
        if (k === 't') navigate('/tasks')
        goChord.current = false
        return
      }
      if (/^[1-9]$/.test(event.key)) {
        const index = Number(event.key) - 1
        const id = layout[index]?.i
        if (id) {
          event.preventDefault()
          setFullscreenId(fullscreenId === id ? null : id)
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [editMode, fullscreenId, layout, navigate, paletteOpen, setFullscreenId])

  const unreadThreads = useMemo(
    () =>
      live.conversations
        .filter((c) => Number(c.unread_count || 0) > 0)
        .slice(0, 5),
    [live.conversations],
  )

  const recentListings = useMemo(() => live.listings.slice(0, 8), [live.listings])

  const todayTasks = useMemo(() => {
    const ops = live.operations as { tasks?: { due_today?: unknown[]; overdue?: unknown[] } } | null
    const due = ops?.tasks?.due_today || ops?.tasks?.overdue
    if (Array.isArray(due) && due.length) return due.slice(0, 6)
    return live.viewings.slice(0, 6)
  }, [live.operations, live.viewings])

  const funnel = useMemo(() => {
    const leads = live.inquiries.length
    const viewings = live.viewings.length
    const offers = live.inquiries.filter((i) =>
      ['negotiating', 'closed_won'].includes(String(i.status || '')),
    ).length
    const closed = live.inquiries.filter((i) => String(i.status) === 'closed_won').length
    return [
      { label: 'Leads', value: leads },
      { label: 'Viewings', value: viewings },
      { label: 'Offers', value: offers },
      { label: 'Closed', value: closed },
    ]
  }, [live.inquiries, live.viewings])

  const pipelineValue = Number(
    (live.operations as { pipeline?: { total_value?: number } } | null)?.pipeline?.total_value || 0,
  )
  const bazaarLeads = live.inquiries.filter((i) =>
    String(i.source || i.platform || '').toLowerCase().includes('bazaar'),
  ).length
  const bazaarListings = live.listings.filter(
    (p) => p.marketplace_syndicated === true || p.marketplace_syndicated === 1,
  ).length
  const urgentItems = useMemo(() => {
    const ops = live.operations as {
      sla_breached_count?: number
      overdue_follow_ups?: number
      tasks?: { overdue?: Array<{ id?: string; title?: string; label?: string }> }
      todays_viewings?: Array<{ id?: string; client_name?: string; property_title?: string; scheduled_at?: string }>
    } | null
    const rows: Array<{ id: string; title: string; status: string }> = []
    const sla = Number(ops?.sla_breached_count || 0)
    if (sla > 0) rows.push({ id: 'sla', title: `${sla} SLA-breached inquir${sla === 1 ? 'y' : 'ies'}`, status: 'urgent' })
    for (const task of ops?.tasks?.overdue?.slice(0, 3) || []) {
      rows.push({
        id: String(task.id || task.title),
        title: String(task.title || task.label || 'Overdue task'),
        status: 'overdue',
      })
    }
    for (const viewing of ops?.todays_viewings?.slice(0, 3) || []) {
      rows.push({
        id: String(viewing.id),
        title: String(viewing.property_title || viewing.client_name || 'Viewing'),
        status: 'today',
      })
    }
    if (rows.length === 0) {
      return live.inquiries.slice(0, 4).map((inq) => ({
        id: String(inq.id),
        title: String(inq.name || inq.contact_name || inq.message || 'Inquiry'),
        status: String(inq.status || 'new'),
      }))
    }
    return rows
  }, [live.operations, live.inquiries])

  const renderWidget = (id: string) => {
    switch (id) {
      case 'kpi-active':
        return (
          <KpiCard
            label="Active listings"
            value={live.stats.activeListings}
            delta={{ direction: 'up', label: 'Live count' }}
            onClick={() => navigate('/listings')}
          />
        )
      case 'kpi-views':
        return (
          <KpiCard
            label="Views (MTD)"
            value={live.stats.totalViews}
            delta={{ direction: 'up', label: 'From dashboard stats' }}
          />
        )
      case 'kpi-inquiries':
        return (
          <KpiCard
            label="Inquiries"
            value={live.stats.inquiries}
            delta={{ direction: 'flat', label: 'Open pipeline' }}
            onClick={() => navigate('/inbox')}
          />
        )
      case 'kpi-pipeline':
        return (
          <KpiCard
            label="Pipeline value"
            value={pipelineValue}
            delta={{
              direction: pipelineValue > 0 ? 'up' : 'flat',
              label: `${Number((live.operations as { pipeline?: { open_opportunities?: number } } | null)?.pipeline?.open_opportunities || 0)} open`,
            }}
            onClick={() => navigate('/opportunities')}
          />
        )
      case 'kpi-bazaar':
        return (
          <KpiCard
            label="Bazaar-driven leads"
            value={bazaarLeads || bazaarListings}
            delta={{ direction: 'flat', label: `${bazaarListings} syndicated listings` }}
          />
        )
      case 'urgent':
        return (
          <div className="space-y-2">
            {urgentItems.length === 0 ? (
              <p className="text-[var(--lc-text-muted)]" style={{ font: 'var(--lc-type-body-sm)' }}>
                No urgent items right now.
              </p>
            ) : (
              urgentItems.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-2 border-b border-[var(--lc-border)] py-1"
                >
                  <span className="truncate" style={{ font: 'var(--lc-type-body-sm)' }}>
                    {item.title}
                  </span>
                  <Badge variant="secondary">{item.status}</Badge>
                </div>
              ))
            )}
            <Link to="/inbox" className="inline-flex text-[var(--lc-text-brand)]" style={{ font: 'var(--lc-type-body-sm)' }}>
              Open inbox
            </Link>
          </div>
        )
      case 'quota': {
        const ops = live.operations as {
          pending_viewings?: number
          tasks?: { due_today_count?: number; overdue_count?: number }
        } | null
        return (
          <div>
            <p className="text-[var(--lc-text-muted)]" style={{ font: 'var(--lc-type-body-sm)' }}>
              Today&apos;s operational load
            </p>
            <div className="mt-[var(--lc-space-sm)] flex flex-wrap gap-4">
              <div>
                <div className="text-[var(--lc-text-muted)]" style={{ font: 'var(--lc-type-caption)' }}>Due today</div>
                <Numeric style={{ font: 'var(--lc-type-data)' }}>{ops?.tasks?.due_today_count ?? 0}</Numeric>
              </div>
              <div>
                <div className="text-[var(--lc-text-muted)]" style={{ font: 'var(--lc-type-caption)' }}>Overdue</div>
                <Numeric style={{ font: 'var(--lc-type-data)' }}>{ops?.tasks?.overdue_count ?? 0}</Numeric>
              </div>
              <div>
                <div className="text-[var(--lc-text-muted)]" style={{ font: 'var(--lc-type-caption)' }}>Viewings</div>
                <Numeric style={{ font: 'var(--lc-type-data)' }}>{ops?.pending_viewings ?? live.viewings.length}</Numeric>
              </div>
            </div>
            <Link to="/tasks" className="mt-2 inline-flex text-[var(--lc-text-brand)]" style={{ font: 'var(--lc-type-caption)' }}>
              Open tasks
            </Link>
          </div>
        )
      }
      case 'recent-listings':
        return (
          <div className="flex gap-3 overflow-x-auto pb-1">
            {recentListings.length === 0 ? (
              <p className="text-[var(--lc-text-muted)]" style={{ font: 'var(--lc-type-body-sm)' }}>
                No listings yet.
              </p>
            ) : (
              recentListings.map((p) => (
                <Link
                  key={String(p.id)}
                  to={`/listings/${p.id}`}
                  className="min-w-[160px] shrink-0 rounded-[var(--lc-radius-md)] border border-[var(--lc-border)] p-2 hover:bg-[var(--lc-surface-selected)]"
                >
                  <div className="line-clamp-2 text-[var(--lc-text-primary)]" style={{ font: 'var(--lc-type-body-sm)' }}>
                    {String(p.title || 'Listing')}
                  </div>
                  <div className="mt-1 text-[var(--lc-text-muted)]">
                    <Numeric style={{ font: 'var(--lc-type-data-sm)' }}>
                      {formatPrice(
                        Number(p.price) || 0,
                        p.type === 'rent' ? 'rent' : 'sale',
                        String(p.price_unit || ''),
                      )}
                    </Numeric>
                  </div>
                </Link>
              ))
            )}
          </div>
        )
      case 'inbox-preview':
        return (
          <ul className="space-y-2">
            {unreadThreads.length === 0 ? (
              <li className="text-[var(--lc-text-muted)]" style={{ font: 'var(--lc-type-body-sm)' }}>
                No unread threads.
              </li>
            ) : (
              unreadThreads.map((c) => (
                <li key={String(c.id)} className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate" style={{ font: 'var(--lc-type-body-sm)' }}>
                      {String(c.contact_name || c.title || 'Thread')}
                    </div>
                    <div className="truncate text-[var(--lc-text-muted)]" style={{ font: 'var(--lc-type-caption)' }}>
                      {String(c.last_message || c.snippet || '')}
                    </div>
                  </div>
                  <Badge variant="secondary">{String(c.platform || c.source || 'inbox')}</Badge>
                </li>
              ))
            )}
          </ul>
        )
      case 'tasks':
        return (
          <ul className="space-y-2">
            {todayTasks.length === 0 ? (
              <li className="text-[var(--lc-text-muted)]" style={{ font: 'var(--lc-type-body-sm)' }}>
                No tasks for today.
              </li>
            ) : (
              todayTasks.map((t, idx) => (
                <li key={String((t as { id?: string }).id || idx)} className="flex justify-between gap-2 border-b border-[var(--lc-border)] py-1">
                  <span className="truncate" style={{ font: 'var(--lc-type-body-sm)' }}>
                    {String(
                      (t as { title?: string; property_title?: string }).title ||
                        (t as { property_title?: string }).property_title ||
                        'Task',
                    )}
                  </span>
                  <span className="text-[var(--lc-text-muted)]" style={{ font: 'var(--lc-type-caption)' }}>
                    {String((t as { status?: string; scheduled_at?: string }).status || (t as { scheduled_at?: string }).scheduled_at || '')}
                  </span>
                </li>
              ))
            )}
          </ul>
        )
      case 'funnel':
        return (
          <div className="space-y-2">
            {funnel.map((stage) => {
              const max = Math.max(...funnel.map((f) => f.value), 1)
              const pct = Math.round((stage.value / max) * 100)
              return (
                <div key={stage.label}>
                  <div className="mb-1 flex justify-between" style={{ font: 'var(--lc-type-caption)' }}>
                    <span>{stage.label}</span>
                    <Numeric>{stage.value}</Numeric>
                  </div>
                  <div className="h-2 rounded-pill bg-[var(--lc-surface-sunken)]">
                    <div
                      className="h-2 rounded-pill bg-[var(--lc-action-primary)]"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        )
      case 'activity':
        return (
          <ul className="space-y-1">
            {live.inquiries.slice(0, 8).map((inq) => (
              <li key={String(inq.id)} className="flex justify-between gap-2 border-b border-[var(--lc-border)] py-1">
                <span className="truncate" style={{ font: 'var(--lc-type-body-sm)' }}>
                  Inquiry · {String(inq.name || inq.contact_name || inq.id)}
                </span>
                <span className="text-[var(--lc-text-muted)]" style={{ font: 'var(--lc-type-caption)' }}>
                  {String(inq.created_at || inq.status || '')}
                </span>
              </li>
            ))}
            {live.inquiries.length === 0 ? (
              <li className="text-[var(--lc-text-muted)]" style={{ font: 'var(--lc-type-body-sm)' }}>
                Activity feed empty.
              </li>
            ) : null}
          </ul>
        )
      case 'calendar':
        return (
          <ul className="space-y-2">
            {live.viewings.slice(0, 7).map((v) => (
              <li key={String(v.id)} className="flex justify-between gap-2">
                <span style={{ font: 'var(--lc-type-body-sm)' }}>
                  {String(v.property_title || v.title || 'Viewing')}
                </span>
                <span className="text-[var(--lc-text-muted)]" style={{ font: 'var(--lc-type-caption)' }}>
                  {String(v.scheduled_at || '')}
                </span>
              </li>
            ))}
            {live.viewings.length === 0 ? (
              <li className="text-[var(--lc-text-muted)]" style={{ font: 'var(--lc-type-body-sm)' }}>
                No upcoming viewings.
              </li>
            ) : null}
          </ul>
        )
      default:
        return (
          <p className="text-[var(--lc-text-muted)]" style={{ font: 'var(--lc-type-body-sm)' }}>
            Widget unavailable.
          </p>
        )
    }
  }

  return (
    <div
      className={className}
      data-testid="pro-dashboard"
      data-density={density}
      data-screen="AGT-DSH-002"
    >
      <QuickActionsBar
        density={density}
        onDensityChange={setDensity}
        saveState={saveState}
        onAction={(id) => {
          if (id === 'listing') navigate('/listings?view=table&create=1')
          if (id === 'inbox') navigate('/inbox')
          if (id === 'contact') navigate('/contacts')
          if (id === 'task') navigate('/tasks')
          if (id === 'publish') navigate('/listings?view=table')
          if (id === 'search') {
            document
              .querySelector<HTMLInputElement>('[data-global-search-input], input[type="search"]')
              ?.focus()
          }
          if (id === 'add-widget') setPaletteOpen(true)
        }}
      />

      <div className="px-[var(--lc-space-md)] py-[var(--lc-space-lg)] lg:px-[var(--lc-space-xl)]">
        <div className="mb-[var(--lc-space-lg)] flex flex-wrap items-end justify-between gap-[var(--lc-space-md)]">
          <div>
            <h1
              className="text-[var(--lc-text-heading)]"
              style={{ font: 'var(--lc-type-heading-2)', letterSpacing: 'var(--lc-tracking-heading-2)' }}
            >
              {greeting}, {name}
            </h1>
            <p className="mt-1 text-[var(--lc-text-muted)]" style={{ font: 'var(--lc-type-body-sm)' }}>
              {dateLabel}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="capitalize">
              {activeTenant?.kind === 'agency' ? 'Agency' : 'Personal'}
              {activeTenant?.name ? ` · ${activeTenant.name}` : ''}
            </Badge>
            <button
              type="button"
              className="min-h-tap rounded-[var(--lc-radius-md)] border border-[var(--lc-border)] px-3 text-[var(--lc-text-muted)]"
              style={{ font: 'var(--lc-type-caption)' }}
              onClick={() => {
                if (window.confirm('Reset dashboard to default layout? Your current arrangement will be lost.')) {
                  resetLayout()
                }
              }}
            >
              Reset layout
            </button>
          </div>
        </div>

        {layout.length === 0 ? (
          <div className="rounded-[var(--lc-radius-lg)] border border-dashed border-[var(--lc-border)] px-[var(--lc-space-xl)] py-[var(--lc-space-3xl)] text-center">
            <p style={{ font: 'var(--lc-type-heading-3)' }} className="text-[var(--lc-text-heading)]">
              No widgets yet. Press `Add widget +` or use `/` to search.
            </p>
            <button
              type="button"
              className="mt-4 min-h-tap rounded-[var(--lc-radius-md)] bg-[var(--lc-action-primary)] px-4 text-[var(--lc-action-primary-text)]"
              onClick={() => setPaletteOpen(true)}
            >
              Add widget
            </button>
          </div>
        ) : (
          <div ref={gridHostRef}>
            <WidgetGrid
              layout={layout}
              editMode={editMode}
              density={density}
              fullscreenId={fullscreenId}
              onLayoutChange={setLayout}
              onFullscreen={setFullscreenId}
              onRemove={removeWidget}
              renderWidget={renderWidget}
              titles={WIDGET_TITLES}
              width={gridWidth}
            />
          </div>
        )}
      </div>

      <WidgetPaletteDrawer
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        presentIds={layout.map((l) => l.i)}
        onAdd={(id, defaults) => {
          addWidget(id, defaults)
          setPaletteOpen(false)
        }}
      />

      <Dialog open={shortcutsOpen} onOpenChange={setShortcutsOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Keyboard shortcuts</DialogTitle>
          </DialogHeader>
          <ul className="space-y-2">
            {SHORTCUTS.map((row) => (
              <li key={row.keys} className="flex items-center justify-between gap-4">
                <span style={{ font: 'var(--lc-type-body-sm)' }}>{row.label}</span>
                <kbd
                  className="rounded-[var(--lc-radius-sm)] bg-[var(--lc-surface-sunken)] px-2 py-1 text-[var(--lc-text-primary)]"
                  style={{ font: 'var(--lc-type-data-sm)' }}
                >
                  {row.keys}
                </kbd>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[var(--lc-text-muted)]" style={{ font: 'var(--lc-type-caption)' }}>
            Press `?` any time to reopen
          </p>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export { KpiCard, QuickActionsBar, WidgetCard } from './pro/ProDashboardParts'
export type { DashboardDensity, KpiCardProps, WidgetCardProps, QuickActionsBarProps } from './pro/ProDashboardParts'
