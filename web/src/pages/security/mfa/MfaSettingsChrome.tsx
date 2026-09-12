import type { ReactNode } from 'react'
import { Shield } from 'lucide-react'
import { SettingsShell } from '@/components/settings'
import type { SettingsNavGroupData } from '@/components/settings'

const MFA_NAV_GROUPS: SettingsNavGroupData[] = [
  {
    id: 'security',
    label: 'Security',
    items: [
      {
        id: '2fa',
        route: '/settings/2fa',
        icon: Shield,
        label: 'Two-factor authentication',
      },
    ],
  },
]

export function MfaSettingsChrome({ children }: { children: ReactNode }) {
  return (
    <SettingsShell mobileView="detail" title="Settings" groups={MFA_NAV_GROUPS}>
      {children}
    </SettingsShell>
  )
}
