import { useLocale } from '@/hooks/useLocale'
import { t, type DashboardCopyKey } from '@/pages/agent/dashboard/copy'

/**
 * AGT-DSH-002 Pro dashboard mount target.
 *
 * Thin structural stub for Wave-8 Agent 5 (`feat/wave-8-dsh-mount`).
 * Agent 1 (`feat/wave-8-pro`) owns the full KPI / widget-grid suite and can
 * replace this file in place — keep the `ProDashboard` named export stable.
 */
export interface ProDashboardProps {
  /** Optional greeting name; stub uses a generic fallback. */
  agentName?: string
}

const QUICK_ACTIONS: DashboardCopyKey[] = [
  'action.newListing',
  'action.contact',
  'action.task',
  'action.publish',
  'action.inbox',
  'action.search',
]

const KPI_KEYS: DashboardCopyKey[] = [
  'kpi.listings',
  'kpi.views',
  'kpi.inquiries',
  'kpi.pipeline',
]

export function ProDashboard({ agentName }: ProDashboardProps) {
  const { locale, isArabic } = useLocale()
  const copyLocale = isArabic ? 'ar' : 'en'
  const name = agentName?.trim() || t('greeting.nameFallback', copyLocale)
  const today = new Date().toLocaleDateString(locale, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })

  return (
    <div
      className="min-h-screen bg-[var(--lc-bg-page)] text-[var(--lc-text-primary)]"
      data-dashboard-mode="pro"
      data-testid="pro-dashboard"
    >
      {/* Sticky quick-actions bar — structure only; Agent 1 wires actions */}
      <div className="sticky top-0 z-20 border-b border-[var(--lc-border)] bg-[var(--lc-surface-raised)]">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-2 px-4 py-3 sm:px-6 lg:px-8">
          {QUICK_ACTIONS.map((key) => (
            <button
              key={key}
              type="button"
              disabled
              className="inline-flex h-11 min-w-[2.75rem] items-center justify-center rounded-[var(--lc-radius-md)] border border-[var(--lc-border)] bg-[var(--lc-surface)] px-3 text-sm text-[var(--lc-text-secondary)] opacity-70"
            >
              {t(key, copyLocale)}
            </button>
          ))}
          <span className="ms-auto text-xs text-[var(--lc-text-muted)]">
            {t('footer.density', copyLocale)}
          </span>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <header className="mb-6">
          <h1 className="text-[length:var(--lc-type-display,1.75rem)] font-semibold text-[var(--lc-text-heading)]">
            {t('greeting.goodDay', copyLocale, { name })}
          </h1>
          <p className="mt-1 text-sm text-[var(--lc-text-muted)]">{today}</p>
        </header>

        {/* Widget grid shell — placeholders until Agent 1 lands widgets */}
        <div
          className="grid gap-4 md:grid-cols-12"
          data-testid="pro-dashboard-widget-grid"
          aria-label={t('aria.widgetGrid', copyLocale)}
        >
          <section className="md:col-span-12 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {KPI_KEYS.map((key) => (
              <div
                key={key}
                className="rounded-[var(--lc-radius-lg)] border border-[var(--lc-border)] bg-[var(--lc-surface-raised)] p-4 shadow-[var(--lc-elevation-sm)]"
              >
                <p className="text-xs text-[var(--lc-text-muted)]">{t(key, copyLocale)}</p>
                <p className="mt-2 font-mono text-2xl tabular-nums text-[var(--lc-text-heading)]">—</p>
              </div>
            ))}
          </section>

          <section className="rounded-[var(--lc-radius-lg)] border border-[var(--lc-border)] bg-[var(--lc-surface-raised)] p-4 md:col-span-8">
            <h2 className="text-sm font-semibold text-[var(--lc-text-heading)]">
              {t('widget.urgent', copyLocale)}
            </h2>
            <p className="mt-2 text-sm text-[var(--lc-text-muted)]">
              {t('widget.slotPlaceholder', copyLocale)}
            </p>
          </section>

          <section className="rounded-[var(--lc-radius-lg)] border border-[var(--lc-border)] bg-[var(--lc-surface-raised)] p-4 md:col-span-4">
            <h2 className="text-sm font-semibold text-[var(--lc-text-heading)]">
              {t('widget.quota', copyLocale)}
            </h2>
            <p className="mt-2 text-sm text-[var(--lc-text-muted)]">
              {t('widget.slotPlaceholder', copyLocale)}
            </p>
          </section>

          <section className="rounded-[var(--lc-radius-lg)] border border-[var(--lc-border)] bg-[var(--lc-surface-raised)] p-4 md:col-span-6">
            <h2 className="text-sm font-semibold text-[var(--lc-text-heading)]">
              {t('widget.recentListings', copyLocale)}
            </h2>
            <p className="mt-2 text-sm text-[var(--lc-text-muted)]">
              {t('widget.slotPlaceholder', copyLocale)}
            </p>
          </section>

          <section className="rounded-[var(--lc-radius-lg)] border border-[var(--lc-border)] bg-[var(--lc-surface-raised)] p-4 md:col-span-6">
            <h2 className="text-sm font-semibold text-[var(--lc-text-heading)]">
              {t('widget.inboxPreview', copyLocale)}
            </h2>
            <p className="mt-2 text-sm text-[var(--lc-text-muted)]">
              {t('widget.slotPlaceholder', copyLocale)}
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}

export default ProDashboard
