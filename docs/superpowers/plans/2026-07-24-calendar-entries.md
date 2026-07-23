# Calendar Entries Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a first-party month calendar where users can create, edit, and delete multiple all-day or timed financial notes, with a standalone desktop route, a mobile Plan sub-view, and complete whole-app backup support.

**Architecture:** Persist each note as a user-owned `CalendarEntry`, expose bounded authenticated CRUD routes, and serve the visible six-week range through a cached service. A date-only utility module owns all calendar arithmetic; Server Components normalize URL state and fetch data, while focused client components render the grid, selected-day agenda, and responsive form. The existing JSON backup is upgraded to v1.4, but CSV/ICS/provider synchronization remains outside v1.

**Tech Stack:** Node.js 24.6.0, pnpm 11.6.0, Next.js 16.2.10 App Router, React 19.2.4, TypeScript 5, Prisma 7.6/PostgreSQL, Zod 4.3, next-intl 4.9, Tailwind CSS 4, Base UI/shadcn primitives, Vitest 4.1, Playwright 1.52.

## Global Constraints

- Follow the approved design in `docs/superpowers/specs/2026-07-24-calendar-entries-design.md`.
- Use a first-class `CalendarEntry`; do not attach notes to `NetWorthSnapshot` or store a per-user JSON document.
- Support multiple entries per day. Categories are exactly `EARNINGS`, `ECONOMIC_INDICATOR`, `DIVIDEND`, `FILING`, `REMINDER`, and `OTHER`.
- An all-day entry has both `startTimeMinutes` and `timeZone` set to `null`; a timed entry has both set. Store and display the wall-clock time without timezone conversion or moving `eventDate`.
- Title is trimmed and 1–120 characters; description is at most 4,000 characters; source URL is at most 2,048 characters and only `http` or `https`.
- The visible range is always 42 inclusive Monday-first dates. API ranges longer than 42 dates are invalid.
- Desktop uses standalone `/calendar`; mobile uses the fourth Plan subtab at `/goals?...#calendar`. Keep the five-item mobile bottom navigation unchanged.
- Preserve URL state with `month=YYYY-MM` and `date=YYYY-MM-DD`; invalid state falls back to the current Taiwan business day.
- Calendar writes are non-optimistic. Disable duplicate submissions, preserve form contents on failure, and refresh authoritative server data after success.
- Add all user-facing strings to both `messages/en-US.json` and `messages/zh-TW.json`.
- Upgrade the whole-app backup from `1.3` to `1.4`; older backups without `calendarEntries` must remain valid.
- Do not add dependencies. Do not add recurring events, durations, notifications, data feeds, dashboard widgets, CSV/ICS, OAuth, or Google Calendar synchronization.
- At execution time, use `superpowers:using-git-worktrees` before implementation so the approved `master` checkout remains isolated from task commits.
- Unit tests run in Vitest's Node environment and must use `.test.ts`, not `.test.tsx`. Pure calendar helpers must not import React or browser-only modules.
- Use existing CSS variables and semantic tokens; do not add hard-coded color hex values.

---

### Task 1: Add the Calendar Entry Persistence Contract

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260724000000_add_calendar_entries/migration.sql`
- Modify: `src/lib/types.ts`
- Test: `tests/unit/types.test.ts`

**Interfaces:**
- Consumes: existing Prisma `User` relation and the repository convention that `@db.Date` values are represented as UTC-midnight `Date` objects.
- Produces:
  - Prisma enum `CalendarEntryCategory`
  - Prisma model `CalendarEntry`
  - `CalendarEntryCategoryValue`
  - `SerializedCalendarEntry`
  - `serializeCalendarEntry(entry: CalendarEntry): SerializedCalendarEntry`

- [ ] **Step 1: Write the failing serializer test**

Add the generated Prisma type import and this case to `tests/unit/types.test.ts`:

```ts
import type { CalendarEntry } from "@/generated/prisma/client";
import { serializeCalendarEntry } from "@/lib/types";

it("serializes a CalendarEntry date without timezone drift and normalizes nullable fields", () => {
  const entry = {
    id: "cal_1",
    userId: "user_1",
    title: "US CPI",
    eventDate: new Date("2026-08-12T00:00:00.000Z"),
    startTimeMinutes: 510,
    timeZone: "Asia/Taipei",
    category: "ECONOMIC_INDICATOR",
    description: null,
    sourceUrl: null,
    createdAt: new Date("2026-07-24T01:02:03.000Z"),
    updatedAt: new Date("2026-07-24T04:05:06.000Z"),
  } satisfies CalendarEntry;

  expect(serializeCalendarEntry(entry)).toEqual({
    id: "cal_1",
    userId: "user_1",
    title: "US CPI",
    eventDate: "2026-08-12",
    startTimeMinutes: 510,
    timeZone: "Asia/Taipei",
    category: "ECONOMIC_INDICATOR",
    description: null,
    sourceUrl: null,
    createdAt: "2026-07-24T01:02:03.000Z",
    updatedAt: "2026-07-24T04:05:06.000Z",
  });
});
```

- [ ] **Step 2: Run the test to verify the contract is absent**

Run:

```bash
pnpm exec vitest run tests/unit/types.test.ts
```

Expected: FAIL because `CalendarEntry` and `serializeCalendarEntry` do not exist.

- [ ] **Step 3: Add the Prisma enum, model, and user relation**

Add to `prisma/schema.prisma` before `model User`:

```prisma
enum CalendarEntryCategory {
  EARNINGS
  ECONOMIC_INDICATOR
  DIVIDEND
  FILING
  REMINDER
  OTHER
}

model CalendarEntry {
  id               String                @id @default(cuid())
  userId           String
  user             User                  @relation(fields: [userId], references: [id], onDelete: Cascade)
  title            String                @db.VarChar(120)
  eventDate        DateTime              @db.Date
  startTimeMinutes Int?
  timeZone         String?               @db.VarChar(64)
  category         CalendarEntryCategory
  description      String?               @db.Text
  sourceUrl        String?               @db.Text
  createdAt        DateTime              @default(now()) @db.Timestamptz(3)
  updatedAt        DateTime              @updatedAt @db.Timestamptz(3)

  @@index([userId, eventDate, startTimeMinutes])
}
```

Add this field to `model User`:

```prisma
  calendarEntries CalendarEntry[]
```

- [ ] **Step 4: Add the SQL migration**

Create `prisma/migrations/20260724000000_add_calendar_entries/migration.sql`:

```sql
CREATE TYPE "CalendarEntryCategory" AS ENUM (
  'EARNINGS',
  'ECONOMIC_INDICATOR',
  'DIVIDEND',
  'FILING',
  'REMINDER',
  'OTHER'
);

CREATE TABLE "CalendarEntry" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "title" VARCHAR(120) NOT NULL,
  "eventDate" DATE NOT NULL,
  "startTimeMinutes" INTEGER,
  "timeZone" VARCHAR(64),
  "category" "CalendarEntryCategory" NOT NULL,
  "description" TEXT,
  "sourceUrl" TEXT,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "CalendarEntry_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CalendarEntry_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "CalendarEntry_userId_eventDate_startTimeMinutes_idx"
ON "CalendarEntry"("userId", "eventDate", "startTimeMinutes");
```

- [ ] **Step 5: Generate the client and add the serialized type**

Run:

```bash
pnpm exec prisma generate
```

Expected: Prisma Client generation succeeds and `CalendarEntry` is available from `@/generated/prisma/client`.

In `src/lib/types.ts`, add `CalendarEntry` to the generated type import and add:

```ts
export const CALENDAR_ENTRY_CATEGORIES = [
  "EARNINGS",
  "ECONOMIC_INDICATOR",
  "DIVIDEND",
  "FILING",
  "REMINDER",
  "OTHER",
] as const;

export type CalendarEntryCategoryValue = (typeof CALENDAR_ENTRY_CATEGORIES)[number];

export type SerializedCalendarEntry = {
  id: string;
  userId: string;
  title: string;
  eventDate: string;
  startTimeMinutes: number | null;
  timeZone: string | null;
  category: CalendarEntryCategoryValue;
  description: string | null;
  sourceUrl: string | null;
  createdAt: string;
  updatedAt: string;
};

export function serializeCalendarEntry(entry: CalendarEntry): SerializedCalendarEntry {
  return {
    id: entry.id,
    userId: entry.userId,
    title: entry.title,
    eventDate: entry.eventDate.toISOString().slice(0, 10),
    startTimeMinutes: entry.startTimeMinutes ?? null,
    timeZone: entry.timeZone ?? null,
    category: entry.category,
    description: entry.description ?? null,
    sourceUrl: entry.sourceUrl ?? null,
    createdAt: entry.createdAt.toISOString(),
    updatedAt: entry.updatedAt.toISOString(),
  };
}
```

- [ ] **Step 6: Run focused verification**

Run:

```bash
pnpm exec vitest run tests/unit/types.test.ts
pnpm typecheck
```

Expected: PASS; TypeScript recognizes the generated model and serializer.

- [ ] **Step 7: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/20260724000000_add_calendar_entries/migration.sql src/generated/prisma src/lib/types.ts tests/unit/types.test.ts
git commit -m "feat: add calendar entry persistence model"
```

---

### Task 2: Build Canonical Date-Only Calendar Utilities

**Files:**
- Create: `src/lib/calendar-date.ts`
- Test: `tests/unit/calendar-date.test.ts`

**Interfaces:**
- Consumes: `taiwanCalendarDay(now: Date): Date` from `src/lib/app-day.ts`.
- Produces:
  - `parseDateOnly(value: string): Date | null`
  - `formatDateOnly(date: Date): string`
  - `addCalendarDays(dateKey: string, amount: number): string`
  - `moveCalendarMonth(dateKey: string, amount: number): string`
  - `buildMonthGrid(monthKey: string): string[]`
  - `getVisibleCalendarRange(monthKey: string): { from: string; to: string }`
  - `normalizeCalendarUrlState(input, now): { month: string; date: string }`
  - `getCalendarRangeLength(from: string, to: string): number`

- [ ] **Step 1: Write the failing utility tests**

