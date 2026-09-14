import type { SettingsIndexGroup, SettingsIndexResponse } from '@/api/client'
import type { SettingsNavBadge, SettingsNavGroupData, SettingsNavItemData } from '@/components/settings/types'
import { SETTINGS_SYNONYMS, settingsCopy } from '@/lib/settings-copy'
import { resolveSettingsIcon } from '@/lib/settings-icons'

/** Minimum menu when GET /api/settings/index fails (Account + Security + Danger). */
export const FALLBACK_SETTINGS_GROUPS: SettingsIndexGroup[] = [
  {
    id: 'account',
    label: 'Account',
    label_key: 'settings.groups.account',
    items: [
      {
        id: 'profile',
        label: 'Account & profile',
        label_key: 'settings.items.profile',
        route: '/settings/account',
        icon: 'user',
      },
    ],
  },
  {
    id: 'security',
    label: 'Security',
    label_key: 'settings.groups.security',
    items: [
      {
        id: 'two_factor',
        label: 'Two-factor authentication',
        label_key: 'settings.items.two_factor',
        route: '/settings/2fa',
        icon: 'shield',
      },
      {
        id: 'sessions',
        label: 'Sessions & devices',
        label_key: 'settings.items.sessions',
        route: '/settings/sessions',
        icon: 'monitor',
      },
    ],
  },
  {
    id: 'danger',
    label: 'Danger zone',
    label_key: 'settings.groups.danger',
    items: [
      {
        id: 'delete_account',
        label: 'Delete account',
        label_key: 'settings.items.delete_account',
        route: '/settings/danger/delete-account',
        icon: 'trash-2',
      },
    ],
  },
]

/** Canonical danger-zone path (SHR-SET-001 §Nav-groups). */
export const DELETE_ACCOUNT_ROUTE = '/settings/danger/delete-account'

export function canonicalizeSettingsRoute(route: string): string {
  if (route === '/settings/delete-account' || route === '/settings/account/delete') {
    return DELETE_ACCOUNT_ROUTE
  }
  return route
}

function mapBadge(
  badge: SettingsIndexGroup['items'][number]['badge'],
  locale: string,
): SettingsNavBadge | null {
  if (!badge) return null
  if (badge.kind === 'count') {
    const value = Number(badge.value)
    if (!value || value <= 0) return null
    return { kind: 'count', value }
  }
  const copy = settingsCopy(locale)
  const label =
    badge.label ||
    (badge.label_key === 'badge.2faOff'
      ? copy['badge.2faOff']
      : badge.label_key === 'badge.pastDue'
        ? copy['badge.pastDue']
        : badge.label_key || '')
  if (!label) return null
  const tone = badge.tone === 'danger' || badge.tone === 'warning' ? badge.tone : 'default'
  return { kind: 'status', tone, label }
}

export function indexGroupsToNav(
  groups: SettingsIndexGroup[],
  locale: string = 'en',
): SettingsNavGroupData[] {
  return groups
    .map((group) => {
      const items: SettingsNavItemData[] = (group.items || []).map((item) => ({
        id: item.id,
        route: canonicalizeSettingsRoute(item.route),
        icon: resolveSettingsIcon(item.icon),
        label: item.label,
        badge: mapBadge(item.badge, locale),
        danger: group.id === 'danger' || item.id === 'delete_account',
        synonyms: SETTINGS_SYNONYMS[item.id],
        description: item.label,
      }))
      return { id: group.id, label: group.label, items }
    })
    .filter((group) => group.items.length > 0)
}

export function navGroupsFromIndex(
  index: SettingsIndexResponse | null,
  options?: { fallback?: boolean; locale?: string },
): SettingsNavGroupData[] {
  const locale = options?.locale ?? 'en'
  if (index?.groups?.length) return indexGroupsToNav(index.groups, locale)
  if (options?.fallback) return indexGroupsToNav(FALLBACK_SETTINGS_GROUPS, locale)
  return []
}

export function collectItemRoutes(groups: SettingsNavGroupData[]): string[] {
  return groups.flatMap((g) => g.items.map((item) => item.route))
}
