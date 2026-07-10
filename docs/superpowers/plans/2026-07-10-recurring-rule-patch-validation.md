# Recurring Rule PATCH Date-Range Validation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reject partial recurring-rule edits that would make `endDate` earlier than the effective `startDate`.

**Architecture:** The two existing route handlers remain the validation boundary. Each reads the rule's persisted date range, merges it with the validated PATCH payload, and rejects an invalid merged range before a guarded Prisma update. The update matches the read date range so a conflicting date edit returns 409 rather than writing stale data. A focused route-test file proves both invalid partial-edit directions and stale-write handling.

**Tech Stack:** Next.js 16 Route Handlers, TypeScript, Prisma, Zod, Vitest.

## Global Constraints

- Do not add a database migration or change cron scheduling semantics.
- Preserve the existing `nextRunDate` reset when a valid `startDate` changes.
- Return `End date must be on or after the start date` with HTTP 400.
- Follow test-driven development: run the focused test red before changing production handlers.

---

### Task 1: Add failing route regressions

**Files:**

- Create: `tests/unit/recurring-rule-routes.test.ts`
- Test: `tests/unit/recurring-rule-routes.test.ts`

**Interfaces:**

- Consumes: exported `PATCH` handlers from both recurring route files.
- Produces: regression coverage that asserts a 400 response and no Prisma update for an invalid merged date range.

- [ ] **Step 1: Write the failing tests**

Mock `withAuth` to call the handler as `user1`, then mock these Prisma methods:

```ts
recurringCashTransaction: {
  findFirst: vi.fn(async () => cashRule),
  update: vi.fn(async () => cashRule),
},
recurringInvestment: {
  findFirst: vi.fn(async () => investmentRule),
  update: vi.fn(async () => investmentRule),
},
```

Use complete rule fixtures with `startDate`, `endDate`, `nextRunDate`, `createdAt`, and `updatedAt` as `Date` objects. For each route, add one test for:

```ts
await PATCH(jsonRequest({ endDate: "2026-07-31" }), params());
expect(response.status).toBe(400);
expect(prismaDelegate.update).not.toHaveBeenCalled();
```

with an existing `startDate` of `2026-08-01`, and one test for a later submitted `startDate` against an existing `endDate`.

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `pnpm vitest run tests/unit/recurring-rule-routes.test.ts`

Expected: the invalid one-field PATCH tests fail because the current handlers return 200 and call `update`.

### Task 2: Validate the effective date range in both PATCH handlers

**Files:**

- Modify: `src/app/api/accounts/[id]/recurring-cash-transactions/[recurringId]/route.ts:20-47`
- Modify: `src/app/api/accounts/[id]/recurring-investments/[recurringId]/route.ts:19-44`
- Test: `tests/unit/recurring-rule-routes.test.ts`

**Interfaces:**

- Consumes: `parsed.data.startDate`, `parsed.data.endDate`, and the persisted rule's `startDate`/`endDate`.
- Produces: a 400 `failure("End date must be on or after the start date", 400)` response before any rule update when the merged range is invalid.

- [ ] **Step 1: Expand each ownership lookup**

Replace the `select: { id: true }` selection with:

```ts
select: { id: true, startDate: true, endDate: true },
```

- [ ] **Step 2: Add the merged-range guard and conditional write after payload validation**

After destructuring `startDate` and `endDate`, calculate the effective values and return before constructing `data`:

```ts
const effectiveStartDate = startDate ? toUtcDate(startDate) : existing.startDate;
const effectiveEndDate =
  endDate === undefined ? existing.endDate : endDate ? toUtcDate(endDate) : null;
if (effectiveEndDate && effectiveEndDate < effectiveStartDate) {
  return failure("End date must be on or after the start date", 400);
}
```

Replace the final `update` with `updateMany` that also matches the persisted range, then return 409 if no row was affected:

```ts
const result = await prisma.recurringCashTransaction.updateMany({
  where: {
    id: recurringId,
    startDate: existing.startDate,
    endDate: existing.endDate,
  },
  data,
});
if (result.count !== 1) {
  return failure("Recurring transaction changed while updating; please retry", 409);
}
const rule = await prisma.recurringCashTransaction.findUniqueOrThrow({
  where: { id: recurringId },
});
```

Use the analogous `recurringInvestment` delegate and message in the investment handler. Add one stale-write test per route by returning `count: 0` from the mocked `updateMany` and expecting HTTP 409.

- [ ] **Step 3: Run the focused test to verify it passes**

Run: `pnpm vitest run tests/unit/recurring-rule-routes.test.ts`

Expected: all four invalid partial-edit regressions pass and the mocked `update` methods remain uncalled.

- [ ] **Step 4: Run the project validation suite**

Run: `pnpm test:unit && pnpm lint && pnpm typecheck`

Expected: all unit tests, ESLint, and TypeScript checks pass.

- [ ] **Step 5: Commit the implementation**

```bash
git add docs/superpowers/specs/2026-07-10-recurring-rule-patch-validation-design.md \
  docs/superpowers/plans/2026-07-10-recurring-rule-patch-validation.md \
  tests/unit/recurring-rule-routes.test.ts \
  src/app/api/accounts/[id]/recurring-cash-transactions/[recurringId]/route.ts \
  src/app/api/accounts/[id]/recurring-investments/[recurringId]/route.ts
git commit -m "fix: validate merged recurring rule date ranges"
```
