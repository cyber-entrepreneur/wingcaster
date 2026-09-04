# ListingClarion — Broadcast theme integration

Adopted theme, 13 August 2026. Everything a component needs is in this folder.

## Files

| File | What it is | Use it for |
| --- | --- | --- |
| `broadcast-theme.css` | 127 CSS custom properties + minimal base rules. **Generated — do not hand-edit.** | Drop into the app. This is what components consume. |
| `broadcast-tokens.json` | W3C DTCG tokens for Broadcast only, plus the AA matrix. | Source of truth. Feed to Style Dictionary / Tokens Studio, or generate platform files from it. |
| `listingclarion-all-themes.json` | All four candidate themes (Clarion, Broadcast, Ledger, Beacon). | Reference only. Not needed to ship Broadcast. |

File names are hyphenated exactly as written above. If your download tool strips hyphens, rename before importing.

## Install

```html
<link rel="stylesheet" href="broadcast-theme.css" />
<link href="https://fonts.googleapis.com/css2?family=Archivo:wght@400;500;600;700;800&family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap" rel="stylesheet" />
```

Light is the default. Dark applies two ways:

```html
<html data-lc-mode="dark">   <!-- explicit -->
<html>                        <!-- follows prefers-color-scheme -->
<html data-lc-mode="light">   <!-- opt out of the OS preference -->
```

## The one rule

**Components read the semantic tier only.** A literal hex, or a `--lc-orange-600`-style primitive reference, in component code is a bug: it is the one thing that will not follow the mode switch.

```css
/* yes */  background: var(--lc-action-primary); color: var(--lc-action-primary-text);
/* no  */  background: #C93C08; color: #fff;
```

## Token map

Surfaces and text
```
--lc-bg-page              page background
--lc-surface              default surface
--lc-surface-raised       cards, panels
--lc-surface-sunken       wells, tracks, table headers
--lc-surface-inverse      inverted blocks
--lc-border               hairlines
--lc-border-strong        input borders, swatch edges
--lc-text-primary         body and data
--lc-text-heading         section headings (cobalt on light, white on dark)
--lc-text-secondary       supporting copy
--lc-text-muted           meta, timestamps, column labels
--lc-text-brand           links, inline emphasis
--lc-text-inverse         text on inverse surfaces
```

Actions and accent
```
--lc-action-primary            primary fill (orange runs large in this theme)
--lc-action-primary-hover      hover — steps DARKER, never lighter
--lc-action-primary-text       ink on primary; also the ring for marks placed on it
--lc-action-primary-scrim      recessed track inside a primary surface
--lc-action-secondary          secondary fill
--lc-action-secondary-text     ink on secondary
--lc-accent                    teal, carries information alone at 3:1
--lc-accent-bold               bright signal FILL — never carries its own boundary
--lc-accent-bold-text          the only legal ink on accent-bold
--lc-accent-bold-edge          the boundary for accent-bold; also the only accent legal as small text
--lc-focus-ring                focus indicator, INNER band
--lc-focus-ring-contrast       focus indicator, OUTER band — ship both, see constraint 7
```

Status — `--lc-status-{draft,published,underOffer,closed,archived,unpublished}-{bg,fg,dot}`

```html
<!-- status is NEVER colour alone: tint + glyph + label, always -->
<span class="badge" style="background:var(--lc-status-published-bg);color:var(--lc-status-published-fg)">
  <span aria-hidden="true">●</span> Published
</span>
```

Glyphs: draft ○ · published ● · underOffer ◐ · closed ◆ · archived ▢ · unpublished ✕

Channel — `--lc-channel-{instagram,whatsapp,messenger,facebook,tiktok,x,linkedin,olx}` and `-on` for its ink. Polarity flips by mode automatically; always pair a mark with its own `-on` value. Chips, dots and 20–28px marks only — never large surfaces, never body text.

Type, space, form
```
--lc-type-{display-xl,display,heading-1..3,body-lg,body,body-sm,caption,overline,data,data-sm}
--lc-tracking-<same tokens>          apply alongside; the font shorthand cannot carry it
--lc-space-{3xs,2xs,xs,sm,md,lg,xl,2xl,3xl,4xl,5xl}
--lc-radius-{sm,md,lg,xl,pill}       3-10px. Tight on purpose.
--lc-elevation-{sm,md,lg}            OFFSET shadows, not blurred
--lc-duration-{instant,fast,base,slow,deliberate} / --lc-easing-{out,in-out,emphasis}
--lc-z-{base,raised,sticky,dropdown,overlay,modal,toast,tooltip}
--lc-breakpoint-{xs,sm,md,lg,xl,2xl}
--lc-tap-target-min                  44px floor for every interactive element
```

Display tokens already carry the theme display weight (800), so `font: var(--lc-type-display)`
renders loud with no extra rule. `--lc-display-weight` exists for anything composing its own shorthand.

```css
.price { font: var(--lc-type-data); font-variant-numeric: tabular-nums; }
h2 { font: var(--lc-type-heading-1); letter-spacing: var(--lc-tracking-heading-1); color: var(--lc-text-heading); }
```

## Constraints that are not preferences

Each one exists because the alternative measured below AA during design.

1. Every numeral uses `--lc-font-mono` with `tabular-nums`. Proportional digits shift column edges row to row.
2. `--lc-accent-bold` needs a boundary — an `--lc-accent-bold-edge` outline, or an `--lc-action-primary-text` ring when it sits on a primary surface. Its luminance is close to the brand orange.
3. Channel marks always take their matching `-on` ink. White glyphs on dark-mode marks land between 1.1:1 and 2.7:1.
4. `--lc-action-primary-hover` is darker than the default. A lighter orange on the same hue reads as disabled.
5. Interactive elements are ≥44px. The base stylesheet sets this; do not override it down.
6. Keep the teal accent small. At equal area against orange the page loses its focal point.
7. The focus indicator is **two-tone** and the base stylesheet already implements it:
   `box-shadow: 0 0 0 2px var(--lc-focus-ring), 0 0 0 4px var(--lc-focus-ring-contrast)`.
   Do not replace it with a single outline. The primary button is orange, the page is not — no
   single colour clears 3:1 against both, and the button is where focus most needs to be visible.
   In `$validation`, the individual band rows are diagnostics; the "either band" rows are the requirement.

## Verifying a change

`broadcast-tokens.json → $validation` holds every pairing the components depend on, per mode. Regenerate it after any colour change; it must report zero failures. Text needs 4.5:1, UI and non-text boundaries 3:1.

## Pipeline

```
tokens.js (authoring)  →  broadcast-tokens.json (source of truth)  →  broadcast-theme.css (generated)
```

Change values at the source and regenerate. Never edit the CSS directly — it will be overwritten.

The `@media (prefers-color-scheme: dark)` block repeats the `[data-lc-mode="dark"]` values and outranks
it on specificity (`0,2,0` vs `0,1,0`). Identical today because both come from one source — which is why
they must stay generated. Hand-editing one and not the other makes the OS preference silently win.

### Changelog

- **14 Aug 2026** — `component.channelMark.radius` pointed at `{theme.flagship.radius.sm}`, a node that
  does not exist in this export; now `{primitive.radius.sm}`. Composed display tokens baked weight 700
  against a theme that declares 800; now 800. Focus ring was orange on an orange button; now two-tone.
