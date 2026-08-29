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

  it("keeps long-page orientation and keyboard navigation available", () => {
    expect(landingSource).toContain('href="#main-content"');
    expect(landingSource).toContain('id="main-content"');
    expect(landingNavSource).toContain("IntersectionObserver");
    expect(landingNavSource).toContain('rootMargin: "-15% 0px -65% 0px"');
    expect(landingNavSource).toContain("aria-current");
  });

  it("keeps anchor headings visible below the sticky header", () => {
    for (const id of ["features", "screenshots", "deploy", "open-source"]) {
      const sectionStart = landingSource.indexOf(`id="${id}"`);
      const sectionEnd = landingSource.indexOf(">", sectionStart);
      const sectionMarkup = landingSource.slice(sectionStart, sectionEnd);

      expect(sectionMarkup).toContain('className="scroll-mt-56');
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

  it("adds deployment decision support and copy feedback in both locales", () => {
    for (const key of [
      "dockerFit",
      "dockerPrerequisite",
      "cloudFit",
      "cloudPrerequisite",
      "copyCommand",
      "copiedCommand",
      "copyFailed",
    ]) {
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
    expect(english.landing.dockerPrerequisite).toContain("configured .env");
    expect(traditionalChinese.landing.dockerPrerequisite).toContain("已設定完成的 .env");
  });

  it("keeps deployment options equally prominent and makes the AI deployment prompt copyable", () => {
    const heroCtaEnd = landingSource.indexOf('t("heroSecondaryCta")');
    const heroCtaMarkup = landingSource.slice(
      landingSource.lastIndexOf("<a", heroCtaEnd),
      heroCtaEnd,
    );

    expect(heroCtaMarkup).toContain('href="#deploy"');
    expect(heroCtaMarkup).not.toContain("href={DOCS_URL}");
    expect(heroCtaMarkup).not.toContain('target="_blank"');
    expect(landingSource).toContain('className="mt-8 grid gap-6 lg:grid-cols-3"');
    expect(landingSource).toContain("INSTALL_WITH_AI.md");
    expect(landingSource).toContain(
      'const aiDeployPrompt = t("aiDeployPrompt", { url: AI_DEPLOY_URL });',
    );
    expect(landingSource).toContain("value={aiDeployPrompt}");
    expect(landingSource).not.toContain("href={AI_DEPLOY_URL}");
    for (const key of [
      "aiDeploy",
      "aiDeployBody",
      "aiDeployFit",
      "aiDeployPrerequisite",
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

  it("keeps the hero proof and privacy claims aligned with the product", () => {
    expect(landingSource).toContain("src={SHOTS[0].src}");
    expect(landingSource).toContain('className="hidden lg:block"');
    expect(english.landing.heroTitle).toBe("Your entire net worth, under your control");
    expect(traditionalChinese.landing.heroTitle).toBe("把整份淨值，放在自己掌控之下");
    expect(english.landing.heroNote).toBe(
      "MIT licensed. No financial-data tracking, no data sold, no subscription.",
    );
    expect(traditionalChinese.landing.heroNote).toBe(
      "MIT 授權。不追蹤財務資料、不販售資料、不需訂閱。",
    );
    expect(english.landing.openBody).toContain(
      "Self-hosted deployments keep your data on infrastructure you control",
    );
    expect(traditionalChinese.landing.openBody).toContain("自行部署時，資料留在你掌控的基礎設施");
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
