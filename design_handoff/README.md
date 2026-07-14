# Handoff: SWAN — Strategic Warning & Alert Network (Phase 1)

## Overview
SWAN is AGL's internal web app for centralizing disruption awareness across its logistics network (ports, corridors, borders — Africa-focused). Phase 1 covers the core flow: **login → live world map dashboard → live feed → alert creation → approval/publication → user profile**. This handoff contains the approved hi-fi design direction ("Ops Deck" — immersive full-bleed map with floating glass panels) plus the full functional spec book.

## About the Design Files
The files in this bundle are **design references created in HTML** — they show intended look and behavior, they are NOT production code to copy directly. The task is to **recreate these designs in the target codebase's environment** (React, Vue, etc.) using its established patterns and libraries. If no environment exists yet, choose the most appropriate stack (a React + map-library setup — e.g. MapLibre GL / Mapbox GL — is the natural fit for the live map).

Note: the map in the mockups is a **stylised SVG placeholder**. In production it must be a real interactive map (pan/zoom, clustered markers) in a muted dark-blue style matching the mock (`#0B1729` sea, `#1E3556` land, `#2C4A76` coastline).

## Fidelity
**High-fidelity.** Colors, typography, spacing, radii, and copy are final design intent. Recreate pixel-perfectly using the codebase's component patterns. The spec book (`swan_spec_v2.md`, included) is the source of truth for functionality; the mocks are the source of truth for visuals.

## Files
- `SWAN Design Explorations.dc.html` — the design source. The **top section (badge "2a") is the approved unified direction** with all 6 screens. Each screen is a 1440×900 frame with a `data-screen-label` attribute. All styling is inline on the elements — exact values can be read directly from the markup. **Read it as source code** — it is a design-tool file and is not meant to be opened in a browser (its preview runtime is intentionally not included in this bundle).
- `screenshots/` — 1440×900 PNG renders of all 6 screens (00-login → 05-my-profile), the visual ground truth alongside the markup.
- `swan_spec_v2.md` — full platform specification book (personas, rights model, alert data model, workflows, phases).
- `assets/agl-logo-white.svg` — AGL logo (white variant, for dark chrome).

## Screens / Views

All screens: 1440×900 design canvas, dark chrome. Base background `#0D1B30`; map sea gradient `#13253F → #0B1729`.

### 00 · Login (`data-screen-label="2a Login"`)
- **Purpose**: SSO-only entry. No password form — single "Sign in with your AGL account" action.
- **Layout**: dimmed map backdrop (overlay `rgba(8,14,26,.45)`), centered glass card 420px wide, radius 22px, `rgba(15,27,46,.88)` + `backdrop-filter: blur(20px)`, border `rgba(255,255,255,.14)`, padding 44/40.
- **Components**: AGL logo (h44) → wordmark "SWAN" (Space Grotesk 700 26px, letter-spacing 6px) → subtitle (IBM Plex Sans 12.5px, 55% white) → primary SSO button: 50px tall pill, bg `#EED58E`, text `#1B365F` Space Grotesk 600 14px, glow shadow `0 4px 18px rgba(238,213,142,.35)` → helper text "Single sign-on · no separate password" → divider → live teaser "14 active alerts on the network right now" with pulsing yellow dot.
- Footer line: "Internal AGL tool · access is governed by location-based publication rights · all actions are audited".

### 01 · Map dashboard (`data-screen-label="2a Map dashboard"`)
- **Purpose**: home screen; live world map with severity-coded, count-badged alert markers; selected alert opens the detail panel.
- **Layout**: full-bleed map. Floating elements: top bar (68px, gradient scrim), left icon rail (56px wide glass, x:20 y:88), stat strip (glass cards at x:100 y:88), alert detail panel (right, 380px wide, y:88→bottom-20), severity legend pill (bottom-left), live status pill (bottom, right of legend area).
- **Top bar**: logo + divider + "SWAN" wordmark; right: search pill 380×42 ("Search country, city or port…"), primary "＋ Create alert" pill (`#EED58E`), avatar circle 38px.
- **Left rail** (all screens): glass `rgba(15,27,46,.8)` blur 14, radius 16. Icons 40×40 radius 12: Home, Live feed, Create, Search alerts, Approvals (orange badge count), Rights, divider, Settings. Active state: bg `rgba(238,213,142,.16)` + border `rgba(238,213,142,.3)`, icon stroke `#EED58E`; inactive stroke `rgba(255,255,255,.6)`.
- **Stat strip**: 4 glass cards (radius 16, `rgba(15,27,46,.82)` blur 14, padding 14/16): Active alerts (14), severity breakdown (1 critical + stacked severity bars), Awaiting your approval (3 — yellow accent border, clickable → approvals), Countries affected (8).
- **Map markers**: circular count badges — Critical `#CF4527` 32px with white 2.5px border, glow + pulse animation; Warning `#ED8C00` 26px; Watch `#EED58E` 24px (navy text); Info `#B2B4BE` 22px (navy text). Critical alert shows forecast cone polygon (dashed `rgba(207,69,39,.5)` outline, `.14` fill) + track line.
- **Alert detail panel**: radius 18, `rgba(15,27,46,.92)` blur 18. Header band 120px (navy gradient + track motif) with severity badge (CRITICAL, `#CF4527`) + category chip. Body: title (Space Grotesk 600 17px), chip row (modes ⚓🚛, flow, location — location chip in yellow accent), Impact + Reactive action plan sections (label: Space Grotesk 600 10.5px uppercase 45% white; body: IBM Plex Sans 12.5px/1.6 80% white), footer author row (avatar, name/office, timestamp, "2 sources ↗" link in `#EED58E`).

