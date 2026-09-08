# Screen Brief — AGT-INB-002 · Conversation detail

**Layer-2 Brief for design AI consumption (v0 / Cursor / Bolt / Figma AI).**

Companion to `SCREEN_MATRIX_AGENT.md` entry `AGT-INB-002`. **Delta brief** — anchored to `AGT-INB-001-unified-inbox-list-brief.md` (the AGT-INB family anchor). This brief specifies ONLY what changes at the conversation-detail surface (header + thread + compose bar) on top of everything AGT-INB-001 already locks in (Broadcast tokens, channel/source dual-badge treatment per AGT-INB-005, filter/list behavior, offline banner, poll cadence, RTL rules, accessibility floor). Read AGT-INB-001 first; this brief presumes it.

The conversation detail is WingCaster's **"Reply"** surface — the counterpart to the "Catch" list. If AGT-INB-001 is where the agent decides *whom* to reply to, AGT-INB-002 is where they *actually reply*, on the transport the contact chose, from the source that produced the lead. On mobile it is a full-screen route; on tablet/desktop it is the middle panel of the split view. Every send here charges a per-channel meter (WA_SEND / SMS_SEND / EMAIL_SEND) — this screen is the last mile of the product's core promise.

---

## 🎨 Broadcast alignment

**This brief inherits from `docs/design/briefs/BROADCAST_ALIGNMENT_REFERENCE.md`.** All color / font / spacing / motion / radii references below are governed by that reference. Any inline hex, shadcn-generic reference, or `rgb(...)` literal in this brief is a bug — replace with `--lc-*` semantic tokens.

**Screen-specific Broadcast callouts (delta from AGT-INB-001):**

- **Conversation header** (56px mobile, 64px tablet/desktop):
  - Background: `--lc-surface-raised`. Bottom border `1px solid --lc-border`.
  - Contact name: `var(--lc-type-heading-3)` (600 18/24 IBM Plex Sans) in `--lc-text-primary`.
  - Contact phone / email sub-line: `var(--lc-type-body-sm)` in `--lc-text-muted`; if masked, wrap the masked segment in `<Numeric>` for tabular alignment and show a `Lock` (12px) glyph in `--lc-text-muted` before the value.
  - Dual badge row (channel + source, AGT-INB-005 spec): renders directly below the name at 20px chip height. Rules unchanged from AGT-INB-001 — colored `<ChannelMark>` left, neutral `<SourceMark>` right, `·` middot separator.
  - Attribution line (portal-listing provenance): `var(--lc-type-caption)` in `--lc-text-muted`; renders under the dual badge row when `source_context.portal_listing_date` is known. Format: `From your {source} listing dated {date}` with the date wrapped in `<Numeric>`. The whole line is a `Link` styled `--lc-text-brand` when `source_url` is present, opening the portal listing in a new tab.
  - Overflow menu button (rightmost, 32×32): `MoreVertical` icon. Opens a `<DropdownMenu>` with the header actions.
  - Back button (mobile only, leftmost, 32×32): `ArrowLeft` (RTL: `ArrowRight`). Navigates to `/inbox` preserving list scroll + filters.
- **Message thread** (scrollable, occupies the middle of the screen between header and compose):
  - Container background: `--lc-surface-sunken` (a shade darker than the header/compose — the thread is a "well" the messages sit in).
  - Day-group separator: horizontal center-aligned pill — `--lc-surface-raised` bg, `--lc-border` 1px outline, `var(--lc-type-caption)` in `--lc-text-muted`, `--lc-radius-pill`. Text: `Today`, `Yesterday`, or `{Weekday}, {D MMM YYYY}`; the date segment wrapped in `<Numeric>`.
  - **Inbound message bubble** (contact → agent, left-aligned in LTR):
    - Background `--lc-surface-raised`; border `1px solid --lc-border`; radius `--lc-radius-lg` with the corner adjacent to the avatar squared (`--lc-radius-sm`) to point at the sender.
    - Text: `var(--lc-type-body)` in `--lc-text-primary`. Max-width 78% of thread column.
    - Meta line under bubble (LEFT-aligned): `var(--lc-type-caption)` in `--lc-text-muted` — `{time}` wrapped in `<Numeric>`; if this is the FIRST inbound message of the conversation, prefix with the source glyph + `Arrived via {channel} from {source}` (see §Portal-source indicator below).
  - **Outbound message bubble** (agent → contact, right-aligned in LTR):
    - Background `--lc-action-primary` fill; text `--lc-action-primary-text` (white ink on orange).
    - Same `--lc-radius-lg` with the trailing corner squared toward the agent's avatar.
    - Meta line under bubble (RIGHT-aligned): `var(--lc-type-caption)` in `--lc-text-muted` — `{time}` in `<Numeric>` + delivery-status glyph pair: `Check` (sent) · `CheckCheck` (delivered) · `CheckCheck` in `--lc-accent-bold-edge` (read) · `AlertCircle` in `--lc-status-danger-fg` (failed).
  - **System bubble** (channel adapter events — "Assigned to Sara", "Snoozed until tomorrow 9am", "Marked closed"):
    - Center-aligned, no bubble background — just `var(--lc-type-caption)` in `--lc-text-muted` with a leading icon (`UserPlus` / `Moon` / `X`) at 12px. No border, no fill.
  - **Grouping rule**: consecutive same-direction messages within 90 seconds collapse — only the LAST bubble in the group renders the meta line + delivery-status. Vertical gap within a group: `var(--lc-space-2xs)` (4px). Between groups: `var(--lc-space-md)` (16px). Between day groups: `var(--lc-space-xl)` (24px).
- **Portal-source indicator on the FIRST inbound message**:
  - A small chip attached to the top-left corner of the first inbound bubble (before the bubble text): `--lc-accent-bold` fill (teal), `--lc-accent-bold-text` ink, `--lc-accent-bold-edge` 1px boundary (accent-bold ALWAYS needs a boundary per Broadcast). Text `var(--lc-type-overline)` uppercase: `FROM {SOURCE}`. Tap → filters inbox to just this source on next `/inbox` visit.
  - Only renders on the very first inbound message of the thread, and only when `source ≠ 'direct' && source ≠ 'unknown'`. For Direct/Unknown, the meta line under the bubble just reads the channel: `via WhatsApp`.
- **Media attachments** (rendered inline inside a message bubble):
  - **Images**: 200×200 max on mobile, 320×320 on desktop. `--lc-radius-md` corners, `object-fit: cover`. Tap → full-screen lightbox via `<Dialog>` with pinch-zoom. Loading skeleton at `--lc-surface-sunken`.
  - **PDFs**: rendered as a card 240×64 — `FileText` icon (24px) on the left, filename + `{size} · PDF` on the right in `var(--lc-type-body-sm)` / `var(--lc-type-caption)`. Card background `--lc-surface-raised` on outbound bubbles (contrast against the orange fill: the CARD sits on a small `--lc-action-primary-scrim` inset track). Tap → download.
  - **Audio (voice notes)**: 240×48 card — `Play` / `Pause` toggle + waveform (SVG polyline, `--lc-text-secondary` stroke) + `{mm:ss}` counter in `<Numeric>`. Playback state persists across scroll.
  - **Video**: same 200×200 (mobile) / 320×320 (desktop) shape as images with a `Play` overlay glyph. Tap → full-screen `<video>` playback via `<Dialog>`.
  - **Other MIME types**: generic file card (like PDF but with `Paperclip` icon and MIME suffix in the meta).
