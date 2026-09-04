export type LcColorMode = 'light' | 'dark' | 'system'

export const LC_MODE_STORAGE_KEY = 'wingcaster.lc-mode'
export const LC_MODE_ATTR = 'data-lc-mode'

export function isLcColorMode(value: string | null | undefined): value is LcColorMode {
  return value === 'light' || value === 'dark' || value === 'system'
}

export function readStoredLcMode(): LcColorMode {
  if (typeof window === 'undefined') return 'light'
  try {
    const stored = window.localStorage.getItem(LC_MODE_STORAGE_KEY)
    if (isLcColorMode(stored)) return stored
  } catch {
    /* private mode / blocked storage */
  }
  return 'light'
}

export function resolveLcMode(mode: LcColorMode): 'light' | 'dark' {
  if (mode === 'light' || mode === 'dark') return mode
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function applyLcMode(mode: LcColorMode) {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  if (mode === 'system') {
    root.removeAttribute(LC_MODE_ATTR)
  } else {
    root.setAttribute(LC_MODE_ATTR, mode)
  }
  const resolved = resolveLcMode(mode)
  root.style.colorScheme = resolved
  const themeMeta = document.querySelector('meta[name="theme-color"]') as HTMLMetaElement | null
  if (themeMeta) {
    const page = getComputedStyle(root).getPropertyValue('--lc-bg-page').trim()
    if (page) themeMeta.content = page
  }
}

export function persistLcMode(mode: LcColorMode) {
  try {
    window.localStorage.setItem(LC_MODE_STORAGE_KEY, mode)
  } catch {
    /* ignore */
  }
}
