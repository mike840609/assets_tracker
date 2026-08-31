import { expect, test, type Browser } from "@playwright/test";

async function openMobileLanding(browser: Browser, path = "/") {
  const context = await browser.newContext({
    locale: "en-US",
    storageState: { cookies: [], origins: [] },
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();

  await page.goto(path);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible({ timeout: 15_000 });

  return { context, page };
}

async function innerScrollState(page: Awaited<ReturnType<Browser["newPage"]>>) {
  return page.evaluate(() => {
    const root = document.getElementById("top");
    const target = document.getElementById("open-source");

    return {
      hash: window.location.hash,
      windowScrollY: window.scrollY,
      rootTop: root?.getBoundingClientRect().top,
      rootBottom: root?.getBoundingClientRect().bottom,
      rootScrollTop: root?.scrollTop,
      targetTop: target?.getBoundingClientRect().top,
    };
  });
}

test("landing brand link has a 44px mobile tap target", async ({ browser }) => {
  const { context, page } = await openMobileLanding(browser);

  try {
    const box = await page.getByRole("link", { name: "Back to top" }).boundingBox();

    expect(box?.height).toBeGreaterThanOrEqual(44);
  } finally {
    await context.close();
  }
});

test("landing code snippets do not add empty keyboard stops", async ({ browser }) => {
  const { context, page } = await openMobileLanding(browser);

  try {
    await expect(page.locator('[role="group"][tabindex]')).toHaveCount(0);
  } finally {
    await context.close();
  }
});

test("landing section navigation keeps the viewport root in place", async ({ browser }) => {
  const { context, page } = await openMobileLanding(browser);

  try {
    // Section links live in the footer at phone width; the header keeps one row.
    await page.locator('footer a[href="#open-source"]').click();
    await page.waitForTimeout(1200);

    const state = await page.evaluate(() => ({
      windowScrollY: window.scrollY,
      rootTop: document.getElementById("top")?.getBoundingClientRect().top,
    }));

    expect(state.windowScrollY).toBe(0);
    expect(state.rootTop).toBe(0);
  } finally {
    await context.close();
  }
});

test("landing direct section links scroll only the inner viewport", async ({ browser }) => {
  const { context, page } = await openMobileLanding(browser, "/#open-source");

  try {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await expect
      .poll(
        async () => {
          const state = await innerScrollState(page);
          return (
            state.hash === "#open-source" &&
            state.windowScrollY === 0 &&
            state.rootTop === 0 &&
            (state.rootScrollTop ?? 0) > 0 &&
            (state.targetTop ?? Number.POSITIVE_INFINITY) >= 0 &&
            (state.targetTop ?? Number.POSITIVE_INFINITY) < (state.rootBottom ?? 0)
          );
        },
        { timeout: 15_000 },
      )
      .toBe(true);
  } finally {
    await context.close();
  }
});

test("landing language switching preserves the selected section", async ({ browser }) => {
  const { context, page } = await openMobileLanding(browser);

  try {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.locator('footer a[href="#open-source"]').click();
    await page.getByRole("button", { name: "Traditional Chinese" }).click();
    await expect(page.getByRole("heading", { name: "開源" })).toBeVisible({ timeout: 15_000 });
    await expect.poll(async () => (await innerScrollState(page)).hash).toBe("#open-source");
    await expect.poll(async () => (await innerScrollState(page)).windowScrollY).toBe(0);
    await expect.poll(async () => (await innerScrollState(page)).rootTop).toBe(0);
    await expect
      .poll(async () => (await innerScrollState(page)).rootScrollTop ?? 0)
      .toBeGreaterThan(0);
    await expect
      .poll(async () => {
        const state = await innerScrollState(page);
        return (
          (state.targetTop ?? Number.POSITIVE_INFINITY) >= 0 &&
          (state.targetTop ?? Number.POSITIVE_INFINITY) < (state.rootBottom ?? 0)
        );
      })
      .toBe(true);
  } finally {
    await context.close();
  }
});

test("landing logo returns the inner viewport to the top", async ({ browser }) => {
  const { context, page } = await openMobileLanding(browser);

  try {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.waitForTimeout(1000);
    await page.evaluate(() => {
      const root = document.getElementById("top");
      root?.scrollTo({ top: root.scrollHeight, behavior: "auto" });
    });
    await page.waitForTimeout(300);

    const before = await page.locator("#top").evaluate((element) => element.scrollTop);
    expect(before).toBeGreaterThan(0);

    await page.getByRole("link", { name: "Back to top" }).click();
    await expect.poll(() => page.locator("#top").evaluate((element) => element.scrollTop)).toBe(0);
  } finally {
    await context.close();
  }
});

test("landing explains self-hosting and market coverage", async ({ browser }) => {
  const { context, page } = await openMobileLanding(browser);

  try {
    await expect(page.getByText("Open source · self-hosted", { exact: true })).toBeVisible();
    await expect(page.getByText("Watchlist", { exact: true })).toBeVisible();
    await expect(page.getByText(/stocks, ETFs, crypto, options, and FX/)).toBeVisible();
  } finally {
    await context.close();
  }
});

test("landing provides deployment responsibility and open-source next steps", async ({
  browser,
}) => {
  const { context, page } = await openMobileLanding(browser);

  try {
    await expect(page.getByText(/Production self-hosting needs HTTPS/)).toBeVisible();
    await expect(page.getByRole("link", { name: "Report an issue" })).toHaveAttribute(
      "href",
      "https://github.com/mike840609/assets_tracker/issues",
    );
    await expect(page.getByRole("link", { name: "Contribute" })).toHaveAttribute(
      "href",
      "https://github.com/mike840609/assets_tracker/blob/master/CONTRIBUTING.md",
    );
    await expect(page.getByRole("link", { name: "View releases" })).toHaveAttribute(
      "href",
      "https://github.com/mike840609/assets_tracker/releases",
    );
    for (const linkName of ["Report an issue", "Contribute", "View releases"]) {
      const link = page.getByRole("link", { name: linkName });
      await link.scrollIntoViewIfNeeded();
      const box = await link.boundingBox();
      expect(box?.height).toBeGreaterThanOrEqual(44);
    }
  } finally {
    await context.close();
  }
});

test("landing metadata follows the selected locale", async ({ browser }) => {
  const context = await browser.newContext({
    locale: "zh-TW",
    storageState: { cookies: [], origins: [] },
    viewport: { width: 390, height: 844 },
  });
  await context.addCookies([{ name: "NEXT_LOCALE", value: "zh-TW", url: "http://localhost:3000" }]);
  const page = await context.newPage();

  try {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible({ timeout: 15_000 });
    await expect(page).toHaveTitle("astt — 自行部署的淨值與投資組合追蹤工具");
    await expect(page.locator('meta[name="description"]')).toHaveAttribute(
      "content",
      "開源、自行部署的淨值與投資組合追蹤工具，支援多幣別的帳戶、投資、不動產、負債與財務目標。",
    );
    await expect(page.locator('meta[property="og:title"]')).toHaveAttribute(
      "content",
      "astt — 自行部署的淨值與投資組合追蹤工具",
    );
    await expect(page.locator('meta[property="og:description"]')).toHaveAttribute(
      "content",
      "開源、自行部署的淨值與投資組合追蹤工具，支援多幣別的帳戶、投資、不動產、負債與財務目標。",
    );
    await expect(page.locator('meta[property="og:locale"]')).toHaveAttribute("content", "zh_TW");
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
      "content",
      /opengraph-image/,
    );
    await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute(
      "content",
      "summary_large_image",
    );
    await expect(page.locator('meta[name="twitter:image"]')).toHaveAttribute(
      "content",
      /twitter-image/,
    );
  } finally {
    await context.close();
  }
});

test("landing sets the selected language before app hydration", async ({ browser }) => {
  const context = await browser.newContext({
    locale: "zh-TW",
    storageState: { cookies: [], origins: [] },
  });
  await context.addCookies([{ name: "NEXT_LOCALE", value: "zh-TW", url: "http://localhost:3000" }]);
  const page = await context.newPage();
  await page.route("**/_next/static/**", (route) => route.abort());

  try {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page.locator("html")).toHaveAttribute("lang", "zh-TW");
  } finally {
    await context.close();
  }
});

