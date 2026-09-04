export type LcColorMode = 'light' | 'dark' | 'system'

export const LC_BRAND_STORAGE_KEY = 'wingcaster.brand'
export const LC_MODE_ATTR = 'data-lc-mode'

export function isLcColorMode(value: unknown): value is LcColorMode {
  return value === 'light' || value === 'dark' || value === 'system'
}

export function readStoredLcMode(): LcColorMode {
  if (typeof window === 'undefined') return 'system'
  try {
    const raw = window.localStorage.getItem(LC_BRAND_STORAGE_KEY)
    if (!raw) return 'system'
    const parsed = JSON.parse(raw) as { mode?: unknown }
    if (isLcColorMode(parsed?.mode)) return parsed.mode
  } catch {
    /* private mode / blocked storage / malformed JSON */
  }
  return 'system'
}

export function resolveLcMode(mode: LcColorMode): 'light' | 'dark' {
  if (mode === 'light' || mode === 'dark') return mode
  if (typeof window === 'undefined') return 'light'
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
  if (typeof window === 'undefined') return
  try {
    const raw = window.localStorage.getItem(LC_BRAND_STORAGE_KEY)
    const parsed = raw ? (JSON.parse(raw) as Record<string, unknown>) : {}
    window.localStorage.setItem(LC_BRAND_STORAGE_KEY, JSON.stringify({ ...parsed, mode }))
  } catch {
    /* ignore */
  }
}
