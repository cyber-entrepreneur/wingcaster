import { usePageTitle } from '@/lib/usePageTitle'
import { InterfaceModeCard } from '@/components/settings/InterfaceModeCard'

/**
 * Preferences settings pane — hosts AGT-SET-002 Interface mode card.
 * Deep-link: `/settings/preferences#interface-mode`
 */
export function PreferencesPage() {
  usePageTitle('Preferences')

  return (
    <div className="mx-auto max-w-3xl px-[var(--lc-space-md)] py-[var(--lc-space-xl)] sm:px-[var(--lc-space-xl)]">
      <header className="mb-[var(--lc-space-xl)]">
        <h1
          className="text-[var(--lc-text-heading)]"
          style={{ font: 'var(--lc-type-heading-1)', letterSpacing: 'var(--lc-tracking-heading-1)' }}
        >
          Preferences
        </h1>
        <p
          className="mt-[var(--lc-space-2xs)] text-[var(--lc-text-muted)]"
          style={{ font: 'var(--lc-type-body)' }}
        >
          Choose how WingCaster looks and behaves for this tenant.
        </p>
      </header>

      <InterfaceModeCard />
    </div>
  )
}
