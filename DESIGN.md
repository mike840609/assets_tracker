---
name: Assets Tracker
description: A native-feeling personal finance cockpit for net worth, holdings, history, goals, projections, and portfolio analysis.
colors:
  background: "oklch(0.99 0.003 260)"
  foreground: "oklch(0.15 0.02 260)"
  card: "oklch(1 0 0)"
  card-foreground: "oklch(0.15 0.02 260)"
  primary: "oklch(0.6 0.16 150)"
  primary-foreground: "oklch(0.98 0.005 150)"
  secondary: "oklch(0.96 0.01 260)"
  secondary-foreground: "oklch(0.2 0.02 260)"
  muted: "oklch(0.96 0.01 260)"
  muted-foreground: "oklch(0.55 0.02 260)"
  destructive: "oklch(0.6 0.18 20)"
  border: "oklch(0.9 0.02 260)"
  input: "oklch(0.9 0.02 260)"
  ring: "oklch(0.6 0.16 150)"
  sidebar: "oklch(0.98 0.005 260)"
  chart-1: "oklch(0.6 0.16 150)"
  chart-2: "oklch(0.65 0.12 210)"
  chart-3: "oklch(0.6 0.15 260)"
  chart-4: "oklch(0.7 0.15 300)"
  chart-5: "oklch(0.8 0.1 330)"
  gain: "{colors.chart-1}"
  loss: "{colors.chart-2}"
  app-icon-gradient-start: "#34d399"
  app-icon-gradient-end: "#065f46"
typography:
  display:
    fontFamily: "-apple-system, SF Pro Text, SF Pro Display, Geist, system-ui, sans-serif"
    fontSize: "2.25rem"
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "-apple-system, SF Pro Text, SF Pro Display, Geist, system-ui, sans-serif"
    fontSize: "1.875rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "0"
  title:
    fontFamily: "-apple-system, SF Pro Text, SF Pro Display, Geist, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 500
    lineHeight: 1.375
    letterSpacing: "0"
  body:
    fontFamily: "-apple-system, SF Pro Text, SF Pro Display, Geist, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "0"
  label:
    fontFamily: "-apple-system, SF Pro Text, SF Pro Display, Geist, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 500
    lineHeight: 1.25
    letterSpacing: "0"
  mono:
    fontFamily: "Geist Mono, ui-monospace, SF Mono, Menlo, monospace"
    fontSize: "0.875rem"
    fontWeight: 500
    lineHeight: 1.25
rounded:
  sm: "calc(0.75rem - 4px)"
  md: "calc(0.75rem - 2px)"
  lg: "0.75rem"
  xl: "calc(0.75rem + 4px)"
  2xl: "calc(0.75rem + 8px)"
  full: "9999px"
spacing:
  xs: "0.25rem"
  sm: "0.5rem"
  md: "0.75rem"
  lg: "1rem"
  xl: "1.5rem"
  2xl: "2rem"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
    rounded: "{rounded.lg}"
    height: "2rem"
    padding: "0 0.625rem"
    typography: "{typography.label}"
  button-outline:
    backgroundColor: "{colors.background}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.lg}"
    height: "2rem"
    padding: "0 0.625rem"
    typography: "{typography.label}"
  input-default:
    backgroundColor: "transparent"
    textColor: "{colors.foreground}"
    rounded: "{rounded.lg}"
    height: "2rem"
    padding: "0.25rem 0.625rem"
    typography: "{typography.body}"
  card-default:
    backgroundColor: "{colors.card}"
    textColor: "{colors.card-foreground}"
    rounded: "{rounded.xl}"
    padding: "1rem"
  badge-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
    rounded: "{rounded.full}"
    height: "1.25rem"
    padding: "0.125rem 0.5rem"
    typography: "{typography.label}"
---

# Design System: Assets Tracker

## 1. Overview

**Creative North Star: "The Native Ledger"**

Assets Tracker should feel like a private financial instrument that happens to live in the browser: native in motion, calm in color, and exacting with numbers. The system borrows heavily from iOS for mobile behavior, then becomes denser and more keyboard-friendly on desktop.

The visual atmosphere is restrained and breathable. The active color schema supplies the brand accent, chart family, gain/loss semantics, app icon gradient, and net-worth hero wash. Data can carry richer color, but the chrome should stay quiet so financial information remains the center of gravity.

The system explicitly rejects generic fintech navy-and-gold dashboards, crypto-neon trading terminals, decorative SaaS glassmorphism, spreadsheet-like clutter on mobile, and web dialogs that break the installed-app illusion.

**Key Characteristics:**

- Native mobile patterns: large titles, floating tab bar, bottom sheets, swipe actions, haptics, safe areas.
- Dense but legible desktop patterns: collapsible sidebar, command palette, sticky headers, keyboard shortcuts, compact mode.
- Data-first restraint: tinted surfaces, thin rings, tabular numbers, soft state color.
- Schema-aware identity: one color schema controls chart tokens, gain/loss, app icon accents, favicon, and dashboard hero gradients.
- Motion with purpose: pull feedback, route direction, theme reveal, skeleton loading, chart crosshair state.

