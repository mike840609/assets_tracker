# Holding Buy Unit Price Input Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users optionally enter a buy unit price when adding a holding, and persist it on the initial `BUY` transaction.

**Architecture:** Add one nullable `unitPrice` column to `HoldingTransaction`, validate it in the existing create-holding schema, and write it only on the initial `BUY` row created by the holdings POST route. The add-holding and option-builder forms each collect the optional value and omit it from the payload when blank.

**Tech Stack:** Next.js 16 App Router route handlers, React 19 client components, Prisma 7, PostgreSQL, Zod 4, next-intl, Vitest.

**Spec:** `docs/superpowers/specs/2026-07-05-holding-buy-unit-price-design.md`

## Global Constraints

- Package manager is **pnpm**; never npm/npx.
- Before editing Next route code, read `node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md`.
- `unitPrice` is optional; empty input keeps current behavior.
- `unitPrice` must be a positive number when present.
- `unitPrice` lives on `HoldingTransaction`, not `Holding`.
- No backfill, average-cost field, cost basis calculation, unrealized P&L UI, or transaction-history editing in this change.
- Do not auto-fill buy unit price from current market price.
- Pre-push hook runs `format:check + lint + typecheck`; run `pnpm format` if Prettier complains.

---

## File Structure

- Modify `prisma/schema.prisma`: add `HoldingTransaction.unitPrice`.
- Create `prisma/migrations/20260705000000_add_holding_transaction_unit_price/migration.sql`: add nullable DB column.
- Modify `src/lib/validators.ts`: accept optional positive `unitPrice` on create holdings.
- Modify `src/app/api/accounts/[id]/holdings/route.ts`: write `unitPrice` to the created `BUY` transaction.
- Create `tests/unit/holdings-route.test.ts`: route-level guard that POST writes `unitPrice`.
- Modify `tests/unit/validators.test.ts`: schema tests for optional/positive/rejected values.
- Modify `src/components/accounts/holding-form.tsx`: collect optional unit price for the stock path.
- Modify `src/components/accounts/option-builder.tsx`: collect optional unit price for the option path.
- Modify `messages/en-US.json` and `messages/zh-TW.json`: add labels and validation copy.

---

### Task 1: Data Model, Validation, and POST Persistence

**Files:**

- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260705000000_add_holding_transaction_unit_price/migration.sql`
- Modify: `src/lib/validators.ts`
- Modify: `src/app/api/accounts/[id]/holdings/route.ts`
- Modify: `tests/unit/validators.test.ts`
- Create: `tests/unit/holdings-route.test.ts`

**Interfaces:**

- Consumes: existing `createHoldingSchema` and holdings POST payload.
- Produces: `createHoldingSchema` output may include `unitPrice?: number`; holdings POST writes it to `tx.holdingTransaction.create({ data })` when provided.

- [ ] **Step 1: Read the required local Next.js route handler guide**

Run:

```bash
sed -n '1,220p' node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md
```

Expected: docs describe `route.ts` handlers and request/response conventions. No code changes.

- [ ] **Step 2: Write failing validator tests**

In `tests/unit/validators.test.ts`, inside `describe("createHoldingSchema", () => { ... })`, append:

```ts
it("accepts an optional positive buy unit price", () => {
  expect(createHoldingSchema.safeParse(base).success).toBe(true);

  const result = createHoldingSchema.safeParse({ ...base, unitPrice: 180.25 });
  expect(result.success).toBe(true);
  if (result.success) {
    expect(result.data.unitPrice).toBe(180.25);
  }
});

it("rejects a non-positive buy unit price", () => {
  expect(createHoldingSchema.safeParse({ ...base, unitPrice: 0 }).success).toBe(false);
  expect(createHoldingSchema.safeParse({ ...base, unitPrice: -1 }).success).toBe(false);
});
```

- [ ] **Step 3: Write failing holdings POST route test**

Create `tests/unit/holdings-route.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from "vitest";

const h = vi.hoisted(() => ({
  account: { id: "acc1" } as Record<string, unknown> | null,
  calls: [] as Array<{ op: string; args?: Record<string, unknown> }>,
}));

vi.mock("next/cache", () => ({
  revalidateTag: vi.fn(),
}));

vi.mock("next/server", () => ({
  after: vi.fn((fn: () => void) => fn()),
}));

vi.mock("@/lib/api-handler", () => ({
  withAuth:
    (handler: (req: Request, ctx: unknown, userId: string) => Promise<Response>) =>
    (req: Request, ctx: unknown) =>
      handler(req, ctx, "user1"),
}));

vi.mock("@/lib/services/price-service", () => ({
  fetchStockPrices: vi.fn(async () => new Map()),
  fetchCryptoPrices: vi.fn(async () => new Map()),
}));

