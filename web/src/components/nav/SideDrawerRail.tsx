import type { ComponentType, ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { PanelLeft } from 'lucide-react'
import { Numeric } from '@/components/ui/numeric'
import { cn } from '@/lib/utils'

export type RailNavItem = {
  id: string
  label: string
  href: string
  icon: ComponentType<{ className?: string; 'aria-hidden'?: boolean | 'true' | 'false' }>
  badge?: number
}

export interface SideDrawerRailProps {
  items: RailNavItem[]
  onExpand?: () => void
  expandLabel?: string
  footer?: ReactNode
  className?: string
}

function isActivePath(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`)
}

export function SideDrawerRail({
  items,
  onExpand,
  expandLabel = 'Expand navigation',
  footer,
  className,
}: SideDrawerRailProps) {
  const location = useLocation()

  return (
    <aside
      role="navigation"
      aria-label="Primary"
      className={cn(
        'flex h-full w-[60px] flex-col border-e border-[var(--lc-border)] bg-[var(--lc-bg-page)]',
        className,
      )}
    >
      <ul className="flex flex-1 flex-col items-center gap-1 overflow-y-auto px-1 py-2">
        {items.map((item) => {
          const Icon = item.icon
          const active = isActivePath(location.pathname, item.href)
          return (
            <li key={item.id} className="w-full">
              <Link
                to={item.href}
                title={item.label}
                aria-label={item.label}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'relative mx-auto flex h-tap w-tap items-center justify-center rounded-md text-[var(--lc-text-primary)] transition-colors duration-fast focus-visible:outline-none',
                  active
                    ? 'font-semibold text-[var(--lc-action-primary)]'
                    : 'hover:bg-[var(--lc-action-secondary)]',
                )}
                style={
                  active
                    ? {
                        background: 'color-mix(in srgb, var(--lc-action-primary) 12%, transparent)',
                        borderInlineStart: '3px solid var(--lc-action-primary)',
                      }
                    : undefined
                }
              >
                <Icon className="h-5 w-5" aria-hidden="true" />
                {item.badge && item.badge > 0 ? (
                  <span className="absolute -end-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-pill bg-[var(--lc-action-primary)] px-1 text-[10px] font-semibold text-[var(--lc-action-primary-text)]">
                    <Numeric>{item.badge > 99 ? '99+' : item.badge}</Numeric>
                  </span>
                ) : null}
              </Link>
            </li>
          )
        })}
      </ul>
      {footer}
      {onExpand ? (
        <button
          type="button"
          className="mx-auto mb-2 inline-flex h-tap w-tap items-center justify-center rounded-md text-[var(--lc-text-muted)] hover:bg-[var(--lc-action-secondary)] hover:text-[var(--lc-text-primary)] focus-visible:outline-none"
          onClick={onExpand}
          aria-label={expandLabel}
          title={expandLabel}
        >
          <PanelLeft className="h-5 w-5" aria-hidden="true" />
        </button>
      ) : null}
    </aside>
  )
}
