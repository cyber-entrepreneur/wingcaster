import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import {
  Building2,
  Check,
  ChevronsUpDown,
  Loader2,
  Plus,
  Search,
  User,
  UserPlus,
} from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Numeric } from '@/components/ui/numeric'
import { Separator } from '@/components/ui/separator'
import { useToast } from '@/components/ui/toast'
import { useTenant, type TenantRole, type TenantSummary } from '@/hooks/useTenant'
import { cn } from '@/lib/utils'

type Locale = 'en' | 'ar'

type CopyBag = {
  triggerAria: (tenantName: string, roleLabel: string) => string
  header: string
  manage: string
  search: string
  searchLabel: string
  footerCreate: string
  footerJoin: string
  roles: Record<TenantRole | 'you', string>
  personalName: (userDisplayName: string) => string
  metricListings: (count: number) => string
  metricAgents: (count: number) => string
  metricYouPlus: (count: number) => string
  toastSwitched: (tenantName: string) => string
  errorSwitchFailed: string
  noMatches: (query: string) => string
}

const COPY: Record<Locale, CopyBag> = {
  en: {
    triggerAria: (tenantName, roleLabel) => `Switch tenant. Currently ${tenantName}, ${roleLabel}.`,
    header: 'Switch to',
    manage: 'Manage tenants →',
    search: 'Filter tenants…',
    searchLabel: 'Filter tenants',
    footerCreate: 'Create a new agency',
    footerJoin: 'Apply to join an agency',
    roles: {
      you: 'You',
      owner: 'Owner',
      admin: 'Admin',
      manager: 'Manager',
      member: 'Member',
      viewer: 'Viewer',
    },
    personalName: (userDisplayName) => `${userDisplayName} (personal)`,
    metricListings: (count) => (count === 1 ? '1 listing' : `${count} listings`),
    metricAgents: (count) => (count === 1 ? '1 agent' : `${count} agents`),
    metricYouPlus: (count) => (count === 1 ? 'You + 1 other' : `You + ${count} others`),
    toastSwitched: (tenantName) => `Switched to ${tenantName}.`,
    errorSwitchFailed: "Couldn't switch tenants. Please try again.",
    noMatches: (query) => `No tenants match '${query}'`,
  },
  ar: {
    triggerAria: (tenantName, roleLabel) => `تبديل الحساب. الحالي ${tenantName}، ${roleLabel}.`,
    header: 'التبديل إلى',
    manage: 'إدارة الحسابات ←',
    search: 'تصفية الحسابات…',
    searchLabel: 'تصفية الحسابات',
    footerCreate: 'إنشاء وكالة جديدة',
    footerJoin: 'التقديم للانضمام إلى وكالة',
    roles: {
      you: 'أنت',
      owner: 'مالك',
      admin: 'مسؤول',
      manager: 'مدير',
      member: 'عضو',
      viewer: 'مشاهد',
    },
    personalName: (userDisplayName) => `${userDisplayName} (شخصي)`,
    metricListings: (count) => (count === 1 ? 'إعلان واحد' : `${count} إعلان`),
    metricAgents: (count) => (count === 1 ? 'وكيل واحد' : `${count} وكلاء`),
    metricYouPlus: (count) => (count === 1 ? 'أنت + شخص آخر' : `أنت + ${count} آخرون`),
    toastSwitched: (tenantName) => `تم التبديل إلى ${tenantName}.`,
    errorSwitchFailed: 'تعذّر تبديل الحساب. يرجى المحاولة مرة أخرى.',
    noMatches: (query) => `لا حسابات تطابق '${query}'`,
  },
}

const AVATAR_TONES = [
  'var(--lc-status-underOffer-bg)',
  'var(--lc-status-published-bg)',
  'var(--lc-status-closed-bg)',
  'var(--lc-action-secondary)',
  'var(--lc-surface-sunken)',
] as const

function readDocumentLocale(): Locale {
  if (typeof document === 'undefined') return 'en'
  return document.documentElement.lang?.toLowerCase().startsWith('ar') ? 'ar' : 'en'
}

function hashTone(id: string): string {
  let hash = 0
  for (let i = 0; i < id.length; i += 1) hash = (hash * 31 + id.charCodeAt(i)) >>> 0
  return AVATAR_TONES[hash % AVATAR_TONES.length]
}

function initialsFromName(name: string): string {
  const parts = name.replace(/\(.*?\)/g, '').trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase()
}

