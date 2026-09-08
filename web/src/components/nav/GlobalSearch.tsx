import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Command } from 'cmdk'
import { Search } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { useHotkey } from '@/hooks/useHotkey'
import { cn } from '@/lib/utils'
import type { NavLocale } from './UserMenu'

export type NavPersona = 'agent' | 'agency' | 'pa'

export const SEARCH_COPY = {
  en: {
    placeholder: {
      agent: 'Search listings, contacts, campaigns…',
      agency: 'Search agents, roles, listings…',
      pa: 'Search tenants, invoices, packages…',
    },
    hotkeyMac: '⌘K',
    hotkeyWin: 'Ctrl+K',
    recent: 'Recent searches',
    suggestions: 'Suggestions',
    actions: 'Actions',
    empty: 'No results found.',
  },
  ar: {
    placeholder: {
      agent: 'ابحث عن الإعلانات، جهات الاتصال، الحملات…',
      agency: 'ابحث عن الوكلاء، الأدوار، الإعلانات…',
      pa: 'ابحث عن الحسابات، الفواتير، الباقات…',
    },
    hotkeyMac: '⌘K',
    hotkeyWin: 'Ctrl+K',
    recent: 'عمليات البحث الأخيرة',
    suggestions: 'اقتراحات',
    actions: 'إجراءات',
    empty: 'لا توجد نتائج.',
  },
} as const

export type SearchResultGroup = {
  heading: 'recent' | 'suggestions' | 'actions'
  items: Array<{ id: string; label: string; href?: string; onSelect?: () => void }>
}

export interface GlobalSearchProps {
  persona?: NavPersona
  locale?: NavLocale
  open?: boolean
  onOpenChange?: (open: boolean) => void
  /** Optional groups; when omitted, persona defaults are shown. */
  groups?: SearchResultGroup[]
  onQueryChange?: (query: string) => void
  className?: string
  /** Compact trigger for the top bar (<1024px icon / ≥1024px input). */
  triggerVariant?: 'input' | 'icon'
}

function isMacPlatform() {
  if (typeof navigator === 'undefined') return false
  return /Mac|iPhone|iPad|iPod/.test(navigator.platform || navigator.userAgent)
}

const DEFAULT_GROUPS: Record<NavPersona, SearchResultGroup[]> = {
  agent: [
    {
      heading: 'actions',
      items: [
        { id: 'new-listing', label: 'Create new listing', href: '/listings/new' },
        { id: 'start-campaign', label: 'Start a campaign', href: '/campaigns/new' },
      ],
    },
  ],
  agency: [
    {
      heading: 'actions',
      items: [
        { id: 'invite-member', label: 'Invite a member', href: '/agency/members' },
        { id: 'view-roles', label: 'View roles', href: '/agency/roles' },
      ],
    },
  ],
  pa: [
    {
      heading: 'actions',
      items: [
        { id: 'approvals', label: 'Open approvals queue', href: '/admin/approvals' },
        { id: 'packages', label: 'Package publishing', href: '/admin/packages' },
      ],
    },
  ],
}

export function useSearchHotkeyLabel(locale: NavLocale = 'en') {
  return isMacPlatform() ? SEARCH_COPY[locale].hotkeyMac : SEARCH_COPY[locale].hotkeyWin
}

