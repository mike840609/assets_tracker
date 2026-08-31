import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (relativePath: string) => fs.readFileSync(path.join(root, relativePath), "utf8");
const landingSource = read("src/components/landing/landing-content.tsx");
const landingNavPath = path.join(root, "src/components/landing/landing-nav.tsx");
const landingNavSource = fs.existsSync(landingNavPath)
  ? fs.readFileSync(landingNavPath, "utf8")
  : "";
const landingScreenshotPath = path.join(root, "src/components/landing/landing-screenshot.tsx");
const landingScreenshotSource = fs.existsSync(landingScreenshotPath)
  ? fs.readFileSync(landingScreenshotPath, "utf8")
  : "";
const copyButtonPath = path.join(root, "src/components/landing/landing-copy-button.tsx");
const copyButtonSource = fs.existsSync(copyButtonPath)
  ? fs.readFileSync(copyButtonPath, "utf8")
  : "";
const english = JSON.parse(read("messages/en-US.json")) as {
  landing: Record<string, unknown>;
};
const traditionalChinese = JSON.parse(read("messages/zh-TW.json")) as typeof english;

describe("landing page UI contract", () => {
  it("keeps mobile navigation reachable without horizontal scrolling", () => {
    expect(landingSource).toContain("LandingNav");
    expect(landingSource).toContain("sticky top-0");
    expect(landingNavSource).toContain("flex-wrap");
    expect(landingNavSource).not.toContain("overflow-x-auto");
  });

  it("keeps the sticky header to one row on phones", () => {
    // Section links used to wrap onto a second sticky row below md, which cost
    // 44px of every phone screen for the whole scroll. They live in the footer
    // at that width now, so the anchor offset is a single header height.
    expect(landingNavSource).toContain("hidden");
    expect(landingNavSource).toContain("md:flex");
    expect(landingSource).toContain("md:hidden");
    expect(landingSource).not.toContain("scroll-mt-56");
  });

  it("keeps long-page orientation and keyboard navigation available", () => {
    expect(landingSource).toContain('href="#main-content"');
    expect(landingSource).toContain('id="main-content"');
    expect(landingNavSource).toContain("IntersectionObserver");
    expect(landingNavSource).toContain('rootMargin: "-15% 0px -65% 0px"');
    expect(landingNavSource).toContain("aria-current");
    expect(landingNavSource).toContain("event.preventDefault()");
    expect(landingNavSource).toContain("scrollRoot.scrollTo");
  });

  it("keeps anchor headings visible below the sticky header", () => {
    for (const id of ["features", "screenshots", "deploy", "open-source"]) {
      const sectionStart = landingSource.indexOf(`id="${id}"`);
      const sectionEnd = landingSource.indexOf(">", sectionStart);
      const sectionMarkup = landingSource.slice(sectionStart, sectionEnd);

      expect(sectionMarkup).toContain('className="scroll-mt-20');
    }
  });

  it("provides a post-screenshot next step in both locales", () => {
    expect(landingSource).toContain('t("sectionCtaTitle")');
    expect(landingSource).toContain('t("sectionCtaPrimary")');
    expect(landingSource).toContain('t("sectionCtaSecondary")');
    expect(english.landing.sectionCtaTitle).toBeDefined();
    expect(english.landing.sectionCtaPrimary).toBeDefined();
    expect(english.landing.sectionCtaSecondary).toBeDefined();
    expect(traditionalChinese.landing.sectionCtaTitle).toBeDefined();
    expect(traditionalChinese.landing.sectionCtaPrimary).toBeDefined();
    expect(traditionalChinese.landing.sectionCtaSecondary).toBeDefined();
  });

  it("keeps deployment cards compact with copy feedback in both locales", () => {
    for (const key of ["copyCommand", "copiedCommand", "copyFailed"]) {
      expect(landingSource).toContain(`t("${key}")`);
      expect(english.landing[key]).toBeDefined();
      expect(traditionalChinese.landing[key]).toBeDefined();
    }

    expect(landingSource).toContain("LandingCopyButton");
    expect(landingSource).toContain("flex min-w-0 flex-col gap-3 sm:flex-row");
    expect(landingSource).not.toContain("flex min-w-max items-start gap-3");
    expect(copyButtonSource).toContain("navigator.clipboard.writeText");
    expect(copyButtonSource).toContain('aria-live="polite"');
  });

  it("keeps the Docker copy command aligned with the published-image deployment flow", () => {
    expect(landingSource).toContain(
      '"docker compose --profile full pull\\ndocker compose --profile full up --no-build -d"',
    );
  });

  it("guides prospective self-hosters to setup before sign-in", () => {
    const heroPrimaryCtaEnd = landingSource.indexOf('t("heroPrimaryCta")');
    const heroPrimaryCtaMarkup = landingSource.slice(
      landingSource.lastIndexOf("<a", heroPrimaryCtaEnd),
      heroPrimaryCtaEnd,
    );
    const heroSecondaryCtaEnd = landingSource.indexOf('t("heroSecondaryCta")');
    const heroSecondaryCtaMarkup = landingSource.slice(
      landingSource.lastIndexOf("<Link", heroSecondaryCtaEnd),
      heroSecondaryCtaEnd,
    );

    expect(heroPrimaryCtaMarkup).toContain('href="#deploy"');
    expect(heroSecondaryCtaMarkup).toContain('href="/login"');
    expect(english.landing.heroScope).toBeDefined();
    expect(traditionalChinese.landing.heroScope).toBeDefined();
  });

  it("keeps deployment options equally prominent and makes the AI deployment prompt copyable", () => {
    // items-start keeps all three columns equally prominent while letting each
    // card end where its content ends: bottom-aligning the links left a 157px
    // hole in the middle of the one card without a code block.
    expect(landingSource).toContain('className="mt-8 grid items-start gap-6 lg:grid-cols-3"');
    expect(landingSource).toContain("INSTALL_WITH_AI.md");
    expect(landingSource).toContain(
      'const aiDeployPrompt = t("aiDeployPrompt", { url: AI_DEPLOY_URL });',
    );
    expect(landingSource).toContain("value={aiDeployPrompt}");
    expect(landingSource).not.toContain("href={AI_DEPLOY_URL}");
    for (const key of [
      "aiDeploy",
      "aiDeployBody",
      "copyPrompt",
      "copiedPrompt",
      "copyPromptFailed",
    ]) {
      expect(landingSource).toContain(`t("${key}")`);
      expect(english.landing[key]).toBeDefined();
      expect(traditionalChinese.landing[key]).toBeDefined();
    }

    expect(english.landing.aiDeployPrompt).toContain("{url}");
    expect(traditionalChinese.landing.aiDeployPrompt).toContain("{url}");
  });

  it("tells a first-time visitor which deployment path is theirs", () => {
    // The earlier pass cut dockerFit / cloudFit / aiDeployFit as redundant with
    // the bodies. The audience line is the replacement, not a revival: it says
    // who the path is for, and the body no longer repeats it as a prefix.
    for (const key of ["dockerAudience", "cloudAudience", "aiDeployAudience"]) {
      expect(landingSource).toContain(`t("${key}")`);
      expect(english.landing[key]).toBeDefined();
      expect(traditionalChinese.landing[key]).toBeDefined();
    }

    for (const body of ["dockerBody", "cloudBody"] as const) {
      expect(english.landing[body]).not.toMatch(/^For /);
    }
  });

  it("omits redundant landing descriptions without removing the product paths", () => {
    for (const key of [
      "featuresSubtitle",
      "shotsSubtitle",
      "sectionCtaBody",
      "dockerFit",
      "dockerPrerequisite",
      "cloudFit",
      "cloudPrerequisite",
      "cloudPoint1",
      "cloudPoint2",
      "aiDeployFit",
      "aiDeployPrerequisite",
    ]) {
      expect(landingSource).not.toContain(`t("${key}")`);
      expect(english.landing[key]).toBeUndefined();
      expect(traditionalChinese.landing[key]).toBeUndefined();
    }

    for (const key of ["dockerBody", "cloudBody", "aiDeployBody"]) {
      expect(landingSource).toContain(`t("${key}")`);
      expect(english.landing[key]).toBeDefined();
      expect(traditionalChinese.landing[key]).toBeDefined();
    }
  });

  it("keeps the hero proof and privacy claims aligned with the product", () => {
    // Both hero frames ship, each at the width where it is the honest proof:
    // the desktop dashboard from lg up, the phone screen below it. They never
    // appear together, and neither is overlaid on the other.
    expect(landingSource).toContain("src={HERO_DESKTOP_SHOT.src}");
    expect(landingSource).toContain("src={HERO_MOBILE_SHOT.src}");
    expect(landingSource).toContain('className="hidden lg:block"');
    expect(landingSource).toContain("lg:hidden");
    expect(landingSource).not.toContain('src: "/readme-hero.jpg"');
    expect(landingSource).not.toContain("absolute bottom-0 right-0");
    expect(english.landing.heroTitle).toBe("All your assets, one up-to-date net worth");
    expect(traditionalChinese.landing.heroTitle).toBe("整合所有資產，隨時掌握最新淨值");
    expect(english.landing.heroNote).toBe(
      "MIT licensed. No financial-data tracking, no data sold, no subscription.",
    );
    expect(traditionalChinese.landing.heroNote).toBe(
      "MIT 授權。不追蹤財務資料、不販售資料、不需訂閱。",
    );
    expect(english.landing.openBody).toBe(
      "MIT licensed. Your data stays on infrastructure you control; you secure the deployment.",
    );
    expect(traditionalChinese.landing.openBody).toBe(
      "MIT 授權。資料留在你掌控的基礎設施，部署安全由你負責。",
    );
  });

  it("links to the security policy in both locales", () => {
    expect(landingSource).toContain("const SECURITY_URL = `${REPO_URL}/security/policy`;");
    expect(landingSource).toContain("href={SECURITY_URL}");
    expect(landingSource).toContain('t("footerSecurity")');
    expect(english.landing.footerSecurity).toBeDefined();
    expect(traditionalChinese.landing.footerSecurity).toBeDefined();
  });

  it("serves screenshots at the size they are displayed", () => {
    // The gallery shipped 1430px JPEGs to every viewport (2.4 MB on a phone).
    // next/image + a per-breakpoint `sizes` is what makes the browser pick a
    // variant, so a regression to a bare <img> is a 10x payload regression.
    expect(landingScreenshotSource).toContain('from "next/image"');
    expect(landingScreenshotSource).not.toContain("<img");
    expect(landingScreenshotSource).toContain("sizes={sizes}");

    const usages = landingSource.match(/<LandingScreenshot[\s\S]*?\/>/g) ?? [];
    expect(usages.length).toBeGreaterThan(0);
    for (const usage of usages) {
      expect(usage).toContain("sizes=");
    }
    // Both hero frames are the LCP candidate at their breakpoint.
    expect(landingSource.match(/priority/g)?.length).toBe(2);
  });

  it("declares the screenshot dimensions the files actually have", () => {
    // A declared ratio that does not match the decoded image reserves the wrong
    // box and shifts the page on load. These assets get re-shot; the numbers in
    // the table have to be re-read from the files when they do. The extension
    // check is not pedantry: the direct "open full size" link is served with the
    // Content-Type of the extension, so a PNG named .jpg ships mislabeled.
    const readSize = (buf: Buffer) => {
      const isPng = buf.subarray(0, 8).equals(Buffer.from("89504e470d0a1a0a", "hex"));
      if (isPng) {
        return { format: "png", width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
      }
      if (buf[0] !== 0xff || buf[1] !== 0xd8) return null;
      let i = 2;
      while (i < buf.length - 9) {
        if (buf[i] !== 0xff) {
          i += 1;
          continue;
        }
        const marker = buf[i + 1];
        const isStartOfFrame =
          marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker);
        if (isStartOfFrame) {
          return {
            format: "jpg",
            height: buf.readUInt16BE(i + 5),
            width: buf.readUInt16BE(i + 7),
          };
        }
        i += 2 + buf.readUInt16BE(i + 2);
      }
      return null;
    };

    const entries = [
      ...landingSource.matchAll(
        /src: "(\/landing\/[a-z0-9-]+\.(?:jpg|png))",\s*\n\s*width: (\d+),\s*\n\s*height: (\d+),/g,
      ),
    ];
    expect(entries.length).toBeGreaterThanOrEqual(14);

    for (const [, src, width, height] of entries) {
      const file = path.join(root, "public", src);
      expect(fs.existsSync(file), `${src} is referenced but missing`).toBe(true);
      const actual = readSize(fs.readFileSync(file));
      expect(actual, `${src} is not a readable PNG or JPEG`).not.toBeNull();
      expect({
        src,
        extension: src.endsWith(".png") ? "png" : "jpg",
        width: Number(width),
        height: Number(height),
      }).toEqual({ src, extension: actual!.format, width: actual!.width, height: actual!.height });
    }
  });

  it("keeps the requested desktop and mobile screenshot slots", () => {
    for (const key of [
      "desktopDashboard",
      "desktopAccounts",
      "desktopAnalysis",
      "desktopCalendar",
      "desktopHistory",
      "desktopSettings",
      "mobileMaxDrawdown",
      "mobileDashboard",
      "mobileWatchlist",
      "mobileGoals",
      "mobileConcentration",
      "mobileSummary",
      "mobileDailySnapshots",
      "mobileAssetAllocation",
    ]) {
      expect(landingSource).toContain(`key: "${key}"`);
    }

    for (const key of ["desktopGoals", "desktopPortfolio", "mobileProjections", "mobileCompact"]) {
      expect(landingSource).not.toContain(`key: "${key}"`);
    }

    expect(landingSource).toContain('groupKey === "mobile"');
    expect(landingSource).toContain("overflow-x-auto");
    expect(landingSource).toContain("shrink-0");
  });

  it("offers shortcuts between screenshot groups on the long mobile page", () => {
    for (const href of ['href="#shots-desktop"', 'href="#shots-mobile"', 'href="#deploy"']) {
      expect(landingSource).toContain(href);
    }

    expect(landingSource).toContain("id={`shots-${groupKey}`}");
    expect(landingSource).toContain('t("shotsNavLabel")');
    expect(english.landing.shotsNavLabel).toBeDefined();
    expect(traditionalChinese.landing.shotsNavLabel).toBeDefined();
  });

  it("keeps the copy control icon-only while preserving accessible feedback", () => {
    expect(copyButtonSource).toContain("md:h-8");
    expect(copyButtonSource).toContain("min-h-11");
    expect(copyButtonSource).toContain("min-w-11");
    expect(copyButtonSource).toContain("md:w-8");
    expect(copyButtonSource).toContain("self-start");
    expect(copyButtonSource).toContain("title={statusLabel}");
    expect(copyButtonSource).toContain('className="sr-only"');
    expect(copyButtonSource).not.toContain('<span aria-live="polite">{statusLabel}</span>');
  });

  it("offers screenshot zoom and a recovery path when an image fails", () => {
    expect(landingSource).toContain("LandingScreenshot");
    expect(landingScreenshotSource).toContain("onError");
    expect(landingScreenshotSource).toContain("fallbackHref");
    for (const key of ["shotOpen", "shotFallback", "shotFallbackLink"]) {
      expect(english.landing[key]).toBeDefined();
      expect(traditionalChinese.landing[key]).toBeDefined();
    }
  });
});
