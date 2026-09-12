import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { useTenant } from '@/hooks/useTenant'
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
  type DashboardDensity,
} from './pro/ProDashboardParts'

export interface ProDashboardProps {
  /** Optional stats override (tests / Agent 5 mount). */
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

function greetingForHour(hour: number): string {
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

/**
 * AGT-DSH-002 — Pro dashboard delta (tablet + desktop ≥768px).
 *
 * Agent 5 owns mounting this from AGT-DSH-001 / AgentDashboardPage when
 * `ui_mode === 'pro'` AND viewport ≥768px. Export is stable for that mount.
 *
 * TODO(Agent 5 / feat/wave-8-dsh-mount): in AgentDashboardPage, when
 * `useUiMode().effectiveMode === 'pro'`, render `<ProDashboard />` instead of
 * the Guided shell. Do not mount Pro below 768px.
 */
export function ProDashboard({ stats, greetingName, className }: ProDashboardProps) {
  const { agent } = useAuth()
  const { activeTenant } = useTenant()
  const navigate = useNavigate()
  const [density, setDensity] = useState<DashboardDensity>('comfortable')
  const [shortcutsOpen, setShortcutsOpen] = useState(false)

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

  const kpis = [
    {
      label: 'Active listings',
      value: stats?.activeListings ?? stats?.listings ?? 0,
      delta: { direction: 'up' as const, label: '+3 vs last week' },
    },
    {
      label: 'Views (MTD)',
      value: stats?.totalViews ?? 0,
      delta: { direction: 'up' as const, label: '+12% vs last month' },
    },
    {
      label: 'Inquiries',
      value: stats?.inquiries ?? 0,
      delta: { direction: 'down' as const, label: '−2 vs yesterday' },
    },
    {
      label: 'Pipeline value',
      value: '—',
      delta: { direction: 'flat' as const, label: 'Estimate pending' },
    },
  ]

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      const tag = target?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || target?.isContentEditable) return
      if (event.key === '?' && !event.metaKey && !event.ctrlKey) {
        event.preventDefault()
        setShortcutsOpen(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const densityPad =
    density === 'compact' ? 'gap-[var(--lc-space-sm)]' : density === 'spacious' ? 'gap-[var(--lc-space-xl)]' : 'gap-[var(--lc-space-md)]'

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
        onAction={(id) => {
          if (id === 'listing') navigate('/listings')
          if (id === 'inbox') navigate('/inbox')
          if (id === 'contact') navigate('/contacts')
          if (id === 'search') {
            const input = document.querySelector<HTMLInputElement>('[data-global-search-input], input[type="search"]')
            input?.focus()
          }
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
          <Badge variant="secondary" className="capitalize">
            {activeTenant?.kind === 'agency' ? 'Agency' : 'Personal'}
            {activeTenant?.name ? ` · ${activeTenant.name}` : ''}
          </Badge>
        </div>

        <div className={`grid grid-cols-12 ${densityPad}`}>
          {kpis.map((kpi) => (
            <KpiCard
              key={kpi.label}
              className="col-span-12 sm:col-span-6 lg:col-span-3"
              label={kpi.label}
              value={kpi.value}
              delta={kpi.delta}
              onClick={kpi.label === 'Active listings' ? () => navigate('/listings') : undefined}
            />
          ))}

          <WidgetCard title="Urgent" span={8}>
            <p className="text-[var(--lc-text-secondary)]" style={{ font: 'var(--lc-type-body)' }}>
              Same urgent signals as Guided — denser layout for power users.
            </p>
            <Link
              to="/inbox"
              className="mt-[var(--lc-space-sm)] inline-flex text-[var(--lc-text-brand)]"
              style={{ font: 'var(--lc-type-body-sm)' }}
            >
              Open inbox
            </Link>
          </WidgetCard>

          <WidgetCard title="Quota" span={4}>
            <p className="text-[var(--lc-text-muted)]" style={{ font: 'var(--lc-type-body-sm)' }}>
              Credits & channel headroom
            </p>
            <div className="mt-[var(--lc-space-sm)]">
              <Numeric style={{ font: 'var(--lc-type-data)' }}>—</Numeric>
            </div>
          </WidgetCard>

          <WidgetCard title="Recent listings" span={6}>
            <p className="text-[var(--lc-text-muted)]" style={{ font: 'var(--lc-type-body-sm)' }}>
              Horizontal browse lives here once Agent 5 mounts live listing data.
            </p>
            <Link to="/listings" className="mt-[var(--lc-space-sm)] inline-flex text-[var(--lc-text-brand)]">
              View listings
            </Link>
          </WidgetCard>

          <WidgetCard title="Inbox preview" span={6}>
            <p className="text-[var(--lc-text-muted)]" style={{ font: 'var(--lc-type-body-sm)' }}>
              Last unread threads appear here when inbox Wave-8 lands.
            </p>
          </WidgetCard>

          <WidgetCard title="Today's tasks" span={6}>
            <p className="text-[var(--lc-text-muted)]" style={{ font: 'var(--lc-type-body-sm)' }}>
              Dense task rows — shared data with Guided Zone 6.
            </p>
          </WidgetCard>

          <WidgetCard title="Funnel" span={6}>
            <p className="text-[var(--lc-text-muted)]" style={{ font: 'var(--lc-type-body-sm)' }}>
              Leads → viewings → offers → closed
            </p>
          </WidgetCard>

          <WidgetCard title="Recent activity" span={12}>
            <p className="text-[var(--lc-text-muted)]" style={{ font: 'var(--lc-type-body-sm)' }}>
              Activity stream (filterable) — same feed endpoints as Guided.
            </p>
          </WidgetCard>
        </div>
      </div>

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