vi.mock("@/lib/services/exchange-rate-service", () => ({
  refreshExchangeRates: vi.fn(),
}));

vi.mock("@/lib/prisma", () => {
  const prisma = {
    account: {
      findUnique: vi.fn(async () => h.account),
    },
    holding: {
      upsert: vi.fn(async (args: Record<string, unknown>) => {
        h.calls.push({ op: "holding.upsert", args });
        return {
          id: "holding1",
          symbol: "AAPL",
          name: "Apple",
          quantity: 10,
          currency: "USD",
          assetType: "STOCK",
        };
      }),
    },
    holdingTransaction: {
      create: vi.fn(async (args: Record<string, unknown>) => {
        h.calls.push({ op: "holdingTransaction.create", args });
        return { id: "tx1", ...(args.data as Record<string, unknown>) };
      }),
    },
    priceCache: {
      upsert: vi.fn(),
    },
    exchangeRate: {
      findFirst: vi.fn(async () => ({ fromCurrency: "USD" })),
    },
    $transaction: vi.fn(async (work: unknown) =>
      (work as (tx: typeof prisma) => Promise<unknown>)(prisma),
    ),
  };
  return { prisma };
});

const params = { params: Promise.resolve({ id: "acc1" }) };

const jsonRequest = (body: Record<string, unknown>) =>
  new Request("http://unit.test/api/accounts/acc1/holdings", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });

describe("holdings route", () => {
  beforeEach(() => {
    h.account = { id: "acc1" };
    h.calls = [];
  });

  it("writes optional unitPrice to the initial BUY transaction", async () => {
    const { POST } = await import("@/app/api/accounts/[id]/holdings/route");

    const response = await POST(
      jsonRequest({
        symbol: "aapl",
        name: "Apple",
        quantity: 10,
        assetType: "STOCK",
        currency: "USD",
        unitPrice: 180.25,
      }),
      params,
    );

    expect(response.status).toBe(201);
    expect(h.calls.find((call) => call.op === "holdingTransaction.create")?.args?.data).toEqual({
      holdingId: "holding1",
      type: "BUY",
      quantity: 10,
      unitPrice: 180.25,
    });
  });

  it("omits unitPrice from the BUY transaction when not provided", async () => {
    const { POST } = await import("@/app/api/accounts/[id]/holdings/route");

    const response = await POST(
      jsonRequest({
        symbol: "aapl",
        name: "Apple",
        quantity: 10,
        assetType: "STOCK",
        currency: "USD",
      }),
      params,
    );

    expect(response.status).toBe(201);
    const data = h.calls.find((call) => call.op === "holdingTransaction.create")?.args?.data as
      | Record<string, unknown>
      | undefined;
    expect(data).toMatchObject({ holdingId: "holding1", type: "BUY", quantity: 10 });
    expect(data).not.toHaveProperty("unitPrice");
  });
});
```

- [ ] **Step 4: Run the failing tests**

Run:

```bash
pnpm test:unit -- tests/unit/validators.test.ts tests/unit/holdings-route.test.ts
```

Expected: FAIL because `unitPrice` is not in `createHoldingSchema`, and the route does not write it.

- [ ] **Step 5: Add Prisma schema and migration**

In `prisma/schema.prisma`, update `model HoldingTransaction`:

```prisma
model HoldingTransaction {
  id        String          @id @default(cuid())
  holdingId String
  holding   Holding         @relation(fields: [holdingId], references: [id], onDelete: Cascade)
  type      TransactionType
  quantity  Decimal         @db.Decimal(18, 8)
  unitPrice Decimal?        @db.Decimal(18, 8)
  note      String?
  createdAt DateTime        @default(now())

  recurringId    String?
  recurring      RecurringInvestment? @relation(fields: [recurringId], references: [id], onDelete: SetNull)
  occurrenceDate DateTime?            @db.Date

  @@unique([recurringId, occurrenceDate])
  @@index([holdingId, createdAt(sort: Desc)])
}
```

Create `prisma/migrations/20260705000000_add_holding_transaction_unit_price/migration.sql`:

```sql
ALTER TABLE "HoldingTransaction"
ADD COLUMN "unitPrice" DECIMAL(18, 8);
```

Run:

```bash
pnpm exec prisma generate
```

Expected: Prisma Client regenerates successfully.

- [ ] **Step 6: Add validator support**

In `src/lib/validators.ts`, extend `baseHoldingFields`:

```ts
const baseHoldingFields = {
  symbol: z
    .string()
    .min(1, "Symbol is required")
    .max(32)
    .transform((s) => s.toUpperCase()),
  name: z.string().min(1, "Name is required").max(100),
  quantity: z.number().positive("Quantity must be positive"),
  unitPrice: z.number().positive("Buy unit price must be positive").optional(),
  currency: z.string().length(3).default("USD"),
};
```

- [ ] **Step 7: Write unitPrice in holdings POST**

In `src/app/api/accounts/[id]/holdings/route.ts`, replace the transaction create block with:

```ts
await tx.holdingTransaction.create({
  data: {
    holdingId: upserted.id,
    type: "BUY",
    quantity: parsed.data.quantity,
    ...(parsed.data.unitPrice !== undefined && { unitPrice: parsed.data.unitPrice }),
  },
});
```

- [ ] **Step 8: Run focused tests**

Run:

```bash
pnpm test:unit -- tests/unit/validators.test.ts tests/unit/holdings-route.test.ts
```

Expected: PASS.

- [ ] **Step 9: Commit Task 1**

Run:

```bash
git add prisma/schema.prisma prisma/migrations/20260705000000_add_holding_transaction_unit_price/migration.sql src/generated/prisma src/lib/validators.ts 'src/app/api/accounts/[id]/holdings/route.ts' tests/unit/validators.test.ts tests/unit/holdings-route.test.ts
git commit -m "feat: store holding buy unit price"
```

Expected: commit succeeds.

---

### Task 2: Add Optional Unit Price Inputs to Add-Holding UI

**Files:**

- Modify: `src/components/accounts/holding-form.tsx`
- Modify: `src/components/accounts/option-builder.tsx`
- Modify: `messages/en-US.json`
- Modify: `messages/zh-TW.json`

**Interfaces:**

- Consumes: Task 1 API accepts `unitPrice?: number`.
- Produces: `HoldingForm.postHolding(payload)` and `OptionBuilder.SubmitPayload` can include `unitPrice?: number`.

- [ ] **Step 1: Add i18n strings**

In `messages/en-US.json`, under `quickAddHolding`, add:

```json
"labelUnitPrice": "Buy unit price",
"placeholderUnitPrice": "e.g. 180",
"invalidUnitPrice": "Invalid buy unit price",
```

In `messages/zh-TW.json`, under `quickAddHolding`, add:

```json
"labelUnitPrice": "買入單價",
"placeholderUnitPrice": "例如：180",
"invalidUnitPrice": "買入單價無效",
```

- [ ] **Step 2: Update HoldingForm state and payload type**

In `src/components/accounts/holding-form.tsx`, add state after `quantityError`:

```ts
const [unitPrice, setUnitPrice] = useState("");
const [unitPriceError, setUnitPriceError] = useState("");
```

Add handlers after `handleQuantityBlur`:

```ts
function handleUnitPriceChange(e: React.ChangeEvent<HTMLInputElement>) {
  const next = maskAmountInput(e.target.value);
  if (next === null) return;
  setUnitPriceError("");
  setUnitPrice(next);
}