### 02 · Live feed (`data-screen-label="2a Live feed"`)
- **Purpose**: chronological list of every published alert on the network.
- **Layout**: blurred/dimmed map backdrop; one large glass panel (x:100→right-24, y:92→bottom-24, radius 18).
- **Panel header**: title "Live feed" + "Updated 2 min ago" pill (pulsing orange dot); right: scope chips **All alerts** (active, yellow) / **My perimeter**; divider; 4 severity-count chips (colored dot + count).
- **Body**: day groups ("Today", "Yesterday", "Earlier this week" — Space Grotesk 600 10.5px uppercase 40% white), each a 2-column card grid (gap 12).
- **Feed card**: radius 14, bg `rgba(255,255,255,.04)`, border `rgba(255,255,255,.09)`, **3px top border in severity color**, padding 16/18. Rows: severity·category badge (Space Grotesk 700 10px, letter-spacing 1px, severity text color) + time; title (Space Grotesk 600 14px/1.4); one-line summary (IBM Plex Sans 12px, 60% white); meta line (flag + location · modes · validity) + author right-aligned. Hover: bg `rgba(255,255,255,.07)`.

### 03 · Create alert (`data-screen-label="2a Create alert"`)
- **Purpose**: alert creation as a glass modal over the dimmed map. Template picker in header ("Seasonal port congestion — draft (2)" · or start blank).
- **Modal**: 920px wide, radius 20, `rgba(15,27,46,.97)`.
- **Fields** (labels IBM Plex Sans 600 11px 55% white; required mark `*` in `#ED8C00`; inputs 44–46px, radius 12, bg `rgba(255,255,255,.05)`, border `rgba(255,255,255,.14)`; focused input border `rgba(238,213,142,.5)` 1.5px):
  - Title* (text)
  - Category* / Sub-category* / Industry (selects)
  - Visible on map from* / Until (date; blank Until = "until further notice")
  - **Location block** (repeatable, "+ Add location"): Location* (geocoded place), Transport modes* (multi-select chips: ⚓ Sea, 🚛 Road, ✈ Air, 🚆 Rail, 🏭 WH — selected = yellow tint bg + border), Flow* (segmented Import/Export/Both, selected = solid `#EED58E`)
  - Business impact* / Global reactive action plan* (textareas)
  - Attachments dropzone (dashed border) + source URL field
- **Footer**: rights notice ("You don't hold publication rights for **Nigeria** — this alert will be routed for approval."), Cancel (ghost), Save draft (outline pill), **Submit for approval →** (primary yellow pill). If user HAS rights for all locations, primary becomes "Publish".

### 04 · Approval queue (`data-screen-label="2a Approval queue"`)
- **Purpose**: publisher reviews pending submissions in their perimeter.
- **Layout**: slide-over from the right, 820px, `rgba(12,21,38,.97)` blur 20, left border + `-30px 0 80px` shadow. Two columns: list (340px) + preview (flex).
- **List**: header "Approval queue" + "Your perimeter: WEST-AFRICA · 3 pending". Cards radius 14: category badge + age, title, meta (flag country · modes · author). Selected card: yellow tint bg + border.
- **Preview**: severity + category + "Submitted 2h ago" chips; title 20px; description 13px/1.65; Impact & Action plan in two side-by-side tinted cards; meta row; info note ("On publish you'll be asked to confirm content, then choose internal-only or internal + external variant."); actions: **✓ Internal publication** (primary yellow pill), **Edit then publish** (outline), **Reject with comment** (outline, `#E88E75` text + red border).
- **External publication dialog** (shown in mock over the queue page): 520px modal, radio options — "Yes — publish identical variant" / "Yes, with modification" / "No — internal only", then Back / **Confirm & publish**.

