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
      await dialog.getByRole("textbox", { name: "Title" }).fill("ACME earnings");
      await chooseCategory(page, dialog, "Earnings");
      await dialog.getByRole("button", { name: "Add entry" }).click();
      await expect(dialog).not.toBeVisible();
      await expect(page.getByRole("heading", { name: "ACME earnings" })).toBeVisible();

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
      await dialog.getByRole("textbox", { name: "Title" }).fill("FOMC minutes");
      await dialog.getByLabel("Time").fill("14:00");
      await dialog.getByRole("button", { name: "Add entry" }).click();
      await expect(dialog).not.toBeVisible();
      await expect(page.getByRole("heading", { name: "FOMC minutes" })).toBeVisible();

      const agenda = page.getByRole("region", { name: /on Tuesday, August 12, 2031/ });
      await expect(agenda.getByRole("heading", { level: 3 })).toHaveText([
        "ACME earnings",
        "US CPI",
        "FOMC minutes",
      ]);

      const beforeEditResponse = await request.get(
        "/api/calendar-entries?from=2031-08-12&to=2031-08-12",
      );
      expect(beforeEditResponse.ok()).toBeTruthy();
      const beforeEditBody = (await beforeEditResponse.json()) as {
        data: Array<{ title: string; timeZone: string | null }>;
      };
      const beforeEdit = beforeEditBody.data.find((entry) => entry.title === "US CPI");
      expect(beforeEdit?.timeZone).toBeTruthy();

      const cpiArticle = agenda.getByRole("article").filter({ hasText: "US CPI" });
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
      await expect(sourceLink).toHaveAttribute("rel", /noopener/);
      await expect(sourceLink).toHaveAttribute("rel", /noreferrer/);
      const popupPromise = page.waitForEvent("popup");
      await sourceLink.click();
      const popup = await popupPromise;
      await expect(popup).toHaveURL("https://example.com/cpi");
      await popup.close();

      const fomcArticle = agenda.getByRole("article").filter({ hasText: "FOMC minutes" });
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

      await page.getByRole("button", { name: "Today" }).click();
      await expect(page).toHaveURL(
        (url) => {
          const month = url.searchParams.get("month");
          const date = url.searchParams.get("date");
          return (
            url.pathname === "/calendar" &&
            month !== null &&
            date !== null &&
            month === date.slice(0, 7) &&
            date !== "2031-08-12"
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

      await page.getByRole("button", { name: "Add entry" }).first().click();
      const drawer = page.getByRole("dialog", { name: "Add calendar entry" });
      await expect(drawer).toBeVisible();
      await drawer.getByRole("textbox", { name: "Title" }).fill("Quarterly tax reminder");
      await chooseCategory(page, drawer, "Reminder");
      await drawer.getByRole("button", { name: "Add entry" }).click();
      await expect(drawer).not.toBeVisible();
      await expect(page.getByRole("heading", { name: "Quarterly tax reminder" })).toBeVisible();
      await expect(agenda.getByText("All day", { exact: true })).toBeVisible();
      await expect(agenda.getByText("Reminder", { exact: true })).toBeVisible();
    } finally {
      await clearCalendarRange(request, from, to);
    }
  });
});
