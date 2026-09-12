import { createContext, useContext } from 'react'
import { longestMatchingSettingsRoute } from '@/lib/settings-search'

const SettingsItemRoutesContext = createContext<string[]>([])

export const SettingsItemRoutesProvider = SettingsItemRoutesContext.Provider

export function useSettingsItemRoutes(): string[] {
  return useContext(SettingsItemRoutesContext)
}

export function isSettingsNavActive(pathname: string, route: string, allRoutes: string[]): boolean {
  if (allRoutes.length === 0) {
    return pathname === route || pathname.startsWith(`${route}/`)
  }
  return longestMatchingSettingsRoute(pathname, allRoutes) === route
}