Create `tests/unit/calendar-date.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  addCalendarDays,
  buildMonthGrid,
  getCalendarRangeLength,
  getVisibleCalendarRange,
  moveCalendarMonth,
  normalizeCalendarUrlState,
  parseDateOnly,
} from "@/lib/calendar-date";

describe("calendar date-only utilities", () => {
  it("accepts only real canonical dates", () => {
    expect(parseDateOnly("2026-02-28")?.toISOString()).toBe("2026-02-28T00:00:00.000Z");
    expect(parseDateOnly("2024-02-29")).not.toBeNull();
    expect(parseDateOnly("2026-02-29")).toBeNull();
    expect(parseDateOnly("2026-2-03")).toBeNull();
    expect(parseDateOnly("03/02/2026")).toBeNull();
  });

  it("builds a six-week Monday-first grid across year boundaries", () => {
    const days = buildMonthGrid("2026-01");
    expect(days).toHaveLength(42);
    expect(days[0]).toBe("2025-12-29");
    expect(days.at(-1)).toBe("2026-02-08");
    expect(getVisibleCalendarRange("2026-01")).toEqual({
      from: "2025-12-29",
      to: "2026-02-08",
    });
  });

  it("uses date-only UTC arithmetic across leap days", () => {
    expect(addCalendarDays("2024-02-28", 1)).toBe("2024-02-29");
    expect(addCalendarDays("2024-02-29", 1)).toBe("2024-03-01");
  });

  it("preserves the day of month and clamps month navigation", () => {
    expect(moveCalendarMonth("2026-01-31", 1)).toBe("2026-02-28");
    expect(moveCalendarMonth("2024-01-31", 1)).toBe("2024-02-29");
    expect(moveCalendarMonth("2026-03-31", -1)).toBe("2026-02-28");
  });

  it("normalizes invalid URL state to the Taiwan business day", () => {
    const now = new Date("2026-07-24T20:30:00.000Z");
    expect(normalizeCalendarUrlState({}, now)).toEqual({
      month: "2026-07",
      date: "2026-07-25",
    });
    expect(normalizeCalendarUrlState({ month: "bad", date: "2026-02-31" }, now)).toEqual({
      month: "2026-07",
      date: "2026-07-25",
    });
  });

  it("keeps a valid selected date visible by making its month authoritative", () => {
    const now = new Date("2026-07-24T00:00:00.000Z");
    expect(
      normalizeCalendarUrlState({ month: "2026-07", date: "2026-08-02" }, now),
    ).toEqual({ month: "2026-08", date: "2026-08-02" });
  });

  it("counts ranges inclusively", () => {
    expect(getCalendarRangeLength("2026-07-01", "2026-07-01")).toBe(1);
    expect(getCalendarRangeLength("2026-07-01", "2026-08-11")).toBe(42);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
pnpm exec vitest run tests/unit/calendar-date.test.ts
```

Expected: FAIL because `src/lib/calendar-date.ts` is absent.

- [ ] **Step 3: Implement the pure date-only module**

Create `src/lib/calendar-date.ts`:

```ts
import { taiwanCalendarDay } from "@/lib/app-day";

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;
const MONTH_ONLY = /^(\d{4})-(\d{2})$/;
const DAY_MS = 86_400_000;

export function formatDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function parseDateOnly(value: string): Date | null {
  const match = DATE_ONLY.exec(value);
  if (!match) return null;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return formatDateOnly(date) === value ? date : null;
}

function parseMonthKey(value: string): Date | null {
  const match = MONTH_ONLY.exec(value);
  if (!match) return null;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, 1));
  return date.toISOString().slice(0, 7) === value ? date : null;
}

export function addCalendarDays(dateKey: string, amount: number): string {
  const date = parseDateOnly(dateKey);
  if (!date) throw new RangeError(`Invalid calendar date: ${dateKey}`);
  return formatDateOnly(new Date(date.getTime() + amount * DAY_MS));
}

export function moveCalendarMonth(dateKey: string, amount: number): string {
  const date = parseDateOnly(dateKey);
  if (!date) throw new RangeError(`Invalid calendar date: ${dateKey}`);
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + amount;
  const targetFirst = new Date(Date.UTC(year, month, 1));
  const targetLast = new Date(
    Date.UTC(targetFirst.getUTCFullYear(), targetFirst.getUTCMonth() + 1, 0),
  ).getUTCDate();
  return formatDateOnly(
    new Date(
      Date.UTC(
        targetFirst.getUTCFullYear(),
        targetFirst.getUTCMonth(),
        Math.min(date.getUTCDate(), targetLast),
      ),
    ),
  );
}

export function buildMonthGrid(monthKey: string): string[] {
  const first = parseMonthKey(monthKey);
  if (!first) throw new RangeError(`Invalid calendar month: ${monthKey}`);
  const mondayOffset = (first.getUTCDay() + 6) % 7;
  const start = new Date(first.getTime() - mondayOffset * DAY_MS);
  return Array.from({ length: 42 }, (_, index) =>
    formatDateOnly(new Date(start.getTime() + index * DAY_MS)),
  );
}

export function getVisibleCalendarRange(monthKey: string) {
  const days = buildMonthGrid(monthKey);
  return { from: days[0], to: days[41] };
}

export function getCalendarRangeLength(from: string, to: string): number {
  const fromDate = parseDateOnly(from);
  const toDate = parseDateOnly(to);
  if (!fromDate || !toDate) return 0;
  return Math.floor((toDate.getTime() - fromDate.getTime()) / DAY_MS) + 1;
}

export function normalizeCalendarUrlState(
  input: { month?: string | null; date?: string | null },
  now: Date = new Date(),
) {
  const fallback = formatDateOnly(taiwanCalendarDay(now));
  const selected = input.date ? parseDateOnly(input.date) : null;
  const month = input.month ? parseMonthKey(input.month) : null;
  if (!selected || !month) return { month: fallback.slice(0, 7), date: fallback };
  const date = formatDateOnly(selected);
  return { month: date.slice(0, 7), date };
}
```

- [ ] **Step 4: Run the utility tests and typecheck**

Run:

```bash
pnpm exec vitest run tests/unit/calendar-date.test.ts tests/unit/app-day.test.ts
pnpm typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/calendar-date.ts tests/unit/calendar-date.test.ts
git commit -m "feat: add calendar date-only utilities"
```

---

### Task 3: Add Calendar Validation and the Cached Range Service

**Files:**
- Modify: `src/lib/validators.ts`
- Create: `src/lib/services/calendar-entry-service.ts`
- Modify: `tests/unit/validators.test.ts`
- Create: `tests/unit/calendar-entry-service.test.ts`

**Interfaces:**
- Consumes:
  - `CALENDAR_ENTRY_CATEGORIES`
  - `serializeCalendarEntry(entry)`
  - `parseDateOnly(value)`
  - `getCalendarRangeLength(from, to)`
- Produces:
  - `calendarEntryInputSchema`
  - `createCalendarEntrySchema`
  - `updateCalendarEntrySchema`
  - `calendarEntriesRangeSchema`
  - `getCalendarEntriesInRange(userId: string, fromDate: Date, toDate: Date): Promise<SerializedCalendarEntry[]>`
  - `invalidateCalendarEntryCaches(userId: string): void`

- [ ] **Step 1: Write failing validation cases**

Add to `tests/unit/validators.test.ts`:

```ts
describe("calendar entry schemas", () => {
  const valid = {
    title: "US CPI",
    eventDate: "2026-08-12",
    startTimeMinutes: 510,
    timeZone: "Asia/Taipei",
    category: "ECONOMIC_INDICATOR",
    description: "Consensus 2.8%",
    sourceUrl: "https://example.gov/cpi",
  };

  it("accepts all-day and paired timed entries", () => {
    expect(createCalendarEntrySchema.safeParse(valid).success).toBe(true);
    expect(
      createCalendarEntrySchema.safeParse({
        ...valid,
        startTimeMinutes: null,
        timeZone: null,
      }).success,
    ).toBe(true);
  });

  it("rejects half-paired time fields, invalid minutes, and invalid IANA zones", () => {
    expect(createCalendarEntrySchema.safeParse({ ...valid, timeZone: null }).success).toBe(false);
    expect(
      createCalendarEntrySchema.safeParse({ ...valid, startTimeMinutes: 1440 }).success,
    ).toBe(false);
    expect(
      createCalendarEntrySchema.safeParse({ ...valid, timeZone: "Mars/Olympus" }).success,
    ).toBe(false);
  });

  it("trims text and accepts only http/https source URLs", () => {
    const parsed = createCalendarEntrySchema.safeParse({
      ...valid,
      title: "  CPI  ",
      description: "   ",
      sourceUrl: "ftp://example.gov/report",
    });
    expect(parsed.success).toBe(false);
    const good = createCalendarEntrySchema.parse({
      ...valid,
      title: "  CPI  ",
      description: "   ",
      sourceUrl: "  https://example.gov/report  ",
    });
    expect(good.title).toBe("CPI");
    expect(good.description).toBeNull();
    expect(good.sourceUrl).toBe("https://example.gov/report");
  });

  it("accepts 42 inclusive dates and rejects reversed or 43-day ranges", () => {
    expect(
      calendarEntriesRangeSchema.safeParse({ from: "2026-07-01", to: "2026-08-11" }).success,
    ).toBe(true);
    expect(
      calendarEntriesRangeSchema.safeParse({ from: "2026-08-11", to: "2026-07-01" }).success,
    ).toBe(false);
    expect(
      calendarEntriesRangeSchema.safeParse({ from: "2026-07-01", to: "2026-08-12" }).success,
    ).toBe(false);
  });
});
```

- [ ] **Step 2: Run validation tests to verify they fail**

Run:

```bash
pnpm exec vitest run tests/unit/validators.test.ts
```

Expected: FAIL because the four Calendar schemas are not exported.

- [ ] **Step 3: Implement reusable validation**

In `src/lib/validators.ts`, import `CALENDAR_ENTRY_CATEGORIES`, `getCalendarRangeLength`, and `parseDateOnly`, then add:

```ts
const nullableTrimmedText = (max: number) =>
  z
    .string()
    .max(max)
    .trim()
    .transform((value) => value || null)
    .nullable()
    .optional();

const calendarTimeZone = z
  .string()
  .max(64)
  .refine((value) => {
    try {
      new Intl.DateTimeFormat("en-US", { timeZone: value }).format();
      return true;
    } catch {
      return false;
    }
  }, "Must be a valid IANA timezone")
  .nullable();

const calendarEntryFields = z.object({
    title: z.string().trim().min(1, "Title is required").max(120),
    eventDate: z.string().refine((value) => parseDateOnly(value) !== null, "Invalid date"),
    startTimeMinutes: z.number().int().min(0).max(1439).nullable(),
    timeZone: calendarTimeZone,
    category: z.enum(CALENDAR_ENTRY_CATEGORIES),
    description: nullableTrimmedText(4000),
    sourceUrl: z
      .string()
      .max(2048)
      .trim()
      .refine((value) => {
        if (!value) return true;
        try {
          const protocol = new URL(value).protocol;
          return protocol === "http:" || protocol === "https:";
        } catch {
          return false;
        }
      }, "Source URL must use http or https")
      .transform((value) => value || null)
      .nullable()
      .optional(),
  });

function enforceCalendarTimePair(
  value: { startTimeMinutes?: number | null; timeZone?: string | null },
  ctx: z.RefinementCtx,
) {
    if ((value.startTimeMinutes === null) !== (value.timeZone === null)) {
      ctx.addIssue({
        code: "custom",
        path: value.startTimeMinutes === null ? ["timeZone"] : ["startTimeMinutes"],
        message: "Time and timezone must both be set or both be empty",
      });
    }
}

export const calendarEntryInputSchema = calendarEntryFields.superRefine(enforceCalendarTimePair);
export const createCalendarEntrySchema = calendarEntryInputSchema;
export const updateCalendarEntrySchema = calendarEntryFields.partial();

export const calendarEntriesRangeSchema = z
  .object({
    from: z.string().refine((value) => parseDateOnly(value) !== null, "Invalid from date"),
    to: z.string().refine((value) => parseDateOnly(value) !== null, "Invalid to date"),
  })
  .superRefine(({ from, to }, ctx) => {
    const length = getCalendarRangeLength(from, to);
    if (length < 1) {
      ctx.addIssue({ code: "custom", path: ["to"], message: "to must be on or after from" });
    } else if (length > 42) {
      ctx.addIssue({ code: "custom", path: ["to"], message: "Range cannot exceed 42 days" });
    }
  });
```

