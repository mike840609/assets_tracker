import { describe, expect, it } from "vitest";
import { failure } from "@/lib/api-responses";

describe("failure", () => {
  it("keeps the existing envelope when no code is supplied", async () => {
    const response = failure("Bad request", 400);
    await expect(response.json()).resolves.toEqual({ error: { message: "Bad request" } });
  });

  it("adds a stable code and response headers", async () => {
    const response = failure("Demo expired", 410, {
      code: "DEMO_EXPIRED",
      headers: { "Retry-After": "60" },
    });
    expect(response.headers.get("Retry-After")).toBe("60");
    await expect(response.json()).resolves.toEqual({
      error: { message: "Demo expired", code: "DEMO_EXPIRED" },
    });
  });
});
