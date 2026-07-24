import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

async function clearCalendarRange(request: APIRequestContext, from: string, to: string) {
  const response = await request.get(`/api/calendar-entries?from=${from}&to=${to}`);
  expect(response.ok()).toBeTruthy();
  const body = await response.json();
  for (const entry of body.data as Array<{ id: string }>) {
    expect((await request.delete(`/api/calendar-entries/${entry.id}`)).ok()).toBeTruthy();
  }
}

async function openCreateForm(page: Page) {
  await page.getByRole("button", { name: "Add entry" }).first().click();
  const dialog = page.getByRole("dialog", { name: "Add calendar entry" });
  await expect(dialog).toBeVisible();
  return dialog;
}

async function chooseCategory(page: Page, dialog: ReturnType<Page["getByRole"]>, name: string) {
  await dialog.getByRole("combobox", { name: "Category" }).click();
  await page.getByRole("option", { name }).click();
}

function formatTaipeiDate(now: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value;

  return `${value("year")}-${value("month")}-${value("day")}`;
}

test.describe("calendar entry workflows", () => {
  test("desktop CRUD keeps ordering, timezone, source security, and month state", async ({
    page,
    request,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "chromium", "Desktop-only calendar flow");
    test.setTimeout(60_000);

    const from = "2031-07-28";
    const to = "2031-09-07";
    await clearCalendarRange(request, from, to);

    try {
      await page.goto("/calendar?month=2031-08&date=2031-08-12");

      await expect(page.getByRole("gridcell")).toHaveCount(42);
      await expect(page.getByRole("heading", { name: "Tuesday, August 12, 2031" })).toBeVisible();

      let dialog = await openCreateForm(page);
      await dialog.getByRole("textbox", { name: "Title" }).fill("FOMC minutes");
      await dialog.getByLabel("Time").fill("14:00");
      await dialog.getByRole("button", { name: "Add entry" }).click();
      await expect(dialog).not.toBeVisible();
      await expect(page.getByRole("heading", { name: "FOMC minutes" })).toBeVisible();

      dialog = await openCreateForm(page);
      await dialog.getByRole("textbox", { name: "Title" }).fill("US CPI");
      await dialog.getByLabel("Time").fill("08:30");
      await chooseCategory(page, dialog, "Economic indicator");
      await dialog
        .getByRole("textbox", { name: "Description" })
        .fill("Consensus and prior release details");
      await dialog.getByRole("textbox", { name: "Source URL" }).fill("https://example.com/cpi");
      await dialog.getByRole("button", { name: "Add entry" }).click();
      await expect(dialog).not.toBeVisible();
      await expect(page.getByRole("heading", { name: "US CPI" })).toBeVisible();

      dialog = await openCreateForm(page);
      await dialog.getByRole("textbox", { name: "Title" }).fill("ACME earnings");
      await chooseCategory(page, dialog, "Earnings");
      await dialog.getByRole("button", { name: "Add entry" }).click();
      await expect(dialog).not.toBeVisible();
      await expect(page.getByRole("heading", { name: "ACME earnings" })).toBeVisible();

      const categoryLegend = page.getByRole("list", { name: "Entry categories" });
      await expect(categoryLegend).toBeVisible();
      await expect(categoryLegend.getByText("Earnings", { exact: true })).toBeVisible();
      await expect(categoryLegend.getByText("Economic indicator", { exact: true })).toBeVisible();
      await expect(categoryLegend.getByText("Other", { exact: true })).toBeVisible();
      await expect(
        page.getByRole("gridcell").getByRole("button", {
          name: /August 12, 2031.*Earnings: 1.*Economic indicator: 1.*Other: 1/,
        }),
      ).toBeVisible();

      const agenda = page.getByRole("region", { name: /on Tuesday, August 12, 2031/ });
      await expect(agenda.getByRole("heading", { level: 3 })).toHaveText([
        "ACME earnings",
        "US CPI",
        "FOMC minutes",
      ]);
      const acmeArticle = agenda.getByRole("article").filter({ hasText: "ACME earnings" });
      const cpiArticle = agenda.getByRole("article").filter({ hasText: "US CPI" });
      const fomcArticle = agenda.getByRole("article").filter({ hasText: "FOMC minutes" });
      await expect(acmeArticle.getByText("All day", { exact: true })).toBeVisible();
      await expect(cpiArticle.getByText(/^8:30 AM · \S+/)).toBeVisible();
      await expect(fomcArticle.getByText(/^2:00 PM · \S+/)).toBeVisible();

      const beforeEditResponse = await request.get(
        "/api/calendar-entries?from=2031-08-12&to=2031-08-12",
      );
      expect(beforeEditResponse.ok()).toBeTruthy();
      const beforeEditBody = (await beforeEditResponse.json()) as {
        data: Array<{ title: string; timeZone: string | null }>;
      };
      const beforeEdit = beforeEditBody.data.find((entry) => entry.title === "US CPI");
      expect(beforeEdit?.timeZone).toBeTruthy();

      await cpiArticle.getByRole("button", { name: "Edit" }).click();
      dialog = page.getByRole("dialog", { name: "Edit calendar entry" });
      await expect(dialog).toBeVisible();
      await dialog.getByRole("textbox", { name: "Title" }).fill("US CPI revised");
      await dialog.getByRole("button", { name: "Save changes" }).click();
      await expect(dialog).not.toBeVisible();
      await expect(page.getByRole("heading", { name: "US CPI revised" })).toBeVisible();

      const afterEditResponse = await request.get(
        "/api/calendar-entries?from=2031-08-12&to=2031-08-12",
      );
      expect(afterEditResponse.ok()).toBeTruthy();
      const afterEditBody = (await afterEditResponse.json()) as {
        data: Array<{ title: string; timeZone: string | null }>;
      };
      const afterEdit = afterEditBody.data.find((entry) => entry.title === "US CPI revised");
      expect(afterEdit?.timeZone).toBe(beforeEdit?.timeZone);

      const revisedArticle = agenda.getByRole("article").filter({ hasText: "US CPI revised" });
      const sourceLink = revisedArticle.getByRole("link", { name: "Open source" });
      await expect(sourceLink).toHaveAttribute("target", "_blank");
      const relTokens = (await sourceLink.getAttribute("rel"))?.split(/\s+/).filter(Boolean).sort();
      expect(relTokens).toEqual(["noopener", "noreferrer"]);
      const popupPromise = page.waitForEvent("popup");
      await sourceLink.click();
      const popup = await popupPromise;
      await expect(popup).toHaveURL("https://example.com/cpi");
      await popup.close();

      await fomcArticle.getByRole("button", { name: "Delete" }).click();
      const confirmation = page.getByRole("alertdialog", { name: "Delete calendar entry?" });
      await expect(confirmation).toBeVisible();
      await confirmation.getByRole("button", { name: "Delete" }).click();
      await expect(confirmation).not.toBeVisible();
      await expect(page.getByRole("heading", { name: "FOMC minutes" })).toHaveCount(0);

      await page.getByRole("button", { name: "Previous month" }).click();
      await expect(page).toHaveURL(/\/calendar\?month=2031-07&date=2031-07-12$/);
      await page.getByRole("button", { name: "Next month" }).click();
      await expect(page).toHaveURL(/\/calendar\?month=2031-08&date=2031-08-12$/);

      const expectedToday = formatTaipeiDate(new Date());
      await page.getByRole("button", { name: "Today" }).click();
      await expect(page).toHaveURL(
        (url) => {
          return (
            url.pathname === "/calendar" &&
            url.searchParams.get("month") === expectedToday.slice(0, 7) &&
            url.searchParams.get("date") === expectedToday
          );
        },
        { timeout: 10_000 },
      );
    } finally {
      await clearCalendarRange(request, from, to);
    }
  });

  test("desktop keyboard map moves focus and exposes selected and current dates", async ({
    page,
    request,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "chromium", "Desktop-only keyboard flow");

    const from = "2032-08-30";
    const to = "2032-10-10";
    await clearCalendarRange(request, from, to);

    try {
      await page.goto("/calendar?month=2032-09&date=2032-09-17");
      const selected = page
        .getByRole("gridcell")
        .getByRole("button", { name: /September 17, 2032/ });
      await selected.focus();
      await page.keyboard.press("Home");
      await expect(page).toHaveURL(/date=2032-09-13/);
      await expect(
        page.getByRole("gridcell").getByRole("button", { name: /September 13, 2032/ }),
      ).toBeFocused();
      await page.keyboard.press("End");
      await expect(page).toHaveURL(/date=2032-09-19/);

      await page.goto("/calendar?month=2032-09&date=2032-09-17");
      await page
        .getByRole("gridcell")
        .getByRole("button", { name: /September 17, 2032/ })
        .focus();
      await page.keyboard.press("ArrowLeft");
      await expect(page).toHaveURL(/date=2032-09-16/);
      await page.keyboard.press("ArrowUp");
      await expect(page).toHaveURL(/date=2032-09-09/);

      await page.goto("/calendar?month=2032-09&date=2032-09-17");
      await page
        .getByRole("gridcell")
        .getByRole("button", { name: /September 17, 2032/ })
        .focus();
      await page.keyboard.press("ArrowRight");
      await expect(page).toHaveURL(/date=2032-09-18/);
      await page.keyboard.press("ArrowDown");
      await expect(page).toHaveURL(/date=2032-09-25/);
      await page.keyboard.press("PageDown");
      await expect(page).toHaveURL(/month=2032-10&date=2032-10-25/);
      await page.keyboard.press("PageUp");
      await expect(page).toHaveURL(/month=2032-09&date=2032-09-25/);

      const selectedCell = page.getByRole("gridcell", { selected: true });
      await expect(selectedCell).toHaveAttribute("aria-selected", "true");
      await expect(selectedCell.getByRole("button", { name: /September 25, 2032/ })).toBeVisible();

      await page.getByRole("button", { name: "Add entry" }).last().focus();
      await page.keyboard.press("Enter");
      const dialog = page.getByRole("dialog", { name: "Add calendar entry" });
      await expect(dialog).toBeVisible();
      await dialog.getByRole("button", { name: "Cancel" }).click();
      await expect(dialog).not.toBeVisible();

      await page.getByRole("button", { name: "Today" }).click();
      const todayButton = page.getByRole("gridcell", { selected: true }).getByRole("button");
      await expect(todayButton).toHaveCount(1);
      await expect(todayButton).toHaveAttribute("aria-current", "date");

      await page.goto("/calendar?month=2032-09&date=2032-09-17");
      await page
        .getByRole("gridcell")
        .getByRole("button", { name: /October 1, 2032/ })
        .click();
      await expect(page).toHaveURL(/\/calendar\?month=2032-10&date=2032-10-01$/);
      const adjacentDateDialog = await openCreateForm(page);
      await expect(adjacentDateDialog.getByLabel("Date")).toHaveValue("2032-10-01");
      await adjacentDateDialog.getByRole("button", { name: "Cancel" }).click();
      await expect(adjacentDateDialog).not.toBeVisible();
    } finally {
      await clearCalendarRange(request, from, to);
    }
  });

  test("mobile Calendar drawer creates an all-day Reminder in the stacked agenda", async ({
    page,
    request,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "Mobile Chrome", "Mobile-only calendar drawer flow");

    const from = "2033-09-26";
    const to = "2033-11-06";
    await clearCalendarRange(request, from, to);

    try {
      await page.goto("/goals?month=2033-10&date=2033-10-18#calendar");

      const calendarTab = page.getByRole("tab", { name: "Calendar" });
      await expect(calendarTab).toHaveAttribute("aria-selected", "true");
      const grid = page.getByRole("grid");
      const agenda = page.getByRole("region", { name: /on Tuesday, October 18, 2033/ });
      await expect(grid).toBeVisible();
      await expect(agenda).toBeVisible();
      await expect
        .poll(async () => {
          const [gridBox, agendaBox] = await Promise.all([
            grid.boundingBox(),
            agenda.boundingBox(),
          ]);
          return Boolean(
            gridBox &&
            agendaBox &&
            agendaBox.y >= gridBox.y + gridBox.height &&
            agendaBox.width <= gridBox.width,
          );
        })
        .toBe(true);

      await page
        .getByRole("gridcell")
        .getByRole("button", { name: /November 1, 2033/ })
        .tap();
      await expect(page).toHaveURL(/\/goals\?month=2033-11&date=2033-11-01#calendar$/);
      const adjacentAgenda = page.getByRole("region", {
        name: /on Tuesday, November 1, 2033/,
      });
      await expect
        .poll(async () => {
          const [agendaBox, viewport] = await Promise.all([
            adjacentAgenda.boundingBox(),
            Promise.resolve(page.viewportSize()),
          ]);
          return Boolean(
            agendaBox &&
            viewport &&
            agendaBox.y < viewport.height &&
            agendaBox.y + agendaBox.height > 0,
          );
        })
        .toBe(true);

      await page.getByRole("button", { name: "Add entry" }).first().click();
      const drawer = page.getByRole("dialog", { name: "Add calendar entry" });
      await expect(drawer).toBeVisible();
      await expect
        .poll(async () => {
          const [box, viewport] = await Promise.all([
            drawer.boundingBox(),
            Promise.resolve(page.viewportSize()),
          ]);
          return Boolean(
            box &&
            viewport &&
            Math.abs(box.x) <= 1 &&
            Math.abs(box.width - viewport.width) <= 2 &&
            Math.abs(box.y + box.height - viewport.height) <= 2 &&
            box.y > 0,
          );
        })
        .toBe(true);
      await expect(drawer.getByLabel("Date")).toHaveValue("2033-11-01");
      await drawer.getByRole("textbox", { name: "Title" }).fill("Quarterly tax reminder");
      await chooseCategory(page, drawer, "Reminder");
      await drawer.getByRole("button", { name: "Add entry" }).click();
      await expect(drawer).not.toBeVisible();
      await expect(page.getByRole("heading", { name: "Quarterly tax reminder" })).toBeVisible();
      await expect(adjacentAgenda.getByText("All day", { exact: true })).toBeVisible();
      await expect(adjacentAgenda.getByText("Reminder", { exact: true })).toBeVisible();
    } finally {
      await clearCalendarRange(request, from, to);
    }
  });

  test("desktop create and edit failures retain retryable form values", async ({
    page,
    request,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "chromium", "Desktop-only form failure flow");
    test.setTimeout(90_000);

    const from = "2034-10-30";
    const to = "2034-12-10";
    await clearCalendarRange(request, from, to);

    try {
      await page.goto("/calendar?month=2034-11&date=2034-11-14");

      let dialog = await openCreateForm(page);
      await dialog.getByRole("textbox", { name: "Title" }).fill("Unsaved calendar entry");
      await dialog.getByRole("button", { name: "Cancel" }).click();
      const discardConfirmation = page.getByRole("alertdialog", {
        name: "Discard changes?",
      });
      await expect(discardConfirmation).toBeVisible();
      await discardConfirmation.getByRole("button", { name: "Keep editing" }).click();
      await expect(dialog).toBeVisible();
      await expect(dialog.getByRole("textbox", { name: "Title" })).toHaveValue(
        "Unsaved calendar entry",
      );
      await dialog.getByRole("button", { name: "Cancel" }).click();
      await discardConfirmation.getByRole("button", { name: "Discard" }).click();
      await expect(dialog).not.toBeVisible();

      await page.route(
        "**/api/calendar-entries",
        async (route) => {
          expect(route.request().method()).toBe("POST");
          await route.fulfill({
            status: 500,
            contentType: "application/json",
            body: JSON.stringify({ error: { message: "Injected create failure" } }),
          });
        },
        { times: 1 },
      );

      dialog = await openCreateForm(page);
      await dialog.getByRole("textbox", { name: "Title" }).fill("Retryable calendar entry");
      await dialog.getByLabel("Time").fill("09:15");
      await chooseCategory(page, dialog, "Reminder");
      await dialog.getByRole("textbox", { name: "Description" }).fill("Retained create details");
      await dialog.getByRole("button", { name: "Add entry" }).click();

      await expect(dialog).toBeVisible();
      await expect(dialog.getByRole("textbox", { name: "Title" })).toHaveValue(
        "Retryable calendar entry",
      );
      await expect(dialog.getByLabel("Date")).toHaveValue("2034-11-14");
      await expect(dialog.getByLabel("Time")).toHaveValue("09:15");
      await expect(dialog.getByRole("combobox", { name: "Category" })).toContainText("Reminder");
      await expect(dialog.getByRole("textbox", { name: "Description" })).toHaveValue(
        "Retained create details",
      );
      await expect(dialog.getByRole("button", { name: "Add entry" })).toBeEnabled();

      await dialog.getByRole("button", { name: "Add entry" }).click();
      await expect(dialog).not.toBeVisible();
      await expect(page.getByRole("heading", { name: "Retryable calendar entry" })).toBeVisible();

      const article = page.getByRole("article").filter({ hasText: "Retryable calendar entry" });
      await article.getByRole("button", { name: "Edit" }).click();
      dialog = page.getByRole("dialog", { name: "Edit calendar entry" });
      await expect(dialog).toBeVisible();
      await dialog.getByRole("textbox", { name: "Title" }).fill("Retryable calendar entry revised");
      await dialog.getByRole("textbox", { name: "Description" }).fill("Retained edit details");

      await page.route(
        /\/api\/calendar-entries\/[^/?]+$/,
        async (route) => {
          expect(route.request().method()).toBe("PATCH");
          await route.fulfill({
            status: 500,
            contentType: "application/json",
            body: JSON.stringify({ error: { message: "Injected edit failure" } }),
          });
        },
        { times: 1 },
      );
      await dialog.getByRole("button", { name: "Save changes" }).click();

      await expect(dialog).toBeVisible();
      await expect(dialog.getByRole("textbox", { name: "Title" })).toHaveValue(
        "Retryable calendar entry revised",
      );
      await expect(dialog.getByRole("textbox", { name: "Description" })).toHaveValue(
        "Retained edit details",
      );
      await expect(dialog.getByRole("button", { name: "Save changes" })).toBeEnabled();

      await dialog.getByRole("button", { name: "Save changes" }).click();
      await expect(dialog).not.toBeVisible();
      await expect(
        page.getByRole("heading", { name: "Retryable calendar entry revised" }),
      ).toBeVisible();
    } finally {
      await clearCalendarRange(request, from, to);
    }
  });

  test("desktop delete failure keeps the authoritative entry", async ({
    page,
    request,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "chromium", "Desktop-only delete failure flow");
    test.setTimeout(60_000);

    const from = "2035-01-29";
    const to = "2035-03-11";
    await clearCalendarRange(request, from, to);

    try {
      await test.step("seed an authoritative calendar entry", async () => {
        const createResponse = await request.post("/api/calendar-entries", {
          data: {
            title: "Authoritative delete retry",
            eventDate: "2035-02-13",
            startTimeMinutes: null,
            timeZone: null,
            category: "REMINDER",
            description: "Must survive a failed delete",
            sourceUrl: null,
          },
        });
        expect(createResponse.ok()).toBeTruthy();
      });

      await test.step("inject a failed browser delete", async () => {
        await page.goto("/calendar?month=2035-02&date=2035-02-13");
        const article = page.getByRole("article").filter({ hasText: "Authoritative delete retry" });
        await expect(article).toBeVisible();
        await article.getByRole("button", { name: "Delete" }).click();

        const confirmation = page.getByRole("alertdialog", {
          name: "Delete calendar entry?",
        });
        await expect(confirmation).toBeVisible();
        await page.route(
          /\/api\/calendar-entries\/[^/?]+$/,
          async (route) => {
            expect(route.request().method()).toBe("DELETE");
            await route.fulfill({
              status: 500,
              contentType: "application/json",
              body: JSON.stringify({ error: { message: "Injected delete failure" } }),
            });
          },
          { times: 1 },
        );
        await confirmation.getByRole("button", { name: "Delete" }).click();

        await expect(page.getByText("Calendar entry was not deleted. Try again.")).toBeVisible();
        await expect(
          page.getByRole("heading", { name: "Authoritative delete retry" }),
        ).toBeVisible();
      });

      await test.step("verify the server row remains authoritative", async () => {
        const rangeResponse = await request.get(
          "/api/calendar-entries?from=2035-02-13&to=2035-02-13",
        );
        expect(rangeResponse.ok()).toBeTruthy();
        const rangeBody = (await rangeResponse.json()) as {
          data: Array<{ title: string }>;
        };
        expect(
          rangeBody.data.some((entry) => entry.title === "Authoritative delete retry"),
        ).toBeTruthy();
        await expect(
          page.getByRole("heading", { name: "Authoritative delete retry" }),
        ).toBeVisible();
      });
    } finally {
      await clearCalendarRange(request, from, to);
    }
  });
});
