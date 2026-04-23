// S1: force-static is incompatible with nextConfig.cacheComponents (PPR mode).
// PPR prerendering the Suspense fallback shell is the correct tier here.
import { Suspense } from "react"
import { signIn } from "@/auth"
import { Button } from "@/components/ui/button"
import { TrendingUp, Lock, ShieldCheck, EyeOff } from "lucide-react"
import { getTranslations } from "next-intl/server"
import Link from "next/link"

async function LoginContent() {
  const t = await getTranslations("login")
  const isPreview = process.env.VERCEL_ENV === "preview"

  return (
    <div className="flex min-h-screen w-full items-center justify-center relative overflow-hidden bg-background">
      {/* Dynamic Background Elements */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-primary/10 blur-3xl pointer-events-none -z-10 animate-pulse-slow" />
      <div className="absolute bottom-[-10%] right-[-5%] w-[40%] h-[40%] rounded-full bg-chart-4/10 blur-3xl pointer-events-none -z-10 animate-pulse-slow" style={{ animationDelay: "2s" }} />

      {/* Glassmorphism Card */}
      <div className="relative z-10 mx-auto flex w-full max-w-md flex-col justify-center space-y-8 p-10 bg-card/80 dark:bg-card/70 backdrop-blur-xl border border-border/60 shadow-[0_8px_32px_-8px_rgba(0,0,0,0.1)] dark:shadow-[0_8px_36px_-8px_rgba(0,0,0,0.55)] rounded-3xl animate-slide-in-bottom">

        <div className="flex flex-col space-y-3 text-center">
          <div className="w-16 h-16 mx-auto rounded-xl flex items-center justify-center mb-4 relative group shadow-lg" style={{ background: "linear-gradient(135deg, #34d399 0%, #065f46 100%)" }}>
            <div className="absolute inset-0 rounded-xl blur-md bg-emerald-500/50 opacity-40 group-hover:opacity-70 transition-opacity duration-500 animate-pulse" style={{ background: "linear-gradient(135deg, #34d399 0%, #065f46 100%)" }}></div>
            <TrendingUp className="w-7 h-7 text-white relative z-10 transform transition-all group-hover:scale-110 group-hover:-rotate-12 duration-300" strokeWidth={2} />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-foreground to-muted-foreground bg-clip-text text-transparent">
            {t("title")}
          </h1>
          <p className="text-sm text-muted-foreground font-medium">
            {t("subtitle")}
          </p>
        </div>

        <form
          action={async () => {
            "use server"
            await signIn("google", { redirectTo: "/" })
          }}
          className="pt-4"
        >
          <Button
            className="w-full h-12 text-[15px] font-medium tracking-wide bg-background text-foreground hover:bg-muted border border-border shadow-sm hover:shadow-md transition-all hover:-translate-y-0.5 rounded-xl flex items-center justify-center gap-3"
            type="submit"
          >
            <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            {t("googleButton")}
          </Button>
        </form>

        {/* Trust badges */}
        <div className="flex flex-col gap-2 pt-2">
          <div className="flex items-center gap-2.5 text-xs text-muted-foreground">
            <Lock className="w-3.5 h-3.5 shrink-0 text-emerald-500" />
            <span>{t("trust1")}</span>
          </div>
          <div className="flex items-center gap-2.5 text-xs text-muted-foreground">
            <ShieldCheck className="w-3.5 h-3.5 shrink-0 text-emerald-500" />
            <span>{t("trust2")}</span>
          </div>
          <div className="flex items-center gap-2.5 text-xs text-muted-foreground">
            <EyeOff className="w-3.5 h-3.5 shrink-0 text-emerald-500" />
            <span>{t("trust3")}</span>
          </div>
        </div>

        {isPreview && (
          <>
            <div className="flex items-center gap-3 pt-2">
              <div className="flex-1 h-px bg-border" />
              <span className="text-xs text-muted-foreground font-medium">Preview Mode</span>
              <div className="flex-1 h-px bg-border" />
            </div>

            <form
              action={async (formData: FormData) => {
                "use server"
                await signIn("credentials", {
                  password: formData.get("password") as string,
                  redirectTo: "/",
                })
              }}
            >
              <div className="flex flex-col gap-3">
                <input
                  name="password"
                  type="password"
                  placeholder="Preview password"
                  required
                  className="h-12 w-full rounded-xl border border-input bg-background px-4 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                />
                <Button
                  type="submit"
                  className="w-full h-12 text-[15px] font-medium tracking-wide bg-amber-100/70 text-amber-900 hover:bg-amber-100 border border-amber-300 shadow-sm hover:shadow-md transition-all hover:-translate-y-0.5 rounded-xl dark:bg-amber-300/20 dark:text-amber-200 dark:border-amber-400/40 dark:hover:bg-amber-300/30"
                >
                  Preview Login
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
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen w-full items-center justify-center bg-background">
        <div className="w-full max-w-md rounded-3xl bg-card/80 p-10 space-y-8 animate-pulse border border-border/60">
          <div className="flex flex-col items-center space-y-3">
            <div className="w-16 h-16 rounded-xl bg-primary/20" />
            <div className="h-8 w-48 rounded bg-muted" />
            <div className="h-4 w-56 rounded bg-muted/70" />
          </div>
          <div className="h-12 w-full rounded-xl bg-muted/70" />
        </div>
      </div>
    }>
      <LoginContent />
    </Suspense>
  )
}