Ensure the create form always submits explicit `null` for `startTimeMinutes` and `timeZone`; this keeps the pair invariant deterministic.

- [ ] **Step 4: Run validation tests**

Run:

```bash
pnpm exec vitest run tests/unit/validators.test.ts
```

Expected: PASS.

- [ ] **Step 5: Write the failing cached-service test**

Create `tests/unit/calendar-entry-service.test.ts` with hoisted Prisma and cache mocks:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  findMany: vi.fn(),
  revalidateTag: vi.fn(),
}));

vi.mock("next/cache", () => ({
  cacheLife: vi.fn(),
  cacheTag: vi.fn(),
  revalidateTag: h.revalidateTag,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: { calendarEntry: { findMany: h.findMany } },
}));

import {
  getCalendarEntriesInRange,
  invalidateCalendarEntryCaches,
} from "@/lib/services/calendar-entry-service";

describe("calendar entry service", () => {
  beforeEach(() => vi.clearAllMocks());

  it("queries only the user's inclusive range and serializes all-day before timed", async () => {
    h.findMany.mockResolvedValue([
      {
        id: "all-day",
        userId: "user_1",
        title: "10-Q",
        eventDate: new Date("2026-08-12T00:00:00.000Z"),
        startTimeMinutes: null,
        timeZone: null,
        category: "FILING",
        description: null,
        sourceUrl: null,
        createdAt: new Date("2026-07-01T00:00:00.000Z"),
        updatedAt: new Date("2026-07-01T00:00:00.000Z"),
      },
      {
        id: "timed",
        userId: "user_1",
        title: "CPI",
        eventDate: new Date("2026-08-12T00:00:00.000Z"),
        startTimeMinutes: 510,
        timeZone: "Asia/Taipei",
        category: "ECONOMIC_INDICATOR",
        description: null,
        sourceUrl: null,
        createdAt: new Date("2026-07-02T00:00:00.000Z"),
        updatedAt: new Date("2026-07-02T00:00:00.000Z"),
      },
    ]);

    const result = await getCalendarEntriesInRange(
      "user_1",
      new Date("2026-08-01T00:00:00.000Z"),
      new Date("2026-09-11T00:00:00.000Z"),
    );

    expect(h.findMany).toHaveBeenCalledWith({
      where: {
        userId: "user_1",
        eventDate: {
          gte: new Date("2026-08-01T00:00:00.000Z"),
          lte: new Date("2026-09-11T00:00:00.000Z"),
        },
      },
      orderBy: [
        { eventDate: "asc" },
        { startTimeMinutes: { sort: "asc", nulls: "first" } },
        { createdAt: "asc" },
        { id: "asc" },
      ],
    });
    expect(result.map((entry) => entry.id)).toEqual(["all-day", "timed"]);
    expect(result[0].eventDate).toBe("2026-08-12");
  });

  it("invalidates global and user-scoped tags immediately", () => {
    invalidateCalendarEntryCaches("user_1");
    expect(h.revalidateTag).toHaveBeenNthCalledWith(1, "calendar-entries", { expire: 0 });
    expect(h.revalidateTag).toHaveBeenNthCalledWith(2, "calendar-entries:user_1", { expire: 0 });
  });

  it("rejects a reversed range or a range longer than 42 inclusive days", async () => {
    await expect(
      getCalendarEntriesInRange(
        "user_1",
        new Date("2026-08-02T00:00:00.000Z"),
        new Date("2026-08-01T00:00:00.000Z"),
      ),
    ).rejects.toThrow(RangeError);
    await expect(
      getCalendarEntriesInRange(
        "user_1",
        new Date("2026-08-01T00:00:00.000Z"),
        new Date("2026-09-12T00:00:00.000Z"),
      ),
    ).rejects.toThrow(RangeError);
    expect(h.findMany).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 6: Run the service test to verify it fails**

Run:

```bash
pnpm exec vitest run tests/unit/calendar-entry-service.test.ts
```

Expected: FAIL because the service module does not exist.

- [ ] **Step 7: Implement the cached service**

Create `src/lib/services/calendar-entry-service.ts`:

```ts
import "server-only";
import { cacheLife, cacheTag, revalidateTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { formatDateOnly, getCalendarRangeLength } from "@/lib/calendar-date";
import { serializeCalendarEntry, type SerializedCalendarEntry } from "@/lib/types";

export async function getCalendarEntriesInRange(
  userId: string,
  fromDate: Date,
  toDate: Date,
): Promise<SerializedCalendarEntry[]> {
  "use cache";
  const rangeLength = getCalendarRangeLength(formatDateOnly(fromDate), formatDateOnly(toDate));
  if (rangeLength < 1 || rangeLength > 42) {
    throw new RangeError("Calendar range must contain 1 through 42 inclusive dates");
  }
  cacheTag("calendar-entries");
  cacheTag(`calendar-entries:${userId}`);
  cacheLife("hours");

  const entries = await prisma.calendarEntry.findMany({
    where: { userId, eventDate: { gte: fromDate, lte: toDate } },
    orderBy: [
      { eventDate: "asc" },
      { startTimeMinutes: { sort: "asc", nulls: "first" } },
      { createdAt: "asc" },
      { id: "asc" },
    ],
  });
  return entries.map(serializeCalendarEntry);
}

export function invalidateCalendarEntryCaches(userId: string) {
  revalidateTag("calendar-entries", { expire: 0 });
  revalidateTag(`calendar-entries:${userId}`, { expire: 0 });
}
```

- [ ] **Step 8: Run focused verification**

Run:

```bash
pnpm exec vitest run tests/unit/validators.test.ts tests/unit/calendar-entry-service.test.ts
pnpm typecheck
```

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/lib/validators.ts src/lib/services/calendar-entry-service.ts tests/unit/validators.test.ts tests/unit/calendar-entry-service.test.ts
git commit -m "feat: validate and query calendar entries"
```

---

### Task 4: Implement Authenticated Calendar CRUD Routes

**Files:**
- Create: `src/app/api/calendar-entries/route.ts`
- Create: `src/app/api/calendar-entries/[id]/route.ts`
- Create: `tests/unit/calendar-entries-route.test.ts`

**Interfaces:**
- Consumes:
  - Task 3 schemas and service functions
  - `withAuth`, `ok`, `failure`, `validationError`
  - Prisma `calendarEntry` client
- Produces:
  - `GET /api/calendar-entries?from=YYYY-MM-DD&to=YYYY-MM-DD`
  - `POST /api/calendar-entries`
  - `PATCH /api/calendar-entries/[id]`
  - `DELETE /api/calendar-entries/[id]`

- [ ] **Step 1: Write failing route tests**

Create `tests/unit/calendar-entries-route.test.ts`. Mock `withAuth` to inject `user_1`, mock the service read/invalidation functions, and mock Prisma methods. Cover these concrete cases:

```ts
it("returns a bounded authenticated range", async () => {
  const response = await GET(
    new Request("http://unit.test/api/calendar-entries?from=2026-08-01&to=2026-09-11"),
    undefined,
  );
  expect(response.status).toBe(200);
  expect(getCalendarEntriesInRange).toHaveBeenCalledWith(
    "user_1",
    new Date("2026-08-01T00:00:00.000Z"),
    new Date("2026-09-11T00:00:00.000Z"),
  );
});

it("rejects a 43-day range before querying", async () => {
  const response = await GET(
    new Request("http://unit.test/api/calendar-entries?from=2026-08-01&to=2026-09-12"),
    undefined,
  );
  expect(response.status).toBe(400);
  expect(getCalendarEntriesInRange).not.toHaveBeenCalled();
});

it("creates a trimmed timed entry with a UTC-midnight eventDate", async () => {
  const response = await POST(jsonRequest(validTimedEntry), undefined);
  expect(response.status).toBe(201);
  expect(prisma.calendarEntry.create).toHaveBeenCalledWith({
    data: expect.objectContaining({
      userId: "user_1",
      title: "US CPI",
      eventDate: new Date("2026-08-12T00:00:00.000Z"),
      startTimeMinutes: 510,
      timeZone: "Asia/Taipei",
    }),
  });
  expect(invalidateCalendarEntryCaches).toHaveBeenCalledWith("user_1");
});

it("validates the merged final state on partial update", async () => {
  prisma.calendarEntry.findFirst.mockResolvedValue(existingTimedEntry);
  const response = await PATCH(jsonRequest({ timeZone: null }, "PATCH"), {
    params: Promise.resolve({ id: "cal_1" }),
  });
  expect(response.status).toBe(400);
  expect(prisma.calendarEntry.updateMany).not.toHaveBeenCalled();
});

it("returns 404 for missing or cross-user update and delete", async () => {
  prisma.calendarEntry.findFirst.mockResolvedValue(null);
  expect(
    (
      await PATCH(jsonRequest({ title: "Changed" }, "PATCH"), {
        params: Promise.resolve({ id: "other" }),
      })
    ).status,
  ).toBe(404);
  prisma.calendarEntry.deleteMany.mockResolvedValue({ count: 0 });
  expect(
    (
      await DELETE(new Request("http://unit.test/api/calendar-entries/other"), {
        params: Promise.resolve({ id: "other" }),
      })
    ).status,
  ).toBe(404);
});
```

Use these fixtures:

```ts
const validTimedEntry = {
  title: "US CPI",
  eventDate: "2026-08-12",
  startTimeMinutes: 510,
  timeZone: "Asia/Taipei",
  category: "ECONOMIC_INDICATOR",
  description: "Consensus 2.8%",
  sourceUrl: "https://example.gov/cpi",
};

const existingTimedEntry = {
  id: "cal_1",
  userId: "user_1",
  ...validTimedEntry,
  eventDate: new Date("2026-08-12T00:00:00.000Z"),
  createdAt: new Date("2026-07-24T01:00:00.000Z"),
  updatedAt: new Date("2026-07-24T02:00:00.000Z"),
};
```

Also add explicit cases for successful all-day create, successful edit, successful delete, no-fields PATCH `400`, and cache invalidation after each successful write.

- [ ] **Step 2: Run route tests to verify they fail**

Run:

```bash
pnpm exec vitest run tests/unit/calendar-entries-route.test.ts
```

Expected: FAIL because both route modules are absent.

- [ ] **Step 3: Implement collection GET and POST**

Create `src/app/api/calendar-entries/route.ts` with:

```ts
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api-handler";
import { failure, ok, validationError } from "@/lib/api-responses";
import { log } from "@/lib/logger";
import { parseDateOnly } from "@/lib/calendar-date";
import {
  calendarEntriesRangeSchema,
  createCalendarEntrySchema,
} from "@/lib/validators";
import {
  getCalendarEntriesInRange,
  invalidateCalendarEntryCaches,
} from "@/lib/services/calendar-entry-service";
import { serializeCalendarEntry } from "@/lib/types";

export const GET = withAuth(async (request, _ctx, userId) => {
  try {
    const url = new URL(request.url);
    const parsed = calendarEntriesRangeSchema.safeParse({
      from: url.searchParams.get("from"),
      to: url.searchParams.get("to"),
    });
    if (!parsed.success) return validationError(parsed.error);
    const from = parseDateOnly(parsed.data.from)!;
    const to = parseDateOnly(parsed.data.to)!;
    return ok(await getCalendarEntriesInRange(userId, from, to));
  } catch (error) {
    log.error("calendar_entries.list_failed", { userId, error: String(error) });
    return failure("Failed to load calendar entries", 500);
  }
});

export const POST = withAuth(async (request, _ctx, userId) => {
  try {
    const parsed = createCalendarEntrySchema.safeParse(await request.json());
    if (!parsed.success) return validationError(parsed.error);
    const entry = await prisma.calendarEntry.create({
      data: {
        userId,
        ...parsed.data,
        eventDate: parseDateOnly(parsed.data.eventDate)!,
        description: parsed.data.description ?? null,
        sourceUrl: parsed.data.sourceUrl ?? null,
      },
    });
    invalidateCalendarEntryCaches(userId);
    return ok(serializeCalendarEntry(entry), { status: 201 });
  } catch (error) {
    log.error("calendar_entries.create_failed", { userId, error: String(error) });
    return failure("Failed to create calendar entry", 500);
  }
});
```

In the route test, make `prisma.calendarEntry.create` reject once and assert a generic `500` body plus `log.error("calendar_entries.create_failed", ...)`; raw database text must not be returned.

- [ ] **Step 4: Implement item PATCH and DELETE with ownership folded into every lookup/write**

Create `src/app/api/calendar-entries/[id]/route.ts` with these imports:

```ts
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api-handler";
import { failure, ok, validationError } from "@/lib/api-responses";
import { log } from "@/lib/logger";
import { parseDateOnly } from "@/lib/calendar-date";
import {
  createCalendarEntrySchema,
  updateCalendarEntrySchema,
} from "@/lib/validators";
import { invalidateCalendarEntryCaches } from "@/lib/services/calendar-entry-service";
import { serializeCalendarEntry } from "@/lib/types";
```

Then use:

```ts
type IdCtx = { params: Promise<{ id: string }> };

export const PATCH = withAuth<IdCtx>(async (request, { params }, userId) => {
  try {
    const { id } = await params;
    const body = await request.json();
    const partial = updateCalendarEntrySchema.safeParse(body);
    if (!partial.success) return validationError(partial.error);
    if (Object.keys(partial.data).length === 0) return failure("No fields to update", 400);

    const current = await prisma.calendarEntry.findFirst({ where: { id, userId } });
    if (!current) return failure("Not found", 404);

    const merged = createCalendarEntrySchema.safeParse({
      title: partial.data.title ?? current.title,
      eventDate: partial.data.eventDate ?? current.eventDate.toISOString().slice(0, 10),
      startTimeMinutes:
        partial.data.startTimeMinutes === undefined
          ? current.startTimeMinutes
          : partial.data.startTimeMinutes,
      timeZone: partial.data.timeZone === undefined ? current.timeZone : partial.data.timeZone,
      category: partial.data.category ?? current.category,
      description:
        partial.data.description === undefined ? current.description : partial.data.description,
      sourceUrl: partial.data.sourceUrl === undefined ? current.sourceUrl : partial.data.sourceUrl,
    });
    if (!merged.success) return validationError(merged.error);

    const { count } = await prisma.calendarEntry.updateMany({
      where: { id, userId },
      data: { ...merged.data, eventDate: parseDateOnly(merged.data.eventDate)! },
    });
    if (count === 0) return failure("Not found", 404);
    const updated = await prisma.calendarEntry.findFirst({ where: { id, userId } });
    if (!updated) return failure("Not found", 404);
    invalidateCalendarEntryCaches(userId);
    return ok(serializeCalendarEntry(updated));
  } catch (error) {
    log.error("calendar_entries.update_failed", { userId, error: String(error) });
    return failure("Failed to update calendar entry", 500);
  }
});

export const DELETE = withAuth<IdCtx>(async (_request, { params }, userId) => {
  try {
    const { id } = await params;
    const current = await prisma.calendarEntry.findFirst({ where: { id, userId } });
    if (!current) return failure("Not found", 404);
    const { count } = await prisma.calendarEntry.deleteMany({ where: { id, userId } });
    if (count === 0) return failure("Not found", 404);
    invalidateCalendarEntryCaches(userId);
    return ok({ ok: true });
  } catch (error) {
    log.error("calendar_entries.delete_failed", { userId, error: String(error) });
    return failure("Failed to delete calendar entry", 500);
  }
});
```

Add route tests for update/delete exceptions that assert generic `500` responses and logger calls.

- [ ] **Step 5: Run route and validator tests**

Run:

```bash
pnpm exec vitest run tests/unit/calendar-entries-route.test.ts tests/unit/validators.test.ts
pnpm typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/calendar-entries tests/unit/calendar-entries-route.test.ts
git commit -m "feat: add calendar entry CRUD api"
```

---

### Task 5: Upgrade Whole-App Backup Compatibility to v1.4

**Files:**
- Modify: `src/lib/validators.ts`
- Modify: `src/app/api/settings/data/route.ts`
- Modify: `src/components/settings/data-management.tsx`
- Modify: `messages/en-US.json`
- Modify: `messages/zh-TW.json`
- Modify: `tests/unit/validators.test.ts`
- Modify: `tests/unit/rate-limited-routes.test.ts`
- Create: `tests/unit/calendar-backup-route.test.ts`

**Interfaces:**
- Consumes: Task 3 Calendar invariants and Task 1 database model.
- Produces:
  - Backup version `"1.4"`
  - Optional `calendarEntries` import array
  - Calendar replacement inside the existing transaction
  - `calendarEntries` count in `ImportPreview`

- [ ] **Step 1: Write failing import-schema compatibility tests**

Add to the `dataImportSchema` suite in `tests/unit/validators.test.ts`:

```ts
it("accepts a v1.3 backup without calendarEntries", () => {
  const result = dataImportSchema.safeParse({ version: "1.3", accounts: [] });
  expect(result.success).toBe(true);
  if (result.success) expect(result.data.calendarEntries).toBeUndefined();
});

it("round-trips valid v1.4 calendar entries", () => {
  const result = dataImportSchema.safeParse({
    version: "1.4",
    accounts: [],
    calendarEntries: [
      {
        title: "US CPI",
        eventDate: "2026-08-12",
        startTimeMinutes: 510,
        timeZone: "Asia/Taipei",
        category: "ECONOMIC_INDICATOR",
        description: "Consensus 2.8%",
        sourceUrl: "https://example.gov/cpi",
        createdAt: "2026-07-24T01:00:00.000Z",
        updatedAt: "2026-07-24T02:00:00.000Z",
      },
    ],
  });
  expect(result.success).toBe(true);
});

it("rejects invalid calendar time pairs and non-http source URLs in backups", () => {
  const base = {
    version: "1.4",
    accounts: [],
    calendarEntries: [
      {
        title: "US CPI",
        eventDate: "2026-08-12",
        startTimeMinutes: 510,
        timeZone: null,
        category: "ECONOMIC_INDICATOR",
      },
    ],
  };
  expect(dataImportSchema.safeParse(base).success).toBe(false);
  expect(
    dataImportSchema.safeParse({
      ...base,
      calendarEntries: [
        {
          ...base.calendarEntries[0],
          startTimeMinutes: null,
          sourceUrl: "javascript:alert(1)",
        },
      ],
    }).success,
  ).toBe(false);
});
```

- [ ] **Step 2: Extend the import schema with a bounded Calendar array**

In `src/lib/validators.ts`, add:

```ts
const MAX_IMPORT_CALENDAR_ENTRIES = 10_000;
```

Add this optional field to `dataImportSchema`:

```ts
  calendarEntries: z
    .array(
      calendarEntryInputSchema.safeExtend({
        createdAt: importTimestamp,
        updatedAt: importTimestamp,
      }),
    )
    .max(MAX_IMPORT_CALENDAR_ENTRIES)
    .optional(),
```

Run:

```bash
pnpm exec vitest run tests/unit/validators.test.ts
```

Expected: PASS, including older backup compatibility.

- [ ] **Step 3: Write failing export/import route tests**

Create `tests/unit/calendar-backup-route.test.ts`. The hoisted transaction mock must contain these exact methods:

```ts
const tx = {
  account: { deleteMany: vi.fn() },
  netWorthSnapshot: { deleteMany: vi.fn(), createMany: vi.fn() },
  goal: { deleteMany: vi.fn(), createMany: vi.fn() },
  stockWatchItem: { deleteMany: vi.fn(), createMany: vi.fn() },
  calendarEntry: { deleteMany: vi.fn(), createMany: vi.fn() },
  setting: { upsert: vi.fn() },
};
```

Mock `prisma.$transaction` as `vi.fn(async (callback) => callback(tx))`, `prisma.exchangeRate.findMany` as an empty array, and `prisma.user.findUnique` as a user with empty app relations plus `calendarEntries: [calendarFixture]`. Mock `resolveRate` to return `1`, `refreshExchangeRates`/`refreshPricesForUser` as resolved promises, `after` to execute its callback, `rateLimitCheckWithPrune` to return `null`, and `withAuth` to inject `"user_1"`. Then add:

```ts
it("exports calendar entries in backup v1.4", async () => {
  const response = await GET(new Request("http://unit.test/api/settings/data"), undefined);
  const json = await response.json();
  expect(json.version).toBe("1.4");
  expect(json.calendarEntries).toEqual([calendarFixture]);
});

it("replaces calendar entries inside the import transaction", async () => {
  const response = await POST(
    new Request("http://unit.test/api/settings/data", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        version: "1.4",
        accounts: [],
        calendarEntries: [
          {
            title: "US CPI",
            eventDate: "2026-08-12",
            startTimeMinutes: null,
            timeZone: null,
            category: "ECONOMIC_INDICATOR",
          },
        ],
      }),
    }),
    undefined,
  );
  expect(response.status).toBe(200);
  expect(tx.calendarEntry.deleteMany).toHaveBeenCalledWith({ where: { userId: "user_1" } });
  expect(tx.calendarEntry.createMany).toHaveBeenCalledWith({
    data: [
      expect.objectContaining({
        userId: "user_1",
        title: "US CPI",
        eventDate: new Date("2026-08-12T00:00:00.000Z"),
      }),
    ],
  });
  expect(revalidateTag).toHaveBeenCalledWith("calendar-entries:user_1", { expire: 0 });
});

it("imports an older backup as an empty calendar replacement", async () => {
  const response = await importBackup({ version: "1.3", accounts: [] });
  expect(response.status).toBe(200);
  expect(tx.calendarEntry.deleteMany).toHaveBeenCalled();
  expect(tx.calendarEntry.createMany).not.toHaveBeenCalled();
});
```

Use a fresh in-memory transaction mock per test so call assertions cannot leak.

- [ ] **Step 4: Update export and atomic replacement import**

In `src/app/api/settings/data/route.ts`, import `serializeCalendarEntry` from `@/lib/types`, then:

1. Add `calendarEntries: true` to the `prisma.user.findUnique(...include)` object.
2. Change `version: "1.3"` to `version: "1.4"`.
3. Add `calendarEntries: data.calendarEntries.map(serializeCalendarEntry)` to `exportData`. Do not export raw Prisma dates: the backup contract requires `eventDate` to remain `YYYY-MM-DD`.
4. Add `await tx.calendarEntry.deleteMany({ where: { userId } });` beside the other user-scoped deletes.
5. After stock-watch import, recreate Calendar entries:

```ts
if (Array.isArray(importData.calendarEntries) && importData.calendarEntries.length > 0) {
  await tx.calendarEntry.createMany({
    data: importData.calendarEntries.map((entry) => ({
      userId,
      title: entry.title,
      eventDate: new Date(`${entry.eventDate}T00:00:00.000Z`),
      startTimeMinutes: entry.startTimeMinutes,
      timeZone: entry.timeZone,
      category: entry.category,
      description: entry.description ?? null,
      sourceUrl: entry.sourceUrl ?? null,
      ...(entry.createdAt && { createdAt: new Date(entry.createdAt) }),
      ...(entry.updatedAt && { updatedAt: new Date(entry.updatedAt) }),
    })),
  });
}
```

6. Extend `invalidateImportCaches(userId)`:

```ts
  revalidateTag("calendar-entries", { expire: 0 });
  revalidateTag(`calendar-entries:${userId}`, { expire: 0 });
```

Keep deletion and recreation inside the existing `$transaction` so a failed Calendar insert rolls back every replacement.

- [ ] **Step 5: Update test export fixtures**

In `tests/unit/rate-limited-routes.test.ts`, add `calendarEntries: []` to the mocked user export result. Run:

```bash
pnpm exec vitest run tests/unit/rate-limited-routes.test.ts tests/unit/calendar-backup-route.test.ts
```

Expected: PASS.

- [ ] **Step 6: Add Calendar count to the import preview**

In `src/components/settings/data-management.tsx`:

- Add `calendarEntries: number` to `ImportPreview`.
- Return `calendarEntries: countArray(data.calendarEntries)` from `buildImportPreview`.
- Add a preview `<dl>` item:

```tsx
<div>
  <dt className="text-xs text-muted-foreground">{t("calendarEntriesCount")}</dt>
  <dd className="font-medium tabular-nums">{importPreview.calendarEntries}</dd>
</div>
```

Add these strings:

```json
// messages/en-US.json, dataManagement
"calendarEntriesCount": "Calendar entries"
```

```json
// messages/zh-TW.json, dataManagement
"calendarEntriesCount": "行事曆項目"
```

- [ ] **Step 7: Run backup verification and commit**

Run:

```bash
pnpm exec vitest run tests/unit/validators.test.ts tests/unit/rate-limited-routes.test.ts tests/unit/calendar-backup-route.test.ts
pnpm typecheck
```

Expected: PASS.

```bash
git add src/lib/validators.ts src/app/api/settings/data/route.ts src/components/settings/data-management.tsx messages/en-US.json messages/zh-TW.json tests/unit/validators.test.ts tests/unit/rate-limited-routes.test.ts tests/unit/calendar-backup-route.test.ts
git commit -m "feat: include calendar entries in backups"
```

---

### Task 6: Build the Calendar Grid, Agenda, and Localized Presentation

**Files:**
- Create: `src/components/calendar/calendar-category-badge.tsx`
- Create: `src/components/calendar/calendar-month-grid.tsx`
- Create: `src/components/calendar/calendar-day-agenda.tsx`
- Create: `src/components/calendar/calendar-view.tsx`
- Modify: `messages/en-US.json`
- Modify: `messages/zh-TW.json`
- Create: `tests/unit/calendar-view-model.test.ts`

**Interfaces:**
- Consumes:
  - `SerializedCalendarEntry`
  - date utilities from Task 2
- Produces:
  - `CalendarCategoryBadge`
  - `CalendarMonthGrid`
  - `CalendarDayAgenda`
  - `CalendarView`
  - pure exports `groupCalendarEntriesByDate(entries)`, `sortCalendarDayEntries(entries)`, and `formatCalendarWallClock(minutes, locale)`

- [ ] **Step 1: Write failing view-model tests**

Create `tests/unit/calendar-view-model.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  formatCalendarWallClock,
  groupCalendarEntriesByDate,
  sortCalendarDayEntries,
} from "@/components/calendar/calendar-view-model";

