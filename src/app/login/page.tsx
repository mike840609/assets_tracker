// S1: force-static is incompatible with nextConfig.cacheComponents (PPR mode).
// PPR prerendering the Suspense fallback shell is the correct tier here.
import { Suspense } from "react";
import { signIn } from "@/auth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { TrendingUp, Lock, ShieldCheck, EyeOff } from "lucide-react";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Login | Assets Tracker",
};

async function LoginContent() {
  const t = await getTranslations("login");
  const locale = await getLocale();
  const isPreviewOrLocal =
    process.env.VERCEL_ENV === "preview" ||
    process.env.VERCEL_ENV === "development" ||
    !process.env.VERCEL_ENV;
  const previewAuthDisabled = ["1", "true", "yes", "on"].includes(
    (process.env.PREVIEW_AUTH_DISABLED ?? "").toLowerCase(),
  );
  const showPreviewLogin = isPreviewOrLocal;

  return (
    <div
      lang={locale}
      className="relative flex h-dvh min-h-svh w-full items-start justify-center overflow-y-auto overflow-x-hidden px-4 py-3 [@media(min-height:620px)]:items-center [@media(min-height:620px)]:py-4 sm:px-6 sm:py-8"
    >
      <Card className="relative z-10 mx-auto w-full max-w-md gap-0 space-y-4 rounded-xl border-border/70 bg-card p-4 shadow-sm animate-slide-in-bottom [@media(min-height:620px)]:space-y-6 [@media(min-height:620px)]:p-5 sm:space-y-8 sm:p-8">
        <div className="flex flex-col space-y-2 text-center">
          <div className="mx-auto mb-1 flex h-12 w-12 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm [@media(min-height:620px)]:h-14 [@media(min-height:620px)]:w-14 sm:mb-3">
            <TrendingUp className="h-6 w-6" strokeWidth={2} aria-hidden="true" />
          </div>
          <h1 className="text-2xl font-semibold tracking-normal text-foreground sm:text-3xl">
            {t("title")}
          </h1>
          <p className="text-sm font-medium text-muted-foreground">{t("subtitle")}</p>
        </div>

        <form
          action={async () => {
            "use server";
            await signIn("google", { redirectTo: "/" });
          }}
          className="sm:pt-4"
        >
          <Button
            variant="outline"
            className="flex h-12 w-full items-center justify-center gap-3 rounded-lg text-[15px] font-medium tracking-normal shadow-sm"
            type="submit"
          >
            <svg
              className="w-5 h-5 shrink-0"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
              focusable="false"
            >
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
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

        <div className="flex flex-col gap-1.5 sm:gap-2 sm:pt-1">
          <div className="flex min-w-0 items-start gap-2.5 text-xs leading-5 text-muted-foreground">
            <Lock className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
            <span>{t("trust1")}</span>
          </div>
          <div className="flex min-w-0 items-start gap-2.5 text-xs leading-5 text-muted-foreground">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
            <span>{t("trust2")}</span>
          </div>
          <div className="flex min-w-0 items-start gap-2.5 text-xs leading-5 text-muted-foreground">
            <EyeOff className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
            <span>{t("trust3")}</span>
          </div>
        </div>

        {showPreviewLogin && (
          <>
            <div className="flex items-center gap-3 sm:pt-2">
              <div className="flex-1 h-px bg-border" />
              <span className="text-xs font-medium text-muted-foreground">{t("previewMode")}</span>
              <div className="flex-1 h-px bg-border" />
            </div>

            <form
              action={async (formData: FormData) => {
                "use server";
                await signIn("credentials", {
                  password: formData.get("password") as string,
                  redirectTo: "/",
                });
              }}
            >
              <div className="flex flex-col gap-3">
                {!previewAuthDisabled && (
                  <div className="flex flex-col gap-1.5">
                    <label
                      htmlFor="preview-password"
                      className="text-xs font-medium text-muted-foreground"
                    >
                      {t("previewPasswordLabel")}
                    </label>
                    <input
                      id="preview-password"
                      name="password"
                      type="password"
                      autoComplete="current-password"
                      placeholder={t("previewPasswordPlaceholder")}
                      required
                      className="h-12 w-full rounded-lg border border-border bg-input px-4 text-sm text-foreground placeholder:text-muted-foreground transition-all focus:border-primary focus:ring-2 focus:ring-primary/30 focus:outline-none"
                    />
                  </div>
                )}
                <Button
                  type="submit"
                  variant="secondary"
                  className="h-12 w-full rounded-lg text-[15px] font-medium tracking-normal"
                >
                  {t("previewLogin")}
                </Button>
              </div>
            </form>
          </>
        )}

        <div className="text-center text-xs text-muted-foreground sm:pt-1">
          {t("footerBefore")}{" "}
          <Link
            href="/privacy"
            className="inline-flex min-h-6 items-center rounded-sm underline underline-offset-2 transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            {t("footerLink")}
          </Link>
          .
        </div>
      </Card>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-dvh min-h-svh w-full items-start justify-center overflow-y-auto overflow-x-hidden px-4 py-3 [@media(min-height:620px)]:items-center [@media(min-height:620px)]:py-4 sm:px-6 sm:py-8">
          <div className="w-full max-w-md space-y-4 rounded-xl bg-card p-4 shadow-sm animate-pulse [@media(min-height:620px)]:space-y-6 [@media(min-height:620px)]:p-5 sm:space-y-8 sm:p-8">
            <div className="flex flex-col items-center space-y-3">
              <div className="h-12 w-12 rounded-lg bg-primary/20 [@media(min-height:620px)]:h-14 [@media(min-height:620px)]:w-14" />
              <div className="h-8 w-48 rounded bg-muted" />
              <div className="h-4 w-56 rounded bg-muted" />
            </div>
            <div className="h-12 w-full rounded-lg bg-muted" />
          </div>
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
