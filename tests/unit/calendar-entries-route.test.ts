import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  getCalendarEntriesInRange: vi.fn(),
  invalidateCalendarEntryCaches: vi.fn(),
  create: vi.fn(),
  findFirst: vi.fn(),
  updateMany: vi.fn(),
  deleteMany: vi.fn(),
  error: vi.fn(),
}));

vi.mock("@/lib/api-handler", () => ({
  withAuth:
    (handler: (request: Request, context: unknown, userId: string) => Promise<Response>) =>
    (request: Request, context: unknown) =>
      handler(request, context, "user_1"),
}));

vi.mock("@/lib/services/calendar-entry-service", () => ({
  getCalendarEntriesInRange: h.getCalendarEntriesInRange,
  invalidateCalendarEntryCaches: h.invalidateCalendarEntryCaches,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    calendarEntry: {
      create: h.create,
      findFirst: h.findFirst,
      updateMany: h.updateMany,
      deleteMany: h.deleteMany,
    },
  },
}));

vi.mock("@/lib/logger", () => ({
  log: { error: h.error },
}));

import { DELETE, PATCH } from "@/app/api/calendar-entries/[id]/route";
import { GET, POST } from "@/app/api/calendar-entries/route";
import { prisma } from "@/lib/prisma";

const validTimedEntry = {
  title: "US CPI",
  eventDate: "2026-08-12",
  startTimeMinutes: 510,
  timeZone: "Asia/Taipei",
  category: "ECONOMIC_INDICATOR",
  description: "Consensus 2.8%",
  sourceUrl: "https://example.gov/cpi",
} as const;

const existingTimedEntry = {
  id: "cal_1",
  userId: "user_1",
  ...validTimedEntry,
  eventDate: new Date("2026-08-12T00:00:00.000Z"),
  createdAt: new Date("2026-07-24T01:00:00.000Z"),
  updatedAt: new Date("2026-07-24T02:00:00.000Z"),
};

const createdAllDayEntry = {
  ...existingTimedEntry,
  id: "cal_2",
  title: "Dividend date",
  startTimeMinutes: null,
  timeZone: null,
  category: "DIVIDEND",
  description: null,
  sourceUrl: null,
};

const jsonRequest = (body: Record<string, unknown>, method = "POST") =>
  new Request("http://unit.test/api/calendar-entries", {
    method,
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });

const itemContext = (id = "cal_1") => ({ params: Promise.resolve({ id }) });

