/**
 * PA-queue-family invariant harness.
 *
 * Codifies the 7 invariants captured in project memory `project_pa_queue_family.md`
 * (PA-MOD-001 anchor + 5 downstream PA approval-queue screens). Consumers assert
 * against any PA queue page render — PA-MOD-001, PA-PVA-008, PA-PVA-009, PA-ACR-001,
 * PA-PKG-003 (Wave 6), PA-POR-001 (Wave 6), and any future PA queue.
 *
 * @example
 *   const { container } = render(<PackageApprovalQueuePage />)
 *   assertPaQueueFamilyInvariants(container, {
 *     hasBulk: true,
 *     hasTypeToConfirm: false, // WF-20 tier is not high_value
 *     briefRef: 'PA-PKG-003',
 *   })
 */
import { expect } from 'vitest'

export interface PaQueueFamilyInvariantsOptions {
  /** True unless the brief explicitly omits bulk (WF-04, WF-05 do — cite briefRef). */
  hasBulk: boolean
  /** True only when the queue includes a `high_value` tier row. Never over-apply. */
  hasTypeToConfirm: boolean
  /** Human-readable brief citation (e.g. "PA-PKG-003"), shown in failure messages. */
  briefRef: string
  /** Optional label attached to invariant failures (defaults to briefRef). */
  label?: string
}

/**
 * Assert all 7 PA-queue-family invariants on a rendered container.
 *
 * Invariants (from project memory):
 *   1. StatusHero + count subtitle
 *   2. Filter chips row
 *   3. Empty-state hero (declared; renders only when 0 rows)
 *   4. Keyboard nav + `?` shortcuts panel
 *   5. Row density (72px baseline via `PAQueueTable`)
 *   6. Bulk mode present OR deliberate omit with brief citation
 *   7. Type-to-confirm ONLY on `high_value` tier — never over-apply
 */
export function assertPaQueueFamilyInvariants(
  container: HTMLElement,
  options: PaQueueFamilyInvariantsOptions,
): void {
  const label = options.label ?? options.briefRef

  // 1. StatusHero + count subtitle
  const hero = container.querySelector('[data-status-hero], [data-testid="pa-queue-hero"]')
  expect(hero, `[${label}] invariant 1: StatusHero must be present`).toBeTruthy()
  const subtitle = hero?.querySelector(
    '[data-status-hero-subtitle], [data-testid="pa-queue-count-subtitle"]',
  )
  expect(
    subtitle,
    `[${label}] invariant 1: StatusHero subtitle element must be present`,
  ).toBeTruthy()
  expect(
    subtitle?.textContent ?? '',
    `[${label}] invariant 1: StatusHero subtitle must include a count`,
  ).toMatch(/\d+/)

  // 2. Filter chips row
  const filterStrip = container.querySelector(
    '[data-pa-queue-filter-strip], [data-testid="pa-queue-filter-strip"]',
  )
  expect(
    filterStrip,
    `[${label}] invariant 2: PAQueueFilterStrip must be rendered`,
  ).toBeTruthy()

  // 3. Empty-state hero — the element must be declared even when hidden
  // (queries the whole DOM; if the queue has rows, the empty hero should still
  // be present in the tree as hidden fallback, or as a template).
  const emptyState = container.querySelector(
    '[data-pa-queue-empty-hero], [data-testid="pa-queue-empty-hero"], [data-pa-queue-empty-template]',
  )
  expect(
    emptyState,
    `[${label}] invariant 3: empty-state hero must be declared (rendered or as template)`,
  ).toBeTruthy()

  // 4. Keyboard nav + `?` shortcuts panel
  const shortcutsPanel = container.querySelector(
    '[data-pa-queue-shortcuts-panel], [data-testid="pa-queue-shortcuts-panel"]',
  )
  expect(
    shortcutsPanel,
    `[${label}] invariant 4: PAQueueKeyboardShortcutsPanel must be imported and rendered`,
  ).toBeTruthy()

  // 5. Row density — 72px baseline. Assert the table primitive is used (delegates the
  // exact height class to the shared component, which encodes 72px).
  const table = container.querySelector('[data-pa-queue-table], [data-testid="pa-queue-table"]')
  expect(
    table,
    `[${label}] invariant 5: PAQueueTable must be used (encodes 72px row density)`,
  ).toBeTruthy()

  // 6. Bulk mode: present when hasBulk, absent (with citation) when omitted
  const bulkBar = container.querySelector(
    '[data-pa-queue-bulk-actions], [data-testid="pa-queue-bulk-bar"]',
  )
  if (options.hasBulk) {
    expect(
      bulkBar,
      `[${label}] invariant 6: bulk mode enabled — bulk bar must be rendered`,
    ).toBeTruthy()
  } else {
    expect(
      bulkBar,
      `[${label}] invariant 6 (omit): bulk absent by brief — briefRef="${options.briefRef}" must cite the omission rationale`,
    ).toBeFalsy()
    expect(
      options.briefRef,
      `[${label}] invariant 6 (omit): briefRef required to justify no-bulk`,
    ).toBeTruthy()
  }

  // 7. Type-to-confirm ONLY on high_value. Never over-apply.
  const ttc = container.querySelector('[data-type-to-confirm], [data-testid="type-to-confirm"]')
  if (options.hasTypeToConfirm) {
    expect(
      ttc,
      `[${label}] invariant 7: high_value tier — TypeToConfirmInput must be rendered`,
    ).toBeTruthy()
  } else {
    expect(
      ttc,
      `[${label}] invariant 7: non-high_value — TypeToConfirmInput must NOT render (over-apply anti-pattern)`,
    ).toBeFalsy()
  }
}