function handleUnitPriceBlur() {
  const val = unitPrice.replace(/,/g, "");
  if (!val) {
    setUnitPriceError("");
    return;
  }
  const parsed = parseAmountInput(val);
  if (isNaN(parsed) || parsed <= 0) {
    setUnitPriceError(t("invalidUnitPrice"));
    return;
  }
  setUnitPriceError("");
  setUnitPrice(formatAmountInput(parsed, 6));
}
```

In `clearSelection()`, reset the new fields:

```ts
setUnitPrice("");
setUnitPriceError("");
```

Update `postHolding` payload type:

```ts
  async function postHolding(payload: {
    symbol: string;
    name: string;
    quantity: number;
    assetType: string;
    currency: string;
    unitPrice?: number;
  }) {
```

Update `handleSubmit`:

```ts
const parsedUnitPrice = unitPrice ? parseAmountInput(unitPrice) : undefined;
await postHolding({
  symbol,
  name,
  quantity: parseAmountInput(quantity),
  assetType,
  currency,
  ...(parsedUnitPrice !== undefined && { unitPrice: parsedUnitPrice }),
});
```

Update `canSubmit`:

```ts
const parsedUnitPrice = unitPrice ? parseAmountInput(unitPrice) : undefined;
const canSubmit =
  (tickerSelected || (manualMode && symbol && name)) &&
  !!quantity &&
  parseAmountInput(quantity) > 0 &&
  !unitPriceError &&
  (parsedUnitPrice === undefined || parsedUnitPrice > 0);
```

- [ ] **Step 3: Add HoldingForm input below quantity**

In `src/components/accounts/holding-form.tsx`, immediately after the quantity block, add:

```tsx
<div className="space-y-2">
  <Label className="text-base font-medium">{t("labelUnitPrice")}</Label>
  <Input
    type="text"
    inputMode="decimal"
    value={unitPrice}
    onChange={handleUnitPriceChange}
    onBlur={handleUnitPriceBlur}
    placeholder={t("placeholderUnitPrice")}
    className="text-lg h-12"
  />
  {unitPriceError && <p className="text-xs text-destructive">{unitPriceError}</p>}
</div>
```

- [ ] **Step 4: Update OptionBuilder payload and state**

In `src/components/accounts/option-builder.tsx`, update `SubmitPayload`:

```ts
type SubmitPayload = {
  symbol: string;
  name: string;
  quantity: number;
  assetType: "OPTION";
  currency: "USD";
  unitPrice?: number;
};
```

Add state after `quantityError`:

```ts
const [unitPrice, setUnitPrice] = useState("");
const [unitPriceError, setUnitPriceError] = useState("");
```

Add handlers after `handleQuantityBlur`:

```ts
function handleUnitPriceChange(e: React.ChangeEvent<HTMLInputElement>) {
  const raw = e.target.value.replace(/,/g, "");
  if (raw !== "" && !/^\d*\.?\d*$/.test(raw)) return;
  setUnitPriceError("");
  if (!raw) {
    setUnitPrice("");
    return;
  }
  const [whole, decimal] = raw.split(".");
  const formattedWhole = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  setUnitPrice(decimal === undefined ? formattedWhole : `${formattedWhole}.${decimal}`);
}

function handleUnitPriceBlur() {
  const val = unitPrice.replace(/,/g, "");
  if (!val) {
    setUnitPriceError("");
    return;
  }
  const parsed = Number(val);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    setUnitPriceError(t("invalidUnitPrice"));
    return;
  }
  setUnitPriceError("");
  setUnitPrice(formatAmountInput(parsed, 6));
}
```

In `handleSubmit`, before `dispatchPayload`, compute and pass the optional value:

```ts
const parsedUnitPrice = unitPrice ? Number(unitPrice.replace(/,/g, "")) : undefined;
dispatchPayload({
  symbol: occ,
  name: formatOptionLabel(parsed),
  quantity: qty,
  assetType: "OPTION",
  currency: "USD",
  ...(parsedUnitPrice !== undefined && { unitPrice: parsedUnitPrice }),
});
```

Update `canSubmit`:

```ts
const parsedUnitPrice = unitPrice ? Number(unitPrice.replace(/,/g, "")) : undefined;
const canSubmit =
  !loading &&
  !!underlying &&
  !!expiration &&
  !!strike &&
  !!quantity &&
  parseInt(quantity.replace(/,/g, ""), 10) > 0 &&
  !unitPriceError &&
  (parsedUnitPrice === undefined || parsedUnitPrice > 0);
