import { SettingsPaneHeader } from '@/components/settings'

/** Fallback for catalog links that are not yet implemented in this shell. */
export function SettingsUnavailablePage({ title = 'Available soon' }: { title?: string }) {
  return (
    <div>
      <SettingsPaneHeader title={title} sub="This settings page is not available on this environment yet." />
    </div>
  )
}
