# Calendar Entries — Design

**Date:** 2026-07-24

**Scope:** A first-party calendar where users manually record financial reports, government economic indicators, dividends, filings, reminders, and other dated notes. Calendar-specific import/export and Google Calendar synchronization are future work.

## Background

Assets Tracker has date-based financial history, transactions, goals, projections, and recurring rules, but it has no place to record an upcoming report or economic release independently of those domains. Reusing `NetWorthSnapshot.note` would conflate valuation history with future events and allow only one snapshot-bound note per day.

The approved direction is a first-class, user-owned calendar-entry domain. Each entry has a stable identity and maps naturally to a future external calendar event, while v1 remains manual and deliberately lightweight.

## Goals

1. Let a user browse months and inspect one day's entries without leaving the page.
2. Let a user create, edit, and delete multiple entries on any date.
3. Support optional release times while preserving all-day entries.
4. Work naturally in the existing desktop sidebar and five-item mobile navigation.
5. Preserve the completeness of the existing whole-app JSON backup.
6. Keep domain and data boundaries suitable for later CSV/ICS and Google Calendar integration without implementing those integrations now.

## Non-goals

- Recurring or multi-day events
- Event durations, locations, attachments, invitees, or notifications
- Automatic government or market-data feeds
- Custom category management
- A dashboard calendar widget
- Calendar-specific CSV or ICS import/export
- Google Calendar authentication or synchronization
- Shared calendars or collaboration

## Approaches considered

### 1. First-class `CalendarEntry` domain — selected

Each entry is an independently addressable, user-owned row. This supports multiple entries per date, indexed range queries, CRUD ownership checks, complete backups, and eventual one-entry-to-one-external-event mapping.

### 2. Extend `NetWorthSnapshot`

This adds less initial structure, but snapshots represent recorded valuation history rather than future events. It cannot cleanly support multiple entries on a date and would make calendar retention depend on snapshot behavior.

### 3. Store one JSON calendar document per user

This is quick to prototype but makes validation, concurrent edits, range queries, migrations, backup merging, and future synchronization unnecessarily fragile.

## Domain model

Add a Prisma enum:

```prisma
enum CalendarEntryCategory {
  EARNINGS
  ECONOMIC_INDICATOR
  DIVIDEND
  FILING
  REMINDER
  OTHER
}
```

Add a Prisma model:

