import { describe, expect, it } from "vitest";
import { ApiError, apiErrorMessage, assertOk, errorText } from "@/lib/api-error";

const texts = { fallback: "Failed to save", sessionExpired: "Session expired" };
const res = (status: number, body?: unknown) =>
  new Response(body === undefined ? "not json" : JSON.stringify(body), { status });

describe("apiErrorMessage", () => {
  it("maps 401 to the session-expired text", async () => {
    expect(await apiErrorMessage(res(401, { error: { message: "Unauthorized" } }), texts)).toBe(
      "Session expired",
    );
  });

  it("shows the first field error of a validation failure", async () => {
    const body = {
      error: {
        message: "Validation failed",
        issues: {
          formErrors: [],
          fieldErrors: { endDate: ["End date must be on or after the start date"] },
        },
      },
    };
    expect(await apiErrorMessage(res(400, body), texts)).toBe(
      "End date must be on or after the start date",
    );
  });

  it("shows the server's message, else the fallback", async () => {
    expect(
      await apiErrorMessage(
        res(400, { error: { message: "Holding quantity cannot be negative" } }),
        texts,
      ),
    ).toBe("Holding quantity cannot be negative");
    expect(await apiErrorMessage(res(500), texts)).toBe("Failed to save");
    expect(
      await apiErrorMessage(res(400, { error: { message: "Validation failed" } }), texts),
    ).toBe("Failed to save");
  });

  it("assertOk throws a displayable ApiError; errorText hides raw network errors", async () => {
    await expect(assertOk(res(200, {}), "expired")).resolves.toBeUndefined();
    const thrown = await assertOk(res(401, {}), "expired").catch((e: unknown) => e);
    expect(thrown).toBeInstanceOf(ApiError);
    expect(errorText(thrown, "fallback")).toBe("expired");
    expect(errorText(new TypeError("Failed to fetch"), "fallback")).toBe("fallback");
    expect(errorText(new ApiError(""), "fallback")).toBe("fallback");
  });
});
