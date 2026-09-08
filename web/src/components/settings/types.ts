import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

/**
 * Trailing badge on a settings nav / card row.
 * Status tones map to Broadcast semantic badges; counts use `<Numeric>`.
 *
 * Used by: SHR-SET-001 (shell) → SHR-SET-002/003/004/005 child panes.
 */
export type SettingsNavBadge =
  | {
      kind: 'status'
      /** Visual tone — warning = amber (2FA off), danger = past-due red, default = neutral. */
      tone: 'default' | 'warning' | 'danger'
      /** Resolved visible label (parent supplies i18n). */
      label: string
    }
  | {
      kind: 'count'
      /** Must be > 0 — zero counts are never rendered (anti-pattern). */
      value: number
    }

/**
 * One settings destination in the capability-scoped index.
 * Visibility is server-driven via `GET /api/settings/index` — never client role checks.
 */
export interface SettingsNavItemData {
  id: string
  /** Absolute route under `/settings/*`. */
  route: string
  /** Lucide icon component (18px desktop / 24px mobile). */
  icon: LucideIcon
  /** Resolved visible label (parent supplies i18n). */
  label: string
  /** Optional trailing badge. */
  badge?: SettingsNavBadge | null
  /**
   * Danger-zone styling: idle stays primary ink; red tint on hover/active only.
   * Icon is always `--lc-status-unpublished-fg`.
   */
  danger?: boolean
  /** Synonyms for client-side search filter (SHR-SET-001 search UX). */
  synonyms?: string[]
  /** One-line description included in search match. */
  description?: string
}

/** One capability-scoped nav group (Account, Security, … Danger zone). */
export interface SettingsNavGroupData {
  id: string
  /** Resolved overline / card heading label. */
  label: string
  items: SettingsNavItemData[]
}

/** Shared props for navigating from a settings item (stub — parent wires router). */
export interface SettingsNavigateHandlers {
  /** Invoked when a mobile card row is activated. Desktop uses NavLink. */
  onNavigate?: (route: string) => void
}

export type SettingsFooterSlot = ReactNode
