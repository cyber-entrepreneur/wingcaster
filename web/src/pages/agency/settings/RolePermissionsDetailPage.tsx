import {
  BarChart3,
  ChevronDown,
  ChevronRight,
  Coins,
  Home,
  Info,
  Radio,
  Settings2,
  Users,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api } from '@/api/client'
import { Button } from '@/components/ui/button'
import { Numeric } from '@/components/ui/numeric'
import { useLocale } from '@/hooks/useLocale'
import { usePageTitle } from '@/lib/usePageTitle'
import { cn } from '@/lib/utils'
import { tRoles } from './rolesCopy'
import { memberInitials, type CapabilityPackDetailDto } from './rolesTypes'

type LoadState = 'loading' | 'ready' | 'error' | 'notfound' | 'forbidden'

const DOMAIN_ICONS: Record<string, typeof Home> = {
  listings: Home,
  crm: Users,
  publishing: Radio,
  analytics: BarChart3,
  billing: Coins,
  settings: Settings2,
}

export function RolePermissionsDetailPage() {
  const { packId = '' } = useParams()
  const navigate = useNavigate()
  const { locale, isArabic } = useLocale()
  const uiLocale = isArabic ? 'ar' : 'en'

  const [status, setStatus] = useState<LoadState>('loading')
  const [pack, setPack] = useState<CapabilityPackDetailDto | null>(null)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  usePageTitle(
    pack ? tRoles('detail.title', uiLocale, { pack: pack.name }) : tRoles('detail.back', uiLocale),
  )

  const load = useCallback(async () => {
    setStatus('loading')
    try {
      const res = (await api.getAgencyCapabilityPack(packId)) as CapabilityPackDetailDto
      setPack(res)
      setExpanded(new Set(res.domains[0] ? [res.domains[0].key] : []))
      setStatus('ready')
    } catch (err) {
      const s = (err as { status?: number }).status
      if (s === 404) setStatus('notfound')
      else if (s === 401 || s === 403) setStatus('forbidden')
      else setStatus('error')
    }
  }, [packId])

  useEffect(() => {
    void load()
  }, [load])

  const toggle = (key: string) =>
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })

  const isSeeded = pack?.kind !== 'custom'
  const bannerCopy = useMemo(
    () => (isSeeded ? tRoles('detail.readOnlyBanner', uiLocale) : tRoles('detail.customViewBanner', uiLocale)),
    [isSeeded, uiLocale],
  )

  if (status === 'notfound' || status === 'forbidden') {
    return (
      <div className="min-h-full bg-[var(--lc-bg-page)]" data-screen="AGN-ROL-002">
        <div className="mx-auto flex max-w-[1080px] flex-col items-start gap-3 px-[var(--lc-space-xl)] py-[var(--lc-space-xl)]">
          <h1 className="text-[var(--lc-text-heading)]" style={{ font: 'var(--lc-type-heading-1)' }}>
            {status === 'notfound'
              ? tRoles('detail.notFound', uiLocale)
              : tRoles('forbidden.title', uiLocale)}
          </h1>
          <Button type="button" variant="outline" onClick={() => navigate('/agency/settings/roles')}>
            {tRoles('detail.back', uiLocale)}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div
      className="min-h-full bg-[var(--lc-bg-page)]"
      data-screen="AGN-ROL-002"
      dir={locale === 'ar' ? 'rtl' : 'ltr'}
    >
      <div className="mx-auto max-w-[1080px] px-[var(--lc-space-xl)] py-[var(--lc-space-xl)]">
        <nav
          aria-label={tRoles('breadcrumb.roles', uiLocale)}
          className="flex flex-wrap items-center gap-1 text-[var(--lc-text-muted)]"
          style={{ font: 'var(--lc-type-body-sm)' }}
        >
          <Link to="/agency/settings/roles" className="hover:underline">
            {tRoles('breadcrumb.roles', uiLocale)}
          </Link>
          {pack ? (
            <>
              <ChevronRight className="h-3 w-3 rtl:rotate-180" aria-hidden="true" />
              <span aria-current="page" className="text-[var(--lc-text-secondary)]">
                {pack.name}
              </span>
            </>
          ) : null}
        </nav>

        {status === 'loading' ? (
          <div className="mt-[var(--lc-space-lg)] flex flex-col gap-3">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-16 animate-pulse rounded-[var(--lc-radius-lg)] border border-[var(--lc-border)] bg-[var(--lc-surface-sunken)]"
                aria-hidden="true"
              />
            ))}
            <span className="sr-only">{tRoles('detail.loading', uiLocale)}</span>
          </div>
        ) : null}

        {status === 'error' ? (
          <div className="mt-[var(--lc-space-xl)] flex flex-col items-start gap-3">
            <p className="text-[var(--lc-text-primary)]" style={{ font: 'var(--lc-type-body-lg)' }}>
              {tRoles('detail.error.load', uiLocale)}
            </p>
            <Button type="button" variant="outline" onClick={() => void load()}>
              {tRoles('action.retry', uiLocale)}
            </Button>
          </div>
        ) : null}

        {status === 'ready' && pack ? (
          <>
            <header className="mt-[var(--lc-space-md)]">
              <h1
                className="text-[var(--lc-text-heading)]"
                style={{ font: 'var(--lc-type-heading-1)' }}
              >
                {tRoles('detail.title', uiLocale, { pack: pack.name })}
              </h1>
              <p
                className="mt-1 text-[var(--lc-text-secondary)]"
                style={{ font: 'var(--lc-type-body-lg)' }}
              >
                {pack.description}
              </p>
            </header>

            <div
              role="note"
              className="mt-[var(--lc-space-md)] flex items-start gap-2 rounded-[var(--lc-radius-md)] border border-[var(--lc-border)] bg-[var(--lc-surface-sunken)] px-3 py-2 text-[var(--lc-text-secondary)]"
              style={{ font: 'var(--lc-type-body-sm)' }}
            >
              <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <div>
                <span>{bannerCopy}</span>
                {isSeeded ? (
                  <Button
                    asChild
                    variant="link"
                    className="ms-1 inline h-auto p-0 align-baseline"
                  >
                    <Link to="/agency/settings/roles/custom">
                      {tRoles('detail.openCustom', uiLocale)}
                    </Link>
                  </Button>
                ) : null}
              </div>
            </div>

            <div className="mt-[var(--lc-space-lg)] flex flex-col gap-3">
              {pack.domains.map((domain) => {
                const DomainIcon = DOMAIN_ICONS[domain.key] || Settings2
                const isOpen = expanded.has(domain.key)
                const enabledCount = domain.capabilities.filter((c) => c.enabled).length
                const panelId = `domain-panel-${domain.key}`
                return (
                  <section
                    key={domain.key}
                    className="rounded-[var(--lc-radius-lg)] border border-[var(--lc-border)] bg-[var(--lc-surface-raised)] shadow-[var(--lc-elevation-sm)]"
                    aria-label={domain.label}
                  >
                    <button
                      type="button"
                      className="flex min-h-tap w-full items-center gap-3 px-4 py-3 text-start"
                      aria-expanded={isOpen}
                      aria-controls={panelId}
                      onClick={() => toggle(domain.key)}
                    >
                      <DomainIcon
                        className="h-5 w-5 text-[var(--lc-text-secondary)]"
                        aria-hidden="true"
                      />
                      <span
                        className="flex-1 text-[var(--lc-text-heading)]"
                        style={{ font: 'var(--lc-type-heading-3)' }}
                      >
                        {domain.label}
                      </span>
                      <span
                        className="text-[var(--lc-text-muted)]"
                        style={{ font: 'var(--lc-type-body-sm)' }}
                      >
                        <Numeric>{enabledCount}</Numeric> / <Numeric>{domain.capabilities.length}</Numeric>{' '}
                        {tRoles('detail.domainSummarySuffix', uiLocale)}
                      </span>
                      <ChevronDown
                        className={cn('h-4 w-4 shrink-0 transition-transform', isOpen && 'rotate-180')}
                        aria-hidden="true"
                      />
                    </button>

                    {isOpen ? (
                      <ul id={panelId} className="border-t border-[var(--lc-border)]">
                        {domain.capabilities.map((cap) => (
                          <li
                            key={cap.key}
                            className={cn(
                              'flex items-start gap-3 px-4 py-3',
                              cap.is_financial && 'bg-[var(--lc-status-underOffer-bg)]',
                            )}
                          >
                            <div className="min-w-0 flex-1">
                              <p
                                className="flex items-center gap-1.5 text-[var(--lc-text-primary)]"
                                style={{ font: 'var(--lc-type-body)' }}
                              >
                                {cap.is_financial ? (
                                  <Coins
                                    className="h-4 w-4 text-[var(--lc-status-underOffer-fg)]"
                                    aria-hidden="true"
                                  />
                                ) : null}
                                {cap.label}
                              </p>
                              <p
                                className="mt-0.5 text-[var(--lc-text-muted)]"
                                style={{ font: 'var(--lc-type-body-sm)' }}
                              >
                                {cap.description}
                                {cap.is_financial ? ` ${tRoles('detail.financialSuffix', uiLocale)}` : ''}
                              </p>
                            </div>
                            <span
                              className={cn(
                                'inline-flex shrink-0 items-center rounded-[var(--lc-radius-pill)] border px-2 py-0.5',
                                cap.enabled
                                  ? 'border-transparent bg-[var(--lc-status-published-bg)] text-[var(--lc-status-published-fg)]'
                                  : 'border-[var(--lc-border-strong)] text-[var(--lc-text-muted)]',
                              )}
                              style={{ font: 'var(--lc-type-caption)' }}
                              aria-label={`${cap.label}: ${
                                cap.enabled
                                  ? tRoles('detail.capabilityState.on', uiLocale)
                                  : tRoles('detail.capabilityState.off', uiLocale)
                              }`}
                            >
                              {cap.enabled
                                ? tRoles('detail.capabilityState.on', uiLocale)
                                : tRoles('detail.capabilityState.off', uiLocale)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </section>
                )
              })}
            </div>

            <section
              className="mt-[var(--lc-space-lg)] rounded-[var(--lc-radius-lg)] border border-[var(--lc-border)] bg-[var(--lc-surface-raised)] p-4"
              aria-label={tRoles('detail.members.header', uiLocale)}
            >
              <h2
                className="text-[var(--lc-text-heading)]"
                style={{ font: 'var(--lc-type-heading-3)' }}
              >
                {tRoles('detail.members.header', uiLocale)}
              </h2>
              {pack.member_count > 0 ? (
                <div className="mt-2 flex items-center gap-3">
                  <div className="flex -space-x-2 rtl:space-x-reverse">
                    {pack.members_preview.slice(0, 5).map((m) => (
                      <span
                        key={m.user_id}
                        className="flex h-8 w-8 items-center justify-center rounded-[var(--lc-radius-pill)] border border-[var(--lc-surface-raised)] bg-[var(--lc-surface-sunken)] text-[var(--lc-text-secondary)]"
                        style={{ font: 'var(--lc-type-caption)' }}
                        title={m.display_name || m.user_id}
                        aria-hidden="true"
                      >
                        {memberInitials(m.display_name)}
                      </span>
                    ))}
                  </div>
                  <p
                    className="text-[var(--lc-text-secondary)]"
                    style={{ font: 'var(--lc-type-body-sm)' }}
                  >
                    <Numeric>{pack.member_count}</Numeric>{' '}
                    {tRoles('detail.members.countSuffix', uiLocale)}
                  </p>
                  <Button asChild variant="link" size="sm">
                    <Link to="/agency">{tRoles('detail.members.seeAll', uiLocale)}</Link>
                  </Button>
                </div>
              ) : (
                <p
                  className="mt-2 text-[var(--lc-text-muted)]"
                  style={{ font: 'var(--lc-type-body-sm)' }}
                >
                  {tRoles('detail.members.empty', uiLocale)}
                </p>
              )}
            </section>
          </>
        ) : null}
      </div>
    </div>
  )
}

export default RolePermissionsDetailPage