- **AI-suggested-reply chips** (opt-in from AGT-SET-001):
  - Renders in a horizontally-scrolling row directly ABOVE the compose bar. Container background `--lc-surface-sunken`; each chip `--lc-surface-raised` bg + `--lc-border-strong` 1px outline + `--lc-radius-pill` + `var(--lc-type-body-sm)` in `--lc-text-primary`. Leading `Sparkles` icon (12px) in `--lc-text-brand`. Height 32px (chip contents), 44px tap floor per Broadcast.
  - Up to 3 chips rendered. Tap → insert the chip's text into the compose field (does NOT auto-send). Tap → chip fades out with `--lc-duration-fast`.
  - "Regenerate" affordance at end of the row: `<Button variant="ghost" size="icon">` with `RefreshCw` icon. Disabled while regenerating; `Loader2` spinner replaces the icon.
  - Only renders when `agent_preferences.ai_suggested_replies === true` AND the last message in the thread is inbound AND there is no draft in the compose field. When any of those flip false, the row collapses with `--lc-duration-fast`.
- **Compose bar** (sticky bottom, elevates above thread with `--lc-elevation-sm` inverted — shadow points UP not down):
  - Background `--lc-surface-raised`. Top border `1px solid --lc-border`.
  - Layout (left-to-right in LTR): attachment picker (`Paperclip`, 40×40 icon button) · template picker (`FileCode2`, 40×40) · text area (grows 1→5 lines, `--lc-surface-sunken` bg + `--lc-radius-lg` + `var(--lc-type-body)` in `--lc-text-primary`) · voice-to-text (mobile only, `Mic`, 40×40) · Send (`Send` icon, 44×44 `<Button variant="default">` — primary orange).
  - Character counter (channel-max-length warning): renders in the bottom-right corner of the text area when message length ≥ 80% of channel max. `var(--lc-type-caption)` in `--lc-text-muted`; flips to `--lc-status-warning-fg` at 90%; flips to `--lc-status-danger-fg` at 100% and disables Send. Counter always wrapped in `<Numeric>` with `{used} / {max}` format. Channel maxes: SMS 160, WhatsApp 4096, Email 200000, IG DM 1000, Facebook Messenger 2000, X DM 10000, LinkedIn 8000, Telegram 4096, TikTok DM 6000.
  - Send button disabled state: text field empty AND no attachments queued → `--lc-action-secondary` bg + `--lc-text-muted` ink. Enabled → default primary treatment. Sending state: `Loader2` spinner replaces `Send`, button disabled.
- **Header action menu** (opened via header `MoreVertical`): renders as `<DropdownMenu>` with sections separated by `<DropdownMenuSeparator>`:
  - Section 1: `Assign` (opens AGT-INB-004) · `Snooze` (opens the same three-option popover from AGT-INB-001 bulk actions).
  - Section 2: `Convert to opportunity` (opens AGT-OPP-001 with contact + listing prefilled) · `View contact profile` (opens AGT-CTC-002).
  - Section 3: `Archive` (destructive dialog — same treatment as AGT-INB-001 bulk archive) · `Mark unread` · `Close`.
- **Two-tone focus ring** automatic on every interactive element. 44px tap floor automatic on every button. Do not override.

---

## Meta

| | |
|---|---|
| Screen ID | AGT-INB-002 |
| Screen name | Conversation detail |
| Persona | Agent (all tiers). Agency-context adds `Assign` in the header action menu. |
| Device targets | Mobile 375px (primary — this is a return-visit surface used mostly on-the-go), tablet 768px (renders as the right panel of the split view — no back button), desktop 1440px (renders as the middle panel of the three-panel view) |
| Locale | English + Arabic (RTL) — both mandatory |
| Theme | Light + Dark, respect `prefers-color-scheme` + user override via `<ColorModeToggle>` |
| Runtime | React web app inside Capacitor iOS/Android wrapper on mobile; standard web on tablet/desktop. Voice-to-text uses the Capacitor Speech Recognition plugin on mobile and the Web Speech API `SpeechRecognition` on desktop. |
| Route | `/inbox/:conversationId` — canonical. Query params: `?draft=<text>` (autofills the compose field, used from Command Center quick-actions), `?insertTemplate=<templateId>` (autoloads a template into compose). |
| Current state | PARTIAL — existing conversation thread logic lives inside `web/src/pages/InboxPage.tsx` (three-panel monolith). This brief extracts the conversation detail into its own routable page (`web/src/pages/InboxConversationPage.tsx`) with the split-panel layout delegated to a parent layout component. |
| Mode | Guided + Pro share this screen. Pro adds: keyboard shortcuts (`r` reply focus, `⌘Enter` send, `t` insert template, `⌘K` search within thread), inline draft-save every 3s. |
| Backend prerequisites | ✅ Conversation + message endpoints exist (`GET /api/conversations/:id`, `GET /api/conversations/:id/messages`, `POST /api/conversations/:id/messages`, `POST /api/conversations/:id/assign`, `PATCH /api/conversations/:id`). ⏳ `[BE-BLOCKER-04]` `conversations.source_channel` decomposition (inherited from AGT-INB-001; Week 4 slot per kickoff §5a). Channel adapter dispatch (WhatsApp / SMS / Email / IG / FB / X / LinkedIn / Telegram / TikTok) already exists in `backend/src/services/channel-dispatch.js`. No new backend surface is required for character counting, template insertion, or AI-suggested-reply chip rendering — see §Backend contract. |

---

## Purpose (one sentence)

The agent reads one conversation thread — every inbound and outbound message across time, grouped by day, contextualized by the channel and source that produced it — and composes their next reply on the transport the contact chose, one tap away from send.

---

## Design goals

1. **The reply is the point.** Everything above the compose bar is context; the compose bar is action. On mobile the compose bar is always visible above the keyboard; on desktop it is always visible above the thread's scroll. If the agent has to scroll to find "reply", the screen is broken.
2. **Provenance stays visible.** The channel + source dual badge (AGT-INB-005) does not live only in the list — it lives in the header of this screen too, and the FIRST inbound message carries a portal-source indicator badge on the bubble itself. The agent should never forget that this WhatsApp message came from a Bayut listing dated 2026-09-01.
3. **Channel max is a rail, not a wall.** The character counter warns at 80%, alerts at 90%, blocks at 100%. On WhatsApp the counter rarely matters; on SMS it always does — but the SAME UI serves both. The agent learns to trust the counter without having to remember which channel has which limit.
4. **AI-suggested replies never auto-send.** Even when the agent taps a chip, the text lands in the compose field for review. This is a Broadcast-brand trust boundary: WingCaster's AI helps the agent draft; only the agent presses Send.
5. **Delivery state is legible.** Sent / delivered / read / failed each have distinct glyphs and colors (never color alone). Failed messages get a `Retry` affordance directly on the bubble. Offline sends queue and show a `Clock` glyph until reconnect flushes the queue.
6. **RTL Arabic first-class.** The bubble alignment mirrors (inbound RIGHT in RTL, outbound LEFT), the compose bar's icon order mirrors, the header back button becomes `ArrowRight`, but timestamps + character counter always render LTR with Latin numerals unless the user's locale converts them via `Intl.NumberFormat`.
7. **Fast.** First meaningful paint under 600ms with a skeleton header + skeleton bubbles; message history loads paginated from the newest backwards, 40 messages per page. Poll every 8s for new inbound messages while visible (same cadence as AGT-INB-001).

---

## Layout — mobile 375px, portrait (primary)

Working within 375×812 minus the top safe-area and any on-screen keyboard.

### Zone 1 — Conversation header (56px, sticky top)

- Left: `ArrowLeft` back button (32×32, mirrors to `ArrowRight` in RTL). Navigates to `/inbox` restoring the list's scroll + filter state.
- Middle: contact name (`var(--lc-type-heading-3)`) + one-line sub-line (`var(--lc-type-body-sm)` in `--lc-text-muted`). Sub-line format: `{masked phone} · {masked email}` — mask until consent (see AGT-INB-001 privacy rules); before consent, phone renders as `+971 5** ***4567` and email as `a***@example.com`. A 12px `Lock` glyph precedes each masked value.
- Right: `MoreVertical` overflow (32×32) → opens the action menu described in §Header action menu above.

Directly below the name / sub-line, the DUAL BADGE ROW appears at the top of Zone 2 (not inside Zone 1 — Zone 1 stays sticky and compact; the badge row scrolls with the thread on mobile so the header stays legible on small screens). On tablet/desktop the badge row lives inside a taller Zone 1 (see §Layout tablet/desktop below).

