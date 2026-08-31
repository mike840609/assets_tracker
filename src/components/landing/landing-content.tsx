import type { CSSProperties } from "react";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import {
  ArrowRight,
  ChartPie,
  Coins,
  Eye,
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
import { LandingScrollLink } from "@/components/landing/landing-scroll-link";
import { LandingLocaleSwitcher } from "@/components/landing/landing-locale-switcher";
import { LandingNav } from "@/components/landing/landing-nav";
import { LandingScreenshot } from "@/components/landing/landing-screenshot";
import { isPublicDemoEnabled } from "@/lib/env";
import { REPO_URL, LICENSE_URL } from "@/lib/repo";
import type { Locale } from "@/i18n/config";

const DOCS_URL = `${REPO_URL}/blob/master/docs/DEPLOYMENT.md`;
const SECURITY_URL = `${REPO_URL}/security/policy`;
const ISSUES_URL = `${REPO_URL}/issues`;
const CONTRIBUTING_URL = `${REPO_URL}/blob/master/CONTRIBUTING.md`;
const RELEASES_URL = `${REPO_URL}/releases`;
const AI_DEPLOY_URL =
  "https://raw.githubusercontent.com/mike840609/assets_tracker/master/docs/INSTALL_WITH_AI.md";
/* The block a visitor copies has to be the whole sequence. The two compose
   lines alone cannot work from a clean machine: there is no compose file yet,
   and the app refuses to start until .env holds real secrets. */
const DOCKER_COMMAND = [
  "git clone https://github.com/mike840609/assets_tracker.git && cd assets_tracker",
  "./scripts/setup-env.sh",
  "docker compose --profile full up --no-build -d",
].join("\n");
/** Hero frame is a phone below lg — its own column from md, full width under
 *  the copy on smaller screens — and hidden above lg. */
const HERO_MOBILE_SIZES = "(min-width: 1024px) 1px, (min-width: 768px) 16rem, 15rem";
/** Hero frame is the 28rem right column from lg up, hidden below it. */
const HERO_DESKTOP_SIZES = "(min-width: 1024px) 28rem, 1px";
/** Gallery: one column on phones, two inside the 72rem container above sm. */
const SHOT_LANDSCAPE_SIZES = "(min-width: 1024px) 540px, (min-width: 640px) 50vw, 100vw";
/** Gallery: fixed-width cards in the horizontal strip. */
const SHOT_MOBILE_SIZES = "(min-width: 640px) 17rem, 16rem";
const FOCUS_RING_CLASS =
  "focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50";
const LANDING_NAV_ITEMS = [
  { href: "#features", labelKey: "navFeatures" },
  { href: "#screenshots", labelKey: "navScreenshots" },
  { href: "#deploy", labelKey: "navDeploy" },
  { href: "#open-source", labelKey: "navOpenSource" },
] as const;

/** Keep the intrinsic dimensions here so the browser can reserve image space before each asset loads. */
const HERO_DESKTOP_SHOT = {
  key: "desktopDashboard",
  src: "/landing/desktop-dashboard.png",
  width: 1430,
  height: 927,
  orientation: "landscape",
} as const;
const HERO_MOBILE_SHOT = {
  key: "mobileDashboard",
  src: "/landing/mobile-dashboard.jpg",
  width: 390,
  height: 848,
  orientation: "mobile",
} as const;
const SHOTS = [
  HERO_DESKTOP_SHOT,
  {
    key: "desktopAccounts",
    src: "/landing/desktop-accounts.png",
    width: 1430,
    height: 926,
    orientation: "landscape",
  },
  {
    key: "desktopAnalysis",
    src: "/landing/desktop-analysis.png",
    width: 1430,
    height: 927,
    orientation: "landscape",
  },
  {
    key: "desktopCalendar",
    src: "/landing/desktop-calendar.png",
    width: 1430,
    height: 916,
    orientation: "landscape",
  },
  {
    key: "desktopHistory",
    src: "/landing/desktop-history.png",
    width: 1430,
    height: 926,
    orientation: "landscape",
  },
  {
    key: "desktopSettings",
    src: "/landing/desktop-settings.png",
    width: 1430,
    height: 928,
    orientation: "landscape",
  },
  {
    key: "mobileMaxDrawdown",
    src: "/landing/mobile-max-drawdown.jpg",
    width: 390,
    height: 848,
    orientation: "mobile",
  },
  HERO_MOBILE_SHOT,
  {
    key: "mobileWatchlist",
    src: "/landing/mobile-watchlist.jpg",
    width: 390,
    height: 848,
    orientation: "mobile",
  },
  {
    key: "mobileGoals",
    src: "/landing/mobile-goals.jpg",
    width: 390,
    height: 848,
    orientation: "mobile",
  },
  {
    key: "mobileConcentration",
    src: "/landing/mobile-concentration.jpg",
    width: 390,
    height: 848,
    orientation: "mobile",
  },
  {
    key: "mobileSummary",
    src: "/landing/mobile-summary.jpg",
    width: 390,
    height: 848,
    orientation: "mobile",
  },
  {
    key: "mobileDailySnapshots",
    src: "/landing/mobile-daily-snapshots.jpg",
    width: 390,
    height: 848,
    orientation: "mobile",
  },
  {
    key: "mobileAssetAllocation",
    src: "/landing/mobile-asset-allocation.jpg",
    width: 390,
    height: 848,
    orientation: "mobile",
  },
] as const;

const FEATURES = [
  { key: "currency", group: "overview", Icon: Coins },
  { key: "accounts", group: "overview", Icon: Layers },
  { key: "market", group: "overview", Icon: TrendingUp },
  { key: "watchlist", group: "overview", Icon: Eye },
  { key: "history", group: "overview", Icon: History },
  { key: "goals", group: "planning", Icon: Target },
  { key: "recurring", group: "planning", Icon: Repeat },
  { key: "analysis", group: "insight", Icon: ChartPie },
  { key: "devices", group: "insight", Icon: Smartphone },
] as const;

/* Teal is the action colour — buttons, links, the current section. The feature
   families take three of the app's own chart series instead, so nine icons stop
   competing with the two things on this page a visitor can actually click. */
const FEATURE_GROUPS = [
  { key: "overview", featured: true, icon: "text-chart-2", rule: "border-chart-2/40" },
  { key: "planning", featured: false, icon: "text-chart-3", rule: "border-chart-3/40" },
  { key: "insight", featured: false, icon: "text-chart-4", rule: "border-chart-4/40" },
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
      <header className="landing-header sticky top-0 z-10 border-b border-border/50 bg-background">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3 sm:px-6">
          <LandingScrollLink
            href="#top"
            label={t("navHome")}
            className={`${FOCUS_RING_CLASS} flex min-h-11 items-center gap-2.5 rounded-lg md:min-h-0`}
          >
            <AppMark className="h-8 w-8" />
            <span className="text-base font-semibold tracking-tight text-foreground">astt</span>
          </LandingScrollLink>
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
              prefetch={false}
              className={`${FOCUS_RING_CLASS} inline-flex h-11 items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 md:h-9 transition duration-150 motion-safe:hover:-translate-y-0.5 active:translate-y-0`}
            >
              {t("navSignIn")}
            </Link>
          </div>
        </div>
      </header>

      <main id="main-content" tabIndex={-1} className="scroll-mt-20">
        {/* Hero */}
        <div className="landing-hero-wash">
          <section className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-[minmax(0,1fr)_16rem] md:items-center lg:grid-cols-[minmax(0,1fr)_28rem] lg:gap-16 lg:py-20">
            <div className="landing-hero-copy space-y-6">
              <p
                className="landing-hero-in text-sm font-semibold text-primary"
                style={{ "--i": 0 } as CSSProperties}
              >
                {t("heroEyebrow")}
              </p>
              <h1
                className="landing-hero-in text-balance text-[length:var(--text-hero)] font-bold leading-[1.08] tracking-tight text-foreground"
                style={{ "--i": 1 } as CSSProperties}
              >
                {t("heroTitle")}
              </h1>
              <p
                className="landing-hero-in max-w-prose text-xl leading-relaxed text-muted-foreground"
                style={{ "--i": 2 } as CSSProperties}
              >
                {t("heroSubtitle")}
              </p>
              <p
                className="landing-hero-in max-w-prose text-sm leading-relaxed text-muted-foreground"
                style={{ "--i": 3 } as CSSProperties}
              >
                {t("heroScope")}
              </p>
              <div
                className="landing-hero-in flex flex-wrap items-center gap-3"
                style={{ "--i": 4 } as CSSProperties}
              >
                <a
                  href="#deploy"
                  className={`${FOCUS_RING_CLASS} group inline-flex h-12 items-center rounded-xl bg-primary px-5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition duration-150 motion-safe:hover:-translate-y-0.5 active:translate-y-0`}
                >
                  {t("heroPrimaryCta")}
                  <ArrowRight
                    className="ml-1.5 h-4 w-4 transition-transform duration-150 motion-safe:group-hover:translate-x-0.5"
                    aria-hidden="true"
                  />
                </a>
                <Link
                  href="/login"
                  prefetch={false}
                  className={`${FOCUS_RING_CLASS} flex h-12 items-center rounded-xl border border-border px-5 text-sm font-medium text-foreground hover:bg-secondary transition duration-150 motion-safe:hover:-translate-y-0.5 active:translate-y-0`}
                >
                  {t("heroSecondaryCta")}
                </Link>
              </div>
              <p
                className="landing-hero-in max-w-prose text-xs text-muted-foreground"
                style={{ "--i": 5 } as CSSProperties}
              >
                {t("heroNote")}
              </p>
            </div>

            <div className="space-y-4">
              {/* The phone frame is cropped and faded rather than shown whole: at
                  240px wide a full 390x844 screen is 519px tall and pushes the
                  rest of the fold off the page. */}
              <figure
                className="landing-shot-in mx-auto w-full max-w-[15rem] overflow-hidden lg:hidden [mask-image:linear-gradient(to_bottom,#000_78%,transparent)]"
                style={{ "--i": 4, maxHeight: "26rem" } as CSSProperties}
              >
                <LandingScreenshot
                  src={HERO_MOBILE_SHOT.src}
                  alt={t("shot.mobileDashboard.caption")}
                  width={HERO_MOBILE_SHOT.width}
                  height={HERO_MOBILE_SHOT.height}
                  orientation={HERO_MOBILE_SHOT.orientation}
                  sizes={HERO_MOBILE_SIZES}
                  highPriority
                  openLabel={t("shotOpen")}
                  fallbackLabel={t("shotFallback")}
                  fallbackHref={DOCS_URL}
                  fallbackLinkLabel={t("shotFallbackLink")}
                />
                <figcaption className="sr-only">{t("shot.mobileDashboard.caption")}</figcaption>
              </figure>
              <figure className="hidden lg:block">
                <div className="landing-shot-in rounded-xl border border-border/70 bg-card/90 p-1.5 shadow-sm">
                  <div aria-hidden="true" className="flex h-4 items-center gap-1 px-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40" />
                    <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40" />
                    <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40" />
                  </div>
                  <LandingScreenshot
                    src={HERO_DESKTOP_SHOT.src}
                    alt={t("shot.desktopDashboard.caption")}
                    width={HERO_DESKTOP_SHOT.width}
                    height={HERO_DESKTOP_SHOT.height}
                    orientation={HERO_DESKTOP_SHOT.orientation}
                    sizes={HERO_DESKTOP_SIZES}
                    highPriority
                    openLabel={t("shotOpen")}
                    fallbackLabel={t("shotFallback")}
                    fallbackHref={DOCS_URL}
                    fallbackLinkLabel={t("shotFallbackLink")}
                  />
                </div>
                <figcaption className="sr-only">{t("shot.desktopDashboard.caption")}</figcaption>
              </figure>
              {isPublicDemoEnabled ? (
                <div
                  className="landing-hero-in rounded-2xl border border-border/50 bg-card/80 p-5 sm:p-6"
                  style={{ "--i": 6 } as CSSProperties}
                >
                  <p className="mb-1 text-sm font-semibold text-foreground">{t("demoTitle")}</p>
                  <p className="mb-4 text-xs text-muted-foreground">{t("demoBody")}</p>
                  <DemoLoginButton />
                </div>
              ) : null}
            </div>
          </section>
        </div>

        {/* Features */}
        <section id="features" className="scroll-mt-20 border-t border-border/50 bg-secondary/30">
          <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:py-20">
            <h2 className="text-balance text-[length:var(--text-section)] font-bold leading-[1.15] tracking-tight text-foreground">
              {t("featuresTitle")}
            </h2>
            <div className="mt-8 grid gap-x-12 gap-y-10 lg:grid-cols-2 lg:gap-y-12">
              {FEATURE_GROUPS.map(({ key, featured, icon, rule }) => (
                <div key={key} className={featured ? "lg:col-span-2" : undefined}>
                  <h3
                    className={`text-balance border-b ${rule} pb-3 text-xl font-semibold text-foreground`}
                  >
                    {t(`featureGroup.${key}`)}
                  </h3>
                  <dl className="mt-5 grid gap-x-10 gap-y-7 sm:grid-cols-2">
                    {FEATURES.filter((feature) => feature.group === key).map(({ key, Icon }) => (
                      <div key={key} className="flex gap-3.5">
                        <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${icon}`} aria-hidden="true" />
                        <div className="space-y-1">
                          <dt className="text-base font-semibold text-foreground">
                            {t(`feature.${key}.title`)}
                          </dt>
                          <dd className="text-base leading-relaxed text-muted-foreground">
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
        <section id="screenshots" className="scroll-mt-20 border-t border-border/50">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-24">
            <h2 className="text-balance text-[length:var(--text-section)] font-bold leading-[1.15] tracking-tight text-foreground">
              {t("shotsTitle")}
            </h2>
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
            <div className="mt-10 space-y-12 lg:space-y-14">
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
                <div key={groupKey} id={`shots-${groupKey}`} className="scroll-mt-20">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                    <h3 className="text-xl font-semibold text-foreground">
                      {t(`shotsGroup.${groupKey}`)}
                    </h3>
                    {groupKey === "mobile" ? (
                      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        {t("shotsScrollHint")}
                        <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                      </p>
                    ) : null}
                  </div>
                  <div
                    className={
                      groupKey === "mobile"
                        ? "mt-4 flex snap-x snap-mandatory gap-6 overflow-x-auto pb-3"
                        : "mt-4 grid gap-6 sm:grid-cols-2"
                    }
                  >
                    {shots.map(({ key, src, width, height, orientation }) => (
                      <figure
                        key={key}
                        className={
                          groupKey === "mobile"
                            ? "w-[16rem] shrink-0 snap-start space-y-2 sm:w-[17rem]"
                            : "space-y-2"
                        }
                      >
                        <LandingScreenshot
                          src={src}
                          alt={t(`shot.${key}.caption`)}
                          width={width}
                          height={height}
                          orientation={orientation}
                          sizes={
                            orientation === "mobile" ? SHOT_MOBILE_SIZES : SHOT_LANDSCAPE_SIZES
                          }
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
              <p className="text-xl font-semibold text-foreground">{t("sectionCtaTitle")}</p>
              <div className="flex flex-wrap gap-3">
                <Link
                  href="/login"
                  prefetch={false}
                  className={`${FOCUS_RING_CLASS} group inline-flex h-11 items-center gap-1.5 rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition duration-150 motion-safe:hover:-translate-y-0.5 active:translate-y-0`}
                >
                  {t("sectionCtaPrimary")}
                  <ArrowRight
                    className="h-4 w-4 transition-transform duration-150 motion-safe:group-hover:translate-x-0.5"
                    aria-hidden="true"
                  />
                </Link>
                <a
                  href="#deploy"
                  className={`${FOCUS_RING_CLASS} inline-flex h-11 items-center rounded-xl border border-border px-4 text-sm font-medium text-foreground hover:bg-secondary transition duration-150 motion-safe:hover:-translate-y-0.5 active:translate-y-0`}
                >
                  {t("sectionCtaSecondary")}
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* Deploy */}
        <section id="deploy" className="scroll-mt-20 border-t border-border/50 bg-secondary/30">
          <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:py-20">
            <h2 className="text-balance text-[length:var(--text-section)] font-bold leading-[1.15] tracking-tight text-foreground">
              {t("deployTitle")}
            </h2>
            <p className="mt-2 max-w-prose text-base text-muted-foreground">
              {t("deploySubtitle")}
            </p>
            <p className="mt-2 max-w-prose text-xs leading-relaxed text-muted-foreground">
              {t("deployNote")}
            </p>
            <div className="mt-8 grid items-start gap-6 lg:grid-cols-3">
              <div className="flex min-w-0 flex-col gap-4 rounded-2xl border border-border/50 bg-card p-5 sm:p-6">
                <div className="space-y-1">
                  <h3 className="text-balance text-xl font-semibold text-foreground">
                    {t("dockerTitle")}
                  </h3>
                  <p className="text-base font-medium text-foreground">{t("dockerAudience")}</p>
                  <p className="text-base text-muted-foreground">{t("dockerBody")}</p>
                </div>
                <div
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
                  className={`${FOCUS_RING_CLASS} group mt-auto inline-flex min-h-11 items-center gap-1.5 rounded-md text-sm font-medium text-primary hover:underline md:min-h-0`}
                >
                  {t("dockerLink")}
                  <ArrowRight
                    className="h-3.5 w-3.5 transition-transform duration-150 motion-safe:group-hover:translate-x-0.5"
                    aria-hidden="true"
                  />
                </a>
              </div>

              <div className="flex min-w-0 flex-col gap-4 rounded-2xl border border-border/50 bg-card p-5 sm:p-6">
                <div className="space-y-1">
                  <h3 className="text-balance text-xl font-semibold text-foreground">
                    {t("cloudTitle")}
                  </h3>
                  <p className="text-base font-medium text-foreground">{t("cloudAudience")}</p>
                  <p className="text-base text-muted-foreground">{t("cloudBody")}</p>
                </div>
                <a
                  href={DOCS_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`${FOCUS_RING_CLASS} group mt-auto inline-flex min-h-11 items-center gap-1.5 rounded-md text-sm font-medium text-primary hover:underline md:min-h-0`}
                >
                  {t("cloudLink")}
                  <ArrowRight
                    className="h-3.5 w-3.5 transition-transform duration-150 motion-safe:group-hover:translate-x-0.5"
                    aria-hidden="true"
                  />
                </a>
              </div>

              <div className="flex min-w-0 flex-col gap-4 rounded-2xl border border-primary/40 bg-primary/5 p-5 sm:p-6">
                <div className="space-y-1">
                  <h3 className="text-balance text-xl font-semibold text-foreground">
                    {t("aiDeploy")}
                  </h3>
                  <p className="text-base font-medium text-foreground">{t("aiDeployAudience")}</p>
                  <p className="text-base text-muted-foreground">{t("aiDeployBody")}</p>
                </div>
                <div
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
        <section id="open-source" className="scroll-mt-20 border-t border-border/50">
          <div className="mx-auto max-w-3xl space-y-4 px-4 py-16 text-center sm:px-6 lg:py-24">
            <h2 className="text-balance text-[length:var(--text-section)] font-bold leading-[1.15] tracking-tight text-foreground">
              {t("openTitle")}
            </h2>
            <p className="mx-auto max-w-prose text-base leading-relaxed text-muted-foreground">
              {t("openBody")}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <a
                href={REPO_URL}
                target="_blank"
                rel="noopener noreferrer"
                className={`${FOCUS_RING_CLASS} flex h-12 items-center gap-2 rounded-xl border border-border px-5 text-sm font-medium text-foreground hover:bg-secondary transition duration-150 motion-safe:hover:-translate-y-0.5 active:translate-y-0`}
              >
                <GitHubMark className="h-4 w-4" />
                {t("openCta")}
              </a>
            </div>
            <nav
              aria-label={t("openLinksLabel")}
              className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 pt-2 text-sm"
            >
              <a
                href={ISSUES_URL}
                target="_blank"
                rel="noopener noreferrer"
                className={`${FOCUS_RING_CLASS} inline-flex min-h-11 items-center rounded-md px-2 text-primary hover:underline md:min-h-0`}
              >
                {t("openIssues")}
              </a>
              <a
                href={CONTRIBUTING_URL}
                target="_blank"
                rel="noopener noreferrer"
                className={`${FOCUS_RING_CLASS} inline-flex min-h-11 items-center rounded-md px-2 text-primary hover:underline md:min-h-0`}
              >
                {t("openContributing")}
              </a>
              <a
                href={RELEASES_URL}
                target="_blank"
                rel="noopener noreferrer"
                className={`${FOCUS_RING_CLASS} inline-flex min-h-11 items-center rounded-md px-2 text-primary hover:underline md:min-h-0`}
              >
                {t("openReleases")}
              </a>
            </nav>
          </div>
        </section>
      </main>

      <footer className="border-t border-border/50">
        {/* Section jumping lives here below md, where keeping it in the sticky
            header cost a permanent second row on every phone screen. */}
        <nav
          aria-label={t("navLabel")}
          className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-1 border-b border-border/50 px-4 py-2 sm:px-6 md:hidden"
        >
          {LANDING_NAV_ITEMS.map(({ href, labelKey }) => (
            <LandingScrollLink
              key={href}
              href={href}
              className={`${FOCUS_RING_CLASS} inline-flex min-h-11 items-center rounded-md px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground`}
            >
              {t(labelKey)}
            </LandingScrollLink>
          ))}
        </nav>
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 py-6 text-xs text-muted-foreground sm:flex-row sm:px-6">
          <p>{t("footerLicense")}</p>
          <nav
            aria-label={t("footerLinksLabel")}
            className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2"
          >
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
            <a
              href={SECURITY_URL}
              target="_blank"
              rel="noopener noreferrer"
              className={`${FOCUS_RING_CLASS} inline-flex min-h-11 min-w-11 items-center justify-center rounded-md px-2 hover:underline md:min-h-0 md:min-w-0 md:px-0`}
            >
              {t("footerSecurity")}
            </a>
            <Link
              href="/privacy"
              prefetch={false}
              className={`${FOCUS_RING_CLASS} inline-flex min-h-11 min-w-11 items-center justify-center rounded-md px-2 hover:underline md:min-h-0 md:min-w-0 md:px-0`}
            >
              {t("footerPrivacy")}
            </Link>
            <Link
              href="/terms"
              prefetch={false}
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
