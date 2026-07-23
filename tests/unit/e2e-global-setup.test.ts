import { describe, expect, it } from "vitest";

import { requireAuthenticatedSession } from "../e2e/global-setup";

describe("E2E global setup session diagnostics", () => {
  it("reports an unauthenticated null session instead of throwing a TypeError", () => {
    expect(() => requireAuthenticatedSession(null)).toThrowError(
      "The session endpoint returned null or omitted the user id",
    );
  });

  it("accepts a session with a user id", () => {
    expect(() => requireAuthenticatedSession({ user: { id: "user_1" } })).not.toThrow();
  });
});
