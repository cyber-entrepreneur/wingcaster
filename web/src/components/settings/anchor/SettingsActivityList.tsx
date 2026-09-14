import { formatRelativeTime } from '@/lib/relative-time'
import { settingsCopy } from '@/lib/settings-copy'
import { Numeric } from '@/components/ui/numeric'

export interface SettingsActivityItem {
  kind?: string
  label: string
  at: string
}

export function SettingsActivityList({
  items,
  locale = 'en',
}: {
  items: SettingsActivityItem[]
  locale?: string
}) {
  const copy = settingsCopy(locale)
  return (
    <section>
      <h2 className="mb-[var(--lc-space-sm)] text-[var(--lc-text-heading)]" style={{ font: 'var(--lc-type-heading-3)' }}>
        {copy['anchor.activity.title']}
      </h2>
      {items.length === 0 ? (
        <p className="text-[var(--lc-text-muted)]" style={{ font: 'var(--lc-type-body)' }}>
          {copy['anchor.activity.empty']}
        </p>
      ) : (
        <ul className="divide-y divide-[var(--lc-border)]" aria-label={copy['anchor.activity.title']}>
          {items.slice(0, 3).map((item, index) => (
            <li key={`${item.at}-${index}`} className="flex items-baseline justify-between gap-[var(--lc-space-md)] py-[var(--lc-space-sm)]">
              <span style={{ font: 'var(--lc-type-body)' }}>{item.label}</span>
              <span className="text-[var(--lc-text-muted)]" style={{ font: 'var(--lc-type-caption)' }} title={item.at}>
                <Numeric>{formatRelativeTime(item.at)}</Numeric>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
