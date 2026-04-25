// not-found.tsx is a Server Component — no 'use client' needed.
// It handles both notFound() calls and unmatched URLs at the root level.
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { SearchX } from "lucide-react";

export default async function NotFound() {
  const t = await getTranslations("notFound");

  return (
    <div className="flex flex-1 h-full w-full items-center justify-center px-4 relative overflow-y-auto">
      {/* Ambient blobs */}
      <div className="pointer-events-none absolute top-[-10%] left-[-10%] h-[50%] w-[50%] rounded-full bg-primary/10 blur-3xl -z-10" />
      <div className="pointer-events-none absolute bottom-[-10%] right-[-5%] h-[40%] w-[40%] rounded-full bg-chart-3/10 blur-3xl -z-10" />

      <div className="glass w-full max-w-md rounded-3xl p-10 space-y-6 text-center">
        {/* Large 404 */}
        <p className="text-8xl font-black tracking-tighter bg-gradient-to-br from-primary to-chart-3 bg-clip-text text-transparent select-none">
          404
        </p>

        {/* Icon */}
        <div
          className="mx-auto flex h-16 w-16 items-center justify-center rounded-xl shadow-lg"
          style={{ background: "linear-gradient(135deg, oklch(0.6 0.16 150) 0%, oklch(0.6 0.15 260) 100%)" }}
        >
          <SearchX className="h-7 w-7 text-white" strokeWidth={2} />
        </div>

        {/* Copy */}
        <div className="space-y-2">
          <h1 className="text-2xl font-extrabold tracking-tight text-foreground">
            {t("title")}
          </h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {t("description")}
          </p>
        </div>

        {/* CTA */}
        <Link
          id="not-found-home-link"
          href="/"
          className="inline-flex items-center justify-center rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-sm hover:opacity-90 transition-all active:scale-95"
        >
          {t("goHome")}
        </Link>
      </div>
    </div>
  );
}