const base = {
  userId: "user_1",
  eventDate: "2026-08-12",
  timeZone: null,
  category: "OTHER" as const,
  description: null,
  sourceUrl: null,
  updatedAt: "2026-07-24T00:00:00.000Z",
};

describe("calendar view model", () => {
  it("sorts all-day entries before timed entries with stable created/id ties", () => {
    const entries = [
      { ...base, id: "late", title: "Late", startTimeMinutes: 900, createdAt: "2026-07-02T00:00:00.000Z" },
      { ...base, id: "all", title: "All", startTimeMinutes: null, createdAt: "2026-07-03T00:00:00.000Z" },
      { ...base, id: "early-b", title: "Early B", startTimeMinutes: 510, createdAt: "2026-07-02T00:00:00.000Z" },
      { ...base, id: "early-a", title: "Early A", startTimeMinutes: 510, createdAt: "2026-07-01T00:00:00.000Z" },
    ];
    expect(sortCalendarDayEntries(entries).map((entry) => entry.id)).toEqual([
      "all",
      "early-a",
      "early-b",
      "late",
    ]);
  });

  it("groups entries without mutating the input", () => {
    const entries = [
      { ...base, id: "a", title: "A", startTimeMinutes: null, createdAt: "2026-07-01T00:00:00.000Z" },
      { ...base, id: "b", title: "B", eventDate: "2026-08-13", startTimeMinutes: null, createdAt: "2026-07-02T00:00:00.000Z" },
    ];
    expect([...groupCalendarEntriesByDate(entries).keys()]).toEqual(["2026-08-12", "2026-08-13"]);
    expect(entries.map((entry) => entry.id)).toEqual(["a", "b"]);
  });

  it("localizes wall-clock display without shifting the stored time", () => {
    expect(formatCalendarWallClock(510, "en-US")).toBe("8:30 AM");
    expect(formatCalendarWallClock(510, "en-GB")).toBe("08:30");
  });
});
```

- [ ] **Step 2: Implement the pure view model**

Create `src/components/calendar/calendar-view-model.ts`:

```ts
import type { SerializedCalendarEntry } from "@/lib/types";

