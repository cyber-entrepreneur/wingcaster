import { describe, expect, it } from 'vitest'
import { filterSettingsGroups, firstVisibleSettingsItem, longestMatchingSettingsRoute } from './settings-search'
import type { SettingsNavGroupData } from '@/components/settings/types'
import { User } from 'lucide-react'

const groups: SettingsNavGroupData[] = [
  {
    id: 'account',
    label: 'Account',
    items: [{ id: 'profile', route: '/settings/account', icon: User, label: 'Account & profile', synonyms: ['name'] }],
  },
  {
    id: 'security',
    label: 'Security',
    items: [
      { id: 'two_factor', route: '/settings/2fa', icon: User, label: 'Two-factor authentication', synonyms: ['2FA', 'MFA'] },
      { id: 'sessions', route: '/settings/sessions', icon: User, label: 'Sessions & devices' },
    ],
  },
]

describe('filterSettingsGroups', () => {
  it('hides groups with no matching items', () => {
    const filtered = filterSettingsGroups(groups, '2FA')
    expect(filtered.map((g) => g.id)).toEqual(['security'])
    expect(filtered[0].items.map((i) => i.id)).toEqual(['two_factor'])
  })

  it('does not invent items that were never in the capability list', () => {
    const solo = groups.filter((g) => g.id !== 'security')
    const filtered = filterSettingsGroups(solo, 'members')
    expect(filtered).toEqual([])
  })

  it('returns first visible item for Enter navigation', () => {
    const filtered = filterSettingsGroups(groups, 'session')
    expect(firstVisibleSettingsItem(filtered)?.route).toBe('/settings/sessions')
  })
})

describe('longestMatchingSettingsRoute', () => {
  it('prefers the longer prefix', () => {
    const routes = ['/settings/account', '/settings/account/locale']
    expect(longestMatchingSettingsRoute('/settings/account/locale', routes)).toBe('/settings/account/locale')
    expect(longestMatchingSettingsRoute('/settings/account', routes)).toBe('/settings/account')
  })
})
