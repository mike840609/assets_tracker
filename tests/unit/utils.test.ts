import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { daysBetweenDates } from "@/lib/utils";

describe("daysBetweenDates", () => {
  const originalTz = process.env.TZ;

  beforeAll(() => {
    process.env.TZ = "America/New_York";
  });

  afterAll(() => {
    process.env.TZ = originalTz;
  });

  it("counts calendar days across a DST spring-forward boundary", () => {
    expect(daysBetweenDates("2026-03-08", "2026-03-09")).toBe(1);
  });

  it("keeps same-day and reversed-date behavior at zero", () => {
    expect(daysBetweenDates("2026-03-08", "2026-03-08")).toBe(0);
    expect(daysBetweenDates("2026-03-09", "2026-03-08")).toBe(0);
  });
});
