/**
 * Visual-snapshot helpers — stamp resolved broadcast tokens into the DOM so
 * light/dark snapshots differ by actual color values, not just a `<!-- mode=… -->`
 * comment or `data-lc-mode` attribute outside the serialized tree.
 *
 * Ported from Wave 4A PR 118. jsdom's getComputedStyle often stays on the :root
 * light palette even after `applyLcMode('dark')`; when that happens we parse
 * `broadcast-theme.css` so `data-lc-tokens` still carries the dark hexes.
 */
import type { LcColorMode } from '@/theme/mode'

/** Color / surface tokens that flip between light and dark palettes. */
export const LC_SNAPSHOT_TOKENS = [
  '--lc-bg-page',
  '--lc-surface',
  '--lc-surface-raised',
  '--lc-surface-sunken',
  '--lc-surface-inverse',
  '--lc-border',
  '--lc-border-strong',
  '--lc-text-primary',
  '--lc-text-secondary',
  '--lc-text-heading',
  '--lc-text-muted',
  '--lc-text-inverse',
  '--lc-text-brand',
  '--lc-action-primary',
  '--lc-action-primary-text',
  '--lc-action-secondary',
  '--lc-action-secondary-text',
  '--lc-focus-ring',
] as const

export type ViewportAxis = 'mobile' | 'desktop'

export function setVisualViewport(axis: ViewportAxis): void {
  const width = axis === 'mobile' ? 375 : 1280
  const mobile = axis === 'mobile'
  Object.defineProperty(window, 'innerWidth', {
    writable: true,
    configurable: true,
    value: width,
  })
  Object.defineProperty(window, 'innerHeight', {
    writable: true,
    configurable: true,
    value: axis === 'mobile' ? 812 : 800,
  })
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: (query: string) => {
      let matches = false
      if (query.includes('prefers-reduced-motion')) matches = false
      else if (query.includes('prefers-color-scheme: dark')) matches = false
      else if (query.includes('max-width: 767px')) matches = mobile
      else if (query.includes('(max-width: 767px)')) matches = mobile
      else if (query.includes('min-width: 768px')) matches = !mobile
      else if (query.includes('min-width: 1024px')) matches = !mobile
      else if (query.includes('min-width: 1280px')) matches = !mobile
      return {
        matches,
        media: query,
        onchange: null,
        addListener: viNoop,
        removeListener: viNoop,
        addEventListener: viNoop,
        removeEventListener: viNoop,
        dispatchEvent: () => false,
      }
    },
  })
}

function viNoop() {
  /* matchMedia listener stub */
}

/** Read resolved `--lc-*` values for the active document mode. */
export function resolveLcSnapshotTokens(el: Element = document.documentElement): Record<string, string> {
  const style = getComputedStyle(el)
  const out: Record<string, string> = {}
  for (const token of LC_SNAPSHOT_TOKENS) {
    const value = style.getPropertyValue(token).trim()
    if (value) out[token] = value
  }
  return out
}

const TOKEN_DECL = (token: string) => new RegExp(`${token.replace(/-/g, '\\-')}:\\s*([^;]+);`)

/**
 * Parse light (`:root`) / dark (`[data-lc-mode="dark"]`) token blocks from the
 * injected broadcast stylesheet. Source of truth when jsdom computed style lies.
 */