test("landing footer links have a distinct navigation name", async ({ browser }) => {
  const { context, page } = await openMobileLanding(browser);

  try {
    await expect(page.getByRole("navigation", { name: "Footer links" })).toBeAttached();
  } finally {
    await context.close();
  }
});

test("landing nav pill tracks the section you are reading", async ({ browser }) => {
  // The header nav only renders from md up, so this is a desktop-width contract.
  const context = await browser.newContext({
    locale: "en-US",
    storageState: { cookies: [], origins: [] },
    viewport: { width: 1280, height: 800 },
  });
  const page = await context.newPage();

  try {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible({ timeout: 15_000 });
    await page.evaluate(() => {
      const root = document.getElementById("top");
      root?.scrollTo({ top: root.scrollHeight * 0.55, behavior: "instant" });
    });
    await expect
      .poll(() => page.locator("header nav [aria-current='location']").count())
      .toBeGreaterThan(0);
    await page.waitForTimeout(500);

    const boxes = await page.evaluate(() => {
      const nav = document.querySelector("header nav");
      const pill = nav?.querySelector('span[aria-hidden="true"]') as HTMLElement | null;
      const active = nav?.querySelector('[aria-current="location"]') as HTMLElement | null;
      if (!pill || !active) return null;
      return {
        pill: pill.getBoundingClientRect().toJSON(),
        active: active.getBoundingClientRect().toJSON(),
      };
    });

    expect(boxes).not.toBeNull();
    expect(boxes!.pill.left).toBeCloseTo(boxes!.active.left, 0);
    expect(boxes!.pill.top).toBeCloseTo(boxes!.active.top, 0);
    expect(boxes!.pill.width).toBeCloseTo(boxes!.active.width, 0);
  } finally {
    await context.close();
  }
});