export function sortCalendarDayEntries(entries: readonly SerializedCalendarEntry[]) {
  return [...entries].sort((a, b) => {
    if (a.startTimeMinutes === null && b.startTimeMinutes !== null) return -1;
    if (a.startTimeMinutes !== null && b.startTimeMinutes === null) return 1;
    const time = (a.startTimeMinutes ?? -1) - (b.startTimeMinutes ?? -1);
    if (time !== 0) return time;
    const created = a.createdAt.localeCompare(b.createdAt);
    return created !== 0 ? created : a.id.localeCompare(b.id);
  });
}

export function groupCalendarEntriesByDate(entries: readonly SerializedCalendarEntry[]) {
  const groups = new Map<string, SerializedCalendarEntry[]>();
  for (const entry of entries) {
    const day = groups.get(entry.eventDate) ?? [];
    day.push(entry);
    groups.set(entry.eventDate, day);
  }
  for (const [date, day] of groups) groups.set(date, sortCalendarDayEntries(day));
  return groups;
}

export function formatCalendarWallClock(minutes: number, locale: string) {
  const date = new Date(Date.UTC(1970, 0, 1, Math.floor(minutes / 60), minutes % 60));
  return new Intl.DateTimeFormat(locale, {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(date);
}
```

Run:

```bash
pnpm exec vitest run tests/unit/calendar-view-model.test.ts
```

Expected: PASS.

- [ ] **Step 3: Add the complete Calendar translation namespace**

Add `nav.calendar: "Calendar"` / `"行事曆"` and a top-level `calendar` namespace in both message files. Include exact keys for:

```json
{
  "title": "Calendar",
  "subtitle": "Track financial reports, economic releases, and reminders.",
  "addEntry": "Add entry",
  "editEntry": "Edit entry",
  "deleteEntry": "Delete entry",
  "previousMonth": "Previous month",
  "nextMonth": "Next month",
  "today": "Today",
  "selectedDate": "Selected date",
  "entryCount": "{count, plural, =0 {No entries} =1 {1 entry} other {# entries}}",
  "entriesOnDate": "{count, plural, =0 {No entries on {date}} =1 {1 entry on {date}} other {# entries on {date}}}",
  "emptyTitle": "Nothing scheduled",
  "emptyDescription": "Add a report, economic release, or reminder for this day.",
  "allDay": "All day",
  "source": "Open source",
  "edit": "Edit",
  "delete": "Delete",
  "deleteTitle": "Delete calendar entry?",
  "deleteDescription": "This permanently removes “{title}”.",
  "deleteSuccess": "Calendar entry deleted",
  "deleteFailure": "Could not delete calendar entry",
  "saving": "Saving…",
  "categories": {
    "EARNINGS": "Earnings",
    "ECONOMIC_INDICATOR": "Economic indicator",
    "DIVIDEND": "Dividend",
    "FILING": "Filing",
    "REMINDER": "Reminder",
    "OTHER": "Other"
  }
}
```

Use this exact Traditional Chinese block:

```json
{
  "title": "行事曆",
  "subtitle": "追蹤財務報告、經濟數據發布與提醒。",
  "addEntry": "新增項目",
  "editEntry": "編輯項目",
  "deleteEntry": "刪除項目",
  "previousMonth": "上個月",
  "nextMonth": "下個月",
  "today": "今天",
  "selectedDate": "所選日期",
  "entryCount": "{count, plural, =0 {沒有項目} other {# 個項目}}",
  "entriesOnDate": "{count, plural, =0 {{date}沒有項目} other {{date}有 # 個項目}}",
  "emptyTitle": "尚無安排",
  "emptyDescription": "為這一天新增報告、經濟數據或提醒。",
  "allDay": "全天",
  "source": "開啟來源",
  "edit": "編輯",
  "delete": "刪除",
  "deleteTitle": "刪除行事曆項目？",
  "deleteDescription": "這會永久刪除「{title}」。",
  "deleteSuccess": "已刪除行事曆項目",
  "deleteFailure": "無法刪除行事曆項目",
  "saving": "儲存中…",
  "categories": {
    "EARNINGS": "財報",
    "ECONOMIC_INDICATOR": "經濟指標",
    "DIVIDEND": "股息",
    "FILING": "申報文件",
    "REMINDER": "提醒",
    "OTHER": "其他"
  }
}
```

- [ ] **Step 4: Implement the category badge**

Create `calendar-category-badge.tsx` as a client-safe presentational component. Map each category to existing token classes such as `bg-primary/10 text-primary`, `bg-chart-2/15 text-foreground`, and `bg-muted text-muted-foreground`; always render `t("categories.<CATEGORY>")` as visible text.

Public props:

```ts
export function CalendarCategoryBadge({
  category,
  compact = false,
}: {
  category: CalendarEntryCategoryValue;
  compact?: boolean;
})
```

When `compact` is true, render a dot plus visually hidden category label; otherwise render a rounded text badge.

- [ ] **Step 5: Implement the accessible six-week month grid**

Create `calendar-month-grid.tsx` with props:

```ts
type CalendarMonthGridProps = {
  month: string;
  selectedDate: string;
  today: string;
  entriesByDate: ReadonlyMap<string, readonly SerializedCalendarEntry[]>;
  locale: string;
  onSelectDate: (date: string) => void;
};
```

Required implementation behavior:

- Render weekday headers Monday through Sunday using `Intl.DateTimeFormat(locale, { weekday: "short", timeZone: "UTC" })`.
- Render exactly `buildMonthGrid(month)` as 42 `role="gridcell"` wrappers containing date buttons in a seven-column `role="grid"`.
- Use `aria-current="date"` only for today, `aria-selected` for selection, and a localized full-date plus entry-count `aria-label`.
- Give selection a two-pixel focus-like ring and today a separate small `Today`/`今天` text marker below the number; preserve both treatments when today is selected so neither state depends on color alone.
- Muted adjacent-month days remain interactive.
- For each populated day, render up to three distinct compact `CalendarCategoryBadge` markers and an accessible count label; if more than three categories exist, render a visible `+N` remainder.
- Use roving `tabIndex`: selected day is `0`; other cells are `-1`.
- Key mapping:

```ts
const delta =
  event.key === "ArrowLeft" ? -1 :
  event.key === "ArrowRight" ? 1 :
  event.key === "ArrowUp" ? -7 :
  event.key === "ArrowDown" ? 7 :
  event.key === "Home" ? -((index % 7)) :
  event.key === "End" ? 6 - (index % 7) :
  null;
```

For `PageUp`/`PageDown`, call `onSelectDate(moveCalendarMonth(date, -1/1))`; for other mapped keys call `onSelectDate(addCalendarDays(date, delta))`. Prevent default and focus the newly selected cell after the URL update. Selecting an adjacent day invokes `onSelectDate`, and `CalendarView` makes that day’s month active.

- [ ] **Step 6: Implement the selected-day agenda**

Create `calendar-day-agenda.tsx` with:

```ts
type CalendarDayAgendaProps = {
  date: string;
  entries: readonly SerializedCalendarEntry[];
  locale: string;
  onAdd: () => void;
  onEdit: (entry: SerializedCalendarEntry) => void;
  onDeleted: () => void;
};
```

Render the localized date heading and count, then:

- Empty state with `emptyTitle`, `emptyDescription`, and Add entry button.
- Sorted rows showing `CalendarCategoryBadge`, visible category text, title, optional description preview, and either `allDay` or `HH:mm · <timezone>`.
- Format minutes with `formatCalendarWallClock(minutes, locale)`. Its fixed UTC dummy date is only a locale-formatting carrier; it does not convert the stored wall-clock value or change `eventDate`:

```ts
const wallClock = formatCalendarWallClock(entry.startTimeMinutes, locale);
```

- Source link with `target="_blank"` and `rel="noopener noreferrer"`.
- Named Edit and Delete buttons.
- Delete confirmation using `AlertDialog`; on confirm call `DELETE /api/calendar-entries/:id`, keep the row on failure, toast localized success/failure, and call `onDeleted()` only after a successful response.

- [ ] **Step 7: Implement the coordinator shell without the form**

Create `calendar-view.tsx` with props:

```ts
type CalendarViewProps = {
  initialEntries: SerializedCalendarEntry[];
  month: string;
  selectedDate: string;
  today: string;
  locale: string;
  showHeader?: boolean;
};
```

Use `useRouter()` and `usePathname()` to update query state:

```ts
function navigate(date: string) {
  const params = new URLSearchParams(window.location.search);
  params.set("month", date.slice(0, 7));
  params.set("date", date);
  router.replace(`${pathname}?${params.toString()}${window.location.hash}`, { scroll: false });
}
```

Render:

- Optional title/subtitle. `showHeader={false}` hides only this title block; the primary Add entry button remains visible in the toolbar on both desktop and mobile.
- Toolbar with previous month, Today, next month, and Add entry. Previous/next call `navigate(moveCalendarMonth(selectedDate, amount))`; Today calls `navigate(today)`.
- `md:grid md:grid-cols-[minmax(0,1fr)_minmax(20rem,0.42fr)]`.
- Grid left and agenda right; stacked naturally on mobile.
- `groupCalendarEntriesByDate(initialEntries)` memoized by `initialEntries`.
- Temporary form-open/edit-target state wired to `onAdd`/`onEdit`; Task 7 renders `CalendarEntryForm` from that already-defined state.

- [ ] **Step 8: Run focused verification and commit**

Run:

```bash
pnpm exec vitest run tests/unit/calendar-date.test.ts tests/unit/calendar-view-model.test.ts
pnpm typecheck
pnpm lint src/components/calendar messages/en-US.json messages/zh-TW.json
```

Expected: PASS.

```bash
git add src/components/calendar messages/en-US.json messages/zh-TW.json tests/unit/calendar-view-model.test.ts
git commit -m "feat: build calendar month and agenda views"
```

---

### Task 7: Add the Responsive Entry Form and Mutation Flow

**Files:**
- Create: `src/components/calendar/calendar-entry-form.tsx`
- Modify: `src/components/calendar/calendar-view.tsx`
- Modify: `messages/en-US.json`
- Modify: `messages/zh-TW.json`
- Create: `tests/unit/calendar-entry-form.test.ts`

**Interfaces:**
- Consumes: CRUD routes from Task 4, `SerializedCalendarEntry`, Dialog/Drawer primitives, `useIsMobile`.
- Produces:
  - `minutesToTimeInput(minutes): string`
  - `timeInputToMinutes(value): number | null`
  - `resolveEntryTimeZone(existing): string`
  - `CalendarEntryForm`

- [ ] **Step 1: Write failing pure form-helper tests**

Create `tests/unit/calendar-entry-form.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import {
  minutesToTimeInput,
  resolveEntryTimeZone,
  timeInputToMinutes,
} from "@/components/calendar/calendar-entry-form-utils";

describe("calendar entry form helpers", () => {
  it("converts between input time and minutes", () => {
    expect(timeInputToMinutes("08:30")).toBe(510);
    expect(timeInputToMinutes("")).toBeNull();
    expect(minutesToTimeInput(510)).toBe("08:30");
    expect(minutesToTimeInput(null)).toBe("");
  });

  it("preserves an existing timed entry timezone", () => {
    expect(resolveEntryTimeZone("America/New_York", "Asia/Taipei")).toBe("America/New_York");
  });

  it("uses the valid browser timezone or UTC fallback for a new timed entry", () => {
    expect(resolveEntryTimeZone(null, "Asia/Taipei")).toBe("Asia/Taipei");
    expect(resolveEntryTimeZone(null, "Mars/Olympus")).toBe("UTC");
    expect(resolveEntryTimeZone(null, "")).toBe("UTC");
  });
});
```

- [ ] **Step 2: Implement form helpers**

Create `src/components/calendar/calendar-entry-form-utils.ts`:

```ts
export function minutesToTimeInput(minutes: number | null): string {
  if (minutes === null) return "";
  return `${Math.floor(minutes / 60).toString().padStart(2, "0")}:${(minutes % 60)
    .toString()
    .padStart(2, "0")}`;
}

export function timeInputToMinutes(value: string): number | null {
  if (!value) return null;
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

function isValidTimeZone(value: string) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format();
    return true;
  } catch {
    return false;
  }
}

export function resolveEntryTimeZone(existing: string | null, browserTimeZone: string): string {
  if (existing && isValidTimeZone(existing)) return existing;
  return isValidTimeZone(browserTimeZone) ? browserTimeZone : "UTC";
}
```

Run:

```bash
pnpm exec vitest run tests/unit/calendar-entry-form.test.ts
```

Expected: PASS.

- [ ] **Step 3: Add form translations**

Extend both `calendar` namespaces with keys for:

```json
{
  "form": {
    "createTitle": "Add calendar entry",
    "editTitle": "Edit calendar entry",
    "title": "Title",
    "titlePlaceholder": "e.g. US CPI report",
    "date": "Date",
    "time": "Time",
    "timeOptional": "Optional — leave empty for an all-day entry",
    "timeZone": "Timezone: {timeZone}",
    "category": "Category",
    "description": "Description",
    "descriptionPlaceholder": "Add context, expectations, or follow-up notes",
    "sourceUrl": "Source URL",
    "sourceUrlPlaceholder": "https://…",
    "cancel": "Cancel",
    "create": "Add entry",
    "save": "Save changes",
    "created": "Calendar entry added",
    "updated": "Calendar entry updated",
    "failed": "Could not save calendar entry",
    "titleRequired": "Enter a title",
    "dateInvalid": "Choose a valid date",
    "timeInvalid": "Choose a valid time",
    "categoryInvalid": "Choose a category",
    "sourceInvalid": "Use a valid http or https URL"
  }
}
```

Use this exact Traditional Chinese form block:

```json
{
  "form": {
    "createTitle": "新增行事曆項目",
    "editTitle": "編輯行事曆項目",
    "title": "標題",
    "titlePlaceholder": "例如：美國 CPI 報告",
    "date": "日期",
    "time": "時間",
    "timeOptional": "選填—留空即為全天項目",
    "timeZone": "時區：{timeZone}",
    "category": "類別",
    "description": "說明",
    "descriptionPlaceholder": "新增背景、預期或後續備註",
    "sourceUrl": "來源網址",
    "sourceUrlPlaceholder": "https://…",
    "cancel": "取消",
    "create": "新增項目",
    "save": "儲存變更",
    "created": "已新增行事曆項目",
    "updated": "已更新行事曆項目",
    "failed": "無法儲存行事曆項目",
    "titleRequired": "請輸入標題",
    "dateInvalid": "請選擇有效日期",
    "timeInvalid": "請選擇有效時間",
    "categoryInvalid": "請選擇類別",
    "sourceInvalid": "請使用有效的 http 或 https 網址"
  }
}
```

- [ ] **Step 4: Implement the responsive form**

Create `calendar-entry-form.tsx` with props:

```ts
type CalendarEntryFormProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedDate: string;
  entry: SerializedCalendarEntry | null;
  onSaved: () => void;
};
```

Implementation requirements:

- Reset local fields whenever the dialog opens; edit uses the entry values, create uses `selectedDate`, category `OTHER`, and empty optional fields.
- Use native date and time inputs, existing `Select`, `Textarea`, `Dialog`, and mobile `Drawer`.
- Capture browser timezone only when submitting a non-empty time for a new/all-day entry:

```ts
const minutes = timeInputToMinutes(time);
const browserTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone ?? "";
const timeZone =
  minutes === null ? null : resolveEntryTimeZone(entry?.timeZone ?? null, browserTimeZone);
