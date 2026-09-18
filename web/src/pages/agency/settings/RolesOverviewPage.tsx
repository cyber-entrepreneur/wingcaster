import { ChevronRight, HelpCircle } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '@/api/client'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/context/AuthContext'
import { useLocale } from '@/hooks/useLocale'
import { usePageTitle } from '@/lib/usePageTitle'
import { PackAssignSheet } from '@/components/agency/roles/PackAssignSheet'
import { PackCard } from '@/components/agency/roles/PackCard'
import { tRoles } from './rolesCopy'
import type { CapabilityPacksResponse, CapabilityPackListDto } from './rolesTypes'

type LoadState = 'loading' | 'ready' | 'error' | 'forbidden'

const ADMIN_ROLES = new Set(['owner', 'admin'])
const HELP_URL = 'https://help.wingcaster.com/agency/capability-packs'

export function RolesOverviewPage() {
  const navigate = useNavigate()
  const { agent } = useAuth()
  const { locale, isArabic } = useLocale()
  const uiLocale = isArabic ? 'ar' : 'en'
  usePageTitle(tRoles('overview.title', uiLocale))

  const [status, setStatus] = useState<LoadState>('loading')
  const [data, setData] = useState<CapabilityPacksResponse | null>(null)
  const [assignPack, setAssignPack] = useState<CapabilityPackListDto | null>(null)

  const role = (agent?.affiliation as { role?: string } | undefined)?.role
  const canAssign = role ? ADMIN_ROLES.has(role) : true

  const load = useCallback(async () => {
    setStatus('loading')
    try {
      const res = (await api.listAgencyCapabilityPacks()) as CapabilityPacksResponse
      setData(res)
      setStatus('ready')
    } catch (err) {
      const s = (err as { status?: number }).status
      if (s === 401 || s === 403) {
        setStatus('forbidden')
      } else {
        setStatus('error')
      }
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const goDetail = useCallback(
    (packId: string) => navigate(`/agency/settings/roles/${packId}`),
    [navigate],
  )
  const goOwnership = useCallback(() => navigate('/agency/settings/ownership'), [navigate])

  const ownerCount = data?.agency_meta.owner_count ?? 0
  const packs = data?.packs ?? []
  const builtin = packs.filter((p) => p.kind !== 'custom')
  const custom = packs.filter((p) => p.kind === 'custom')
  const noMembers = (data?.agency_meta.member_count_total ?? 0) === 0

  return (
    <div
      className="min-h-full bg-[var(--lc-bg-page)]"
      data-screen="AGN-ROL-001"
      dir={locale === 'ar' ? 'rtl' : 'ltr'}
    >
      <div className="mx-auto max-w-[1080px] px-[var(--lc-space-xl)] py-[var(--lc-space-xl)]">
        <nav
          aria-label={tRoles('breadcrumb.roles', uiLocale)}
          className="flex flex-wrap items-center gap-1 text-[var(--lc-text-muted)]"
          style={{ font: 'var(--lc-type-body-sm)' }}
        >
          <Link to="/agency/settings" className="hover:underline">
            {tRoles('breadcrumb.settings', uiLocale)}
          </Link>
          <ChevronRight className="h-3 w-3 rtl:rotate-180" aria-hidden="true" />
          <Link to="/agency" className="hover:underline">
            {tRoles('breadcrumb.access', uiLocale)}
          </Link>
          <ChevronRight className="h-3 w-3 rtl:rotate-180" aria-hidden="true" />
          <span aria-current="page" className="text-[var(--lc-text-secondary)]">
            {tRoles('breadcrumb.roles', uiLocale)}
          </span>
        </nav>

        <header className="mt-[var(--lc-space-md)] flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1
              className="text-[var(--lc-text-heading)]"
              style={{ font: 'var(--lc-type-heading-1)' }}
            >
              {tRoles('overview.title', uiLocale)}
            </h1>
            <p
              className="mt-1 text-[var(--lc-text-secondary)]"
              style={{ font: 'var(--lc-type-body-lg)' }}
            >
              {tRoles('overview.sub', uiLocale)}
            </p>
          </div>
          <Button asChild variant="link" size="sm">
            <a href={HELP_URL} target="_blank" rel="noreferrer noopener">
              <HelpCircle className="me-1 h-4 w-4" aria-hidden="true" />
              {tRoles('overview.help', uiLocale)}
            </a>
          </Button>
        </header>

        {noMembers && status === 'ready' ? (
          <div
            role="note"
            className="mt-[var(--lc-space-md)] rounded-[var(--lc-radius-md)] border border-[var(--lc-border)] bg-[var(--lc-surface-sunken)] px-3 py-2 text-[var(--lc-text-secondary)]"
            style={{ font: 'var(--lc-type-body-sm)' }}
          >
            {tRoles('overview.firstRun', uiLocale)}
          </div>
        ) : null}

        {status === 'loading' ? (
          <div className="mt-[var(--lc-space-lg)] grid grid-cols-1 gap-4 md:grid-cols-2">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-[220px] animate-pulse rounded-[var(--lc-radius-lg)] border border-[var(--lc-border)] bg-[var(--lc-surface-sunken)]"
                aria-hidden="true"
              />
            ))}
            <span className="sr-only">{tRoles('loading.packs', uiLocale)}</span>
          </div>
        ) : null}

        {status === 'forbidden' ? (
          <div className="mt-[var(--lc-space-xl)] flex flex-col items-start gap-3">
            <p className="text-[var(--lc-text-primary)]" style={{ font: 'var(--lc-type-body-lg)' }}>
              {tRoles('forbidden.title', uiLocale)}
            </p>
            <Button type="button" variant="outline" onClick={() => navigate('/agency')}>
              {tRoles('forbidden.cta', uiLocale)}
            </Button>
          </div>
        ) : null}

        {status === 'error' ? (
          <div className="mt-[var(--lc-space-xl)] flex flex-col items-start gap-3">
            <p className="text-[var(--lc-text-primary)]" style={{ font: 'var(--lc-type-body-lg)' }}>
              {tRoles('error.load', uiLocale)}
            </p>
            <Button type="button" variant="outline" onClick={() => void load()}>
              {tRoles('action.retry', uiLocale)}
            </Button>
          </div>
        ) : null}

        {status === 'ready' && packs.length === 0 ? (
          <p
            className="mt-[var(--lc-space-xl)] text-[var(--lc-text-primary)]"
            style={{ font: 'var(--lc-type-body-lg)' }}
          >
            {tRoles('error.empty', uiLocale)}
          </p>
        ) : null}

        {status === 'ready' && packs.length > 0 ? (
          <div className="mt-[var(--lc-space-lg)] flex flex-col gap-6">
            <section aria-label={tRoles('overview.section.builtin', uiLocale)}>
              <h2
                className="mb-2 text-[var(--lc-text-muted)]"
                style={{ font: 'var(--lc-type-overline)' }}
              >
                {tRoles('overview.section.builtin', uiLocale)}
              </h2>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {builtin.map((pack) => (
                  <PackCard
                    key={pack.id}
                    pack={pack}
                    locale={uiLocale}
                    canAssign={canAssign}
                    ownerCount={ownerCount}
                    onView={goDetail}
                    onAssign={() => setAssignPack(pack)}
                    onWarningAction={goOwnership}
                  />
                ))}
              </div>
            </section>

            {custom.length > 0 ? (
              <section aria-label={tRoles('overview.section.custom', uiLocale)}>
                <h2
                  className="mb-2 text-[var(--lc-text-muted)]"
                  style={{ font: 'var(--lc-type-overline)' }}
                >
                  {tRoles('overview.section.custom', uiLocale)}
                </h2>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {custom.map((pack) => (
                    <PackCard
                      key={pack.id}
                      pack={pack}
                      locale={uiLocale}
                      canAssign={canAssign}
                      ownerCount={ownerCount}
                      onView={goDetail}
                      onAssign={() => setAssignPack(pack)}
                      onWarningAction={goOwnership}
                    />
                  ))}
                </div>
              </section>
            ) : null}

            <p
              className="text-[var(--lc-text-secondary)]"
              style={{ font: 'var(--lc-type-body-sm)' }}
            >
              {tRoles('overview.info', uiLocale)}
            </p>
          </div>
        ) : null}
      </div>

      {assignPack ? (
        <PackAssignSheet
          packId={assignPack.id}
          packName={assignPack.name}
          requiresTwoPerson={assignPack.requires_two_person}
          ownerCount={ownerCount}
          locale={uiLocale}
          open={Boolean(assignPack)}
          onOpenChange={(open) => {
            if (!open) setAssignPack(null)
          }}
          onAssigned={() => {
            void load()
          }}
        />
      ) : null}
    </div>
  )
}

export default RolesOverviewPage
