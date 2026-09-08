// @vitest-environment jsdom
/**
 * Wave 2 WF-03 — visual / DOM snapshot matrix (~20 Chromatic stand-ins).
 *
 * Chromatic / Storybook are not configured in this repo. These Vitest
 * snapshots stand in for the §6 visual budget across LTR/RTL × light/dark ×
 * mobile/tablet/desktop, including 8 receipt state variants + PA queue
 * bulk-select mode. See scratchpad/wave2-chromatic-gap.md.
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import type { ReactElement } from 'react'
import { applyLcMode } from '@/theme/mode'
import { ToastProvider } from '@/components/ui/toast'
import {
  Wf03ReceiptFixture,
  Wf03TrackerFixture,
  Wf03PaQueueFixture,
  Wf03PaModDetailFixture,
  type ReceiptAggregate,
} from '@/theme/wf03-fixtures'

const THEME_CSS = readFileSync(
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../docs/design-tokens/broadcast-theme.css'),
  'utf8',
)

beforeAll(() => {
  class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  vi.stubGlobal('ResizeObserver', ResizeObserverStub)
  Element.prototype.scrollIntoView = vi.fn()

  if (!document.getElementById('broadcast-theme-css')) {
    const style = document.createElement('style')
    style.id = 'broadcast-theme-css'
    style.textContent = THEME_CSS
    document.head.appendChild(style)
  }
})

function wrap(ui: ReactElement) {
  return render(
    <MemoryRouter>
      <ToastProvider>{ui}</ToastProvider>
    </MemoryRouter>,
  )
}

/** Stabilize DOM for snapshots (ids, portals). */
function serialize(root: HTMLElement): string {
  const clone = root.cloneNode(true) as HTMLElement
  clone.querySelectorAll('[id]').forEach((el) => {
    const id = el.getAttribute('id') || ''
    if (id.startsWith('radix-') || id.includes(':') || /^r\d/.test(id) || id.includes('portal-card-')) {
      el.setAttribute('id', '__stable__')
    }
  })
  clone.querySelectorAll('[aria-controls], [aria-labelledby], [aria-describedby], for').forEach((el) => {
    for (const attr of ['aria-controls', 'aria-labelledby', 'aria-describedby', 'for'] as const) {
      if (el.hasAttribute(attr)) {
        const val = el.getAttribute(attr) || ''
        if (val.startsWith('radix-') || val.includes(':') || val.includes('portal-card-')) {
          el.setAttribute(attr, '__stable__')
        }
      }
    }
  })
  const portals = [...document.body.querySelectorAll('[data-radix-portal], [role="dialog"], [role="alertdialog"]')]
    .map((node) => {
      const c = node.cloneNode(true) as HTMLElement
      c.querySelectorAll('[id]').forEach((el) => {
        const id = el.getAttribute('id') || ''
        if (id.startsWith('radix-') || id.includes(':')) el.setAttribute('id', '__stable__')
      })
      return c.outerHTML
    })
    .join('\n')
  const mode = document.documentElement.getAttribute('data-lc-mode') || 'light'
  const dir = document.documentElement.dir || 'ltr'
  const lang = document.documentElement.lang || 'en'
  return `<!-- mode=${mode} dir=${dir} lang=${lang} -->\n${clone.innerHTML}\n<!-- portals -->\n${portals}`
}

type Dir = 'ltr' | 'rtl'
type Mode = 'light' | 'dark'
type Viewport = 'mobile' | 'tablet' | 'desktop'

type Fixture = {
  id: string
  render: () => ReactElement
}

/**
 * ~20 Chromatic stand-in snapshots:
 * - 8 receipt aggregates (light/ltr/mobile)
 * - receipt MIXED dark/rtl + ALL_SUCCEEDED desktop
 * - tracker dense desktop/tablet + dark/rtl
 * - PA queue pending + bulk-select (+ dark/rtl) + shortcuts
 * - PA-MOD-002 diff @ 1440 + 1024 (+ dark/rtl)
 */
