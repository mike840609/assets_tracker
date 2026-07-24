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

  it("normalizes valid range dates to UTC midnight before querying", async () => {
    h.findMany.mockResolvedValue([]);

    await getCalendarEntriesInRange(
      "user_1",
      new Date("2026-08-01T12:34:56.000Z"),
      new Date("2026-09-11T23:59:59.999Z"),
    );

    expect(h.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId: "user_1",
          eventDate: {
            gte: new Date("2026-08-01T00:00:00.000Z"),
            lte: new Date("2026-09-11T00:00:00.000Z"),
          },
        },
      }),
    );
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
