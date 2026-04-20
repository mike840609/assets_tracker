import { NextResponse } from "next/server";

type ZodErrorLike = {
  flatten: () => unknown;
};

/** Successful response — wraps data in a `{ data }` envelope. */
export const ok = <T>(data: T, init?: ResponseInit) =>
  NextResponse.json({ data }, init);

/** Error response — wraps message in a `{ error: { message } }` envelope. */
export const failure = (message: string, status = 400) =>
  NextResponse.json({ error: { message } }, { status });

/** Zod validation failure — includes flattened issues for field-level display. */
export const validationError = (zodError: ZodErrorLike) =>
  NextResponse.json(
    { error: { message: "Validation failed", issues: zodError.flatten() } },
    { status: 400 }
  );
