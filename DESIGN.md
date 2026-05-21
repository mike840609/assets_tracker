---
name: Assets Tracker
description: A calm, iOS-native net worth dashboard for tracking assets, liabilities, goals, and portfolio analysis.
colors:
  background-light: "oklch(0.99 0.003 260)"
  foreground-light: "oklch(0.15 0.02 260)"
  card-light: "oklch(1 0 0)"
  primary-light: "oklch(0.6 0.16 150)"
  primary-foreground-light: "oklch(0.98 0.005 150)"
  secondary-light: "oklch(0.96 0.01 260)"
  muted-light: "oklch(0.96 0.01 260)"
  muted-foreground-light: "oklch(0.55 0.02 260)"
  border-light: "oklch(0.9 0.02 260)"
  input-light: "oklch(0.9 0.02 260)"
  background-dark: "oklch(0.14 0.03 200)"
  foreground-dark: "oklch(0.96 0.01 190)"
  card-dark: "oklch(0.19 0.035 200)"
  primary-dark: "oklch(0.8 0.17 170)"
  primary-foreground-dark: "oklch(0.12 0.03 170)"
  secondary-dark: "oklch(0.22 0.038 200)"
  muted-dark: "oklch(0.2 0.036 200)"
  muted-foreground-dark: "oklch(0.7 0.02 195)"
  border-dark: "oklch(0.3 0.038 200)"
  input-dark: "oklch(0.22 0.038 200)"
  destructive-light: "oklch(0.6 0.18 20)"
  destructive-dark: "oklch(0.7 0.19 20)"
  chart-emerald-light: "oklch(0.6 0.16 150)"
  chart-cyan-light: "oklch(0.65 0.12 210)"
  chart-indigo-light: "oklch(0.6 0.15 260)"
  chart-purple-light: "oklch(0.7 0.15 300)"
  chart-pink-light: "oklch(0.8 0.1 330)"
  chart-emerald-dark: "oklch(0.8 0.17 170)"
  chart-blue-dark: "oklch(0.78 0.15 220)"
  chart-violet-dark: "oklch(0.74 0.17 270)"
  chart-magenta-dark: "oklch(0.82 0.17 320)"
  chart-yellow-dark: "oklch(0.86 0.13 100)"
typography:
  display:
    fontFamily: '-apple-system, "SF Pro Text", "SF Pro Display", Geist, system-ui, sans-serif'
    fontSize: 2.25rem
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: normal
  headline:
    fontFamily: '-apple-system, "SF Pro Text", "SF Pro Display", Geist, system-ui, sans-serif'
    fontSize: 1.875rem
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: normal
  title:
    fontFamily: '-apple-system, "SF Pro Text", "SF Pro Display", Geist, system-ui, sans-serif'
    fontSize: 1rem
    fontWeight: 500
    lineHeight: 1.375
    letterSpacing: normal
  body:
    fontFamily: '-apple-system, "SF Pro Text", "SF Pro Display", Geist, system-ui, sans-serif'
    fontSize: 1rem
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: normal
  label:
    fontFamily: '-apple-system, "SF Pro Text", "SF Pro Display", Geist, system-ui, sans-serif'
    fontSize: 0.75rem
    fontWeight: 500
    lineHeight: 1.333
    letterSpacing: normal
rounded:
  sm: 0.5rem
  md: 0.625rem
  lg: 0.75rem
  xl: 1rem
  2xl: 1.25rem
spacing:
  xs: 0.25rem
  sm: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  2xl: 2rem
components:
  button-primary:
    backgroundColor: "{colors.primary-light}"
    textColor: "{colors.primary-foreground-light}"
    typography: "{typography.body}"
    rounded: "{rounded.lg}"
    padding: "0 0.75rem"
    height: 2rem
  button-outline:
    backgroundColor: "{colors.card-light}"
    textColor: "{colors.foreground-light}"
    typography: "{typography.body}"
    rounded: "{rounded.lg}"
    padding: "0 0.75rem"
    height: 2rem
  button-auth-primary:
    backgroundColor: "{colors.primary-light}"
    textColor: "{colors.primary-foreground-light}"
    typography: "{typography.body}"
    rounded: "{rounded.lg}"
    padding: "0 1rem"
    height: 3rem
  card:
    backgroundColor: "{colors.card-light}"
    textColor: "{colors.foreground-light}"
    typography: "{typography.body}"
    rounded: "{rounded.xl}"
    padding: 1rem
  input:
    backgroundColor: "{colors.input-light}"
    textColor: "{colors.foreground-light}"
    typography: "{typography.body}"
    rounded: "{rounded.lg}"
    padding: "0 0.625rem"
    height: 2rem
  badge:
    backgroundColor: "{colors.secondary-light}"
    textColor: "{colors.foreground-light}"
    typography: "{typography.label}"
    rounded: "{rounded.2xl}"
    padding: "0 0.5rem"
    height: 1.25rem
  tab-active:
    backgroundColor: "{colors.background-light}"
    textColor: "{colors.foreground-light}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "0 0.75rem"
    height: 1.75rem
