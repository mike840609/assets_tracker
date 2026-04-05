import { signIn } from "@/auth"
import { Button } from "@/components/ui/button"
import { TrendingUp } from "lucide-react"
import { getTranslations } from "next-intl/server"

export default async function LoginPage() {
  const t = await getTranslations("login")

  return (
    <div className="flex min-h-screen w-full items-center justify-center relative overflow-hidden bg-slate-50">
      {/* Dynamic Background Elements */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-primary/10 blur-3xl pointer-events-none -z-10 animate-pulse-slow" />
      <div className="absolute bottom-[-10%] right-[-5%] w-[40%] h-[40%] rounded-full bg-chart-4/10 blur-3xl pointer-events-none -z-10 animate-pulse-slow" style={{ animationDelay: "2s" }} />

      {/* Glassmorphism Card */}
      <div className="relative z-10 mx-auto flex w-full max-w-md flex-col justify-center space-y-8 p-10 bg-white/80 backdrop-blur-xl border border-white/60 shadow-[0_8px_32px_-8px_rgba(0,0,0,0.1)] rounded-3xl animate-slide-in-bottom">
        
        <div className="flex flex-col space-y-3 text-center">
          <div className="w-16 h-16 mx-auto rounded-xl flex items-center justify-center mb-4 relative group shadow-lg" style={{ background: "linear-gradient(135deg, #34d399 0%, #065f46 100%)" }}>
            <div className="absolute inset-0 rounded-xl blur-md bg-emerald-500/50 opacity-40 group-hover:opacity-70 transition-opacity duration-500 animate-pulse" style={{ background: "linear-gradient(135deg, #34d399 0%, #065f46 100%)" }}></div>
            <TrendingUp className="w-7 h-7 text-white relative z-10 transform transition-all group-hover:scale-110 group-hover:-rotate-12 duration-300" strokeWidth={2} />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-slate-900 to-slate-600 bg-clip-text text-transparent">
            {t("title")}
          </h1>
          <p className="text-sm text-slate-500 font-medium">
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
            className="w-full h-12 text-[15px] font-medium tracking-wide bg-white text-slate-700 hover:bg-slate-50 border border-slate-200 shadow-sm hover:shadow-md transition-all hover:-translate-y-0.5 rounded-xl flex items-center justify-center gap-3" 
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

        <div className="text-center text-xs text-slate-400 pt-4 mb-[-1rem]">
          {t("footer")}
        </div>
      </div>
    </div>
  )
}
