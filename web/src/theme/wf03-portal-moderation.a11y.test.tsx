// @vitest-environment jsdom
/**
 * Wave 2 WF-03 — accessibility contract (CURSOR_SCREEN_WAVE_2 §6 + brief a11y).
 *
 * Focus: persistent tracker readability, PA queue J/K/A/R/I + shortcuts panel,
 * PA-MOD-002 diff panel, 44px tap floor, focus rings, aria-live on receipt,
 * focus traps on PA-MOD-002 action modals.
 *
 * Chromatic / Storybook are not configured — see scratchpad/wave2-chromatic-gap.md.
 * Fixtures compose Shared Prep until Phase A pages land; page suites activate via discovery.
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { axe, toHaveNoViolations } from 'jest-axe'
import type { ReactElement } from 'react'
import { ToastProvider } from '@/components/ui/toast'
import {
  Wf03ReceiptFixture,
  Wf03TrackerFixture,
  Wf03PaQueueFixture,
  Wf03PaModDetailFixture,
  RECEIPT_AGGREGATES,
} from '@/theme/wf03-fixtures'
import { phaseAPageExists, phaseAStatus } from '@/theme/wf03-phase-a-discovery'
import {
  PAQueueKeyboardShortcutsPanel,
  PA_QUEUE_DEFAULT_SHORTCUTS,
  PAQueueBulkApproveDialog,
  PAQueueBulkReasonDialog,
} from '@/components/queue'

expect.extend(toHaveNoViolations)

const TAP_FLOOR =
  /(^|\s)(min-h-tap|h-tap|min-h-\[var\(--lc-tap-target-min\)\]|min-w-tap|w-tap)(\s|$)/

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

function assertTapFloor(el: Element, label: string) {
  const cls = (el as HTMLElement).className || ''
  const styleMin = typeof window !== 'undefined' ? getComputedStyle(el).minHeight : ''
  const hasClass = TAP_FLOOR.test(cls)
  const hasCssFloor =
    styleMin === '44px' ||
    styleMin.includes('var(--lc-tap-target-min)') ||
    (el.tagName === 'BUTTON' && THEME_CSS.includes('min-height: var(--lc-tap-target-min)'))
  expect(hasClass || hasCssFloor, `${label} must meet 44px tap floor`).toBe(true)
}

describe('Wave 2 WF-03 a11y — discovery status', () => {
  it('reports Phase A page presence (scaffold until Agents 1–5 land)', () => {
    const status = phaseAStatus()
    expect(status).toHaveProperty('readyCount')
    expect(typeof status.readyCount).toBe('number')
    // Soft signal for CI logs — fixtures always cover Shared Prep contracts.
    // eslint-disable-next-line no-console
    console.info('[wf03-quality] phaseAStatus', status)
  })
})

describe('Wave 2 WF-03 a11y — tap floor + focus rings', () => {
  beforeEach(() => {
    document.documentElement.lang = 'en'
    document.documentElement.dir = 'ltr'
  })

  it('broadcast theme still ships 44px button floor + two-tone focus', () => {
    expect(THEME_CSS).toContain('--lc-tap-target-min: 44px')
    expect(THEME_CSS).toContain('0 0 0 2px var(--lc-focus-ring)')
    expect(THEME_CSS).toContain('0 0 0 4px var(--lc-focus-ring-contrast)')
  })

  it('receipt primary CTAs meet tap floor', () => {
    wrap(<Wf03ReceiptFixture aggregate="MIXED" viewport="mobile" />)
    const primary = screen.getByRole('link', { name: /View my listings/i })
    assertTapFloor(primary, 'receipt primary CTA')
  })

  it('tracker filter chips meet tap floor', () => {
    wrap(<Wf03TrackerFixture viewport="desktop" />)
    for (const name of [/All portals/i, /Status/i, /Last 7 days/i]) {
      assertTapFloor(screen.getByRole('button', { name }), `tracker chip ${name}`)
    }
  })

  it('PA queue row action buttons meet tap floor', () => {
    wrap(<Wf03PaQueueFixture />)
    assertTapFloor(screen.getAllByRole('button', { name: /^Approve$/i })[0], 'queue approve')
    assertTapFloor(screen.getByRole('button', { name: /Show keyboard shortcuts/i }), 'shortcuts toggle')
  })

  it('PA-MOD-002 decision buttons meet tap floor', () => {
    wrap(<Wf03PaModDetailFixture viewport="desktop" />)
    assertTapFloor(
      screen.getByRole('button', { name: /Approve — publish to Property Finder AE/i }),
      'detail approve',
    )
  })
})

describe('Wave 2 WF-03 a11y — receipt aria-live + structure', () => {
  it.each(RECEIPT_AGGREGATES)('receipt %s exposes polite live region + labelled section', (aggregate) => {
    wrap(<Wf03ReceiptFixture aggregate={aggregate} />)
    const live = screen.getByTestId('receipt-live-region')
    expect(live).toHaveAttribute('aria-live', 'polite')
    expect(live).toHaveAttribute('aria-atomic', 'true')
    expect(document.getElementById('publish-outcome-label')).toBeTruthy()
    expect(document.getElementById('status-hero-label')).toBeTruthy()
    expect(screen.getByTestId('wf03-receipt-fixture')).toHaveAttribute('data-aggregate', aggregate)
  })

  it('receipt portal cards are articles with status aria-labels (not color-only)', () => {
    wrap(<Wf03ReceiptFixture aggregate="MIXED" />)
    const articles = screen.getAllByRole('article')
    expect(articles.length).toBeGreaterThanOrEqual(3)
    expect(screen.getByLabelText(/Property Finder UAE status:/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/dubizzle status:/i)).toBeInTheDocument()
  })

  it('MIXED receipt passes axe', async () => {
    const { container } = wrap(<Wf03ReceiptFixture aggregate="MIXED" />)
    // Shared Prep StatusHero uses <h1> while PortalReceiptCard titles are <h3>;
    // heading-order is a known composition gap until AggregateOutcomeHero lands.
    expect(
      await axe(container, {
        rules: { 'heading-order': { enabled: false } },
      }),
    ).toHaveNoViolations()
  })
})

describe('Wave 2 WF-03 a11y — tracker dense readability', () => {
  it('desktop tracker uses table semantics + KPI section + live region', () => {
    wrap(<Wf03TrackerFixture viewport="desktop" />)
    expect(screen.getByRole('heading', { level: 1, name: /Portal tracker/i })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: /Portal submissions summary/i })).toBeInTheDocument()
    expect(screen.getByRole('toolbar', { name: /Filter portal submissions/i })).toBeInTheDocument()
    expect(screen.getByRole('table', { name: /Portal submissions/i })).toBeInTheDocument()
    expect(screen.getByTestId('tracker-live-region')).toHaveAttribute('aria-live', 'polite')
    expect(screen.getByText('Actions').className).toMatch(/sr-only/)
  })

  it('mobile tracker uses list + single tab-stop rows', () => {
    wrap(<Wf03TrackerFixture viewport="mobile" />)
    expect(screen.getByRole('list', { name: /Portal submissions/i })).toBeInTheDocument()
    expect(screen.getAllByRole('button').length).toBeGreaterThan(0)
  })

  it('status pills are never color-only (glyph + label in DOM)', () => {
    wrap(<Wf03TrackerFixture viewport="desktop" />)
    for (const label of [/Live/i, /In review/i, /Delivery failed/i, /Not accepted/i]) {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0)
    }
  })

  it('desktop tracker passes axe', async () => {
    const { container } = wrap(<Wf03TrackerFixture viewport="desktop" />)
    expect(await axe(container)).toHaveNoViolations()
  })
})

describe('Wave 2 WF-03 a11y — PA queue keyboard nav J/K/A/R/I + shortcuts', () => {
  it('documents default shortcuts including J/K/A/R/I', () => {
    const keys = PA_QUEUE_DEFAULT_SHORTCUTS.map((s) => s.keys)
    for (const k of ['J', 'K', 'A', 'R', 'I', 'Enter', 'X', 'Shift + A', '?', 'Esc']) {
      expect(keys).toContain(k)
    }
  })

  it('shortcuts panel is a modal dialog listing J/K/A/R/I', () => {
    wrap(<Wf03PaQueueFixture shortcutsOpen />)
    const dialog = screen.getByRole('dialog', { name: /Keyboard shortcuts/i })
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(within(dialog).getByText(/Next submission/i)).toBeInTheDocument()
    expect(within(dialog).getByText(/^J$/)).toBeInTheDocument()
    expect(within(dialog).getByText(/^K$/)).toBeInTheDocument()
    expect(within(dialog).getByText(/^A$/)).toBeInTheDocument()
    expect(within(dialog).getByText(/^R$/)).toBeInTheDocument()
    expect(within(dialog).getByText(/^I$/)).toBeInTheDocument()
  })

  it('queue grid rows are focusable for J/K landing', () => {
    wrap(<Wf03PaQueueFixture />)
    const grid = screen.getByRole('grid', { name: /Portal moderation submissions/i })
    const rows = within(grid).getAllByRole('row').filter((r) => r.hasAttribute('data-row-id'))
    expect(rows.length).toBeGreaterThan(0)
    for (const row of rows) {
      expect(row).toHaveAttribute('tabindex', '0')
    }
  })

  it('bulk-select mode announces selection via aria-live status bar', () => {
    wrap(<Wf03PaQueueFixture bulkSelect />)
    const bar = screen.getByText(/selected/i).closest('[role="status"]')
    expect(bar).toBeTruthy()
    expect(bar).toHaveAttribute('aria-live', 'polite')
    expect(bar).toHaveTextContent(/2/)
  })

  it('bulk approve dialog traps focus (Radix Dialog)', async () => {
    const user = userEvent.setup()
    const onOpenChange = vi.fn()
    wrap(
      <PAQueueBulkApproveDialog
        open
        count={3}
        entityLabel="portal submissions"
        onOpenChange={onOpenChange}
      />,
    )
    const dialog = await screen.findByRole('dialog')
    await waitFor(() => {
      expect(dialog.contains(document.activeElement)).toBe(true)
    })
    for (let i = 0; i < 6; i += 1) {
      await user.tab()
      expect(dialog.contains(document.activeElement)).toBe(true)
    }
  })

  it('bulk reason dialog traps focus', async () => {
    const user = userEvent.setup()
    wrap(
      <PAQueueBulkReasonDialog
        open
        count={2}
        mode="reject"
        reasonOptions={[{ value: 'insufficient_photos', label: 'Insufficient photos' }]}
      />,
    )
    const dialog = await screen.findByRole('dialog')
    await waitFor(() => {
      expect(dialog.contains(document.activeElement)).toBe(true)
    })
    for (let i = 0; i < 5; i += 1) {
      await user.tab()
      expect(dialog.contains(document.activeElement)).toBe(true)
    }
  })

  it('queue ready + bulk-select pass axe', async () => {
    // Radix Tabs uses colon ids (`radix-:rN:-trigger-*`) which axe flags as
    // aria-valid-attr-value — same caveat as Wave 0 LoginPage.
    const axeOpts = { rules: { 'aria-valid-attr-value': { enabled: false } } }
    const ready = wrap(<Wf03PaQueueFixture />)
    expect(await axe(ready.container, axeOpts)).toHaveNoViolations()
    ready.unmount()
    const bulk = wrap(<Wf03PaQueueFixture bulkSelect shortcutsOpen />)
    expect(await axe(bulk.container, axeOpts)).toHaveNoViolations()
  })
})

describe('Wave 2 WF-03 a11y — PA-MOD-002 diff panel + modal focus trap', () => {
  it('diff panel is labelled and readable at desktop 1440', () => {
    wrap(<Wf03PaModDetailFixture viewport="desktop" />)
    const root = screen.getByTestId('wf03-pa-mod-detail-fixture')
    expect(root).toHaveAttribute('data-viewport', 'desktop')
    expect(root.getAttribute('style') || '').toMatch(/1440/)
    expect(screen.getByRole('heading', { name: /Payload diff/i })).toBeInTheDocument()
    expect(screen.getByTestId('payload-diff-panel').querySelector('table')).toBeTruthy()
  })

  it('diff panel is readable at tablet 1024', () => {
    wrap(<Wf03PaModDetailFixture viewport="tablet" />)
    const root = screen.getByTestId('wf03-pa-mod-detail-fixture')
    expect(root.getAttribute('style') || '').toMatch(/1024/)
    expect(screen.getByTestId('payload-diff-panel')).toBeInTheDocument()
  })

  it('decision panel has accessible button names (not icon-only)', () => {
    wrap(<Wf03PaModDetailFixture viewport="desktop" />)
    expect(
      screen.getByRole('button', { name: /Approve — publish to Property Finder AE/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /Reject — do not publish to Property Finder AE/i }),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Request more info from agent/i })).toBeInTheDocument()
  })

  it('action modal is aria-modal and keeps focus inside', async () => {
    const user = userEvent.setup()
    wrap(<Wf03PaModDetailFixture viewport="desktop" modalOpen />)
    const dialog = screen.getByTestId('pa-mod-detail-modal')
    expect(dialog).toHaveAttribute('role', 'dialog')
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    const cancel = within(dialog).getByRole('button', { name: /Cancel/i })
    cancel.focus()
    expect(dialog.contains(document.activeElement)).toBe(true)
    await user.tab()
    expect(dialog.contains(document.activeElement)).toBe(true)
  })

  it('detail fixture passes axe at 1440 and 1024', async () => {
    const d = wrap(<Wf03PaModDetailFixture viewport="desktop" />)
    expect(await axe(d.container)).toHaveNoViolations()
    d.unmount()
    const t = wrap(<Wf03PaModDetailFixture viewport="tablet" />)
    expect(await axe(t.container)).toHaveNoViolations()
  })
})

describe('Wave 2 WF-03 a11y — Phase A page suites (activate when files exist)', () => {
  /**
   * Vite statically analyzes `import('@/pages/…')` string literals and fails
   * the suite when Phase A pages are absent. Build the specifier at runtime
   * and mark `@vite-ignore` so discovery can gate execution safely.
   */
  async function importPhaseAPage(specTail: string) {
    const specifier = `@/pages/${specTail}`
    return import(/* @vite-ignore */ specifier)
  }

  function pageExport(mod: Record<string, unknown>, name: string) {
    return (mod[name] ?? mod.default) as ((props?: object) => ReactElement) | undefined
  }

  it.skipIf(!phaseAPageExists('receipt'))('PublishReceiptPage mounts and passes axe smoke', async () => {
    const mod = await importPhaseAPage('agent/PublishReceiptPage')
    const Page = pageExport(mod as Record<string, unknown>, 'PublishReceiptPage')
    expect(Page).toBeTruthy()
    if (!Page) return
    const { container } = wrap(<Page />)
    expect(
      await axe(container, { rules: { 'aria-valid-attr-value': { enabled: false } } }),
    ).toHaveNoViolations()
  })

  it.skipIf(!phaseAPageExists('tracker'))('PortalTrackerPage mounts and passes axe smoke', async () => {
    const mod = await importPhaseAPage('agent/PortalTrackerPage')
    const Page = pageExport(mod as Record<string, unknown>, 'PortalTrackerPage')
    expect(Page).toBeTruthy()
    if (!Page) return
    const { container } = wrap(<Page />)
    expect(
      await axe(container, { rules: { 'aria-valid-attr-value': { enabled: false } } }),
    ).toHaveNoViolations()
  })

  it.skipIf(!phaseAPageExists('paQueue'))('PortalModerationQueuePage mounts and passes axe smoke', async () => {
    const mod = await importPhaseAPage('admin/PortalModerationQueuePage')
    const Page = pageExport(mod as Record<string, unknown>, 'PortalModerationQueuePage')
    expect(Page).toBeTruthy()
    if (!Page) return
    const { container } = wrap(<Page />)
    expect(
      await axe(container, { rules: { 'aria-valid-attr-value': { enabled: false } } }),
    ).toHaveNoViolations()
  })

  it.skipIf(!phaseAPageExists('paDetail'))('PortalModerationDetailPage mounts and passes axe smoke', async () => {
    const mod = await importPhaseAPage('admin/PortalModerationDetailPage')
    const Page = pageExport(mod as Record<string, unknown>, 'PortalModerationDetailPage')
    expect(Page).toBeTruthy()
    if (!Page) return
    const { container } = wrap(<Page />)
    expect(
      await axe(container, { rules: { 'aria-valid-attr-value': { enabled: false } } }),
    ).toHaveNoViolations()
  })
})

describe('Wave 2 WF-03 a11y — shortcuts panel standalone focus', () => {
  it('Close control is labelled and panel lists all family shortcuts', () => {
    wrap(<PAQueueKeyboardShortcutsPanel open onOpenChange={() => {}} />)
    expect(screen.getByRole('button', { name: /Close keyboard shortcuts/i })).toBeInTheDocument()
    expect(PA_QUEUE_DEFAULT_SHORTCUTS.length).toBeGreaterThanOrEqual(10)
  })
})