const FIXTURES: Fixture[] = [
  // 1–8 receipt state variants
  ...([
    'ALL_SUCCEEDED',
    'MIXED',
    'ALL_FAILED',
    'IN_REVIEW_ONLY',
    'PARTIAL',
    'CROSS_COUNTRY',
    'RETRY_IN_FLIGHT',
    'OFFLINE',
  ] as ReceiptAggregate[]).map((aggregate) => ({
    id: `receipt-${aggregate}-mobile-light-ltr`,
    render: () => <Wf03ReceiptFixture aggregate={aggregate} viewport="mobile" />,
  })),
  // 9–10 receipt cross mode/dir/viewport
  {
    id: 'receipt-MIXED-mobile-dark-rtl',
    render: () => <Wf03ReceiptFixture aggregate="MIXED" viewport="mobile" />,
  },
  {
    id: 'receipt-ALL_SUCCEEDED-desktop-light-ltr',
    render: () => <Wf03ReceiptFixture aggregate="ALL_SUCCEEDED" viewport="desktop" />,
  },
  // 11–13 tracker dense
  {
    id: 'tracker-dense-desktop-light-ltr',
    render: () => <Wf03TrackerFixture viewport="desktop" />,
  },
  {
    id: 'tracker-dense-tablet-light-ltr',
    render: () => <Wf03TrackerFixture viewport="tablet" />,
  },
  {
    id: 'tracker-dense-desktop-dark-rtl',
    render: () => <Wf03TrackerFixture viewport="desktop" />,
  },
  // 14–17 PA queue
  {
    id: 'pa-queue-pending-desktop-light-ltr',
    render: () => <Wf03PaQueueFixture viewport="desktop" env="live" />,
  },
  {
    id: 'pa-queue-bulk-select-desktop-light-ltr',
    render: () => <Wf03PaQueueFixture viewport="desktop" bulkSelect env="live" />,
  },
  {
    id: 'pa-queue-bulk-select-desktop-dark-rtl',
    render: () => <Wf03PaQueueFixture viewport="desktop" bulkSelect env="test" />,
  },
  {
    id: 'pa-queue-shortcuts-desktop-light-ltr',
    render: () => <Wf03PaQueueFixture viewport="desktop" shortcutsOpen />,
  },
  // 18–20 PA-MOD-002 diff panel
  {
    id: 'pa-mod-detail-diff-desktop-1440-light-ltr',
    render: () => <Wf03PaModDetailFixture viewport="desktop" />,
  },
  {
    id: 'pa-mod-detail-diff-tablet-1024-light-ltr',
    render: () => <Wf03PaModDetailFixture viewport="tablet" />,
  },
  {
    id: 'pa-mod-detail-diff-desktop-1440-dark-rtl',
    render: () => <Wf03PaModDetailFixture viewport="desktop" />,
  },
]

// Explicit budget: 21 fixtures (8 receipt + extras ≥ ~20 Chromatic target)
expect(FIXTURES.length).toBeGreaterThanOrEqual(20)

function themeFromId(id: string): { mode: Mode; dir: Dir } {
  const mode: Mode = id.includes('-dark-') ? 'dark' : 'light'
  const dir: Dir = id.includes('-rtl') ? 'rtl' : 'ltr'
  return { mode, dir }
}

describe('Wave 2 WF-03 visual matrix — Chromatic stand-ins', () => {
  beforeEach(() => {
    document.documentElement.lang = 'en'
    document.documentElement.dir = 'ltr'
    applyLcMode('light')
    document.body.querySelectorAll('[data-radix-portal]').forEach((n) => n.remove())
  })

  for (const fixture of FIXTURES) {
    it(fixture.id, () => {
      const { mode, dir } = themeFromId(fixture.id)
      applyLcMode(mode)
      document.documentElement.dir = dir
      document.documentElement.lang = dir === 'rtl' ? 'ar' : 'en'
      const view = wrap(fixture.render())
      expect(serialize(view.container)).toMatchSnapshot()
      view.unmount()
    })
  }
})

describe('Wave 2 WF-03 visual — viewport attribute smoke', () => {
  it('receipt mobile vs desktop widths differ in fixture attrs', () => {
    applyLcMode('light')
    const mobile = wrap(<Wf03ReceiptFixture aggregate="MIXED" viewport="mobile" />)
    expect(mobile.getByTestId('wf03-receipt-fixture')).toHaveAttribute('data-viewport', 'mobile')
    expect(serialize(mobile.container)).toMatchSnapshot()
    mobile.unmount()
    const desktop = wrap(<Wf03ReceiptFixture aggregate="MIXED" viewport="desktop" />)
    expect(desktop.getByTestId('wf03-receipt-fixture')).toHaveAttribute('data-viewport', 'desktop')
    expect(serialize(desktop.container)).toMatchSnapshot()
  })

  it('PA queue bulk-select marker present for Chromatic checklist', () => {
    applyLcMode('light')
    const view = wrap(<Wf03PaQueueFixture bulkSelect />)
    expect(view.getByTestId('wf03-pa-queue-fixture')).toHaveAttribute('data-bulk', 'true')
    expect(serialize(view.container)).toMatchSnapshot()
  })
})

/** Exhaustive matrix helper — documents LTR/RTL × light/dark × viewport coverage intent. */
export const WF03_VIEWPORT_MATRIX: Viewport[] = ['mobile', 'tablet', 'desktop']
export const WF03_DIR_MATRIX: Dir[] = ['ltr', 'rtl']
export const WF03_MODE_MATRIX: Mode[] = ['light', 'dark']
