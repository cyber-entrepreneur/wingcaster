/** Clipboard write with a hidden-input fallback for older WebViews. Never call on mount. */
export async function copyText(value: string): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(value)
      return true
    } catch {
      /* fall through */
    }
  }
  if (typeof document === 'undefined') return false
  try {
    const input = document.createElement('input')
    input.value = value
    input.setAttribute('readonly', '')
    input.style.position = 'fixed'
    input.style.opacity = '0'
    document.body.appendChild(input)
    input.select()
    input.setSelectionRange(0, value.length)
    const ok = document.execCommand('copy')
    document.body.removeChild(input)
    return ok
  } catch {
    return false
  }
}
