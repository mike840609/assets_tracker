import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import {
  ArrowRight,
  CalendarClock,
  ChartPie,
  Coins,
  History,
  Layers,
  Repeat,
  Smartphone,
  Target,
  TrendingUp,
} from "lucide-react";
import { DemoLoginButton } from "@/components/demo/demo-login-button";
import { GitHubMark } from "@/components/layout/github-mark";
import { LandingCopyButton } from "@/components/landing/landing-copy-button";
import { LandingLocaleSwitcher } from "@/components/landing/landing-locale-switcher";
import { LandingNav } from "@/components/landing/landing-nav";
import { LandingScreenshot } from "@/components/landing/landing-screenshot";
import { isPublicDemoEnabled } from "@/lib/env";
import { REPO_URL, LICENSE_URL } from "@/lib/repo";
import type { Locale } from "@/i18n/config";

const DOCS_URL = `${REPO_URL}/blob/master/docs/DEPLOYMENT.md`;
const AI_DEPLOY_URL =
  "https://raw.githubusercontent.com/mike840609/assets_tracker/master/docs/INSTALL_WITH_AI.md";
const DOCKER_COMMAND =
  "docker compose --profile full pull\ndocker compose --profile full up --no-build -d";
const FOCUS_RING_CLASS =
  "focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50";
const LANDING_NAV_ITEMS = [
  { href: "#features", labelKey: "navFeatures" },
  { href: "#screenshots", labelKey: "navScreenshots" },
  { href: "#deploy", labelKey: "navDeploy" },
  { href: "#open-source", labelKey: "navOpenSource" },
] as const;

/**
 * Verified product previews. Keep the intrinsic dimensions here so the browser
 * can reserve image space before each asset finishes loading.
 */
const SHOTS = [
  {
    key: "overview",
    src: "/readme-hero.jpg",
    width: 1192,
    height: 795,
    orientation: "landscape",
  },
  {
    key: "desktopDashboard",
    src: "/landing/desktop-dashboard.jpg",
    width: 766,
    height: 540,
    orientation: "landscape",
  },
  {
    key: "desktopPortfolio",
    src: "/landing/desktop-portfolio.jpg",
    width: 766,
    height: 540,
    orientation: "landscape",
  },
  {
    key: "desktopAccounts",
    src: "/landing/desktop-accounts.jpg",
    width: 766,
    height: 540,
    orientation: "landscape",
  },
  {
    key: "mobile",
    src: "/readme-demo-mobile.png",
    width: 860,
    height: 1864,
    orientation: "mobile",
  },
  {
    key: "mobileCompact",
    src: "/landing/mobile-compact.jpg",
    width: 215,
    height: 465,
    orientation: "mobile",
  },
] as const;

const FEATURES = [
  { key: "currency", group: "overview", Icon: Coins },
  { key: "accounts", group: "overview", Icon: Layers },
  { key: "market", group: "overview", Icon: TrendingUp },
  { key: "history", group: "overview", Icon: History },
  { key: "goals", group: "planning", Icon: Target },
  { key: "recurring", group: "planning", Icon: Repeat },
  { key: "analysis", group: "insight", Icon: ChartPie },
  { key: "devices", group: "insight", Icon: Smartphone },
] as const;

const FEATURE_GROUPS = [
  { key: "overview", featured: true },
  { key: "planning", featured: false },
  { key: "insight", featured: false },
] as const;

function AppMark({ className = "h-9 w-9" }: { className?: string }) {
  return (
    <div
      className={`flex items-center justify-center rounded-xl shadow-sm ${className}`}
      style={{
        background:
          "linear-gradient(135deg, var(--app-icon-gradient-start) 0%, var(--app-icon-gradient-end) 100%)",
      }}
    >
      <TrendingUp className="h-5 w-5 text-white" strokeWidth={2} aria-hidden="true" />
    </div>
  );
}