function displayName(tenant: TenantSummary, copy: CopyBag): string {
  if (tenant.kind !== 'personal') return tenant.name
  const base = tenant.name.replace(/\s*\(personal\)\s*$/i, '').replace(/\s*\(شخصي\)\s*$/i, '').trim()
  return copy.personalName(base || tenant.name)
}

function roleLabel(tenant: TenantSummary, copy: CopyBag): string {
  if (tenant.kind === 'personal') return copy.roles.you
  return copy.roles[tenant.role]
}

function splitCountPhrase(phrase: string, count: number): { before: string; after: string } {
  const token = String(count)
  const idx = phrase.indexOf(token)
  if (idx === -1) return { before: phrase, after: '' }
  return { before: phrase.slice(0, idx), after: phrase.slice(idx + token.length) }
}

function MetricText({ phrase, count }: { phrase: string; count: number }) {
  const { before, after } = splitCountPhrase(phrase, count)
  if (!after && before === phrase && !phrase.includes(String(count))) {
    return <span>{phrase}</span>
  }
  return (
    <span>
      {before}
      <Numeric>{count}</Numeric>
      {after}
    </span>
  )
}

function tenantMetricNodes(tenant: TenantSummary, copy: CopyBag): ReactNode {
  if (tenant.kind === 'personal') {
    return <MetricText phrase={copy.metricListings(tenant.listingsCount)} count={tenant.listingsCount} />
  }

  const others =
    tenant.otherMembersCount ?? Math.max(0, tenant.agentsCount > 0 ? tenant.agentsCount - 1 : 0)
  const nodes: ReactNode[] = []

  if (others > 0) {
    nodes.push(<MetricText key="youplus" phrase={copy.metricYouPlus(others)} count={others} />)
  } else if (tenant.agentsCount === 1) {
    nodes.push(<MetricText key="agents" phrase={copy.metricAgents(1)} count={1} />)
  }

  nodes.push(
    <MetricText key="listings" phrase={copy.metricListings(tenant.listingsCount)} count={tenant.listingsCount} />,
  )

  return nodes.reduce<ReactNode[]>((acc, node, index) => {
    if (index > 0) acc.push(<span key={`dot-${index}`}> · </span>)
    acc.push(node)
    return acc
  }, [])
}

function TenantMark({
  tenant,
  size,
}: {
  tenant: TenantSummary
  size: 'trigger' | 'row'
}) {
  const dim = size === 'trigger' ? 'h-6 w-6' : 'h-8 w-8'
  const Icon = tenant.kind === 'personal' ? User : Building2
  return (
    <Avatar className={cn(dim, 'rounded-md')}>
      {tenant.avatarUrl ? <AvatarImage src={tenant.avatarUrl} alt="" /> : null}
      <AvatarFallback
        className="rounded-md text-[10px] font-semibold text-[var(--lc-text-heading)]"
        style={{ background: hashTone(tenant.id) }}
      >
        {tenant.avatarUrl ? null : initialsFromName(tenant.name) || <Icon className="h-3.5 w-3.5" aria-hidden />}
      </AvatarFallback>
    </Avatar>
  )
}

export type TenantSwitcherProps = {
  locale?: Locale
  /** Test override — force the mobile bottom-sheet layout. */
  forceMobile?: boolean
  className?: string
}

/**
 * SHR-NAV-008 — Tenant switcher (trigger + desktop popover / mobile sheet).
 */
