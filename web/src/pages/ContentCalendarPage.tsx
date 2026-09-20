/**
 * Wave 2B — Publishing control plane / content calendar.
 * data-screen="PUB-CAL-001"
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { useVirtualizer } from '@tanstack/react-virtual'
import {
  AlertTriangle,
  CalendarDays,
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  Eye,
  List,
  Loader2,
  RefreshCw,
  ShieldAlert,
  X,
} from 'lucide-react'
import {
  api,
  type CalendarExecution,
  type PublishingPreviewResponse,
  type PublishingValidationResponse,
} from '@/api/client'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/context/AuthContext'
import { useLocale } from '@/hooks/useLocale'
import { usePageTitle } from '@/lib/usePageTitle'
import { useToast } from '@/components/ui/toast'
import { cn } from '@/lib/utils'
import { resolveLcStatus, lcStatusClasses } from '@/theme/status'

type ViewMode = 'month' | 'week' | 'day' | 'list'
type LoadState = 'loading' | 'ready' | 'error' | 'forbidden' | 'empty'

const KIND_OPTIONS = [
  { value: 'message', label: 'Message' },
  { value: 'social_post', label: 'Social' },
  { value: 'paid_ad', label: 'Paid' },
  { value: 'portal_submit', label: 'Portal' },
  { value: 'seo_page', label: 'SEO' },
]

const STATUS_OPTIONS = [
  { value: 'draft', label: 'Draft' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'in_review', label: 'In review' },
  { value: 'queued', label: 'Queued' },
  { value: 'processing', label: 'Processing' },
  { value: 'published', label: 'Published' },
  { value: 'failed', label: 'Failed' },
  { value: 'cancelled', label: 'Cancelled' },
]

export type CalendarFilters = {
  status: string[]
  kind: string[]
  campaign_id: string
  property_id: string
  agent_id: string
  channel_connection_id: string
  office: string
}

const EMPTY_FILTERS: CalendarFilters = {
  status: [],
  kind: [],
  campaign_id: '',
  property_id: '',
  agent_id: '',
  channel_connection_id: '',
  office: '',
}

function startOfDay(d: Date) {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

function addDays(d: Date, n: number) {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}

function startOfWeek(d: Date) {
  const x = startOfDay(d)
  const day = x.getDay()
  return addDays(x, -day)
}

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

function endOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999)
}

function toIso(d: Date) {
  return d.toISOString()
}

function dayKey(d: Date | string | null | undefined) {
  if (!d) return 'unscheduled'
  const date = typeof d === 'string' ? new Date(d) : d
  if (Number.isNaN(date.getTime())) return 'unscheduled'
  return date.toISOString().slice(0, 10)
}

function formatDayLabel(isoDay: string, locale: string) {
  if (isoDay === 'unscheduled') return 'Unscheduled'
  const d = new Date(`${isoDay}T12:00:00.000Z`)
  return d.toLocaleDateString(locale, { weekday: 'short', month: 'short', day: 'numeric' })
}

function StatusChip({ status }: { status: string }) {
  const lc = resolveLcStatus(status)
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-[var(--lc-radius-sm)] px-2 py-0.5 text-[11px] font-semibold capitalize',
        lcStatusClasses(lc),
      )}
    >
      {status.replace(/_/g, ' ')}
    </span>
  )
}

function ExecutionChip({
  execution,
  selected,
  onSelect,
  dragging,
}: {
  execution: CalendarExecution
  selected?: boolean
  onSelect?: () => void
  dragging?: boolean
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: execution.id,
    disabled: !execution.reschedulable,
    data: { execution },
  })

  return (
    <button
      ref={setNodeRef}
      type="button"
      {...listeners}
      {...attributes}
      onClick={(e) => {
        e.stopPropagation()
        onSelect?.()
      }}
      className={cn(
        'flex w-full items-start gap-2 rounded-[var(--lc-radius-sm)] border border-[var(--lc-border)]',
        'bg-[var(--lc-surface-raised)] px-2 py-1.5 text-left text-xs',
        'hover:border-[var(--lc-action-primary)] focus-visible:outline focus-visible:outline-2',
        'focus-visible:outline-offset-2 focus-visible:outline-[var(--lc-action-primary)]',
        selected && 'border-[var(--lc-action-primary)] bg-[var(--lc-action-secondary)]',
        (isDragging || dragging) && 'opacity-40',
        execution.reschedulable ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer',
      )}
      aria-grabbed={isDragging}
      aria-label={`${String(execution.kind).replace(/_/g, ' ')} ${execution.status}`}
      data-testid={`execution-chip-${execution.id}`}
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1">
          <StatusChip status={execution.status} />
          <Badge variant="outline" className="text-[10px] capitalize">
            {String(execution.kind).replace(/_/g, ' ')}
          </Badge>
        </div>
        <div className="mt-1 truncate text-[var(--lc-text-secondary)]">
          {execution.subject_id || execution.campaign_id || execution.id}
        </div>
      </div>
    </button>
  )
}

function DayDropCell({
  day,
  children,
  className,
}: {
  day: string
  children: ReactNode
  className?: string
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `day:${day}`, data: { day } })
  return (
    <div
      ref={setNodeRef}
      className={cn(
        className,
        isOver && 'bg-[var(--lc-action-secondary)] ring-1 ring-[var(--lc-action-primary)]',
      )}
    >
      {children}
    </div>
  )
}

function FilterField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
}) {
  const id = `cal-filter-${label.replace(/\s+/g, '-').toLowerCase()}`
  return (
    <label className="flex min-w-[9rem] flex-1 flex-col gap-1 text-xs font-medium text-[var(--lc-text-secondary)]">
      {label}
      <Input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-9 bg-[var(--lc-surface-raised)]"
      />
    </label>
  )
}

function MultiToggle({
  label,
  options,
  selected,
  onToggle,
}: {
  label: string
  options: { value: string; label: string }[]
  selected: string[]
  onToggle: (value: string) => void
}) {
  return (
    <fieldset className="min-w-0">
      <legend className="mb-1 text-xs font-medium text-[var(--lc-text-secondary)]">{label}</legend>
      <div className="flex flex-wrap gap-1">
        {options.map((opt) => {
          const active = selected.includes(opt.value)
          return (
            <button
              key={opt.value}
              type="button"
              aria-pressed={active}
              onClick={() => onToggle(opt.value)}
              className={cn(
                'min-h-tap rounded-[var(--lc-radius-pill)] border px-3 text-xs font-semibold',
                active
                  ? 'border-[var(--lc-action-primary)] bg-[var(--lc-action-secondary)] text-[var(--lc-text-primary)]'
                  : 'border-[var(--lc-border)] bg-[var(--lc-surface-raised)] text-[var(--lc-text-primary)]',
              )}
            >
              {opt.label}
            </button>
          )
        })}
      </div>
    </fieldset>
  )
}

export function ContentCalendarPage() {
  const { agent, loading: authLoading } = useAuth()
  const { addToast } = useToast()
  const { dir, locale } = useLocale()
  usePageTitle('Content calendar')

  const [view, setView] = useState<ViewMode>('month')
  const [anchor, setAnchor] = useState(() => startOfDay(new Date()))
  const [filters, setFilters] = useState<CalendarFilters>(EMPTY_FILTERS)
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [executions, setExecutions] = useState<CalendarExecution[]>([])
  const [total, setTotal] = useState(0)
  const [unsupported, setUnsupported] = useState<string[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [activeId, setActiveId] = useState<string | null>(null)
  const [selected, setSelected] = useState<CalendarExecution | null>(null)
  const [preview, setPreview] = useState<PublishingPreviewResponse | null>(null)
  const [validation, setValidation] = useState<PublishingValidationResponse | null>(null)
  const [panelLoading, setPanelLoading] = useState(false)
  const listParentRef = useRef<HTMLDivElement>(null)

  const affiliation =
    (agent?.affiliation as { agency_id?: string; role?: string } | undefined) || undefined
  const hasAgency = Boolean(affiliation?.agency_id)

  const range = useMemo(() => {
    if (view === 'day') {
      const from = startOfDay(anchor)
      return { from: toIso(from), to: toIso(addDays(from, 1)) }
    }
    if (view === 'week') {
      const from = startOfWeek(anchor)
      return { from: toIso(from), to: toIso(addDays(from, 7)) }
    }
    if (view === 'list') {
      const from = startOfMonth(anchor)
      return { from: toIso(from), to: toIso(endOfMonth(anchor)) }
    }
    const from = startOfWeek(startOfMonth(anchor))
    const end = addDays(startOfWeek(endOfMonth(anchor)), 7)
    return { from: toIso(from), to: toIso(end) }
  }, [view, anchor])

  const load = useCallback(async () => {
    if (!hasAgency) {
      setLoadState('forbidden')
      return
    }
    setLoadState('loading')
    try {
      const payload = await api.getPublishingCalendar({
        from: range.from,
        to: range.to,
        status: filters.status.length ? filters.status.join(',') : undefined,
        kind: filters.kind.length ? filters.kind.join(',') : undefined,
        campaign_id: filters.campaign_id || undefined,
        property_id: filters.property_id || undefined,
        agent_id: filters.agent_id || undefined,
        channel_connection_id: filters.channel_connection_id || undefined,
        office: filters.office || undefined,
        limit: 2000,
      })
      setExecutions(payload.executions)
      setTotal(payload.total)
      setUnsupported(payload.meta?.unsupported_filters || [])
      setLoadState(payload.executions.length ? 'ready' : 'empty')
    } catch (err) {
      const status = (err as { status?: number })?.status
      if (status === 403) setLoadState('forbidden')
      else {
        setLoadState('error')
        addToast({
          variant: 'error',
          title: 'Could not load calendar',
          description: err instanceof Error ? err.message : 'Unknown error',
        })
      }
    }
  }, [hasAgency, range.from, range.to, filters, addToast])

  useEffect(() => {
    if (authLoading) return
    void load()
  }, [authLoading, load])

  const byDay = useMemo(() => {
    const map = new Map<string, CalendarExecution[]>()
    for (const exec of executions) {
      const key = dayKey(exec.scheduled_at)
      const list = map.get(key) || []
      list.push(exec)
      map.set(key, list)
    }
    return map
  }, [executions])

  const monthCells = useMemo(() => {
    const start = startOfWeek(startOfMonth(anchor))
    return Array.from({ length: 42 }, (_, i) => addDays(start, i))
  }, [anchor])

  const weekCells = useMemo(() => {
    const start = startOfWeek(anchor)
    return Array.from({ length: 7 }, (_, i) => addDays(start, i))
  }, [anchor])

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  const applyOptimisticSchedule = useCallback((id: string, scheduledAt: string) => {
    setExecutions((prev) =>
      prev.map((e) =>
        e.id === id
          ? { ...e, scheduled_at: scheduledAt, status: e.status === 'draft' ? 'scheduled' : e.status }
          : e,
      ),
    )
    setSelected((prev) =>
      prev?.id === id
        ? {
            ...prev,
            scheduled_at: scheduledAt,
            status: prev.status === 'draft' ? 'scheduled' : prev.status,
          }
        : prev,
    )
  }, [])

  const rollbackSchedule = useCallback((snapshot: CalendarExecution[]) => {
    setExecutions(snapshot)
  }, [])

  const rescheduleToDay = useCallback(
    async (execution: CalendarExecution, day: string) => {
      if (!execution.reschedulable) {
        addToast({
          variant: 'error',
          title: 'Cannot reschedule',
          description: `Status ${execution.status} is not reschedulable`,
        })
        return
      }
      const previous = executions
      const base = execution.scheduled_at ? new Date(execution.scheduled_at) : new Date(`${day}T09:00:00.000Z`)
      const [y, m, d] = day.split('-').map(Number)
      const next = new Date(base)
      next.setFullYear(y, m - 1, d)
      const iso = next.toISOString()
      applyOptimisticSchedule(execution.id, iso)
      try {
        const { execution: updated } = await api.reschedulePublishingExecution(execution.id, {
          scheduled_at: iso,
        })
        setExecutions((prev) => prev.map((e) => (e.id === updated.id ? { ...e, ...updated } : e)))
      } catch (err) {
        rollbackSchedule(previous)
        addToast({
          variant: 'error',
          title: 'Reschedule failed',
          description: err instanceof Error ? err.message : 'Rolled back',
        })
      }
    },
    [executions, addToast, applyOptimisticSchedule, rollbackSchedule],
  )

  const onDragStart = (event: DragStartEvent) => {
    setActiveId(String(event.active.id))
  }

  const onDragEnd = async (event: DragEndEvent) => {
    setActiveId(null)
    const overId = event.over?.id ? String(event.over.id) : null
    if (!overId?.startsWith('day:')) return
    const day = overId.slice(4)
    const execution = executions.find((e) => e.id === event.active.id)
    if (!execution) return
    if (dayKey(execution.scheduled_at) === day) return
    await rescheduleToDay(execution, day)
  }

  const openDetail = async (execution: CalendarExecution) => {
    setSelected(execution)
    setPreview(null)
    setValidation(null)
    setPanelLoading(true)
    try {
      const [prev, val] = await Promise.all([
        api.previewPublishingExecution(execution.id),
        api.validatePublishingExecution(execution.id),
      ])
      setPreview(prev)
      setValidation(val)
    } catch (err) {
      addToast({
        variant: 'error',
        title: 'Preview failed',
        description: err instanceof Error ? err.message : 'Unknown error',
      })
    } finally {
      setPanelLoading(false)
    }
  }

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const bulkCancel = async () => {
    const ids = [...selectedIds]
    if (!ids.length) return
    if (!window.confirm(`Cancel ${ids.length} draft/scheduled execution(s)?`)) return
    try {
      const result = await api.bulkCancelPublishingExecutions({ execution_ids: ids })
      const ok = result.results.filter((r) => r.ok).length
      addToast({ variant: 'success', title: `Cancelled ${ok} of ${ids.length}` })
      setSelectedIds(new Set())
      await load()
    } catch (err) {
      addToast({
        variant: 'error',
        title: 'Bulk cancel failed',
        description: err instanceof Error ? err.message : 'Unknown error',
      })
    }
  }

  const bulkReschedule = async () => {
    const ids = [...selectedIds]
    if (!ids.length) return
    const raw = window.prompt('New schedule (ISO datetime)', new Date().toISOString())
    if (!raw) return
    try {
      const result = await api.bulkReschedulePublishingExecutions({
        execution_ids: ids,
        scheduled_at: raw,
      })
      const ok = result.results.filter((r) => r.ok).length
      addToast({ variant: 'success', title: `Rescheduled ${ok} of ${ids.length}` })
      setSelectedIds(new Set())
      await load()
    } catch (err) {
      addToast({
        variant: 'error',
        title: 'Bulk reschedule failed',
        description: err instanceof Error ? err.message : 'Unknown error',
      })
    }
  }

  const listVirtualizer = useVirtualizer({
    count: executions.length,
    getScrollElement: () => listParentRef.current,
    estimateSize: () => 72,
    overscan: 12,
  })

  const activeExecution = activeId ? executions.find((e) => e.id === activeId) : null
  const titleLabel = anchor.toLocaleDateString(locale || undefined, {
    month: 'long',
    year: 'numeric',
    ...(view === 'day' ? { day: 'numeric' } : {}),
  })

  if (authLoading || loadState === 'loading') {
    return (
      <div className="flex min-h-[50vh] items-center justify-center" data-screen="PUB-CAL-001">
        <Loader2 className="h-6 w-6 animate-spin text-[var(--lc-action-primary)]" aria-label="Loading" />
      </div>
    )
  }

  if (loadState === 'forbidden') {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center" data-screen="PUB-CAL-001" dir={dir}>
        <ShieldAlert className="mx-auto mb-3 h-8 w-8 text-[var(--lc-status-unpublished-fg)]" />
        <h1 className="text-xl font-semibold text-[var(--lc-text-primary)]">Agency membership required</h1>
        <p className="mt-2 text-sm text-[var(--lc-text-secondary)]">
          The content calendar is available to agency members.
        </p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6" data-screen="PUB-CAL-001" dir={dir}>
      <header className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--lc-text-primary)]">
            Content calendar
          </h1>
          <p className="mt-1 text-sm text-[var(--lc-text-secondary)]">
            All executions across journeys, social, portals, and paid — {total} in range
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => void load()} aria-label="Refresh">
            <RefreshCw className="h-4 w-4" />
          </Button>
          {(['month', 'week', 'day', 'list'] as ViewMode[]).map((mode) => (
            <Button
              key={mode}
              type="button"
              size="sm"
              variant={view === mode ? 'default' : 'outline'}
              aria-pressed={view === mode}
              onClick={() => setView(mode)}
              className="capitalize"
            >
              {mode === 'list' ? <List className="mr-1 h-3.5 w-3.5" /> : <CalendarDays className="mr-1 h-3.5 w-3.5" />}
              {mode}
            </Button>
          ))}
        </div>
      </header>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          aria-label="Previous period"
          onClick={() =>
            setAnchor((d) =>
              view === 'day' ? addDays(d, -1) : view === 'week' ? addDays(d, -7) : new Date(d.getFullYear(), d.getMonth() - 1, 1),
            )
          }
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="min-w-[10rem] text-center text-sm font-semibold text-[var(--lc-text-primary)]">
          {titleLabel}
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          aria-label="Next period"
          onClick={() =>
            setAnchor((d) =>
              view === 'day' ? addDays(d, 1) : view === 'week' ? addDays(d, 7) : new Date(d.getFullYear(), d.getMonth() + 1, 1),
            )
          }
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => setAnchor(startOfDay(new Date()))}>
          Today
        </Button>
      </div>

      <section
        aria-label="Filters"
        className="mb-4 space-y-3 rounded-[var(--lc-radius-md)] border border-[var(--lc-border)] bg-[var(--lc-surface)] p-3"
      >
        <MultiToggle
          label="Status"
          options={STATUS_OPTIONS}
          selected={filters.status}
          onToggle={(value) =>
            setFilters((f) => ({
              ...f,
              status: f.status.includes(value) ? f.status.filter((s) => s !== value) : [...f.status, value],
            }))
          }
        />
        <MultiToggle
          label="Kind"
          options={KIND_OPTIONS}
          selected={filters.kind}
          onToggle={(value) =>
            setFilters((f) => ({
              ...f,
              kind: f.kind.includes(value) ? f.kind.filter((s) => s !== value) : [...f.kind, value],
            }))
          }
        />
        <div className="flex flex-wrap gap-3">
          <FilterField
            label="Property"
            value={filters.property_id}
            onChange={(v) => setFilters((f) => ({ ...f, property_id: v }))}
            placeholder="prop_…"
          />
          <FilterField
            label="Campaign"
            value={filters.campaign_id}
            onChange={(v) => setFilters((f) => ({ ...f, campaign_id: v }))}
            placeholder="cmp_…"
          />
          <FilterField
            label="Agent"
            value={filters.agent_id}
            onChange={(v) => setFilters((f) => ({ ...f, agent_id: v }))}
            placeholder="agt_…"
          />
          <FilterField
            label="Channel"
            value={filters.channel_connection_id}
            onChange={(v) => setFilters((f) => ({ ...f, channel_connection_id: v }))}
            placeholder="chn_…"
          />
          <FilterField
            label="Office"
            value={filters.office}
            onChange={(v) => setFilters((f) => ({ ...f, office: v }))}
            placeholder="office key"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="outline" onClick={() => setFilters(EMPTY_FILTERS)}>
            Clear filters
          </Button>
          {selectedIds.size > 0 && (
            <>
              <Button type="button" size="sm" onClick={() => void bulkReschedule()}>
                <CheckSquare className="mr-1 h-3.5 w-3.5" />
                Reschedule {selectedIds.size}
              </Button>
              <Button type="button" size="sm" variant="destructive" onClick={() => void bulkCancel()}>
                Cancel {selectedIds.size}
              </Button>
            </>
          )}
        </div>
        {unsupported.length > 0 && (
          <p className="flex items-center gap-2 text-xs text-[var(--lc-status-underOffer-fg)]">
            <AlertTriangle className="h-3.5 w-3.5" />
            Unsupported filters (no office attributes on agents): {unsupported.join(', ')}
          </p>
        )}
      </section>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={(e) => void onDragEnd(e)}>
          {view === 'list' ? (
            <div
              ref={listParentRef}
              className="h-[min(70vh,40rem)] overflow-auto rounded-[var(--lc-radius-md)] border border-[var(--lc-border)] bg-[var(--lc-surface)]"
              role="list"
              aria-label="Execution list"
            >
              {loadState === 'empty' ? (
                <p className="p-8 text-center text-sm text-[var(--lc-text-secondary)]">No executions in this range.</p>
              ) : (
                <div
                  style={{ height: `${listVirtualizer.getTotalSize()}px`, position: 'relative', width: '100%' }}
                >
                  {listVirtualizer.getVirtualItems().map((row) => {
                    const execution = executions[row.index]
                    return (
                      <div
                        key={execution.id}
                        role="listitem"
                        className="absolute left-0 top-0 w-full border-b border-[var(--lc-border)] px-3 py-2"
                        style={{ transform: `translateY(${row.start}px)` }}
                      >
                        <div className="flex items-start gap-2">
                          <input
                            type="checkbox"
                            className="mt-2"
                            checked={selectedIds.has(execution.id)}
                            onChange={() => toggleSelect(execution.id)}
                            aria-label={`Select ${execution.id}`}
                          />
                          <div className="min-w-0 flex-1">
                            <ExecutionChip
                              execution={execution}
                              selected={selected?.id === execution.id}
                              onSelect={() => void openDetail(execution)}
                            />
                            <div className="mt-1 text-[11px] text-[var(--lc-text-secondary)]">
                              {execution.scheduled_at
                                ? new Date(execution.scheduled_at).toLocaleString(locale || undefined)
                                : 'Unscheduled'}
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-[var(--lc-radius-md)] border border-[var(--lc-border)] bg-[var(--lc-surface)] p-2">
              {(view === 'month' ? monthCells : view === 'week' ? weekCells : [anchor]).length > 0 && (
                <div
                  className={cn(
                    'grid gap-1',
                    view === 'month' && 'grid-cols-7',
                    view === 'week' && 'grid-cols-7',
                    view === 'day' && 'grid-cols-1',
                  )}
                >
                  {(view === 'month' ? monthCells : view === 'week' ? weekCells : [anchor]).map((day) => {
                    const key = dayKey(day)
                    const items = byDay.get(key) || []
                    const inMonth = day.getMonth() === anchor.getMonth()
                    return (
                      <DayDropCell
                        key={key}
                        day={key}
                        className={cn(
                          'min-h-[6.5rem] rounded-[var(--lc-radius-sm)] border border-[var(--lc-border)] p-1.5',
                          view === 'month' && !inMonth && 'opacity-50',
                          'bg-[var(--lc-surface-raised)]',
                        )}
                      >
                        <div className="mb-1 text-[11px] font-semibold text-[var(--lc-text-secondary)]">
                          {formatDayLabel(key, locale || undefined)}
                        </div>
                        <div className="flex max-h-40 flex-col gap-1 overflow-y-auto">
                          {items.slice(0, view === 'month' ? 4 : 50).map((execution) => (
                            <ExecutionChip
                              key={execution.id}
                              execution={execution}
                              selected={selected?.id === execution.id}
                              onSelect={() => void openDetail(execution)}
                            />
                          ))}
                          {view === 'month' && items.length > 4 && (
                            <span className="text-[10px] text-[var(--lc-text-secondary)]">
                              +{items.length - 4} more
                            </span>
                          )}
                        </div>
                      </DayDropCell>
                    )
                  })}
                </div>
              )}
              {loadState === 'empty' && (
                <p className="p-6 text-center text-sm text-[var(--lc-text-secondary)]">No executions in this range.</p>
              )}
            </div>
          )}
          <DragOverlay>
            {activeExecution ? <ExecutionChip execution={activeExecution} dragging /> : null}
          </DragOverlay>
        </DndContext>

        <aside
          className="rounded-[var(--lc-radius-md)] border border-[var(--lc-border)] bg-[var(--lc-surface)] p-3"
          aria-label="Execution detail"
        >
          {!selected ? (
            <p className="text-sm text-[var(--lc-text-secondary)]">
              Select an execution for preview and network validation.
            </p>
          ) : (
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="text-sm font-semibold text-[var(--lc-text-primary)]">Quick preview</h2>
                  <p className="text-xs text-[var(--lc-text-secondary)]">{selected.id}</p>
                </div>
                <button
                  type="button"
                  className="rounded-full p-1 hover:bg-[var(--lc-action-secondary)]"
                  aria-label="Close detail"
                  onClick={() => setSelected(null)}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="flex flex-wrap gap-1">
                <StatusChip status={selected.status} />
                <Badge variant="outline" className="capitalize">
                  {String(selected.kind).replace(/_/g, ' ')}
                </Badge>
              </div>
              {selected.reschedulable && (
                <label className="flex flex-col gap-1 text-xs font-medium text-[var(--lc-text-secondary)]">
                  Reschedule
                  <Input
                    type="datetime-local"
                    data-testid="reschedule-input"
                    defaultValue={
                      selected.scheduled_at
                        ? new Date(selected.scheduled_at).toISOString().slice(0, 16)
                        : ''
                    }
                    onChange={(e) => {
                      const value = e.target.value
                      if (!value) return
                      const iso = new Date(value).toISOString()
                      void (async () => {
                        const previous = executions
                        applyOptimisticSchedule(selected.id, iso)
                        try {
                          const { execution: updated } = await api.reschedulePublishingExecution(
                            selected.id,
                            { scheduled_at: iso },
                          )
                          setExecutions((prev) =>
                            prev.map((row) => (row.id === updated.id ? { ...row, ...updated } : row)),
                          )
                          setSelected((prev) =>
                            prev?.id === updated.id ? { ...prev, ...updated } : prev,
                          )
                        } catch (err) {
                          rollbackSchedule(previous)
                          setSelected(previous.find((row) => row.id === selected.id) || selected)
                          addToast({
                            variant: 'error',
                            title: 'Reschedule failed',
                            description: err instanceof Error ? err.message : 'Rolled back',
                          })
                        }
                      })()
                    }}
                  />
                </label>
              )}
              {panelLoading ? (
                <Loader2 className="h-5 w-5 animate-spin text-[var(--lc-action-primary)]" />
              ) : (
                <>
                  {preview?.channels?.map((ch) => (
                    <div key={`${ch.variant_id}-${ch.channel_key}`} className="space-y-2">
                      <div className="flex items-center gap-1 text-xs font-medium text-[var(--lc-text-secondary)]">
                        <Eye className="h-3.5 w-3.5" />
                        {ch.platform || ch.channel_key}
                      </div>
                      {ch.media_urls?.[0] && (
                        <img
                          src={ch.media_urls[0]}
                          alt=""
                          className="max-h-40 w-full rounded-[var(--lc-radius-sm)] object-cover"
                        />
                      )}
                      {ch.caption && (
                        <p className="whitespace-pre-wrap text-sm text-[var(--lc-text-primary)]">{ch.caption}</p>
                      )}
                    </div>
                  ))}
                  <div>
                    <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-[var(--lc-text-secondary)]">
                      Blockers & warnings
                    </h3>
                    {!validation?.blockers?.length && !validation?.warnings?.length ? (
                      <p className="text-sm text-[var(--lc-status-published-fg)]">Ready to publish</p>
                    ) : (
                      <ul className="space-y-1">
                        {validation?.blockers?.map((issue) => (
                          <li
                            key={`b-${issue.code}-${issue.message}`}
                            className="rounded-[var(--lc-radius-sm)] bg-[var(--lc-status-unpublished-bg)] px-2 py-1 text-xs text-[var(--lc-status-unpublished-fg)]"
                          >
                            <strong>Blocker:</strong> {issue.message}
                          </li>
                        ))}
                        {validation?.warnings?.map((issue) => (
                          <li
                            key={`w-${issue.code}-${issue.message}`}
                            className="rounded-[var(--lc-radius-sm)] bg-[var(--lc-status-underOffer-bg)] px-2 py-1 text-xs text-[var(--lc-status-underOffer-fg)]"
                          >
                            <strong>Warning:</strong> {issue.message}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </aside>
      </div>
    </div>
  )
}
