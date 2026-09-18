import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, Loader2 } from 'lucide-react'
import { api, type SettingsIndexGroup } from '@/api/client'
import { SettingsCardList } from '@/components/settings/SettingsCardList'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/context/AuthContext'
import { usePageTitle } from '@/lib/usePageTitle'
import { indexGroupsToNav } from '@/lib/settings-nav'

type LoadState = 'loading' | 'ready' | 'error' | 'forbidden'

export function AgencySettingsHomePage() {
  const { agent } = useAuth()
  const navigate = useNavigate()
  usePageTitle('Agency settings')

  const role = (agent?.affiliation as { role?: string } | undefined)?.role || null
  const isAdmin = role === 'owner' || role === 'admin'

  const [loadState, setLoadState] = useState<LoadState>(isAdmin ? 'loading' : 'forbidden')
  const [groups, setGroups] = useState<SettingsIndexGroup[]>([])

  const load = useCallback(async () => {
    if (!isAdmin) {
      setLoadState('forbidden')
      return
    }
    setLoadState('loading')
    try {
      const index = await api.getAgencySettingsIndex()
      setGroups(index.groups)
      setLoadState('ready')
    } catch (err) {
      const status = (err as { status?: number }).status
      if (status === 401 || status === 403) setLoadState('forbidden')
      else setLoadState('error')
    }
  }, [isAdmin])

  useEffect(() => {
    void load()
  }, [load])

  const navGroups = useMemo(() => indexGroupsToNav(groups), [groups])

  if (loadState === 'forbidden') {
    return (
      <div className="mx-auto max-w-[960px] p-[var(--lc-space-lg)]" data-screen="AGN-SET-001">
        <h1
          className="mb-[var(--lc-space-sm)] text-[var(--lc-text-heading)]"
          style={{ font: 'var(--lc-type-heading-2)' }}
        >
          Agency settings
        </h1>
        <p className="text-[var(--lc-text-secondary)]">
          Only agency owners and admins can view agency settings.
        </p>
      </div>
    )
  }

  if (loadState === 'loading') {
    return (
      <div className="mx-auto max-w-[960px] p-[var(--lc-space-lg)]" data-screen="AGN-SET-001">
        <div
          aria-busy="true"
          className="h-40 animate-pulse rounded-[var(--lc-radius-lg)] bg-[var(--lc-surface-sunken)]"
        />
        <p className="sr-only">Loading agency settings…</p>
      </div>
    )
  }

  if (loadState === 'error') {
    return (
      <div className="mx-auto max-w-[960px] p-[var(--lc-space-lg)]" data-screen="AGN-SET-001">
        <div
          role="alert"
          className="mb-[var(--lc-space-md)] flex items-start gap-[var(--lc-space-sm)] rounded-[var(--lc-radius-md)] bg-[var(--lc-status-danger-bg)] px-[var(--lc-space-md)] py-[var(--lc-space-sm)] text-[var(--lc-status-danger-fg)]"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <p>Could not load agency settings. Try again.</p>
        </div>
        <Button type="button" onClick={() => void load()}>
          Try again
        </Button>
      </div>
    )
  }

  return (
    <div
      className="mx-auto max-w-[960px] pb-[var(--lc-space-3xl)] pt-[var(--lc-space-lg)]"
      data-screen="AGN-SET-001"
    >
      <header className="px-[var(--lc-space-md)]">
        <h1
          className="text-[var(--lc-text-heading)]"
          style={{ font: 'var(--lc-type-heading-1)', letterSpacing: 'var(--lc-tracking-heading-1)' }}
        >
          Agency settings
        </h1>
        <p className="mt-[var(--lc-space-xs)] text-[length:var(--lc-type-body)] text-[var(--lc-text-secondary)]">
          Manage branding, access, integrations, and ownership for this agency.
        </p>
      </header>

      <div className="mt-[var(--lc-space-lg)] md:px-[var(--lc-space-md)]">
        <SettingsCardList groups={navGroups} onNavigate={(route) => navigate(route)} />
      </div>
    </div>
  )
}
