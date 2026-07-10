# Recurring Rule PATCH Date-Range Validation

## Goal

Prevent a partial edit of a recurring cash or investment rule from persisting an end date that precedes its effective start date.

## Scope

Apply the same behavior to both PATCH endpoints:

- `/api/accounts/[id]/recurring-cash-transactions/[recurringId]`
- `/api/accounts/[id]/recurring-investments/[recurringId]`

No database migration, cron behavior change, or change to valid scheduling semantics is needed.

## Design

Each handler will select `startDate` and `endDate` alongside the existing ownership lookup. After the existing Zod payload validation succeeds, it will merge the submitted date fields with the persisted fields. If the effective end date exists and is earlier than the effective start date, the handler returns the existing 400 failure response before creating the Prisma update.

The existing schema-level refinement remains responsible for payloads that contain both dates. The route-level check covers the missing case where a one-field PATCH interacts with the other persisted field. A `null` end date remains valid and clears an existing schedule limit.

## Error Handling

The response message is `End date must be on or after the start date`, matching the existing Zod validation message. Invalid requests make no write; valid requests preserve the current behavior, including resetting `nextRunDate` when `startDate` changes.

## Tests

Route-level Vitest tests will mock authenticated user context and the two Prisma rule delegates. For both rule types, they will verify that:

1. a PATCH which moves `endDate` before the existing `startDate` returns 400 and never calls `update`;
2. a PATCH which moves `startDate` after the existing `endDate` returns 400 and never calls `update`.

The focused test will be run red before production edits, then green afterward, followed by the full unit suite, lint, and type-check.