---

## 1. Overview

**Creative North Star: "The Quiet Ledger."**

Assets Tracker is a private finance console with a calm operational register. It should feel like an iOS-native wealth cockpit on mobile and a dense portfolio workstation on desktop: fast to scan, quiet under pressure, and precise around money movement.

The interface is built for repeated use, not marketing drama. Favor stable navigation, compact controls, grouped lists, strong numeric hierarchy, and immediate access to accounts, assets, liabilities, goals, and portfolio analysis. Visual polish should come from typography, spacing, state quality, and responsive behavior before illustration or decoration.

## 2. Colors

The default light theme uses cool near-white surfaces with a restrained emerald primary. Dark mode shifts to deep teal-blue surfaces with a brighter mint primary so financial data stays legible without becoming neon. Charts may use the broader light set of emerald, cyan, indigo, purple, and pink; in dark mode they shift toward mint, blue, violet, magenta, and yellow for separation.

Use semantic tokens for all product UI: `background`, `foreground`, `card`, `primary`, `secondary`, `muted`, `border`, `input`, `ring`, `destructive`, and `chart-*`. Accent color should normally occupy less than 10% of a screen outside charts, active navigation, key calls to action, and positive deltas.

Alternate color schemes may be offered as personalization, but every scheme must preserve the same roles: neutral surfaces first, one confident action color, clear destructive states, and chart colors that remain distinguishable without relying on red or green alone.

**The Rarity Rule.** Primary color is valuable because it is scarce. Use it for the active path, primary action, positive emphasis, and chart identity, not for decorative wash.

## 3. Typography

Use the Apple system stack first, with Geist as the bundled fallback. This keeps mobile screens native, makes dashboard density readable, and avoids decorative typography in financial workflows.

Numbers are a primary visual asset. Use tabular numerals for balances, rates, performance, allocation, and goal progress. Net worth and total balance figures may use larger, tighter display sizing, but normal panels, cards, sidebars, and forms should stay compact: 12px labels, 14px supporting text, 16px primary body and controls, and 30px page headlines.

Headings should be direct and literal. Avoid dramatic slogans inside the app shell. Use sentence-case labels, concise error copy, and localized strings for every user-facing login, navigation, and financial state.

**The Ledger Rule.** Every number that users compare should align, use tabular figures, and avoid decorative treatments that reduce scan speed.

## 4. Elevation

Depth is tonal before it is shadowed. Cards use solid surfaces, subtle rings, and small shadows only when they clarify grouping. The standard card shape is `rounded-xl` with a foreground tint ring; premium dashboard cards may use `rounded-2xl` with a small hover lift on pointer devices.

Glass effects are reserved for persistent navigation and overlays: mobile headers, desktop sidebar, command palette shells, and bottom sheets. Do not make normal content cards translucent when they contain financial values, forms, or validation states.

Motion should be short and purposeful: 150ms for micro state changes, 250ms for common transitions, 400ms for larger view changes. Respect reduced motion by disabling decorative transitions, view-transition reveals, shimmer, and hover lift.

**The Solid Data Rule.** Values, validation, account rows, and forms sit on solid surfaces. Blur and translucency are for app chrome and overlays only.

## 5. Components

Buttons are compact by default with 8px height rhythm in the app shell and larger 48px targets on login, onboarding, bottom sheets, and mobile primary actions. Use icons for tool actions, text for clear commands, and visible focus rings on every interactive element.

Cards group one decision or one repeated entity. Account, asset, liability, and transaction rows should use inset grouped-list behavior on mobile rather than desktop tables. Keep dividers hairline, section headers small and tracked, and destructive actions confirmed or isolated.

Inputs use explicit labels, semantic autocomplete where available, and localized placeholders only as supporting hints. Validation must be visible, screen-reader reachable, and not color-only. Login and auth screens must preserve password manager support, keyboard order, and OAuth button affordances.

Navigation is adaptive. Mobile uses safe-area-aware headers, bottom navigation, large-title behavior, and bottom sheets. Desktop uses collapsible side navigation, command search, and dense dashboard layouts. Charts should pair color with labels, legends, tooltips, and accessible summaries.

## 6. Do's and Don'ts

Do use semantic tokens, OKLCH colors, system typography, tabular numerals, localized strings, visible focus states, and mobile safe-area spacing.

Do design finance screens for scanning: align numbers, keep labels short, disclose details progressively, and make empty, loading, error, and offline states feel first-class.

Do reserve illustration, mesh backgrounds, and gradients for high-level summary moments where they support hierarchy without obscuring data.

Don't use gradient text, glassmorphism, side stripes, glow effects, decorative blobs, or stock-like visuals as the default design language for financial workflows.

Don't hard-code colors outside tokens except vendor marks, OAuth logos, or unavoidable third-party assets.

Don't rely on hover-only controls, red-versus-green-only meaning, placeholder-only labels, centered mobile modals for complex tasks, or motion that cannot be disabled.
