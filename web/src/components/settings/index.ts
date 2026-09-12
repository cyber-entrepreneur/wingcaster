/**
 * Settings shell family — SHR-SET-001 sub-nav chrome shared by
 * SHR-SET-002 (account), SHR-SET-003 (billing/notifications),
 * SHR-SET-004 (sessions & devices), and SHR-SET-005 (danger zone).
 *
 * Stub extract for Shared Components Prep. Business logic, SWR hooks,
 * and route registration land in Wave 4.
 */

export { SettingsShell } from './SettingsShell'
export type { SettingsShellProps } from './SettingsShell'

export { SettingsSidebar } from './SettingsSidebar'
export type { SettingsSidebarProps } from './SettingsSidebar'

export { SettingsNavGroup } from './SettingsNavGroup'
export type { SettingsNavGroupProps } from './SettingsNavGroup'

export { SettingsNavItem } from './SettingsNavItem'
export type { SettingsNavItemProps } from './SettingsNavItem'

export { SettingsCardList } from './SettingsCardList'
export type { SettingsCardListProps } from './SettingsCardList'

export { SettingsCardRow } from './SettingsCardRow'
export type { SettingsCardRowProps } from './SettingsCardRow'

export { InterfaceModeCard } from './InterfaceModeCard'
export type { InterfaceModeCardProps } from './InterfaceModeCard'

export type {
  SettingsFooterSlot,
  SettingsNavBadge,
  SettingsNavGroupData,
  SettingsNavItemData,
  SettingsNavigateHandlers,
} from './types'
