/**
 * PA-queue-family invariant harness.
 *
 * Codifies the 7 invariants captured in project memory `project_pa_queue_family.md`
 * (PA-MOD-001 anchor + downstream PA approval-queue screens). Consumers assert
 * against any PA queue page render — PA-MOD-001, PA-PVA-008, PA-PVA-009, PA-ACR-001,
 * PA-PKG-003 (Wave 6), PA-POR-001 (Wave 6), and any future PA queue.
 *
 * ## Structural, not marker-only
 *
 * The harness accepts MULTIPLE acceptable signals per invariant so existing
 * queues that predate this harness pass without needing `data-*` markers
 * retro-added to every page. Primitives on main (as of PR 187 + this fix)
 * do stamp markers (`data-pa-queue-filter-strip`, `data-pa-queue-table`,
 * `data-pa-queue-env-badge`) — new consumers get the check for free by
 * importing the primitives. Consumers that render inline still pass if
 * fallback signals are present.
 *
 * @example
 *   const { container } = render(<PackageApprovalQueuePage />)
 *   assertPaQueueFamilyInvariants(container, {
 *     hasBulk: false,   // WF-20 deliberate omit (see brief)
 *     hasTypeToConfirm: false, // WF-20 not high_value tier
 *     briefRef: 'PA-PKG-003',
 *   })
 */
import { expect } from 'vitest'

export interface PaQueueFamilyInvariantsOptions {
  /** True unless the brief explicitly omits bulk (WF-04, WF-05, WF-20 do — cite briefRef). */
  hasBulk: boolean
  /** True only when the queue includes a `high_value` tier row. Never over-apply. */
  hasTypeToConfirm: boolean
  /** Human-readable brief citation (e.g. "PA-PKG-003"), shown in failure messages. */
  briefRef: string
  /** Optional label attached to invariant failures (defaults to briefRef). */
  label?: string
}

function hasAny(container: HTMLElement, selectors: string[]): boolean {
  return selectors.some((sel) => container.querySelector(sel) !== null)
}

/**
 * Assert all 7 PA-queue-family invariants on a rendered container.
 *
 * Invariants (from project memory):
 *   1. StatusHero + count subtitle (or `<h1>` + text-with-digits fallback)
 *   2. Filter chips row (PAQueueFilterStrip primitive or role=tablist fallback)
 *   3. Empty-state hero declared (element or template)
 *   4. Keyboard nav + `?` shortcuts panel (primitive or `aria-label` shortcut trigger)
 *   5. Row density (PAQueueTable primitive or a `<table>` / `role=grid`)
 *   6. Bulk mode present OR deliberate omit with brief citation
 *   7. Type-to-confirm ONLY on `high_value` tier — never over-apply
 */
export function assertPaQueueFamilyInvariants(
  container: HTMLElement,
  options: PaQueueFamilyInvariantsOptions,
): void {
  const label = options.label ?? options.briefRef

  // 1. StatusHero + count subtitle
  const heroPrimitive = container.querySelector('[data-status-hero], [data-testid="pa-queue-hero"]')
  const heroFallback = container.querySelector('h1')
  const hero = heroPrimitive || heroFallback
  expect(hero, `[${label}] invariant 1: hero (StatusHero or <h1>) must be present`).toBeTruthy()

  // Subtitle can live inside the hero (StatusHero pattern) OR as a following <p> (h1 pattern).
  const subtitleFromPrimitive = hero?.querySelector(
    '[data-status-hero-subtitle], [data-testid="pa-queue-count-subtitle"]',
  )
  const heroNextSibling = hero?.nextElementSibling as HTMLElement | null
  const subtitleFallback = hero?.parentElement?.querySelector('p')
  const subtitle = subtitleFromPrimitive || heroNextSibling || subtitleFallback
  const subtitleText = subtitle?.textContent ?? ''
  // Count digit — Western or Arabic-Indic.
  const hasDigit = /[\d٠-٩۰-۹]/.test(subtitleText)
  expect(
    hasDigit,
    `[${label}] invariant 1: hero subtitle must include a count digit (subtitleText="${subtitleText.slice(0, 80)}")`,
  ).toBe(true)

  // 2. Filter chips row
  expect(
    hasAny(container, [
      '[data-pa-queue-filter-strip]',
      '[data-testid="pa-queue-filter-strip"]',
      '[role="tablist"]',
      '[role="group"][aria-label*="filter" i]',
    ]),
    `[${label}] invariant 2: PAQueueFilterStrip (or role=tablist / filter group) must be rendered`,
  ).toBe(true)

  // 3. Empty-state hero declared (rendered or as template).
  expect(
    hasAny(container, [
      '[data-pa-queue-empty-hero]',
      '[data-testid="pa-queue-empty-hero"]',
      '[data-pa-queue-empty-template]',
      '[role="status"][aria-label*="empty" i]',
    ]),
    `[${label}] invariant 3: empty-state hero must be declared (rendered or as template)`,
  ).toBe(true)

  // 4. Keyboard nav + `?` shortcuts panel
  const shortcutsSignals = [
    '[data-pa-queue-shortcuts-panel]',
    '[data-testid="pa-queue-shortcuts-panel"]',
    '[data-testid="pa-queue-shortcuts-trigger"]',
    '[aria-label*="shortcut" i]',
    '[aria-label*="اختصار" i]',
    '[aria-keyshortcuts]',
  ]
  expect(
    hasAny(container, shortcutsSignals),
    `[${label}] invariant 4: shortcuts panel or trigger (aria-label / aria-keyshortcuts) must be present`,
  ).toBe(true)

  // 5. Row density — PAQueueTable primitive or a real table.
  expect(
    hasAny(container, [
      '[data-pa-queue-table]',
      '[data-testid="pa-queue-table"]',
      'table',
      '[role="grid"]',
    ]),
    `[${label}] invariant 5: PAQueueTable / <table> / role=grid must be used`,
  ).toBe(true)

  // 6. Bulk mode: present when hasBulk, absent (with citation) when omitted.
  const bulkPresent = hasAny(container, [
    '[data-pa-queue-bulk-actions]',
    '[data-testid="pa-queue-bulk-bar"]',
    'input[type="checkbox"][aria-label*="select all" i]',
  ])
  if (options.hasBulk) {
    expect(
      bulkPresent,
      `[${label}] invariant 6: bulk mode enabled — bulk bar / select-all checkbox must be rendered`,
    ).toBe(true)
  } else {
    expect(
      bulkPresent,
      `[${label}] invariant 6 (omit): bulk absent by brief — briefRef="${options.briefRef}" must cite the omission rationale`,
    ).toBe(false)
    expect(
      options.briefRef,
      `[${label}] invariant 6 (omit): briefRef required to justify no-bulk`,
    ).toBeTruthy()
  }

  // 7. Type-to-confirm ONLY on high_value. Never over-apply.
  const ttcPresent = hasAny(container, [
    '[data-type-to-confirm]',
    '[data-testid="type-to-confirm"]',
    'input[aria-label*="type to confirm" i]',
  ])
  if (options.hasTypeToConfirm) {
    expect(
      ttcPresent,
      `[${label}] invariant 7: high_value tier — TypeToConfirmInput must be rendered`,
    ).toBe(true)
  } else {
    expect(
      ttcPresent,
      `[${label}] invariant 7: non-high_value — TypeToConfirmInput must NOT render (over-apply anti-pattern)`,
    ).toBe(false)
  }
}
