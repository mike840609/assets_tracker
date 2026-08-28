import Link from "next/link";
import { getTranslations } from "next-intl/server";
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
import { isPublicDemoEnabled } from "@/lib/env";
import { REPO_URL, LICENSE_URL } from "@/lib/repo";

const DOCS_URL = `${REPO_URL}/blob/master/docs/DEPLOYMENT.md`;

/**
 * Screenshot slots. Drop a file into `public/landing/` and set `src` to its
 * path — until then the slot renders a labelled placeholder frame, so the
 * section keeps its shape without shipping a broken image.
 * Recommended: 16:10, ~1600×1000, JPEG.
 */
const SHOTS: Array<{ key: "dashboard" | "analysis" | "plan" | "mobile"; src: string | null }> = [
  { key: "dashboard", src: null },
  { key: "analysis", src: null },
  { key: "plan", src: null },
  { key: "mobile", src: null },
];

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
  const t = await getTranslations("landing");

  return (
    <div className="h-dvh w-full overflow-x-hidden overflow-y-auto bg-background">
      <header className="border-b border-border/50">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2.5">
            <AppMark className="h-8 w-8" />
            <span className="text-base font-semibold tracking-tight text-foreground">astt</span>
          </div>
          <nav className="flex items-center gap-1 sm:gap-2">
            <a
              href={REPO_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-11 min-w-11 items-center justify-center gap-1.5 rounded-lg px-3 text-sm text-muted-foreground transition-colors hover:text-foreground md:h-9 md:min-w-0"
            >
              <GitHubMark className="h-4 w-4" />
              <span className="sr-only sm:not-sr-only">{t("navSource")}</span>
            </a>
            <Link
              href="/login"
              className="inline-flex h-11 items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 md:h-9"
            >
              {t("navSignIn")}
            </Link>
          </nav>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section
          className={`mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:py-20 ${
            isPublicDemoEnabled
              ? "grid gap-10 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-center lg:gap-16"
              : "lg:max-w-4xl"
          }`}
        >
          <div className="space-y-6">
            <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              {t("heroTitle")}
            </h1>
            <p className="max-w-prose text-base leading-relaxed text-muted-foreground">
              {t("heroSubtitle")}
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <Link
                href="/login"
                className="inline-flex h-12 items-center rounded-xl bg-primary px-5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
              >
                {t("heroPrimaryCta")}
                <ArrowRight className="ml-1.5 h-4 w-4" aria-hidden="true" />
              </Link>
              <a
                href={DOCS_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-12 items-center rounded-xl border border-border px-5 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
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
          ) : null}
        </section>

        {/* Features */}
        <section className="border-t border-border/50 bg-secondary/30">
          <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:py-20">
            <h2 className="text-2xl font-bold tracking-tight text-foreground">
              {t("featuresTitle")}
            </h2>
            <p className="mt-2 max-w-prose text-sm text-muted-foreground">
              {t("featuresSubtitle")}
            </p>
            <div className="mt-10 grid gap-x-12 gap-y-10 lg:grid-cols-2 lg:gap-y-12">
              {FEATURE_GROUPS.map(({ key, featured }) => (
                <div key={key} className={featured ? "lg:col-span-2" : undefined}>
                  <h3 className="border-b border-border/60 pb-3 text-sm font-semibold text-foreground">
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
        <section className="border-t border-border/50">
          <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:py-20">
            <h2 className="text-2xl font-bold tracking-tight text-foreground">{t("shotsTitle")}</h2>
            <p className="mt-2 max-w-prose text-sm text-muted-foreground">{t("shotsSubtitle")}</p>
            <div className="mt-8 grid gap-6 sm:grid-cols-2">
              {SHOTS.map(({ key, src }) => (
                <figure key={key} className="space-y-2">
                  {src ? (
                    /* ponytail: plain <img>; next/image would make self-hosted
                       standalone builds need sharp for a static screenshot. */
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={src}
                      alt={t(`shot.${key}.caption`)}
                      width={1600}
                      height={1000}
                      loading="lazy"
                      decoding="async"
                      className="w-full rounded-xl border border-border/50"
                    />
                  ) : (
                    <div className="flex aspect-[16/10] w-full items-center justify-center rounded-xl border border-dashed border-border bg-muted/30 p-4">
                      <span className="text-center font-mono text-xs text-muted-foreground">
                        public/landing/{key}.jpg
                      </span>
                    </div>
                  )}
                  <figcaption className="text-sm text-muted-foreground">
                    {t(`shot.${key}.caption`)}
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
        </section>

        {/* Deploy */}
        <section className="border-t border-border/50 bg-secondary/30">
          <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:py-20">
            <h2 className="text-2xl font-bold tracking-tight text-foreground">
              {t("deployTitle")}
            </h2>
            <p className="mt-2 max-w-prose text-sm text-muted-foreground">{t("deploySubtitle")}</p>
            <div className="mt-8 grid gap-6 lg:grid-cols-2">
              <div className="min-w-0 space-y-4 rounded-2xl border border-border/50 bg-card p-5 sm:p-6">
                <div className="space-y-1">
                  <h3 className="text-base font-semibold text-foreground">{t("dockerTitle")}</h3>
                  <p className="text-sm text-muted-foreground">{t("dockerBody")}</p>
                </div>
                <div
                  tabIndex={0}
                  role="group"
                  aria-label={t("dockerTitle")}
                  className="overflow-x-auto rounded-xl bg-muted/50 p-3 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                >
                  <code className="block whitespace-pre font-mono text-xs leading-relaxed text-foreground">
                    {"cp .env.example .env\ndocker compose --profile full up -d"}
                  </code>
                </div>
                <a
                  href={DOCS_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-primary hover:underline md:min-h-0"
                >
                  {t("dockerLink")}
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </a>
              </div>

              <div className="min-w-0 space-y-4 rounded-2xl border border-border/50 bg-card p-5 sm:p-6">
                <div className="space-y-1">
                  <h3 className="text-base font-semibold text-foreground">{t("cloudTitle")}</h3>
                  <p className="text-sm text-muted-foreground">{t("cloudBody")}</p>
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
                  className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-primary hover:underline md:min-h-0"
                >
                  {t("cloudLink")}
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* Open source / privacy */}
        <section className="border-t border-border/50">
          <div className="mx-auto max-w-3xl space-y-4 px-4 py-14 text-center sm:px-6 lg:py-20">
            <h2 className="text-2xl font-bold tracking-tight text-foreground">{t("openTitle")}</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">{t("openBody")}</p>
            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <a
                href={REPO_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-12 items-center gap-2 rounded-xl border border-border px-5 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
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
              className="inline-flex min-h-11 items-center hover:underline md:min-h-0"
            >
              {t("footerDocs")}
            </a>
            <a
              href={LICENSE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center hover:underline md:min-h-0"
            >
              {t("footerLicenseLink")}
            </a>
            <Link
              href="/privacy"
              className="inline-flex min-h-11 items-center hover:underline md:min-h-0"
            >
              {t("footerPrivacy")}
            </Link>
            <Link
              href="/terms"
              className="inline-flex min-h-11 items-center hover:underline md:min-h-0"
            >
              {t("footerTerms")}
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
