import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ArrowLeftRight,
  ChevronRight,
  Globe,
  LayoutGrid,
  LineChart,
  Lock,
  MessageSquare,
  Plug,
  ScrollText,
  ShieldCheck,
  UserPlus,
  Users,
} from 'lucide-react'
import { api } from '@/api/client'
import { Button } from '@/components/ui/button'
import { Numeric } from '@/components/ui/numeric'
import { useLocale } from '@/hooks/useLocale'
import { usePageTitle } from '@/lib/usePageTitle'
import type { AgencySettingsOverview } from '@/types/agencySettings'

type LoadState = 'loading' | 'ready' | 'error' | 'forbidden'

const ADMIN_ROLES = new Set(['owner', 'admin'])

type BadgeTone = 'neutral' | 'attention' | 'positive'

interface SettingsCard {
  id: string
  title: string
  description: string
  to: string
  icon: typeof Users
  /** Minimum role able to see this card. */
  scope: 'all' | 'admin' | 'owner'
  badge?: { label: string; tone: BadgeTone }
}

interface SettingsGroup {
  id: string
  title: string
  cards: SettingsCard[]
}

const BADGE_CLASS: Record<BadgeTone, string> = {
  neutral: 'border-[var(--lc-border)] bg-[var(--lc-surface-sunken)] text-[var(--lc-text-secondary)]',
  attention: 'border-amber-200 bg-amber-50 text-amber-900',
  positive: 'border-emerald-200 bg-emerald-50 text-emerald-900',
}

function buildGroups(overview: AgencySettingsOverview): SettingsGroup[] {
  const { stats } = overview
  return [
    {
      id: 'team',
      title: 'Team & access',
      cards: [
        {
          id: 'members',
          title: 'Members',
          description: 'People in your agency, their roles, and status.',
          to: '/agency',
          icon: Users,
          scope: 'all',
          badge: { label: `${stats.member_count} member${stats.member_count === 1 ? '' : 's'}`, tone: 'neutral' },
        },
        {
          id: 'applications',
          title: 'Applications',
          description: 'Agents requesting to join your agency.',
          to: '/agency/members/applications',
          icon: UserPlus,
          scope: 'admin',
          badge: stats.pending_applications > 0
            ? { label: `${stats.pending_applications} pending`, tone: 'attention' }
            : { label: stats.accepting_applications ? 'Open' : 'Closed', tone: 'neutral' },
        },
        {
          id: 'roles',
          title: 'Roles & permissions',
          description: 'Capability packs that control what members can do.',
          to: '/agency/settings/roles',
          icon: ShieldCheck,
          scope: 'admin',
        },
        {
          id: 'ownership',
          title: 'Ownership transfer',
          description: 'Hand agency ownership to another owner or admin.',
          to: '/agency/settings/ownership-transfer',
          icon: ArrowLeftRight,
          scope: 'owner',
          badge: stats.pending_ownership_transfer ? { label: 'In progress', tone: 'attention' } : undefined,
        },
      ],
    },
    {
      id: 'security',
      title: 'Security & compliance',
      cards: [
        {
          id: 'security',
          title: 'Security policy',
          description: 'Two-factor requirements and sign-in safeguards.',
          to: '/agency/settings/security',
          icon: Lock,
          scope: 'admin',
          badge: stats.mfa_required
            ? { label: '2FA enforced', tone: 'positive' }
            : { label: '2FA optional', tone: 'neutral' },
        },
        {
          id: 'audit',
          title: 'Audit log',
          description: 'Every sensitive action taken across the agency.',
          to: '/agency/settings/audit',
          icon: ScrollText,
          scope: 'admin',
        },
      ],
    },
    {
      id: 'growth',
      title: 'Growth & channels',
      cards: [
        {
          id: 'white-label',
          title: 'White-label site',
          description: 'Your branded public site, template, and domain.',
          to: '/white-label',
          icon: Globe,
          scope: 'admin',
        },
        {
          id: 'widgets',
          title: 'Widgets',
          description: 'Embeddable listing and lead-capture widgets.',
          to: '/widgets',
          icon: LayoutGrid,
          scope: 'admin',
        },
        {
          id: 'whatsapp',
          title: 'WhatsApp Listings',
          description: 'Per-agent WhatsApp intake entitlements.',
          to: '/agency/whatsapp-listings',
          icon: MessageSquare,
          scope: 'admin',
        },
        {
          id: 'integrations',
          title: 'Integrations',
          description: 'Connect third-party tools and portals.',
          to: '/integrations',
          icon: Plug,
          scope: 'admin',
        },
      ],
    },
    {
      id: 'pricing',
      title: 'Pricing',
      cards: [
        {
          id: 'pricing',
          title: 'Price health',
          description: 'Portfolio pricing overview and comparables.',
          to: '/agency/pricing',
          icon: LineChart,
          scope: 'all',
        },
      ],
    },
  ]
}

function canSee(scope: SettingsCard['scope'], role: string): boolean {
  if (scope === 'all') return true
  if (scope === 'owner') return role === 'owner'
  return ADMIN_ROLES.has(role)
}