export async function LandingContent() {
  const [t, locale] = await Promise.all([getTranslations("landing"), getLocale()]);
  const activeLocale = locale as Locale;
  const aiDeployPrompt = t("aiDeployPrompt", { url: AI_DEPLOY_URL });

  return (
    <div
      id="top"
      className="dark landing-theme h-dvh w-full scroll-smooth motion-reduce:scroll-auto overflow-x-hidden overflow-y-auto bg-background text-foreground"
    >
      <a
        href="#main-content"
        className={`${FOCUS_RING_CLASS} sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-background focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:text-foreground`}
      >
        {t("skipToContent")}
      </a>
      <header className="sticky top-0 z-10 border-b border-border/50 bg-background">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3 sm:px-6">
          <a
            href="#top"
            className={`${FOCUS_RING_CLASS} flex items-center gap-2.5 rounded-lg`}
            aria-label={t("navHome")}
          >
            <AppMark className="h-8 w-8" />
            <span className="text-base font-semibold tracking-tight text-foreground">astt</span>
          </a>
          <LandingNav
            items={LANDING_NAV_ITEMS.map(({ href, labelKey }) => ({
              href,
              label: t(labelKey),
            }))}
            label={t("navLabel")}
          />
          <div className="flex items-center gap-1 sm:gap-2">
            <LandingLocaleSwitcher
              locale={activeLocale}
              label={t("language.label")}
              englishLabel={t("language.english")}
              traditionalChineseLabel={t("language.traditionalChinese")}
            />
            <a
              href={REPO_URL}
              target="_blank"
              rel="noopener noreferrer"
              className={`${FOCUS_RING_CLASS} flex h-11 min-w-11 items-center justify-center gap-1.5 rounded-lg px-3 text-sm text-muted-foreground transition-colors hover:text-foreground md:h-9 md:min-w-0`}
            >
              <GitHubMark className="h-4 w-4" />
              <span className="sr-only sm:not-sr-only">{t("navSource")}</span>
            </a>
            <Link
              href="/login"
              className={`${FOCUS_RING_CLASS} inline-flex h-11 items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 md:h-9`}
            >
              {t("navSignIn")}
            </Link>
          </div>
        </div>
      </header>

      <main
        id="main-content"
        tabIndex={-1}
        className="scroll-mt-56 sm:scroll-mt-40 md:scroll-mt-20"
      >
        {/* Hero */}
        <section className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-center lg:gap-16 lg:py-20">
          <div className="space-y-6">
            <h1 className="text-balance text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              {t("heroTitle")}
            </h1>
            <p className="max-w-prose text-base leading-relaxed text-muted-foreground">
              {t("heroSubtitle")}
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <Link
                href="/login"
                className={`${FOCUS_RING_CLASS} inline-flex h-12 items-center rounded-xl bg-primary px-5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90`}
              >
                {t("heroPrimaryCta")}
                <ArrowRight className="ml-1.5 h-4 w-4" aria-hidden="true" />
              </Link>
              <a
                href="#deploy"
                className={`${FOCUS_RING_CLASS} flex h-12 items-center rounded-xl border border-border px-5 text-sm font-medium text-foreground transition-colors hover:bg-secondary`}
              >
                {t("heroSecondaryCta")}
              </a>
            </div>
            <p className="text-xs text-muted-foreground">{t("heroNote")}</p>
          </div>

          {isPublicDemoEnabled ? (
            <div className="rounded-2xl border border-border/50 bg-card/80 p-5 sm:p-6">
              <p className="mb-1 text-sm font-semibold text-foreground">{t("demoTitle")}</p>
              <p className="mb-4 text-xs text-muted-foreground">{t("demoBody")}</p>
              <DemoLoginButton />
            </div>
          ) : (
            <figure className="hidden lg:block">
              <LandingScreenshot
                src={SHOTS[0].src}
                alt={t("shot.overview.caption")}
                width={SHOTS[0].width}
                height={SHOTS[0].height}
                orientation={SHOTS[0].orientation}
                openLabel={t("shotOpen")}
                fallbackLabel={t("shotFallback")}
                fallbackHref={DOCS_URL}
                fallbackLinkLabel={t("shotFallbackLink")}
              />
              <figcaption className="mt-2 text-sm text-muted-foreground">
                {t("shot.overview.caption")}
              </figcaption>
            </figure>
          )}
        </section>

        {/* Features */}
        <section
          id="features"
          className="scroll-mt-56 border-t border-border/50 bg-secondary/30 sm:scroll-mt-40 md:scroll-mt-20"
        >
          <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:py-20">
            <h2 className="text-balance text-2xl font-bold tracking-tight text-foreground">
              {t("featuresTitle")}
            </h2>
            <p className="mt-2 max-w-prose text-sm text-muted-foreground">
              {t("featuresSubtitle")}
            </p>
            <div className="mt-10 grid gap-x-12 gap-y-10 lg:grid-cols-2 lg:gap-y-12">
              {FEATURE_GROUPS.map(({ key, featured }) => (
                <div key={key} className={featured ? "lg:col-span-2" : undefined}>
                  <h3 className="text-balance border-b border-border/60 pb-3 text-sm font-semibold text-foreground">
                    {t(`featureGroup.${key}`)}
                  </h3>
                  <dl className="mt-5 grid gap-x-10 gap-y-7 sm:grid-cols-2">
                    {FEATURES.filter((feature) => feature.group === key).map(({ key, Icon }) => (
                      <div key={key} className="flex gap-3.5">
                        <Icon className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
                        <div className="space-y-1">
                          <dt className="text-sm font-semibold text-foreground">
                            {t(`feature.${key}.title`)}
                          </dt>
                          <dd className="text-sm leading-relaxed text-muted-foreground">
                            {t(`feature.${key}.body`)}
                          </dd>
                        </div>
                      </div>
                    ))}
                  </dl>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Screenshots */}
        <section
          id="screenshots"
          className="scroll-mt-56 border-t border-border/50 sm:scroll-mt-40 md:scroll-mt-20"
        >
          <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:py-20">
            <h2 className="text-balance text-2xl font-bold tracking-tight text-foreground">
              {t("shotsTitle")}
            </h2>
            <p className="mt-2 max-w-prose text-sm text-muted-foreground">{t("shotsSubtitle")}</p>
            <nav aria-label={t("shotsNavLabel")} className="mt-5 flex flex-wrap gap-2">
              <a
                href="#shots-desktop"
                className={`${FOCUS_RING_CLASS} inline-flex min-h-11 items-center rounded-lg border border-border/70 px-3 text-sm font-medium text-foreground transition-colors hover:bg-secondary md:min-h-0`}
              >
                {t("shotsGroup.desktop")}
              </a>
              <a
                href="#shots-mobile"
                className={`${FOCUS_RING_CLASS} inline-flex min-h-11 items-center rounded-lg border border-border/70 px-3 text-sm font-medium text-foreground transition-colors hover:bg-secondary md:min-h-0`}
              >
                {t("shotsGroup.mobile")}
              </a>
              <a
                href="#deploy"
                className={`${FOCUS_RING_CLASS} inline-flex min-h-11 items-center rounded-lg border border-border/70 px-3 text-sm font-medium text-foreground transition-colors hover:bg-secondary md:min-h-0`}
              >
                {t("sectionCtaSecondary")}
              </a>
            </nav>
            <div className="mt-8 space-y-10">
              {[
                {
                  key: "desktop",
                  shots: SHOTS.filter(({ orientation }) => orientation !== "mobile"),
                },
                {
                  key: "mobile",
                  shots: SHOTS.filter(({ orientation }) => orientation === "mobile"),
                },
              ].map(({ key: groupKey, shots }) => (
                <div
                  key={groupKey}
                  id={`shots-${groupKey}`}
                  className="scroll-mt-56 sm:scroll-mt-40 md:scroll-mt-20"
                >
                  <h3 className="text-sm font-semibold text-foreground">
                    {t(`shotsGroup.${groupKey}`)}
                  </h3>
                  <div className="mt-4 grid gap-6 sm:grid-cols-2">
                    {shots.map(({ key, src, width, height, orientation }) => (
                      <figure key={key} className="space-y-2">
                        <LandingScreenshot
                          src={src}
                          alt={t(`shot.${key}.caption`)}
                          width={width}
                          height={height}
                          orientation={orientation}
                          openLabel={t("shotOpen")}
                          fallbackLabel={t("shotFallback")}
                          fallbackHref={DOCS_URL}
                          fallbackLinkLabel={t("shotFallbackLink")}
                        />
                        <figcaption className="text-sm text-muted-foreground">
                          {t(`shot.${key}.caption`)}
                        </figcaption>
                      </figure>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-12 flex flex-col gap-3 border-t border-border/50 pt-8 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1">
                <p className="text-sm font-semibold text-foreground">{t("sectionCtaTitle")}</p>
                <p className="text-sm text-muted-foreground">{t("sectionCtaBody")}</p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Link
                  href="/login"
                  className={`${FOCUS_RING_CLASS} inline-flex h-11 items-center gap-1.5 rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90`}
                >
                  {t("sectionCtaPrimary")}
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
                <a
                  href="#deploy"
                  className={`${FOCUS_RING_CLASS} inline-flex h-11 items-center rounded-xl border border-border px-4 text-sm font-medium text-foreground transition-colors hover:bg-secondary`}
                >
                  {t("sectionCtaSecondary")}
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* Deploy */}
        <section
          id="deploy"
          className="scroll-mt-56 border-t border-border/50 bg-secondary/30 sm:scroll-mt-40 md:scroll-mt-20"
        >
          <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:py-20">
            <h2 className="text-balance text-2xl font-bold tracking-tight text-foreground">
              {t("deployTitle")}
            </h2>
            <p className="mt-2 max-w-prose text-sm text-muted-foreground">{t("deploySubtitle")}</p>
            <div className="mt-8 grid gap-6 lg:grid-cols-3">
              <div className="flex h-full min-w-0 flex-col gap-4 rounded-2xl border border-border/50 bg-card p-5 sm:p-6">
                <div className="space-y-1">
                  <h3 className="text-balance text-base font-semibold text-foreground">
                    {t("dockerTitle")}
                  </h3>
                  <p className="text-sm text-muted-foreground">{t("dockerBody")}</p>
                  <p className="text-sm font-medium text-foreground">{t("dockerFit")}</p>
                  <p className="text-xs text-muted-foreground">{t("dockerPrerequisite")}</p>
                </div>
                <div
                  tabIndex={0}
                  role="group"
                  aria-label={t("dockerTitle")}
                  className="rounded-xl bg-muted/50 p-3 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                >
                  <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <code className="block min-w-0 max-w-full overflow-x-auto whitespace-pre font-mono text-xs leading-relaxed text-foreground">
                      {DOCKER_COMMAND}
                    </code>
                    <LandingCopyButton
                      value={DOCKER_COMMAND}
                      label={t("copyCommand")}
                      copiedLabel={t("copiedCommand")}
                      failedLabel={t("copyFailed")}
                    />
                  </div>
                </div>
                <a
                  href={DOCS_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`${FOCUS_RING_CLASS} mt-auto inline-flex min-h-11 items-center gap-1.5 rounded-md text-sm font-medium text-primary hover:underline md:min-h-0`}
                >
                  {t("dockerLink")}
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </a>
              </div>

              <div className="flex h-full min-w-0 flex-col gap-4 rounded-2xl border border-border/50 bg-card p-5 sm:p-6">
                <div className="space-y-1">
                  <h3 className="text-balance text-base font-semibold text-foreground">
                    {t("cloudTitle")}
                  </h3>
                  <p className="text-sm text-muted-foreground">{t("cloudBody")}</p>
                  <p className="text-sm font-medium text-foreground">{t("cloudFit")}</p>
                  <p className="text-xs text-muted-foreground">{t("cloudPrerequisite")}</p>
                </div>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-start gap-2.5">
                    <CalendarClock
                      className="mt-0.5 h-4 w-4 shrink-0 text-primary"
                      aria-hidden="true"
                    />
                    <span>{t("cloudPoint1")}</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <Coins className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                    <span>{t("cloudPoint2")}</span>
                  </li>
                </ul>
                <a
                  href={DOCS_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`${FOCUS_RING_CLASS} mt-auto inline-flex min-h-11 items-center gap-1.5 rounded-md text-sm font-medium text-primary hover:underline md:min-h-0`}
                >
                  {t("cloudLink")}
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </a>
              </div>

              <div className="flex h-full min-w-0 flex-col gap-4 rounded-2xl border border-primary/40 bg-primary/5 p-5 sm:p-6">
                <div className="space-y-1">
                  <h3 className="text-balance text-base font-semibold text-foreground">
                    {t("aiDeploy")}
                  </h3>
                  <p className="text-sm text-muted-foreground">{t("aiDeployBody")}</p>
                  <p className="text-sm font-medium text-foreground">{t("aiDeployFit")}</p>
                  <p className="text-xs text-muted-foreground">{t("aiDeployPrerequisite")}</p>
                </div>
                <div
                  tabIndex={0}
                  role="group"
                  aria-label={t("aiDeploy")}
                  className="mt-auto rounded-xl bg-background/50 p-3 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                >
                  <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <code className="block min-w-0 max-w-full overflow-x-auto whitespace-pre-wrap break-words font-mono text-xs leading-relaxed text-foreground">
                      {aiDeployPrompt}
                    </code>
                    <LandingCopyButton
                      value={aiDeployPrompt}
                      label={t("copyPrompt")}
                      copiedLabel={t("copiedPrompt")}
                      failedLabel={t("copyPromptFailed")}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Open source / privacy */}
        <section
          id="open-source"
          className="scroll-mt-56 border-t border-border/50 sm:scroll-mt-40 md:scroll-mt-20"
        >
          <div className="mx-auto max-w-3xl space-y-4 px-4 py-14 text-center sm:px-6 lg:py-20">
            <h2 className="text-balance text-2xl font-bold tracking-tight text-foreground">
              {t("openTitle")}
            </h2>
            <p className="text-sm leading-relaxed text-muted-foreground">{t("openBody")}</p>
            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <a
                href={REPO_URL}
                target="_blank"
                rel="noopener noreferrer"
                className={`${FOCUS_RING_CLASS} flex h-12 items-center gap-2 rounded-xl border border-border px-5 text-sm font-medium text-foreground transition-colors hover:bg-secondary`}
              >
                <GitHubMark className="h-4 w-4" />
                {t("openCta")}
              </a>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border/50">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 py-6 text-xs text-muted-foreground sm:flex-row sm:px-6">
          <p>{t("footerLicense")}</p>
          <nav className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
            <a
              href={DOCS_URL}
              target="_blank"
              rel="noopener noreferrer"
              className={`${FOCUS_RING_CLASS} inline-flex min-h-11 min-w-11 items-center justify-center rounded-md px-2 hover:underline md:min-h-0 md:min-w-0 md:px-0`}
            >
              {t("footerDocs")}
            </a>
            <a
              href={LICENSE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className={`${FOCUS_RING_CLASS} inline-flex min-h-11 min-w-11 items-center justify-center rounded-md px-2 hover:underline md:min-h-0 md:min-w-0 md:px-0`}
            >
              {t("footerLicenseLink")}
            </a>
            <Link
              href="/privacy"
              className={`${FOCUS_RING_CLASS} inline-flex min-h-11 min-w-11 items-center justify-center rounded-md px-2 hover:underline md:min-h-0 md:min-w-0 md:px-0`}
            >
              {t("footerPrivacy")}
            </Link>
            <Link
              href="/terms"
              className={`${FOCUS_RING_CLASS} inline-flex min-h-11 min-w-11 items-center justify-center rounded-md px-2 hover:underline md:min-h-0 md:min-w-0 md:px-0`}
            >
              {t("footerTerms")}
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
