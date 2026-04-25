import { Suspense } from "react"
import { getTranslations } from "next-intl/server"
import Link from "next/link"
import { Search, Home } from "lucide-react"

async function NotFoundContent() {
  const t = await getTranslations("errors")

  return (
    <div className="flex flex-1 h-full w-full items-center justify-center relative overflow-y-auto bg-background">
      {/* Ambient background */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-primary/10 blur-3xl pointer-events-none -z-10 animate-pulse" />
      <div className="absolute bottom-[-10%] right-[-5%] w-[40%] h-[40%] rounded-full bg-chart-3/8 blur-3xl pointer-events-none -z-10 animate-pulse" style={{ animationDelay: "2s" }} />

      <div className="relative z-10 mx-auto flex w-full max-w-md flex-col items-center justify-center space-y-6 p-10 bg-card/80 backdrop-blur-xl border border-border/50 shadow-[0_8px_32px_-8px_rgba(0,0,0,0.12)] dark:shadow-[0_8px_32px_-8px_rgba(0,0,0,0.5)] rounded-3xl animate-slide-in-bottom">
        {/* Icon */}
        <div
          className="w-16 h-16 rounded-xl flex items-center justify-center shadow-lg"
          style={{ background: "linear-gradient(135deg, #818cf8 0%, #4338ca 100%)" }}
        >
          <Search className="w-7 h-7 text-white" strokeWidth={2} />
        </div>

        {/* Large 404 */}
        <div className="text-7xl font-black tracking-tighter bg-gradient-to-b from-foreground/20 to-foreground/5 bg-clip-text text-transparent select-none leading-none">
          404
        </div>

        {/* Copy */}
        <div className="flex flex-col space-y-2 text-center">
          <h1 className="text-2xl font-extrabold tracking-tight bg-gradient-to-r from-foreground to-muted-foreground bg-clip-text text-transparent">
            {t("notFoundTitle")}
          </h1>
          <p className="text-sm text-muted-foreground font-medium leading-relaxed">
            {t("notFoundDescription")}
          </p>
        </div>

        {/* CTA */}
        <Link
          href="/"
          className="w-full h-12 text-[15px] font-medium tracking-wide bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm hover:shadow-md transition-all hover:-translate-y-0.5 rounded-xl flex items-center justify-center gap-2.5 mt-2"
        >
          <Home className="w-4 h-4" />
          {t("backToDashboard")}
        </Link>
      </div>
    </div>
  )
}

export default function NotFound() {
  return (
    <Suspense fallback={
      <div className="flex flex-1 h-full w-full items-center justify-center bg-background">
        <div className="w-full max-w-md rounded-3xl bg-card/80 p-10 space-y-6 animate-pulse">
          <div className="flex flex-col items-center space-y-3">
            <div className="w-16 h-16 rounded-xl bg-primary/20" />
            <div className="h-16 w-32 rounded bg-muted" />
            <div className="h-6 w-40 rounded bg-muted" />
            <div className="h-4 w-56 rounded bg-muted" />
          </div>
          <div className="h-12 w-full rounded-xl bg-muted" />
        </div>
      </div>
    }>
      <NotFoundContent />
    </Suspense>
  )
}