export function parseLcSnapshotTokensFromCss(css: string, mode: 'light' | 'dark'): Record<string, string> {
  // Match the selector + opening brace so a prose mention of `[data-lc-mode="dark"]`
  // in the file header cannot steal the first `{` (which would be `:root`).
  const re = mode === 'dark' ? /\[data-lc-mode="dark"\]\s*\{/ : /^:root\s*\{/m
  const hit = re.exec(css)
  if (!hit || hit.index == null) return {}
  const brace = hit.index + hit[0].length - 1
  const end = css.indexOf('}', brace)
  if (end < 0) return {}
  const block = css.slice(brace + 1, end)
  const out: Record<string, string> = {}
  for (const token of LC_SNAPSHOT_TOKENS) {
    const m = block.match(TOKEN_DECL(token))
    if (m) out[token] = m[1].trim()
  }
  return out
}

function broadcastThemeCssText(): string {
  return document.getElementById('broadcast-theme-css')?.textContent ?? ''
}

/**
 * Stamp resolved palette onto a wrapper so `innerHTML` serialization captures
 * real color values (jsdom class strings stay `var(--lc-*)` either way).
 */
export function stampLcTokens(el: HTMLElement, mode: 'light' | 'dark' | LcColorMode): void {
  const resolved = mode === 'system' ? 'light' : mode
  const computed = resolveLcSnapshotTokens(document.documentElement)
  const fromCss = parseLcSnapshotTokensFromCss(broadcastThemeCssText(), resolved)
  // Stylesheet palette wins so dark snapshots cannot silently reuse light hexes
  // when jsdom getComputedStyle stays on :root.
  const tokens = Object.keys(fromCss).length > 0 ? { ...computed, ...fromCss } : computed
  el.setAttribute('data-lc-mode', resolved)
  el.setAttribute('data-lc-tokens', JSON.stringify(tokens))
  for (const [name, value] of Object.entries(tokens)) {
    el.style.setProperty(name, value)
  }
}

/** Email / E.164-ish bleed sweep — mirrors Wave 5 visual PII posture. */
export const PII_BLEED_RE =
  /(?:[a-z0-9._%+-]+@[^\s"'<>]+\.[a-z]{2,})|(?:\+\d{2,3}\s?\d[\d\s-]{6,})/gi

export function assertNoPiiBleed(serialized: string): void {
  const hits = serialized.match(PII_BLEED_RE)
  if (!hits || hits.length === 0) return
  const real = hits.filter((h) => {
    if (/XXX/i.test(h)) return false
    if (/@example\.test\b/i.test(h)) return false
    if (/example\.test\//i.test(h)) return false
    return true
  })
  if (real.length > 0) {
    throw new Error(`PII bleed in visual snapshot: ${real.slice(0, 5).join(', ')}`)
  }
}

export function serializeVisualRoot(root: HTMLElement, opts?: { mode?: string }): string {
  const clone = root.cloneNode(true) as HTMLElement
  clone.querySelectorAll('[id]').forEach((el) => {
    const id = el.getAttribute('id') || ''
    if (id.startsWith('radix-') || id.includes(':') || /^r\d/.test(id)) {
      el.setAttribute('id', '__stable__')
    }
  })
  clone.querySelectorAll('[aria-controls], [aria-labelledby], [aria-describedby], for').forEach((el) => {
    for (const attr of ['aria-controls', 'aria-labelledby', 'aria-describedby', 'for'] as const) {
      if (el.hasAttribute(attr)) {
        const val = el.getAttribute(attr) || ''
        if (val.startsWith('radix-') || val.includes(':')) {
          el.setAttribute(attr, '__stable__')
        }
      }
    }
  })
  clone.querySelectorAll('[data-handshake-live]').forEach((el) => {
    el.textContent = 'Expires in __ minutes'
  })
  const portals = [
    ...document.body.querySelectorAll('[data-radix-portal], [role="dialog"], [role="alertdialog"]'),
  ]
    .map((node) => {
      const c = node.cloneNode(true) as HTMLElement
      c.querySelectorAll('[id]').forEach((el) => {
        const id = el.getAttribute('id') || ''
        if (id.startsWith('radix-') || id.includes(':')) el.setAttribute('id', '__stable__')
      })
      return c.outerHTML
    })
    .join('\n')
  const mode =
    opts?.mode ||
    root.getAttribute('data-lc-mode') ||
    document.documentElement.getAttribute('data-lc-mode') ||
    'light'
  const dir = document.documentElement.dir || 'ltr'
  const lang = document.documentElement.lang || 'en'
  const vw = typeof window !== 'undefined' ? window.innerWidth : 0
  const tokensAttr = root.getAttribute('data-lc-tokens') || ''
  return `<!-- mode=${mode} dir=${dir} lang=${lang} vw=${vw} -->\n<!-- lc-tokens=${tokensAttr} -->\n${clone.outerHTML}\n<!-- portals -->\n${portals}`
}

