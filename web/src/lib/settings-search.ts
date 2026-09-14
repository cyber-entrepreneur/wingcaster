import type { SettingsNavGroupData, SettingsNavItemData } from '@/components/settings/types'

function haystack(item: SettingsNavItemData): string {
  const parts = [item.label, item.description, ...(item.synonyms ?? [])]
  return parts.filter(Boolean).join(' ').toLowerCase()
}

function matchesQuery(item: SettingsNavItemData, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  return haystack(item).includes(q)
}

/**
 * Client-side settings search. Operates only on the capability-scoped list
 * already returned by GET /api/settings/index — never invents hidden groups.
 */
export function filterSettingsGroups(
  groups: SettingsNavGroupData[],
  query: string,
): SettingsNavGroupData[] {
  const q = query.trim()
  if (!q) return groups
  return groups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => matchesQuery(item, q)),
    }))
    .filter((group) => group.items.length > 0)
}

export function firstVisibleSettingsItem(
  groups: SettingsNavGroupData[],
): SettingsNavItemData | null {
  for (const group of groups) {
    if (group.items[0]) return group.items[0]
  }
  return null
}

/** Longest-prefix winner among catalog routes for the current pathname. */
export function longestMatchingSettingsRoute(pathname: string, routes: string[]): string | null {
  const matches = routes.filter(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  )
  if (matches.length === 0) return null
  return matches.reduce((a, b) => (a.length >= b.length ? a : b))
}