```

- Submit all mutation fields explicitly:

```ts
const payload = {
  title,
  eventDate,
  startTimeMinutes: minutes,
  timeZone,
  category,
  description,
  sourceUrl,
};
```

- POST to `/api/calendar-entries` for create and PATCH `/api/calendar-entries/${entry.id}` for edit.
- Parse `{ error: { message, issues } }`; map `issues.fieldErrors` to inline localized messages for title/date/time/category/source. Do not surface the route's hard-coded generic English message directly: non-validation and network failures use `t("form.failed")`, keep every field value intact, and leave the form open for retry.
- Disable inputs and submit while saving. Close and call `onSaved()` only after a 2xx response.
- Show the resolved timezone helper as soon as the Time input is non-empty.
- Render `Drawer` on mobile and `Dialog` on desktop, matching `SnapshotLabelDialog`.

- [ ] **Step 5: Wire form and authoritative refresh into CalendarView**

In `calendar-view.tsx`:

- Keep `formOpen` and `editingEntry`.
- Add action sets `editingEntry(null)` and opens the form.
- Edit action sets the row and opens the form.
- `handleMutationComplete` closes the form, clears the target, then runs:

```ts
startTransition(() => router.refresh());
```

- Pass the same refresh callback to `CalendarDayAgenda.onDeleted`.
- Render:

```tsx
<CalendarEntryForm
  open={formOpen}
  onOpenChange={(open) => {
    setFormOpen(open);
    if (!open) setEditingEntry(null);
  }}
  selectedDate={selectedDate}
  entry={editingEntry}
  onSaved={handleMutationComplete}
