# `--warning` semantic color role

## Context

The color system is schema-governed but its semantic status vocabulary was incomplete: `globals.css` defined `--gain`, `--loss`, `--destructive`, `--primary`, and `--chart-1..9`, but no `--warning` / `--success` / `--info` — even though the product register (`PRODUCT.md` / `DESIGN.md`) explicitly calls for "a state-rich semantic vocabulary: …error, warning, success, info."

The practical consequence was **no caution lane**: feedback was binary (22 `toast.error` / 18 `toast.success`, zero `toast.warning`), and genuine data-quality cautions rendered as invisible gray or a calm primary tint that didn't distinguish stale from fresh.

This change adds **`--warning` only** (a calm amber caution role). `--success`/`--info` stay out of scope: `--primary` already reads as positive and there is no concrete `info` surface today.

## Token design (`src/app/globals.css`)

Wired exactly like `--destructive`:

- `--warning` + `--warning-foreground` in `:root` and `.dark`, bound via `--color-warning` / `--color-warning-foreground` in `@theme inline` → generates `bg-warning`, `text-warning`, `border-warning`, and `/opacity` variants.
- **Stable amber across schemas**, overridden only in the **Amber** schema (light + dark), where the primary is amber `~65` and a gold warning would blur into the brand color — shifted toward orange (`H50`). Same distinctness precedent as the `--loss` decoupling.

Values are contrast-checked (`text-warning` must pass WCAG AA for small text):

| Context              | OKLCH          | Contrast on its bg |
| -------------------- | -------------- | ------------------ |
| Light (default)      | `0.55 0.12 72` | 4.83:1             |
| Light (Amber schema) | `0.55 0.15 50` | 4.99:1             |
| Dark (default)       | `0.82 0.13 80` | 11.2:1             |
| Dark (Amber schema)  | `0.80 0.15 50` | 10.3:1             |

`--warning-foreground`: light `0.99 0.01 80`, dark `0.18 0.03 80` (ink on a solid warning fill).

## Plumbing

- **Badge** (`src/components/ui/badge.tsx`): a `warning` variant mirroring `gain`/`loss` (`bg-[color-mix(... --warning 18%)] text-[var(--warning)]`).
- **Toast lane** (`globals.css`): sonner already configures a `warning` `TriangleAlertIcon`; added `[data-sonner-toast][data-type="warning"]` rules to tint the icon + border with `--warning`, so `toast.warning(...)` reads as caution.

## Applied to (real caution surfaces)

1. **Unpriced-holdings note** (`portfolio-heatmap.tsx`): "N holdings have no price" was `text-muted-foreground` gray → `text-warning` + a `TriangleAlert` icon.
2. **Stale freshness badge** (`freshness-badge.tsx`): "prices/rates updated X ago" rendered with the same primary tint regardless of age. Now, when price/rates data is older than **72h** (clears normal weekend gaps; snapshots are point-in-time and never "stale"), the badge switches to the warning tone **and** a `TriangleAlert` icon (not color-alone, so it survives color-blindness).

Deliberately left neutral: `noPriceData` / `noPriceUpdate` first-run "pending" states (Clock icon) — amber there would alarm new users.

## Verification

- Compiles through the real Tailwind v4 pipeline; all four `--warning` values + `text/bg/border-warning` utilities emitted; served live on the dev server.
- `format:check` + `lint` + `typecheck` clean.
- Manual: toggle each schema (esp. Amber) in light + dark; confirm warning ≠ primary and ≠ error/loss; check the heatmap unpriced note and an aged freshness badge.

## Non-goals

- No `--success` / `--info` tokens.
- No bulk reclassification of existing `toast.error` calls.
- No tokenizing of `CATEGORY_COLORS`.