### Zone 2 — Context strip (auto-height, non-sticky)

Sits between header and thread. Contents (in order):

- Dual badge row: `<ChannelMark channel={channel}>` · `<SourceMark source={source}>` — same primitives and behavior as AGT-INB-001 rows. Tap channel → filters inbox to that channel on the next `/inbox` visit; tap source → filters to that source.
- Attribution line (only when `source_context.portal_listing_date` is known): `From your {source} listing dated {date}` — link-styled if `source_url` present.
- Related-listing card (when `conversation.related_listing_id` is set): 320×72 card, `--lc-surface-raised` bg, `--lc-elevation-sm`. Thumbnail 56×56 on the left; address (`var(--lc-type-body-sm)` weight 600) + price + beds/baths on the right (numerals in `<Numeric>`). Tap → opens the listing detail (AGT-LST-012) in a new tab.

If both attribution line + related-listing card are absent (Direct source, no related listing), Zone 2 renders JUST the dual badge row and is 40px tall.

### Zone 3 — Message thread (scrollable, occupies rest of screen minus compose bar)

- Container background: `--lc-surface-sunken`.
- Vertical scroll pinned to the bottom by default (newest at bottom). Pull-down at top triggers "load older messages" — fetches the previous 40 messages, prepends without shifting scroll position.
- Day-group separator pills anchor time. Message groups collapse per §Broadcast callouts. Bubble alignment per direction.
- Portal-source indicator badge attaches to the top-left corner of the FIRST inbound bubble.
- Delivery-status glyphs render under outbound bubble meta lines.
- Media attachments render inline per §Media attachments.

### Zone 4 — AI-suggested-reply chip row (44px, above compose, conditional)

- Renders only when the opt-in preference is on, the last message is inbound, and the compose field is empty.
- Horizontally-scrolling row of up to 3 chips + a `RefreshCw` regenerate button.

### Zone 5 — Compose bar (sticky bottom, auto-grows 56 → 176px)

- Layout described in §Broadcast callouts.
- Text area grows from 1 line (56px total bar height) to 5 lines (176px). Beyond 5 lines the area scrolls internally.
- Character counter appears bottom-right of the text area when message length ≥ 80% of channel max.
- Send button disabled when text empty + no attachments queued.

### Zone 6 — Full-screen states (loading / empty-new-conversation / send-error / offline banner)

Detailed in §State variants.

---

## Layout — tablet 768px, right panel of split view

Zone 1 grows to 64px to accommodate the dual badge row inline with the header (no separate Zone 2 badge row on tablet+). Back button is removed (the list stays visible on the left; the agent switches conversations by tapping another row, not by going "back").

Everything else identical to mobile — thread scrolls internally within the panel; compose bar sticks to the bottom of the panel; AI chip row sits above compose.

### Empty-panel state (tablet, no conversation selected)

When the user lands on `/inbox` with no `:conversationId`, the right panel shows a `<CmdEmptyState>` with:

- Illustration (a stylized speech bubble on a soft `--lc-surface-sunken` disc)
- Heading `Pick a conversation to open it` — `var(--lc-type-heading-2)`
- Body `Tap a conversation in the list. Compose a new one with the button top-left.` — `var(--lc-type-body-lg)` in `--lc-text-muted`

---

## Layout — desktop 1440px, middle panel of three-panel view

Same as tablet split-panel layout for the middle panel. Additions:

- Right panel (320px, permanent): contact 360 mini-card (avatar + name + phone + email + tags + assigned agent + stage) — sourced from the contact record. Not a scope of this brief; specified in AGT-CTC-002. This screen just reserves the space and mounts the `<ContactContextPanel contactId={conversation.contact_id}>` component.
- Keyboard shortcuts (Pro mode, surfaced via `?` overlay per AGT-INB-001):
  - `r` — focus the compose field
  - `⌘Enter` / `Ctrl+Enter` — send
  - `t` — open template picker
  - `a` — open attachment picker
  - `⌘K` — search within thread (opens an inline search bar above Zone 2)
  - `Shift+A` — open assign popover (agency only)
  - `#` — close conversation
  - `e` — archive conversation
  - `Esc` — clear compose field / close open popover

---

## Message bubble anatomy — the definitive spec

### Inbound bubble (contact → agent, LEFT in LTR / RIGHT in RTL)

```
┌────────────────────────────────┐
│ [chip: FROM BAYUT ↗]           │   ← only on first inbound with a portal source
│ Hi, is the JVC 1BR still       │
│ available? I saw it on Bayut.  │
└────────────────────────────────┘
  ⏱ 8:12 AM · via WhatsApp
```

- Background `--lc-surface-raised`; border `1px solid --lc-border`; radius `--lc-radius-lg` with LEADING-corner squared (`--lc-radius-sm`).
- Max-width 78% of thread column width.
- Body text `var(--lc-type-body)` in `--lc-text-primary`.
- Meta line beneath: time in `<Numeric>` + `via {channel}` (only when the message's channel differs from the conversation's primary channel — for multi-channel merged conversations per AGT-INB-001 merge/unmerge preference).
- Portal-source chip renders inline at the top of the FIRST inbound bubble only.

### Outbound bubble (agent → contact, RIGHT in LTR / LEFT in RTL)

```
                    ┌────────────────────────────────┐
                    │ Yes, it's available. Would you │
                    │ like to schedule a viewing?    │
                    └────────────────────────────────┘
                             ✓✓ 8:14 AM · Read
```

- Background `--lc-action-primary`; text `--lc-action-primary-text`.
- Same radius rule with the TRAILING corner squared.
- Meta line beneath (right-aligned in LTR): delivery-status glyph + time + status label (`Sent` / `Delivered` / `Read` / `Failed`).
- Delivery status glyph mapping:
  - `Check` in `--lc-text-muted` → `sent` (accepted by adapter, not yet delivered)
  - `CheckCheck` in `--lc-text-muted` → `delivered` (delivered to contact device)
  - `CheckCheck` in `--lc-accent-bold-edge` → `read` (contact opened)
  - `AlertCircle` in `--lc-status-danger-fg` → `failed` (adapter rejected or delivery failed) — bubble gains a `Retry` button in the meta line
  - `Clock` in `--lc-text-muted` → `queued` (offline; will send on reconnect)

### System bubble (channel-adapter or agent-workflow events)

- Center-aligned, no background fill, `var(--lc-type-caption)` in `--lc-text-muted`, leading icon at 12px.
- Examples: `Assigned to Sara — 10:04 AM`, `Snoozed until tomorrow 9am — 10:12 AM`, `Marked closed — 4:30 PM`, `Contact opted out of WhatsApp — 5:00 PM`.
- Never carries actions. Purely audit-log.

---

## Compose bar — the definitive spec

### Text area

- Auto-grows 1 → 5 lines; internal scroll beyond 5. Placeholder: `Reply to {contact_first_name}…` in `--lc-text-muted`.
- Draft persistence: local state, saved to `sessionStorage.inbox_draft_{conversationId}` on every keystroke (debounced 300ms). Restored on route re-entry. Cleared on successful send.
- On tablet/desktop Pro mode: server-side draft save every 3s to `PATCH /api/conversations/:id/draft` (uses existing conversation PATCH; body `{ draft: text }`).

### Attachment picker (leftmost, `Paperclip` 40×40)

- Opens a bottom-sheet (mobile) or popover (desktop) with three tiles: `Photo`, `Document`, `Voice note`.
- Photo → opens native camera / photo picker via Capacitor Camera plugin (mobile) or `<input type="file" accept="image/*">` (desktop). Multi-select up to 10 images.
- Document → opens native document picker (PDF, DOCX, XLSX up to 25MB per file).
- Voice note → opens a full-screen recorder (mobile only) via Capacitor Voice Recorder plugin; tap-and-hold to record; release to preview; discard or attach.
- Queued attachments render as horizontally-scrolling thumbnails above the text area with a `X` remove button on each.