export function AgencySettingsHomePage() {
  const navigate = useNavigate()
  const { locale } = useLocale()
  usePageTitle('Agency settings')

  const [status, setStatus] = useState<LoadState>('loading')
  const [overview, setOverview] = useState<AgencySettingsOverview | null>(null)

  const load = useCallback(async () => {
    setStatus('loading')
    try {
      const res = await api.getAgencySettingsOverview()
      setOverview(res)
      setStatus('ready')
    } catch (err) {
      const s = (err as { status?: number }).status
      setStatus(s === 401 || s === 403 ? 'forbidden' : 'error')
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const role = overview?.my_role ?? ''
  const groups = overview
    ? buildGroups(overview)
        .map((group) => ({ ...group, cards: group.cards.filter((card) => canSee(card.scope, role)) }))
        .filter((group) => group.cards.length > 0)
    : []

  return (
    <div
      className="min-h-full bg-[var(--lc-bg-page)]"
      data-screen="AGN-SET-001"
      dir={locale === 'ar' ? 'rtl' : 'ltr'}
    >
      <div className="mx-auto max-w-[1080px] px-[var(--lc-space-xl)] py-[var(--lc-space-xl)]">
        <nav
          aria-label="Breadcrumb"
          className="flex flex-wrap items-center gap-1 text-[var(--lc-text-muted)]"
          style={{ font: 'var(--lc-type-body-sm)' }}
        >
          <Link to="/agency" className="hover:underline">Agency</Link>
          <ChevronRight className="h-3 w-3 rtl:rotate-180" aria-hidden="true" />
          <span aria-current="page" className="text-[var(--lc-text-secondary)]">Settings</span>
        </nav>

        <header className="mt-[var(--lc-space-md)]">
          <h1 className="text-[var(--lc-text-heading)]" style={{ font: 'var(--lc-type-heading-1)' }}>
            {overview?.agency.name ? `${overview.agency.name} settings` : 'Agency settings'}
          </h1>
          <p className="mt-1 text-[var(--lc-text-secondary)]" style={{ font: 'var(--lc-type-body-lg)' }}>
            Everything you can configure for your agency, in one place.
          </p>
        </header>

        {status === 'loading' ? (
          <div className="mt-[var(--lc-space-lg)] grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="h-[132px] animate-pulse rounded-[var(--lc-radius-lg)] border border-[var(--lc-border)] bg-[var(--lc-surface-sunken)]"
                aria-hidden="true"
              />
            ))}
            <span className="sr-only">Loading agency settings</span>
          </div>
        ) : null}

        {status === 'forbidden' ? (
          <div className="mt-[var(--lc-space-xl)] flex flex-col items-start gap-3">
            <p className="text-[var(--lc-text-primary)]" style={{ font: 'var(--lc-type-body-lg)' }}>
              You need an active agency membership to view these settings.
            </p>
            <Button type="button" variant="outline" onClick={() => navigate('/agency')}>
              Back to agency
            </Button>
          </div>
        ) : null}

        {status === 'error' ? (
          <div className="mt-[var(--lc-space-xl)] flex flex-col items-start gap-3">
            <p className="text-[var(--lc-text-primary)]" style={{ font: 'var(--lc-type-body-lg)' }}>
              We couldn’t load your agency settings.
            </p>
            <Button type="button" variant="outline" onClick={() => void load()}>
              Try again
            </Button>
          </div>
        ) : null}

        {status === 'ready' && groups.length === 0 ? (
          <p className="mt-[var(--lc-space-xl)] text-[var(--lc-text-secondary)]" style={{ font: 'var(--lc-type-body-lg)' }}>
            Your role doesn’t have access to any agency settings yet. Ask an owner or admin for access.
          </p>
        ) : null}

        {status === 'ready' && groups.length > 0 ? (
          <div className="mt-[var(--lc-space-lg)] flex flex-col gap-8">
            {groups.map((group) => (
              <section key={group.id} aria-label={group.title}>
                <h2 className="mb-3 text-[var(--lc-text-muted)]" style={{ font: 'var(--lc-type-overline)' }}>
                  {group.title}
                </h2>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {group.cards.map((card) => (
                    <SettingsCardLink key={card.id} card={card} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  )
}

function SettingsCardLink({ card }: { card: SettingsCard }) {
  const Icon = card.icon
  return (
    <Link
      to={card.to}
      className="group flex min-h-tap flex-col gap-3 rounded-[var(--lc-radius-lg)] border border-[var(--lc-border)] bg-[var(--lc-surface-raised)] p-4 transition-colors hover:border-[var(--lc-border-strong)] hover:bg-[var(--lc-surface-sunken)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lc-action-primary)]"
    >
      <div className="flex items-start justify-between gap-2">
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-[var(--lc-radius-md)] bg-[var(--lc-surface-sunken)] text-[var(--lc-text-secondary)]">
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
        {card.badge ? (
          <span
            className={`inline-flex items-center rounded-full border px-2 py-0.5 ${BADGE_CLASS[card.badge.tone]}`}
            style={{ font: 'var(--lc-type-body-xs)' }}
          >
            {/\d/.test(card.badge.label)
              ? <Numeric>{card.badge.label}</Numeric>
              : card.badge.label}
          </span>
        ) : null}
      </div>
      <div>
        <h3 className="flex items-center gap-1 text-[var(--lc-text-heading)]" style={{ font: 'var(--lc-type-heading-4)' }}>
          {card.title}
          <ChevronRight className="h-4 w-4 text-[var(--lc-text-muted)] transition-transform group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5" aria-hidden="true" />
        </h3>
        <p className="mt-1 text-[var(--lc-text-secondary)]" style={{ font: 'var(--lc-type-body-sm)' }}>
          {card.description}
        </p>
      </div>
    </Link>
  )
}

export default AgencySettingsHomePage
