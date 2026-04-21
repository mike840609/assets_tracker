// S2: force-static is incompatible with nextConfig.cacheComponents (PPR mode).
// PPR prerendering the Suspense fallback shell is the correct tier here.
import { Suspense } from "react"
import { getTranslations } from "next-intl/server"
import Link from "next/link"
import { ShieldCheck } from "lucide-react"

async function PrivacyContent() {
  const t = await getTranslations("privacy")

  const sections = [
    { title: t("section1Title"), body: t("section1Body") },
    { title: t("section2Title"), body: t("section2Body") },
    { title: t("section3Title"), body: t("section3Body") },
    { title: t("section4Title"), body: t("section4Body") },
    { title: t("section5Title"), body: t("section5Body") },
    { title: t("section6Title"), body: t("section6Body") },
  ]

  return (
    <div className="flex min-h-screen w-full items-start justify-center relative overflow-x-hidden bg-slate-50 py-12 px-4">
      {/* Background elements */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-primary/10 blur-3xl pointer-events-none -z-10" />
      <div className="absolute bottom-[-10%] right-[-5%] w-[40%] h-[40%] rounded-full bg-chart-4/10 blur-3xl pointer-events-none -z-10" />

      <div className="relative z-10 w-full max-w-2xl bg-white/80 backdrop-blur-xl border border-white/60 shadow-[0_8px_32px_-8px_rgba(0,0,0,0.1)] rounded-3xl p-10 space-y-8">

        {/* Header */}
        <div className="flex flex-col space-y-3 text-center">
          <div className="w-16 h-16 mx-auto rounded-xl flex items-center justify-center shadow-lg" style={{ background: "linear-gradient(135deg, #34d399 0%, #065f46 100%)" }}>
            <ShieldCheck className="w-7 h-7 text-white" strokeWidth={2} />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-slate-900 to-slate-600 bg-clip-text text-transparent">
            {t("title")}
          </h1>
          <p className="text-sm text-slate-500 font-medium">
            {t("subtitle")}
          </p>
        </div>

        {/* Sections */}
        <div className="space-y-6">
          {sections.map((section) => (
            <div key={section.title} className="space-y-1.5">
              <h2 className="text-sm font-semibold text-slate-800 uppercase tracking-wide">
                {section.title}
              </h2>
              <p className="text-sm text-slate-600 leading-relaxed">
                {section.body}
              </p>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
          <p className="text-xs text-slate-400">{t("lastUpdated")}</p>
          <Link
            href="/login"
            className="text-xs text-slate-500 hover:text-slate-700 underline transition-colors"
          >
            {t("backToLogin")}
          </Link>
        </div>
      </div>
    </div>
  )
}

export default function PrivacyPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen w-full items-center justify-center bg-slate-50">
        <div className="w-full max-w-2xl rounded-3xl bg-white/80 p-10 animate-pulse space-y-6">
          <div className="flex flex-col items-center space-y-3">
            <div className="w-16 h-16 rounded-xl bg-emerald-100" />
            <div className="h-8 w-48 rounded bg-slate-200" />
            <div className="h-4 w-56 rounded bg-slate-100" />
          </div>
          {[...Array(6)].map((_, i) => (
            <div key={i} className="space-y-2">
              <div className="h-4 w-32 rounded bg-slate-200" />
              <div className="h-12 w-full rounded bg-slate-100" />
            </div>
          ))}
        </div>
      </div>
    }>
      <PrivacyContent />
    </Suspense>
  )
}