### Template picker (`FileCode2` 40×40)

- Opens a bottom-sheet (mobile) or popover (desktop) listing the agent's templates (from AGT-TPL-001 — templates are stored per-tenant with a per-agent starred subset).
- Each template row: title + one-line preview + channel badges showing which channels it's compatible with (some templates use WhatsApp media macros that aren't valid on SMS).
- Search input at top; recent-templates section pinned at the top when the field is empty.
- Tap → inserts the template's rendered text (with `{contact.first_name}`, `{listing.address}`, etc. macros already substituted) into the text area. If the template has attachments (e.g., a brochure PDF), they enqueue into the attachment strip.
- Template compatibility check: if the template's declared channels do NOT include the conversation's channel, a warning appears in the sheet: `This template isn't tuned for {channel}. Send anyway?` with a `Continue` button.

### Voice-to-text (mobile only, `Mic` 40×40)

- Tap-to-toggle. Active state: `Mic` icon flips to `MicOff`, an animated `--lc-accent-bold` dot pulses next to the icon (this is the ONE screen where the signal-lamp motif is legal outside the "listing went live" moment — voice recording is an equally important active-signal moment, and the same visual language communicates "listening now"). Transcribed text appends live into the text area.
- Uses `capacitor-community/speech-recognition` on mobile; falls back to Web Speech API `SpeechRecognition` on desktop. Locale-aware — Arabic dictation supported via the plugin's locale flag when the app language is Arabic.
- Tap-out or 3s silence stops recording. Errors (mic permission denied, network unavailable) show an inline toast under the compose bar.

### Send button (44×44 primary `<Button>` with `Send` icon)

- Default: enabled → `--lc-action-primary` fill; disabled → `--lc-action-secondary` bg + `--lc-text-muted` ink.
- Sending state: `Loader2` replaces `Send`, button disabled, text area disabled.
- Success: bubble appears in the thread with `Sent` state; compose field clears; scroll pins to bottom.
- Failure: bubble appears with `Failed` state + `Retry` affordance; text remains in the compose field for editing. Toast: `Couldn't send — check your connection or the channel adapter status.`
- Offline: send button label changes to `Queue`; on tap, message enqueues with `Clock` glyph in the thread and a persistent banner: `Queued — will send when back online.`

### Character counter (channel-max-length warning)

- Renders bottom-right of the text area, INSIDE the field's padding (not below the field — space is precious on mobile).
- Format: `{used} / {max}` in `<Numeric>`, `var(--lc-type-caption)`.
- Thresholds:
  - `< 80%` — hidden.
  - `80–89%` — `--lc-text-muted`.
  - `90–99%` — `--lc-status-warning-fg`.
  - `≥ 100%` — `--lc-status-danger-fg`; Send button disables; sub-line under the counter: `Message exceeds {channel} limit.`
- Channel maxes: SMS 160 (segmented — see below), WhatsApp 4096, Email 200000, Instagram DM 1000, Facebook Messenger 2000, X DM 10000, LinkedIn 8000, Telegram 4096, TikTok DM 6000.
- **SMS segmentation** (special case): SMS bills per 160-char segment (or 70 chars if the message contains non-GSM-7 characters like Arabic). Counter shows `{used} / {max}` for the current segment PLUS `{n_segments} segment(s)` in `var(--lc-type-caption)` in `--lc-text-muted`. Warning appears at the segment boundary, not a single hard cap.

---

## Explicit copy (English)

Arabic strings marked `[TRANSLATION-PENDING]` — filled during MENA copywriter pass.

| Slot | Copy |
|---|---|
| Header — back button aria | Back to inbox |
| Header — masked phone lock aria | Phone hidden until contact consents |
| Header — masked email lock aria | Email hidden until contact consents |
| Context — attribution line | From your {source} listing dated {date} |
| Context — attribution no-date | From your {source} listing |
| Context — attribution no-portal | Arrived via {channel} directly |
| Bubble — portal-source chip | From {source} |
| Bubble — meta channel prefix | via {channel} |
| Bubble — delivery sent | Sent |
| Bubble — delivery delivered | Delivered |
| Bubble — delivery read | Read |
| Bubble — delivery failed | Failed |
| Bubble — delivery queued | Queued |
| Bubble — failed retry | Retry |
| Day group — today | Today |
| Day group — yesterday | Yesterday |
| System — assigned | Assigned to {agent_name} |
| System — snoozed | Snoozed until {timestamp} |
| System — closed | Marked closed |
| System — reopened | Reopened |
| System — archived | Archived |
| System — merged | Merged with {other_channel} conversation |
| System — opted-out | Contact opted out of {channel} |
| AI chips — regenerate aria | Regenerate suggestions |
| AI chips — empty | (no chips rendered when off / no draft context) |
| Compose — placeholder | Reply to {contact_first_name}… |
| Compose — placeholder no-name | Type your reply… |
| Compose — send button aria | Send message |
| Compose — attachment aria | Attach a photo, document, or voice note |
| Compose — template aria | Insert template |
| Compose — voice aria | Dictate with voice |
| Compose — counter format | {used} / {max} |
| Compose — counter over-limit | Message exceeds {channel} limit. |
| Compose — SMS segment count | {n} segment(s) |
| Compose — template channel warning | This template isn't tuned for {channel}. Send anyway? |
| Compose — template continue | Continue |
| Attachment — sheet title | Attach |
| Attachment — photo | Photo |
| Attachment — document | Document |
| Attachment — voice | Voice note |
| Attachment — remove aria | Remove attachment |
| Send success — toast (silent) | (no toast — the bubble appearing is the confirmation) |
| Send failure — toast | Couldn't send — check your connection or the channel adapter status. |
| Send queued — banner | Queued — will send when back online. |
| Send offline — send button | Queue |
| Offline banner | You're offline. Messages will send when connection returns. |
| Voice-to-text — permission denied | Microphone access needed for voice dictation. |
| Voice-to-text — network error | Voice dictation needs an internet connection. |
| Header menu — assign | Assign |
| Header menu — snooze | Snooze |
| Header menu — convert | Convert to opportunity |
| Header menu — view profile | View contact profile |
| Header menu — archive | Archive |
| Header menu — mark unread | Mark unread |
| Header menu — close | Close conversation |
| Empty — no conversation selected | Pick a conversation to open it |
| Empty — no conversation body | Tap a conversation in the list. Compose a new one with the button top-left. |
| Loading — skeleton aria | Loading conversation… |
| Load-error — banner | Couldn't load this conversation. Retry? |
| Older-messages loader | Load older messages |

Copy voice: **operational, calm, action-oriented.** Match AGT-INB-001. Zero exclamations. Never cutesy. Numerics always in `<Numeric>`. Do NOT congratulate the agent for sending a message.

---

## Component palette

