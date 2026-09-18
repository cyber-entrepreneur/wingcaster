import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpRight, Store } from 'lucide-react'
import { api, type SourcePerformanceResponse, type SourcePerformanceRow } from '@/api/client'
import { Numeric } from '@/components/ui/numeric'
import { useLocale, type AppLocale } from '@/hooks/useLocale'
import { cn } from '@/lib/utils'

export const BAZAAR_SOURCE = 'bazaar'

const COPY: Record<
  | 'heading' | 'subhead' | 'leads' | 'inquiries' | 'deals' | 'share' | 'loading' | 'error' | 'retry'
  | 'empty' | 'bazaarTitle' | 'bazaarEmpty' | 'bazaarCta' | 'viewLeads',
  Record<AppLocale, string>
> = {
  heading: { en: 'Lead source performance', ar: 'أداء مصادر العملاء المحتملين' },
  subhead: { en: 'Where your leads, inquiries, and deals come from', ar: 'من أين يأتي عملاؤك واستفساراتك وصفقاتك' },
  leads: { en: 'Leads', ar: 'عملاء محتملون' },
  inquiries: { en: 'Inquiries', ar: 'استفسارات' },
  deals: { en: 'Deals', ar: 'صفقات' },
  share: { en: 'share', ar: 'الحصة' },
  loading: { en: 'Loading source performance…', ar: 'جارٍ تحميل أداء المصادر…' },
  error: { en: "Couldn't load source performance.", ar: 'تعذّر تحميل أداء المصادر.' },
  retry: { en: 'Try again', ar: 'حاول مرة أخرى' },
  empty: { en: 'No lead activity yet — leads will appear here as they arrive.', ar: 'لا يوجد نشاط بعد — ستظهر العملاء المحتملون هنا عند وصولهم.' },
  bazaarTitle: { en: 'Real Estate Bazaar', ar: 'بازار العقارات' },
  bazaarEmpty: {
    en: "No Bazaar leads yet. Turn on marketplace syndication for your listings to reach Bazaar's audience.",
    ar: 'لا يوجد عملاء من بازار بعد. فعّل النشر في السوق لقوائمك للوصول إلى جمهور بازار.',
  },
  bazaarCta: { en: 'Manage listings', ar: 'إدارة القوائم' },
  viewLeads: { en: 'View Bazaar leads', ar: 'عرض عملاء بازار' },
}

const SOURCE_LABELS: Record<string, string> = {
  bazaar: 'Real Estate Bazaar',
  direct: 'Direct',
  property_finder: 'Property Finder',
  bayut: 'Bayut',
  dubizzle: 'Dubizzle',
  olx: 'OLX',
}

function sourceLabel(source: string): string {
  if (SOURCE_LABELS[source]) return SOURCE_LABELS[source]
  return source.replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

interface SourcePerformancePanelProps {
  /** Optional scope params passed through to GET /api/analytics/source-performance. */
  params?: { start_date?: string; end_date?: string; scope?: 'all'; agency_id?: string }
  className?: string
}

/**
 * SHR-INT-002 — Bazaar performance in analytics.
 *
 * A shared analytics section that breaks leads / inquiries / deals down by
 * source, surfacing Real Estate Bazaar first-class next to Direct and portal
 * channels. Empty/nudge state points at marketplace syndication (SHR-INT-001).
 */
export function SourcePerformancePanel({ params, className }: SourcePerformancePanelProps) {
  const { locale, dir } = useLocale()
  const [data, setData] = useState<SourcePerformanceResponse | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')

  const load = useCallback(async () => {
    setStatus('loading')
    try {
      const res = await api.getSourcePerformance(params)
      setData(res)
      setStatus('ready')
    } catch {
      setStatus('error')
    }
  }, [params])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <section
      dir={dir}
      data-testid="source-performance-panel"
      aria-label={COPY.heading[locale]}
      className={cn(
        'rounded-[var(--lc-radius-lg)] border border-[var(--lc-border)] bg-[var(--lc-surface)] p-[var(--lc-space-lg)]',
        'font-[family-name:var(--lc-font-ui)]',
        className,
      )}
    >
      <header className="mb-[var(--lc-space-md)]">
        <h2 className="text-[length:var(--lc-type-heading-3)] font-semibold text-[var(--lc-text-heading)]">
          {COPY.heading[locale]}
        </h2>
        <p className="text-[length:var(--lc-type-body-sm)] text-[var(--lc-text-muted)]">{COPY.subhead[locale]}</p>
      </header>

      {status === 'loading' ? (
        <div className="space-y-[var(--lc-space-sm)]" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-10 animate-pulse rounded-[var(--lc-radius-md)] bg-[var(--lc-surface-sunken)]" />
          ))}
          <span className="sr-only">{COPY.loading[locale]}</span>
        </div>
      ) : null}

      {status === 'error' ? (
        <div className="flex flex-col items-start gap-[var(--lc-space-sm)]">
          <p className="text-[length:var(--lc-type-body-sm)] text-[var(--lc-status-unpublished-fg)]">{COPY.error[locale]}</p>
          <button
            type="button"
            onClick={() => void load()}
            className="text-[length:var(--lc-type-body-sm)] font-semibold text-[var(--lc-text-brand)] underline underline-offset-2"
          >
            {COPY.retry[locale]}
          </button>
        </div>
      ) : null}

      {status === 'ready' && data ? (
        <>
          <BazaarHighlight bazaar={data.bazaar} locale={locale} />
          {data.totals.conversations === 0 && data.totals.inquiries === 0 ? (
            <p className="mt-[var(--lc-space-md)] text-[length:var(--lc-type-body-sm)] text-[var(--lc-text-muted)]">
              {COPY.empty[locale]}
            </p>
          ) : (
            <ul className="mt-[var(--lc-space-md)] space-y-[var(--lc-space-sm)]">
              {data.sources.map((row) => (
                <SourceBar key={row.source} row={row} locale={locale} />
              ))}
            </ul>
          )}
        </>
      ) : null}
    </section>
  )
}

