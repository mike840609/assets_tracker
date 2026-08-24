// S1: force-static is incompatible with nextConfig.cacheComponents (PPR mode).
// PPR prerendering the Suspense fallback shell is the correct tier here.
import { Suspense } from "react";
import { signIn, signOut } from "@/auth";
import { DemoLoginButton } from "@/components/demo/demo-login-button";
import { Button } from "@/components/ui/button";
import { TrendingUp, Lock, ShieldCheck, EyeOff, Check } from "lucide-react";
import {
  isGoogleAuthEnabled,
  isPreviewAuthEnabled,
  isPublicDemoEnabled,
  isSelfHostAuthEnabled,
  previewAuthRequiresPassword,
} from "@/lib/env";
import { getAuthContext } from "@/lib/auth-session";
import { getTranslations } from "next-intl/server";
import { REPO_URL } from "@/lib/repo";
import { GitHubMark } from "@/components/layout/github-mark";
import Link from "next/link";
import { redirect } from "next/navigation";

type LoginPageProps = {
  searchParams: Promise<{
    "stale-session"?: string | string[];
    from?: string | string[];
  }>;
};

async function exitDemoOriginBeforeFormalSignIn(): Promise<boolean> {
  const authContext = await getAuthContext();
  const isDemoOrigin =
    authContext.status === "demo-expired" ||
    authContext.status === "demo-disabled" ||
    (authContext.status === "missing" && authContext.sessionKind === "demo") ||
    (authContext.status === "active" && authContext.principal.kind === "demo");
  if (!isDemoOrigin) return false;

  await signOut({ redirectTo: "/login" });
  return true;
}

/**
 * Public pitch shown beside the sign-in card. `/login` is where every
 * unauthenticated visit to the app lands (see PUBLIC_ROUTES in src/proxy.ts),
 * so it doubles as the product's landing page for self-hosters and directory
 * traffic. See the Public Surface Exception in DESIGN.md.
 */
async function LandingPitch() {
  const t = await getTranslations("login");
  const points = [t("heroPoint1"), t("heroPoint2"), t("heroPoint3")];

  return (
    <div className="order-2 flex flex-col gap-6 lg:order-1">
      <div className="space-y-3">
        <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          {t("heroTitle")}
        </h2>
        <p className="max-w-prose text-sm text-muted-foreground sm:text-base">
          {t("heroSubtitle")}
        </p>
      </div>

      <ul className="space-y-2.5">
        {points.map((point) => (
          <li key={point} className="flex items-start gap-2.5 text-sm text-foreground">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
            <span>{point}</span>
          </li>
        ))}
      </ul>

      <div className="rounded-xl border border-border/60 bg-muted/40 p-3">
        <p className="mb-1.5 text-xs font-medium text-muted-foreground">
          {t("heroQuickStartLabel")}
        </p>
        <code className="block overflow-x-auto whitespace-pre font-mono text-xs leading-relaxed text-foreground">
          {"docker compose --profile full pull\ndocker compose --profile full up --no-build -d"}
        </code>
      </div>

      {/* eslint-disable-next-line @next/next/no-img-element -- ponytail: one static
          screenshot; next/image would make self-hosted standalone builds need sharp. */}
      <img
        src="/hero.jpg"
        alt={t("heroImageAlt")}
        width={1192}
        height={795}
        loading="lazy"
        decoding="async"
        className="hidden w-full rounded-2xl border border-border/50 shadow-sm lg:block"
      />
    </div>
  );
}