export function TenantSwitcher({ locale: localeProp, forceMobile, className }: TenantSwitcherProps) {
  const { tenants, activeTenant, loading, switching, isMultiTenant, switchTenant } = useTenant()
  const { addToast } = useToast()
  const [locale, setLocale] = useState<Locale>(localeProp ?? readDocumentLocale())
  const copy = COPY[locale]
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [isMobile, setIsMobile] = useState(Boolean(forceMobile))
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const panelRef = useRef<HTMLDivElement | null>(null)
  const searchRef = useRef<HTMLInputElement | null>(null)
  const listId = useId()
  const liveRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (localeProp) {
      setLocale(localeProp)
      return
    }
    const sync = () => setLocale(readDocumentLocale())
    sync()
    const observer = new MutationObserver(sync)
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] })
    return () => observer.disconnect()
  }, [localeProp])

  useEffect(() => {
    if (forceMobile != null) {
      setIsMobile(forceMobile)
      return
    }
    const mq = window.matchMedia('(max-width: 767px)')
    const update = () => setIsMobile(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [forceMobile])

  useEffect(() => {
    if (!open) {
      setQuery('')
      return
    }
    const id = window.setTimeout(() => {
      if (tenants.length >= 5) searchRef.current?.focus()
      else {
        const active = panelRef.current?.querySelector<HTMLElement>('[aria-selected="true"]')
        active?.focus()
      }
    }, 0)
    return () => window.clearTimeout(id)
  }, [open, tenants.length])

  useEffect(() => {
    if (!open || isMobile) return
    const onPointer = (event: MouseEvent) => {
      const target = event.target as Node
      if (panelRef.current?.contains(target) || triggerRef.current?.contains(target)) return
      setOpen(false)
      triggerRef.current?.focus()
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false)
        triggerRef.current?.focus()
      }
    }
    document.addEventListener('mousedown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, isMobile])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return tenants
    return tenants.filter((t) => displayName(t, copy).toLowerCase().includes(q) || t.name.toLowerCase().includes(q))
  }, [tenants, query, copy])

  const personal = filtered.filter((t) => t.kind === 'personal')
  const agencies = filtered.filter((t) => t.kind === 'agency')
  const showSearch = tenants.length >= 5
  const ownsMultiple =
    tenants.filter((t) => t.role === 'owner').length > 1 ||
    (tenants.some((t) => t.kind === 'personal') && tenants.some((t) => t.kind === 'agency' && t.role === 'owner'))
  const manageHref = activeTenant?.kind === 'agency' ? '/agency' : '/agency'

  const commitSwitch = useCallback(
    async (tenant: TenantSummary) => {
      if (switching) return
      if (tenant.id === activeTenant?.id) {
        setOpen(false)
        return
      }
      setOpen(false)
      try {
        const next = await switchTenant(tenant.id)
        const name = displayName(next, copy)
        const message = copy.toastSwitched(name)
        addToast({ title: message, variant: 'success' })
        if (liveRef.current) liveRef.current.textContent = message
      } catch {
        addToast({ title: copy.errorSwitchFailed, variant: 'error' })
        if (liveRef.current) liveRef.current.textContent = copy.errorSwitchFailed
      }
    },
    [activeTenant?.id, addToast, copy, switchTenant, switching],
  )

  const onSearchKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      if (filtered[0]) void commitSwitch(filtered[0])
      return
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      const first = panelRef.current?.querySelector<HTMLElement>('[role="option"]')
      first?.focus()
    }
  }

  const onOptionKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>, tenant: TenantSummary) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      void commitSwitch(tenant)
      return
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      const options = Array.from(panelRef.current?.querySelectorAll<HTMLElement>('[role="option"]') ?? [])
      const index = options.indexOf(event.currentTarget)
      const next = event.key === 'ArrowDown' ? options[index + 1] : options[index - 1]
      next?.focus()
    }
  }

  const panelBody = (
    <div ref={panelRef} className="flex max-h-[inherit] flex-col">
      <div className="flex items-center justify-between gap-3 px-3 pb-2 pt-3">
        <p
          className="uppercase text-[var(--lc-text-muted)]"
          style={{ font: 'var(--lc-type-caption)', letterSpacing: 'var(--lc-tracking-overline)' }}
        >
          {copy.header}
        </p>
        {ownsMultiple ? (
          <Link
            to={manageHref}
            className="text-[var(--lc-action-primary)]"
            style={{ font: 'var(--lc-type-caption)' }}
            onClick={() => setOpen(false)}
          >
            {copy.manage}
          </Link>
        ) : null}
      </div>

      {showSearch ? (
        <div className="px-3 pb-2">
          <Label htmlFor={`${listId}-search`} className="sr-only">
            {copy.searchLabel}
          </Label>
          <div className="relative">
            <Search
              className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--lc-text-muted)]"
              aria-hidden
            />
            <Input
              ref={searchRef}
              id={`${listId}-search`}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onSearchKeyDown}
              placeholder={copy.search}
              className="bg-[var(--lc-surface-sunken)] ps-9"
              autoComplete="off"
            />
          </div>
        </div>
      ) : null}

      <div
        id={listId}
        role="listbox"
        aria-label={copy.header}
        className="min-h-0 flex-1 overflow-y-auto px-1 pb-1"
      >
        {filtered.length === 0 ? (
          <p className="px-3 py-6 text-center text-[var(--lc-text-muted)]" style={{ font: 'var(--lc-type-body-sm)' }}>
            {copy.noMatches(query.trim())}
          </p>
        ) : (
          <>
            {personal.map((tenant) => (
              <TenantRow
                key={tenant.id}
                tenant={tenant}
                active={tenant.id === activeTenant?.id}
                copy={copy}
                dense={isMobile}
                onSelect={() => void commitSwitch(tenant)}
                onKeyDown={(event) => onOptionKeyDown(event, tenant)}
              />
            ))}
            {personal.length > 0 && agencies.length > 0 ? <Separator className="my-1" /> : null}
            {agencies.map((tenant) => (
              <TenantRow
                key={tenant.id}
                tenant={tenant}
                active={tenant.id === activeTenant?.id}
                copy={copy}
                dense={isMobile}
                onSelect={() => void commitSwitch(tenant)}
                onKeyDown={(event) => onOptionKeyDown(event, tenant)}
              />
            ))}
          </>
        )}
      </div>

      <div className="flex flex-col gap-1 border-t border-[var(--lc-border)] px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
        <Link
          to="/register?intent=create-agency"
          className="inline-flex min-h-tap items-center gap-2 text-[var(--lc-action-primary)]"
          style={{ font: 'var(--lc-type-caption)' }}
          onClick={() => setOpen(false)}
        >
          <Plus className="h-3.5 w-3.5" aria-hidden />
          {copy.footerCreate}
        </Link>
        <Link
          to="/register?intent=join-agency"
          className="inline-flex min-h-tap items-center gap-2 text-[var(--lc-action-primary)]"
          style={{ font: 'var(--lc-type-caption)' }}
          onClick={() => setOpen(false)}
        >
          <UserPlus className="h-3.5 w-3.5" aria-hidden />
          {copy.footerJoin}
        </Link>
      </div>
    </div>
  )

  if (loading && !activeTenant) {
    return (
      <div
        className={cn('h-10 w-[140px] animate-pulse rounded-pill bg-[var(--lc-surface-sunken)]', className)}
        aria-hidden
        data-testid="tenant-switcher-skeleton"
      />
    )
  }

  if (!activeTenant) return null

  const name = displayName(activeTenant, copy)
  const role = roleLabel(activeTenant, copy)
  const aria = copy.triggerAria(name, role)

  // Single-tenant: static label, no chevron / no popover friction.
  if (!isMultiTenant) {
    return (
      <div
        className={cn(
          'inline-flex h-10 max-w-[280px] items-center gap-3 rounded-pill border border-[var(--lc-border)] bg-[var(--lc-surface-raised)] ps-2 pe-3',
          className,
        )}
        data-testid="tenant-switcher-static"
      >
        <TenantMark tenant={activeTenant} size="trigger" />
        <div className="min-w-0 hidden sm:block">
          <p className="truncate font-semibold text-[var(--lc-text-primary)]" style={{ font: 'var(--lc-type-body)' }}>
            <bdi>{name}</bdi>
          </p>
          <p className="truncate text-[var(--lc-text-muted)]" style={{ font: 'var(--lc-type-caption)' }}>
            {role}
          </p>
        </div>
      </div>
    )
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={cn(
          'inline-flex h-10 max-w-[280px] items-center gap-3 rounded-pill border border-[var(--lc-border)] bg-[var(--lc-surface-raised)] ps-2 pe-2 text-start transition-colors duration-fast hover:bg-[var(--lc-action-secondary)]',
          open && 'bg-primary-faint',
          switching && 'pointer-events-none opacity-70',
          className,
        )}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={aria}
        disabled={switching}
        onClick={() => setOpen((v) => !v)}
        data-testid="tenant-switcher-trigger"
      >
        <TenantMark tenant={activeTenant} size="trigger" />
        <div className="min-w-0 hidden sm:block">
          <p
            className="truncate font-semibold text-[var(--lc-text-primary)]"
            style={{ font: 'var(--lc-type-body)', fontWeight: 600 }}
          >
            <bdi>{name}</bdi>
          </p>
          <p className="truncate text-[var(--lc-text-muted)]" style={{ font: 'var(--lc-type-caption)' }}>
            {role}
          </p>
        </div>
        <ChevronsUpDown
          className="ms-auto h-4 w-4 shrink-0 text-[var(--lc-text-muted)] group-hover:text-[var(--lc-text-primary)]"
          aria-hidden
        />
      </button>

      <div ref={liveRef} className="sr-only" aria-live="polite" />

      {/* Desktop / tablet popover */}
      {open && !isMobile && typeof document !== 'undefined'
        ? createPortal(
            <div
              className="fixed z-dropdown w-[min(360px,calc(100vw-32px))] max-h-[min(480px,calc(100vh-120px))] overflow-hidden rounded-md border border-[var(--lc-border)] bg-[var(--lc-surface-raised)] shadow-md motion-safe:animate-in motion-safe:fade-in-0 motion-safe:zoom-in-95 duration-base"
              style={{
                top: (triggerRef.current?.getBoundingClientRect().bottom ?? 0) + 8,
                left: document.documentElement.dir === 'rtl'
                  ? undefined
                  : triggerRef.current?.getBoundingClientRect().left ?? 16,
                right: document.documentElement.dir === 'rtl'
                  ? window.innerWidth - (triggerRef.current?.getBoundingClientRect().right ?? window.innerWidth) 
                  : undefined,
              }}
              data-testid="tenant-switcher-popover"
            >
              {panelBody}
            </div>,
            document.body,
          )
        : null}

      {/* Mobile bottom sheet */}
      <Dialog
        open={open && isMobile}
        onOpenChange={(next) => {
          setOpen(next)
          if (!next) triggerRef.current?.focus()
        }}
      >
        <DialogContent
          className="fixed inset-x-0 bottom-0 top-auto z-modal max-h-[min(85vh,560px)] w-full max-w-none translate-x-0 translate-y-0 rounded-t-xl rounded-b-none border border-[var(--lc-border)] bg-[var(--lc-surface-raised)] p-0 pb-[env(safe-area-inset-bottom)] shadow-lg data-[state=open]:slide-in-from-bottom data-[state=closed]:slide-out-to-bottom"
          data-testid="tenant-switcher-sheet"
        >
          <DialogTitle className="sr-only">{copy.header}</DialogTitle>
          {panelBody}
        </DialogContent>
      </Dialog>

      {switching
        ? createPortal(
            <div
              className="fixed inset-0 z-overlay flex items-center justify-center lc-overlay"
              role="status"
              aria-live="polite"
              data-testid="tenant-switcher-scrim"
            >
              <Loader2 className="h-8 w-8 animate-spin text-[var(--lc-action-primary)]" aria-hidden />
              <span className="sr-only">{copy.header}</span>
            </div>,
            document.body,
          )
        : null}
    </>
  )
}

