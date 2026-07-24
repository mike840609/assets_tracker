import { expect, test, type APIRequestContext, type Locator, type Page } from "@playwright/test";

const COLOR_SCHEMAS = ["emerald", "anthropic", "ocean", "violet", "amber", "rose"] as const;
const SMALL_TEXT_AA_CONTRAST = 4.5;

async function clearCalendarRange(request: APIRequestContext, from: string, to: string) {
  const response = await request.get(`/api/calendar-entries?from=${from}&to=${to}`);
  expect(response.ok()).toBeTruthy();
  const body = (await response.json()) as { data: Array<{ id: string }> };

  for (const entry of body.data) {
    expect((await request.delete(`/api/calendar-entries/${entry.id}`)).ok()).toBeTruthy();
  }
}

async function setColorMode(page: Page, schema: (typeof COLOR_SCHEMAS)[number], dark: boolean) {
  await page.evaluate(
    ({ colorSchema, isDark }) => {
      const root = document.documentElement;
      localStorage.setItem("theme", isDark ? "dark" : "light");
      root.classList.toggle("dark", isDark);
      if (colorSchema === "emerald") root.removeAttribute("data-color-schema");
      else root.dataset.colorSchema = colorSchema;
    },
    { colorSchema: schema, isDark: dark },
  );
}

async function computedTextContrast(locator: Locator) {
  return locator.evaluate((element) => {
    type Rgba = { r: number; g: number; b: number; a: number };

    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) throw new Error("Canvas 2D context unavailable");
    const paintContext = context;

    function parseColor(color: string): Rgba {
      paintContext.clearRect(0, 0, 1, 1);
      paintContext.fillStyle = color;
      paintContext.fillRect(0, 0, 1, 1);
      const [r, g, b, alpha] = paintContext.getImageData(0, 0, 1, 1).data;
      return { r, g, b, a: alpha / 255 };
    }

    function composite(foreground: Rgba, background: Rgba): Rgba {
      const alpha = foreground.a + background.a * (1 - foreground.a);
      if (alpha === 0) return { r: 0, g: 0, b: 0, a: 0 };
      return {
        r: (foreground.r * foreground.a + background.r * background.a * (1 - foreground.a)) / alpha,
        g: (foreground.g * foreground.a + background.g * background.a * (1 - foreground.a)) / alpha,
        b: (foreground.b * foreground.a + background.b * background.a * (1 - foreground.a)) / alpha,
        a: alpha,
      };
    }

    const ancestors: Element[] = [];
    for (let current: Element | null = element; current; current = current.parentElement) {
      ancestors.push(current);
    }

    let background: Rgba = { r: 255, g: 255, b: 255, a: 1 };
    for (const ancestor of ancestors.reverse()) {
      background = composite(parseColor(getComputedStyle(ancestor).backgroundColor), background);
    }

    const foreground = composite(parseColor(getComputedStyle(element).color), background);
    const linearChannel = (channel: number) => {
      const normalized = channel / 255;
      return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
    };
    const luminance = (color: Rgba) =>
      0.2126 * linearChannel(color.r) +
      0.7152 * linearChannel(color.g) +
      0.0722 * linearChannel(color.b);
    const lighter = Math.max(luminance(foreground), luminance(background));
    const darker = Math.min(luminance(foreground), luminance(background));

    return (lighter + 0.05) / (darker + 0.05);
  });
}

test.describe("calendar semantic text contrast", () => {
  test("adjacent dates and the OTHER badge meet the 4.5:1 small-text AA threshold", async ({
    page,
    request,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "chromium", "Desktop-only computed style coverage");

    const from = "2034-07-31";
    const to = "2034-09-10";
    await clearCalendarRange(request, from, to);
    const createResponse = await request.post("/api/calendar-entries", {
      data: {
        title: "Contrast fixture",
        eventDate: "2034-08-15",
        startTimeMinutes: null,
        timeZone: null,
        category: "OTHER",
        description: null,
        sourceUrl: null,
      },
    });
    expect(createResponse.ok()).toBeTruthy();

    try {
      await page.goto("/calendar?month=2034-08&date=2034-08-15");
      await page.addStyleTag({
        content:
          "*, *::before, *::after { transition-duration: 0s !important; animation-duration: 0s !important; }",
      });
      const adjacentDate = page
        .getByRole("gridcell")
        .getByRole("button", { name: /Monday, July 31, 2034/ });
      const otherBadge = page
        .getByRole("region", { name: /on Tuesday, August 15, 2034/ })
        .getByText("Other", { exact: true });

      await expect(adjacentDate).toBeVisible();
      await expect(otherBadge).toBeVisible();

      for (const schema of COLOR_SCHEMAS) {
        for (const dark of [false, true]) {
          await setColorMode(page, schema, dark);

          expect
            .soft(
              await computedTextContrast(adjacentDate),
              `${schema} ${dark ? "dark" : "light"} adjacent date`,
            )
            .toBeGreaterThanOrEqual(SMALL_TEXT_AA_CONTRAST);
          expect
            .soft(
              await computedTextContrast(otherBadge),
              `${schema} ${dark ? "dark" : "light"} OTHER badge`,
            )
            .toBeGreaterThanOrEqual(SMALL_TEXT_AA_CONTRAST);
        }
      }
    } finally {
      await clearCalendarRange(request, from, to);
    }
  });
});
