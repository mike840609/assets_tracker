# Dashboard Portfolio Layout Design

## Goal

Remove the excessive empty space in the dashboard's Portfolio Composition card while preserving its role as the primary account-allocation drill-in. Improve the surrounding portfolio modules so the desktop section reads as one coherent composition zone without changing financial calculations or navigation.

## Current Problem

The desktop dashboard places Portfolio Composition in an eight-column card beside a four-column rail containing Asset Allocation, Currency Exposure, and Concentration. The left card is forced to fill the height of the entire right rail. `PortfolioHeatmap` then measures that stretched container and expands the treemap to the same height, producing a large low-information area below the useful visualization and legend.

The layout also makes Concentration feel like a third unrelated rail card even though it is a direct interpretation of portfolio composition.

## Chosen Structure

Use a two-row portfolio composition zone on desktop:

1. First row:
   - Portfolio Composition spans eight of twelve columns.
   - Asset Allocation and Currency Exposure form a four-column vertical rail.
   - Each side sizes itself from its content. The Portfolio Composition card is not stretched to the rail height.
2. Second row:
   - Concentration spans all twelve columns.
   - Its content becomes a compact horizontal summary rather than a tall narrow card.
3. All Accounts remains the next full-width section.

This preserves the dashboard's existing sequence of “what changed,” “what it is made of,” and “drill into accounts.”

## Portfolio Composition

- Keep dashboard `fillHeight` so the treemap fills the Portfolio Composition card's own chart/list row, while removing the parent flex-stretch rules that previously tied the card to the external allocation/currency rail.
- Keep the existing treemap, account selection, holding drill-in, privacy behavior, accessible chart summary, and reduced-motion behavior.
- Use the component's existing responsive chart height as the minimum, then let the treemap grow to the height of its internal detail/account-list column on desktop. Mobile keeps the existing width-based height rules.
- Keep the detail card and account list beside the treemap on desktop.
- Let the card end after its content instead of visually aligning its bottom edge with the neighboring rail.
- Keep the total-assets label and unpriced-holdings warning in the header.

## Concentration Summary

At large desktop widths, reorganize the existing concentration content into two horizontal regions:

- Summary region: largest-position percentage, “Largest position” label, and concentration status.
- Positions region: the existing top-position list with names, percentages, and bars, using the remaining width.

The card keeps the same data and semantic color tokens. It does not introduce another chart, new threshold logic, or a new destination.

At narrower widths, including mobile, the concentration content falls back to the existing vertical reading order. Long holding names remain truncated or wrapped according to the existing component's behavior, and percentages retain tabular alignment.

## Responsive Behavior

- Below the large dashboard breakpoint, modules remain single-column.
- Preserve the current mobile-first source order for Allocation, Currency Exposure, Portfolio Composition, and Concentration so streaming and screen-reader order remain predictable.
- Desktop placement uses grid column and row positioning only.
- Touch targets, focus rings, privacy mode, compact density, localization, and reduced motion remain supported.
- Skeletons mirror the new topology: the first portfolio row contains the treemap and two-card rail; the concentration skeleton is a separate full-width row.

## Component and Data Boundaries

- `DashboardContent` remains the server-side orchestrator with independent Suspense boundaries.
- `PortfolioHeatmapSection` continues to load the cached net-worth summary and passes it to the existing client-side `PortfolioHeatmap`.
- `ConcentrationSection` continues to derive concentration from the cached summary.
- No additional client boundary, database query, API route, or shared state is introduced.
- The production dashboard skeleton and local section fallbacks are updated to match the final visual structure.

## Empty and Error States

- Existing no-account onboarding remains unchanged.
- Portfolio Composition continues to render nothing when no positive asset account exists.
- Concentration continues to render nothing when total assets are zero or negative.
- Existing Suspense fallbacks remain isolated so one delayed module does not block the rest of the dashboard.
- The unpriced-holdings warning remains local to Portfolio Composition.

## Verification

1. Static checks:
   - Format check for changed files.
   - ESLint for changed TypeScript files.
   - TypeScript typecheck.
2. Behavioral checks:
   - Selecting an account still drills the treemap into its holdings.
   - Back navigation returns to account allocation.
   - Privacy mode obscures values and chart detail as before.
   - Compact density reduces the treemap height without collapsing labels or controls.
3. Visual checks at representative widths:
   - Wide desktop: 8/4 first row plus full-width horizontal Concentration.
   - Standard desktop: no stretched Portfolio Composition card and no large internal blank area.
   - Tablet/mobile: single-column order, readable labels, and 44px touch targets.
   - Dark and light themes: existing borders, surfaces, and chart colors remain legible.

## Out of Scope

- Changing portfolio or concentration calculations.
- Moving Portfolio Composition to the Analysis page.
- Adding dashboard customization or drag-and-drop modules.
- Combining the portfolio modules into one nested mega-card.
- Changing chart colors, account colors, typography, or global spacing tokens.