## 2. Colors

The default palette is a cool financial neutral field with emerald as the active voice and a richer chart spectrum reserved for data. Additional schemas are available from Settings: Anthropic, Ocean, Violet, Amber, and Rose. Each schema retints the same semantic roles rather than adding separate market-convention toggles.

### Primary

- **Schema Primary**: Used for primary actions, active navigation, chart series 1, focus rings, schema-aware app identity, and default gain styling. Its role is signal, not decoration.

### Secondary

- **Quiet Slate Wash**: Used for secondary controls, muted panels, segmented controls, hover states, and low-priority grouping surfaces.

### Tertiary

- **Analysis Spectrum**: Chart tokens 1-9 support allocation, currency, category, attribution, heatmap, and history charts. These colors belong inside visualization and status contexts, not general page chrome.

### Neutral

- **Paper Background**: The light base, almost white with a cool blue tint, used for the main page canvas.
- **Ink Foreground**: The default text color, a cool near-black tuned away from pure black.
- **Card Plane**: The top surface for cards, dialogs, popovers, and sheets.
- **Hairline Border**: The structural divider color for cards, sidebars, sticky headers, and list rows.
- **Muted Text**: Secondary labels, timestamps, hints, placeholders, and helper copy.

### Semantic Direction

- `--gain` and `--loss` are semantic tokens controlled by the active color schema. Do not add Taiwan/US red-up or green-up switches.
- Positive and negative states must remain visually distinct through color, icon direction, labels, and context.
- App marks use `--app-icon-gradient-start` and `--app-icon-gradient-end`, a dedicated highlight-to-deep pair that preserves the original dimensional icon style while changing hue by schema.

### Named Rules

**The Schema Is Color Authority Rule.** Color Schema owns primary, chart, gain/loss, icon, favicon, and hero-gradient colors. Do not create separate color preferences for direction or icons.

**The Chart Color Boundary Rule.** High-chroma spectrum colors belong in charts and semantic status only. Product chrome stays neutral.

**The No Pure Extremes Rule.** Do not introduce pure black or pure white; every neutral is tinted through the system tokens.

## 3. Typography

**Display Font:** system-first sans (`-apple-system`, `SF Pro Text`, `SF Pro Display`) with Geist and system fallbacks.
**Body Font:** the same system-first sans stack.
**Label/Mono Font:** Geist Mono, `ui-monospace`, SF Mono, Menlo, monospace.

**Character:** Native, compact, and numerical. The type system should disappear into the task, with emphasis coming from weight, spacing, and tabular alignment rather than decorative type.

### Hierarchy

- **Display** (700, 2.25rem, 1.1): Mobile large titles and the largest net-worth value. Use sparingly.
- **Headline** (700, 1.875rem, 1.2): Page titles and major section openings on desktop.
- **Title** (500, 1rem, 1.375): Card titles, dialog titles, table group labels, and component headers.
- **Body** (400, 1rem, 1.5): Default reading text, form input text, descriptions, and table content. Cap prose around 65-75 characters.
- **Label** (500, 0.875rem, 1.25): Buttons, nav labels, helper labels, chips, and compact UI captions.
- **Mono** (500, 0.875rem, 1.25): Keyboard hints, currency codes, technical values, and fixed-width comparisons.

### Named Rules

**The Tabular Money Rule.** Financial values must use stable width behavior where possible, especially in animated counts, tables, histories, and summaries.

**The Native Scale Rule.** Do not add display fonts or fluid marketing typography inside product surfaces. Use the system sans stack and fixed product sizes.

## 4. Elevation

The system uses tonal layering first, thin rings second, and shadows as state feedback. Cards rest on subtle surface/ring contrast; stronger shadows appear on hover, mobile floating navigation, popovers, bottom bars, and pull-to-refresh indicators.

### Shadow Vocabulary

- **Resting Card** (`shadow-sm` plus `ring-foreground/10` or `border-border/50`): Default card depth without making every panel float.
- **Interactive Lift** (`hover:shadow-lg` with `hover:-translate-y-1`): Dashboard metric cards and premium cards only.
- **Mobile Dock** (`0 8px 24px -8px rgba(0,0,0,0.3)`): Floating bottom navigation, stronger in dark mode.
- **Dark Ambient Panel** (`0 4px 24px -4px rgba(0,0,0,0.5)`): Dark-mode glass/premium cards where tonal contrast needs help.
- **App Icon Shadow**: Preserve existing `drop-shadow-lg` and dark-mode SVG shadow treatment; change only the gradient colors when adapting the mark to a schema.

### Named Rules

**The Surface Before Shadow Rule.** Use background, border, ring, and spacing before adding a shadow. Shadows are earned by overlays, hover, or floating navigation.

**The No Decorative Glass Rule.** Blur is allowed for sticky or fixed overlays where content passes underneath. Do not use decorative glass cards as a default surface.

## 5. Components

### Buttons

Buttons are compact, native, and stateful rather than ornamental.