```prisma
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

Add `calendarEntries CalendarEntry[]` to `User`.

`eventDate` is the entry's explicit calendar day and is never inferred from a UTC timestamp. `startTimeMinutes` is an integer from `0` through `1439`. It stores the optional wall-clock time as minutes after midnight. `timeZone` stores the accompanying IANA timezone.

The following invariants are enforced by application validation:

- An all-day entry has both `startTimeMinutes` and `timeZone` set to `null`.
- A timed entry has both fields present.
- `timeZone` must be accepted by `Intl.DateTimeFormat`.
- Timed entries display their stored wall-clock time and timezone; v1 does not convert them into the viewer's current timezone or move their explicit `eventDate`.
- Title is trimmed and contains 1–120 characters.
- Description is at most 4,000 characters.
- Source URL is at most 2,048 characters and uses `http` or `https`.

There is no uniqueness constraint on date, time, or title. Multiple entries may intentionally describe the same day or release time.

## Serialization

Add a `SerializedCalendarEntry` contract in `src/lib/types.ts`:

- Dates are serialized as `YYYY-MM-DD`, not timestamps.
- `createdAt` and `updatedAt` are ISO timestamps.
- Optional database values are normalized to `null`.
- `startTimeMinutes` remains a number so sorting and form conversion do not depend on locale parsing.

The serializer is the boundary used by both the standalone Calendar page and the mobile Plan hub.

## Service and cache boundaries

Create `src/lib/services/calendar-entry-service.ts` with one read responsibility:

```ts
getCalendarEntriesInRange(userId, fromDate, toDate)
```

The range is inclusive and bounded to the 42 dates visible in a six-week month grid. Reads filter by both `userId` and `eventDate`, then serialize entries. Entries are ordered by date, with all-day entries first on each date, followed by timed entries in ascending time and a stable `createdAt` tiebreak.

The cached read uses:

- `calendar-entries`
- `calendar-entries:${userId}`
- An hours cache life, matching other user-owned domains

Mutations invalidate `calendar-entries:${userId}` immediately. Backup replacement invalidates the same tag after its transaction.

## Routes and validation

Add authenticated routes:

- `GET /api/calendar-entries?from=YYYY-MM-DD&to=YYYY-MM-DD`
- `POST /api/calendar-entries`
- `PATCH /api/calendar-entries/[id]`
- `DELETE /api/calendar-entries/[id]`

The standalone Server Component reads through the service directly. The authenticated `GET` route preserves a clean programmatic boundary for client refreshes and future consumers.

Add Zod schemas for creation, update, and bounded range queries. A range must have `from <= to` and may not exceed 42 inclusive dates. Mutation payloads accept:

- `title`
- `eventDate`
- `startTimeMinutes`
- `timeZone`
- `category`
- `description`
- `sourceUrl`

The item routes first resolve the row by `{ id, userId }`. A missing row and a cross-user row both return 404. Writes use the project's existing response helpers and authenticated route wrapper.

For partial updates, the item route validates the final state after merging the submitted fields with the stored row. This prevents a PATCH that changes only one member of the time/timezone pair from leaving an invalid record.

V1 uses last-write-wins for concurrent updates. `updatedAt` remains available for a later synchronization or optimistic-concurrency policy.

## Page and navigation

### Desktop

Add `/calendar` as a standalone route and a Calendar sidebar item between Projections and History. Add the same destination to the desktop command palette. Because the palette currently assigns numeric shortcuts to eight destinations, Calendar becomes shortcut 7, History becomes 8, Settings becomes 9, and the help copy changes from `1–8` to `1–9`.

The URL stores view state:

- `month=YYYY-MM`
- `date=YYYY-MM-DD`

Missing or invalid values fall back to the current app business day. Month navigation replaces the query parameters rather than keeping hidden client-only state, so refresh, Back, bookmarks, and deep links preserve the view.

Previous/next month navigation preserves the selected day of month when possible and clamps it to the target month's last day when necessary. Today resets both parameters to the current app business day.

### Mobile

The five-item bottom navigation remains unchanged. Calendar becomes a fourth sub-view of the Plan hub alongside Watchlist, Goals, and Projections.

The existing `MobileHubRedirect` pattern expands so a direct mobile visit to `/calendar` redirects to:

```text
/goals?month=YYYY-MM&date=YYYY-MM-DD#calendar
```

The redirect preserves valid Calendar query parameters. The Plan bottom-navigation item remains active while Calendar is displayed.

The `/goals` Server Component loads the visible Calendar range alongside the existing Plan data, and `GoalsView` recognizes `calendar` as a valid mobile tab. The bare Plan route continues to open Watchlist.

## Interface

The approved layout is **month plus selected-day panel**.

### Desktop layout

- Page title and primary Add entry action
- Previous month, Today, and next month controls
- Month grid on the left
- Selected-day agenda on the right

### Mobile layout

- Existing Plan sub-view navigation
- Month toolbar and grid
- Selected-day agenda stacked below the grid
- Entry form presented as a bottom drawer

### Month grid

- Always renders six Monday–Sunday weeks so layout height does not jump between months.
- Adjacent-month dates are visible and muted.
- Selecting an adjacent-month date moves the displayed month to that date.
- Today and the selected date have distinct, non-color-only states.
- Dates containing entries show compact category markers and an accessible entry-count label.
- Left/Right Arrow moves by one day, Up/Down Arrow by one week, Page Up/Page Down by one month, and Home/End to the beginning/end of the focused week. The separate Today control returns to today.
- Each date is a named button with full localized date and entry-count context.

### Selected-day agenda

- Shows the localized selected date and entry count.
- Orders all-day entries first, followed by timed entries.
- Each row shows category text, optional time and timezone, title, description preview, and source-link affordance.
- Category styling uses existing semantic/chart tokens, but the category name remains visible so color is never the only signal.
- Edit and Delete actions are available from each row.
- An empty date shows a short explanation and Add entry action.

### Entry form

Create `CalendarEntryForm`, rendered with the existing desktop `Dialog` and mobile `Drawer` pattern. Fields are:

1. Title — required
2. Date — required and seeded from the selected day
3. Time — optional
4. Category — required and seeded to `OTHER`
5. Description — optional
6. Source URL — optional

When a user creates a timed entry or adds a time to an all-day entry, the browser's `Intl.DateTimeFormat().resolvedOptions().timeZone` value is captured and shown as helper text. Editing an already-timed entry preserves its stored timezone even when the browser is currently in another timezone. If the browser does not expose a valid timezone when one must be captured, the form uses `UTC` and shows it explicitly. Clearing the time clears the timezone. V1 does not include a timezone picker.

The submit control is disabled while saving. Source URLs open in a new tab with `noopener` and `noreferrer`.

## Component boundaries

- `CalendarView` — coordinates URL-derived month/date, form state, and refresh behavior.
- `CalendarMonthGrid` — generates and renders the 42-day grid, keyboard movement, selection, and date indicators.
- `CalendarDayAgenda` — groups and renders the selected day's entries and row actions.
- `CalendarEntryForm` — owns create/edit field state and mutation submission.
- `CalendarCategoryBadge` — maps categories to localized labels and semantic presentation.
- `calendar-date.ts` — pure date-only parsing, formatting keys, visible-range calculation, and keyboard date arithmetic.

No component owns database access. No date helper accepts a locale-formatted date string.

## Data flow

1. The Server Component validates `month` and `date`, computes the visible 42-day range, and requests that range from the service.
2. The page passes serialized entries and normalized URL state to `CalendarView`.
3. Selecting a date updates the URL. Changing months updates both `month` and `date` to keep the selected date visible.
4. Create, edit, and delete actions call authenticated APIs.
5. A successful mutation invalidates the user cache tag.
6. The client closes the form when applicable, shows a success toast, and calls `router.refresh()`.

Writes are intentionally non-optimistic in v1. The existing server data remains authoritative, and disabled submit controls prevent duplicate requests.

## Error handling

- Field-level validation errors remain visible beside their fields.
- Network and unexpected server errors preserve form contents and display a retryable toast.
- A failed edit or delete leaves the current agenda unchanged.
- Delete requires confirmation before the request.
- Invalid URL state falls back to the current app business day rather than rendering an error page.
- Invalid category, date, time, timezone, or source URL payloads return the existing structured validation response.
- Missing and cross-user entries return 404 without disclosing ownership.
- The route layer logs unexpected failures through the existing logger and returns a generic message.

## Existing backup compatibility

Calendar-specific import/export remains out of scope, but the existing whole-app backup must remain complete.

- Bump the backup format from `1.3` to `1.4`.
- Add `calendarEntries` to export output.
- Add an optional `calendarEntries` array to `dataImportSchema`; absence means an empty array so v1.3 and earlier files remain valid.
- During replace import, delete the user's current Calendar entries and recreate the imported entries inside the same transaction.
- Validate the same date, time/timezone, category, length, and URL invariants used by the API.
- Invalidate the Calendar cache tag after a successful import.
- Add a Calendar-entry count to the existing import preview.

This work does not add CSV, ICS, or provider integration.

## Internationalization and accessibility

Add English and Traditional Chinese strings for:

- Navigation and command palette
- Page title, month controls, and entry counts
- Category names
- Form labels, helper text, validation, and buttons
- Empty, loading, success, and failure states
- Delete confirmation
- Backup import-preview count

Date and time presentation uses the active locale. The grid remains Monday-first by product decision.

Accessibility requirements:

- WCAG AA contrast and existing focus-ring tokens
- Touch targets consistent with current mobile controls
- Roving keyboard focus within the date grid
- Named previous, next, Today, Add, edit, and delete controls
- `aria-current="date"` for today and a separate selected state
- Dialog/drawer focus management through existing primitives
- Reduced-motion behavior through existing motion tokens
- Category labels and entry counts that do not depend on color

## Testing

### Unit tests

1. Generate six-week Monday-first grids across month and year boundaries.
2. Handle leap years and adjacent-month selection.
3. Parse only canonical `YYYY-MM-DD` values and reject impossible dates.
4. Normalize missing or invalid URL state to the current app business day.
5. Sort all-day entries before timed entries with stable tiebreaks.
6. Validate time/timezone pairing, minute bounds, categories, lengths, and `http`/`https` URLs.
7. Serialize database dates without timezone drift.
8. Query only the authenticated user's entries inside the requested range.
9. Reject ranges longer than 42 days.
10. Verify create, update, delete, ownership, and 404 route behavior.
11. Round-trip Calendar entries through backup v1.4.
12. Import older backups with no `calendarEntries` field.

### End-to-end tests

1. Desktop: open Calendar, navigate months, select a date, create a timed entry, edit it, open its source link, and delete it.
2. Desktop: create multiple all-day and timed entries on one date and verify ordering.
3. Mobile: open Plan → Calendar, create through the drawer, and verify the stacked agenda.
4. Mobile: visit a Calendar deep link and verify redirect preserves month/date and activates the Calendar sub-view.
5. Keyboard: move through the grid and open the selected date's Add entry form.

Existing smoke, navigation, settings import/export, mobile Plan, and i18n tests must remain green.

## Future integration seam

The v1 model intentionally provides:

- One stable application ID per event-like record
- An explicit date
- Optional wall-clock time with IANA timezone
- Source URL and modification timestamp
- A service/API boundary independent of UI components

A later integration can add separate provider-account and external-event-link models without changing the core entry contract. Provider IDs, OAuth tokens, sync status, recurrence, conflict policies, and webhooks are not added to v1.

## Success criteria

The feature is complete when:

1. Users can browse months and select any date on desktop and mobile.
2. Users can create, edit, and delete multiple manual entries per date.
3. All-day and timed entries display and sort correctly.
4. Calendar state survives refresh and deep linking.
5. User ownership is enforced for every read and write.
6. English and Traditional Chinese experiences are complete and accessible.
7. Existing whole-app backups round-trip Calendar entries and older backups still import.
8. No automatic feed, calendar-format integration, or Google Calendar functionality ships in v1.