| Element | Primitive | Notes |
|---|---|---|
| Page shell (mobile route) | `CrmShell` from `web/src/components/layout/CrmShell.tsx` | Reuse — provides bottom-tab-bar visibility toggle (hidden on mobile when keyboard open) |
| Split-panel layout (tablet/desktop) | New `InboxLayout` wrapper in `web/src/pages/InboxLayout.tsx` | Renders `<InboxListPage>` + `<InboxConversationPage>` + `<ContactContextPanel>` in a three-column flex grid; on tablet drops the third column into a drawer |
| Conversation header | New `<ConversationHeader>` in `web/src/components/inbox/ConversationHeader.tsx` | New |
| Dual badge row | Reuse `<ChannelMark>` + `<SourceMark>` from AGT-INB-001 palette | Reuse |
| Related-listing card | New `<RelatedListingCard>` in `web/src/components/inbox/RelatedListingCard.tsx` | New — small variant of the listing card from AGT-LST-001 |
| Message thread container | New `<MessageThread>` in `web/src/components/inbox/MessageThread.tsx` | New — handles pagination, day grouping, scroll pinning |
| Message bubble | New `<MessageBubble>` in `web/src/components/inbox/MessageBubble.tsx` | New — direction-aware, delivery-status-aware, portal-source-chip-aware |
| Portal-source chip | New `<PortalSourceChip source={s}>` in `web/src/components/inbox/PortalSourceChip.tsx` | New — teal accent chip with boundary |
| Media attachment (image) | New `<MediaAttachment type="image">` in `web/src/components/inbox/MediaAttachment.tsx` | New — plus lightbox `<Dialog>` |
| Media attachment (pdf/doc) | Same component, `type="document"` variant | Reuse `<Card>` |
| Media attachment (audio) | Same component, `type="audio"` variant | Uses `<audio>` element + custom waveform SVG |
| Media attachment (video) | Same component, `type="video"` variant | Uses `<video>` element + `<Dialog>` |
| Day-group separator | New `<DayGroupSeparator>` in `web/src/components/inbox/DayGroupSeparator.tsx` | New |
| System bubble | New `<SystemBubble>` in `web/src/components/inbox/SystemBubble.tsx` | New |
| AI suggested-reply chip row | New `<AISuggestedReplyRow>` in `web/src/components/inbox/AISuggestedReplyRow.tsx` | New |
| Compose bar | New `<ComposeBar>` in `web/src/components/inbox/ComposeBar.tsx` | New — the biggest new primitive of this screen |
| Attachment picker sheet | `<Sheet>` (mobile) / `<Popover>` (desktop) wrapped in `<AttachmentPicker>` | New |
| Template picker sheet | `<Sheet>` / `<Popover>` wrapped in `<TemplatePicker>` | New — reuses AGT-TPL data source |
| Voice-to-text recorder | New `<VoiceDictationButton>` | New — abstraction over Capacitor + Web Speech |
| Send button | `<Button variant="default">` from `web/src/components/ui/button.tsx` | Reuse |
| Character counter | New `<CharacterCounter>` in `web/src/components/inbox/CharacterCounter.tsx` | New — wraps `<Numeric>` with threshold styling |
| Header action menu | `<DropdownMenu>` from Radix | Reuse |
| Assign popover | `<Popover>` — content specified in AGT-INB-004 | Reuse |
| Snooze popover | `<Popover>` — same as AGT-INB-001 bulk snooze | Reuse |
| Archive dialog | `<Dialog>` (destructive) — same as AGT-INB-001 bulk archive | Reuse |
| Contact context panel (desktop only) | `<ContactContextPanel>` — spec'd in AGT-CTC-002 | Reuse |
| Lightbox | `<Dialog>` with pinch-zoom | Reuse |
| Toast | `useToast` from `@/components/ui/toast` | Reuse |

**Icons:** `lucide-react`. Channel/source marks reuse the official-provider SVGs from AGT-INB-001.

---

## Sample content (for v0 / mockup)

Render THREE states across viewports:

### State 1 — Mobile 375px LTR light, mid-conversation with portal source

Sara replying to Ahmed Al-Mansoori from the AGT-INB-001 sample. WhatsApp channel · Bayut source · related listing (JVC 1BR).

Header:
- Ahmed Al-Mansoori
- +971 5** ***4567 · a***@example.com  (lock glyph on both)
- `MoreVertical` on the right

Context strip:
- `<ChannelMark channel="whatsapp">` · `<SourceMark source="bayut">`
- `From your Bayut listing dated 2026-09-01` (link-styled)
- Related-listing card: JVC 1BR · AED 1,150,000 · 1 bed · 2 bath · 720 sqft

Thread (top-to-bottom, 4 messages spanning today):
1. Inbound bubble with portal-source chip `FROM BAYUT`: `Hi, is the JVC 1BR still available? I saw it on Bayut.` — 8:12 AM
2. Outbound bubble: `Yes, it's available. Would you like to schedule a viewing?` — 8:14 AM · ✓✓ Read
3. Inbound bubble: `Yes, Saturday morning if possible.` — 8:18 AM
4. Inbound bubble (grouped, same group as 3): `Around 10?` — 8:18 AM

AI chips (opt-in ON): `Sure, 10am works. Where should I meet you?` · `10am Saturday confirmed. I'll share the location.` · `Let me confirm the seller's availability and get back to you.` · `RefreshCw`

Compose bar: empty text area with placeholder `Reply to Ahmed…`; icons in place; Send button disabled (dim orange).

Bottom-tab-bar visible below the compose bar (mobile shell).

### State 2 — Desktop 1440px LTR light, three-panel, composing with counter warning

Agent typing on SMS channel; message is 148 characters (92% of SMS 160 max).

- Left panel (280px): conversation list, current row selected with orange left-border.
- Middle panel (flex-1): conversation detail for `Layla Khoury · SMS · Widget`.
  - Header 64px: name + phone + email + dual badge (`SMS` red · `Widget` neutral) + `MoreVertical`.
  - Thread showing 2 inbound messages and 1 outbound.
  - No portal-source chip (Widget source is not a portal per the sample content mapping; the meta line reads `via SMS`).
  - AI chips OFF (agent has the pref off).
  - Compose bar: text area shows `Sure, I can send you the details for the Marina 2BR — it's a great option in your budget. Give me one m` — counter reads `148 / 160` in warning color; sub-line `1 segment`.
- Right panel (320px): contact context — Layla's avatar + tags + assigned agent + stage.

Keyboard shortcuts overlay hidden.

### State 3 — Mobile 375px RTL Arabic dark, offline queued send

Agent Ahmed (agency member) trying to reply to a WhatsApp conversation while offline. UI is RTL, dark mode.

- Header 56px mirrors: `ArrowRight` on the right, `MoreVertical` on the left, name + sub-line centered.
- Dual badge row mirrors: source on the left, channel on the right.
- Offline banner across the top of Zone 2: `أنت غير متصل. سيتم إرسال الرسائل عند عودة الاتصال.` `[TRANSLATION-PENDING]`
- Thread renders with a queued outbound bubble at the bottom: `Clock` glyph in the meta line + Arabic time.
- Compose bar: Send button label changed to `Queue` `[TRANSLATION-PENDING]`.

---

## Interactions & gestures