export function GlobalSearch({
  persona = 'agent',
  locale = 'en',
  open: controlledOpen,
  onOpenChange,
  groups,
  onQueryChange,
  className,
  triggerVariant = 'input',
}: GlobalSearchProps) {
  const copy = SEARCH_COPY[locale]
  const navigate = useNavigate()
  const location = useLocation()
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false)
  const open = controlledOpen ?? uncontrolledOpen
  const setOpen = onOpenChange ?? setUncontrolledOpen
  const [query, setQuery] = useState('')

  const resultGroups = groups ?? DEFAULT_GROUPS[persona]
  const hotkeyLabel = useSearchHotkeyLabel(locale)
  const placeholder = copy.placeholder[persona]

  const openSearch = useCallback(() => setOpen(true), [setOpen])
  useHotkey('mod+k', openSearch)

  const prevPathRef = useRef(location.pathname)
  // Close on route change (brief anti-pattern avoidance).
  useEffect(() => {
    if (prevPathRef.current !== location.pathname) {
      prevPathRef.current = location.pathname
      setOpen(false)
      setQuery('')
    }
  }, [location.pathname, setOpen])

  const headingLabel = useMemo(
    () =>
      ({
        recent: copy.recent,
        suggestions: copy.suggestions,
        actions: copy.actions,
      }) as const,
    [copy],
  )

  const runSelect = (item: SearchResultGroup['items'][number]) => {
    setOpen(false)
    setQuery('')
    if (item.onSelect) item.onSelect()
    else if (item.href) navigate(item.href)
  }

  return (
    <>
      {triggerVariant === 'icon' ? (
        <button
          type="button"
          className={cn(
            'inline-flex h-tap w-tap min-h-tap min-w-tap items-center justify-center rounded-md text-[var(--lc-text-muted)] hover:text-[var(--lc-text-primary)] focus-visible:outline-none',
            className,
          )}
          aria-label={placeholder}
          onClick={() => setOpen(true)}
        >
          <Search className="h-5 w-5" aria-hidden="true" />
        </button>
      ) : (
        <button
          type="button"
          className={cn(
            'hidden h-10 w-[320px] items-center gap-2 rounded-md border border-[var(--lc-border)] bg-[var(--lc-surface-sunken)] px-3 text-start text-sm text-[var(--lc-text-muted)] transition-colors duration-fast hover:border-[var(--lc-border-strong)] focus-visible:outline-none lg:inline-flex',
            className,
          )}
          onClick={() => setOpen(true)}
          aria-label={placeholder}
        >
          <Search className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span className="min-w-0 flex-1 truncate">{placeholder}</span>
          <kbd className="rounded-sm border border-[var(--lc-border)] bg-[var(--lc-surface)] px-1.5 py-0.5 font-[family-name:var(--lc-font-mono)] text-[11px] text-[var(--lc-text-muted)]">
            {hotkeyLabel}
          </kbd>
        </button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className="top-[20%] max-w-[640px] translate-y-0 overflow-hidden p-0 sm:rounded-md"
          aria-describedby={undefined}
        >
          <DialogTitle className="sr-only">{placeholder}</DialogTitle>
          <Command
            className="bg-[var(--lc-surface-raised)] text-[var(--lc-text-primary)]"
            label={placeholder}
            shouldFilter
          >
            <div className="flex items-center gap-2 border-b border-[var(--lc-border)] px-3">
              <Search className="h-4 w-4 text-[var(--lc-text-muted)]" aria-hidden="true" />
              <Command.Input
                value={query}
                onValueChange={(value) => {
                  setQuery(value)
                  onQueryChange?.(value)
                }}
                placeholder={placeholder}
                className="flex h-tap w-full bg-transparent text-sm outline-none placeholder:text-[var(--lc-text-muted)]"
                autoFocus
              />
            </div>
            <Command.List className="max-h-[360px] overflow-y-auto p-2">
              <Command.Empty className="px-3 py-8 text-center text-sm text-[var(--lc-text-muted)]">
                {copy.empty}
              </Command.Empty>
              {resultGroups.map((group) => (
                <Command.Group
                  key={group.heading}
                  heading={headingLabel[group.heading]}
                  className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[length:var(--lc-type-caption)] [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-[var(--lc-tracking-overline)] [&_[cmdk-group-heading]]:text-[var(--lc-text-muted)]"
                >
                  {group.items.map((item) => (
                    <Command.Item
                      key={item.id}
                      value={item.label}
                      onSelect={() => runSelect(item)}
                      className="flex min-h-tap cursor-pointer items-center rounded-md px-2 text-sm aria-selected:bg-[var(--lc-action-secondary)] aria-selected:text-[var(--lc-action-secondary-text)]"
                    >
                      {item.label}
                    </Command.Item>
                  ))}
                </Command.Group>
              ))}
            </Command.List>
          </Command>
        </DialogContent>
      </Dialog>
    </>
  )
}
