import { describe, expect, it } from 'vitest'
import { indexGroupsToNav, navGroupsFromIndex } from './settings-nav'

describe('navGroupsFromIndex', () => {
  it('renders only groups returned by the server', () => {
    const nav = navGroupsFromIndex({
      groups: [
        {
          id: 'account',
          label: 'Account',
          items: [{ id: 'profile', label: 'Account & profile', route: '/settings/account', icon: 'user' }],
        },
      ],
    })
    expect(nav.map((g) => g.id)).toEqual(['account'])
    expect(nav[0].items.map((i) => i.id)).toEqual(['profile'])
  })

  it('uses fallback Account + Security + Danger when asked', () => {
    const nav = navGroupsFromIndex(null, { fallback: true })
    expect(nav.map((g) => g.id)).toEqual(['account', 'security', 'danger'])
  })

  it('marks danger-zone items', () => {
    const nav = indexGroupsToNav([
      {
        id: 'danger',
        label: 'Danger zone',
        items: [{ id: 'delete_account', label: 'Delete account', route: '/settings/danger/delete-account', icon: 'trash-2' }],
      },
    ])
    expect(nav[0].items[0].danger).toBe(true)
  })
})
