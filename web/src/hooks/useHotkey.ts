import { useEffect } from 'react'

type HotkeyHandler = (event: KeyboardEvent) => void

/**
 * Registers a keyboard shortcut. Use `mod+k` for Cmd+K (macOS) / Ctrl+K (Win/Linux).
 * Does not fire when the event target is an editable field unless `allowInInputs` is true.
 */
export function useHotkey(
  combo: string,
  handler: HotkeyHandler,
  options?: { enabled?: boolean; allowInInputs?: boolean },
) {
  const enabled = options?.enabled ?? true
  const allowInInputs = options?.allowInInputs ?? false

  useEffect(() => {
    if (!enabled) return

    const parts = combo
      .toLowerCase()
      .split('+')
      .map((p) => p.trim())
      .filter(Boolean)
    const key = parts.find((p) => p !== 'mod' && p !== 'ctrl' && p !== 'meta' && p !== 'alt' && p !== 'shift')
    if (!key) return

    const wantMod = parts.includes('mod')
    const wantCtrl = parts.includes('ctrl') || wantMod
    const wantMeta = parts.includes('meta') || wantMod
    const wantAlt = parts.includes('alt')
    const wantShift = parts.includes('shift')

    const onKeyDown = (event: KeyboardEvent) => {
      if (!allowInInputs) {
        const target = event.target as HTMLElement | null
        const tag = target?.tagName
        if (
          tag === 'INPUT' ||
          tag === 'TEXTAREA' ||
          tag === 'SELECT' ||
          target?.isContentEditable
        ) {
          // Still allow mod+k from inputs — GlobalSearch should open from anywhere.
          if (!(wantMod && key === 'k')) return
        }
      }

      const pressed = event.key.toLowerCase()
      if (pressed !== key) return

      if (wantAlt && !event.altKey) return
      if (wantShift && !event.shiftKey) return

      if (wantMod) {
        if (!(event.metaKey || event.ctrlKey)) return
      } else {
        if (wantCtrl && !event.ctrlKey) return
        if (wantMeta && !event.metaKey) return
      }

      event.preventDefault()
      handler(event)
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [combo, handler, enabled, allowInInputs])
}