/>
```

- [ ] **Step 6: Run form, route, and type verification**

Run:

```bash
pnpm exec vitest run tests/unit/calendar-entry-form.test.ts tests/unit/calendar-entries-route.test.ts
pnpm typecheck
pnpm lint src/components/calendar
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/components/calendar messages/en-US.json messages/zh-TW.json tests/unit/calendar-entry-form.test.ts
git commit -m "feat: add calendar entry form interactions"
```

---

### Task 8: Add the Desktop Calendar Route and Navigation

**Files:**
- Create: `src/app/(main)/calendar/page.tsx`
- Create: `src/app/(main)/calendar/loading.tsx`
- Modify: `src/components/layout/sidebar.tsx`
- Modify: `src/components/layout/desktop-command-palette.tsx`
- Modify: `src/components/layout/lazy-command-palette.tsx`
- Modify: `messages/en-US.json`
- Modify: `messages/zh-TW.json`
- Create: `tests/unit/calendar-page-source.test.ts`

**Interfaces:**
- Consumes: Task 2 URL normalization/range helpers, Task 3 service, Task 6–7 `CalendarView`.
- Produces: standalone desktop `/calendar` and shortcut sequence 1–9.

- [ ] **Step 1: Write a failing page/source invariant test**

Create `tests/unit/calendar-page-source.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

describe("calendar route integration", () => {
  it("loads a bounded range through the service and renders CalendarView", () => {
    const source = fs.readFileSync(path.join(root, "src/app/(main)/calendar/page.tsx"), "utf8");
    expect(source).toContain("normalizeCalendarUrlState");
    expect(source).toContain("getVisibleCalendarRange");
    expect(source).toContain("getCalendarEntriesInRange");
    expect(source).toContain("<CalendarView");
  });

  it("keeps desktop navigation and shortcuts in the same order", () => {
    const lazy = fs.readFileSync(
      path.join(root, "src/components/layout/lazy-command-palette.tsx"),
      "utf8",
    );
    expect(lazy).toContain('"/calendar"');
    expect(lazy).toContain("/^[1-9]$/");
    expect(lazy).toContain('key === "c"');
  });
});
```

- [ ] **Step 2: Implement the Server Component page**

Create `src/app/(main)/calendar/page.tsx`. Its `searchParams` type is:

```ts
type CalendarPageProps = {
  searchParams: Promise<{ month?: string; date?: string }>;
};
```

Inside the authenticated content function:

1. Resolve the session.
2. Normalize search params using `normalizeCalendarUrlState(await searchParams)`.
3. Compute `{ from, to } = getVisibleCalendarRange(month)`.
4. Fetch `messages`, `locale`, and `getCalendarEntriesInRange(userId, parseDateOnly(from)!, parseDateOnly(to)!)` in parallel.
5. Set `today = formatDateOnly(taiwanCalendarDay(new Date()))`.
6. Provide only `calendar`, `common`, and `nav` client namespaces through `pickMessages`.
7. Render:

```tsx
<CalendarView
  initialEntries={entries}
  month={month}
  selectedDate={date}
  today={today}
  locale={locale}
/>
```

Keep the page wrapper `space-y-4 md:space-y-8 animate-in fade-in duration-200`.

- [ ] **Step 3: Add a layout-matched route skeleton**

Create `src/app/(main)/calendar/loading.tsx` with:

- Title and action skeletons.
- Toolbar skeleton.
- Desktop two-column shell with a six-row, seven-column date grid and agenda rail.
- Mobile naturally stacked layout.
- Existing `Skeleton`, border, card, and background classes only.

- [ ] **Step 4: Insert Calendar into desktop navigation**

In `sidebar.tsx`, import `CalendarDays` and insert:

```ts
{ label: t("nav.calendar"), href: "/calendar", icon: CalendarDays },
```

between Projections and History.

In `desktop-command-palette.tsx`, import `CalendarDays`, insert Calendar with `kbd: "7"`, and shift History to `"8"` and Settings to `"9"`. Change navigation-help values from `1 2 3 4 5 6 7 8` / `1-8` to `1 2 3 4 5 6 7 8 9` / `1-9`.

In `lazy-command-palette.tsx`:

- Insert `"/calendar"` between `"/projections"` and `"/history"` in `NAV_HREFS`.
- Change `/^[1-8]$/` to `/^[1-9]$/`.
- Add `key === "c" ? "/calendar"` between projections and history in the `g` sequence.

Set the command-palette sequence strings exactly:

```json
// messages/en-US.json
"goSequence": "g then d/a/g/t/n/p/c/h/s"
```

```json
// messages/zh-TW.json
"goSequence": "先按 g 再按 d/a/g/t/n/p/c/h/s"
```

- [ ] **Step 5: Run focused verification**

Run:

```bash
pnpm exec vitest run tests/unit/calendar-page-source.test.ts tests/unit/calendar-date.test.ts tests/unit/calendar-entry-service.test.ts
pnpm typecheck
pnpm lint 'src/app/(main)/calendar' src/components/layout
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add 'src/app/(main)/calendar' src/components/layout messages/en-US.json messages/zh-TW.json tests/unit/calendar-page-source.test.ts
git commit -m "feat: add desktop calendar route and navigation"
```

---

### Task 9: Integrate Calendar into the Mobile Plan Hub

**Files:**
- Modify: `src/components/layout/mobile-hub-redirect.tsx`
- Modify: `src/app/(main)/calendar/page.tsx`
- Modify: `src/app/(main)/goals/page.tsx`
- Modify: `src/components/goals/goals-view.tsx`
- Modify: `tests/unit/mobile-hub-redirect.test.ts`
- Modify: `tests/e2e/mobile-plan.spec.ts`
- Create: `tests/unit/mobile-calendar-routing.test.ts`

**Interfaces:**
- Consumes: Calendar data and `CalendarView`.
- Produces:
  - `MobileHubRedirect({ hash, search? })`
  - fourth `MobilePlanTab` value `"calendar"`
  - `/calendar?...` mobile redirect to `/goals?...#calendar`

- [ ] **Step 1: Write failing redirect and source tests**

Create `tests/unit/mobile-calendar-routing.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("mobile calendar routing", () => {
  it("preserves Calendar query state in the mobile hub redirect", () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), "src/components/layout/mobile-hub-redirect.tsx"),
      "utf8",
    );
    expect(source).toContain('search = ""');
    expect(source).toContain("`/goals${search}${hash}`");
  });

  it("registers Calendar as the fourth Plan tab", () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), "src/components/goals/goals-view.tsx"),
      "utf8",
    );
    expect(source).toContain('"calendar"');
    expect(source).toContain("<CalendarView");
  });
});
```

- [ ] **Step 2: Extend the redirect while preserving existing callers**

Change `MobileHubRedirect` to:

```ts
export function MobileHubRedirect({
  hash,
  search = "",
}: {
  hash: `#${string}`;
  search?: string;
}) {
  const isMobile = useIsMobile();
  const router = useRouter();

  useEffect(() => {
    if (!isMobile) return;
    router.replace(`/goals${search}${hash}`);
  }, [isMobile, hash, search, router]);

  return null;
}
```

In `/calendar/page.tsx`, pass the server-normalized state so invalid raw parameters do not propagate:

```tsx
<MobileHubRedirect hash="#calendar" search={`?month=${month}&date=${date}`} />
```

Render it before the desktop-only wrapper. Hide the standalone `CalendarView` on mobile with `hidden md:block`, matching Stocks and Projections. Existing Stocks and Projections callers keep passing only `hash`, so they still redirect without a query string.

Extend `tests/unit/mobile-hub-redirect.test.ts` to include the Calendar page, assert it contains `hidden` and `md:block`, and assert the normalized `month`/`date` values are supplied to `MobileHubRedirect`.

- [ ] **Step 3: Load the Calendar range in the Plan Server Component**

Update `src/app/(main)/goals/page.tsx`:

- Accept the same `searchParams` shape as the Calendar page.
- Normalize Calendar state and compute its visible range.
- Add `calendar` to `CLIENT_NAMESPACES`.
- Add `getCalendarEntriesInRange(...)` to the existing `Promise.all`.
- Pass `calendarEntries`, `calendarMonth`, `calendarSelectedDate`, `calendarToday`, and active locale to `GoalsView`.

Do not change bare `/goals` behavior: it still resolves to Watchlist because there is no `#calendar`.

