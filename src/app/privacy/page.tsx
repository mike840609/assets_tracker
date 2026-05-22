// S2: force-static is incompatible with nextConfig.cacheComponents (PPR mode).
// PPR prerendering the Suspense fallback shell is the correct tier here.
import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import type { Metadata } from "next";
import { ShieldCheck } from "lucide-react";

export const metadata: Metadata = {
  title: "Privacy Policy | Assets Tracker",
  description: "How Assets Tracker collects, uses, and protects your data.",
};

async function PrivacyContent() {
  const t = await getTranslations("privacy");

  const sections: Array<{
    title: string;
    body: string;
    link?: { href: string; label: string };
  }> = [
    { title: t("section1Title"), body: t("section1Body") },
    { title: t("section2Title"), body: t("section2Body") },
    { title: t("section3Title"), body: t("section3Body") },
    { title: t("section4Title"), body: t("section4Body") },
    { title: t("section5Title"), body: t("section5Body") },
    { title: t("section6Title"), body: t("section6Body") },
    { title: t("section7Title"), body: t("section7Body") },
    {
      title: t("section8Title"),
      body: t("section8Body"),
      link: { href: "mailto:support@astt.app", label: "support@astt.app" },
    },
  ];

  return (
    <main className="flex h-dvh w-full items-start justify-center overflow-x-hidden overflow-y-auto bg-background px-4 py-6 sm:py-12">
      <article className="w-full max-w-2xl space-y-7 rounded-xl border border-border/50 bg-card p-6 text-card-foreground shadow-sm sm:space-y-8 sm:p-10">
        <div className="flex flex-col space-y-3 text-center">
          <div
            className="mx-auto flex h-16 w-16 items-center justify-center rounded-xl shadow-lg"
            style={{ background: "linear-gradient(135deg, #34d399 0%, #065f46 100%)" }}
          >
            <ShieldCheck className="h-7 w-7 text-white" strokeWidth={2} />
          </div>
          <h1 className="text-3xl font-bold text-foreground">{t("title")}</h1>
          <p className="text-sm font-medium text-muted-foreground">{t("subtitle")}</p>
        </div>

        <div className="space-y-6">
          {sections.map((section) => (
            <div key={section.title} className="space-y-1.5">
              <h2 className="text-sm font-semibold text-foreground">{section.title}</h2>
              <p className="text-base leading-7 text-muted-foreground sm:text-sm sm:leading-relaxed">
                {section.body}
                {section.link ? (
                  <>
                    {" "}
                    <a
                      href={section.link.href}
                      className="font-medium text-foreground underline underline-offset-4 transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                    >
                      {section.link.label}
                    </a>
                  </>
                ) : null}
              </p>
            </div>
          ))}
        </div>

        <div className="flex flex-col items-start gap-3 border-t border-border/50 pt-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">{t("lastUpdated")}</p>
          <Link
            href="/login"
            prefetch={false}
            className="inline-flex min-h-11 items-center rounded-md text-xs font-medium text-muted-foreground underline underline-offset-4 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            {t("backToLogin")}
          </Link>
        </div>
      </article>
    </main>
  );
}

export default function PrivacyPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-dvh w-full items-start justify-center overflow-y-auto bg-background px-4 py-6 sm:py-12">
          <div className="w-full max-w-2xl animate-pulse space-y-6 rounded-xl border border-border/50 bg-card p-6 sm:p-10">
            <div className="flex flex-col items-center space-y-3">
              <div className="h-16 w-16 rounded-xl bg-emerald-100" />
              <div className="h-8 w-48 rounded bg-muted" />
              <div className="h-4 w-56 rounded bg-muted" />
            </div>
            {[...Array(8)].map((_, i) => (
              <div key={i} className="space-y-2">
                <div className="h-4 w-32 rounded bg-muted" />
                <div className="h-12 w-full rounded bg-muted" />
              </div>
            ))}
          </div>
        </div>
      }
    >
      <PrivacyContent />
    </Suspense>
  );
}