function TenantRow({
  tenant,
  active,
  copy,
  dense,
  onSelect,
  onKeyDown,
}: {
  tenant: TenantSummary
  active: boolean
  copy: CopyBag
  dense: boolean
  onSelect: () => void
  onKeyDown: (event: ReactKeyboardEvent<HTMLButtonElement>) => void
}) {
  const name = displayName(tenant, copy)
  const role = roleLabel(tenant, copy)
  const isOwner = tenant.kind === 'agency' && tenant.role === 'owner'

  return (
    <button
      type="button"
      role="option"
      aria-selected={active}
      className={cn(
        'flex w-full items-center gap-3 rounded-md px-2 text-start transition-colors duration-fast hover:bg-[var(--lc-action-secondary)] focus-visible:outline-none',
        dense ? 'min-h-11 py-2' : 'min-h-14 py-2',
        active && 'bg-primary-faint',
      )}
      onClick={onSelect}
      onKeyDown={onKeyDown}
    >
      <TenantMark tenant={tenant} size="row" />
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold text-[var(--lc-text-primary)]" style={{ font: 'var(--lc-type-body)', fontWeight: 600 }}>
          <bdi>{name}</bdi>
        </p>
        <div className="mt-0.5 flex min-w-0 flex-wrap items-center gap-2 text-[var(--lc-text-muted)]" style={{ font: 'var(--lc-type-caption)' }}>
          <Badge
            variant={isOwner ? 'default' : 'secondary'}
            className="rounded-sm px-1.5 py-0 font-medium"
          >
            {role}
          </Badge>
          <span className="min-w-0 truncate">{tenantMetricNodes(tenant, copy)}</span>
        </div>
      </div>
      {active ? <Check className="h-4 w-4 shrink-0 text-[var(--lc-status-published-fg)]" aria-hidden /> : null}
    </button>
  )
}