describe("calendar entry routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.getCalendarEntriesInRange.mockResolvedValue([]);
    h.create.mockResolvedValue(existingTimedEntry);
    h.findFirst.mockResolvedValue(existingTimedEntry);
    h.updateMany.mockResolvedValue({ count: 1 });
    h.deleteMany.mockResolvedValue({ count: 1 });
  });

  it("returns a bounded authenticated range", async () => {
    const response = await GET(
      new Request("http://unit.test/api/calendar-entries?from=2026-08-01&to=2026-09-11"),
      undefined,
    );

    expect(response.status).toBe(200);
    expect(h.getCalendarEntriesInRange).toHaveBeenCalledWith(
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
    expect(h.getCalendarEntriesInRange).not.toHaveBeenCalled();
  });

  it("creates a trimmed timed entry with a UTC-midnight eventDate", async () => {
    const response = await POST(
      jsonRequest({ ...validTimedEntry, title: "  US CPI  " }),
      undefined,
    );

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
    expect(h.invalidateCalendarEntryCaches).toHaveBeenCalledWith("user_1");
  });

  it("creates an all-day entry and invalidates the user cache", async () => {
    h.create.mockResolvedValueOnce(createdAllDayEntry);

    const response = await POST(
      jsonRequest({
        title: "  Dividend date  ",
        eventDate: "2026-08-12",
        startTimeMinutes: null,
        timeZone: null,
        category: "DIVIDEND",
        description: null,
        sourceUrl: null,
      }),
      undefined,
    );

    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({
      data: { id: "cal_2", title: "Dividend date", startTimeMinutes: null, timeZone: null },
    });
    expect(h.invalidateCalendarEntryCaches).toHaveBeenCalledWith("user_1");
  });

  it("returns a generic error and logs a failed create", async () => {
    h.create.mockRejectedValueOnce(new Error("database password leaked"));

    const response = await POST(jsonRequest(validTimedEntry), undefined);

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: { message: "Failed to create calendar entry" },
    });
    expect(h.error).toHaveBeenCalledWith(
      "calendar_entries.create_failed",
      expect.objectContaining({ userId: "user_1", error: "Error: database password leaked" }),
    );
  });

  it("validates the merged final state on partial update", async () => {
    h.findFirst.mockResolvedValueOnce(existingTimedEntry);

    const response = await PATCH(jsonRequest({ timeZone: null }, "PATCH"), itemContext());

    expect(response.status).toBe(400);
    expect(prisma.calendarEntry.updateMany).not.toHaveBeenCalled();
  });

  it("updates an owned entry and invalidates the user cache", async () => {
    const updated = { ...existingTimedEntry, title: "Changed" };
    h.findFirst.mockResolvedValueOnce(existingTimedEntry).mockResolvedValueOnce(updated);

    const response = await PATCH(jsonRequest({ title: "  Changed  " }, "PATCH"), itemContext());

    expect(response.status).toBe(200);
    expect(prisma.calendarEntry.updateMany).toHaveBeenCalledWith({
      where: { id: "cal_1", userId: "user_1" },
      data: expect.objectContaining({
        title: "Changed",
        eventDate: new Date("2026-08-12T00:00:00.000Z"),
      }),
    });
    expect(await response.json()).toMatchObject({ data: { id: "cal_1", title: "Changed" } });
    expect(h.invalidateCalendarEntryCaches).toHaveBeenCalledWith("user_1");
  });

  it("rejects a PATCH with no fields before looking up the entry", async () => {
    const response = await PATCH(jsonRequest({}, "PATCH"), itemContext());

    expect(response.status).toBe(400);
    expect(prisma.calendarEntry.findFirst).not.toHaveBeenCalled();
  });

  it("returns 404 for missing or cross-user update and delete", async () => {
    h.findFirst.mockResolvedValueOnce(null);
    expect(
      (await PATCH(jsonRequest({ title: "Changed" }, "PATCH"), itemContext("other"))).status,
    ).toBe(404);

    h.findFirst.mockResolvedValueOnce(existingTimedEntry);
    h.deleteMany.mockResolvedValueOnce({ count: 0 });
    expect(
      (
        await DELETE(
          new Request("http://unit.test/api/calendar-entries/other"),
          itemContext("other"),
        )
      ).status,
    ).toBe(404);
  });

  it("deletes an owned entry and invalidates the user cache", async () => {
    const response = await DELETE(
      new Request("http://unit.test/api/calendar-entries/cal_1", { method: "DELETE" }),
      itemContext(),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ data: { ok: true } });
    expect(prisma.calendarEntry.deleteMany).toHaveBeenCalledWith({
      where: { id: "cal_1", userId: "user_1" },
    });
    expect(h.invalidateCalendarEntryCaches).toHaveBeenCalledWith("user_1");
  });

  it("returns generic errors and logs failed update and delete operations", async () => {
    h.findFirst.mockRejectedValueOnce(new Error("update database details"));
    const update = await PATCH(jsonRequest({ title: "Changed" }, "PATCH"), itemContext());
    expect(update.status).toBe(500);
    await expect(update.json()).resolves.toEqual({
      error: { message: "Failed to update calendar entry" },
    });
    expect(h.error).toHaveBeenCalledWith(
      "calendar_entries.update_failed",
      expect.objectContaining({ userId: "user_1", error: "Error: update database details" }),
    );

    h.findFirst.mockResolvedValueOnce(existingTimedEntry);
    h.deleteMany.mockRejectedValueOnce(new Error("delete database details"));
    const deletion = await DELETE(
      new Request("http://unit.test/api/calendar-entries/cal_1", { method: "DELETE" }),
      itemContext(),
    );
    expect(deletion.status).toBe(500);
    await expect(deletion.json()).resolves.toEqual({
      error: { message: "Failed to delete calendar entry" },
    });
    expect(h.error).toHaveBeenCalledWith(
      "calendar_entries.delete_failed",
      expect.objectContaining({ userId: "user_1", error: "Error: delete database details" }),
    );
  });
});
