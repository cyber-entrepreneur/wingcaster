export function readLcColor(token: `--lc-${string}`): string {
  if (typeof document === 'undefined') return `var(${token})`
  return getComputedStyle(document.documentElement).getPropertyValue(token).trim() || `var(${token})`
}