async function LoginContent() {
  const t = await getTranslations("login");
  const tNav = await getTranslations("nav");

  return (
    <div className="relative flex h-dvh w-full items-center justify-center overflow-x-hidden overflow-y-auto bg-background">
      {/* Dynamic Background Elements */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-primary/10 blur-3xl pointer-events-none -z-10 animate-pulse-slow" />
      <div
        className="absolute bottom-[-10%] right-[-5%] w-[40%] h-[40%] rounded-full bg-chart-4/10 blur-3xl pointer-events-none -z-10 animate-pulse-slow"
        style={{ animationDelay: "2s" }}
      />

      <div className="relative z-10 mx-auto my-auto grid w-full max-w-6xl grid-cols-1 items-center gap-10 px-4 py-10 lg:grid-cols-[minmax(0,1fr)_26rem] lg:gap-16 lg:px-8">
        <LandingPitch />

        {/* Glassmorphism Card */}
        <div className="order-1 mx-auto flex w-full max-w-md flex-col justify-center space-y-8 p-6 sm:p-10 lg:order-2 bg-card/80 backdrop-blur-xl border border-border/50 shadow-[0_8px_32px_-8px_rgba(0,0,0,0.12)] dark:shadow-[0_8px_32px_-8px_rgba(0,0,0,0.5)] rounded-3xl animate-slide-in-bottom">
          <div className="flex flex-col space-y-3 text-center">
            <div
              className="w-16 h-16 mx-auto rounded-xl flex items-center justify-center mb-4 relative group shadow-lg"
              style={{ background: "linear-gradient(135deg, #34d399 0%, #065f46 100%)" }}
            >
              <div
                className="absolute inset-0 rounded-xl blur-md bg-emerald-500/50 opacity-40 group-hover:opacity-70 transition-opacity duration-500 animate-pulse"
                style={{ background: "linear-gradient(135deg, #34d399 0%, #065f46 100%)" }}
              ></div>
              <TrendingUp
                className="w-7 h-7 text-white relative z-10 transform transition-all group-hover:scale-110 group-hover:-rotate-12 duration-300"
                strokeWidth={2}
              />
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight text-foreground">{t("title")}</h1>
            <p className="text-sm text-muted-foreground font-medium">{t("subtitle")}</p>
          </div>

          {isGoogleAuthEnabled && (
            <form
              action={async () => {
                "use server";
                if (await exitDemoOriginBeforeFormalSignIn()) return;
                await signIn("google", { redirectTo: "/" });
              }}
              className="pt-4"
            >
              <Button
                className="w-full h-12 text-sm font-medium tracking-wide bg-background text-foreground hover:bg-secondary border border-border shadow-sm hover:shadow-md transition-all hover:-translate-y-0.5 rounded-xl flex items-center justify-center gap-3"
                type="submit"
              >
                <svg
                  className="w-5 h-5 shrink-0"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    fill="#4285F4"
                  />
                  <path
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23s7.7-2.47 9.82-6.07l-3.66-2.84c-.87 2.6-3.3 4.53-6.16 4.53z"
                    fill="#34A853"
                  />
                  <path
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    fill="#FBBC05"
                  />
                  <path
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    fill="#EA4335"
                  />
                </svg>
                {t("googleButton")}
              </Button>
            </form>
          )}

          {isSelfHostAuthEnabled && (
            <>
              {isGoogleAuthEnabled && (
                <div className="flex items-center gap-3">
                  <div className="h-px flex-1 bg-border" />
                  <span className="text-xs font-medium text-muted-foreground">{t("or")}</span>
                  <div className="h-px flex-1 bg-border" />
                </div>
              )}
              <form
                action={async (formData: FormData) => {
                  "use server";
                  if (await exitDemoOriginBeforeFormalSignIn()) return;
                  await signIn("self-host", {
                    password: formData.get("password") as string,
                    redirectTo: "/",
                  });
                }}
                className={isGoogleAuthEnabled ? undefined : "pt-4"}
              >
                <div className="flex flex-col gap-3">
                  <input
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    placeholder={t("selfHostPasswordPlaceholder")}
                    aria-label={t("selfHostPasswordPlaceholder")}
                    required
                    className="h-12 w-full rounded-xl border border-border bg-input px-4 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                  />
                  <Button
                    type="submit"
                    className="h-12 w-full rounded-xl text-sm font-medium tracking-wide shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
                  >
                    {t("selfHostButton")}
                  </Button>
                </div>
              </form>
            </>
          )}

          {isPublicDemoEnabled ? <DemoLoginButton /> : null}

          {/* Trust badges */}
          <div className="flex flex-col gap-2 pt-2">
            <div className="flex items-center gap-2.5 text-xs text-muted-foreground">
              <Lock className="w-4 h-4 shrink-0 text-primary" />
              <span>{t("trust1")}</span>
            </div>
            <div className="flex items-center gap-2.5 text-xs text-muted-foreground">
              <ShieldCheck className="w-4 h-4 shrink-0 text-primary" />
              <span>{t("trust2")}</span>
            </div>
            <div className="flex items-center gap-2.5 text-xs text-muted-foreground">
              <EyeOff className="w-4 h-4 shrink-0 text-primary" />
              <span>{t("trust3")}</span>
            </div>
          </div>

          {isPreviewAuthEnabled && (
            <>
              <div className="flex items-center gap-3 pt-2">
                <div className="flex-1 h-px bg-border" />
                <span className="text-xs text-muted-foreground font-medium">
                  {t("internalTestDivider")}
                </span>
                <div className="flex-1 h-px bg-border" />
              </div>

              <form
                action={async (formData: FormData) => {
                  "use server";
                  if (await exitDemoOriginBeforeFormalSignIn()) return;
                  await signIn("credentials", {
                    password: formData.get("password") as string,
                    redirectTo: "/",
                  });
                }}
              >
                <div className="flex flex-col gap-3">
                  {previewAuthRequiresPassword && (
                    <input
                      name="password"
                      type="password"
                      placeholder={t("internalTestPasswordPlaceholder")}
                      aria-label={t("internalTestPasswordPlaceholder")}
                      required
                      className="h-12 w-full rounded-xl border border-border bg-input px-4 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                    />
                  )}
                  <Button
                    type="submit"
                    className="w-full h-12 text-sm font-medium tracking-wide bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/30 border border-amber-200 dark:border-amber-800/50 shadow-sm hover:shadow-md transition-all hover:-translate-y-0.5 rounded-xl"
                  >
                    {t("internalTestButton")}
                  </Button>
                </div>
              </form>
            </>
          )}

          <div className="text-center text-xs text-muted-foreground pt-2 mb-[-1rem]">
            {t("footerBefore")}{" "}
            <Link href="/privacy" className="underline hover:text-foreground transition-colors">
              {t("footerLink")}
            </Link>
            .
            <a
              href={REPO_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 flex items-center justify-center gap-1.5 hover:text-foreground transition-colors"
            >
              <GitHubMark className="h-3.5 w-3.5" />
              {tNav("sourceCode")}
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

async function LoginGate({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const authContext = await getAuthContext();

  if (authContext.status === "active") {
    if (authContext.principal.kind === "formal" || params.from !== "demo") redirect("/");
  }

  return <LoginContent />;
}

export default function LoginPage({ searchParams }: LoginPageProps) {
  return (
    <Suspense
      fallback={
        <div className="flex h-dvh w-full items-center justify-center overflow-y-auto bg-background">
          <div className="mx-auto my-auto grid w-full max-w-6xl grid-cols-1 items-center gap-10 px-4 py-10 lg:grid-cols-[minmax(0,1fr)_26rem] lg:gap-16 lg:px-8">
            <div className="order-2 hidden animate-pulse space-y-4 lg:order-1 lg:block">
              <div className="h-8 w-3/4 rounded bg-muted" />
              <div className="h-4 w-full rounded bg-muted" />
              <div className="h-4 w-5/6 rounded bg-muted" />
            </div>
            <div className="order-1 mx-auto w-full max-w-md space-y-8 rounded-3xl bg-card/80 p-6 animate-pulse sm:p-10 lg:order-2">
              <div className="flex flex-col items-center space-y-3">
                <div className="w-16 h-16 rounded-xl bg-primary/20" />
                <div className="h-8 w-48 rounded bg-muted" />
                <div className="h-4 w-56 rounded bg-muted" />
              </div>
              <div className="h-12 w-full rounded-xl bg-muted" />
            </div>
          </div>
        </div>
      }
    >
      <LoginGate searchParams={searchParams} />
    </Suspense>
  );
}
