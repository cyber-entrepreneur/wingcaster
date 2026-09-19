import { NavLink, Outlet } from 'react-router-dom'
import { usePageTitle } from '@/lib/usePageTitle'

const TABS = [
  { to: '/agency/credits', label: 'Wallet', end: true },
  { to: '/agency/credits/quotas', label: 'Feature quotas', end: false },
]

export function AgencyCreditsLayout() {
  usePageTitle('Agency credits')

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:py-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--lc-text-primary)] sm:text-3xl">
          Agency credits
        </h1>
        <p className="mt-1 text-sm text-[var(--lc-text-muted)]">
          Wallet balance and per-feature quota consumption across your agency.
        </p>
      </div>

      <nav aria-label="Credits sections" className="flex flex-wrap gap-2 border-b border-[var(--lc-border)] pb-2">
        {TABS.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.end}
            className={({ isActive }) => [
              'rounded-md px-3 py-2 text-sm font-medium transition-colors',
              isActive
                ? 'bg-[var(--lc-action-secondary)] text-[var(--lc-text-primary)]'
                : 'text-[var(--lc-text-muted)] hover:bg-[var(--lc-action-secondary)] hover:text-[var(--lc-text-primary)]',
            ].join(' ')}
          >
            {tab.label}
          </NavLink>
        ))}
      </nav>

      <Outlet />
    </div>
  )
}