- **Shape:** Soft rectangle, usually `rounded-lg` (`0.75rem`) with smaller compact variants clamped to 10-12px.
- **Primary:** Schema primary background with primary foreground, `h-8`, `px-2.5`, medium label text.
- **Hover / Focus:** Hover darkens through opacity. Focus uses a 3px ring at `ring/50`. Active press translates down by 1px where the control is not a popup trigger.
- **Secondary / Ghost / Destructive:** Secondary uses muted fill; outline uses background plus border; ghost is fill-free until hover; destructive is a controlled negative tint, not a fully saturated block.

### Chips

Chips are rounded pills for filters, ranges, deltas, and small state labels.

- **Style:** `h-5`, full-pill radius, `px-2`, text-xs medium.
- **State:** Active chips use primary fill or a primary tint. Inactive chips are muted text with hover fill.

### Cards / Containers

Cards frame data modules, not entire page sections.

- **Corner Style:** Rounded-xl for base cards, rounded-2xl for mobile grouped cards and hero metrics.
- **Background:** Card token for ordinary surfaces; `background/80` with border/ring for premium cards and sticky translucent layers.
- **Shadow Strategy:** Resting cards stay subtle; hover lift is reserved for dashboard metric cards.
- **Border:** Thin ring or hairline border only.
- **Internal Padding:** Base cards use 16px; compact cards use 12px; hero cards use 16-24px depending on density.

### Net Worth Hero

The net-worth card may carry a soft animated mesh and bottom accent, but both must derive from schema tokens (`--gain`, `--loss`, `--primary`, and chart tokens). The mesh is a data/state wash, not a marketing hero.

### App Icon / Favicon

The app mark is a rounded square with a diagonal gradient and white chart-arrow glyph. Preserve the original shape, radius, white stroke, and shadow treatment. Only recolor the gradient using the active schema's dedicated app-icon gradient tokens. The browser favicon may update through a generated SVG data URL; Apple/PWA icons remain stable because iOS caches them aggressively.

### Inputs / Fields

Fields should feel native and low-friction for financial entry.

- **Style:** 32px height, rounded-lg, border-input stroke, transparent or lightly tinted background, 10px horizontal padding.
- **Focus:** Border shifts to ring color with a 3px translucent focus ring.
- **Error / Disabled:** Errors use destructive border plus translucent destructive ring; disabled fields reduce opacity and use an input tint.

### Navigation

Navigation changes shape by device but keeps the same vocabulary of icons, active tint, and compact labels.

- **Desktop Sidebar:** 256px expanded or 72px collapsed, sidebar background at 80% opacity with backdrop blur, active items use primary text plus a primary tint block and thin border.
- **Mobile Header:** Safe-area aware, large-title synchronized, with logo fading away as the page title collapses.
- **Mobile Tab Bar:** Floating full-pill dock, max-width 24rem, safe-area aware, five items only. Active item uses primary text and a primary tint pill; inactive items stay muted until hover/tap.
- **Command Entry:** Search affordance uses muted background, thin border, and monospace keyboard hints.

### Dialogs / Sheets

Dialogs use popover surfaces, rounded-xl corners, thin rings, and compact text. On mobile, task forms should prefer bottom sheets so the installed app illusion remains intact.

### Charts

Charts should be quiet until touched. Use schema chart tokens for all series. Crosshair, range chips, and sticky value callouts must prioritize readability over decorative animation. Heatmaps and trend states should use semantic gain/loss tokens with iconography or labels when direction matters.

## 6. Do's and Don'ts

### Do:

- **Do** use the system token vocabulary from `src/app/globals.css` for colors, radius, motion, schema variants, and theme variants.
- **Do** keep accent color rare and meaningful: action, selection, positive movement, primary chart series, or current schema identity.
- **Do** preserve native mobile behavior: large titles, bottom tab bar, bottom sheets, swipe actions, haptics, safe areas, and pull-to-refresh.
- **Do** use tabular numbers and stable width containers for money, percentages, and chart callouts.
- **Do** provide hover, focus-visible, active, disabled, loading, error, empty, compact, privacy, dark, and reduced-motion states for product components.
- **Do** keep chart palettes distinct and role-based. Data can be colorful; chrome should stay restrained.
- **Do** treat Color Schema as the only color customization surface.

### Don't:

- **Don't** make this a generic fintech navy-and-gold dashboard.
- **Don't** make it feel like a crypto-neon trading terminal.
- **Don't** add decorative SaaS glassmorphism. Blur belongs to sticky and fixed overlays only.
- **Don't** introduce spreadsheet-like clutter on mobile. Mobile lists should be grouped, touch-safe, and disclosure-driven.
- **Don't** use web dialogs where a bottom sheet is expected on mobile.
- **Don't** use side-stripe borders, gradient text, hero-metric marketing layouts, or repeated identical icon-card grids in new work.
- **Don't** use pure black, pure white, full-saturation inactive states, or color as decoration without a data or state role.
- **Don't** add separate up/down color settings, icon-style variants, or locale-driven direction colors.