### 05 · My profile (`data-screen-label="2a My profile"`)
- **Purpose**: identity, activity, notification rules, read-only rights.
- **Layout**: blurred map backdrop; grid `360px | 1fr`, gap 16, inside x:100→right-24.
- **Left column**: identity card (avatar 76px with yellow ring, name Space Grotesk 600 18px, role/branch, role chip "Field Contributor" + country chip, email/phone/locale rows); Activity card (27 created / 21 published / last alert 2h ago); Email notifications card (toggle rows — on = yellow track, navy knob).
- **Right column**: "My rights" panel — read-only note chip; 2×2 rights cards (Creation / Internal publication / External publication / Client scope); "Internal publication perimeter" table (Location / Source / Internal / External — ✓ Publish in yellow, "Submit for approval" muted); audit note in yellow-tinted callout.

## Interactions & Behavior
- Marker click → detail panel slides in from right (translateX, ~250ms ease-out). Count badges cluster multiple alerts at one location; click zooms/expands.
- Critical markers pulse: expanding ring scale 1→2.2, opacity fade, 2.2s loop.
- "Create alert" → modal (fade + scale-in over dimmed map). Esc/✕ closes with confirm-if-dirty.
- Create form: rights check runs on location change — footer notice and primary CTA swap between "Publish" and "Submit for approval →" per the rights model in the spec (§ user rights).
- Drafts autosave; "Until" left blank displays "until further notice" everywhere.
- Approvals: publisher perimeter filters queue; Publish → external-publication dialog (3 options) → confirm.
- Live feed: scope chips (All / My perimeter) and severity chips filter cards; feed ordered newest first, grouped by day.
- Hovers: nav/rail items `rgba(255,255,255,.06)`; feed cards `rgba(255,255,255,.07)`; all buttons `cursor:pointer`.
- Live indicators (dots) use a soft opacity pulse (~2s loop).

## State Management
- Session user: identity, role, rights matrix (creation / internal-publication perimeter / external / client scope) — drives CTA routing, approvals badge count, perimeter filters.
- Alerts collection: status (draft / pending approval / published / closed), severity, category/sub-category, locations[] (each with modes + flow), visibility window, impact, action plan, attachments, sources, author, timestamps.
- UI state: selected alert (map ↔ detail panel), active nav item, feed filters, create-form draft (multi-location array), approval selection, external-publication choice.
- Real-time: feed + stat strip + markers should update live (poll or socket); "Updated N min ago" pill reflects last sync.

## Design Tokens
**Colors**
- AGL Navy (primary brand): `#1B365F`; deep chrome bg `#0D1B30`; sea `#0B1729`→`#13253F`; land `#1E3556`; coast `#2C4A76`
- Accent / primary action: `#EED58E` (yellow) — text on it always `#1B365F`
- Severity ramp: Info `#B2B4BE` · Watch `#EED58E` · Warning `#ED8C00` · Critical `#CF4527` (light text variant `#E88E75`)
- Glass panels: `rgba(15,27,46,.8–.97)` + `backdrop-filter: blur(12–20px)`, border `rgba(255,255,255,.10–.14)`
- Text: white at 100% / 80% / 65% / 55% / 45% / 40% opacities

**Typography**
- Display/headings/numbers/buttons: **Space Grotesk** (600–700) — wordmark 17px ls 2.5px; panel titles 16–17px; card titles 13–14px; stat numbers 24–26px; section labels 10–10.5px uppercase ls 1.2px
- Body/UI: **IBM Plex Sans** (400–600) — body 12.5–13px/1.6; meta 10.5–11px; field labels 11px

**Spacing & shape**
- Radii: pills = half height (buttons 42–50px); panels 18–22px; cards 12–14px; inputs 10–12px; rail icons 12px
- Panel padding 18–28px; floating-element margin from canvas edge 20–24px; gaps 6/8/10/12/14/16
- Shadows: panels `0 24px 60px rgba(0,0,0,.5)`; modals `0 40px 100px rgba(0,0,0,.6)`; yellow CTA glow `0 4px 18px rgba(238,213,142,.35)`

## Assets
- `assets/agl-logo-white.svg` — AGL logo, white variant (from the brand theme).
- Flags/mode glyphs are emoji in the mock — replace with the codebase's icon set if one exists.
- All other icons are inline 16px stroke SVGs (1.6px stroke) — simple line style, recreate or map to an equivalent icon library (e.g. Lucide).

## Spec Book
`swan_spec_v2.md` is included verbatim. It defines the full functional scope: objectives, personas, the four-dimension user-rights model, alert lifecycle (draft → submit → approve → publish internal/external → close), notification rules, audit requirements, and phasing. Where the mock and the spec conflict on functionality, the spec wins; on visuals, the mock wins. Phase 1 scope only — client-facing external portal is Phase 3 (but the external-variant choice at publication time IS Phase 1, stored for later delivery).
