# Holding Buy Unit Price Input — Design

**Date:** 2026-07-05
**Status:** Approved

## Goal

Let users optionally enter the buy unit price when adding a holding, so the
initial `BUY` transaction has enough structured data for future cost basis and
unrealized P&L calculations.

## Scope

- Add optional buy unit price to the regular add-holding flow.
- Persist the value on the created `HoldingTransaction`, not on `Holding`.
- Existing holdings and transactions are not backfilled.
- Empty unit price keeps the current behavior.
- No cost basis, P&L, tax lot, or analysis UI is added in this change.

## Data Model

Add nullable `unitPrice Decimal? @db.Decimal(18, 8)` to `HoldingTransaction`.

Meaning:

- For stocks, ETFs, crypto, funds, bonds, and other non-option assets:
  `unitPrice` is the buy price per unit in the holding currency.
- For options: `unitPrice` is the option premium per underlying share in USD.
  Future total cost can be calculated as
  `unitPrice * quantity * contractMultiplier`.

The currency is implied by the holding's `currency`; no separate currency column
is needed.

## API

`POST /api/accounts/[id]/holdings` accepts optional `unitPrice`.

Validation:

- `unitPrice` omitted or `undefined`: accepted.
- Positive number: accepted.
- `0`, negative, non-number: rejected.

When the route creates the initial `BUY` `HoldingTransaction`, it writes
`unitPrice` if provided. The existing atomic holding upsert remains unchanged.

## UI

In `src/components/accounts/holding-form.tsx`, add an optional "Buy unit price"
input below quantity for the stock / ETF / crypto path.

Behavior:

- Empty field is valid.
- Entered value uses the existing amount input helpers.
- On blur, invalid or non-positive values show an inline error.
- Submit is disabled while the entered price is invalid.
- Payload includes `unitPrice` only when the user entered a valid value.

In `src/components/accounts/option-builder.tsx`, add the same optional input
below contract quantity. The label stays "Buy unit price"; helper text can use
the existing option cost preview to make clear this is premium per share. No
default is auto-filled from ask, because user-entered cost should be explicit.

## i18n

Add `quickAddHolding` strings in English and Traditional Chinese:

- `labelUnitPrice`
- `placeholderUnitPrice`
- `invalidUnitPrice`

## Testing

Add the smallest checks that protect the new logic:

- Validator accepts omitted and positive `unitPrice`; rejects zero and negative.
- Holdings POST route writes `unitPrice` onto the created `BUY` transaction.

## Explicitly skipped (add later if needed)

- Average cost on `Holding`.
- Cost basis or unrealized P&L calculations.
- Backfill flow for existing holdings.
- Unit price editing in transaction history.
- Separate unit price currency.