```

- [ ] **Step 5: Add OptionBuilder input below contract quantity**

In `src/components/accounts/option-builder.tsx`, below the contract quantity input block, add:

```tsx
<div className="space-y-2">
  <Label>{t("labelUnitPrice")}</Label>
  <Input
    type="text"
    inputMode="decimal"
    value={unitPrice}
    onChange={handleUnitPriceChange}
    onBlur={handleUnitPriceBlur}
    placeholder={t("placeholderUnitPrice")}
  />
  {unitPriceError && <p className="text-xs text-destructive">{unitPriceError}</p>}
</div>
```

- [ ] **Step 6: Run checks**

Run:

```bash
pnpm typecheck
pnpm test:unit -- tests/unit/validators.test.ts tests/unit/holdings-route.test.ts
```

Expected: both PASS.

- [ ] **Step 7: Commit Task 2**

Run:

```bash
git add src/components/accounts/holding-form.tsx src/components/accounts/option-builder.tsx messages/en-US.json messages/zh-TW.json
git commit -m "feat: add buy unit price inputs"
```

Expected: commit succeeds.

---

### Task 3: Final Verification

**Files:**

- Verify only; no planned file edits.

**Interfaces:**

- Consumes: Task 1 and Task 2 commits.
- Produces: confidence that schema, route, UI, and types agree.

- [ ] **Step 1: Run full unit suite**

Run:

```bash
pnpm test:unit
```

Expected: PASS.

- [ ] **Step 2: Run typecheck and lint**

Run:

```bash
pnpm typecheck
pnpm lint
```

Expected: PASS.

- [ ] **Step 3: Check working tree**

Run:

```bash
git status --short
```

Expected: no uncommitted changes.

- [ ] **Step 4: Report completion**

Report:

```text
Implemented optional buy unit price for new holdings. Skipped auto-fill, cost basis, backfill, and editing existing transaction prices; add those when the stored unit price is consumed by analysis or transaction history.
```
