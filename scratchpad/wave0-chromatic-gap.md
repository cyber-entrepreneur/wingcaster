# Wave 0 — Chromatic / Storybook gap

**Date:** 2026-09-08  
**PR:** https://github.com/cyber-entrepreneur/wingcaster/pull/53  
**Owner:** Phase-B agent #11 (a11y + visual)

## Status

Chromatic and Storybook are **not configured** in `web/` (`package.json` has no `chromatic` / `@storybook/*` scripts or deps; no `.storybook/` directory).

## What we shipped instead

| Layer | Location | Notes |
|---|---|---|
| A11y contract | `web/src/theme/nav-chrome.a11y.test.tsx` | Tap floors, focus rings (Broadcast CSS), aria-live, focus traps, skip-to-content, no color-only, jest-axe smoke |
| Visual matrix | `web/src/theme/nav-chrome.visual.test.tsx` | **80** Vitest DOM snapshots = 20 fixtures × LTR/RTL × light/dark, plus overlay/login extras |
| Token hygiene | `web/src/theme/no-raw-hex.test.ts` | Must stay green |

## Manual Chromatic checklist (when tooling lands)

Add Storybook stories + Chromatic project for these brief state variants:

1. **SHR-NAV-001/002** — TopBar + SideDrawer (expanded / rail / overlay), agent / agency / PA, mobile / tablet / desktop
2. **SHR-NAV-008** — TenantSwitcher idle single/multi, popover open, search empty, switching, mobile sheet, RTL mixed names, dark
3. **SHR-NAV-006** — LanguageSelector EN/AR × light/dark × focus
4. **SHR-NAV-003** — BottomTabBar badge caps, More sheet, keyboard-hidden empty
5. **PA-NAV-001** — EnvBadge LIVE/TEST, popover, confirm dialog, warning strip
6. **SHR-AUT-001** — Login idle / filled / loading / errors × LTR/RTL × light/dark

Target remains ~80 Chromatic snapshots once Storybook is wired; Vitest snapshots cover the same matrix until then.

## App shells

`AgentAppShell` / `AgencyAppShell` / `PaAppShell` landed mid-run under `web/src/app/`.
A11y + visual coverage was extended to include them (skip-to-content → `#main-content`,
persona chrome, PA TEST strip).