function BazaarHighlight({ bazaar, locale }: { bazaar: SourcePerformanceRow; locale: AppLocale }) {
  const hasActivity = bazaar.conversations > 0 || bazaar.inquiries > 0
  return (
    <div className="rounded-[var(--lc-radius-md)] border border-[var(--lc-accent)] bg-[var(--lc-surface-sunken)] p-[var(--lc-space-md)]">
      <div className="flex items-center gap-[var(--lc-space-sm)]">
        <Store className="h-5 w-5 shrink-0 text-[var(--lc-accent-bold)]" aria-hidden="true" />
        <h3 className="text-[length:var(--lc-type-body)] font-semibold text-[var(--lc-text-heading)]">
          {COPY.bazaarTitle[locale]}
        </h3>
      </div>

      {hasActivity ? (
        <>
          <dl className="mt-[var(--lc-space-sm)] grid grid-cols-3 gap-[var(--lc-space-sm)]">
            <Metric label={COPY.leads[locale]} value={bazaar.conversations} />
            <Metric label={COPY.inquiries[locale]} value={bazaar.inquiries} />
            <Metric label={COPY.deals[locale]} value={bazaar.deals} />
          </dl>
          <Link
            to="/dashboard/inbox?source=bazaar"
            className="mt-[var(--lc-space-sm)] inline-flex items-center gap-[var(--lc-space-2xs)] text-[length:var(--lc-type-body-sm)] font-semibold text-[var(--lc-text-brand)]"
          >
            {COPY.viewLeads[locale]}
            <ArrowUpRight className="h-4 w-4 rtl:-scale-x-100" aria-hidden="true" />
          </Link>
        </>
      ) : (
        <div className="mt-[var(--lc-space-xs)]">
          <p className="text-[length:var(--lc-type-body-sm)] text-[var(--lc-text-muted)]">{COPY.bazaarEmpty[locale]}</p>
          <Link
            to="/listings"
            className="mt-[var(--lc-space-xs)] inline-flex items-center gap-[var(--lc-space-2xs)] text-[length:var(--lc-type-body-sm)] font-semibold text-[var(--lc-text-brand)]"
          >
            {COPY.bazaarCta[locale]}
            <ArrowUpRight className="h-4 w-4 rtl:-scale-x-100" aria-hidden="true" />
          </Link>
        </div>
      )}
    </div>
  )
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <Numeric as="dd" className="text-[length:var(--lc-type-heading-3)] font-semibold text-[var(--lc-text-heading)]">
        {value.toLocaleString()}
      </Numeric>
      <dt className="text-[length:var(--lc-type-caption)] text-[var(--lc-text-muted)]">{label}</dt>
    </div>
  )
}

function SourceBar({ row, locale }: { row: SourcePerformanceRow; locale: AppLocale }) {
  const isBazaar = row.source === BAZAAR_SOURCE
  return (
    <li
      data-source={row.source}
      className={cn(
        'rounded-[var(--lc-radius-md)] p-[var(--lc-space-sm)]',
        isBazaar ? 'bg-[var(--lc-surface-sunken)]' : '',
      )}
    >
      <div className="flex items-baseline justify-between gap-[var(--lc-space-sm)]">
        <span className="truncate text-[length:var(--lc-type-body-sm)] font-medium text-[var(--lc-text-primary)]">
          {sourceLabel(row.source)}
        </span>
        <span className="shrink-0 text-[length:var(--lc-type-caption)] text-[var(--lc-text-muted)]">
          <Numeric>{row.lead_share}</Numeric>% {COPY.share[locale]}
        </span>
      </div>
      <div
        className="mt-[var(--lc-space-2xs)] h-2 w-full overflow-hidden rounded-[var(--lc-radius-pill)] bg-[var(--lc-surface-sunken)]"
        role="presentation"
      >
        <div
          className={cn('h-full rounded-[var(--lc-radius-pill)]', isBazaar ? 'bg-[var(--lc-accent-bold)]' : 'bg-[var(--lc-accent)]')}
          style={{ inlineSize: `${Math.max(2, Math.min(100, row.lead_share))}%` }}
        />
      </div>
      <div className="mt-[var(--lc-space-2xs)] flex gap-[var(--lc-space-md)] text-[length:var(--lc-type-caption)] text-[var(--lc-text-muted)]">
        <span>
          <Numeric>{row.conversations.toLocaleString()}</Numeric> {COPY.leads[locale]}
        </span>
        <span>
          <Numeric>{row.inquiries.toLocaleString()}</Numeric> {COPY.inquiries[locale]}
        </span>
        <span>
          <Numeric>{row.deals.toLocaleString()}</Numeric> {COPY.deals[locale]}
        </span>
      </div>
    </li>
  )
}