- **Tap message bubble** — no default action (avoids conflicting with text selection). Long-press → context menu: `Copy text`, `Reply` (quotes the message in the compose field), `Forward` (opens AGT-INB-003 with the message pre-loaded), `Delete for me` (soft-hides locally — outbound messages that were already delivered can't be un-sent).
- **Tap media attachment (image / video)** — opens lightbox `<Dialog>`.
- **Tap media attachment (document / audio)** — plays audio in-line, or downloads document with permission prompt.
- **Tap channel badge** — filters `/inbox` to that channel on next visit.
- **Tap source badge** — filters `/inbox` to that source on next visit.
- **Tap portal-source chip on first inbound bubble** — filters `/inbox` to that source on next visit.
- **Tap attribution line** (when `source_url` present) — opens the portal listing in a new tab.
- **Tap related-listing card** — opens listing detail (AGT-LST-012) in a new tab.
- **Pull DOWN at top of thread** — loads previous 40 messages. Scroll position preserved via anchor offset.
- **Tap compose field** — focuses field; on mobile, keyboard opens; bottom-tab-bar hides.
- **Tap AI chip** — inserts chip text into compose field; chip fades out; scroll pins compose to visible.
- **Tap AI regenerate** — refetches chips; button shows `Loader2`.
- **Tap Send** — sends via channel adapter dispatch; bubble appears optimistically with `Clock` (queued) then transitions to `Check` (sent) → `CheckCheck` (delivered) → `CheckCheck` colored (read) via webhook updates from the adapter.
- **Tap Failed bubble Retry** — retries send with the same body / attachments.
- **Header `MoreVertical`** — opens action menu.
- **Keyboard shortcuts (desktop Pro)** — see §Layout desktop keyboard list.
- **Swipe LEFT on bubble (mobile)** — reveals `Reply` (quote-reply) affordance in a small tray under the bubble; long-swipe triggers reply directly.
- **Poll every 8s while visible** — silently refetches new messages; new inbound bubbles slide in at the bottom with `--lc-accent-bold` left highlight for 3s, then decay. Auto-scrolls to bottom ONLY if the user was within 80px of the bottom before the poll landed (respects the user's scroll position).
- **Delivery status webhook** — updates outbound bubble meta lines in-place without a full refetch. Uses the same 8s poll for now (Phase-2: WebSocket subscription at `/ws/inbox/:conversationId`).

---

## State variants

| Variant | Trigger | Behavior |
|---|---|---|
| **Loading first-load** | Route mounted, no cache | Skeleton header (avatar + two lines) + 4 skeleton bubbles alternating direction + skeleton compose bar. |
| **Loaded — empty-new-conversation** | Conversation just created (from AGT-INB-003 compose flow) — no messages yet | Header + context strip render. Thread shows a centered `<CmdEmptyState>`: `Start the conversation — say hi.` in `--lc-text-muted`. Compose bar focused by default; virtual keyboard opens on mobile. |
| **Loaded — thread-with-messages** | Normal case | Full render per §Layout. |
| **Sending** | Send tapped, awaiting adapter ack | Optimistic bubble appended with `Clock` glyph; compose field disabled; Send button `Loader2`; text area returns to enabled after 200ms with cleared value. |
| **Send-success** | Adapter ack | Bubble transitions `Clock` → `Check`; no toast. |
| **Send-error** | Adapter reject or timeout (10s) | Bubble transitions to `AlertCircle` state + `Retry` affordance; toast: `Couldn't send — check your connection or the channel adapter status.` Meter is NOT charged for a failed send. |
| **Offline-with-queue** | Network unreachable at send time | Bubble appended with `Clock` glyph; Send button label becomes `Queue`; persistent banner at top of Zone 2: `You're offline. Messages will send when connection returns.` On reconnect, the queue flushes via existing `POST /api/conversations/:id/messages` calls in order; bubbles transition `Clock → Check`. |
| **AI-chips loading** | Regenerate tapped or chips fetching on thread open | Regenerate icon shows `Loader2`; chips render as 3 pulsing skeletons at `--lc-surface-raised` bg + `--lc-border` outline. |
| **AI-chips off** | Preference off | Zone 4 does not render; compose bar sticks directly to top of Zone 5's slot. |
| **AI-chips no-context** | Last message is outbound OR compose field has text OR conversation just started | Zone 4 does not render; if chips were rendered and now context flips, row collapses with `--lc-duration-fast`. |
| **Load-error** | GET conversation 5xx | Banner across Zone 2: `Couldn't load this conversation. Retry?` with retry button. Header still renders from cached list data. |
| **Load-error partial** | GET messages 5xx (but conversation loaded) | Header + context render; thread shows an error state: `Couldn't load the message history. Retry?` |
| **Older-messages loading** | Pull-down at top | Sticky loader at top of thread; `Loader2` + `Loading older messages…`. |
| **No older messages** | Pagination cursor exhausted | Loader replaced by a subtle divider: `This is the start of the conversation.` |
| **Voice-dictation active** | Mic tap started | `Mic` → `MicOff`; accent-bold pulsing dot next to icon; live transcript appends. |
| **Voice-dictation permission denied** | Mic permission denied by OS | Inline toast under compose: `Microphone access needed for voice dictation.` |
| **Template picker open** | Template button tapped | Sheet/popover per device; if template channel-mismatch, warning appears in the sheet before insertion. |
| **Attachment queued** | Attachment picked | Thumbnail strip appears above text area; each thumb has an `X` remove button. |
| **Attachment upload in-flight** | Send tapped with attachments | Thumb overlays a `Loader2`; on complete, the sent bubble shows the media inline. |
| **Attachment upload failed** | Upload 4xx/5xx | Thumb overlays `AlertCircle`; toast: `Couldn't upload {filename}. Retry?` |
| **Character-limit exceeded** | Text length ≥ channel max | Counter red; Send disabled; sub-line: `Message exceeds {channel} limit.` |
| **Related-listing missing** | Conversation has `related_listing_id` but listing was deleted | Related-listing card renders as: `The related listing is no longer available.` in `--lc-text-muted`, no thumbnail. |
| **Contact opted out** | Contact hit STOP on WhatsApp / SMS / marked email spam | System bubble appears: `Contact opted out of {channel}.` Compose bar disabled with sub-line: `You can't send on {channel}. Try {other channel}?` Send button disabled. |
| **Assignment change (agency)** | Assign action succeeds | System bubble: `Assigned to {agent_name}`. Header does not visibly change (assignee lives in the contact context panel). |

---

## Accessibility

- WCAG 2.1 AA throughout.
- Thread renders as an `aria-live="polite"` region so screen readers announce new inbound messages.
- Each message bubble carries an accessible name: for inbound, `{contact_name} at {time}: {message text}`; for outbound, `You at {time}, {delivery_status}: {message text}`.
- Portal-source chip has `aria-label`: `Arrived via {channel} from {source} listing`.
- Media attachments carry an `alt` (images) or `aria-label` (video/audio/document) describing the content or filename.
- Character counter has `aria-live="polite"` and announces `{used} of {max}` only when threshold changes (80% / 90% / 100%) — not on every keystroke.
- Send button `aria-disabled` when disabled; `aria-busy` while sending.
- Voice-to-text state announced: `Recording started` / `Recording stopped`.
- Reduced motion: bubble entry animations become instant; new-message slide-in becomes fade-in; voice-dictation pulsing dot becomes static.
- RTL: bubble alignment mirrors; delivery glyphs stay to the RIGHT of the meta line (they are language-neutral); text within bubbles inherits the message's own detected direction (Arabic inbound stays RTL even in an English UI, and vice versa) via `dir="auto"` on the bubble body.
- Keyboard-only path: `Tab` cycles header → context links → messages (arrow-keys within thread to move between bubbles) → AI chips → compose bar buttons → text area. `⌘Enter` sends. `Esc` exits the thread on mobile (equivalent to back).
- Focus visible everywhere via the two-tone Broadcast ring.
- Every icon-only button has an `aria-label`.

---

## Anti-patterns — do NOT do

- ❌ Do not collapse the channel + source dual badge in the header. Same lock as AGT-INB-001 — this is AGT-INB-005 treatment applied at both surfaces.
- ❌ Do not render outbound bubbles in orange without the `-text` ink on top — that's a Broadcast contract violation and produces WCAG failures.
- ❌ Do not use color-alone delivery status. Every state has a distinct glyph plus color plus label.
- ❌ Do not auto-send AI-suggested reply chips. Tap inserts into compose — the human presses Send.
- ❌ Do not display a raw character number without `<Numeric>`. Counter always tabular-nums.
- ❌ Do not swallow the character counter on WhatsApp (max 4096) — it renders at 80% just like SMS. Consistency across channels is the point.
- ❌ Do not remove the compose bar when the contact opted out. Disable it with a clear explanation; provide a "Try another channel?" affordance.
- ❌ Do not offer a "Delete for everyone" affordance. Outbound messages cannot be un-sent through the channel adapters WingCaster uses; the affordance would lie.
- ❌ Do not auto-scroll to bottom on new inbound messages when the user has scrolled up to read history. Only auto-scroll when the user was within 80px of the bottom.
- ❌ Do not include a "typing indicator" that we don't have adapter support for. WA / SMS don't broadcast typing; showing a fake one is a lie. If it's implemented at all, it's an outbound-only "you are typing" leak from us to the contact via the adapter, and that requires a separate scope discussion.
- ❌ Do not use the signal-lamp motif anywhere except the voice-dictation active state. It's the second (and only other) legal use outside "listing went live" per Broadcast; no third slot.
- ❌ Do not leak the contact's phone or email into the browser-tab title. Title stays `Inbox · WingCaster`.
- ❌ Do not fabricate delivery states. If the adapter only tells us `sent`, don't show `delivered` speculatively — the glyph reflects the last confirmed state.
- ❌ Do not persist the compose draft server-side in Guided mode. Local `sessionStorage` only; server draft is a Pro-mode affordance.
- ❌ Do not render the AI chip row when the last message is outbound. There is nothing to suggest a reply to.
- ❌ Do not include Blue Door anywhere as a source. Same PORTAL-LIST-LOCK 2026-09-06 removal as AGT-INB-001.

---

## Reference designs

Draw structural cues from — do NOT copy 1:1:

- **WhatsApp Web** — bubble anatomy, delivery-status glyph vocabulary, day-group separators, voice-note UX. But: WhatsApp Web is single-channel; WingCaster is multi-channel, so add the header dual badge + portal-source chip.
- **Intercom conversation** — AI-suggested-reply chips above the compose, three-panel desktop layout, template picker patterns.
- **Front conversation** — team-inbox affordances (assign in header, comment thread — out of scope for this brief but relevant to AGT-INB-004), delivery-status semantics.
- **Superhuman** — keyboard shortcuts, undo semantics, `⌘Enter` send, draft persistence.
- **iMessage** — bubble radius rule (leading vs trailing corner squared), grouping-within-90-seconds rule.
- **Missive** — multi-channel bubble labeling (`via WhatsApp` / `via Email` badge inside the meta line).

Do NOT match:

- **Slack** — threaded replies + emoji reactions are the wrong metaphor for a per-channel sales conversation.
- **Zendesk** — ticket-shaped chrome (tags, priority, macros) is too corporate.
- **The old `InboxPage.tsx` inline thread** — the current implementation collapses channel+source into one badge, has no portal-source chip, no character counter, no AI chips, and does not extract into a routable page.

---

## Backend contract

**Existing endpoints (from `web/src/api/client.ts` — inventoried; NOT re-listed exhaustively here):**

- `GET /api/conversations/:id` → conversation with related-listing pointer.
- `GET /api/conversations/:id/messages?cursor=&limit=40` → paginated newest-first message list. Response items include: `id`, `direction` (`inbound` / `outbound` / `system`), `body`, `attachments[]`, `channel` (post-BE-BLOCKER-04), `sent_at`, `delivery_status`, `sender_id`.
- `POST /api/conversations/:id/messages` → `{ body, attachments?: [{ url, mime, filename }], template_id?, in_reply_to_message_id? }`. Returns the created message. The backend routes to the channel adapter dispatcher (`backend/src/services/channel-dispatch.js`) based on the conversation's `channel`.
- `PATCH /api/conversations/:id` → updates `{ status?, assigned_agent_id?, snoozed_until?, archived_at?, draft? (Pro) }`.
- `POST /api/conversations/:id/assign` → assign to another agent.
- `POST /api/conversations/:id/messages/:messageId/retry` → retry a failed send.

**Backend surfaces this brief REUSES rather than needing new — the three "feature" additions of this brief (channel-max character counter, template picker, AI-suggested-reply chips) are all layered on existing endpoints, not new ones:**

- **Character counter** — pure client-side computation. The channel-max map is a static constant table in `web/src/lib/channel-limits.ts` (new file, small); no backend involvement. SMS segmentation logic is also client-side (checks for non-GSM-7 characters via a regex). Backend is not consulted per keystroke.
- **Template picker** — uses the existing AGT-TPL data source (`GET /api/message-templates?channel=` already exists per SCREEN_MATRIX AGT-TPL-001; if it doesn't, that's an AGT-TPL scope not this brief's). Template substitution (`{contact.first_name}` etc.) is client-side using the already-loaded conversation + contact context.
- **AI-suggested-reply chips** — needs one endpoint that MAY be new depending on whether `POST /api/conversations/:id/ai-suggestions` already exists. If not: `POST /api/conversations/:id/ai-suggestions` → `{ suggestions: string[] }` returning up to 3 draft replies based on the last inbound message + conversation history + related listing. Backend implementation is out of scope for this brief (belongs in the AI service module); this brief just specifies the client contract. **This is the ONE possibly-new endpoint of AGT-INB-002.**

**Response addition (per message):**

```json
{
  "id": "msg_...",
  "conversation_id": "conv_...",
  "direction": "inbound",
  "channel": "whatsapp",              // per BE-BLOCKER-04 split
  "body": "Hi, is the JVC 1BR still available?",
  "attachments": [
    { "id": "att_...", "url": "https://...", "mime": "image/jpeg", "filename": "floorplan.jpg", "size_bytes": 240123 }
  ],
  "sent_at": "2026-09-08T08:12:00Z",
  "delivery_status": "delivered",      // sent | delivered | read | failed | queued (outbound only)
  "delivery_status_updated_at": "2026-09-08T08:12:03Z",
  "sender_id": null,                   // agent_id for outbound; null for inbound
  "is_first_inbound": true,            // NEW — flags the message to render the portal-source chip
  "reply_to_message_id": null,
  "system_event_type": null            // "assigned" | "snoozed" | "closed" | "reopened" | "archived" | "merged" | "opted_out"
}
```

**Delivery-status webhook flow (existing):** channel adapters (`backend/src/services/channel-dispatch.js`) POST to `/webhooks/{provider}` with status updates; those updates land in `messages.delivery_status` and are read on the 8s poll. No new webhook surface for this brief.

**Real-time updates (Phase-2):** WebSocket at `/ws/inbox/:conversationId` per-tenant. For Phase-1, 8s polling is the baseline (matches AGT-INB-001).

---

## Downstream implementation

- **New page:** `web/src/pages/InboxConversationPage.tsx` — mounted at `/inbox/:conversationId`.
- **New layout wrapper:** `web/src/pages/InboxLayout.tsx` — the split-panel parent that renders `<InboxListPage>` + `<InboxConversationPage>` + `<ContactContextPanel>` on tablet/desktop. On mobile, only one of {list, detail} renders based on the current route.
- **File to refactor:** `web/src/pages/InboxPage.tsx` — the monolithic three-panel is deprecated in favor of the split above. The refactor is coordinated with the AGT-INB-001 landing.
- **New components** (all under `web/src/components/inbox/`):
  - `ConversationHeader.tsx`
  - `MessageThread.tsx`
  - `MessageBubble.tsx`
  - `PortalSourceChip.tsx`
  - `MediaAttachment.tsx` (with subvariants for image / document / audio / video)
  - `DayGroupSeparator.tsx`
  - `SystemBubble.tsx`
  - `AISuggestedReplyRow.tsx`
  - `ComposeBar.tsx`
  - `AttachmentPicker.tsx`
  - `TemplatePicker.tsx`
  - `VoiceDictationButton.tsx`
  - `CharacterCounter.tsx`
  - `RelatedListingCard.tsx`
- **New client library:** `web/src/lib/channel-limits.ts` — static table of channel max character counts + SMS segmentation helper.
- **New API client methods** in `web/src/api/client.ts`:
  - `getConversationMessages(id, cursor?, limit=40)`
  - `sendConversationMessage(id, body, attachments?, templateId?, replyToId?)`
  - `retryConversationMessage(id, messageId)`
  - `fetchAISuggestions(id)` (only if the AI endpoint lands; otherwise gate the component behind `agent_preferences.ai_suggested_replies && agent_preferences.ai_suggestions_endpoint_available`)
  - `saveConversationDraft(id, draft)` (Pro mode)
- **State management:** local state via `useState` for the compose field + attachments + AI chips; server state via `@tanstack/react-query` — the conversation + messages queries reuse the same key pattern as AGT-INB-001. Polling via `refetchInterval: 8000` while the tab is focused; disabled when hidden.
- **Draft persistence:** `sessionStorage.inbox_draft_{conversationId}` on every keystroke (300ms debounce), cleared on successful send. Pro mode ADDS `PATCH /api/conversations/:id` with `{ draft }` every 3s.
- **Attachment upload:** existing `POST /api/uploads` endpoint returns `{ url, mime, filename, size_bytes }`. Attachments are uploaded on `Send` tap, not on pick — the compose queue holds `File` objects locally until send.
- **Voice-to-text:** wrap Capacitor Speech Recognition + Web Speech API in `VoiceDictationButton.tsx`; feature-detect at mount time and hide the button on desktops without support.
- **i18n:** `web/src/i18n/en/inbox.json` + `web/src/i18n/ar/inbox.json` — extended with the copy table above.
- **RTL:** logical properties (`ms-*` / `pe-*`) throughout; bubble alignment computed from `direction === 'inbound' ? 'start' : 'end'` mapped through the `dir`; delivery glyphs stay on the trailing edge of the meta line regardless of language.
- **Test discipline:**
  - Unit: `<MessageBubble>` renders every direction × delivery-status combination; `<CharacterCounter>` transitions across thresholds for SMS + WhatsApp; `<PortalSourceChip>` only renders on `is_first_inbound === true` with a non-direct/non-unknown source.
  - Integration: send happy path (compose → send → optimistic bubble → adapter ack → status update); send failure path (adapter reject → Failed bubble → Retry → success); offline queue (mock offline → queued bubble → reconnect → flush).
  - Media: image / PDF / audio / video attachment upload + display.
  - AI chips: mocked endpoint returns 3 chips; tap inserts into compose without sending; regenerate refetches.
  - Real-Postgres: seed a 3-message conversation, hit `POST /messages`, assert row inserted + adapter dispatched (mocked); simulate a delivery-status webhook update and assert the poll picks it up.
  - Broadcast tokens: `no-raw-hex.test.ts` green.
  - RTL: `screens.rtl.test.tsx` extension asserts bubble alignment mirrors + delivery glyph stays trailing + compose icons mirror.
  - Accessibility: axe-core on the header + thread + compose bar; keyboard-navigation test hits reply → send.

---

## Broadcast alignment callouts (final checklist)

Every callout below is a Broadcast-token-specific instruction the downstream implementation MUST honor. Non-negotiable.

- Header background `--lc-surface-raised`, bottom border `1px solid --lc-border`.
- Thread container background `--lc-surface-sunken` (deeper well).
- Inbound bubble `--lc-surface-raised` + `--lc-border` outline; outbound bubble `--lc-action-primary` fill + `--lc-action-primary-text` ink.
- Bubble radius `--lc-radius-lg` with leading/trailing corner squared to `--lc-radius-sm`.
- Portal-source chip `--lc-accent-bold` fill + `--lc-accent-bold-text` ink + `--lc-accent-bold-edge` 1px boundary (accent-bold always with a boundary).
- Delivery-status glyphs — `Check` / `CheckCheck` / `AlertCircle` / `Clock` in `--lc-text-muted` / `--lc-accent-bold-edge` / `--lc-status-danger-fg` per state.
- System bubble no fill, no border; `var(--lc-type-caption)` in `--lc-text-muted`.
- Day-group separator pill `--lc-surface-raised` + `--lc-border` + `--lc-radius-pill`.
- AI chip row background `--lc-surface-sunken`; chips `--lc-surface-raised` + `--lc-border-strong` + `--lc-radius-pill` + leading `Sparkles` in `--lc-text-brand`.
- Compose bar background `--lc-surface-raised`; top border `1px solid --lc-border`; UPWARD-pointing `--lc-elevation-sm`.
- Compose text area background `--lc-surface-sunken` + `--lc-radius-lg`.
- Send button `<Button variant="default">` — primary orange; hover DARKER not lighter.
- Character counter thresholds via `--lc-text-muted` → `--lc-status-warning-fg` → `--lc-status-danger-fg`.
- Voice-dictation active-state pulsing dot: `--lc-accent-bold` fill with a `--lc-focus-ring-contrast` outer ring (white outline over orange context, teal over neutral).
- Two-tone focus ring automatic via base CSS.
- Motion: bubble entry `--lc-duration-fast` + `--lc-easing-out`; new-message highlight decay `--lc-duration-slow`; AI-chip row collapse `--lc-duration-fast`; compose bar grow `--lc-duration-base`.

---

## Handoff instruction to v0

Paste this brief in full into a fresh v0.app chat. Framing prompt (paste before this brief):

```
I'm designing the WingCaster Conversation detail screen (AGT-INB-002) — the "Reply" surface
of a MENA real-estate B2B SaaS. It is the delta from the AGT-INB-001 unified inbox list
(you can reference that brief for the row anatomy, channel+source dual-badge treatment, and
Broadcast tokens). Stack: React 18 + shadcn/ui + Radix + lucide-react + Tailwind.

Critical design constraints:
1. Channel (transport — WhatsApp/Email/SMS/IG DM/etc.) and source (origin — Direct/Bazaar/
   Bayut/Property Finder/OLX/Dubizzle/etc.) are TWO independent attributes. Both render in
   the header and the FIRST inbound message carries a portal-source chip on the bubble.
2. Every outbound message has a delivery-status glyph — sent / delivered / read / failed /
   queued — using distinct glyphs (Check / CheckCheck / AlertCircle / Clock) plus color.
   Never color-alone.
3. The compose bar has a character counter that warns at 80%, alerts at 90%, blocks at 100%
   of the channel's max. SMS 160 (segmented), WhatsApp 4096, etc.
4. AI-suggested-reply chips (up to 3) sit above the compose bar. Tap INSERTS into compose;
   never auto-sends.

First pass: render the mobile 375px LTR light layout — State 1 in the sample content (Sara
replying to Ahmed Al-Mansoori from Bayut, mid-conversation, AI chips on, compose empty).

LTR English only for this pass — I'll ask for RTL Arabic, tablet split-panel, desktop
three-panel, dark mode, offline-queued send, send-failed, and empty-new-conversation as
separate follow-ups.

Follow the copy table in the brief exactly. Use the exact channel + source values from
AGT-INB-001's row anatomy. Do not include Blue Door.

DESIGN BRIEF FOLLOWS:
```

Iteration order after first pass:
1. `Now desktop 1440px three-panel with SMS composition at 148/160 chars — counter in warning color.`
2. `Now RTL Arabic dark mode with an offline-queued outbound message.`
3. `Now the send-failed state — the last outbound bubble shows AlertCircle + Retry.`
4. `Now the empty-new-conversation state — conversation just created via AGT-INB-003, no messages yet.`
5. `Now the tablet 768px split-panel — left panel with the list, right panel with this thread.`
6. `Now the voice-dictation active state on mobile with the pulsing teal accent dot next to the Mic icon.`

Save each output's JSX to `docs/design/mockups/v0-outputs/AGT-INB-002/` + screenshots to `docs/design/mockups/AGT-INB-002-<state>.png`.

---

## Definition of done for this brief

- [ ] `[BE-BLOCKER-04]` `conversations.source_channel` decomposition landed (inherited from AGT-INB-001; Week 4 slot per kickoff §5a).
- [ ] `messages.is_first_inbound` boolean added to message response (or computed client-side from position).
- [ ] `POST /api/conversations/:id/ai-suggestions` implemented OR the AI chip component gated behind a feature flag.
- [ ] `POST /api/conversations/:id/messages/:messageId/retry` implemented if not already.
- [ ] `web/src/lib/channel-limits.ts` static table added with the channel-max values.
- [ ] `<VoiceDictationButton>` wraps Capacitor + Web Speech with locale awareness.
- [ ] v0 has produced all 7 iteration states.
- [ ] Screenshots committed under `docs/design/mockups/`.
- [ ] JSX exports committed under `docs/design/mockups/v0-outputs/AGT-INB-002/`.
- [ ] Cursor Week-8+ dispatch prompt references this brief + the mockup paths + the AGT-INB-001 anchor.
- [ ] AGT-INB-003 (compose new) brief drafted next; AGT-INB-004 (assign) brief drafts a delta from THIS brief's header action menu.