- [ ] **Step 4: Render the fourth mobile Plan tab**

In `goals-view.tsx`:

```ts
type MobilePlanTab = "watchlist" | "goals" | "projections" | "calendar";
```

Extend props with:

```ts
calendarEntries: SerializedCalendarEntry[];
calendarMonth: string;
calendarSelectedDate: string;
calendarToday: string;
locale: string;
```

Update `hashTab` so `#calendar` resolves to `"calendar"`, and render tab buttons in exact order:

```ts
["watchlist", "goals", "projections", "calendar"]
```

Use `tNav("calendar")` for the fourth label. Add:

```tsx
{activeTab === "calendar" && (
  <div role="tabpanel" className="md:hidden">
    <CalendarView
      initialEntries={calendarEntries}
      month={calendarMonth}
      selectedDate={calendarSelectedDate}
      today={calendarToday}
      locale={locale}
      showHeader={false}
    />
  </div>
)}
```

When Calendar changes month/date, `CalendarView` must preserve `#calendar` in the URL. Other Plan tab switches retain the current search string, as the existing `handleTabChange` already does.

- [ ] **Step 5: Extend mobile Plan E2E coverage**

Add to `tests/e2e/mobile-plan.spec.ts`:

```ts
test("Calendar is the fourth Plan tab and calendar deep links preserve state", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "Mobile Chrome", "Mobile-only calendar flow");

  await page.goto("/goals?month=2026-08&date=2026-08-12#calendar");
  const tablist = page.getByRole("tablist");
  const calendarTab = tablist.getByRole("tab", { name: "Calendar" });
  await expect(calendarTab).toHaveAttribute("aria-selected", "true");
  await expect(page).toHaveURL(/\/goals\?month=2026-08&date=2026-08-12#calendar$/);
  await expect(page.getByRole("grid")).toBeVisible();

  await page.goto("/calendar?month=2026-08&date=2026-08-12");
  await expect(page).toHaveURL(/\/goals\?month=2026-08&date=2026-08-12#calendar$/);
  await expect(calendarTab).toHaveAttribute("aria-selected", "true");
});
```

Also update the existing Plan tab test to assert tab order `Watchlist`, `Goals`, `Projections`, `Calendar`.

- [ ] **Step 6: Run focused verification and commit**

Run:

```bash
pnpm exec vitest run tests/unit/mobile-calendar-routing.test.ts tests/unit/mobile-hub-redirect.test.ts tests/unit/calendar-page-source.test.ts
pnpm typecheck
pnpm lint 'src/app/(main)/goals/page.tsx' src/components/goals src/components/layout/mobile-hub-redirect.tsx
```

Expected: PASS. Then run:

```bash
pnpm exec playwright test tests/e2e/mobile-plan.spec.ts --project="Mobile Chrome"
```

Expected: PASS.

```bash
git add src/components/layout/mobile-hub-redirect.tsx 'src/app/(main)/calendar/page.tsx' 'src/app/(main)/goals/page.tsx' src/components/goals/goals-view.tsx tests/unit/mobile-calendar-routing.test.ts tests/unit/mobile-hub-redirect.test.ts tests/e2e/mobile-plan.spec.ts
git commit -m "feat: add calendar to mobile plan hub"
```

---

### Task 10: Prove CRUD, Ordering, Keyboard, Accessibility, and Non-Goals End to End

**Files:**
- Create: `tests/e2e/calendar.spec.ts`

**Interfaces:**
- Consumes: completed Calendar feature.
- Produces: browser-level proof of desktop and mobile user journeys plus repository-wide green verification.

- [ ] **Step 1: Add an API cleanup helper and deterministic, non-overlapping dates**

In `tests/e2e/calendar.spec.ts`, create a helper:

```ts
async function clearCalendarRange(
  request: APIRequestContext,
  from: string,
  to: string,
) {
  const response = await request.get(`/api/calendar-entries?from=${from}&to=${to}`);
  expect(response.ok()).toBeTruthy();
  const body = await response.json();
  for (const entry of body.data as Array<{ id: string }>) {
    expect((await request.delete(`/api/calendar-entries/${entry.id}`)).ok()).toBeTruthy();
  }
}
```

Import `APIRequestContext` as a type from `@playwright/test`. The desktop CRUD test uses August 2031, keyboard test September 2032, and mobile test October 2033. Each test calls `clearCalendarRange` for its own 42-day grid before navigation; no test deletes another parallel test's data.

- [ ] **Step 2: Add the desktop CRUD and ordering test**

Add a Chromium-only test that:

1. Clears `2031-07-28` through `2031-09-07`, then visits `/calendar?month=2031-08&date=2031-08-12`.
2. Confirms 42 grid cells and the selected-day agenda.
3. Creates all-day `"ACME earnings"`.
4. Creates timed `"US CPI"` at `08:30`, category Economic indicator, description, and `https://example.com/cpi`.
5. Creates timed `"FOMC minutes"` at `14:00`.
6. Verifies DOM order `ACME earnings`, `US CPI`, `FOMC minutes`.
7. Edits `"US CPI"` to `"US CPI revised"` without changing its stored timezone.
8. Verifies the source anchor has `_blank` and a `rel` containing both `noopener` and `noreferrer`, clicks it, and asserts the popup URL is `https://example.com/cpi`.
9. Deletes `"FOMC minutes"` through confirmation and verifies it disappears.
10. Uses previous/next month and Today controls, asserting URL parameters change and remain present.

Use roles and visible labels, not styling selectors.

- [ ] **Step 3: Add keyboard navigation coverage**

In a Chromium-only test, first clear the range `2032-08-30` through `2032-10-10`, then:

```ts
await page.goto("/calendar?month=2032-09&date=2032-09-17");
const selected = page.getByRole("gridcell").getByRole("button", { name: /September 17, 2032/ });
await selected.focus();
await page.keyboard.press("Home");
await expect(page).toHaveURL(/date=2032-09-13/);
await page.keyboard.press("End");
await expect(page).toHaveURL(/date=2032-09-19/);

await page.goto("/calendar?month=2032-09&date=2032-09-17");
await page.getByRole("gridcell").getByRole("button", { name: /September 17, 2032/ }).focus();
await page.keyboard.press("ArrowRight");
await expect(page).toHaveURL(/date=2032-09-18/);
await page.keyboard.press("ArrowDown");
await expect(page).toHaveURL(/date=2032-09-25/);
await page.keyboard.press("PageDown");
await expect(page).toHaveURL(/month=2032-10&date=2032-10-25/);
await page.keyboard.press("PageUp");
await expect(page).toHaveURL(/month=2032-09&date=2032-09-25/);
await page.getByRole("button", { name: "Add entry" }).last().focus();
await page.keyboard.press("Enter");
await expect(page.getByRole("dialog", { name: "Add calendar entry" })).toBeVisible();
```

Assert the selected cell has `aria-selected="true"` and today's cell, when visible, has `aria-current="date"`.

- [ ] **Step 4: Add the mobile drawer flow**

Add a Mobile Chrome-only test that:

1. Clears `2033-09-26` through `2033-11-06`, then visits `/goals?month=2033-10&date=2033-10-18#calendar`.
2. Confirms Calendar tab selected and grid/agenda stacked.
3. Taps Add entry.
4. Verifies the entry form is in the drawer/dialog primitive visible on mobile.
5. Creates an all-day Reminder.
6. Verifies the new row after the drawer closes and authoritative refresh completes.

- [ ] **Step 5: Run the Calendar E2E suite**

Run:

```bash
pnpm exec playwright test tests/e2e/calendar.spec.ts tests/e2e/mobile-plan.spec.ts
```

Expected: PASS in both Chromium and Mobile Chrome, with project-specific tests skipping only on the opposite viewport.

- [ ] **Step 6: Run all focused unit suites**

Run:

```bash
pnpm exec vitest run \
  tests/unit/types.test.ts \
  tests/unit/calendar-date.test.ts \
  tests/unit/validators.test.ts \
  tests/unit/calendar-entry-service.test.ts \
  tests/unit/calendar-entries-route.test.ts \
  tests/unit/calendar-backup-route.test.ts \
  tests/unit/calendar-view-model.test.ts \
  tests/unit/calendar-entry-form.test.ts \
  tests/unit/calendar-page-source.test.ts \
  tests/unit/mobile-calendar-routing.test.ts \
  tests/unit/rate-limited-routes.test.ts
```

Expected: PASS.

- [ ] **Step 7: Run repository-wide quality gates**

Run:

```bash
pnpm format
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test:unit
pnpm build
git diff --check
```

Expected: every command exits 0. Review the build output to confirm `/calendar`, `/api/calendar-entries`, and `/api/calendar-entries/[id]` are present.

- [ ] **Step 8: Audit the future-integration boundary and non-goals**

Run:

```bash
sed -n '/model CalendarEntry {/,/^}/p' prisma/schema.prisma |
  rg -ni "google|oauth|ics|csv|recurr|notification|providerId|externalEvent"
rg -ni "google|oauth|ics|csv|recurr|notification|providerId|externalEvent" \
  src/app/api/calendar-entries src/components/calendar src/lib/services/calendar-entry-service.ts
```

Expected: both searches produce no output and exit 1, proving there is no Google/provider/auth/sync/ICS/CSV implementation and no recurrence or notification field in the Calendar domain. Benign UI copy such as “economic releases” is allowed.

Confirm manually:

- Every row has a stable app `id`, `updatedAt`, explicit `eventDate`, optional paired wall-clock/timezone, and source URL.
- No provider identifiers or sync state were added.
- No dashboard widget or sixth mobile bottom-nav item was added.

- [ ] **Step 9: Commit final E2E and verification fixes**

```bash
git add tests/e2e/calendar.spec.ts tests/e2e/mobile-plan.spec.ts
git commit -m "test: verify calendar entry workflows"
```

If formatting changed unrelated files, stage only the Calendar feature paths and leave unrelated user work untouched.

---

## Completion Checklist

- [ ] Prisma migration applies and generated client is current.
- [ ] Date-only fields never shift with browser/server timezone.
- [ ] All-day/timed pair invariants hold on create, partial update, and import.
- [ ] Range reads are authenticated, user-scoped, inclusive, and capped at 42 days.
- [ ] Desktop and mobile URL/deep-link behavior is stable.
- [ ] Grid supports mouse, touch, adjacent-month selection, and the approved keyboard map.
- [ ] Entry create/edit/delete is non-optimistic and failure-safe.
- [ ] English and Traditional Chinese strings are complete.
- [ ] Backup v1.4 round-trips Calendar entries; v1.3 and older backups remain importable.
- [ ] Existing desktop shortcut/help order is 1–9 with Calendar at 7.
- [ ] No Calendar-specific import/export or Google Calendar integration ships in v1.
- [ ] Focused tests, full unit suite, lint, typecheck, and production build pass.
